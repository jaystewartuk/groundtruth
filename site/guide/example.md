---
description: "A full worked example: a repo whose CLAUDE.md makes five claims, two already false — and the exact report groundtruth check produces before and after the fix."
---

# End-to-end example

This is the exact scenario groundtruth's own test suite runs against —
[`test/fixtures/sample-repo`](https://github.com/jaystewart-dev/groundtruth/tree/main/test/fixtures/sample-repo)
in the repo — modeled directly on the real AgendaProfe audit findings
described on the [home page](/). It's a small repo whose `CLAUDE.md` makes
five claims, two of which are already false. Every command and output
block below is copied verbatim from actually running `groundtruth check`
against that fixture — nothing here is hand-simulated.

## The repo

```
sample-repo/
├── CLAUDE.md
├── .groundtruth.jsonc
├── package.json
├── turbo.json
├── .mcp.json
├── .github/workflows/checks.yml
└── apps/web/src/lib/subscriptions/entitlements.ts
```

`CLAUDE.md` claims:

```
- Do NOT reintroduce a Supabase/Vercel code path or env var.
- The Supabase project is torn down; do not add an MCP server for it.
- `pnpm verify:push` runs typecheck + unit.
- `entitlementsFor()` in `src/lib/subscriptions/entitlements.ts` is the
  single place tier logic is decided.
- `checks.yml` runs on every pull request into `main`.
```

But `turbo.json`'s `globalEnv` still lists five decommissioned-vendor
variables (`VERCEL_ENV`, `VERCEL_GIT_COMMIT_REF`, `SUPABASE_URL`,
`SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`), and a `.mcp.json` for a
Supabase MCP server still sits in the repo root. Two of the five claims
above are already false — and nothing in a normal
`tsc`/`test`/`lint` pipeline would notice, because none of those touch
env-var declarations or leftover config files.

## The assertions

`.groundtruth.jsonc` atomizes the "no Supabase/Vercel env var" claim into
one assertion per variable (five), plus one each for the MCP server, the
script, the symbol, and the workflow trigger — nine total. Full file:
[`.groundtruth.jsonc`](https://github.com/jaystewart-dev/groundtruth/blob/main/test/fixtures/sample-repo/.groundtruth.jsonc).

```jsonc
{
  "claim": "Do NOT reintroduce a Supabase/Vercel code path or env var.",
  "kind": "env_var_absent",
  "args": { "name": "SUPABASE_URL" },
  "source": "CLAUDE.md#L7"
}
// ...four more env_var_absent entries, one per variable...
```

## Running it

```bash
groundtruth check --repo test/fixtures/sample-repo
```

```
Context layer: CLAUDE.md
9 assertion(s) — 3 passing, 6 failing, 0 unverifiable

✗ CLAUDE.md#L7  "Do NOT reintroduce a Supabase/Vercel code path or env var."
  VERCEL_ENV found in turbo.json
✗ CLAUDE.md#L7  "Do NOT reintroduce a Supabase/Vercel code path or env var."
  VERCEL_GIT_COMMIT_REF found in turbo.json
✗ CLAUDE.md#L7  "Do NOT reintroduce a Supabase/Vercel code path or env var."
  SUPABASE_URL found in turbo.json
✗ CLAUDE.md#L7  "Do NOT reintroduce a Supabase/Vercel code path or env var."
  SUPABASE_ANON_KEY found in turbo.json
✗ CLAUDE.md#L7  "Do NOT reintroduce a Supabase/Vercel code path or env var."
  SUPABASE_SERVICE_ROLE_KEY found in turbo.json
✗ CLAUDE.md#L8  "The Supabase project is torn down; do not add an MCP server for it."
  .mcp.json exists but should not
✓ CLAUDE.md#L9  "`pnpm verify:push` runs typecheck + unit."
  scripts.verify:push = "pnpm typecheck && pnpm test"
✓ CLAUDE.md#L10-11  "`entitlementsFor()` in `src/lib/subscriptions/entitlements.ts` is the single place tier logic is decided."
  entitlementsFor is exported from apps/web/src/lib/subscriptions/entitlements.ts
✓ CLAUDE.md#L12  "`checks.yml` runs on every pull request into `main`."
  checks.yml triggers on 'pull_request' (branch 'main')
```

Exit code: `1`. In CI, this blocks the merge — the same way a failing
type check would — until either the code changes to match the claim, or
the claim in `CLAUDE.md` is updated to match reality.

## Fixing it

Remove the five stale variables from `turbo.json`'s `globalEnv` and
delete `.mcp.json`, then re-run:

```
Context layer: CLAUDE.md
9 assertion(s) — 9 passing, 0 failing, 0 unverifiable
```

Exit code `0`. This is the loop groundtruth is for: a claim goes stale,
CI catches it immediately, someone fixes the code or updates the claim —
never both silently drifting apart for months.
