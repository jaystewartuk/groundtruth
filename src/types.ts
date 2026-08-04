export const ASSERTION_KINDS = [
  "path_exists",
  "path_absent",
  "env_var_absent",
  "script_exists",
  "workflow_trigger",
  "symbol_at_path",
  "text_present",
  "text_absent",
] as const;

export type AssertionKind = (typeof ASSERTION_KINDS)[number];

export type PathArgs = { path: string };
export type EnvVarAbsentArgs = { name: string; files?: string[] };
export type ScriptExistsArgs = { name: string; packageJson?: string };
export type WorkflowTriggerArgs = { workflow: string; trigger: string; target?: string };
export type SymbolAtPathArgs = { symbol: string; path: string };

export type TextPresentArgs = {
  pattern: string;
  patternType?: "literal" | "regex"; // default "literal"
  caseInsensitive?: boolean; // default false
  path: string; // exactly one file, relative to repo root
};

// A pattern that matches an exact literal without restating it — for
// privacy-motivated evictions where the whole point is that the fact leaves
// agent context, including this very file. Authored by `groundtruth digest`;
// matched by the two-stage rolling-hash + salted-SHA-256 scan in
// text-match.ts. Redaction protects against casual context contamination,
// not a determined attacker — see ADR-0007 for the honest threat model.
export type PatternDigest = {
  algo: "sha256";
  salt: string; // random per-assertion, generated at authoring time
  digest: string; // hex sha256(salt + normalized pattern)
  rk: number; // Rabin-Karp prefilter hash of the normalized pattern (uint32)
  length: number; // byte length of the normalized pattern
  normalize: "lower" | "exact";
};

export type TextAbsentArgs = {
  pattern?: string; // exactly one of pattern / patternDigest
  patternType?: "literal" | "regex"; // default "literal"; plaintext pattern only
  caseInsensitive?: boolean; // default false; plaintext pattern only
  patternDigest?: PatternDigest;
  label?: string; // required with patternDigest — the report's handle for the fact
  files?: string[]; // explicit file list, relative to repo root
  include?: string[]; // OR glob scope (mutually exclusive with files)
  exclude?: string[]; // globs subtracted from the scope
};

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
            : K extends "text_present"
              ? TextPresentArgs
              : K extends "text_absent"
                ? TextAbsentArgs
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

// Ambient facts about the check run itself, threaded to checkers that need
// them. Today that is only the resolved path of the assertions file being
// checked, so text_absent can exclude it from its scan — otherwise every
// plaintext text_absent assertion would self-trigger on its own `pattern`
// field. Optional: checkers must behave sensibly without it.
export type CheckContext = {
  assertionsFile?: string; // absolute path of the loaded assertions file
};

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
