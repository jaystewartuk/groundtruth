// Entry point for the groundtruth GitHub Action (see ../action.yml).
//
// This wraps the published CLI rather than reimplementing any checking: it
// runs `groundtruth check --json`, then does the three things a CI surface can
// do that a terminal cannot — annotate the exact context-file line that made a
// false claim so it lands in the pull request diff, write a job summary, and
// expose the counts as step outputs for later steps to branch on.
//
// Deliberately dependency-free (no @actions/core): a composite action gets no
// bundling step, so anything it imports would have to be vendored into this
// repo. Everything used here is Node 20 standard library. See
// docs/adr/0005-composite-action-wrapping-the-published-cli.md.

import { spawnSync } from "node:child_process";
import { appendFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, posix, relative, resolve, sep } from "node:path";
import { argv, env, exit, stdout } from "node:process";
import { fileURLToPath } from "node:url";

const MARK = { passing: "✓", failing: "✗", unverifiable: "?" };
const ORDER = ["failing", "unverifiable", "passing"];

/** Workflow-command message escaping, per the GitHub Actions toolkit. */
export function escapeData(value) {
  return String(value).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}

/** Workflow-command property escaping — stricter than a message body. */
export function escapeProperty(value) {
  return escapeData(value).replace(/:/g, "%3A").replace(/,/g, "%2C");
}

/**
 * Split an assertion's `source` ("CLAUDE.md#L7", "CLAUDE.md#L10-11") into a
 * file and a line range. A source with no `#L` fragment still annotates the
 * file, just without a line — better than dropping the annotation.
 */
export function parseSource(source) {
  const match = /^(.*?)#L(\d+)(?:-L?(\d+))?$/.exec(String(source ?? ""));
  if (!match) return { file: String(source ?? "").trim() || null, line: null, endLine: null };
  const [, file, start, end] = match;
  return {
    file: file.trim() || null,
    line: Number(start),
    endLine: end ? Number(end) : Number(start),
  };
}

/** Repo-root-relative source path -> workspace-relative, in POSIX form. */
export function annotationPath(sourceFile, repoRoot, workspace) {
  const absolute = resolve(repoRoot, sourceFile);
  const rel = relative(resolve(workspace), absolute);
  if (!rel || rel.startsWith("..")) return sourceFile.split(sep).join(posix.sep);
  return rel.split(sep).join(posix.sep);
}

/**
 * One `::error`/`::warning` workflow command per failing or unverifiable
 * assertion, anchored to the sentence that made the claim. Passing assertions
 * are not annotated — a green run should add nothing to the diff.
 */
export function annotationLines(summary, { repoRoot = ".", workspace = "." } = {}) {
  const lines = [];
  for (const result of summary.results ?? []) {
    const command =
      result.status === "failing" ? "error" : result.status === "unverifiable" ? "warning" : null;
    if (!command) continue;

    const { file, line, endLine } = parseSource(result.assertion?.source);
    const props = [];
    if (file) {
      props.push(`file=${escapeProperty(annotationPath(file, repoRoot, workspace))}`);
      if (line !== null) {
        props.push(`line=${line}`, `endLine=${endLine}`);
      }
    }
    props.push(
      `title=${escapeProperty(
        result.status === "failing" ? "groundtruth: claim is false" : "groundtruth: unverifiable claim",
      )}`,
    );
    lines.push(
      `::${command} ${props.join(",")}::${escapeData(`${result.assertion?.claim ?? ""}\n${result.detail ?? ""}`)}`,
    );
  }
  return lines;
}

/** The report as it appears in the job summary. */
export function summaryMarkdown(summary, contextFiles, { file = ".groundtruth.jsonc" } = {}) {
  const total = (summary.results ?? []).length;
  const verdict =
    summary.failing > 0
      ? `**${summary.failing} of ${total} assertion(s) failing** — the agent-context layer has drifted.`
      : `**All ${total} assertion(s) hold.** The agent-context layer matches the repo.`;

  const lines = [
    "## groundtruth",
    "",
    verdict,
    "",
    `Context layer: ${contextFiles.length > 0 ? contextFiles.map((f) => `\`${f}\``).join(", ") : "_none found (CLAUDE.md / AGENTS.md)_"}  `,
    `Assertions: \`${file}\` — ${summary.passing} passing, ${summary.failing} failing, ${summary.unverifiable} unverifiable`,
    "",
  ];

  if (total > 0) {
    lines.push("| | Source | Claim | Detail |", "|---|---|---|---|");
    for (const status of ORDER) {
      for (const r of (summary.results ?? []).filter((x) => x.status === status)) {
        lines.push(
          `| ${MARK[status]} | \`${cell(r.assertion?.source)}\` | ${cell(r.assertion?.claim)} | ${cell(r.detail)} |`,
        );
      }
    }
    lines.push("");
  }

  if (summary.unverifiable > 0) {
    lines.push(
      "> An unverifiable assertion is reported, never silently passed — it does not",
      "> fail the build unless `fail-on-unverifiable: true` is set.",
      "",
    );
  }

  return lines.join("\n");
}

