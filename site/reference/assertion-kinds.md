---
description: "All six assertion kinds — path_exists, path_absent, env_var_absent, script_exists, workflow_trigger, symbol_at_path — with args, semantics, and edge cases."
---

# Assertion kinds

Eight kinds exist today. Each is one file under `src/assertions/`, and each
is independently registered in the kind → checker registry described in
[Architecture overview](/architecture/overview#extension-point-assertion-kinds) —
adding a kind without wiring its checker is a TypeScript compile error,
not a silent gap.

## `path_exists`

```jsonc
{ "kind": "path_exists", "args": { "path": "src/lib/entitlements.ts" } }
```

`passing` if `<repo>/<path>` exists (file or directory), `failing`
otherwise. Never `unverifiable`.

## `path_absent`

```jsonc
{ "kind": "path_absent", "args": { "path": ".mcp.json" } }
```

The inverse of `path_exists` — `passing` if the path does **not** exist.
The coarsest available check for "this whole file/directory shouldn't be
here"; "this file exists but must not mention X" is
[`text_absent`](#text-absent)'s job.

## `env_var_absent`

```jsonc
{
  "kind": "env_var_absent",
  "args": { "name": "SUPABASE_URL", "files": ["turbo.json", ".env.example"] }
}
```

| `args` field | Required | Default |
|---|---|---|
| `name` | yes | — |
| `files` | no | `["turbo.json", ".env.example"]` |

Checks each file in `files` (skipping ones that don't exist) for `name`.
On a `.json` file, this is an exact key/string-value match against the
parsed document (covers both `turbo.json`'s array-style `globalEnv` and a
key/value env file) — **not** a substring search, so `SUPABASE_URL`
embedded inside a longer string (e.g. inside a URL) won't be caught. On
any other file type, it's a word-boundary regex search. `unverifiable` if
none of the target files exist at all; `passing`/`failing` otherwise.

## `script_exists`

```jsonc
{ "kind": "script_exists", "args": { "name": "verify:push", "packageJson": "package.json" } }
```

`passing` if `package.json`'s (or `packageJson`, if given)
`scripts[name]` is a string. `unverifiable` if the package.json file
doesn't exist or isn't valid JSON — deliberately not `failing`, since a
missing/broken package.json is a different problem than a missing script.

## `workflow_trigger`

```jsonc
{ "kind": "workflow_trigger", "args": { "workflow": "checks.yml", "trigger": "pull_request", "target": "main" } }
```

Parses `.github/workflows/<workflow>` as YAML and checks that its `on:`
block includes `trigger`, optionally scoped to a branch via `target`
(checked against that trigger's `branches:` list — absent `branches:`
means "runs on every branch", which counts as a match). `failing` if the
workflow file or the trigger doesn't exist; `unverifiable` if the file
isn't valid YAML.

## `symbol_at_path`

```jsonc
{ "kind": "symbol_at_path", "args": { "symbol": "entitlementsFor", "path": "apps/web/src/lib/subscriptions/entitlements.ts" } }
```

**Regex-based, not a full TS/JS AST parse** — see
[ADR-0003](/architecture/decisions#adr-0003-regex-based-symbol-matching-for-mvp)
for why. Matches `export [default] [async] (function|const|class|interface|type|enum) <symbol>`.
`passing` if found, `failing` if the file doesn't exist or the pattern
doesn't match. A symbol only reachable via `export { X } from "./y"` (a
re-export) reports `failing` — a known false negative, not a silent one.

## `text_present`

```jsonc
{ "kind": "text_present", "args": { "pattern": "atuin", "path": "bootstrap.sh" } }
```

| `args` field | Required | Default |
|---|---|---|
| `pattern` | yes | — |
| `path` | yes | — |
| `patternType` | no | `"literal"` (or `"regex"`) |
| `caseInsensitive` | no | `false` |

`pattern` must appear in the **one named file** — for claims of the shape
"X is configured in file Y". A literal is truly literal (no implied word
boundaries; regex metacharacters are inert); `patternType: "regex"` compiles
the pattern instead, and a regex that doesn't compile is `unverifiable`,
never a crash. A missing `path` is `failing`, not `unverifiable` — the claim
implies the file exists. Deliberately single-file: see
[ADR-0006](/architecture/decisions#adr-0006-content-assertions-scan-tracked-text-files-only).

## `text_absent`

```jsonc
{
  "kind": "text_absent",
  "args": { "pattern": "supabase", "caseInsensitive": true, "exclude": ["docs/history.md"] }
}
```

| `args` field | Required | Default |
|---|---|---|
| `pattern` *or* `patternDigest` | exactly one | — |
| `label` | with `patternDigest` | — |
| `files` *or* `include` | no (mutually exclusive) | all git-tracked files |
| `exclude` | no | — |
| `patternType`, `caseInsensitive` | no (plaintext `pattern` only) | `"literal"`, `false` |

`pattern` must appear in **no file in scope**. The default scope is every
git-tracked file (`git ls-files`) — absence is only meaningful repo-wide —
minus binary files, files over 5 MB (both skipped *and named* in the
detail), and the assertions file itself, so an assertion never self-triggers
on its own `pattern` field. Outside a git work tree the default scope is
`unverifiable` with a pointer to `files`/`include` — never a raw directory
walk. Failing detail lists `file#L<line>` for every hit, capped at 20
listed with an accurate total.

`patternDigest` replaces `pattern` for privacy-motivated evictions: it
matches a retired fact **without restating it**, via a salted-SHA-256
digest authored by [`groundtruth digest`](/reference/cli#groundtruth-digest).
Digests match exact literals only (no regex, no paraphrases), and a digest
failure reports the required `label` and locations, never the matched text.
Threat model and mechanics:
[ADR-0007](/architecture/decisions#adr-0007-redacted-patterns). For
eviction assertions, `source` points at the eviction decision record — see
the [eviction guide](/guide/evicting-a-fact).

## Adding a new kind

See [Development → Conventions](/project/development#adding-an-assertion-kind).
