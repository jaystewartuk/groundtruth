# ADR-0004: Three-layer product design — verify, contradict, instrument

## Status

Proposed — layer 1 partially built, layers 2 and 3 not started.

## Context

groundtruth's motivating problem (root
[README § intro](../../README.md)) has three distinct failure modes an
agent-context file can have: (1) an individual claim can simply be false,
(2) two claims across different files or the same file can contradict each
other, and (3) a context file can accumulate rules nobody — human or
agent — ever actually consults, bloating every session's context for no
benefit. These need different mechanisms, not one.

## Decision

Structure the product as three layers, each depending on the one below it:

1. **Extract & verify** — turn statements into checkable assertions,
   verify individually. Mechanical, no LLM judgment required once
   extraction is built (see [ADR-0001](0001-hand-authored-assertions-before-llm-extraction.md)).
2. **Contradiction detection** — cross-check every context file against
   every other for direct contradictions. Requires LLM judgment, not just
   a mechanical checker, since "contradiction" is a semantic relationship
   the assertion-kind model in layer 1 doesn't express.
3. **Context economics** — instrument agent sessions (a Claude Code
   `SessionStart` hook is the identified delivery mechanism) to report
   which rules are ever cited, so a growing file can be pruned with
   evidence instead of guesswork.

## Consequences

- Layer 1's data model (the `Assertion` type and `source` field tracing
  every claim to a `<file>#L<line>`) has to be designed to support layer 2
  cross-referencing later, even though nothing consumes that yet.
- Layers 2 and 3 are unbuilt; this ADR documents intent and sequencing,
  not a shipped design. Treat its contents as roadmap, not fact — do not
  cite it as evidence that contradiction detection exists.

## Alternatives considered

- **Build all three as one integrated pass.** Rejected: layer 1 needs no
  LLM at all and is independently useful (root README's "Status" section
  — `groundtruth check` is "fully useful today without any API key").
  Bundling would have blocked shipping anything on the hardest, most
  judgment-dependent layer.

## References

- Root [README § Roadmap](../../README.md#roadmap)
- [ADR-0001](0001-hand-authored-assertions-before-llm-extraction.md)
