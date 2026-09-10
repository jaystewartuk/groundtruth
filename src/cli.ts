#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { discoverContextFiles } from "./discover.js";
import { checkAssertions } from "./assertions/index.js";
import { loadManualAssertions, ManualAssertionsError } from "./manual/load.js";
import { verifyAssertionSources } from "./manual/verify-source.js";
import { summarize, formatTable, formatJson } from "./report.js";

type Options = { repo: string; file: string; json: boolean; strictSources: boolean };

class UsageError extends Error {}

/** Read from the installed package rather than baked in at build time, so it
 * can never disagree with the version npm actually resolved. */
function version(): string {
  try {
    return JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
  } catch {
    return "unknown";
  }
}

// Every flag is matched explicitly and anything else is a usage error. A
// checker whose whole premise is that it never silently skips what it cannot
// verify has no business silently ignoring a mistyped flag: `--jsonn` used to
// print a table and exit 0, which is a green build that never ran the check
// the author asked for.
function parseArgs(argv: string[]): Options {
  const options: Options = {
    repo: process.cwd(),
    file: ".groundtruth.jsonc",
    json: false,
    strictSources: false,
  };

  const value = (flag: string, next: string | undefined): string => {
    if (next === undefined || next.startsWith("-")) {
      throw new UsageError(`${flag} requires a value.`);
    }
    return next;
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;
    if (arg === "--repo") {
      options.repo = value(arg, argv[++i]);
    } else if (arg === "--file") {
      options.file = value(arg, argv[++i]);
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--strict-sources") {
      options.strictSources = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else if (arg === "--version" || arg === "-v") {
      process.stdout.write(`${version()}\n`);
      process.exit(0);
    } else {
      throw new UsageError(`Unknown option "${arg}". Run "groundtruth --help" for usage.`);
    }
  }
  return options;
}

function printHelp(): void {
  process.stdout.write(
    [
      `groundtruth ${version()} — verify agent-context claims against the actual repo`,
      "",
      "Usage:",
      "  groundtruth check [--repo <path>] [--file <path>] [--json] [--strict-sources]",
      "",
      "Options:",
      "  --repo <path>      Repo root to check against (default: cwd)",
      "  --file <path>      Assertions file (default: .groundtruth.jsonc)",
      "  --json             Print machine-readable JSON instead of a table",
      "  --strict-sources   Also exit non-zero when an assertion's `source` no",
      "                     longer points at the line that makes its claim",
      "  -v, --version      Print the version and exit",
      "  -h, --help         Print this help and exit",
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

  if (command !== "check") {
    process.stderr.write(`Unknown command "${command}". Only "check" is supported.\n`);
    process.exit(2);
  }

  let options: Options;
  try {
    options = parseArgs(command === argv[0] ? argv.slice(1) : argv);
  } catch (err) {
    if (err instanceof UsageError) {
      process.stderr.write(`${err.message}\n`);
      process.exit(2);
    }
    throw err;
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
  const sourceWarnings = verifyAssertionSources(repoRoot, assertions);

  process.stdout.write(
    (options.json
      ? formatJson(summary, contextFiles, sourceWarnings)
      : formatTable(summary, contextFiles, sourceWarnings)) + "\n",
  );

  const failed = summary.failing > 0 || (options.strictSources && sourceWarnings.length > 0);
  process.exit(failed ? 1 : 0);
}

main();
