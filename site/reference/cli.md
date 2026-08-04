# CLI reference

Three commands exist: `check` (the CI gate), and the two eviction helpers
`digest` and `evict`. Anything else exits `2` with an "Unknown command"
error. No command at all runs `check`.

## `groundtruth check`

```
groundtruth check [--repo <path>] [--file <path>] [--json]
```

| Flag | Default | Meaning |
|---|---|---|
| `--repo <path>` | `cwd` | Repo root to check assertions against. |
| `--file <path>` | `.groundtruth.jsonc` | Assertions file, resolved relative to `--repo`. |
| `--json` | off | Print machine-readable JSON instead of a table. |
| `--help`, `-h` | — | Print usage and exit `0`. |

## Exit codes

| Code | Meaning |
|---|---|
| `0` | All assertions resolved `passing` or `unverifiable`. |
| `1` | At least one assertion resolved `failing`. |
| `2` | Usage error — unknown command, or no assertions file found at the resolved path. |

`unverifiable` never produces a non-zero exit — see
[ADR-0002](/architecture/decisions#adr-0002-unverifiable-assertions-never-fail-but-always-report).

## `groundtruth digest`

The authoring helper for redacted `text_absent` patterns — nobody
hand-computes a salted digest.

```
groundtruth digest [--stdin] [--exact]
```

Reads the literal from **stdin** — never argv, which lands in shell
history, itself a context surface — generates a random salt, and prints a
complete `patternDigest` object ready to paste into a `text_absent`
assertion's `args` (add a `label`; it's required with `patternDigest`).
The plaintext exists only in process memory.

| Flag | Meaning |
|---|---|
| `--stdin` | Explicit pipe mode for scripting. Without it, a terminal gets a prompt; piped input works either way. |
| `--exact` | Digest for case-sensitive matching. The default folds case (`normalize: "lower"`) — an eviction usually cares about the fact in any casing. |

A trailing newline on the input is stripped — it's the shell's, not the
fact's. Empty input exits `2`. What digests can and cannot promise:
[ADR-0007](/architecture/decisions#adr-0007-redacted-patterns).

## `groundtruth evict`

Sweep the working tree for a retired fact, and optionally turn the sweep
into permanent enforcement. Walkthrough: [Evicting a fact](/guide/evicting-a-fact).

```
groundtruth evict [--redact] [--label <name>] [--write] [--source <ref>]
                  [--repo <path>] [--file <path>]
```

The fact is read from **stdin** (same reasoning as `digest`). Every hit is
printed as `file#L<line>` — with the matching line shown only when
`--redact` is not set — and the report always ends with the hard-coded
list of surfaces a working-tree scan *cannot* sweep (git history, PR/issue
bodies, CI logs, transcripts…). Exit `1` while hits remain, `0` when the
sweep is clean, `2` on a usage or setup error.

| Flag | Meaning |
|---|---|
| `--redact` | Print hit locations only, never the matching lines. |
| `--write` | Append a `text_absent` assertion to the assertions file (created if missing), so `check` enforces non-recurrence — plaintext by default, a redacted `patternDigest` under `--redact`. |
| `--label <name>` | Report handle for the fact. Required with `--redact --write`. |
| `--source <ref>` | The eviction decision record (a decision-log line, a commit). Defaults to a dated `evicted <date> via groundtruth evict`, with a warning that a real reference is better. |
| `--repo <path>` | Repo root to sweep (default: `cwd`). |
| `--file <path>` | Assertions file for `--write` (default: `.groundtruth.jsonc`). |

The sweep is case-insensitive, and the written assertion matches
(`caseInsensitive: true`, or `normalize: "lower"` under `--redact`).
Boundary decisions: [ADR-0008](/architecture/decisions#adr-0008-evict-is-working-tree-only).

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
