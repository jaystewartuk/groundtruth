import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { AssertionStatus, ScriptExistsArgs } from "../types.js";

export function checkScriptExists(
  repoRoot: string,
  args: ScriptExistsArgs,
): { status: AssertionStatus; detail: string } {
  const pkgPath = join(repoRoot, args.packageJson ?? "package.json");
  if (!existsSync(pkgPath)) {
    return { status: "unverifiable", detail: `${args.packageJson ?? "package.json"} does not exist` };
  }

  let pkg: unknown;
  try {
    pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  } catch (err) {
    return {
      status: "unverifiable",
      detail: `${args.packageJson ?? "package.json"} is not valid JSON: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }

  const scripts =
    pkg && typeof pkg === "object" && "scripts" in pkg && typeof pkg.scripts === "object" && pkg.scripts
      ? (pkg.scripts as Record<string, unknown>)
      : {};

  return typeof scripts[args.name] === "string"
    ? { status: "passing", detail: `scripts.${args.name} = "${scripts[args.name]}"` }
    : { status: "failing", detail: `no scripts.${args.name} entry` };
}
