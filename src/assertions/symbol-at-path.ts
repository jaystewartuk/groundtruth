import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { AssertionStatus, SymbolAtPathArgs } from "../types.js";

// Regex-based, not a full TS/JS AST — good enough for the common
// `export function X`, `export const X`, `export class X`, `export interface
// X`, `export type X` shapes an MVP needs to cover. A symbol exported via a
// re-export (`export { X } from "./y"`) or a default export will not be
// found; that's a known, acceptable gap for the MVP kind, not a silent one
// (it fails rather than false-passes).
function exportsSymbol(source: string, symbol: string): boolean {
  const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `export\\s+(default\\s+)?(async\\s+)?(function|const|class|interface|type|enum)\\s+${escaped}\\b`,
  );
  return pattern.test(source);
}

export function checkSymbolAtPath(
  repoRoot: string,
  args: SymbolAtPathArgs,
): { status: AssertionStatus; detail: string } {
  const absPath = join(repoRoot, args.path);
  if (!existsSync(absPath)) {
    return { status: "failing", detail: `${args.path} does not exist` };
  }

  const source = readFileSync(absPath, "utf8");
  return exportsSymbol(source, args.symbol)
    ? { status: "passing", detail: `${args.symbol} is exported from ${args.path}` }
    : { status: "failing", detail: `${args.symbol} is not exported from ${args.path}` };
}
