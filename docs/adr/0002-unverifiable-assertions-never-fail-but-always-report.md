# ADR-0002: Unverifiable assertions never fail, but are always reported

## Status

Accepted

## Context

Not every claim in a context file can be mechanically checked (e.g. a
claim about intent, or one needing a check kind that doesn't exist yet).
groundtruth needs a policy for what happens to those claims at report time.

## Decision

An assertion that resolves to `unverifiable` never causes the CLI to exit
non-zero, but it is always printed in the report — it can never be silently
dropped or counted as if it passed. `src/report.ts`'s `formatTable` orders
output worst-first (`failing`, then `unverifiable`, then `passing`) so the
operator's eye lands on what needs action, and unverifiable claims sit
visibly between "broken" and "fine" rather than being folded into either.

## Consequences

- A checker that can't yet handle a case must return `unverifiable`
  explicitly rather than guessing `passing` — this is a hard requirement
  on every checker in `src/assertions/*.ts`.
- CI gates on exit code alone will not catch a growing pile of
  unverifiable claims; a human (or a future tool) has to read the report
  to notice that coverage is silently eroding. This is a known tradeoff,
  not an oversight — see the root README's framing: "the alternative
  (silently skipping what the checker can't verify) is the exact failure
  mode this tool exists to prevent."

## Alternatives considered

- **Treat unverifiable as failing.** Rejected: would make it impossible to
  add a new assertion kind incrementally without breaking every existing
  user's CI the moment a claim needs a kind that isn't implemented yet.
- **Treat unverifiable as passing (omit from output).** Rejected: this is
  the exact "context that lies gets executed" failure mode described in
  the root README's motivation section — silently dropping what can't be
  checked defeats the tool's purpose.

## References

- `src/report.ts` (`MARK`, `formatTable` ordering)
- `src/types.ts` (`AssertionStatus`)
- Root [README § Usage](../../README.md#usage) (exit code semantics)
