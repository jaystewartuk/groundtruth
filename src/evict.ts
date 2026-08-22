import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { applyEdits, modify, parse as parseJsonc } from "jsonc-parser";
import { buildPatternDigest, compilePattern, resolveScope } from "./assertions/text-match.js";
import { readStdin, trimTrailingNewlines } from "./digest.js";
import type { TextAbsentArgs } from "./types.js";

// `groundtruth evict` — the workflow command for retiring a fact: sweep every
// tracked text file for it, then (with --write) turn the one-time sweep into
// permanent enforcement as a text_absent assertion. Thin orchestration over
// the text_absent machinery; the design decisions live in ADR-0008.
//
// The fact is read from stdin, never argv — argv lands in shell history,
// which is a context surface. The sweep is case-insensitive: an eviction
// cares about the fact in any casing, and the written assertion matches
// (caseInsensitive: true, or normalize: "lower" under --redact).

// A working-tree scan cannot see beyond the working tree, so the command
// must say so — the fail-closed principle applied to eviction. Hard-coded on
// purpose: making the boundary configurable would let it be configured away.
const UNSWEPT_SURFACES = [
  "NOT swept — check these yourself:",
  "  · git history (this repo and its forks/clones)",
  "  · other repositories that quote or transcribe this one",
  "  · GitHub: PR/issue titles, bodies, comments — and their edit histories",
  "  · CI logs, published packages, deployment artifacts",
  "  · agent session transcripts and memory files outside this repo",
].join("\n");

type EvictOptions = {
  repo: string;
  file: string;
  redact: boolean;
  label?: string;
  write: boolean;
  source?: string;
};

function parseEvictArgs(argv: string[]): EvictOptions | null {
  const options: EvictOptions = {
    repo: process.cwd(),
    file: ".groundtruth.jsonc",
    redact: false,
    write: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--repo") options.repo = argv[++i] ?? options.repo;
    else if (arg === "--file") options.file = argv[++i] ?? options.file;
    else if (arg === "--redact") options.redact = true;
    else if (arg === "--write") options.write = true;
    else if (arg === "--label") options.label = argv[++i];
    else if (arg === "--source") options.source = argv[++i];
    else {
      process.stderr.write(`Unknown option "${arg}" for groundtruth evict.\n`);
      return null;
    }
  }
  return options;
}

function buildAssertion(fact: string, options: EvictOptions): Record<string, unknown> {
  const args: TextAbsentArgs = options.redact
    ? {
        patternDigest: buildPatternDigest(fact, randomBytes(16).toString("hex"), "lower"),
        label: options.label,
      }
    : { pattern: fact, caseInsensitive: true };

  let source = options.source;
  if (!source) {
    source = `evicted ${new Date().toISOString().slice(0, 10)} via groundtruth evict`;
    process.stderr.write(
      "No --source given — recording a date instead. A reference to the decision\n" +
        "record that retired this fact (a decision-log line, a commit) is better:\n" +
        "it keeps every failure traceable to the line that justifies the check.\n",
    );
  }

  const handle = options.redact ? `"${options.label}"` : "fact";
  return {
    claim: `The evicted ${handle} does not appear anywhere in this repo.`,
    kind: "text_absent",
    args,
    source,
  };
}

function appendAssertion(filePath: string, assertion: Record<string, unknown>): void {
  if (!existsSync(filePath)) {
    const fresh = {
      assertions: [assertion],
    };
    writeFileSync(
      filePath,
      "// .groundtruth.jsonc — created by `groundtruth evict --write`.\n" +
        `${JSON.stringify(fresh, null, 2)}\n`,
    );
    return;
  }

  const text = readFileSync(filePath, "utf8");
  const parsed = parseJsonc(text) as { assertions?: unknown[] } | undefined;
  const index = Array.isArray(parsed?.assertions) ? parsed.assertions.length : 0;
  const edits = modify(text, ["assertions", index], assertion, {
    isArrayInsertion: true,
    formattingOptions: { insertSpaces: true, tabSize: 2 },
  });
  writeFileSync(filePath, applyEdits(text, edits));
}

export async function runEvict(argv: string[]): Promise<number> {
  const options = parseEvictArgs(argv);
  if (!options) return 2;
  if (options.redact && options.write && !options.label) {
    process.stderr.write("--write --redact requires --label <name> — the report's handle for the fact.\n");
    return 2;
  }

  if (process.stdin.isTTY) {
    process.stderr.write("Enter the fact to evict, then press Enter and Ctrl-D:\n");
  }
  const fact = trimTrailingNewlines(await readStdin());
  if (fact.length === 0) {
    process.stderr.write("Nothing to evict — pipe or type the fact on stdin.\n");
    return 2;
  }

  const repoRoot = resolve(options.repo);
  const assertionsFile = resolve(repoRoot, options.file);
  const scope = resolveScope(repoRoot, { assertionsFile });
  if (!scope.ok) {
    process.stderr.write(`Cannot sweep: ${scope.detail}\n`);
    return 2;
  }

  const matcher = compilePattern({ pattern: fact, caseInsensitive: true });
  if (!matcher.ok) throw new Error(matcher.detail); // literal patterns always compile

  const hits = scope.files.flatMap((file) =>
    matcher.findIn(file, readFileSync(join(repoRoot, file), "utf8")),
  );

  const lines: string[] = [];
  for (const hit of hits) {
    lines.push(options.redact ? `${hit.file}#L${hit.line}` : `${hit.file}#L${hit.line}: ${hit.text}`);
  }
  if (hits.length > 0) lines.push("");
  lines.push(
    `${hits.length} hit(s) across ${scope.description}.` +
      (scope.skipped.length > 0 ? ` Skipped: ${scope.skipped.join(", ")}.` : ""),
  );

  if (options.write) {
    appendAssertion(assertionsFile, buildAssertion(fact, options));
    lines.push(
      `Appended a ${options.redact ? "redacted" : "plaintext"} text_absent assertion to ${options.file} — ` +
        `\`groundtruth check\` now enforces non-recurrence.`,
    );
  }

  lines.push("", `Swept: working tree (${scope.description}).`, UNSWEPT_SURFACES);
  process.stdout.write(`${lines.join("\n")}\n`);

  return hits.length > 0 ? 1 : 0;
}
