# Implementation spec — content assertions and fact eviction for groundtruth

Handoff document for a Claude Code session working in
`github.com/jaystewart-dev/groundtruth`. It specifies 3 features in
priority order, sized so feature 1 alone is a shippable PR.

**A note on examples:** every example fact in this spec (project codenames,
dates) is synthetic. The motivating incident involved retiring private facts
from a multi-repo context layer, and this spec deliberately does not restate
them — which is itself a demonstration of the design principle in feature 2.
Do not go looking for the original facts; the spec is self-contained.

---

## 1. Why this work exists

groundtruth today verifies claims against **repo structure**: 6 assertion
kinds (`path_exists`, `path_absent`, `env_var_absent`, `script_exists`,
`workflow_trigger`, `symbol_at_path`), all mechanical facts about files,
scripts, and workflows. A real usage session surfaced 3 gaps:

1. **No content-matching kind.** Neither "file X must mention Y" nor "no
   file may mention Y" is expressible. Both have real, waiting uses:
   hand-authored assertion files in downstream repos already hit claims of
   the shape "tool X is installed by script Y" — satisfiable only by a
   name appearing in a shell script, which no existing kind can express —
   and the eviction case below.

2. **Fact eviction is a real job the tool doesn't model.** When an operator
   retires a fact — a deadline that no longer holds, a goal that changed, a
   codename that must stop appearing — the work is: sweep every context
   surface for mentions, remove them, and then *enforce non-recurrence*
   forever, because the fact will otherwise creep back in from old
   transcripts, quoted reviews, or an agent summarizing history. Detection
   of staleness is impossible for facts whose truth lives in the operator's
   head (nothing in the repo can contradict them) — but **enforcement after
   a human decision is purely mechanical**, and today users do it with
   `grep` and hope.

3. **A "never mention X" assertion must itself contain X — unless designed
   not to.** This is the sharp one. For accuracy-motivated rules
   (`env_var_absent: SUPABASE_URL`) restating the string is fine. For
   privacy-motivated evictions, the whole point is that the fact leaves
   agent context entirely — and a plaintext pattern in `.groundtruth.jsonc`
   keeps one copy alive in exactly the file agents and CI read most. The
   check must be able to match without restating.

## 2. Ground rules for the implementing session

- Read `CLAUDE.md`, `docs/development/conventions.md`, and
  `docs/architecture/overview.md` first. The 5-step "adding an assertion
  kind" checklist in conventions.md is mandatory; step 3 (the `REGISTRY` in
  `src/assertions/index.ts`) is compile-enforced.
- **How changes land:** branch → PR into `main` → the `verify` check must
  pass → self-merge. Never push to `main` directly. The repo's own
  `.groundtruth.jsonc` self-check runs on every PR; if you change a claim
  in `CLAUDE.md` (you will — the kind list), update `.groundtruth.jsonc`
  and `CLAUDE.md` together or the self-check job fails.
- **Do not publish.** Releases are manual and deliberate; this work merges
  to `main` unreleased. Do not touch `action.yml`'s `version` input (it
  pins the published CLI and only moves in a release commit).
