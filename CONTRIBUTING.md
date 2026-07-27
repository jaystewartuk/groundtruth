# Contributing to groundtruth

groundtruth is a young, single-maintainer project — there's no formal
process yet beyond what's below. If something here is unclear, open an
issue rather than guessing.

## Before you start

For anything beyond a small fix, open an issue first describing what
you're planning. This project is deliberately narrow in scope right now
(one command, six assertion kinds, no plugin system) — see the
[roadmap](https://jaystewart-dev.github.io/groundtruth/project/roadmap)
for what's actually planned, so you don't spend time on something that
doesn't fit the current direction.

## Setup

```bash
pnpm install
pnpm build
pnpm test
```

Full walkthrough: [Development guide](https://jaystewart-dev.github.io/groundtruth/project/development).

## Making a change

1. `pnpm typecheck` and `pnpm test` must both pass. `pnpm test` builds
   first (`pretest`), so a fresh `pnpm test` alone is enough.
2. Adding an assertion kind follows a fixed 5-step checklist — see
   [Development → Adding an assertion kind](https://jaystewart-dev.github.io/groundtruth/project/development#adding-an-assertion-kind).
   Skipping the registry step is a compile error, not a runtime surprise.
3. Add fixture coverage under `test/fixtures/sample-repo` for anything
   that touches a checker.
4. If your change is a real architectural tradeoff (not just an
   implementation detail), add an ADR under `docs/adr/` — see
   [`docs/adr/README.md`](docs/adr/README.md) for the format and when one
   is warranted.
5. Update the root `README.md`'s kind table or Roadmap section if your
   change affects either — they're the single source of truth other docs
   link back to instead of repeating.

## Commit and PR expectations

Small, focused commits. Explain *why*, not just *what*, in the commit
message and PR description — the same standard this repo's own ADRs and
`report.ts` comments hold themselves to.

## Code of conduct

There isn't a formal one yet. In the meantime: be direct, be respectful,
assume good faith. If a real need for a formal code of conduct comes up,
it'll be added here rather than left implicit.

## Reporting a bug or requesting a feature

Use the issue templates on
[GitHub](https://github.com/jaystewart-dev/groundtruth/issues/new/choose).
