---
description: "What groundtruth can do today, and the three-layer design ahead: mechanical verification, contradiction detection, and context economics."
---

# Roadmap

Sourced directly from the root
[README's Roadmap section](https://github.com/jaystewart-dev/groundtruth#roadmap)
— the single source of truth for planned work. This page restates it with
explicit current-vs-planned labeling; update the README first, this page
second.

Development is currently **paused at layer 1**: the CLI and the Action are
maintained — breakage gets fixed, releases stay installable — and everything
labeled planned below is direction, not a schedule.

::: tip No issue tracker yet
This project doesn't yet use GitHub Issues or Milestones to track work —
there are none open at the time of writing. Everything below comes from
the maintainer's own stated plan, not an issue backlog. If that changes,
this page should start linking to real issues instead of restating prose.
:::

## Current capabilities

- ✅ `groundtruth check` — hand-authored `.groundtruth.jsonc` assertions,
  verified against a repo, worst-first table or `--json` output, CI-ready
  exit codes.
- ✅ Six assertion kinds: `path_exists`, `path_absent`, `env_var_absent`,
  `script_exists`, `workflow_trigger`, `symbol_at_path`.
- ✅ Fail-closed handling of unverifiable claims (see
  [ADR-0002](/architecture/decisions#adr-0002-unverifiable-assertions-never-fail-but-always-report)).
- ✅ A [GitHub Action](/guide/github-action) *(shipped in 0.2.0)* — the same check on
  every pull request, with inline annotations on the exact context-file
  line that made a false claim, a job summary, and step outputs.

## Planned — three-layer design

groundtruth's stated design has three layers; only the first has any code
today. See [ADR-0004](/architecture/decisions#adr-0004-three-layer-roadmap)
for the full reasoning.

1. **Extract & verify** *(this is what exists — partially)* — LLM-based
   extraction straight from `CLAUDE.md`/`AGENTS.md` is the next piece:
   turning prose claims into `.groundtruth.jsonc` assertions
   automatically, instead of by hand.
2. **Contradiction detection** — cross-check every context file against
   every other (and against a decision log, if one exists) for direct
   contradictions, not just individually-false claims.
3. **Context economics** — instrument agent sessions (a Claude Code
   `SessionStart` hook is the identified delivery mechanism) to report
   which rules are ever actually cited, so a growing context file can be
   pruned with evidence instead of guesswork.

## Also planned, not yet started

- A `--inject`-style mode for a session-start hook, so an agent starts
  every session already told which of its own instructions are currently
  false.

## Not planned

Nothing has been explicitly ruled out yet — this section will grow once
a request is deliberately declined, with the reasoning kept here rather
than lost in an issue thread.
