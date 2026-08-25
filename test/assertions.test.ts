import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { checkPathExists } from "../src/assertions/path-exists.js";
import { checkPathAbsent } from "../src/assertions/path-absent.js";
import { checkEnvVarAbsent } from "../src/assertions/env-var-absent.js";
import { checkScriptExists } from "../src/assertions/script-exists.js";
import { checkWorkflowTrigger } from "../src/assertions/workflow-trigger.js";
import { checkSymbolAtPath } from "../src/assertions/symbol-at-path.js";
import { checkTextMatchesAcross } from "../src/assertions/text-matches-across.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const SAMPLE_REPO = resolve(HERE, "fixtures", "sample-repo");

const tempDirs: string[] = [];
function tempRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "groundtruth-test-"));
  tempDirs.push(dir);
  return dir;
}
afterEach(() => {
  while (tempDirs.length) rmSync(tempDirs.pop()!, { recursive: true, force: true });
});

describe("path_exists", () => {
  it("passes when the path exists", () => {
    expect(checkPathExists(SAMPLE_REPO, { path: "CLAUDE.md" }).status).toBe("passing");
  });
  it("fails when the path is missing", () => {
    expect(checkPathExists(SAMPLE_REPO, { path: "nope.md" }).status).toBe("failing");
  });
});

describe("path_absent", () => {
  it("fails when the path exists but should not", () => {
    expect(checkPathAbsent(SAMPLE_REPO, { path: ".mcp.json" }).status).toBe("failing");
  });
  it("passes when the path is missing", () => {
    expect(checkPathAbsent(SAMPLE_REPO, { path: "nope.md" }).status).toBe("passing");
  });
});

describe("env_var_absent", () => {
  it("fails when the var is present in turbo.json's globalEnv", () => {
    const result = checkEnvVarAbsent(SAMPLE_REPO, { name: "SUPABASE_URL" });
    expect(result.status).toBe("failing");
    expect(result.detail).toContain("turbo.json");
  });
  it("passes when the var is absent from every scanned file", () => {
    const result = checkEnvVarAbsent(SAMPLE_REPO, { name: "SOME_VAR_THAT_DOES_NOT_EXIST" });
    expect(result.status).toBe("passing");
  });
  it("is unverifiable when none of the target files exist", () => {
    const dir = tempRepo();
    const result = checkEnvVarAbsent(dir, { name: "ANY_VAR" });
    expect(result.status).toBe("unverifiable");
  });
  it("checks a custom files list, including plain .env-shaped files", () => {
    const dir = tempRepo();
    writeFileSync(join(dir, ".env"), "OTHER=1\nLEAKED_KEY=abc\n");
    const result = checkEnvVarAbsent(dir, { name: "LEAKED_KEY", files: [".env"] });
    expect(result.status).toBe("failing");
  });
});

describe("script_exists", () => {
  it("passes when the script is declared", () => {
    expect(checkScriptExists(SAMPLE_REPO, { name: "verify:push" }).status).toBe("passing");
  });
  it("fails when the script is not declared", () => {
    expect(checkScriptExists(SAMPLE_REPO, { name: "does-not-exist" }).status).toBe("failing");
  });
  it("is unverifiable when package.json is missing", () => {
    const dir = tempRepo();
    expect(checkScriptExists(dir, { name: "anything" }).status).toBe("unverifiable");
  });
});

describe("workflow_trigger", () => {
  it("passes when the workflow triggers on the branch", () => {
    const result = checkWorkflowTrigger(SAMPLE_REPO, {
      workflow: "checks.yml",
      trigger: "pull_request",
      target: "main",
    });
    expect(result.status).toBe("passing");
  });
  it("fails when the target branch is not in the trigger's branches list", () => {
    const result = checkWorkflowTrigger(SAMPLE_REPO, {
      workflow: "checks.yml",
      trigger: "pull_request",
      target: "develop",
    });
    expect(result.status).toBe("failing");
  });
  it("fails when the trigger is not present at all", () => {
    const result = checkWorkflowTrigger(SAMPLE_REPO, { workflow: "checks.yml", trigger: "schedule" });
    expect(result.status).toBe("failing");
  });
  it("fails when the workflow file does not exist", () => {
    const result = checkWorkflowTrigger(SAMPLE_REPO, { workflow: "nope.yml", trigger: "push" });
    expect(result.status).toBe("failing");
  });
});

