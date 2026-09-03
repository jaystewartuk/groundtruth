import type { CheckResult, CheckSummary } from "./types.js";
import type { SourceWarning } from "./manual/verify-source.js";

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

/** Rendered under the report rather than beside the assertions: a drifted
 * citation says nothing about the repo being checked, only about the
 * assertions file describing it. Keeping the two apart stops a documentation
 * bug from reading like a finding. */
function sourceWarningLines(warnings: SourceWarning[]): string[] {
  if (warnings.length === 0) return [];
  const lines = ["", `${warnings.length} source pointer(s) may have drifted:`];
  for (const w of warnings) {
    lines.push(`! ${w.source}  ${JSON.stringify(w.claim)}`);
    const extra = w.alsoAffects
      ? ` (and ${w.alsoAffects} other assertion(s) citing it)`
      : w.suggestion
        ? ` — the claim now reads at ${w.suggestion}`
        : "";
    lines.push(`  ${w.reason}${extra}`);
  }
  return lines;
}

/** Human-readable table, worst-first: failing, then unverifiable, then
 * passing — the operator's eye should land on what needs action. */
export function formatTable(
  summary: CheckSummary,
  contextFiles: string[],
  sourceWarnings: SourceWarning[] = [],
): string {
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

  lines.push(...sourceWarningLines(sourceWarnings));

  return lines.join("\n");
}

export function formatJson(
  summary: CheckSummary,
  contextFiles: string[],
  sourceWarnings: SourceWarning[] = [],
): string {
  return JSON.stringify({ contextFiles, ...summary, sourceWarnings }, null, 2);
}
