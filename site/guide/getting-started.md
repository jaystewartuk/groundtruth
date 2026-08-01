# Getting started

Five minutes, start to finish: install, write one assertion, run the
check, read the report.

## 1. Install

```bash
pnpm add -D @groundtruth-sh/cli   # or: npm install -D @groundtruth-sh/cli
```

Or run it without adding a dependency: `pnpm dlx @groundtruth-sh/cli check`
(`npx @groundtruth-sh/cli check` works too). The published package is
[`@groundtruth-sh/cli`](https://www.npmjs.com/package/@groundtruth-sh/cli) —
scoped because npm's name-similarity rule reserves unscoped `groundtruth` —
but the command it installs is plain `groundtruth`.

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
