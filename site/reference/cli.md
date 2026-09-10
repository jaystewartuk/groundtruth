---
description: "Flags, exit codes, source-pointer checking, human and JSON output shapes, and the programmatic API of groundtruth check."
---

# CLI reference

## `groundtruth check`

The only command groundtruth has.

```
groundtruth check [--repo <path>] [--file <path>] [--json] [--strict-sources]
```

| Flag | Default | Meaning |
|---|---|---|
| `--repo <path>` | `cwd` | Repo root to check assertions against. |
| `--file <path>` | `.groundtruth.jsonc` | Assertions file, resolved relative to `--repo`. |
| `--json` | off | Print machine-readable JSON instead of a table. |
| `--strict-sources` | off | Also exit `1` when a `source` pointer no longer points at the line making its claim. |
| `--version`, `-v` | — | Print the version and exit `0`. |
| `--help`, `-h` | — | Print usage and exit `0`. |

Any command other than `check` (or none) exits `2` with an "Unknown
command" error — `check` is presently the only supported command.

An unrecognised flag is also a usage error, not a silently ignored
argument: `--jsonn` exits `2` rather than printing a table and exiting `0`.
A green build from a run that quietly did something other than what was
asked is the same class of failure the `unverifiable` status exists to
prevent, one layer up.

## Source pointers

An assertion's `source` is a claim about the repo like any other, and it
drifts the same way: insert a paragraph into `CLAUDE.md` and every line
number below it shifts while the assertions keep passing, now citing the
wrong sentence. `groundtruth check` verifies the citation too, and says
where the sentence actually moved to:

```
1 source pointer(s) may have drifted:
! CLAUDE.md#L69  "pnpm build — tsc -> dist/"
  CLAUDE.md line 69 does not state this claim — the claim now reads at CLAUDE.md#L75
```

Matching is intentionally loose — a claim is a hand-copied, often elided
paraphrase of prose that may be hard-wrapped across the cited lines, so it
compares word overlap rather than demanding an exact substring. It answers
"is the cited span even about this claim?", not "is it quoted perfectly".

These are warnings. A stale citation is a bug in your assertions file, not
drift in the repo it describes, so it never fails a build on its own and
upgrading cannot newly break your CI. `--strict-sources` opts into failing
on them; the groundtruth repository itself runs that way, because editing
its `CLAUDE.md` shifts the very line numbers its own assertions cite.

A citation with no `#L` fragment (`"CLAUDE.md"`) is a weaker pointer, not a
wrong one — there is no line to be wrong about, so nothing is reported.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | All assertions resolved `passing` or `unverifiable`. |
| `1` | At least one assertion resolved `failing` — or, under `--strict-sources`, at least one source pointer has drifted. |
| `2` | Usage error — unknown command, unknown flag, a flag missing its value, or no assertions file found at the resolved path. |

`unverifiable` never produces a non-zero exit — see
[ADR-0002](/architecture/decisions#adr-0002-unverifiable-assertions-never-fail-but-always-report).

## Human output (`formatTable`)

```
Context layer: CLAUDE.md
9 assertion(s) — 3 passing, 6 failing, 0 unverifiable

✗ CLAUDE.md#L7  "Do NOT reintroduce a Supabase/Vercel code path or env var."
  SUPABASE_URL found in turbo.json
```

Ordered worst-first — `failing`, then `unverifiable`, then `passing` — so
what needs action is at the top, not buried under everything that's fine.
The "Context layer" line lists which agent-context files
(`src/discover.ts`) were found in `--repo`; it's informational only and
doesn't currently affect which assertions run.

## Machine output (`--json`)

```json
{
  "contextFiles": ["CLAUDE.md"],
  "results": [
    {
      "assertion": { "claim": "...", "kind": "env_var_absent", "args": { "name": "SUPABASE_URL" }, "source": "CLAUDE.md#L7" },
      "status": "failing",
      "detail": "SUPABASE_URL found in turbo.json"
    }
  ],
  "passing": 3,
  "failing": 6,
  "unverifiable": 0,
  "sourceWarnings": [
    {
      "claim": "pnpm build — tsc -> dist/",
      "source": "CLAUDE.md#L69",
      "reason": "CLAUDE.md line 69 does not state this claim",
      "suggestion": "CLAUDE.md#L75"
    }
  ]
}
```

Shape is `CheckSummary` plus `contextFiles` and `sourceWarnings` — see
`src/types.ts` and `src/manual/verify-source.ts`. `sourceWarnings` is
always present, and empty when every citation is accurate. `suggestion` is
omitted when the claim's text cannot be located anywhere in the file.

## Programmatic API

The package's `exports["."]` entry (`src/index.ts`) re-exports the same
building blocks the CLI uses, for embedding in another tool:

```ts
import {
  discoverContextFiles,
  loadManualAssertions,
  checkAssertions,
  summarize,
  formatTable,
  formatJson,
  verifyAssertionSources,
} from "@groundtruth-sh/cli";
```

There's no stability guarantee on this surface yet — it mirrors internal
module boundaries, not a designed public API. While the package is
pre-1.0, treat it as unstable.
