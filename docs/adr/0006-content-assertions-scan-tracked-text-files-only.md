# ADR-0006: Content assertions scan tracked text files only, and exclude the assertions file itself

## Status

Accepted

## Context

The first six assertion kinds verify repo *structure* — paths, scripts,
workflow triggers, exported symbols. Neither "file X must mention Y" nor
"no file may mention Y" was expressible, and both had real, waiting uses:
hand-authored assertion files in downstream repos already hit claims of
the shape "tool X is installed by script Y" (satisfiable only by a name
appearing in a shell script), and fact eviction (ADR-0007, ADR-0008)
needs a repo-wide "never mention X" check.

Two design questions had to be settled for a content-matching kind:

1. **What does "the whole repo" mean?** A raw directory walk would scan
   `node_modules/`, build output, and multi-megabyte artifacts — slow and
   full of garbage hits. Checkers must also stay pure-filesystem and
   seconds-fast (the constraint inherited from the existing design).
2. **What stops a `text_absent` assertion from matching itself?** A
   plaintext "no file may mention X" assertion necessarily contains X in
   its own `pattern` field, in exactly the file every check reads.

## Decision

`text_present` targets **exactly one named file**. Its use case is "the
claim says X is configured in file Y"; a vague "mentioned somewhere"
present-check invites junk assertions. If a real need for multi-file
presence appears, widen later.

`text_absent` defaults to **every git-tracked file** (via `git ls-files`)
— absence is only meaningful repo-wide — filtered by optional
`include`/`exclude` globs, or replaced by an explicit `files` list. When
`repoRoot` is not a git work tree, the checker returns `unverifiable`
with a pointer to `files`/`include`; it never falls back to a directory
walk. Binary files (NUL byte in the first 8 KB) and files over 5 MB are
skipped and named in `detail`, never silently (ADR-0002's spirit).

The assertions file itself — `.groundtruth.jsonc` at the repo root, plus
whatever file was passed via `--file` — is always excluded from the
scan, so a plaintext `text_absent` assertion cannot self-trigger on its
own `pattern` field. This exclusion hides the *tool's* copy of the fact
from the check, but that copy still exists on disk; making it not exist
is what redacted patterns (ADR-0007) are for.

Globbing is a hand-rolled ~20-line converter supporting `**`, `*`, and
`?` rather than a `picomatch` dependency: the CLI is deliberately light,
and those three forms cover the include/exclude shapes an assertions
file realistically needs. If glob needs outgrow them, swap in
`picomatch` then.

## Consequences

- Untracked files are invisible to the default scope. That is mostly the
  point (generated and vendored trees stay out), but it also means a
  fact sitting in an uncommitted scratch file is not caught — the sweep
  is of what the repo *publishes*, not everything on disk.
- The default scope requires a git checkout with `git` on PATH. CI has
  both; a tarball export gets `unverifiable`, not a guess.
- Literal matching stays truly literal — no implicit word boundaries, no
  case folding unless `caseInsensitive` is set — so dates and phrases
  with spaces match exactly as written. Conservative posture: prefer a
  missed hit over a false "your context lies".
- One more checker contract nuance: `text_absent` is the first kind that
  needs run-level context (the assertions-file path), threaded through
  an optional `CheckContext` parameter that other checkers ignore.

## Alternatives considered

- **Directory walk with an ignore list** — rejected: reimplements
  `.gitignore` badly, scans `node_modules` the first time someone forgets
  an ignore entry, and turns a seconds-fast check into a minutes-slow one.
- **Multi-file `text_present`** — rejected for now: every imagined use was
  better served by naming the file the claim is actually about.
- **A real glob dependency (`picomatch`)** — deferred, not rejected: the
  hand-rolled subset is enough today and the swap is one function.

## References

- `src/assertions/text-match.ts` — scope resolver, glob subset, matchers
- `src/assertions/text-present.ts`, `src/assertions/text-absent.ts`
- [ADR-0002](0002-unverifiable-assertions-never-fail-but-always-report.md) — why unresolvable scope is `unverifiable`, not `passing`
- [ADR-0007](0007-redacted-patterns.md) — matching a fact without restating it
