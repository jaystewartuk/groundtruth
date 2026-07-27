# groundtruth documentation

> **Summary:** groundtruth is a CLI that turns claims in `CLAUDE.md`/`AGENTS.md`
> into checkable assertions and verifies them against the actual repo. This
> tree is the documentation system for the project itself — organized so a
> human, a new contributor, or an AI agent can find the right fact in one
> hop, and so it doesn't rot the way it exists to catch other projects rotting.

## How to use this tree

Start at [`architecture/overview.md`](architecture/overview.md) for how the
system fits together, or [`features/`](features/) for what it does. Every
document links to what it depends on and what depends on it — follow links
rather than searching, and prefer the shortest doc that answers your
question over the biggest one.

If you're listening rather than reading (e.g. via Speechify), use
[`docs-listen/`](../docs-listen/) instead — a rewritten, narrated parallel
edition of the documents that most benefit from it. It is not a copy; read
`docs-listen/README.md` for how the two trees relate.

## Folder taxonomy

| Folder | Purpose | Status |
|---|---|---|
| [`architecture/`](architecture/) | How the system is built: components, flow, boundaries | active |
| [`adr/`](adr/) | Architecture Decision Records — why, not just what | active |
| [`features/`](features/) | One doc per user-facing capability | active |
| [`development/`](development/) | Setup, workflow, naming conventions | active |
| [`glossary/`](glossary/) | Shared vocabulary, defined once | active |
| `infrastructure/` | Deploy targets, hosting, provisioning | **reserved** — groundtruth is a local CLI with no deployed service; create this folder when one exists, not before |
| `operations/` | Runbooks, on-call, incident process | **reserved** — no production system to operate yet |
| `security/` | Threat model, vuln handling, secrets policy | **reserved** — create when the project has a security surface beyond "don't merge vulnerable deps" (tracked in `development/conventions.md` for now) |
| `product/` | Roadmap, positioning, investor-facing material | **reserved** — the README's Roadmap section is the current source of truth; split out here if it outgrows a section |
| `api/` | Generated reference for a library/HTTP surface | **reserved** — groundtruth's only public surface is the `check` CLI command, documented in `features/check-command.md`; create this if `src/index.ts`'s programmatic exports grow a real consumer base |
| `onboarding/` | New-hire ramp material beyond dev setup | **reserved** — folded into `development/onboarding.md` until there's a team, not just a maintainer |
| `runbooks/` | Step-by-step operational procedures | **reserved** — nothing to run yet |

Reserved folders are listed deliberately, not omitted, so the next person
(human or agent) who needs one knows where it goes instead of inventing a
new top-level convention. **Do not pre-populate a reserved folder with
placeholder content** — an empty folder that doesn't exist yet is honest;
a folder with a stub doc implies coverage that isn't there.

## Principles this tree follows

1. **Single source of truth.** A fact lives in exactly one document. Other
   documents link to it instead of restating it.
2. **Generated over written.** If a fact can be read off the code (a CLI
   flag, an assertion kind, a script name), the doc says "see `<file>`"
   rather than copying it — copies drift, references don't.
3. **Small and focused.** One doc, one purpose, stated in its first line.
   A doc that's trying to answer two questions should be two docs.
4. **Decisions get an ADR, not a paragraph buried in a README.** Anything
   that took a real tradeoff gets a record in [`adr/`](adr/) so the
   reasoning survives past whoever made the call.
5. **No speculative documentation.** Nothing here describes a feature,
   folder, or system that doesn't exist yet. The Roadmap in the root
   [`README.md`](../README.md) is where "not built yet" lives.

## Naming conventions

- Files: `kebab-case.md`, no dates in filenames (git history has dates).
- ADRs: `NNNN-kebab-case-title.md`, zero-padded to 4 digits, numbered
  sequentially and never renumbered or reused even if superseded.
- Feature docs: named after the user-facing capability, not the source
  file (`check-command.md`, not `cli-ts.md`).
- Every folder has a `README.md` that is its index — link to specific docs
  from there rather than making the reader guess a filename.
