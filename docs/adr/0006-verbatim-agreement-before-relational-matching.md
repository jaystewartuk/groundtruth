# ADR-0006: `text_matches_across` checks verbatim agreement, and a missing file fails

## Status

Accepted

## Context

Every kind before this one asks a question about a single file. The failure
mode that motivated this one is different: a sentence that has to appear
identically in several places, drifting apart.

The case it was built from is a real one, in the maintainer's own repository
set. One availability sentence lived in a CV, a LinkedIn draft, a booking
message, a website page and a GitHub profile README. Two separate corrections
were made, weeks apart, and **each reached four of the six copies**. Neither
was a bad edit; both were correct edits that did not enumerate their
surfaces. Worse, both times the remaining copies were checked with a
substring search and reported clean — every drifted variant still contained
the phrase being grepped for, so the search could not distinguish them.

That is a mechanical problem with a mechanical answer, and it does not need
the LLM judgment that layer 2 of [ADR-0004](0004-three-layer-roadmap.md)
reserves for semantic contradiction. It is layer 1 work.

## Decision

**`text_matches_across` takes a literal `text` and a list of `files`, and
passes only when every file contains that text after normalization.**

Three things follow, each chosen deliberately.

**1. The literal lives in the assertion, so the assertion file becomes the
single source.** The sentence is written once, in `.groundtruth.jsonc`, and
every surface is checked against it. This is the property that makes the kind
worth having: not that it detects a mismatch, but that it gives a duplicated
fact one canonical home when generation into every surface is impossible —
and it usually is, because paste targets like a LinkedIn profile or a
rendered PDF have no build step to generate into.

**2. Normalization defaults to `["whitespace"]`, with `"markdown"` opt-in.**
Hard-wrapped prose is the single most common way a phrase hides from a
line-oriented search, and re-wrapping a Markdown paragraph changes none of
its meaning and all of its line breaks. `"markdown"` additionally strips
per-line blockquote markers and `*`/`_` emphasis. Nothing else is stripped:
template interpolation, HTML tags and smart-quote substitution are out of
scope, and report `failing` rather than a false pass.

**3. A missing file fails; it does not report `unverifiable`.** This is the
opposite of `env_var_absent`'s policy and the difference is real. There, a
file that does not exist cannot contain the variable, so its absence tells
you nothing. Here the claim is that N named surfaces all state this sentence
— **a surface that no longer exists is not an unknown, it is a surface that
has stopped stating it.** Reporting `unverifiable` would make deleting a file
the cheapest way to go green, which inverts the tool's purpose.

## Consequences

- The kind cannot express a **relational** claim: "the version in `action.yml`
  equals the version in `package.json`" needs a pattern with a capture group
  compared across files, not a literal. This repo has exactly that claim in
  its own `CLAUDE.md`, so the gap is known and felt rather than theoretical.
  The literal workaround — asserting the current version string appears in
  both files — works and is used, at the cost of a third edit at release time.
  A `values_match_across` kind taking a pattern is the obvious successor; it
  is deferred until a second real use appears, on the same reasoning as
  [ADR-0003](0003-regex-based-symbol-matching-for-mvp.md).
- Point 3 makes the kind sensitive to file moves. Renaming a surface breaks
  the assertion, which is intended — the assertion is the list of surfaces,
  and a rename is a change to that list.
- Long sentences in a JSONC file are awkward to read. Accepted: the
  alternative is a pointer to a file holding the canonical text, which would
  reintroduce the indirection the kind exists to remove.

## Alternatives considered

- **A regex instead of a literal.** Rejected for the MVP: a pattern that
  matches every acceptable variant is exactly the substring search that
  produced two false cleans here. The literal is the point.
- **Generate the text into every surface instead of checking it.** Strictly
  better where it is available, and it should be preferred — this kind is for
  the surfaces generation cannot reach. Most of the motivating six were paste
  buffers for systems with no sensible write path.
- **Report `unverifiable` for a missing file**, consistent with
  `env_var_absent`. Rejected on the reasoning in point 3; consistency between
  kinds is worth less than each kind's status meaning what it says.
