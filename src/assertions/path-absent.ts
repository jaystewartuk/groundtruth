import { existsSync } from "node:fs";
import { join } from "node:path";
import type { AssertionStatus, PathArgs } from "../types.js";

export function checkPathAbsent(
  repoRoot: string,
  args: PathArgs,
): { status: AssertionStatus; detail: string } {
  const exists = existsSync(join(repoRoot, args.path));
  return exists
    ? { status: "failing", detail: `${args.path} exists but should not` }
    : { status: "passing", detail: `${args.path} does not exist` };
}
