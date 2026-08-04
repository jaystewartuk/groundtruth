import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
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
    expect(stdout).toContain("7 failing");
    expect(stdout).toContain("SUPABASE_URL found in turbo.json");
    expect(stdout).toContain(".mcp.json exists but should not");
    expect(stdout).toContain(".mcp.json#L");
  });

  it("also reports the still-true claims as passing, not just failures", () => {
    const { stdout } = run(["check", "--repo", SAMPLE_REPO]);
    expect(stdout).toContain("4 passing");
    expect(stdout).toContain("scripts.verify:push");
    expect(stdout).toContain("entitlementsFor is exported from");
    expect(stdout).toContain("pattern found at package.json#L");
  });

  it("supports --json output", () => {
    const { stdout, status } = run(["check", "--repo", SAMPLE_REPO, "--json"]);
    expect(status).toBe(1);
    const parsed = JSON.parse(stdout);
    expect(parsed.failing).toBe(7);
    expect(parsed.passing).toBe(4);
    expect(parsed.unverifiable).toBe(0);
    expect(Array.isArray(parsed.results)).toBe(true);
  });

  it("exits 2 with a helpful message when no assertions file is found", () => {
    const { status } = run(["check", "--repo", ROOT, "--file", "does-not-exist.jsonc"]);
    expect(status).toBe(2);
  });
});

// The planted fact below is synthetic. These tests cover the whole redaction
// path end to end: author a digest with the real CLI, plant the fact, and
// prove the failing check's entire stdout never restates it.
const FACT = "Project Foxglove ships 2031-04-01";

function runWithInput(args: string[], input: string, cwd?: string): { stdout: string; status: number } {
  try {
    const stdout = execFileSync("node", [CLI, ...args], { encoding: "utf8", input, cwd });
    return { stdout, status: 0 };
  } catch (err) {
    const e = err as { stdout?: string; status?: number };
    return { stdout: e.stdout ?? "", status: e.status ?? 1 };
  }
}

describe("groundtruth digest (e2e)", () => {
  it("prints a ready-to-paste patternDigest that then matches the planted fact", () => {
    const { stdout, status } = runWithInput(["digest", "--stdin"], `${FACT}\n`);
    expect(status).toBe(0);
    expect(stdout).not.toContain("Foxglove");

    const { patternDigest } = JSON.parse(stdout);
    expect(patternDigest.algo).toBe("sha256");
    expect(patternDigest.normalize).toBe("lower");
    expect(patternDigest.length).toBe(FACT.length);

    const dir = mkdtempSync(join(tmpdir(), "groundtruth-digest-"));
    writeFileSync(join(dir, "notes.md"), `reminder: ${FACT.toUpperCase()}\n`);
    writeFileSync(
      join(dir, ".groundtruth.jsonc"),
      JSON.stringify({
        assertions: [
          {
            claim: "The retired codename does not appear anywhere.",
            kind: "text_absent",
            args: { patternDigest, label: "retired-codename", files: ["notes.md"] },
            source: "decision-log#L1",
          },
        ],
      }),
    );

    const check = run(["check", "--repo", dir, "--json"]);
    expect(check.status).toBe(1);
    const parsed = JSON.parse(check.stdout);
    expect(parsed.failing).toBe(1);
    // Redaction discipline: nothing in the output — table or JSON — may
    // restate the fact, in any casing.
    expect(check.stdout.toLowerCase()).not.toContain("foxglove");
    expect(check.stdout).not.toContain("2031");
    expect(check.stdout).toContain("retired-codename");
    expect(check.stdout).toContain("notes.md#L1");
  });

  it("exits 2 on empty input", () => {
    expect(runWithInput(["digest", "--stdin"], "").status).toBe(2);
  });
});

describe("groundtruth evict (e2e)", () => {
  function evictionRepo(): string {
    const dir = mkdtempSync(join(tmpdir(), "groundtruth-evict-"));
    writeFileSync(join(dir, "notes.md"), `plan: ${FACT}, keep quiet\n`);
    writeFileSync(join(dir, "README.md"), "nothing here\n");
    execFileSync("git", ["init", "-q"], { cwd: dir });
    execFileSync("git", ["add", "."], { cwd: dir });
    return dir;
  }

  it("sweeps the working tree, prints hits with lines, and always discloses unswept surfaces", () => {
    const dir = evictionRepo();
    const { stdout, status } = runWithInput(["evict", "--repo", dir], `${FACT}\n`);
    expect(status).toBe(1);
    expect(stdout).toContain("notes.md#L1");
    expect(stdout).toContain(FACT); // without --redact the matching line is shown
    expect(stdout).toContain("NOT swept — check these yourself:");
    expect(stdout).toContain("git history");
  });

  it("hides the matching lines under --redact", () => {
    const dir = evictionRepo();
    const { stdout, status } = runWithInput(["evict", "--repo", dir, "--redact"], `${FACT}\n`);
    expect(status).toBe(1);
    expect(stdout).toContain("notes.md#L1");
    expect(stdout).not.toContain("Foxglove");
  });

  it("--write --redact appends an enforcing digest assertion, and check stays leak-free", () => {
    const dir = evictionRepo();
    const evict = runWithInput(
      ["evict", "--repo", dir, "--redact", "--write", "--label", "retired-codename"],
      `${FACT}\n`,
    );
    expect(evict.status).toBe(1);

    const written = readFileSync(join(dir, ".groundtruth.jsonc"), "utf8");
    expect(written).toContain("patternDigest");
    expect(written).not.toContain("Foxglove");

    // The fact is still planted: enforcement must catch it, redacted.
    const failing = run(["check", "--repo", dir, "--json"]);
    expect(failing.status).toBe(1);
    expect(failing.stdout.toLowerCase()).not.toContain("foxglove");
    expect(failing.stdout).toContain("retired-codename");

    // Remove the fact: the same assertion goes green.
    writeFileSync(join(dir, "notes.md"), "plan: redacted\n");
    expect(run(["check", "--repo", dir, "--json"]).status).toBe(0);
  });

  it("--write without --redact appends a plaintext, case-insensitive assertion", () => {
    const dir = evictionRepo();
    runWithInput(["evict", "--repo", dir, "--write"], `${FACT}\n`);
    const written = readFileSync(join(dir, ".groundtruth.jsonc"), "utf8");
    expect(written).toContain(FACT);
    expect(written).toContain('"caseInsensitive": true');
  });

  it("refuses --write --redact without a --label", () => {
    const dir = evictionRepo();
    expect(
      runWithInput(["evict", "--repo", dir, "--redact", "--write"], `${FACT}\n`).status,
    ).toBe(2);
  });
});
