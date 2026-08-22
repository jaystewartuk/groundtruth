---
description: "Retire a fact with groundtruth evict — sweep every tracked file, enforce non-recurrence with a text_absent assertion, redacted so the fact never reappears in the config."
---

# Evicting a fact

When an operator retires a fact — a deadline that no longer holds, a goal
that changed, a codename that must stop appearing — the work is: sweep
every context surface for mentions, remove them, and then **enforce
non-recurrence forever**, because the fact will otherwise creep back in
from old transcripts, quoted reviews, or an agent summarizing history.

groundtruth cannot detect that a fact went stale — for facts whose truth
lives in the operator's head, nothing in the repo can contradict them. But
once the human decides, enforcement is purely mechanical, and that is
exactly the job `groundtruth evict` does.

## Sweep

Pipe the fact in on stdin — never as an argument, because shell history is
itself a context surface:

```bash
printf '%s' 'the retired fact' | groundtruth evict
```

Every git-tracked text file is scanned (the same scope rules as
[`text_absent`](/reference/assertion-kinds#text-absent)), and every hit is
printed as `file#L<line>` with the matching line. The sweep is
case-insensitive — an eviction cares about the fact in any casing. Add
`--redact` to print locations only, with no line content.

Exit code is `1` while hits remain, `0` once the sweep is clean.

## Enforce

A one-time sweep only catches today's copies. `--write` appends a
`text_absent` assertion to `.groundtruth.jsonc` (creating the file if
needed), so every future `groundtruth check` — locally and in the
[GitHub Action](/guide/github-action) — fails if the fact reappears:

```bash
printf '%s' 'the retired fact' | groundtruth evict --write --source docs/decisions/D-12.md#L3
```

`--source` should point at the **eviction decision record** — the dated
decision-log line or commit that retired the fact. Every other assertion's
`source` points at the sentence making a claim; an eviction has no such
sentence, absence being the point, so the decision record is what keeps
failures traceable to the line that justifies the check. Without
`--source` you get a dated placeholder and a warning.

## Redacted enforcement

For accuracy-motivated rules, a plaintext pattern is fine. For
privacy-motivated evictions there's a trap: a "never mention X" assertion
that spells out X keeps one copy of the fact alive in exactly the file
agents and CI read most. `--redact --write` closes it:

```bash
printf '%s' 'the retired fact' | groundtruth evict --redact --write --label retired-codename
```

The written assertion carries a salted-digest `patternDigest` instead of a
pattern — it matches the fact without containing it — plus your `--label`,
which is the only handle failure reports will ever show. A later failing
`check` reports the label and `file#L<line>`, never the text. (To author a
digest by hand for an existing assertion, use
[`groundtruth digest`](/reference/cli#groundtruth-digest).)

Two honest limits, spelled out in
[ADR-0007](/architecture/decisions#adr-0007-redacted-patterns): digests
match **exact literals only** — a reworded fact is not caught — and
redaction keeps a fact out of the context window rather than providing
cryptographic secrecy; a short, low-entropy fact (a date) is
dictionary-attackable from the committed digest by a determined attacker.

## What the sweep cannot see

Every `evict` report ends with this disclosure, and it is not
configurable:

```
Swept: working tree (214 tracked file(s)).
NOT swept — check these yourself:
  · git history (this repo and its forks/clones)
  · other repositories that quote or transcribe this one
  · GitHub: PR/issue titles, bodies, comments — and their edit histories
  · CI logs, published packages, deployment artifacts
  · agent session transcripts and memory files outside this repo
```

A working-tree scan cannot reach those surfaces, so the command says so
every time — the same fail-closed posture as
[unverifiable assertions](/architecture/decisions#adr-0002-unverifiable-assertions-never-fail-but-always-report):
overstating coverage is the exact failure mode this tool exists to
prevent.
