# CLAUDE.md — groundtruth

Agent-context file for working on groundtruth itself (not for a repo using
groundtruth to check itself). Full docs: [`docs/README.md`](docs/README.md).

## What this repo is

A CLI (`groundtruth check`) that verifies claims in `CLAUDE.md`/`AGENTS.md`
against the actual repo. One command exists today; nothing is a running
service. It ships two ways, both from this repo: on npm as
`@groundtruth-sh/cli` (first published as 0.1.0 on 2026-07-31; the installed
command is still plain `groundtruth`), and as a GitHub Action defined by
`action.yml` at the repo root.

## How changes land

Every change to `main` goes through a pull request. `main` is protected and
the `verify` check must pass before merge. No approval is required — single
maintainer — so the flow is: branch, open the pull request, merge it
yourself once CI is green. Never push to `main` directly.

The reason is that this repo is public and ships to npm and the GitHub
Marketplace, where a published version number can never be taken back.
Merging does not publish, though — releases stay manual and deliberate (see
the site's release-process page).

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
- The GitHub Action is a **composite** action: `action.yml` at the repo root
  plus a dependency-free runner at `action/run.mjs` that shells out to the
  published CLI. It is not a bundled JavaScript action and there is no
  `dist/` build step for it — editing `action/run.mjs` is the whole change.
  Why, and what that costs: [ADR-0005](docs/adr/0005-composite-action-wrapping-the-published-cli.md).
- `action.yml`'s `version` input pins which published CLI the Action installs,
  and it must be bumped to match `package.json` in the same release commit —
  an Action release pointing at an unpublished version is broken for every
  consumer.
- This repo runs the Action on itself: `.groundtruth.jsonc` at the root holds
  assertions taken from this very file, and the `self-check` job in
  `.github/workflows/ci.yml` runs them against the local build on every pull
  request. If you change a claim here, expect that job to be the thing that
  tells you.

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
