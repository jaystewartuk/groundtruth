---
description: "All seven assertion kinds — path_exists, path_absent, env_var_absent, script_exists, workflow_trigger, symbol_at_path, text_matches_across — with args, semantics, and edge cases."
---

# Assertion kinds

Seven kinds exist today. Each is one file under `src/assertions/`, and each
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
here"; it can't express "this file exists but must not mention X" — that
needs `env_var_absent` or a future finer-grained kind.

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

## `text_matches_across`

```jsonc
{
  "kind": "text_matches_across",
  "args": {
    "text": "Every change to `main` goes through a pull request.",
    "files": ["CLAUDE.md", "CONTRIBUTING.md", "docs/development/onboarding.md"],
    "normalize": ["markdown", "whitespace"]
  }
}
```

The only kind about agreement **between** files rather than a fact inside
one. `passing` when every file in `files` contains `text` after
normalization; `failing` otherwise, with missing files and mismatching files
reported separately.

`normalize` defaults to `["whitespace"]`, which collapses every run of
whitespace to a single space — hard-wrapped prose is the most common way a
sentence hides from a line-oriented search. Add `"markdown"` to strip
per-line blockquote markers and `*`/`_` emphasis first. Nothing else is
stripped: template interpolation, HTML tags and smart-quote substitution all
report `failing` rather than a false pass.

**A missing file reports `failing`, not `unverifiable`** — the opposite of
`env_var_absent`, and deliberate. The claim is that N surfaces state this
sentence, so a surface that no longer exists has stopped stating it.
Otherwise deleting a file would be the cheapest way to go green. See
[ADR-0006](/architecture/decisions#adr-0006-verbatim-agreement-before-relational-matching).

`text` is a literal, not a pattern. It cannot express "the version in A
equals the version in B" — that relational variant is deferred until a
second real use appears.

## Adding a new kind

See [Development → Conventions](/project/development#adding-an-assertion-kind).
