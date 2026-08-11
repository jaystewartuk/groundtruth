---
description: "Fixes for the common failure modes of groundtruth check — missing assertions files, surprising passing results, re-export false negatives, and CI that doesn't gate."
---

# Troubleshooting

### `No assertions file at <path>.`

groundtruth exits `2` before checking anything if it can't find the
assertions file. Fix: `cp node_modules/@groundtruth-sh/cli/.groundtruth.jsonc.example .groundtruth.jsonc`,
or pass `--file <path>` if yours lives somewhere else. See
[Getting started](/guide/getting-started).

### A `.json` file clearly contains the env var, but `env_var_absent` says `passing`

`env_var_absent` does an exact key/string-value match against the parsed
JSON document, not a substring search — a variable name embedded inside a
longer string (e.g. as part of a URL) won't be caught. Use `path_absent`
for the coarser "this whole file shouldn't exist" case in the meantime.
See [Assertion kinds](/reference/assertion-kinds#env-var-absent).

### `symbol_at_path` reports `failing` for a symbol I know is exported

Almost always a re-export: `export { entitlementsFor } from "./impl"`
isn't matched by the regex checker, only a direct
`export function entitlementsFor` (or `const`/`class`/`interface`/`type`/`enum`)
declaration in the target file is. This is a documented limitation, not a
bug — see [ADR-0003](/architecture/decisions#adr-0003-regex-based-symbol-matching-for-mvp).

### `script_exists` / `workflow_trigger` reports `unverifiable`, not `failing`

That's deliberate: a missing or malformed `package.json` /
`.github/workflows/<file>` is a different problem than a missing script
or trigger, so it's surfaced as "couldn't check this," not "this claim is
false." Fix the underlying file (or your `--file`/`packageJson` path) and
re-run.

### My CI didn't fail even though the table shows red ✗ marks

Check that you're actually gating on the exit code
(`groundtruth check || exit 1` or just letting a non-zero exit fail the
step naturally — most CI runners already treat a non-zero exit as a
failed step). `unverifiable` results print with a `?` mark but never
affect the exit code — only `failing` (`✗`) does.

### I want groundtruth to read `CLAUDE.md` directly and generate assertions

Not built yet — see the [FAQ](/project/faq#does-groundtruth-read-my-claude-md-and-figure-out-the-assertions-itself)
and [Roadmap](/project/roadmap). Today, assertions are written by hand.

### Something else

Open an issue on
[GitHub](https://github.com/jaystewart-dev/groundtruth/issues) — there's
no other support channel yet.
