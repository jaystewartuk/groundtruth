# Conventions

> **Summary:** File-per-checker for assertion kinds, `snake_case` kind
> names (data-facing), `camelCase` everywhere else (code-facing). Docs use
> `kebab-case.md`. See [`docs/README.md`](../README.md#naming-conventions)
> for documentation naming — this file covers source code only.

## Adding a new assertion kind

1. Add the kind string to `ASSERTION_KINDS` in `src/types.ts` and its
   `ArgsFor<K>` mapping.
2. Add `src/assertions/<kind-with-dashes>.ts` exporting a single
   `check<PascalCaseKind>(repoRoot, args)` function returning
   `{ status, detail }`. A checker that needs run-level context (today:
   the assertions-file path, so `text_absent` can exclude it from its
   scan) takes an optional third `CheckContext` parameter — and must
   still behave sensibly without it.
3. Register it in `REGISTRY` in `src/assertions/index.ts` — the
   `Record<Assertion["kind"], Checker>` type makes a missing entry a
   compile error, not a runtime gap (see
   [`architecture/overview.md`](../architecture/overview.md#extension-point-assertion-kinds)).
4. Add fixture coverage under `test/fixtures/sample-repo` and a case in
   `test/assertions.test.ts`.
5. Document the kind's `args` shape in the root
   [README's kind table](../../README.md#assertion-kinds) — that table is
   the single source of truth for kind semantics; don't duplicate it in a
   second doc.

## Naming

- Assertion kind names: `snake_case` (`env_var_absent`) — they're
  data-layer identifiers that appear verbatim in `.groundtruth.jsonc`
  files, not code identifiers.
- Checker function names: `check` + PascalCase kind (`checkEnvVarAbsent`).
- Checker files: kebab-case matching the kind with underscores replaced by
  dashes (`env-var-absent.ts`).
- Every `Assertion` carries a `source: "<file>#L<line>"` string — always
  populate it; it's what lets a failure trace back to the exact sentence
  that made the claim, which is the whole point of the tool.

## What doesn't get a convention doc yet

Versioning policy isn't written down beyond plain semver — still a
single-maintainer project. The release process is documented on the site
([Release process](https://groundtruth.sh/project/release-process)) and
contributor expectations in the root
[CONTRIBUTING.md](../../CONTRIBUTING.md), both written around the first
npm release (0.1.0, 2026-07-31). Write a fuller versioning policy when a
second regular contributor makes one necessary, not before.
