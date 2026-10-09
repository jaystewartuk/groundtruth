---
description: "Short answers on LLM extraction, network access, unverifiable claims, re-exported symbols, stale source pointers, npm packaging, and API stability."
---

# FAQ

### Does groundtruth read my `CLAUDE.md` and figure out the assertions itself?

Not yet. `src/discover.ts` finds which context files exist and shows them
in the report header, but assertions are hand-authored in
`.groundtruth.jsonc` today. LLM-based extraction is the next roadmap item
— see [ADR-0001](/architecture/decisions#adr-0001-hand-authored-assertions-before-llm-extraction)
for why it shipped in this order.

### Does this need an API key or make network calls?

No. `groundtruth check` is entirely mechanical — it reads local files and
exits. No network access, no LLM calls, nothing to configure beyond the
`.groundtruth.jsonc` file itself.

### What happens to a claim groundtruth can't check?

It's reported as `unverifiable`. That status is always printed and never
fails your build — see
[ADR-0002](/architecture/decisions#adr-0002-unverifiable-assertions-never-fail-but-always-report)
for why silently dropping or silently passing it were both rejected.

### Can groundtruth catch two files contradicting each other?

Not yet — that's layer 2 of the roadmap
([ADR-0004](/architecture/decisions#adr-0004-three-layer-roadmap)),
unbuilt. Today's checks are per-assertion, not cross-file.

### Will `symbol_at_path` find a re-exported symbol?

No — it's a regex match on `export function/const/class/interface/type/enum`
declarations, not an AST parse, and reports `failing` (not a false
`passing`) for `export { X } from "./y"`-style re-exports. See
[Assertion kinds](/reference/assertion-kinds#symbol-at-path) and
[ADR-0003](/architecture/decisions#adr-0003-regex-based-symbol-matching-for-mvp).

### Can I check something that isn't one of the seven kinds?

Not without writing a checker for it — see
[Development → Adding an assertion kind](/project/development#adding-an-assertion-kind).
There's no plugin system; every kind lives in `src/assertions/`.

### What if my `source` line numbers go stale?

`groundtruth check` tells you, and says where the sentence moved to. A
citation is a claim about the repo like any other — insert a paragraph
into `CLAUDE.md` and every line number below it shifts while the
assertions keep passing against the wrong sentence. It is reported as a
warning rather than a failure, because a stale citation is a bug in your
assertions file, not drift in the repo it describes; `--strict-sources`
makes it fail. See [CLI reference → Source pointers](/reference/cli#source-pointers).

### Is groundtruth on npm?

Not at the moment. `@groundtruth-sh/cli` returns 404 on the npm registry, so
install from GitHub: `npm install -D github:jaystewartuk/groundtruth` (or run
`npx github:jaystewartuk/groundtruth check`). The command it installs is plain
`groundtruth`. See [Getting started](/guide/getting-started#_1-install) and the
[release process](/project/release-process).

### Is the programmatic API (`import { ... } from "@groundtruth-sh/cli"`) stable?

No stability guarantee yet. It mirrors internal module boundaries rather
than a designed public surface — see
[CLI reference → Programmatic API](/reference/cli#programmatic-api).
