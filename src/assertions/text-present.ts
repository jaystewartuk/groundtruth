import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AssertionStatus, TextPresentArgs } from "../types.js";
import { compilePattern } from "./text-match.js";

/**
 * "File X must mention Y" — deliberately scoped to one named file. The use
 * case is a claim of the shape "X is configured in file Y" (e.g. "atuin is
 * installed by bootstrap.sh"); a vague "mentioned somewhere" present-check
 * invites junk assertions. See ADR-0006.
 */
export function checkTextPresent(
  repoRoot: string,
  args: TextPresentArgs,
): { status: AssertionStatus; detail: string } {
  const matcher = compilePattern(args);
  if (!matcher.ok) return { status: "unverifiable", detail: matcher.detail };

  let content: string;
  try {
    content = readFileSync(join(repoRoot, args.path), "utf8");
  } catch {
    // The claim implies the file exists — a missing file is the claim being
    // false, not the check being impossible.
    return { status: "failing", detail: `${args.path} does not exist, so it cannot mention the pattern` };
  }

  const hits = matcher.findIn(args.path, content);
  return hits.length > 0
    ? { status: "passing", detail: `pattern found at ${args.path}#L${hits[0]!.line}` }
    : { status: "failing", detail: `pattern not found in ${args.path}` };
}