function cell(value) {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ");
}

/** The same worst-first ordering the CLI prints, for the job log. */
export function renderConsole(summary, contextFiles) {
  const lines = [
    contextFiles.length > 0
      ? `Context layer: ${contextFiles.join(", ")}`
      : "Context layer: none found (CLAUDE.md / AGENTS.md)",
    `${(summary.results ?? []).length} assertion(s) — ${summary.passing} passing, ${summary.failing} failing, ${summary.unverifiable} unverifiable`,
    "",
  ];
  for (const status of ORDER) {
    for (const r of (summary.results ?? []).filter((x) => x.status === status)) {
      lines.push(`${MARK[status]} ${r.assertion?.source}  ${JSON.stringify(r.assertion?.claim ?? "")}`);
      lines.push(`  ${r.detail ?? ""}`);
    }
  }
  return lines.join("\n");
}

export function exitCodeFor(summary, { failOnUnverifiable = false } = {}) {
  if (summary.failing > 0) return 1;
  if (failOnUnverifiable && summary.unverifiable > 0) return 1;
  return 0;
}

/** stdout may carry npx install chatter ahead of the report. */
export function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Expected JSON from "groundtruth check --json" but got:\n${text}`);
  }
  return JSON.parse(text.slice(start, end + 1));
}

function boolInput(value, fallback = false) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "") return fallback;
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function setOutputs(outputs) {
  if (!env.GITHUB_OUTPUT) return;
  const lines = Object.entries(outputs).map(([key, value]) => `${key}=${value}`);
  appendFileSync(env.GITHUB_OUTPUT, `${lines.join("\n")}\n`);
}

function fail(message) {
  stdout.write(`::error title=groundtruth::${escapeData(message)}\n`);
  exit(2);
}

function main() {
  const workspace = env.GITHUB_WORKSPACE || process.cwd();
  const repoRoot = resolve(workspace, env.INPUT_WORKING_DIRECTORY || ".");
  const file = env.INPUT_FILE || ".groundtruth.jsonc";
  const version = (env.INPUT_VERSION || "latest").trim();
  const cliPath = (env.INPUT_CLI_PATH || "").trim();

  const args = ["check", "--repo", repoRoot, "--file", file, "--json"];
  const [command, commandArgs] = cliPath
    ? ["node", [resolve(workspace, cliPath), ...args]]
    : ["npx", ["--yes", `@groundtruth-sh/cli@${version}`, ...args]];

  const run = spawnSync(command, commandArgs, {
    cwd: repoRoot,
    encoding: "utf8",
    shell: false,
    env,
  });

  if (run.error) fail(`Could not run ${command}: ${run.error.message}`);
  if (run.stderr) stdout.write(run.stderr);
  // The CLI reserves exit 2 for "could not even run the check" — a missing or
  // malformed assertions file. That is a setup failure, not a drift finding,
  // so it is surfaced as-is rather than dressed up as a failing assertion.
  if (run.status !== 0 && run.status !== 1) {
    fail(
      `groundtruth check could not run (exit ${run.status}). ` +
        `Check that "${file}" exists in "${env.INPUT_WORKING_DIRECTORY || "."}" and is valid.`,
    );
  }

  let report;
  try {
    report = extractJson(run.stdout ?? "");
  } catch (err) {
    fail(err.message);
    return;
  }

  const contextFiles = report.contextFiles ?? [];
  stdout.write(`${renderConsole(report, contextFiles)}\n`);

  if (boolInput(env.INPUT_ANNOTATIONS, true)) {
    for (const line of annotationLines(report, { repoRoot, workspace })) {
      stdout.write(`${line}\n`);
    }
  }

  const reportPath = join(env.RUNNER_TEMP || tmpdir(), "groundtruth-report.json");
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  if (boolInput(env.INPUT_SUMMARY, true) && env.GITHUB_STEP_SUMMARY) {
    appendFileSync(env.GITHUB_STEP_SUMMARY, `${summaryMarkdown(report, contextFiles, { file })}\n`);
  }

  setOutputs({
    total: (report.results ?? []).length,
    passing: report.passing ?? 0,
    failing: report.failing ?? 0,
    unverifiable: report.unverifiable ?? 0,
    "report-path": reportPath,
  });

  exit(exitCodeFor(report, { failOnUnverifiable: boolInput(env.INPUT_FAIL_ON_UNVERIFIABLE, false) }));
}

if (argv[1] && resolve(argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main();
}
