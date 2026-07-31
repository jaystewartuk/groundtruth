import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Two layers here. The pure functions below are the parts of the Action that
// have no runner to lean on — annotation escaping in particular follows a
// protocol where getting it subtly wrong shows up as a mangled message in
// someone else's pull request, not as an error here. The e2e block then runs
// the real runner with a faked runner environment, which is the only way to
// prove the exit code, the outputs file and the summary file are actually
// written the way GitHub expects to read them.

import {
  annotationLines,
  annotationPath,
  escapeData,
  escapeProperty,
  exitCodeFor,
  extractJson,
  parseSource,
  sanitizeVersion,
  summaryMarkdown,
} from "../action/run.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const RUNNER = resolve(ROOT, "action", "run.mjs");
const CLI = resolve(ROOT, "dist", "cli.js");
const SAMPLE_REPO = resolve(HERE, "fixtures", "sample-repo");

const failingResult = {
  assertion: {
    claim: "The Supabase project is torn down; do not add an MCP server for it.",
    kind: "path_absent",
    args: { path: ".mcp.json" },
    source: "CLAUDE.md#L8",
  },
  status: "failing",
  detail: ".mcp.json exists but should not",
};

describe("parseSource", () => {
  it("splits a single-line source", () => {
    expect(parseSource("CLAUDE.md#L7")).toEqual({ file: "CLAUDE.md", line: 7, endLine: 7 });
  });

  it("splits a range, in both the L10-11 and L10-L11 spellings", () => {
    expect(parseSource("CLAUDE.md#L10-11")).toEqual({ file: "CLAUDE.md", line: 10, endLine: 11 });
    expect(parseSource("docs/AGENTS.md#L10-L11")).toEqual({
      file: "docs/AGENTS.md",
      line: 10,
      endLine: 11,
    });
  });

  it("keeps the file when there is no line fragment, rather than dropping the annotation", () => {
    expect(parseSource("CLAUDE.md")).toEqual({ file: "CLAUDE.md", line: null, endLine: null });
  });

  it("survives a missing source", () => {
    expect(parseSource(undefined)).toEqual({ file: null, line: null, endLine: null });
  });
});

describe("workflow-command escaping", () => {
  it("escapes the characters that would otherwise terminate a message", () => {
    expect(escapeData("100% of\r\nlines")).toBe("100%25 of%0D%0Alines");
  });

  it("escapes colons and commas in properties, which messages keep verbatim", () => {
    expect(escapeProperty("a:b,c")).toBe("a%3Ab%2Cc");
    expect(escapeData("a:b,c")).toBe("a:b,c");
  });
});

describe("annotationLines", () => {
  it("emits an error for a failing assertion, anchored to the claiming line", () => {
    const [line] = annotationLines({ results: [failingResult] }, { repoRoot: ".", workspace: "." });
    expect(line).toContain("::error ");
    expect(line).toContain("file=CLAUDE.md");
    expect(line).toContain("line=8,endLine=8");
    expect(line).toContain("The Supabase project is torn down");
    expect(line).toContain(".mcp.json exists but should not");
  });

  it("emits a warning, not an error, for an unverifiable assertion", () => {
    const [line] = annotationLines(
      { results: [{ ...failingResult, status: "unverifiable", detail: "none of the target files exist" }] },
      {},
    );
    expect(line?.startsWith("::warning ")).toBe(true);
  });

  it("says nothing about passing assertions — a green run adds nothing to the diff", () => {
    expect(annotationLines({ results: [{ ...failingResult, status: "passing" }] }, {})).toEqual([]);
  });

  it("rewrites the source path relative to the workspace when checking a subdirectory", () => {
    const [line] = annotationLines(
      { results: [failingResult] },
      { repoRoot: "/w/packages/api", workspace: "/w" },
    );
    expect(line).toContain("file=packages/api/CLAUDE.md");
  });
});

describe("summaryMarkdown", () => {
  it("leads with the verdict and does not let a claim break the table", () => {
    const markdown = summaryMarkdown(
      {
        results: [{ ...failingResult, detail: "a | b" }],
        passing: 0,
        failing: 1,
        unverifiable: 0,
      },
      ["CLAUDE.md"],
      { file: ".groundtruth.jsonc" },
    );
    expect(markdown).toContain("**1 of 1 assertion(s) failing**");
    expect(markdown).toContain("a \\| b");
  });

  it("explains an unverifiable assertion rather than leaving it as a bare count", () => {
    const markdown = summaryMarkdown(
      { results: [{ ...failingResult, status: "unverifiable" }], passing: 0, failing: 0, unverifiable: 1 },
      [],
      {},
    );
    expect(markdown).toContain("All 1 assertion(s) hold");
    expect(markdown).toContain("fail-on-unverifiable");
  });
});

