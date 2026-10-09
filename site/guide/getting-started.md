---
description: "Install @groundtruth-sh/cli, write your first assertion, and run groundtruth check — five minutes from install to a verified CLAUDE.md claim."
---

# Getting started

Five minutes, start to finish: install, write one assertion, run the
check, read the report.

## 1. Install

::: warning Not on the npm registry at the moment
`@groundtruth-sh/cli` returns 404 on npm, so `npm install @groundtruth-sh/cli`
fails. Install from GitHub instead.
:::

```bash
npm install -D github:jaystewartuk/groundtruth
```

Or run it without adding a dependency: `npx github:jaystewartuk/groundtruth check`.

The package builds itself on install, so the first install takes a few
seconds longer. Use `npm` or `npx`: pnpm 10+ blocks a git dependency's build
script unless you allow it with `allowBuilds` in `pnpm-workspace.yaml`. The
command it installs is plain `groundtruth`.

Iterating on groundtruth itself instead of consuming it? Link your local
checkout so `groundtruth check` runs your working copy:

```bash
cd groundtruth && pnpm build && pnpm link --global
cd your-project && groundtruth check
```

## 2. Create your assertions file

Copy the shipped example and edit it to match the claims your own
`CLAUDE.md`/`AGENTS.md` actually makes:

```bash
cp node_modules/@groundtruth-sh/cli/.groundtruth.jsonc.example .groundtruth.jsonc
```

A minimal `.groundtruth.jsonc` — one assertion, checking that a script
your `CLAUDE.md` claims exists still does:

```jsonc
{
  "assertions": [
    {
      "claim": "`pnpm verify:push` runs typecheck + unit.",
      "kind": "script_exists",
      "args": { "name": "verify:push" },
      "source": "CLAUDE.md#L9"
    }
  ]
}
```

Every field is required. See [Configuration](/guide/configuration) for
what each one means and [Assertion kinds](/reference/assertion-kinds) for
the full set of checks available — six today.

## 3. Run it

```bash
groundtruth check
```

## 4. Read the report

```
Context layer: CLAUDE.md
1 assertion(s) — 1 passing, 0 failing, 0 unverifiable

✓ CLAUDE.md#L9  "`pnpm verify:push` runs typecheck + unit."
  scripts.verify:push = "pnpm typecheck && pnpm test"
```

Exit code is `1` if anything is `failing`, `0` otherwise — wire it into CI
the same way you'd wire in a type check. `unverifiable` results are always
printed and never fail the run; see
[why](/architecture/decisions#adr-0002-unverifiable-assertions-never-fail-but-always-report).

## What's next

- Walk a realistic multi-assertion example, modeled on a real production
  audit: [End-to-end example](/guide/example)
- See every CLI flag: [CLI reference](/reference/cli)
- Understand the current MVP boundary — what's hand-authored vs.
  automated — before you invest heavily in writing assertions:
  [ADR-0001](/architecture/decisions#adr-0001-hand-authored-assertions-before-llm-extraction)
