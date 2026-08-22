#!/usr/bin/env node
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { discoverContextFiles } from "./discover.js";
import { checkAssertions } from "./assertions/index.js";
import { loadManualAssertions, ManualAssertionsError } from "./manual/load.js";
import { summarize, formatTable, formatJson } from "./report.js";
import { runDigest } from "./digest.js";
import { runEvict } from "./evict.js";

type Options = { repo: string; file: string; json: boolean };

function parseArgs(argv: string[]): Options {
  const options: Options = { repo: process.cwd(), file: ".groundtruth.jsonc", json: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--repo") {
      options.repo = argv[++i] ?? options.repo;
    } else if (arg === "--file") {
      options.file = argv[++i] ?? options.file;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }
  return options;
}

function printHelp(): void {
  process.stdout.write(
    [
      "groundtruth — verify agent-context claims against the actual repo",
      "",
      "Usage:",
      "  groundtruth check [--repo <path>] [--file <path>] [--json]",
      "  groundtruth digest [--stdin] [--exact]",
      "  groundtruth evict [--redact] [--label <name>] [--write] [--source <ref>]",
      "                    [--repo <path>] [--file <path>]",
      "",
      "check — run the assertions file against the repo:",
      "  --repo <path>   Repo root to check against (default: cwd)",
      "  --file <path>   Assertions file (default: .groundtruth.jsonc)",
      "  --json          Print machine-readable JSON instead of a table",
      "",
      "  Exit code is non-zero if any assertion is 'failing'.",
      "  'unverifiable' assertions are always reported and never silently pass.",
      "",
      "digest — author a redacted pattern for a text_absent assertion:",
      "  Reads the literal from stdin (never argv — shell history is a context",
      "  surface) and prints a ready-to-paste patternDigest object.",
      "  --stdin         Explicit pipe mode for scripting",
      "  --exact         Match case-sensitively (default folds case)",
      "",
      "evict — sweep the working tree for a retired fact, read from stdin:",
      "  --redact        Report hit locations only, never the matching lines",
      "  --write         Append a text_absent assertion to the assertions file,",
      "                  turning the one-time sweep into permanent enforcement",
      "  --label <name>  Report handle for the fact (required with --redact --write)",
      "  --source <ref>  The decision record that retired the fact",
      "",
      "See .groundtruth.jsonc.example for the assertions file format. LLM-based",
      "extraction from CLAUDE.md/AGENTS.md is not implemented yet — assertions",
      "are hand-authored for now.",
      "",
    ].join("\n"),
  );
}

function runCheck(argv: string[]): number {
  const options = parseArgs(argv);
  const repoRoot = resolve(options.repo);
  const filePath = resolve(repoRoot, options.file);

  if (!existsSync(filePath)) {
    process.stderr.write(
      `No assertions file at ${filePath}.\n` +
        `Copy .groundtruth.jsonc.example to .groundtruth.jsonc and edit it, or pass --file.\n`,
    );
    return 2;
  }

  let assertions;
  try {
    assertions = loadManualAssertions(filePath);
  } catch (err) {
    if (err instanceof ManualAssertionsError) {
      process.stderr.write(`${err.message}\n`);
      return 2;
    }
    throw err;
  }

  const contextFiles = discoverContextFiles(repoRoot);
  const results = checkAssertions(repoRoot, assertions, { assertionsFile: filePath });
  const summary = summarize(results);

  process.stdout.write(
    (options.json ? formatJson(summary, contextFiles) : formatTable(summary, contextFiles)) + "\n",
  );

  return summary.failing > 0 ? 1 : 0;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const command = argv[0] && !argv[0].startsWith("-") ? argv[0] : "check";
  const rest = command === argv[0] ? argv.slice(1) : argv;

  if (command === "check") {
    process.exit(runCheck(rest));
  } else if (command === "digest") {
    process.exit(await runDigest(rest));
  } else if (command === "evict") {
    process.exit(await runEvict(rest));
  } else {
    process.stderr.write(
      `Unknown command "${command}". Supported: "check", "digest", "evict".\n`,
    );
    process.exit(2);
  }
}

void main();
