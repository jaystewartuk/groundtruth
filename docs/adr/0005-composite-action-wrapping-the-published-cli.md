# ADR-0005: The GitHub Action is a composite wrapper around the published CLI

## Status

Accepted

## Context

groundtruth's whole value is realised in CI: a drift check that only ever
runs on a developer's laptop catches drift after it has already been merged.
Making that easy means shipping a GitHub Action, and GitHub offers three
shapes for one.

A **JavaScript action** runs a bundled entrypoint directly on the runner. It
is the fastest to start and the most common shape for a Node tool — but the
bundle has to be committed to the repo. Every dependency gets vendored into a
`dist/` blob that must be rebuilt and re-committed on every change, and the
build output has to be kept honest against the source. That is a second,
parallel build artifact for a repo that already publishes one to npm.

A **Docker action** gives full control of the environment at the cost of a
container pull on every run — minutes of latency for a check that takes
milliseconds of work.

A **composite action** is a YAML wrapper around ordinary shell steps. It has
no bundling story at all: whatever the steps invoke has to already exist on
the runner or be fetched at run time.

The deciding constraint is that this repo *already* publishes the thing the
Action needs to run. The CLI is on npm, and every GitHub-hosted runner ships
Node and npm. There is nothing to bundle that is not already distributed.

## Decision

The Action is a composite action: `action.yml` at the repo root, plus a
single dependency-free ESM runner at `action/run.mjs` that `npx`-installs the
published `@groundtruth-sh/cli` at a pinned version and runs
`groundtruth check --json`.

The runner imports nothing outside the Node 20 standard library. In
particular it does **not** use `@actions/core`: a composite action has no
bundling step, so that dependency would have to be vendored — reintroducing
the exact cost this shape was chosen to avoid. The three toolkit facilities
actually needed are each a few lines of string handling against a documented
protocol: workflow-command annotations on stdout, appending Markdown to
`$GITHUB_STEP_SUMMARY`, and appending `key=value` to `$GITHUB_OUTPUT`.

The Action deliberately does not re-implement any checking. It shells out to
the CLI and then does the three things a CI surface can do that a terminal
cannot: annotate the exact context-file line that made a false claim so the
failure lands in the pull request diff, write a job summary, and expose the
counts as step outputs.

`action.yml`'s `version` input pins which published CLI version is installed,
defaulting to the version released alongside that ref. Consumers who want to
track the registry can pass `latest`, but pinning is the default, because a
CI gate that changes behaviour without a commit is not a gate.

## Consequences

- **No second build artifact.** There is no committed bundle, no
  `dist/`-drift class of bug, and no rebuild step in the release. Editing
  `action/run.mjs` is the whole change.
- **The Action's version and the CLI's version must move together.** The
  `version` input default in `action.yml` names a version that must already
  exist on npm when the release is tagged. Releasing an Action ref that
  points at an unpublished version breaks it for every consumer on the first
  run — so the release order is npm first, tag second. This is a real
  sharp edge introduced by this decision; the release-process page and
  CLAUDE.md both name it.
- **Cold-start cost.** Each run pays an `npx` install of a small
  dependency-light package rather than executing a pre-bundled file. On the
  order of seconds, against a check that is otherwise near-instant.
- **A network dependency at run time.** If npm is unreachable the check
  fails to run rather than reporting drift. Consumers who cannot accept that
  can install the CLI as a dev dependency and point the Action's `cli-path`
  input at it, or skip the Action and run `groundtruth check` as a plain
  step — the CLI is the product, and the Action is a convenience over it.
- **Runner assumptions.** Node and npm must be on the runner. True of all
  GitHub-hosted runners; self-hosted runners may need `actions/setup-node`
  first. The Action does not install Node itself, because silently mutating
  the toolchain of the job that calls you is worse than a documented
  requirement.
- **Marketplace publication stays manual.** A Marketplace listing is created
  by ticking a box on a GitHub release; there is no API for it. That is
  GitHub's constraint rather than this decision's, but it lands in the same
  place: releases here are deliberate human acts, like the npm publish.

## Alternatives considered

- **A bundled JavaScript action.** Rejected: it buys a few seconds of
  cold-start in exchange for a committed build artifact, a bundler, and a
  standing risk that the committed bundle no longer matches the source. The
  package is already published; bundling it again is duplicated
  distribution.
- **A separate `groundtruth-action` repo.** Rejected: it splits the version
  story across two repos and two release rituals for one product, and the
  Action's own self-test would then live away from the code it tests. Keeping
  it here lets CI run the Action against the working tree it was built from
  (the `self-check` job in `ci.yml`), which is the strongest available proof it
  works before it ships.
- **Re-implementing the checks inside the Action.** Never seriously
  considered, and named here only to be explicit: two implementations of the
  same check is precisely the drift this project exists to catch.

## References

- [`action.yml`](../../action.yml), [`action/run.mjs`](../../action/run.mjs)
- The `self-check` job in [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)
- [Release process](https://groundtruth.sh/project/release-process) — the
  npm-before-tag ordering this ADR requires
- GitHub docs: [Creating a composite action](https://docs.github.com/en/actions/creating-actions/creating-a-composite-action),
  [Workflow commands](https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions)
