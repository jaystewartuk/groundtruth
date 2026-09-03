import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// End-to-end: runs the actual built CLI (dist/cli.js) against
// test/fixtures/sample-repo's .groundtruth.jsonc, which encodes real drift
// found in the SpiralClass audit (stale Supabase/Vercel env vars in
// turbo.json, a leftover .mcp.json) alongside claims that are still true.
// Requires `pnpm build` to have run first — that's what `pretest` is for.

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const CLI = resolve(ROOT, "dist", "cli.js");
const SAMPLE_REPO = resolve(HERE, "fixtures", "sample-repo");
const DRIFTED_SOURCE_REPO = resolve(HERE, "fixtures", "drifted-source");

function run(args: string[]): { stdout: string; stderr: string; status: number } {
  try {
    const stdout = execFileSync("node", [CLI, ...args], { encoding: "utf8", stdio: "pipe" });
    return { stdout, stderr: "", status: 0 };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; status?: number };
    return { stdout: e.stdout ?? "", stderr: e.stderr ?? "", status: e.status ?? 1 };
  }
}

beforeAll(() => {
  if (!existsSync(CLI)) {
    throw new Error(`${CLI} does not exist — run "pnpm build" before "pnpm test".`);
  }
});

describe("groundtruth check (e2e)", () => {
  it("exits non-zero and reports the real drift as failing", () => {
    const { stdout, status } = run(["check", "--repo", SAMPLE_REPO]);
    expect(status).toBe(1);
    expect(stdout).toContain("6 failing");
    expect(stdout).toContain("SUPABASE_URL found in turbo.json");
    expect(stdout).toContain(".mcp.json exists but should not");
  });

  it("also reports the still-true claims as passing, not just failures", () => {
    const { stdout } = run(["check", "--repo", SAMPLE_REPO]);
    expect(stdout).toContain("3 passing");
    expect(stdout).toContain("scripts.verify:push");
    expect(stdout).toContain("entitlementsFor is exported from");
  });

  it("supports --json output", () => {
    const { stdout, status } = run(["check", "--repo", SAMPLE_REPO, "--json"]);
    expect(status).toBe(1);
    const parsed = JSON.parse(stdout);
    expect(parsed.failing).toBe(6);
    expect(parsed.passing).toBe(3);
    expect(parsed.unverifiable).toBe(0);
    expect(Array.isArray(parsed.results)).toBe(true);
  });

  it("exits 2 with a helpful message when no assertions file is found", () => {
    const { status } = run(["check", "--repo", ROOT, "--file", "does-not-exist.jsonc"]);
    expect(status).toBe(2);
  });
});

// A checker that never silently skips what it cannot verify must not
// silently skip an argument it does not understand either: a mistyped flag
// used to be dropped, and the run exited 0 having checked something other
// than what was asked for.
describe("argument handling is fail-closed", () => {
  it("rejects an unknown flag instead of ignoring it", () => {
    const { status, stderr } = run(["check", "--jsonn"]);
    expect(status).toBe(2);
    expect(stderr).toContain("Unknown option");
  });

  it("rejects a flag whose value is missing", () => {
    const { status, stderr } = run(["check", "--repo"]);
    expect(status).toBe(2);
    expect(stderr).toContain("requires a value");
  });

  it("rejects a flag whose value was swallowed by the next flag", () => {
    const { status } = run(["check", "--file", "--json"]);
    expect(status).toBe(2);
  });

  it("prints the package version for --version", () => {
    const { stdout, status } = run(["--version"]);
    expect(status).toBe(0);
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });
});

describe("source pointers", () => {
  it("warns about a drifted citation without failing the run", () => {
    const { stdout, status } = run(["check", "--repo", DRIFTED_SOURCE_REPO]);
    expect(status).toBe(0);
    expect(stdout).toContain("source pointer(s) may have drifted");
  });

  it("fails the run under --strict-sources", () => {
    const { status } = run(["check", "--repo", DRIFTED_SOURCE_REPO, "--strict-sources"]);
    expect(status).toBe(1);
  });

  it("reports the warnings in --json output", () => {
    const { stdout } = run(["check", "--repo", DRIFTED_SOURCE_REPO, "--json"]);
    expect(JSON.parse(stdout).sourceWarnings).toHaveLength(1);
  });

  it("says nothing about sources when every citation is accurate", () => {
    const { stdout } = run(["check", "--repo", SAMPLE_REPO]);
    expect(stdout).not.toContain("source pointer");
  });
});
