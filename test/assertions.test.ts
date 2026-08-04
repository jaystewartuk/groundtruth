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
import { checkTextPresent } from "../src/assertions/text-present.js";
import { checkTextAbsent } from "../src/assertions/text-absent.js";
import { buildPatternDigest, globToRegExp } from "../src/assertions/text-match.js";

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

describe("text_present", () => {
  it("passes when the literal appears in the named file", () => {
    const result = checkTextPresent(SAMPLE_REPO, { pattern: "verify:push", path: "package.json" });
    expect(result.status).toBe("passing");
    expect(result.detail).toContain("package.json#L");
  });
  it("fails when the literal does not appear", () => {
    expect(
      checkTextPresent(SAMPLE_REPO, { pattern: "not-in-there", path: "package.json" }).status,
    ).toBe("failing");
  });
  it("fails, not unverifiable, when the file is missing — the claim implies the file", () => {
    const result = checkTextPresent(SAMPLE_REPO, { pattern: "anything", path: "nope.sh" });
    expect(result.status).toBe("failing");
    expect(result.detail).toContain("does not exist");
  });
  it("treats a literal as truly literal — regex metacharacters do not fire", () => {
    const dir = tempRepo();
    writeFileSync(join(dir, "notes.md"), "priced at $9.99 today\n");
    expect(checkTextPresent(dir, { pattern: "$9.99", path: "notes.md" }).status).toBe("passing");
    expect(checkTextPresent(dir, { pattern: "$9,99", path: "notes.md" }).status).toBe("failing");
  });
  it("supports regex patterns and case-insensitive matching", () => {
    const dir = tempRepo();
    writeFileSync(join(dir, "notes.md"), "Deadline: 2031-04-01\n");
    expect(
      checkTextPresent(dir, { pattern: "\\d{4}-\\d{2}-\\d{2}", patternType: "regex", path: "notes.md" })
        .status,
    ).toBe("passing");
    expect(
      checkTextPresent(dir, { pattern: "deadline", caseInsensitive: true, path: "notes.md" }).status,
    ).toBe("passing");
  });
  it("is unverifiable, never a crash, on a regex that does not compile", () => {
    const result = checkTextPresent(SAMPLE_REPO, {
      pattern: "(unclosed",
      patternType: "regex",
      path: "package.json",
    });
    expect(result.status).toBe("unverifiable");
    expect(result.detail).toContain("does not compile");
  });
});

describe("text_absent", () => {
  it("fails with file#L hits when the pattern appears in the git-tracked scope", () => {
    const result = checkTextAbsent(SAMPLE_REPO, { pattern: "SUPABASE_URL" });
    expect(result.status).toBe("failing");
    expect(result.detail).toContain("turbo.json#L");
  });
  it("excludes the assertions file itself, so an assertion never self-triggers on its own pattern field", () => {
    // sample-repo's .groundtruth.jsonc contains the string SUPABASE_URL in an
    // env_var_absent assertion's args.
    const result = checkTextAbsent(SAMPLE_REPO, { pattern: "SUPABASE_URL" });
    expect(result.detail).not.toContain(".groundtruth.jsonc");
  });
  it("passes and names the scope size when there are no hits", () => {
    const result = checkTextAbsent(SAMPLE_REPO, { pattern: "string-that-appears-nowhere-at-all" });
    expect(result.status).toBe("passing");
    expect(result.detail).toMatch(/0 hits for pattern across \d+ tracked file\(s\)/);
  });
  it("applies include and exclude globs to the tracked-file scope", () => {
    const scoped = checkTextAbsent(SAMPLE_REPO, {
      pattern: "supabase",
      caseInsensitive: true,
      include: ["*.json"],
    });
    expect(scoped.status).toBe("failing");
    expect(scoped.detail).toContain(".mcp.json#L");
    expect(scoped.detail).not.toContain("CLAUDE.md");

    const excluded = checkTextAbsent(SAMPLE_REPO, {
      pattern: "SUPABASE_URL",
      exclude: ["*.json", ".github/**"],
    });
    expect(excluded.status).toBe("passing");
  });
  it("scans exactly the listed files when `files` is given, and counts a missing file as absent", () => {
    const dir = tempRepo();
    writeFileSync(join(dir, "notes.md"), "the codename is Foxglove\n");
    const result = checkTextAbsent(dir, { pattern: "Foxglove", files: ["notes.md", "missing.md"] });
    expect(result.status).toBe("failing");
    expect(result.detail).toContain("notes.md#L1");
  });
  it("is unverifiable when none of the listed files exist", () => {
    expect(checkTextAbsent(tempRepo(), { pattern: "x", files: ["missing.md"] }).status).toBe(
      "unverifiable",
    );
  });
  it("is unverifiable outside a git work tree, and says how to scan anyway", () => {
    const result = checkTextAbsent(tempRepo(), { pattern: "anything" });
    expect(result.status).toBe("unverifiable");
    expect(result.detail).toContain("files");
  });
  it("skips binary files, and reports the skip rather than staying silent", () => {
    const dir = tempRepo();
    writeFileSync(join(dir, "blob.bin"), Buffer.from([0x46, 0x6f, 0x78, 0x00, 0x46, 0x6f, 0x78]));
    const result = checkTextAbsent(dir, { pattern: "Fox", files: ["blob.bin"] });
    expect(result.status).toBe("passing");
    expect(result.detail).toContain("blob.bin (binary)");
  });
  it("caps the hit listing at 20 but keeps the count accurate", () => {
    const dir = tempRepo();
    writeFileSync(join(dir, "many.md"), Array(25).fill("hit here").join("\n"));
    const result = checkTextAbsent(dir, { pattern: "hit here", files: ["many.md"] });
    expect(result.status).toBe("failing");
    expect(result.detail).toContain("…and 5 more");
  });
});

