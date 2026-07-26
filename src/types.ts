export const ASSERTION_KINDS = [
  "path_exists",
  "path_absent",
  "env_var_absent",
  "script_exists",
  "workflow_trigger",
  "symbol_at_path",
] as const;

export type AssertionKind = (typeof ASSERTION_KINDS)[number];

export type PathArgs = { path: string };
export type EnvVarAbsentArgs = { name: string; files?: string[] };
export type ScriptExistsArgs = { name: string; packageJson?: string };
export type WorkflowTriggerArgs = { workflow: string; trigger: string; target?: string };
export type SymbolAtPathArgs = { symbol: string; path: string };

export type ArgsFor<K extends AssertionKind> = K extends "path_exists"
  ? PathArgs
  : K extends "path_absent"
    ? PathArgs
    : K extends "env_var_absent"
      ? EnvVarAbsentArgs
      : K extends "script_exists"
        ? ScriptExistsArgs
        : K extends "workflow_trigger"
          ? WorkflowTriggerArgs
          : K extends "symbol_at_path"
            ? SymbolAtPathArgs
            : never;

// A single checkable claim, extracted (eventually) from an agent-context file
// or (for now, MVP) hand-authored in a .groundtruth.jsonc file. `source` is
// always "<file>#L<line>" so a failure can be traced straight back to the
// sentence that made the claim.
export type Assertion = {
  [K in AssertionKind]: {
    claim: string;
    kind: K;
    args: ArgsFor<K>;
    source: string;
  };
}[AssertionKind];

export type AssertionStatus = "passing" | "failing" | "unverifiable";

export type CheckResult = {
  assertion: Assertion;
  status: AssertionStatus;
  detail: string;
};

export type CheckSummary = {
  results: CheckResult[];
  passing: number;
  failing: number;
  unverifiable: number;
};
