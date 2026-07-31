# Feature: the GitHub Action

> **Summary:** Runs `groundtruth check` on a pull request, annotates the
> exact context-file line behind each false claim, writes a job summary,
> and exposes the counts as step outputs. Defined by `action.yml` at the
> repo root and `action/run.mjs`.

## Purpose

Move the check from a laptop to the pull request. The CLI already exits
non-zero on drift, so any CI system can gate on it — the Action exists to
make the *report* land where the decision is made, on the line of the
context file that made the claim, rather than in a log a reviewer has to
go looking for.

## User value

A failing assertion in a job log tells you something drifted. An inline
annotation on `CLAUDE.md` line 8 tells the reviewer which sentence is now
a lie, in the same view where they are deciding whether to merge. Passing
assertions annotate nothing, so a green run stays silent.

## Architecture

A composite action: no bundle, no container, no second implementation of
any check. `action/run.mjs` shells out to the published CLI with `--json`
and translates the report into GitHub's three surfaces — workflow-command
annotations on stdout, Markdown appended to `$GITHUB_STEP_SUMMARY`, and
`key=value` pairs appended to `$GITHUB_OUTPUT`. It imports nothing outside
the Node standard library, `@actions/core` included. Why:
[ADR-0005](../adr/0005-composite-action-wrapping-the-published-cli.md).

## Important files

- `action.yml` — the Action definition: inputs, outputs, branding. Must
  stay at the repo root; GitHub only accepts a Marketplace listing from
  there.
- `action/run.mjs` — the runner. Pure functions (source parsing,
  annotation and summary rendering, exit-code policy) are exported for
  `test/action.test.ts` to exercise directly.
- `.groundtruth.jsonc` — this repo's own assertions, drawn from its own
  `CLAUDE.md`.
- The `self-check` job in `.github/workflows/ci.yml` — runs the Action
  from the working tree against the CLI built from the same commit.

## Inputs, outputs, and recipes

Documented once, on the site:
[groundtruth.sh/guide/github-action](https://groundtruth.sh/guide/github-action).
Not restated here — `action.yml` is the machine-readable source, and every
input carries its own `description` there.

## Known limitations

- The `version` input's default and `package.json`'s `version` are two
  halves of one number and must be bumped together; nothing enforces it
  mechanically, because the self-check runs the local build rather than
  the published package. Called out in the
  [release process](https://groundtruth.sh/project/release-process).
- Needs Node and npm on the runner, and reachable npm at run time. All
  GitHub-hosted runners qualify; self-hosted ones may need
  `actions/setup-node` first.
- Publishing to the Marketplace is a checkbox on a GitHub release with no
  API behind it, so releases stay a deliberate human act.

## Future improvements

Tracked centrally in the root
[README § Roadmap](../../README.md#roadmap) — not restated here, to keep
this single-sourced.