- Design constraints inherited from the existing ADRs, non-negotiable:
  - Zero network and pure-filesystem in checkers (`verify/` must stay
    seconds-fast and offline).
  - A checker that can't handle a case returns `"unverifiable"` — never a
    guessed `"passing"` (ADR-0002).
  - Conservative posture: prefer false negatives over false positives
    (ADR-0003's spirit); a false "your context lies" destroys trust.
- Commands: `pnpm build`, `pnpm test`, `pnpm typecheck`. Tests run against
  `test/fixtures/sample-repo`.
- Each feature below gets its own ADR (next numbers: 0006, 0007, 0008),
  following `docs/adr/template.md`, indexed in `docs/adr/README.md`.

---

## 3. Feature 1 — `text_present` and `text_absent` assertion kinds

Two kinds, one shared matcher module. Ship this first; it is independently
valuable and features 2–3 build on it.

### 3.1 Args

```ts
// src/types.ts additions
export type TextPresentArgs = {
  pattern: string;              // the text to find
  patternType?: "literal" | "regex";  // default "literal"
  path: string;                 // exactly one file, relative to repo root
};

export type TextAbsentArgs = {
  pattern: string;
  patternType?: "literal" | "regex";
  files?: string[];             // explicit file list, relative to repo root
  include?: string[];           // OR glob scope (mutually exclusive with files)
  exclude?: string[];           // globs subtracted from the scope
};
```

Notes on the shape:

- `text_present` targets **one named file** on purpose. Its use case is "the
  claim says X is configured in file Y" (e.g. *"atuin is installed by
  `bootstrap.sh`"* → pattern `atuin`, path `bootstrap.sh`). A vague
  "mentioned somewhere" present-check invites junk assertions; if a real
  need for multi-file presence appears, widen later.
- `text_absent` defaults to **all tracked text files** when neither `files`
  nor `include` is given — absence is only meaningful repo-wide. Scope
  resolution:
  1. If `files` given: exactly those (missing file → counts as absent for
     that file, but if *none* exist → `unverifiable`, mirroring
     `env_var_absent`).
  2. Else: enumerate via `git ls-files` from `repoRoot`. If `repoRoot` is
     not a git work tree (git absent or not a repo), return `unverifiable`
     with a detail telling the user to pass `files`/`include` — never fall
     back to a raw directory walk, which would scan `node_modules` and
     produce garbage.
  3. Apply `include`/`exclude` globs (use `picomatch` or hand-rolled
     minimal globbing — check what's already in the dependency tree first;
     the CLI is deliberately light. If adding a dependency, prefer
     `picomatch`, and say so in the ADR).
  4. Always skip: binary files (sniff for NUL byte in the first 8 KB),
     files > 5 MB (report them in `detail` as skipped — ADR-0002 spirit:
     never silently), `.git/`, and — important — **the assertions file
     itself** (`.groundtruth.jsonc` and any file passed via `--assertions`),
     otherwise every plaintext `text_absent` assertion self-triggers on its
     own `pattern` field. Document this exclusion prominently; it is also
     the bridge to feature 2 (self-exclusion hides the *tool's* copy of the
     fact, but the copy still exists — digests fix that).

### 3.2 Matching semantics

- `literal` (default): substring match after escaping regex metacharacters
  — same escaping as `env_var_absent`. Add optional word-boundary wrapping?
  **No** — keep literal truly literal; dates like `2031-04-01` and phrases
  with spaces don't have useful word boundaries. Case-sensitive by default;
  add `caseInsensitive?: boolean` (default false).
- `regex`: compile with `new RegExp(pattern)` per line (no flags beyond `i`
  when `caseInsensitive`). A pattern that throws on compile →
  `unverifiable` with the compile error in `detail` — never a crash, never
  a silent pass.
- Match line-by-line so `detail` can report `file#Lline` for every hit
  (cap the listing at the first 20 hits, then `…and N more` — the count
  must be accurate even when the listing is capped).

### 3.3 Status semantics

| Kind | Condition | Status |
|---|---|---|
| `text_present` | pattern found in `path` | passing |
| `text_present` | `path` exists, pattern not found | failing |
| `text_present` | `path` missing | failing (the claim implies the file) — detail says the file is missing |
| `text_absent` | no hits in scope | passing — detail names the scope size ("0 hits across 214 tracked files") |
| `text_absent` | ≥1 hit | failing — detail lists `file#L` hits |
| `text_absent` | scope unresolvable (no git, no explicit files) | unverifiable |

### 3.4 Checklist (conventions.md steps, made concrete)

1. `src/types.ts`: add both kinds to `ASSERTION_KINDS`, add the two args
   types, extend `ArgsFor`.
2. `src/assertions/text-present.ts` + `src/assertions/text-absent.ts`,
   sharing `src/assertions/text-match.ts` (the scope resolver + matcher —
   feature 2 plugs in here).
3. Register both in `REGISTRY`.
4. `src/manual/schema.ts`: two new discriminated-union branches. Enforce
   `files`/`include` mutual exclusion with a `.refine()`.
5. Fixtures: extend `test/fixtures/sample-repo` (it already has a
   `CLAUDE.md` and `turbo.json` to assert against); add cases to
   `test/assertions.test.ts` covering: literal hit/miss, regex, invalid
   regex → unverifiable, binary-file skip, self-exclusion of the
   assertions file, missing-git → unverifiable (point the checker at a
   fixture dir that isn't a git repo).
6. Docs: root `README.md` kind table (single source of truth for kind
   semantics), `site/reference/assertion-kinds.md`, the kind count in
   `CLAUDE.md` ("Six assertion kinds exist" → eight) **and** the
   corresponding `.groundtruth.jsonc` self-assertions, `.groundtruth.jsonc.example`
   with one annotated example of each. ADR-0006: "content assertions scan
   tracked text files only, and exclude the assertions file itself."

---

## 4. Feature 2 — redacted patterns (privacy-preserving eviction)

The wedge. An eviction assertion that can match a retired fact **without
containing it**.

### 4.1 Config shape

Extend `text_absent` (only — `text_present` has no privacy use case) so
`pattern` may be replaced by `patternDigest`:

```jsonc
{
  "claim": "The retired launch codename does not appear anywhere in this repo.",
  "kind": "text_absent",
  "args": {
    "patternDigest": {
      "algo": "sha256",
      "salt": "9f2c…",          // random per-assertion, generated at authoring time
      "digest": "ab41…",        // sha256(salt + normalized(pattern))
      "length": 14,             // byte length of the normalized pattern
      "normalize": "lower"      // "lower" | "exact"
    },
    "label": "retired-codename" // REQUIRED with patternDigest — humane report handle
  },
  "source": "docs/decisions/D-12.md#L3"  // points at the eviction decision, see 4.4
}
```

Schema: exactly one of `pattern` / `patternDigest` (Zod `.refine()`).
`label` required with `patternDigest`, optional otherwise.

### 4.2 Matching algorithm

Digests can't do regex or substring-of-unknown-length matching; they match
**exact literals of known length**, which is the honest scope (state it in
the ADR):

For each in-scope file, slide a window of `length` bytes over the content
(after normalization when `normalize: "lower"` — lowercase the haystack;
`length` is the length of the *normalized* pattern). Hashing every window
with SHA-256 is O(n·k) and too slow; use a two-stage match:

1. **Prefilter — rolling hash.** A polynomial rolling hash (Rabin-Karp)
   over the window, compared against the rolling hash of… the pattern,
   which we don't have. So the authoring step must also store the
   prefilter value: add `"rk": <uint32>` to `patternDigest`, the
   Rabin-Karp hash of the normalized pattern under fixed, documented
   parameters (base 257, modulus 2^32, defined once in
   `src/assertions/text-match.ts` and never changed without an `algo`
   version bump).
2. **Confirm — salted SHA-256.** Only windows whose rolling hash matches
   get `sha256(salt + window)` computed and compared to `digest`.

A 32-bit prefilter yields ~1 false candidate per 4 GB scanned — SHA-256
confirmations are effectively free. Performance target: the tool's own
repo scans in well under a second; a 300k-LOC repo in low single-digit
seconds. Add a perf smoke test only if it's cheap; don't over-engineer.

**Does the `rk` field weaken the redaction?** Yes, marginally: a 32-bit
rolling hash of a short string is brute-forceable for low-entropy facts
(a date has ~10^4 candidates). Be honest in the ADR and docs: redaction
protects against *casual context contamination* (agents and humans reading
the file), not against a determined attacker with the salt and digest —
short low-entropy facts are dictionary-attackable from SHA-256 alone. The
threat model is "keep it out of the context window", not cryptographic
secrecy. Anyone needing the latter should not commit any derivative of the
fact at all.

### 4.3 Reporting must not leak

When a digest assertion fails, `detail` reports file, line number, and the
`label` — **never the matched text, never a snippet**. This requires the
matcher to return hit positions without hit content for digest patterns
(plaintext patterns keep the current behavior). Add a test asserting the
failing `detail` for a digest match does not contain the planted fact —
this is the single most important test in the feature.

Same rule for `--json` output and the GitHub Action's annotations
(`action/run.mjs` — check whether it echoes details; it shells out to the
CLI, so CLI discipline should be sufficient, but verify with a test in
`test/action.test.ts`).

### 4.4 Authoring helper

Nobody hand-computes a salted digest. Add:

```
groundtruth digest            # prompts on stdin (no argv echo into shell history)
groundtruth digest --stdin    # explicit pipe mode for scripting
```

Reads the literal from stdin, generates a random salt, prints the complete
`patternDigest` JSON object ready to paste. The plaintext exists only in
process memory. Document in `site/reference/cli.md`.

### 4.5 The `source` convention for eviction assertions

Every existing assertion's `source` points at the sentence *making* the
claim. An eviction has no such sentence — absence is the point. Convention
(document in the README kind table and ADR-0007): `source` points at the
**eviction decision record** — the dated state-snapshot line, decision-log
entry, or commit that retired the fact. The `claim` field describes the
eviction without restating it ("the retired Q3 deadline does not appear
anywhere"). This keeps the tool's core promise — every failure traces to
the line that justifies the check — intact.

ADR-0007: "redacted patterns: rolling-hash prefilter + salted SHA-256,
exact-literal scope, report redaction, and the honest threat model."

---

## 5. Feature 3 — `groundtruth evict` (the workflow command)

Thin orchestration over features 1–2. Ship last; cut scope here first if
time runs out.

```
groundtruth evict [--redact] [--label <name>] [--write] [--source <ref>]
```

Behavior:

1. Read the fact from **stdin** (never argv — argv lands in shell history,
   which is a context surface).
2. Sweep the working tree with the `text_absent` scope rules and print
   every hit as `file#Lline`, with the matched line shown **only when
   `--redact` is not set**.
3. With `--write`: append a `text_absent` assertion to `.groundtruth.jsonc`
   (creating it if missing) — plaintext `pattern` by default,
   `patternDigest` + required `--label` under `--redact`. `--source` fills
   the assertion's `source` (default: `"evicted <ISO-date> via groundtruth evict"`,
   with a warning that a real decision-record reference is better).
4. **Always end the report with the unswept-surfaces disclosure** — the
   fail-closed principle applied to eviction. A working-tree scan cannot
   see, so the command must say so:

   ```
   Swept: working tree (214 tracked text files).
   NOT swept — check these yourself:
     · git history (this repo and its forks/clones)
     · other repositories that quote or transcribe this one
     · GitHub: PR/issue titles, bodies, comments — and their edit histories
     · CI logs, published packages, deployment artifacts
     · agent session transcripts and memory files outside this repo
   ```

   This list is the product being honest about its own boundary, which is
   the tool's founding posture. Hard-code it; do not make it configurable.

ADR-0008: "evict is working-tree-only and says so; stdin-only input;
`--write` is the bridge from one-time sweep to permanent enforcement."

Docs: `site/reference/cli.md`, a short "Evicting a fact" page under
`site/guide/`, and a `docs/features/evict-command.md` mirroring the
existing `check-command.md` shape.

---

## 6. Explicit non-goals (state these in the PR description)

- **Detecting that a head-truth fact went stale.** Impossible by
  construction; the human decides, the tool enforces. Don't build
  heuristics for it.
- **Paraphrase detection.** A retired fact reappearing reworded is
  layer-2/LLM territory (ADR-0004's roadmap), not a matcher feature.
  Digests match exact literals; say so everywhere the feature is
  documented.
- **Regex digests.** Contradiction in terms; schema forbids the
  combination.
- **History rewriting, GitHub API sweeps, cross-repo orchestration.** The
  unswept-surfaces disclosure names them; the CLI does not reach them.
  (A future `evict --repos` over a workspace of local checkouts is
  plausible; out of scope now.)
- **npm release.** Merge to `main`; the maintainer releases deliberately.

## 7. Acceptance checklist

- [ ] `pnpm build`, `pnpm test`, `pnpm typecheck` green; CI `verify` and
      `self-check` jobs green on the PR.
- [ ] 8 kinds in `ASSERTION_KINDS`; `CLAUDE.md`, `.groundtruth.jsonc`,
      README kind table, and `site/reference/assertion-kinds.md` all agree
      (the self-check will verify the parts it can).
- [ ] A digest-pattern failure's `detail`, `--json` output, and Action
      output contain the label and location but not the planted fact —
      covered by tests, not inspection.
- [ ] `.groundtruth.jsonc.example` shows one annotated example of
      `text_present`, plaintext `text_absent`, and redacted `text_absent`
      (with a synthetic fact, obviously).
- [ ] ADRs 0006–0008 written and indexed; no architectural reasoning
      duplicated into `CLAUDE.md` (link, per the repo's single-source rule).
- [ ] The assertions file self-exclusion works: a plaintext `text_absent`
      assertion does not fail on its own `pattern` field.
- [ ] Dogfood: add 1 real `text_present` assertion to groundtruth's own
      `.groundtruth.jsonc` for a sentence in its `CLAUDE.md` that the new
      kind can now express (candidates exist — e.g. the claim that the
      installed bin is plain `groundtruth` is a `text_present` on
      `package.json`).
