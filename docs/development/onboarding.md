# Onboarding

> **Summary:** `pnpm install`, `pnpm build`, `pnpm test`. Node ≥20, pnpm
> workspace, TypeScript compiled with `tsc` (no bundler).

## Setup

```bash
pnpm install
pnpm build      # tsc -> dist/
```

## Day-to-day commands

```bash
pnpm dev        # tsc --watch
pnpm test       # pretest runs tsc, then vitest against test/fixtures/sample-repo
pnpm test:watch
pnpm typecheck  # tsc --noEmit, no output
```

`test/fixtures/sample-repo` is a fixture tree modeling the real AgendaProfe
drift findings described in the root README — it's the ground truth for
what `groundtruth check`'s own tests assert against. Read
`test/assertions.test.ts` and `test/cli.test.ts` before adding a new
assertion kind or CLI flag; they're the executable spec.

## Local iteration against another repo

```bash
cd groundtruth && pnpm build && pnpm link --global
cd your-project && groundtruth check   # runs your local working copy
```

## Where to look first

New to the codebase: read
[`architecture/overview.md`](../architecture/overview.md), then
`src/cli.ts` (the whole request path is ~90 lines and reads top to
bottom). Adding an assertion kind: read
[`conventions.md`](conventions.md) and
[ADR-0003](../adr/0003-regex-based-symbol-matching-for-mvp.md) first.
