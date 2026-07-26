import { checkPathExists } from "./path-exists.js";
import { checkPathAbsent } from "./path-absent.js";
import { checkEnvVarAbsent } from "./env-var-absent.js";
import { checkScriptExists } from "./script-exists.js";
import { checkWorkflowTrigger } from "./workflow-trigger.js";
import { checkSymbolAtPath } from "./symbol-at-path.js";
import type { Assertion, AssertionStatus, CheckResult } from "../types.js";

type Checker = (repoRoot: string, args: unknown) => { status: AssertionStatus; detail: string };

// One entry per AssertionKind — exhaustiveness is enforced by types.ts's
// mapped Assertion type, so adding a kind without a checker here is a
// compile error, not a silent runtime gap. Each checker's real signature
// takes its own kind-specific args type; the double cast to `unknown` here
// is safe *because* checkAssertion below only ever looks up a checker by
// `assertion.kind` and calls it with that same assertion's `args` — the
// manual-assertions schema (manual/schema.ts) is what actually guarantees
// kind and args stay paired correctly at the data level.
const REGISTRY: Record<Assertion["kind"], Checker> = {
  path_exists: checkPathExists as unknown as Checker,
  path_absent: checkPathAbsent as unknown as Checker,
  env_var_absent: checkEnvVarAbsent as unknown as Checker,
  script_exists: checkScriptExists as unknown as Checker,
  workflow_trigger: checkWorkflowTrigger as unknown as Checker,
  symbol_at_path: checkSymbolAtPath as unknown as Checker,
};

export function checkAssertion(repoRoot: string, assertion: Assertion): CheckResult {
  const checker = REGISTRY[assertion.kind];
  const { status, detail } = checker(repoRoot, assertion.args);
  return { assertion, status, detail };
}

export function checkAssertions(repoRoot: string, assertions: Assertion[]): CheckResult[] {
  return assertions.map((assertion) => checkAssertion(repoRoot, assertion));
}
