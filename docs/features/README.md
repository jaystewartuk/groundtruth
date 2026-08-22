# Features

> **Summary:** Three user-facing capabilities exist today: the `check`
> command, the eviction workflow (`evict` + `digest`), and the GitHub
> Action that runs `check` on a pull request.

- [`check-command.md`](check-command.md) — `groundtruth check`,
  groundtruth's core command.
- [`evict-command.md`](evict-command.md) — `groundtruth evict` (and its
  authoring helper `groundtruth digest`): sweep a retired fact, enforce
  its non-recurrence.
- [`github-action.md`](github-action.md) — the Action that runs `check`
  in CI and reports into the pull request diff.

One doc per feature, added as features ship. Do not add a doc for a
roadmap item before it exists — see the root
[README § Roadmap](../../README.md#roadmap) for what's planned.
