# Feature: `groundtruth check`

> **Summary:** Loads a `.groundtruth.jsonc` assertions file, checks each
> assertion against the repo on disk, prints a pass/fail/unverifiable
> report, exits non-zero if anything failed. This is groundtruth's only
> command today.

## Purpose

Catch agent-context drift the way a compiler catches type errors: turn a
prose claim ("the Supabase project is torn down") into something that can
be mechanically wrong, and fail CI when it is.

## User value

Without this, a stale claim in `CLAUDE.md` is invisible until an agent
acts on it — usually by reintroducing exactly what the file told it not
to. `check` makes that failure loud and pre-merge instead of silent and
post-hoc. See the root [README's motivating audit](../../README.md) for
the real-repo findings this is modeled on.

## Architecture

See [`architecture/overview.md`](../architecture/overview.md) for the full
component diagram and flow. In short: `cli.ts` orchestrates
`manual/load.ts` (parse + validate), `assertions/index.ts` (dispatch to
per-kind checkers), and `report.ts` (format + exit code).

## Important files

| File | Role |
|---|---|
| `src/cli.ts` | Arg parsing (`--repo`, `--file`, `--json`), orchestration |
| `src/manual/schema.ts` | Zod schema for `.groundtruth.jsonc` |
| `src/manual/load.ts` | Loads + validates the assertions file |
| `src/assertions/index.ts` | Kind → checker registry, dispatch |
| `src/assertions/*.ts` | One checker per assertion kind |
| `src/report.ts` | Summary, table/JSON formatting |

## Dependencies

`jsonc-parser` (comments in the assertions file), `zod` (schema
validation), `yaml` (workflow-file parsing for `workflow_trigger`). No
network, no database, no auth.

## Workflow

```bash
cp .groundtruth.jsonc.example .groundtruth.jsonc   # then edit it
groundtruth check                                   # human-readable table
groundtruth check --json                            # machine-readable
groundtruth check --repo ../other-repo --file custom.jsonc
```

Exit code `1` if any assertion is `failing`, `0` otherwise —
`unverifiable` assertions are always printed but never fail the run (see
[ADR-0002](../adr/0002-unverifiable-assertions-never-fail-but-always-report.md)
for why).

## Assertion kinds

Six kinds exist today: `path_exists`, `path_absent`, `env_var_absent`,
`script_exists`, `workflow_trigger`, `symbol_at_path`. Each kind's
argument shape and exact check semantics are the type source of truth in
`src/types.ts` and documented for humans in the root
[README's kind table](../../README.md#assertion-kinds) — not duplicated
here, since that table is the single source for it.

## Known limitations

- Assertions are hand-authored, not extracted from `CLAUDE.md`/`AGENTS.md`
  automatically — see [ADR-0001](../adr/0001-hand-authored-assertions-before-llm-extraction.md).
- `symbol_at_path` is regex-based and misses re-exported symbols — see
  [ADR-0003](../adr/0003-regex-based-symbol-matching-for-mvp.md).
- `env_var_absent` on JSON files needs an exact key/value match, not a
  substring search.
- No cross-file contradiction detection — that's layer 2 of
  [ADR-0004](../adr/0004-three-layer-roadmap.md), unbuilt.

## Future improvements

Tracked centrally in the root
[README § Roadmap](../../README.md#roadmap) — not restated here, to keep
this single-sourced.
