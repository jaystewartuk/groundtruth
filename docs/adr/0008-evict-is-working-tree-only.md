# ADR-0008: `evict` is working-tree-only and says so; stdin-only input; `--write` bridges sweep to enforcement

## Status

Accepted

## Context

Fact eviction is a real job the tool didn't model. When an operator
retires a fact — a deadline that no longer holds, a codename that must
stop appearing — the work is: sweep every context surface for mentions,
remove them, then *enforce non-recurrence* forever, because the fact
creeps back in from old transcripts, quoted reviews, or an agent
summarizing history. Detecting that a head-truth fact went stale is
impossible by construction (nothing in the repo can contradict it), but
enforcement after the human decision is purely mechanical — and users
were doing it with `grep` and hope.

A dedicated command raises two boundary questions: what surfaces can it
honestly claim to sweep, and how does the fact get into the command
without leaving a new copy behind?

## Decision

`groundtruth evict` is thin orchestration over the `text_absent`
machinery (ADR-0006, ADR-0007):

- **Input is stdin, never argv.** Argv lands in shell history, which is
  itself a context surface the fact is supposed to leave.
- **The sweep is working-tree-only, and the report always ends with a
  hard-coded unswept-surfaces disclosure** — git history, forks, other
  repos that quote this one, GitHub PR/issue bodies and their edit
  histories, CI logs, published packages, transcripts and memory files.
  This is the fail-closed principle applied to eviction: what the scan
  cannot see, it must say it cannot see. The list is deliberately not
  configurable — a configurable boundary is a boundary someone will
  configure away.
- **`--write` turns the one-time sweep into permanent enforcement** by
  appending a `text_absent` assertion to `.groundtruth.jsonc` (creating
  it if missing): plaintext by default, `patternDigest` + required
  `--label` under `--redact`. `--source` records the eviction decision
  reference; without it the assertion gets a dated
  `"evicted <date> via groundtruth evict"` and a warning that a real
  decision record is better (per ADR-0007's `source` convention).
- The sweep is case-insensitive, and the written assertion matches
  (`caseInsensitive: true`, or `normalize: "lower"` under `--redact`) —
  an eviction cares about the fact in any casing.
- Exit code mirrors `check`: non-zero while hits remain, so
  `... | groundtruth evict` can gate a cleanup script.

## Consequences

- The disclosure list will occasionally tell users about surfaces they
  can't act on (someone else's fork). That is the point — the honest
  boundary is the product, and pretending the sweep was complete is the
  exact failure mode this tool exists to prevent.
- Working-tree-only means history rewriting, GitHub API sweeps, and
  cross-repo orchestration are explicit non-goals. A future
  `evict --repos` over a workspace of local checkouts is plausible;
  nothing else on that list belongs in a zero-network CLI.
- stdin-only input makes the command slightly less ergonomic in scripts
  (`printf '%s' "$FACT" | groundtruth evict`) — accepted cost of not
  minting new copies of the fact.
- `--write` appends with JSONC-preserving edits, so hand-written comments
  in an existing assertions file survive.

## Alternatives considered

- **`evict <fact>` as an argument** — rejected: shell history is a
  context surface. This is non-negotiable enough to make the CLI shape
  worse for it.
- **Sweeping git history too** — rejected: read-only history scanning
  invites "so fix it" (rewriting published history), a destructive
  operation a verification tool has no business automating. The
  disclosure names history instead.
- **A configurable disclosure list** — rejected; see Decision.
- **Building staleness detection** — impossible by construction; the
  human decides, the tool enforces. No heuristics.

## References

- `src/evict.ts` — the command
- [ADR-0006](0006-content-assertions-scan-tracked-text-files-only.md) — scope rules the sweep reuses
- [ADR-0007](0007-redacted-patterns.md) — redaction and the `source` convention
- [ADR-0002](0002-unverifiable-assertions-never-fail-but-always-report.md) — the fail-closed posture this extends
