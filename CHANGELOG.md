# Changelog

Notable changes to `@groundtruth-sh/cli` and the groundtruth GitHub Action,
which are versioned and released together.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project is pre-1.0: while the major version is `0`, a minor bump may
carry a breaking change, and the CLI's programmatic exports
(`src/index.ts`) carry no stability guarantee at all.

## [Unreleased]

### Added

- Assertion citations are now checked. Every assertion's `source`
  (`"CLAUDE.md#L42"`) is a claim about the repo like any other, and it rots
  the same way: insert a paragraph and every line number below it shifts
  while the assertions keep passing against the wrong sentence. `groundtruth
  check` now verifies that the cited lines still state the claim, and reports
  where the sentence moved to when they do not. Running it against this
  repository for the first time found 9 of its own 15 citations already
  wrong.
- `--strict-sources` turns those warnings into a non-zero exit. Off by
  default: a stale citation is a bug in your assertions file, not drift in
  the repo it describes, so upgrading never newly breaks a build.
- `--version` / `-v`, which the bug-report template had been asking for
  without anything to answer it.
- `sourceWarnings` in `--json` output, and in the Action's job log and job
  summary.

### Changed

- Unrecognised arguments are now a usage error (exit `2`) instead of being
  silently ignored, and a flag missing its value is too. `--jsonn` used to
  print a table and exit `0` — a green build from a run that never did what
  was asked, which is the exact failure this tool exists to prevent.

### Fixed

- The `version` input and pinned Action refs in `README.md` still said
  `0.2.0` after the 0.2.1 release. CI now checks `package.json`,
  `action.yml`, and `README.md` agree on the version.
- The assertion-kind count read "6" in the README, the shipped example file,
  the FAQ, and the glossary; there have been seven kinds since
  `text_matches_across` landed.

## [0.2.1] — 2026-08-05

### Fixed

- Re-cut of 0.2.0 so the Action could be listed on the GitHub Marketplace.
- The Action installs the CLI explicitly instead of trusting `npx` to
  resolve the bin. `npx @groundtruth-sh/cli@x check` resolves the
  `groundtruth` bin under npm 10 but fails under the npm 11 that ships with
  Node 24 — which is what a default GitHub runner has. See
  [ADR-0005](docs/adr/0005-composite-action-wrapping-the-published-cli.md).

## [0.2.0] — 2026-07-31

### Added

- The groundtruth GitHub Action: a composite action wrapping the published
  CLI, with inline annotations on the context-file line that made each false
  claim, a job summary, and step outputs (`total`, `passing`, `failing`,
  `unverifiable`, `report-path`).
- `text_matches_across`, the first assertion kind about agreement *between*
  files rather than a fact inside one. A missing file fails rather than
  reporting unverifiable, so deleting a surface is never the way to go green
  ([ADR-0006](docs/adr/0006-verbatim-agreement-before-relational-matching.md)).

## [0.1.0] — 2026-07-31

First npm publish, as `@groundtruth-sh/cli` — scoped because npm's
name-similarity rule reserves unscoped `groundtruth` against the unrelated
existing `ground-truth` package. The installed command is plain
`groundtruth`.

### Added

- `groundtruth check`, with `--repo`, `--file`, and `--json`.
- Six assertion kinds: `path_exists`, `path_absent`, `env_var_absent`,
  `script_exists`, `workflow_trigger`, `symbol_at_path`.
- Three-way result status — `passing`, `failing`, `unverifiable` — where
  `unverifiable` is always reported and never fails the run
  ([ADR-0002](docs/adr/0002-unverifiable-assertions-never-fail-but-always-report.md)).
- Hand-authored assertions in `.groundtruth.jsonc`, in exactly the shape
  LLM extraction will need to produce later
  ([ADR-0001](docs/adr/0001-hand-authored-assertions-before-llm-extraction.md)).

[Unreleased]: https://github.com/jaystewartuk/groundtruth/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/jaystewartuk/groundtruth/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/jaystewartuk/groundtruth/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/jaystewartuk/groundtruth/releases/tag/v0.1.0
