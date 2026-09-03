# ADR-0007: Citations are checked, fuzzily, and reported as warnings

## Status

Accepted

## Context

Every assertion carries a `source` — `"CLAUDE.md#L42"` — and the report's
central promise is that a failure traces back to the sentence that made the
claim. The GitHub Action leans on it harder still: it anchors an inline
annotation to that exact line so the failure lands in the pull request diff.

That pointer is a claim about the repository, and it decays like every
other claim in a context file, only more quietly. Nothing about running an
assertion touches its citation: insert a paragraph into `CLAUDE.md`, every
line number below it shifts, and the assertions all keep passing while
citing the wrong sentence. There is no failing check to notice, because
the checkers read the repo, not the citation.

This was not hypothetical. When the check was first written and run against
this repository, **9 of its own 15 citations had drifted**, and the Action
had been annotating the wrong lines of `CLAUDE.md` for months. A tool whose
entire argument is that unchecked claims rot silently cannot leave this
particular claim unchecked.

Two questions had to be answered to check it: how strictly to match, and
what a mismatch should do to the build.

## Decision

**Verify each citation by word overlap, not exact quotation, and report a
mismatch as a warning that never fails a build unless `--strict-sources` is
passed.**

The matcher normalises both the claim and the cited lines to lowercase word
tokens and requires 60% of the claim's distinct words to appear in the
cited span. Claims elided with an ellipsis (`"It ships ... as a GitHub
Action"`) are split, and the best-scoring fragment wins. When a citation
fails, the file is rescanned with the same window size to report where the
sentence now reads, so the fix is mechanical.

## Consequences

A whole class of silent decay is now caught, and caught with a suggested
correction rather than just an accusation. The check is also self-applying:
editing `CLAUDE.md` shifts the line numbers its own assertions cite, so this
repository runs `--strict-sources` in CI and finds out immediately. It did,
twice, during the change that introduced it.

The costs are real:

- **Fuzzy matching cannot be exact about what it accepts.** A citation off
  by one line, or pointing at a nearby sentence in the same paragraph, will
  usually pass. This finds citations pointing at an unrelated part of the
  file, which is the failure that actually happens; it is not a proof of
  precision.
- **The threshold is a tuned constant, not a derived one.** 60% was chosen
  against this repository's own assertions and the test fixtures. A very
  short claim (two or three words) is scored on little evidence and could
  match a coincidental line.
- **It only understands `#L` citations.** A `source` naming a file with no
  line fragment is skipped rather than reported, on the grounds that a
  weaker pointer is not a wrong one.
- **Warnings can be ignored.** Defaulting to non-fatal means a consumer who
  never reads the warnings gets no protection at all.

## Alternatives considered

**Exact substring matching.** Rejected as unusable. A `claim` is
hand-copied and routinely paraphrased, elided, or re-punctuated relative to
the prose it quotes — `"pnpm build — tsc -> dist/"` cites a line that reads
`pnpm build      # tsc -> dist/`. Exact matching would have fired on more
correct citations than drifted ones, and a check that cries wolf gets
switched off.

**Failing the build by default.** Rejected because of what it would mean on
upgrade: every existing user with a slightly loose citation would find CI
red on a patch release, for a problem in their assertions file rather than
in the repo it describes. That is the wrong trade for a warning about
documentation quality, and it would teach people to pin an old version. The
strictness is available, opt-in, and used here.

**A new assertion kind (`source_at_line`).** Rejected because kinds check
the repository being audited, and this checks the assertions file that
describes it. Modelling it as a kind would have meant hand-writing one
extra assertion per existing assertion — the pointers most likely to be
forgotten being exactly the ones nobody would write a checker entry for.
Making it automatic and unconditional is the whole point.

**Deriving line numbers instead of checking them** (search the context file
for the claim and ignore `source` entirely). Rejected: it removes the
author's ability to point deliberately at one sentence among several
similar ones, and it silently relocates a citation rather than telling
anyone it moved — trading a visible problem for an invisible one.

## References

- [`src/manual/verify-source.ts`](../../src/manual/verify-source.ts) — the checker.
- [`test/fixtures/drifted-source/`](../../test/fixtures/drifted-source/) — a fixture that
  is green on every assertion while still citing the wrong line.
- [ADR-0002](0002-unverifiable-assertions-never-fail-but-always-report.md) —
  the same instinct applied to assertions the checker cannot verify: report
  loudly, never fail, never silently drop.
- [ADR-0006](0006-verbatim-agreement-before-relational-matching.md) — where
  normalisation of hand-copied prose was first traded off.
