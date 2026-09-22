# CLAUDE.md (fixture)

This is a minimal stand-in for a real agent-context file, used only so
`discoverContextFiles` has something to find in tests. It is not parsed for
assertions in the MVP — assertions live in .groundtruth.jsonc.

- Do NOT reintroduce a Supabase/Vercel code path or env var.
- The Supabase project is torn down; do not add an MCP server for it.
- `pnpm verify:push` runs typecheck + unit.
- `entitlementsFor()` in `src/lib/subscriptions/entitlements.ts` is the
  single place tier logic is decided.
- `checks.yml` runs on every pull request into `main`.
