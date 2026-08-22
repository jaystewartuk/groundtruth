# ADR-0007: Redacted patterns — rolling-hash prefilter, salted SHA-256, exact-literal scope, and an honest threat model

## Status

Accepted

## Context

A "never mention X" assertion must itself contain X — unless designed not
to. For accuracy-motivated rules (`env_var_absent: SUPABASE_URL`)
restating the string is fine. For privacy-motivated evictions the whole
point is that the fact leaves agent context entirely, and a plaintext
`pattern` in `.groundtruth.jsonc` keeps one copy alive in exactly the
file agents and CI read most. The check must be able to match without
restating.

Hashes can do that, but naively hashing every possible substring of every
file is hopeless, and a bare unsalted hash of a short fact is trivially
dictionary-attackable. The design had to pick what redaction honestly
can and cannot promise.

## Decision

`text_absent`'s `pattern` may be replaced by a `patternDigest` object —
authored by `groundtruth digest`, never by hand — containing a random
per-assertion `salt`, `digest` = sha256(salt + normalized pattern), a
Rabin-Karp prefilter hash `rk` (base 257, modulus 2^32 — fixed
parameters, part of the on-disk format, never changed without an `algo`
version bump), the byte `length` of the normalized pattern, and a
`normalize` mode (`lower` or `exact`). `label` becomes required: it is
the only handle failure reports get.

**Matching scope is exact literals of known length** — that is what a
digest can honestly match. No regex digests (a contradiction in terms;
the schema forbids the combination), no paraphrase detection (layer-2/LLM
territory, per ADR-0004's roadmap).

Matching is two-stage per file: slide a `length`-byte window over the
(normalized) content comparing a rolling hash against `rk`; only windows
that pass get the salted SHA-256 confirmation. A 32-bit prefilter yields
roughly one false candidate per 4 GB scanned, so the SHA-256 work is
effectively free and the scan stays linear.

**Reporting must not leak.** A digest failure's `detail` carries the
file, line, and `label` — never the matched text, never a snippet. The
matcher returns hit positions without hit content for digest patterns.
This is covered by tests against the CLI's table output, `--json`, and
the Action's annotations and summary — the single most important tests
in the feature.

**`source` convention for evictions:** every other assertion's `source`
points at the sentence making the claim; an eviction has no such sentence
— absence is the point. Instead, `source` points at the **eviction
decision record** (the dated decision-log entry or commit that retired
the fact), keeping the tool's core promise — every failure traces to the
line that justifies the check — intact.

## Consequences

- **The threat model is "keep it out of the context window", not
  cryptographic secrecy.** The `rk` field weakens redaction marginally: a
  32-bit rolling hash of a short string is brute-forceable for
  low-entropy facts (a date has ~10⁴ candidates), and short low-entropy
  facts are dictionary-attackable from the salted SHA-256 alone. Redaction
  protects against *casual context contamination* — agents and humans
  reading the file — not a determined attacker holding the salt and
  digest. Anyone needing real secrecy should not commit any derivative of
  the fact at all.
- Exact-literal matching means a reworded or partially-quoted fact is not
  caught. Deliberate and documented everywhere the feature is: digests
  match exact literals, full stop.
- `normalize: "lower"` buys case-insensitivity at authoring time; there
  is no way to add it after the fact without re-digesting, because
  matching behavior is baked into the stored digest.
- The fixed Rabin-Karp parameters are load-bearing: changing them orphans
  every committed digest, which is why they live in one place
  (`text-match.ts`) under an explicit never-change comment.

## Alternatives considered

- **Plaintext patterns only, with the assertions file excluded from its
  own scan** — the exclusion (ADR-0006) hides the tool's copy from the
  *check*, but the copy still sits in the file agents read. Not eviction.
- **Unsalted hashes** — strictly worse: same dictionary-attack exposure,
  plus identical facts across repos produce recognizable identical
  digests.
- **SHA-256 over every window with no prefilter** — O(n·k) hashing; a
  300k-LOC repo would take minutes, violating the seconds-fast
  constraint.
- **Bloom filters / n-gram sketches** — probabilistic false *positives*,
  which is the one failure mode this tool must never have ("your context
  lies" said falsely destroys trust; ADR-0003's spirit).

## References

- `src/assertions/text-match.ts` — digest matcher and the parameter block
- `src/digest.ts` — the `groundtruth digest` authoring helper
- [ADR-0006](0006-content-assertions-scan-tracked-text-files-only.md) — the scope rules digests inherit
- [ADR-0008](0008-evict-is-working-tree-only.md) — the workflow command built on this
