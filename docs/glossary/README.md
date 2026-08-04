# Glossary

> **Summary:** Terms used across this documentation tree, defined once.
> Link here (`[claim](../glossary/README.md#claim)`) instead of
> re-explaining a term inline.

**Agent-context file** — A file like `CLAUDE.md` or `AGENTS.md` that tells
an AI coding agent facts and rules about a repo. groundtruth's subject
matter, not something it produces.

**Assertion** — A single checkable claim: a `kind`, kind-specific `args`,
the original `claim` text, and a `source` pointer. See `src/types.ts`.

**Claim** — The human-readable sentence an assertion was derived from,
preserved verbatim so a report reads back to the original context-file
text.

**Context layer** — The set of agent-context files groundtruth found in a
repo (`src/discover.ts`). Currently informational only — see
[ADR-0001](../adr/0001-hand-authored-assertions-before-llm-extraction.md).

**Drift** — When an agent-context file's claim stops matching reality
(the code changed, the claim didn't). The core problem groundtruth exists
to catch — see the root [README's intro](../../README.md).

**Kind** (assertion kind) — Which of the eight checkers an assertion uses
(`path_exists`, `path_absent`, `env_var_absent`, `script_exists`,
`workflow_trigger`, `symbol_at_path`, `text_present`, `text_absent`). See
the root [README's kind table](../../README.md#assertion-kinds).

**Unverifiable** — An assertion status meaning "no checker could
mechanically confirm or deny this." Never causes a failing exit code, but
is always printed — see
[ADR-0002](../adr/0002-unverifiable-assertions-never-fail-but-always-report.md).
