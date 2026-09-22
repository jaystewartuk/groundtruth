# ADR-0001: Hand-authored assertions before LLM extraction

## Status

Accepted

## Context

groundtruth's end goal is to turn prose claims in `CLAUDE.md`/`AGENTS.md`
into checkable assertions automatically, via an LLM. That extraction step
is not built. The MVP needed to ship something useful without it.

## Decision

Ship the assertion *format and checker* first — `.groundtruth.jsonc`,
hand-authored — and defer LLM-based extraction to a later milestone.
`src/discover.ts` locates candidate context files (`CLAUDE.md`, `AGENTS.md`,
`.cursor/rules`, `.github/copilot-instructions.md`) today for informational
display only; it does not yet drive what gets checked (see the comment at
the top of `src/discover.ts`).

## Consequences

- The `.groundtruth.jsonc` schema (`src/manual/schema.ts`) had to be
  designed as the exact target shape extraction will need to produce, so
  the hand-authored path isn't throwaway work once extraction lands.
- Every example in the repo (`.groundtruth.jsonc.example`) is manually
  transcribed from a real audit rather than machine-generated, which is
  more labor per example but proves the format against a real case before
  automating it.
- Users get zero value until they write assertions themselves — there is
  no "point it at CLAUDE.md and go" flow yet. This is the primary UX gap
  the roadmap's extraction milestone closes.

## Alternatives considered

- **Build extraction first.** Rejected: couples the MVP to LLM API access
  and prompt-engineering risk before the checker/report core — which has
  no such dependency — was proven out.

## References

- `src/discover.ts` (context-file discovery, informational-only today)
- `src/manual/schema.ts`, `src/manual/load.ts` (the hand-authored path)
- Root [README § Status](../../README.md#status) and
  [§ Roadmap](../../README.md#roadmap)
- [ADR-0004](0004-three-layer-roadmap.md) (extraction is layer 1 of 3)
