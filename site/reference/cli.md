# CLI reference

## `groundtruth check`

The only command groundtruth has.

```
groundtruth check [--repo <path>] [--file <path>] [--json]
```

| Flag | Default | Meaning |
|---|---|---|
| `--repo <path>` | `cwd` | Repo root to check assertions against. |
| `--file <path>` | `.groundtruth.jsonc` | Assertions file, resolved relative to `--repo`. |
| `--json` | off | Print machine-readable JSON instead of a table. |
| `--help`, `-h` | — | Print usage and exit `0`. |

Any command other than `check` (or none) exits `2` with an "Unknown
command" error — `check` is presently the only supported command.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | All assertions resolved `passing` or `unverifiable`. |
| `1` | At least one assertion resolved `failing`. |
| `2` | Usage error — unknown command, or no assertions file found at the resolved path. |

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
  "unverifiable": 0
}
```

Shape is `CheckSummary` plus `contextFiles` — see `src/types.ts`.

## Programmatic API

`groundtruth`'s `exports["."]` (`src/index.ts`) re-exports the same
building blocks the CLI uses, for embedding in another tool:

```ts
import {
  discoverContextFiles,
  loadManualAssertions,
  checkAssertions,
  summarize,
  formatTable,
  formatJson,
} from "groundtruth";
```

There's no stability guarantee on this surface yet — it mirrors internal
module boundaries, not a designed public API. Treat it as unstable until
a first tagged release.
