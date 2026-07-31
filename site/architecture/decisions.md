# Architecture decisions

The full Architecture Decision Records live in
[`docs/adr/`](https://github.com/jaystewart-dev/groundtruth/tree/main/docs/adr)
in the repository — this page is a summary for site readers, with a
permalink per decision for cross-linking from the rest of the docs. Read
the linked ADR for the complete context, consequences, and alternatives
considered.

## ADR-0001: Hand-authored assertions before LLM extraction {#adr-0001-hand-authored-assertions-before-llm-extraction}

**Decision:** Ship the assertion format and checker first, with
assertions hand-authored in `.groundtruth.jsonc`, and defer LLM-based
extraction from `CLAUDE.md`/`AGENTS.md` to a later milestone.
`src/discover.ts` already locates candidate context files, but only for
display — it doesn't drive what gets checked yet.

**Why:** Building extraction first would have coupled the very first
release to LLM API access and prompt-engineering risk, before the
checker/report core — which needs neither — was proven out. The
hand-authored schema was deliberately designed to be the exact shape
extraction will need to produce, so today's work isn't throwaway.

[Full ADR →](https://github.com/jaystewart-dev/groundtruth/blob/main/docs/adr/0001-hand-authored-assertions-before-llm-extraction.md)

## ADR-0002: Unverifiable assertions never fail, but are always reported {#adr-0002-unverifiable-assertions-never-fail-but-always-report}

**Decision:** A `check` run never exits non-zero because of an
`unverifiable` result, but every `unverifiable` result is always printed
— it can never be silently dropped or counted as passing.

**Why:** The two alternatives were both worse. Treating unverifiable as
failing would break every CI pipeline the moment a claim needs a check
kind that doesn't exist yet. Treating it as passing — silently — is
exactly the "context that lies gets executed" failure mode groundtruth
exists to catch, just moved up one layer.

[Full ADR →](https://github.com/jaystewart-dev/groundtruth/blob/main/docs/adr/0002-unverifiable-assertions-never-fail-but-always-report.md)

## ADR-0003: Regex-based symbol matching for `symbol_at_path` {#adr-0003-regex-based-symbol-matching-for-mvp}

**Decision:** `symbol_at_path` matches exports with a regular expression,
not a full TypeScript/JS AST parse. It correctly reports `failing` (not a
false `passing`) for a symbol only reachable via re-export.

**Why:** Avoids a parser dependency before the core check/report loop was
proven out. Because every kind's checker sits behind the same swappable
`Checker` type, replacing the regex with a real parser later is a
contained, single-file change — not a rewrite.

[Full ADR →](https://github.com/jaystewart-dev/groundtruth/blob/main/docs/adr/0003-regex-based-symbol-matching-for-mvp.md)

## ADR-0004: Three-layer product design {#adr-0004-three-layer-roadmap}

**Status:** Proposed — layer 1 partially built, layers 2 and 3 not
started. Treat this as documented intent, not a shipped design.

**Decision:** Structure the product as three layers: (1) extract claims
and verify them mechanically — the only layer with any code today; (2)
detect direct contradictions between context files, which needs LLM
judgment rather than a mechanical checker; (3) instrument real agent
sessions to see which rules actually get cited, so a context file can be
pruned with evidence instead of a guess.

**Why:** Layer 1 needed no LLM at all and is independently useful today
— bundling all three into one release would have blocked shipping
anything on the hardest, most judgment-dependent layer.

[Full ADR →](https://github.com/jaystewart-dev/groundtruth/blob/main/docs/adr/0004-three-layer-roadmap.md) ·
[Roadmap](/project/roadmap)

## ADR-0005: The GitHub Action is a composite wrapper around the published CLI {#adr-0005-the-github-action-is-a-composite-wrapper-around-the-published-cli}

**Decision:** Ship the [GitHub Action](/guide/github-action) as a
*composite* action — `action.yml` at the repo root plus a
dependency-free Node runner — that installs the published
`@groundtruth-sh/cli` to a temp prefix and shells out to it. Not a bundled
JavaScript action, not a Docker action, and not a second implementation of
the checks. The runner deliberately avoids `@actions/core` too: with no
bundling step, that dependency would have to be vendored into the repo.

**Why:** The repo already publishes the thing the Action needs to run, and
every GitHub-hosted runner already has Node and npm — so there is nothing
to bundle that isn't already distributed. A bundled action would buy a few
seconds of cold start in exchange for a committed build artifact that can
silently drift from its own source, which is a strange bargain for a tool
whose whole subject is drift.

**The cost, stated plainly:** the Action's default `version` input names a
CLI version that must already exist on npm when the ref is tagged, so
releases must publish to npm *before* tagging. There is also a network
dependency at run time — if npm is unreachable, the check fails to run
rather than reporting drift.

[Full ADR →](https://github.com/jaystewart-dev/groundtruth/blob/main/docs/adr/0005-composite-action-wrapping-the-published-cli.md) ·
[Release process](/project/release-process)
