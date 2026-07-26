import type { CheckResult, CheckSummary } from "./types.js";

export function summarize(results: CheckResult[]): CheckSummary {
  return {
    results,
    passing: results.filter((r) => r.status === "passing").length,
    failing: results.filter((r) => r.status === "failing").length,
    unverifiable: results.filter((r) => r.status === "unverifiable").length,
  };
}

const MARK: Record<CheckResult["status"], string> = {
  passing: "✓", // ✓
  failing: "✗", // ✗
  unverifiable: "?",
};

/** Human-readable table, worst-first: failing, then unverifiable, then
 * passing — the operator's eye should land on what needs action. */
export function formatTable(summary: CheckSummary, contextFiles: string[]): string {
  const order: CheckResult["status"][] = ["failing", "unverifiable", "passing"];
  const lines: string[] = [];

  lines.push(
    contextFiles.length > 0
      ? `Context layer: ${contextFiles.join(", ")}`
      : "Context layer: none found (CLAUDE.md / AGENTS.md)",
  );
  lines.push(
    `${summary.results.length} assertion(s) — ${summary.passing} passing, ${summary.failing} failing, ${summary.unverifiable} unverifiable`,
  );
  lines.push("");

  for (const status of order) {
    const inStatus = summary.results.filter((r) => r.status === status);
    for (const r of inStatus) {
      lines.push(`${MARK[r.status]} ${r.assertion.source}  ${JSON.stringify(r.assertion.claim)}`);
      lines.push(`  ${r.detail}`);
    }
  }

  return lines.join("\n");
}

export function formatJson(summary: CheckSummary, contextFiles: string[]): string {
  return JSON.stringify({ contextFiles, ...summary }, null, 2);
}
