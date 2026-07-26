import { existsSync } from "node:fs";
import { join } from "node:path";
import type { AssertionStatus, PathArgs } from "../types.js";

export function checkPathExists(
  repoRoot: string,
  args: PathArgs,
): { status: AssertionStatus; detail: string } {
  const exists = existsSync(join(repoRoot, args.path));
  return exists
    ? { status: "passing", detail: `${args.path} exists` }
    : { status: "failing", detail: `${args.path} does not exist` };
}
