import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { verifyAssertionSources, parseSource } from "../src/manual/verify-source.js";
import type { Assertion } from "../src/types.js";

const tempDirs: string[] = [];
function tempRepo(context: string): string {
  const dir = mkdtempSync(join(tmpdir(), "groundtruth-source-"));
  tempDirs.push(dir);
  writeFileSync(join(dir, "CLAUDE.md"), context);
  return dir;
}
afterEach(() => {
  while (tempDirs.length) rmSync(tempDirs.pop()!, { recursive: true, force: true });
});

function assertion(claim: string, source: string): Assertion {
  return { claim, kind: "path_exists", args: { path: "." }, source };
}

// A context file whose interesting sentence sits at line 5, so a citation
// that predates an inserted paragraph points somewhere plausible but wrong.
const CONTEXT = [
  "# CLAUDE.md", // 1
  "", // 2
  "Some preamble that has nothing to do with the claim.", // 3
  "", // 4
  "`pnpm verify:push` runs typecheck and unit tests.", // 5
  "", // 6
  "The Supabase project is torn down; do not add an MCP", // 7
  "server config for it.", // 8
].join("\n");

describe("parseSource", () => {
  it("splits a single-line citation", () => {
    expect(parseSource("CLAUDE.md#L5")).toEqual({ file: "CLAUDE.md", start: 5, end: 5 });
  });

  it("splits a range, with or without the second L", () => {
    expect(parseSource("CLAUDE.md#L7-8")).toEqual({ file: "CLAUDE.md", start: 7, end: 8 });
    expect(parseSource("CLAUDE.md#L7-L8")).toEqual({ file: "CLAUDE.md", start: 7, end: 8 });
  });

  it("keeps the file when there is no line fragment", () => {
    expect(parseSource("CLAUDE.md")).toEqual({ file: "CLAUDE.md", start: null, end: null });
  });
});

describe("verifyAssertionSources", () => {
  it("is silent when the citation points at the sentence", () => {
    const repo = tempRepo(CONTEXT);
    const warnings = verifyAssertionSources(repo, [
      assertion("`pnpm verify:push` runs typecheck and unit tests.", "CLAUDE.md#L5"),
    ]);
    expect(warnings).toEqual([]);
  });

  it("flags a citation pointing at an unrelated line, and says where it moved", () => {
    const repo = tempRepo(CONTEXT);
    const warnings = verifyAssertionSources(repo, [
      assertion("`pnpm verify:push` runs typecheck and unit tests.", "CLAUDE.md#L3"),
    ]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.reason).toContain("does not state this claim");
    expect(warnings[0]?.suggestion).toBe("CLAUDE.md#L5");
  });

  it("matches a claim hard-wrapped across the cited range", () => {
    const repo = tempRepo(CONTEXT);
    const warnings = verifyAssertionSources(repo, [
      assertion(
        "The Supabase project is torn down; do not add an MCP server config for it.",
        "CLAUDE.md#L7-8",
      ),
    ]);
    expect(warnings).toEqual([]);
  });

  // Claims are hand-copied and routinely elided; only one side of the
  // ellipsis needs to land in the cited span for the citation to be right.
  it("accepts an elided claim when one fragment matches", () => {
    const repo = tempRepo(CONTEXT);
    const warnings = verifyAssertionSources(repo, [
      assertion("# CLAUDE.md ... do not add an MCP server config for it.", "CLAUDE.md#L7-8"),
    ]);
    expect(warnings).toEqual([]);
  });

  // Punctuation and spacing differ constantly between a claim and the prose
  // it quotes ("—" for "#", collapsed whitespace); neither is drift.
  it("tolerates punctuation and whitespace differences", () => {
    const repo = tempRepo(["# CLAUDE.md", "", "pnpm build      # tsc -> dist/"].join("\n"));
    const warnings = verifyAssertionSources(repo, [
      assertion("pnpm build — tsc -> dist/", "CLAUDE.md#L3"),
    ]);
    expect(warnings).toEqual([]);
  });

  it("flags a citation past the end of the file", () => {
    const repo = tempRepo(CONTEXT);
    const warnings = verifyAssertionSources(repo, [
      assertion("`pnpm verify:push` runs typecheck and unit tests.", "CLAUDE.md#L99"),
    ]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.reason).toContain("has 8 lines");
  });

  it("flags a citation to a file that does not exist", () => {
    const repo = tempRepo(CONTEXT);
    const warnings = verifyAssertionSources(repo, [assertion("anything", "AGENTS.md#L1")]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.reason).toContain("does not exist");
  });

  // Copying the shipped example into a repo that has no context file yet
  // would otherwise open with the same sentence once per assertion.
  it("reports a missing file once, counting the rest", () => {
    const repo = tempRepo(CONTEXT);
    const warnings = verifyAssertionSources(repo, [
      assertion("one", "AGENTS.md#L1"),
      assertion("two", "AGENTS.md#L2"),
      assertion("three", "AGENTS.md#L3"),
    ]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.alsoAffects).toBe(2);
  });

  it("keeps missing files apart from each other", () => {
    const repo = tempRepo(CONTEXT);
    const warnings = verifyAssertionSources(repo, [
      assertion("one", "AGENTS.md#L1"),
      assertion("two", ".cursor/rules#L1"),
    ]);
    expect(warnings).toHaveLength(2);
  });

  // A file-only citation is a weaker pointer, not a wrong one — there is no
  // line to be wrong about, so there is nothing to warn about either.
  it("skips a citation with no line fragment", () => {
    const repo = tempRepo(CONTEXT);
    expect(verifyAssertionSources(repo, [assertion("anything at all", "CLAUDE.md")])).toEqual([]);
  });

  it("reports nothing for an empty assertion list", () => {
    expect(verifyAssertionSources(tempRepo(CONTEXT), [])).toEqual([]);
  });
});
