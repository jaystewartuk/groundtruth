import { existsSync, readFileSync } from "node:fs";
import { join, extname } from "node:path";
import type { AssertionStatus, EnvVarAbsentArgs } from "../types.js";

// No config/env layout is guessable across arbitrary repos, so the default
// scan set only covers the two spots almost every JS monorepo actually puts
// a global/build-time env var declaration: turbo.json's globalEnv and any
// top-level .env.example. Callers with a repo-specific layout (a per-environment
// config/env/ directory, say) should pass `files` explicitly.
const DEFAULT_FILES = ["turbo.json", ".env.example"];

/** True if `name` appears as a JSON string value or object key anywhere in
 * the parsed document — covers both an array-of-strings env allowlist
 * (turbo.json's globalEnv) and a key/value env-shaped JSON file. */
function jsonContainsName(value: unknown, name: string): boolean {
  if (typeof value === "string") return value === name;
  if (Array.isArray(value)) return value.some((v) => jsonContainsName(v, name));
  if (value && typeof value === "object") {
    return Object.entries(value).some(
      ([key, v]) => key === name || jsonContainsName(v, name),
    );
  }
  return false;
}

function fileReferencesName(absPath: string, name: string): boolean {
  const text = readFileSync(absPath, "utf8");
  if (extname(absPath) === ".json") {
    try {
      return jsonContainsName(JSON.parse(text), name);
    } catch {
      // Malformed JSON — fall through to a plain text search rather than
      // silently reporting "absent" on a file we couldn't actually parse.
    }
  }
  // Word-boundary search so e.g. SUPABASE_URL doesn't also match
  // SUPABASE_URL_LEGACY-style false positives being missed, and so a
  // substring of a longer identifier doesn't false-positive either.
  const pattern = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
  return pattern.test(text);
}

export function checkEnvVarAbsent(
  repoRoot: string,
  args: EnvVarAbsentArgs,
): { status: AssertionStatus; detail: string } {
  const candidates = args.files ?? DEFAULT_FILES;
  const existing = candidates.filter((f) => existsSync(join(repoRoot, f)));

  if (existing.length === 0) {
    return {
      status: "unverifiable",
      detail: `none of the target files exist (checked: ${candidates.join(", ")})`,
    };
  }

  const hits = existing.filter((f) => fileReferencesName(join(repoRoot, f), args.name));
  return hits.length === 0
    ? { status: "passing", detail: `${args.name} not found in ${existing.join(", ")}` }
    : { status: "failing", detail: `${args.name} found in ${hits.join(", ")}` };
}
