import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// End-to-end: runs the actual built CLI (dist/cli.js) against
// test/fixtures/sample-repo's .groundtruth.jsonc, which encodes real drift
// found in the AgendaProfe audit (stale Supabase/Vercel env vars in
// turbo.json, a leftover .mcp.json) alongside claims that are still true.
// Requires `pnpm build` to have run first — that's what `pretest` is for.

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const CLI = resolve(ROOT, "dist", "cli.js");
const SAMPLE_REPO = resolve(HERE, "fixtures", "sample-repo");

function run(args: string[]): { stdout: string; status: number } {
  try {
    const stdout = execFileSync("node", [CLI, ...args], { encoding: "utf8" });
    return { stdout, status: 0 };
  } catch (err) {
    const e = err as { stdout?: string; status?: number };
    return { stdout: e.stdout ?? "", status: e.status ?? 1 };
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
