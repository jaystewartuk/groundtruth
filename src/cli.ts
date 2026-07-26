#!/usr/bin/env node
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { discoverContextFiles } from "./discover.js";
import { checkAssertions } from "./assertions/index.js";
import { loadManualAssertions, ManualAssertionsError } from "./manual/load.js";
import { summarize, formatTable, formatJson } from "./report.js";

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
      "groundtruth check — verify agent-context claims against the actual repo",
      "",
      "Usage:",
      "  groundtruth check [--repo <path>] [--file <path>] [--json]",
      "",
      "Options:",
      "  --repo <path>   Repo root to check against (default: cwd)",
      "  --file <path>   Assertions file (default: .groundtruth.jsonc)",
      "  --json          Print machine-readable JSON instead of a table",
      "",
      "Exit code is non-zero if any assertion is 'failing'.",
      "'unverifiable' assertions are always reported and never silently pass.",
      "",
      "See .groundtruth.jsonc.example for the assertions file format. LLM-based",
      "extraction from CLAUDE.md/AGENTS.md is not implemented yet — assertions",
      "are hand-authored for now.",
      "",
    ].join("\n"),
  );
}

function main(): void {
  const argv = process.argv.slice(2);
  const command = argv[0] && !argv[0].startsWith("-") ? argv[0] : "check";
  const options = parseArgs(command === argv[0] ? argv.slice(1) : argv);

  if (command !== "check") {
    process.stderr.write(`Unknown command "${command}". Only "check" is supported.\n`);
    process.exit(2);
  }

  const repoRoot = resolve(options.repo);
  const filePath = resolve(repoRoot, options.file);

  if (!existsSync(filePath)) {
    process.stderr.write(
      `No assertions file at ${filePath}.\n` +
        `Copy .groundtruth.jsonc.example to .groundtruth.jsonc and edit it, or pass --file.\n`,
    );
    process.exit(2);
  }

  let assertions;
  try {
    assertions = loadManualAssertions(filePath);
  } catch (err) {
    if (err instanceof ManualAssertionsError) {
      process.stderr.write(`${err.message}\n`);
      process.exit(2);
    }
    throw err;
  }

  const contextFiles = discoverContextFiles(repoRoot);
  const results = checkAssertions(repoRoot, assertions);
  const summary = summarize(results);

  process.stdout.write(
    (options.json ? formatJson(summary, contextFiles) : formatTable(summary, contextFiles)) + "\n",
  );

  process.exit(summary.failing > 0 ? 1 : 0);
}

main();
