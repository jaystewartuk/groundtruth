# CLAUDE.md — groundtruth

Agent-context file for working on groundtruth itself (not for a repo using
groundtruth to check itself). Full docs: [`docs/README.md`](docs/README.md).

## What this repo is

A CLI (`groundtruth check`) that verifies claims in `CLAUDE.md`/`AGENTS.md`
against the actual repo. One command exists today; nothing is deployed —
this is a local dev/CI tool distributed on npm as `@groundtruth-sh/cli`
(first published as 0.1.0 on 2026-07-31). The installed command is still
plain `groundtruth`.

## How changes land

Every change to `main` goes through a pull request. `main` is protected and
the `verify` check must pass before merge. No approval is required — single
maintainer — so the flow is: branch, open the pull request, merge it
yourself once CI is green. Never push to `main` directly.

The reason is that this repo is public and ships to npm, where a published
version number can never be taken back. Merging does not publish, though —
releases stay manual and deliberate (see the site's release-process page).

## Facts an agent should not assume are stale without checking

- No LLM-based extraction from `CLAUDE.md`/`AGENTS.md` exists yet.
  Assertions are hand-authored in `.groundtruth.jsonc`. See
  [ADR-0001](docs/adr/0001-hand-authored-assertions-before-llm-extraction.md).
- Six assertion kinds exist: `path_exists`, `path_absent`,
  `env_var_absent`, `script_exists`, `workflow_trigger`, `symbol_at_path`.
  The canonical list is `ASSERTION_KINDS` in `src/types.ts` — if this file
  and that array ever disagree, the array is right.
- `symbol_at_path` is regex-based, not an AST parse — it false-negatives
  on re-exported symbols. Deliberate, see
  [ADR-0003](docs/adr/0003-regex-based-symbol-matching-for-mvp.md).
- Published to npm as `@groundtruth-sh/cli` since 0.1.0 (2026-07-31); install
  is `pnpm add -D @groundtruth-sh/cli`; the bin it installs is plain
  `groundtruth`. Unscoped `groundtruth` is permanently blocked by npm's
  name-similarity rule (the unrelated `ground-truth` exists). Releases are
  manual — no release automation workflow exists (see the site's
  release-process page).

## Commands

```bash
pnpm build      # tsc -> dist/
pnpm test       # pretest runs tsc, then vitest against test/fixtures/sample-repo
pnpm typecheck  # tsc --noEmit
```

## Adding an assertion kind

Follow [`docs/development/conventions.md`](docs/development/conventions.md)
exactly — it's a 5-step checklist, and step 3 (registering the checker in
`src/assertions/index.ts`) is enforced at compile time if skipped.

## Where things live

Architecture and request flow: [`docs/architecture/overview.md`](docs/architecture/overview.md).
Why a given tradeoff was made: [`docs/adr/`](docs/adr/README.md). Do not
restate architectural reasoning here — link to it, per this repo's own
single-source-of-truth rule ([`docs/README.md`](docs/README.md#principles-this-tree-follows)).
