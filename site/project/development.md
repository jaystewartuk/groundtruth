# Development

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

`test/fixtures/sample-repo` is a fixture tree modeling the real
AgendaProfe drift findings described on the [home page](/) — it's the
ground truth (no pun avoidable) for what groundtruth's own tests assert
against. Read `test/assertions.test.ts` and `test/cli.test.ts` before
changing checker behavior or CLI flags; they're the executable spec.

## Local iteration against another repo

```bash
cd groundtruth && pnpm build && pnpm link --global
cd your-project && groundtruth check   # runs your local working copy
```

## Continuous integration

Every push and pull request runs
[`.github/workflows/ci.yml`](https://github.com/jaystewart-dev/groundtruth/blob/main/.github/workflows/ci.yml):
typecheck, then test. This documentation site has its own separate deploy
workflow — see [Release process](/project/release-process).

## Adding an assertion kind

1. Add the kind string to `ASSERTION_KINDS` in `src/types.ts` and its
   `ArgsFor<K>` mapping.
2. Add `src/assertions/<kind-with-dashes>.ts` exporting a single
   `check<PascalCaseKind>(repoRoot, args)` function returning
   `{ status, detail }`.
3. Register it in `REGISTRY` in `src/assertions/index.ts` — the
   `Record<Assertion["kind"], Checker>` type makes a missing entry a
   compile error, not a runtime gap. See
   [Architecture → Extension point](/architecture/overview#extension-point-assertion-kinds).
4. Add fixture coverage under `test/fixtures/sample-repo` and a case in
   `test/assertions.test.ts`.
5. Document the kind's `args` shape in
   [Assertion kinds](/reference/assertion-kinds) and the root README's
   kind table — those are the single sources of truth for kind
   semantics; don't duplicate them a third time.

## Naming conventions

- Assertion kind names: `snake_case` (`env_var_absent`) — data-layer
  identifiers that appear verbatim in `.groundtruth.jsonc`, not code
  identifiers.
- Checker function names: `check` + PascalCase kind (`checkEnvVarAbsent`).
- Checker files: kebab-case matching the kind (`env-var-absent.ts`).
- Every `Assertion` carries a `source: "<file>#L<line>"` — always
  populate it; it's the entire point of traceability.

## Where to look first

New to the codebase: read [Architecture overview](/architecture/overview),
then `src/cli.ts` — the whole request path is under 100 lines and reads
top to bottom.
