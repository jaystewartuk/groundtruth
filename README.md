# groundtruth

[![GitHub stars](https://img.shields.io/github/stars/jaystewart-dev/groundtruth?style=flat-square&color=16a34a)](https://github.com/jaystewart-dev/groundtruth/stargazers)
[![Latest release](https://img.shields.io/github/v/release/jaystewart-dev/groundtruth?style=flat-square&color=0ea5e9)](https://github.com/jaystewart-dev/groundtruth/releases)
[![npm](https://img.shields.io/npm/v/@groundtruth-sh/cli?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@groundtruth-sh/cli)
[![CI](https://img.shields.io/github/actions/workflow/status/jaystewart-dev/groundtruth/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/jaystewart-dev/groundtruth/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/github/license/jaystewart-dev/groundtruth?style=flat-square&color=64748b)](https://github.com/jaystewart-dev/groundtruth/blob/main/LICENSE)

Verify `CLAUDE.md` / `AGENTS.md` against the actual repo.

**[📖 Documentation site →](https://groundtruth.sh/)**

Agent-context files rot the same way any other doc rots — except nothing
catches it. Code that lies gets caught by a compiler. Agent context that lies
gets executed: an agent reads "the Supabase project is torn down" as ground
truth and plans against it, right up until it silently reintroduces the thing
the sentence told it not to.

`groundtruth check` turns statements in your agent-context layer into
executable assertions and checks them against your working tree — a compiler
and CI gate for the rules you've written down for your agent to follow.

This project exists because an audit of a real production repo
([AgendaProfe](https://agendaprofe.com)) found four live
instances of exactly this: stale `SUPABASE_*`/`VERCEL_*` env vars still
declared in build tooling months after both were decommissioned, a leftover
MCP server config for a torn-down database, and a memory file directly
contradicting the project's own stated PR policy. Every example in this repo
is modeled on those real findings.

## Status

**Early MVP.** Assertions are hand-authored in a `.groundtruth.jsonc` file —
LLM-based extraction straight from `CLAUDE.md`/`AGENTS.md` is not built yet
(see [Roadmap](#roadmap)). The point of shipping it this way first: the
`.groundtruth.jsonc` format is exactly the shape extraction will need to
produce, so nothing here is throwaway, and `groundtruth check` is fully
useful today without any API key.

## Install

```bash
pnpm add -D @groundtruth-sh/cli   # or: npm install -D @groundtruth-sh/cli
```

Or run it without adding a dependency:

```bash
pnpm dlx @groundtruth-sh/cli check   # or: npx @groundtruth-sh/cli check
```

The package is scoped because npm's name-similarity rule reserves unscoped
`groundtruth` against the unrelated existing `ground-truth` package — but
the command it installs is plain `groundtruth`.

For fast local iteration while developing groundtruth itself:

```bash
cd groundtruth && pnpm build && pnpm link --global
cd your-project && groundtruth check   # runs your local working copy
```

## Usage

```bash
cp node_modules/@groundtruth-sh/cli/.groundtruth.jsonc.example .groundtruth.jsonc
# edit it, then:
groundtruth check
```

```
Context layer: CLAUDE.md
9 assertion(s) — 3 passing, 6 failing, 0 unverifiable

✗ CLAUDE.md#L7  "Do NOT reintroduce a Supabase/Vercel code path or env var."
  SUPABASE_URL found in turbo.json
✗ CLAUDE.md#L8  "The Supabase project is torn down; do not add an MCP server for it."
  .mcp.json exists but should not
✓ CLAUDE.md#L9  "`pnpm verify:push` runs typecheck + unit."
  scripts.verify:push = "pnpm typecheck && pnpm test"
```

Exit code is `1` if any assertion is `failing`, `0` otherwise. `unverifiable`
assertions never fail the run, but are always printed — an assertion that
can't be mechanically checked is reported, never silently dropped or counted
as passing. That's a deliberate fail-closed choice: the alternative (silently
skipping what the checker can't verify) is the exact failure mode this tool
exists to prevent.

Options:

```
groundtruth check [--repo <path>] [--file <path>] [--json]

  --repo <path>   Repo root to check against (default: cwd)
  --file <path>   Assertions file (default: .groundtruth.jsonc)
  --json          Machine-readable output instead of a table
```

## In CI: the GitHub Action

Drift caught on a laptop is drift caught after it merged. The Action runs the
same check on every pull request, and annotates the exact line of your context
file that made the false claim, so the failure lands in the diff:

```yaml
name: agent-context

on:
  pull_request:
    branches: [main]

jobs:
  groundtruth:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: jaystewart-dev/groundtruth@v0.2.0
```

That's the whole setup — no `setup-node` step, no install step. All inputs are
optional:

| input | default | meaning |
|---|---|---|
| `version` | `0.2.0` | Which published CLI version to run. `latest` tracks the registry |
| `file` | `.groundtruth.jsonc` | Assertions file, relative to `working-directory` |
| `working-directory` | `.` | Repo root to check against — point it at a package in a monorepo |
| `fail-on-unverifiable` | `false` | Also fail the job when an assertion can't be mechanically checked |
| `annotations` | `true` | Inline annotations on the claiming line |
| `summary` | `true` | Write the report to the job summary |
| `cli-path` | — | Advanced: run a local CLI build instead of fetching from npm |

Outputs — `total`, `passing`, `failing`, `unverifiable`, and `report-path`
(the full JSON report on disk) — let a later step act on the result:

```yaml
      - uses: jaystewart-dev/groundtruth@v0.2.0
        id: check
        continue-on-error: true
      - run: echo "${{ steps.check.outputs.failing }} claims have gone stale"
```

The Action is a composite wrapper around the published CLI, not a
reimplementation of it — it shells out to exactly what you'd run locally
([ADR-0005](docs/adr/0005-composite-action-wrapping-the-published-cli.md)).
It needs Node and npm on the runner, which every GitHub-hosted runner has.
Full reference: [groundtruth.sh/guide/github-action](https://groundtruth.sh/guide/github-action).

This repo runs the Action on itself: [`.groundtruth.jsonc`](./.groundtruth.jsonc)
holds assertions taken from its own `CLAUDE.md`, checked on every pull request
by the `self-check` job in [`ci.yml`](.github/workflows/ci.yml).

## The `.groundtruth.jsonc` format

An array of assertions, each with:

| field | meaning |
|---|---|
| `claim` | The sentence from your context file, verbatim — for humans reading the report |
| `kind` | One of the 6 kinds below |
| `args` | Kind-specific arguments |
| `source` | `"<file>#L<line>"` — traces a failure back to the exact sentence that made the claim |

See [`.groundtruth.jsonc.example`](./.groundtruth.jsonc.example) for a full,
commented example (the AgendaProfe findings, encoded as real assertions).

### Assertion kinds

| kind | args | checks |
|---|---|---|
| `path_exists` | `{ path }` | file/dir exists relative to repo root |
| `path_absent` | `{ path }` | file/dir does **not** exist |
| `env_var_absent` | `{ name, files? }` | `name` does not appear as a key/string value in the given files (default: `turbo.json`, `.env.example`) |
| `script_exists` | `{ name, packageJson? }` | `package.json` has a `scripts[name]` entry |
| `workflow_trigger` | `{ workflow, trigger, target? }` | a `.github/workflows/<workflow>` file's `on:` block includes `trigger` (optionally scoped to a branch via `target`) |
| `symbol_at_path` | `{ symbol, path }` | a named `export function`/`const`/`class`/`interface`/`type`/`enum` exists in the file at `path` |

**Known MVP limitations, not silent gaps:**

- `symbol_at_path` is regex-based, not a full TS/JS AST parse. It won't find
  a symbol reached only via re-export (`export { X } from "./y"`) — that
  reports `failing`, not a false pass.
- `env_var_absent` on a `.json` file requires an exact string/key match, not
  a substring search — it won't catch a var name embedded inside a longer
  string (e.g. inside a URL). Use `path_absent` for the coarser "this whole
  file shouldn't exist" case in the meantime.
- No kind yet covers **cross-file contradiction** (e.g. `CLAUDE.md` saying
  "PRs are the default" while a memory file says the opposite) — that's
  layer 2 in the roadmap below, and needs an LLM judgment call, not a
  mechanical check.

## Documentation

This README covers install and day-to-day usage. For everything else —
guided quick start, full CLI/assertion-kind reference, architecture
diagrams, FAQ, and troubleshooting — see the
**[documentation site](https://groundtruth.sh/)**
(source: [`site/`](site/), deploys automatically on every push to `main`
via [`.github/workflows/deploy-site.yml`](.github/workflows/deploy-site.yml)).

The underlying repo-internal docs the site is built from — system
architecture, ADRs explaining specific tradeoffs, and a narrated listening
edition for Speechify — live in [`docs/`](docs/README.md) and
[`docs-listen/`](docs-listen/README.md).

## Development

```bash
pnpm install
pnpm build      # tsc -> dist/
pnpm test       # builds first (pretest), then runs vitest against
                # test/fixtures/sample-repo — a fixture tree modeling the
                # real AgendaProfe drift findings
pnpm typecheck  # tsc --noEmit
```

Every push and pull request runs typecheck + test via
[`.github/workflows/ci.yml`](.github/workflows/ci.yml). See
[`CONTRIBUTING.md`](CONTRIBUTING.md) before opening a PR.

## Roadmap

This MVP is layer 1 of a three-layer design (see the source audit for the
full reasoning):

1. **Extract & verify** *(this repo, partially)* — turn context-file
   statements into checkable assertions and verify them. Hand-authored today;
   LLM-based extraction straight from `CLAUDE.md`/`AGENTS.md` is next.
2. **Contradiction detection** — cross-check every context file against every
   other (and against a decision log, if one exists) for direct
   contradictions, not just individually-false claims.
3. **Context economics** — instrument agent sessions (a Claude Code
   `SessionStart` hook is the natural delivery mechanism) to report which
   rules are ever actually cited, so a growing context file can be pruned
   with evidence instead of guesswork.

The GitHub Action shipped in 0.2.0 (see [In CI](#in-ci-the-github-action)
above). Still planned, not yet built: a `--inject`-style mode for a
session-start hook, so an agent starts every session already told which of
its own instructions are currently false.

## License

MIT
