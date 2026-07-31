# Architecture Decision Records

> **Summary:** Each ADR below was inferred from the codebase and its README
> commentary as of the initial scaffold commit (`905fe42`), not from a
> separate discussion log — this repo's history starts at one commit. None
> of these are invented; each cites the file/comment it was inferred from.

ADRs are numbered sequentially and never renumbered, even if a later ADR
supersedes an earlier one (mark the old one `Status: Superseded by ADR-000X`
instead). Use [`template.md`](template.md) for new ones.

| ADR | Title | Status |
|---|---|---|
| [0001](0001-hand-authored-assertions-before-llm-extraction.md) | Hand-authored assertions before LLM extraction | Accepted |
| [0002](0002-unverifiable-assertions-never-fail-but-always-report.md) | Unverifiable assertions never fail, but are always reported | Accepted |
| [0003](0003-regex-based-symbol-matching-for-mvp.md) | Regex-based symbol matching for `symbol_at_path` | Accepted |
| [0004](0004-three-layer-roadmap.md) | Three-layer product design: verify, contradict, instrument | Proposed |
| [0005](0005-composite-action-wrapping-the-published-cli.md) | The GitHub Action is a composite wrapper around the published CLI | Accepted |

## When to write one

Write an ADR when a decision trades one real cost for another — not for
every design choice. "We used TypeScript" doesn't need an ADR. "We chose
regex matching over a full AST parse, accepting false negatives on
re-exports, to ship the MVP without a parser dependency" does.