describe("text_absent with a redacted patternDigest", () => {
  const FACT = "Project Foxglove ships 2031-04-01";

  function digestArgs(normalize: "lower" | "exact" = "lower") {
    return {
      patternDigest: buildPatternDigest(FACT, "0123456789abcdef", normalize),
      label: "retired-codename",
    };
  }

  it("finds the planted fact and reports location and label — never the fact itself", () => {
    const dir = tempRepo();
    writeFileSync(join(dir, "notes.md"), `unrelated line\nthe plan: ${FACT}, still secret\n`);
    const result = checkTextAbsent(dir, { ...digestArgs(), files: ["notes.md"] });
    expect(result.status).toBe("failing");
    expect(result.detail).toContain('notes.md#L2');
    expect(result.detail).toContain('"retired-codename"');
    // The single most important assertion in the feature: a failing report
    // must not restate what was evicted.
    expect(result.detail).not.toContain("Foxglove");
    expect(result.detail).not.toContain("2031");
  });

  it("matches case-insensitively under normalize: lower", () => {
    const dir = tempRepo();
    writeFileSync(join(dir, "notes.md"), `PROJECT FOXGLOVE SHIPS 2031-04-01\n`);
    expect(checkTextAbsent(dir, { ...digestArgs("lower"), files: ["notes.md"] }).status).toBe(
      "failing",
    );
    expect(checkTextAbsent(dir, { ...digestArgs("exact"), files: ["notes.md"] }).status).toBe(
      "passing",
    );
  });

  it("passes, naming the label, when the fact is gone", () => {
    const dir = tempRepo();
    writeFileSync(join(dir, "notes.md"), "nothing to see\n");
    const result = checkTextAbsent(dir, { ...digestArgs(), files: ["notes.md"] });
    expect(result.status).toBe("passing");
    expect(result.detail).toContain('"retired-codename"');
  });

  it("does not match a same-length different string, even one sharing a prefix", () => {
    const dir = tempRepo();
    writeFileSync(join(dir, "notes.md"), "Project Foxglove ships 2031-04-02\n");
    expect(checkTextAbsent(dir, { ...digestArgs("exact"), files: ["notes.md"] }).status).toBe(
      "passing",
    );
  });
});

describe("globToRegExp", () => {
  it("keeps * within a path segment and lets ** cross segments", () => {
    expect(globToRegExp("*.json").test("turbo.json")).toBe(true);
    expect(globToRegExp("*.json").test("config/turbo.json")).toBe(false);
    expect(globToRegExp("**/*.json").test("a/b/turbo.json")).toBe(true);
    expect(globToRegExp("**/*.json").test("turbo.json")).toBe(true);
    expect(globToRegExp("docs/**").test("docs/adr/0001.md")).toBe(true);
    expect(globToRegExp("do?s").test("docs")).toBe(true);
    expect(globToRegExp("do?s").test("do/s")).toBe(false);
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
