import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AssertionStatus, CheckContext, TextAbsentArgs } from "../types.js";
import { compileDigest, compilePattern, formatHits, resolveScope } from "./text-match.js";

/**
 * "No file may mention X" — the enforcement half of fact eviction. Scope
 * defaults to every git-tracked text file (absence is only meaningful
 * repo-wide); a redacted `patternDigest` matches the fact without this
 * assertion restating it. Scope rules: ADR-0006. Digests: ADR-0007.
 */
export function checkTextAbsent(
  repoRoot: string,
  args: TextAbsentArgs,
  context?: CheckContext,
): { status: AssertionStatus; detail: string } {
  const matcher = args.patternDigest
    ? compileDigest(args.patternDigest)
    : compilePattern({ pattern: args.pattern ?? "", patternType: args.patternType, caseInsensitive: args.caseInsensitive });
  if (!matcher.ok) return { status: "unverifiable", detail: matcher.detail };

  const scope = resolveScope(repoRoot, {
    files: args.files,
    include: args.include,
    exclude: args.exclude,
    assertionsFile: context?.assertionsFile,
  });
  if (!scope.ok) return { status: "unverifiable", detail: scope.detail };

  const label = args.patternDigest ? `"${args.label ?? "redacted pattern"}"` : "pattern";
  const hits = scope.files.flatMap((file) => {
    const content = readFileSync(join(repoRoot, file), "utf8");
    return matcher.findIn(file, content);
  });

  const skippedNote =
    scope.skipped.length > 0 ? ` (skipped: ${scope.skipped.join(", ")})` : "";

  // Digest hits deliberately carry no matched text, so this detail cannot
  // leak the fact — the single property feature 2 exists for (ADR-0007).
  return hits.length === 0
    ? {
        status: "passing",
        detail: `0 hits for ${label} across ${scope.description}${skippedNote}`,
      }
    : {
        status: "failing",
        detail: `${label} found at ${formatHits(hits)}${skippedNote}`,
      };
}
