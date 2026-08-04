# Feature: `groundtruth evict`

> **Summary:** Reads a retired fact from stdin, sweeps every git-tracked
> text file for it, and — with `--write` — appends a `text_absent`
> assertion so `check` enforces non-recurrence forever. `--redact` keeps
> the fact out of both the report and the written assertion.
> `groundtruth digest` is the standalone authoring helper for redacted
> patterns.

## Purpose

Model fact eviction as a first-class job. When an operator retires a fact
— a deadline that no longer holds, a codename that must stop appearing —
the work is sweep, remove, then *enforce non-recurrence*, because the
fact creeps back from old transcripts and summaries. Staleness detection
is impossible for facts whose truth lives in the operator's head;
enforcement after the human decision is purely mechanical, and users were
doing it with `grep` and hope.

## User value

One command turns "I hope we scrubbed it everywhere" into a repeatable
sweep plus a permanent CI gate. For privacy-motivated evictions,
`--redact` closes the loop that plaintext enforcement leaves open: a
"never mention X" assertion that spells out X keeps a copy of X alive in
exactly the file agents and CI read most.

## Architecture

Thin orchestration over the `text_absent` machinery: `src/evict.ts` reuses
`resolveScope`/`compilePattern` from `src/assertions/text-match.ts` and
`buildPatternDigest` for `--redact`. Decisions:
[ADR-0006](../adr/0006-content-assertions-scan-tracked-text-files-only.md)
(scope), [ADR-0007](../adr/0007-redacted-patterns.md) (digests, report
redaction, the `source` convention),
[ADR-0008](../adr/0008-evict-is-working-tree-only.md) (stdin-only input,
the unswept-surfaces disclosure).

## Important files

| File | Role |
|---|---|
| `src/evict.ts` | Arg parsing, sweep, `--write` JSONC append, disclosure |
| `src/digest.ts` | `groundtruth digest` — stdin reading, salt + digest authoring |
| `src/assertions/text-match.ts` | Scope resolver, plaintext + digest matchers |
| `src/assertions/text-absent.ts` | The kind that enforces what `--write` records |

## Dependencies

`jsonc-parser` (comment-preserving append into `.groundtruth.jsonc`);
`node:crypto` for salts and SHA-256. No network — the sweep is
working-tree-only, and says so.

## Workflow

```bash
printf '%s' 'the retired fact' | groundtruth evict            # sweep, show hits
printf '%s' 'the retired fact' | groundtruth evict --redact   # locations only
printf '%s' 'the retired fact' | groundtruth evict --write \
  --source docs/decisions/D-12.md#L3                          # sweep + enforce
printf '%s' 'the retired fact' | groundtruth evict --redact --write \
  --label retired-codename                                    # enforce, redacted
groundtruth digest              # author a patternDigest by hand instead
```

Exit `1` while hits remain, `0` when clean, `2` on usage/setup errors.
Every report ends with the hard-coded disclosure of surfaces a
working-tree scan cannot sweep (git history, PR/issue bodies, CI logs,
transcripts…).

## Known limitations

- Working-tree-only, deliberately: no history rewriting, no GitHub API
  sweeps, no cross-repo orchestration
  ([ADR-0008](../adr/0008-evict-is-working-tree-only.md)).
- Redacted patterns match exact literals — a reworded fact is not caught,
  and redaction is not cryptographic secrecy for low-entropy facts
  ([ADR-0007](../adr/0007-redacted-patterns.md)).
- The sweep sees git-tracked files only; an uncommitted scratch file
  escapes it ([ADR-0006](../adr/0006-content-assertions-scan-tracked-text-files-only.md)).

## Future improvements

Tracked centrally in the root
[README § Roadmap](../../README.md#roadmap) — a future `evict --repos`
over a workspace of local checkouts is named as plausible in ADR-0008;
nothing else is planned.
