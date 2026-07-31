# GitHub Action

Drift caught on a laptop is drift caught *after* it merged. The Action runs
`groundtruth check` on every pull request and annotates the exact line of your
context file that made the false claim, so the failure lands in the diff next
to the code that caused it.

## Quick start

```yaml
# .github/workflows/agent-context.yml
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

That is the whole setup. No `setup-node` step and no install step: the Action
fetches the published CLI itself, and every GitHub-hosted runner already has
the Node and npm it needs.

It expects a `.groundtruth.jsonc` at your repo root — see
[Getting started](/guide/getting-started) if you don't have one yet.

::: tip Pin the ref
`@v0.2.0` pins both the Action and, through its default `version` input, the
CLI it installs. A CI gate that changes behaviour without a commit is not a
gate. Use `@main` only if you want to track development.
:::

## What a failing run looks like

Three surfaces, from the most to the least immediate.

**In the diff.** Each failing assertion becomes an inline annotation on the
sentence that made the claim, resolved from the assertion's `source`
(`CLAUDE.md#L8` → `CLAUDE.md`, line 8):

```
✗ CLAUDE.md line 8
  groundtruth: claim is false
  The Supabase project is torn down; do not add an MCP server for it.
  .mcp.json exists but should not
```

Unverifiable assertions annotate too, as warnings rather than errors — they
are reported, never silently passed, and they do not fail the build unless
you set `fail-on-unverifiable`. Passing assertions are not annotated at all: a
green run should add nothing to the diff.

**In the job summary.** The full report as a table — every assertion,
worst-first, with its source, claim and detail.

**In the job log.** The same output the CLI prints in a terminal.

## Inputs

All are optional.

| input | default | meaning |
|---|---|---|
| `version` | the version released alongside the Action ref | Which published `@groundtruth-sh/cli` version to run. `latest` tracks the registry |
| `file` | `.groundtruth.jsonc` | Assertions file, resolved relative to `working-directory` |
| `working-directory` | `.` | Repo root to check against |
| `fail-on-unverifiable` | `false` | Also fail the job when an assertion can't be mechanically checked |
| `annotations` | `true` | Emit inline annotations on the claiming line |
| `summary` | `true` | Write the report to the job summary |
| `cli-path` | *(empty)* | Advanced: path to a local CLI entrypoint to run instead of fetching from npm |

## Outputs

| output | meaning |
|---|---|
| `total` | Assertions checked |
| `passing` / `failing` / `unverifiable` | Counts by status |
| `report-path` | Path to the full JSON report on the runner |

Pair the outputs with `continue-on-error` when you want the numbers without
the gate — useful for the first week of adoption, while you find out how much
your context layer has already drifted:

```yaml
      - uses: jaystewart-dev/groundtruth@v0.2.0
        id: check
        continue-on-error: true
      - run: echo "${{ steps.check.outputs.failing }} claims have gone stale"
```

## Recipes

### A package inside a monorepo

Each package's context file gets its own check, with `working-directory`
pointing at the package root — `file` and every assertion path resolve from
there:

```yaml
      - uses: jaystewart-dev/groundtruth@v0.2.0
        with:
          working-directory: apps/web
```

### Several context layers in one job

Run the Action more than once. Give each step an `id` if you want its counts
separately:

```yaml
      - uses: jaystewart-dev/groundtruth@v0.2.0
        with:
          working-directory: apps/web
      - uses: jaystewart-dev/groundtruth@v0.2.0
        with:
          working-directory: apps/api
```

### Strict mode

Fail when the checker can't verify a claim at all, not just when a claim is
false. Stricter than the default on purpose — an unverifiable assertion often
means the assertion is pointing at a file layout that has moved:

```yaml
      - uses: jaystewart-dev/groundtruth@v0.2.0
        with:
          fail-on-unverifiable: true
```

### Without the Action

The Action is a convenience, not the product. A plain step works too, and
avoids the npm fetch if you already have the CLI as a dev dependency:

```yaml
      - run: pnpm groundtruth check
```

You lose the inline annotations, the job summary and the outputs; you keep
the check and the exit code.

## Exit codes

| code | meaning |
|---|---|
| `0` | No failing assertions |
| `1` | At least one assertion is failing (or unverifiable, with `fail-on-unverifiable`) |
| `2` | The check could not run — usually a missing or malformed assertions file |

Exit `2` is deliberately distinct: a setup failure is not a drift finding, and
dressing one up as the other is the sort of quiet lie this tool exists to
catch.

## How it works

The Action is a **composite** action — `action.yml` at the repo root plus a
dependency-free runner — that shells out to the published CLI. It does not
reimplement any checking; it adds the three things a CI surface can do that a
terminal cannot: annotate, summarise, and expose outputs. The reasoning, and
the costs that choice carries, are in
[ADR-0005](/architecture/decisions#adr-0005-the-github-action-is-a-composite-wrapper-around-the-published-cli).

groundtruth runs this Action on itself. Its own `.groundtruth.jsonc` holds
assertions taken from its own `CLAUDE.md`, and the `self-check` job in
[`ci.yml`](https://github.com/jaystewart-dev/groundtruth/blob/main/.github/workflows/ci.yml)
runs the Action from the working tree against the CLI built from the same
commit — so a pull request that breaks either one says so before it ships.

## Troubleshooting

**`No assertions file at ...`** — the Action exits `2`. Check that
`.groundtruth.jsonc` is committed, and that `working-directory` points at the
directory containing it.

**Annotations don't appear on the diff** — GitHub only renders an annotation
inline when it lands on a file the pull request actually touches. The
annotation is always in the check output regardless. Confirm too that the
assertion's `source` is a real `<file>#L<line>` for a path relative to
`working-directory`.

**A self-hosted runner can't find `npm`** — add `actions/setup-node` before
the Action. It deliberately doesn't install Node itself: silently mutating the
toolchain of the job that called you is worse than a documented requirement.

**npm is unreachable** — the check fails to run rather than reporting drift.
Install the CLI as a dev dependency and use a plain `run:` step if your CI
can't depend on the registry at run time.