describe("exitCodeFor", () => {
  it("fails on a failing assertion", () => {
    expect(exitCodeFor({ failing: 1, unverifiable: 0 })).toBe(1);
  });

  it("passes an unverifiable assertion by default, and fails it on request", () => {
    expect(exitCodeFor({ failing: 0, unverifiable: 2 })).toBe(0);
    expect(exitCodeFor({ failing: 0, unverifiable: 2 }, { failOnUnverifiable: true })).toBe(1);
  });
});

describe("sanitizeVersion", () => {
  it("accepts a version and a dist-tag", () => {
    expect(sanitizeVersion("0.2.0")).toBe("0.2.0");
    expect(sanitizeVersion(" latest ")).toBe("latest");
    expect(sanitizeVersion("1.0.0-rc.1")).toBe("1.0.0-rc.1");
  });

  it("rejects anything that could smuggle an argument or a path into the install", () => {
    for (const bad of ["", "0.2.0 --registry=http://evil", "../../etc", "a;b", "-9"]) {
      expect(() => sanitizeVersion(bad)).toThrow();
    }
  });
});

describe("extractJson", () => {
  it("reads the report out from under npx install chatter", () => {
    expect(extractJson('Need to install...\n{"failing": 0}\n')).toEqual({ failing: 0 });
  });

  it("throws with the raw output when there is no report to read", () => {
    expect(() => extractJson("command not found")).toThrow(/command not found/);
  });
});

describe("the Action end to end", () => {
  beforeAll(() => {
    if (!existsSync(CLI)) {
      throw new Error(`${CLI} does not exist — run "pnpm build" before "pnpm test".`);
    }
  });

  function runAction(env: Record<string, string>): { status: number; stdout: string; temp: string } {
    const temp = mkdtempSync(join(tmpdir(), "groundtruth-action-"));
    const base = {
      ...process.env,
      GITHUB_WORKSPACE: ROOT,
      GITHUB_OUTPUT: join(temp, "output.txt"),
      GITHUB_STEP_SUMMARY: join(temp, "summary.md"),
      RUNNER_TEMP: temp,
      INPUT_CLI_PATH: "dist/cli.js",
      ...env,
    };
    try {
      const stdout = execFileSync("node", [RUNNER], { encoding: "utf8", env: base });
      return { status: 0, stdout, temp };
    } catch (err) {
      const e = err as { stdout?: string; status?: number };
      return { status: e.status ?? 1, stdout: e.stdout ?? "", temp };
    }
  }

  it("fails the job, annotates the drift, and records the counts as outputs", () => {
    const { status, stdout, temp } = runAction({
      INPUT_WORKING_DIRECTORY: "test/fixtures/sample-repo",
    });

    expect(status).toBe(1);
    expect(stdout).toContain("::error file=test/fixtures/sample-repo/CLAUDE.md,line=8");

    const outputs = readFileSync(join(temp, "output.txt"), "utf8");
    expect(outputs).toContain("failing=6");
    expect(outputs).toContain("passing=3");
    expect(outputs).toContain("total=9");

    const summary = readFileSync(join(temp, "summary.md"), "utf8");
    expect(summary).toContain("**6 of 9 assertion(s) failing**");

    const report = JSON.parse(readFileSync(join(temp, "groundtruth-report.json"), "utf8"));
    expect(report.failing).toBe(6);
  });

  it("passes on this repo's own assertions — the Action checking itself", () => {
    const { status, stdout } = runAction({ INPUT_WORKING_DIRECTORY: "." });
    expect(status).toBe(0);
    expect(stdout).toContain("0 failing");
    expect(stdout).not.toContain("::error");
  });

  it("respects annotations: false", () => {
    const { stdout } = runAction({
      INPUT_WORKING_DIRECTORY: "test/fixtures/sample-repo",
      INPUT_ANNOTATIONS: "false",
    });
    expect(stdout).not.toContain("::error file=");
  });

  it("exits 2 — a setup failure, not a drift finding — when the assertions file is missing", () => {
    const { status, stdout } = runAction({ INPUT_FILE: "does-not-exist.jsonc" });
    expect(status).toBe(2);
    expect(stdout).toContain("::error title=groundtruth::");
  });

  it("fails a clean run when fail-on-unverifiable is set and something is unverifiable", () => {
    const clean = runAction({
      INPUT_WORKING_DIRECTORY: ".",
      INPUT_FILE: "test/fixtures/unverifiable.jsonc",
    });
    expect(clean.status).toBe(0);

    const strict = runAction({
      INPUT_WORKING_DIRECTORY: ".",
      INPUT_FILE: "test/fixtures/unverifiable.jsonc",
      INPUT_FAIL_ON_UNVERIFIABLE: "true",
    });
    expect(strict.status).toBe(1);
  });
});