describe("symbol_at_path", () => {
  it("passes when the exported symbol is found", () => {
    const result = checkSymbolAtPath(SAMPLE_REPO, {
      symbol: "entitlementsFor",
      path: "apps/web/src/lib/subscriptions/entitlements.ts",
    });
    expect(result.status).toBe("passing");
  });
  it("fails when the symbol is not exported from that file", () => {
    const result = checkSymbolAtPath(SAMPLE_REPO, {
      symbol: "notReal",
      path: "apps/web/src/lib/subscriptions/entitlements.ts",
    });
    expect(result.status).toBe("failing");
  });
  it("fails when the file does not exist", () => {
    const result = checkSymbolAtPath(SAMPLE_REPO, { symbol: "anything", path: "nope.ts" });
    expect(result.status).toBe("failing");
  });
});

describe("text_matches_across", () => {
  const SENTENCE =
    "UK-based and available now. Currently on a temporary working trip abroad, " +
    "with a daily overlap from about 13:00 UK and flexibility outside it.";

  it("passes when every file carries the text", () => {
    const result = checkTextMatchesAcross(SAMPLE_REPO, {
      text: SENTENCE,
      files: ["surfaces/cv.md", "surfaces/profile.md"],
      normalize: ["markdown", "whitespace"],
    });
    expect(result.status).toBe("passing");
  });

  // The regression this kind was written for: the text is present but
  // hard-wrapped, so a line-oriented search reports a false clean.
  it("matches across a line break that splits the text", () => {
    const dir = tempRepo();
    writeFileSync(join(dir, "wrapped.md"), "a daily overlap from about\n13:00 UK and flexibility\n");
    expect(
      checkTextMatchesAcross(dir, {
        text: "a daily overlap from about 13:00 UK and flexibility",
        files: ["wrapped.md"],
      }).status,
    ).toBe("passing");
  });

  it("does not match a line break when normalization is turned off", () => {
    const dir = tempRepo();
    writeFileSync(join(dir, "wrapped.md"), "a daily overlap from about\n13:00 UK\n");
    expect(
      checkTextMatchesAcross(dir, {
        text: "a daily overlap from about 13:00 UK",
        files: ["wrapped.md"],
        normalize: [],
      }).status,
    ).toBe("failing");
  });

  // The second regression: a paraphrase that still contains the substring
  // everyone greps for. "UK-based and available now" is in both.
  it("fails a surface that paraphrases the rest of the sentence", () => {
    const result = checkTextMatchesAcross(SAMPLE_REPO, {
      text: SENTENCE,
      files: ["surfaces/cv.md", "surfaces/stale.md"],
      normalize: ["markdown", "whitespace"],
    });
    expect(result.status).toBe("failing");
    expect(result.detail).toContain("surfaces/stale.md");
    expect(result.detail).not.toContain("surfaces/cv.md");
  });

  it("strips blockquote markers and emphasis when asked", () => {
    const result = checkTextMatchesAcross(SAMPLE_REPO, {
      text: SENTENCE,
      files: ["surfaces/profile.md"],
      normalize: ["markdown", "whitespace"],
    });
    expect(result.status).toBe("passing");
  });

  it("fails on a blockquoted file when markdown normalization is not requested", () => {
    const result = checkTextMatchesAcross(SAMPLE_REPO, {
      text: SENTENCE,
      files: ["surfaces/profile.md"],
    });
    expect(result.status).toBe("failing");
  });

  // Deliberately failing, not unverifiable — deleting a surface must never
  // be the way to go green. See the checker's comment and ADR-0006.
  it("fails when a named file is missing", () => {
    const result = checkTextMatchesAcross(SAMPLE_REPO, {
      text: SENTENCE,
      files: ["surfaces/cv.md", "surfaces/gone.md"],
      normalize: ["markdown", "whitespace"],
    });
    expect(result.status).toBe("failing");
    expect(result.detail).toContain("missing: surfaces/gone.md");
  });

  it("reports missing and mismatching files separately", () => {
    const result = checkTextMatchesAcross(SAMPLE_REPO, {
      text: SENTENCE,
      files: ["surfaces/gone.md", "surfaces/stale.md"],
      normalize: ["markdown", "whitespace"],
    });
    expect(result.detail).toContain("missing: surfaces/gone.md");
    expect(result.detail).toContain("does not contain the text: surfaces/stale.md");
  });

  it("is unverifiable when the text normalizes to nothing", () => {
    const result = checkTextMatchesAcross(SAMPLE_REPO, {
      text: "   ",
      files: ["surfaces/cv.md"],
    });
    expect(result.status).toBe("unverifiable");
  });
});
