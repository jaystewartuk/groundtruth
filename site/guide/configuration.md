# Configuration

groundtruth has exactly one configuration surface: the assertions file,
`.groundtruth.jsonc` by default (JSON with comments, parsed via
[`jsonc-parser`](https://www.npmjs.com/package/jsonc-parser)). There is no
global config file, no environment variables, and nothing to set up
beyond it.

## File shape

```jsonc
{
  "assertions": [
    // one or more assertion objects
  ]
}
```

## Assertion object

Every entry in `assertions` has exactly four fields, all required and
validated with [zod](https://www.npmjs.com/package/zod) at load time
(`src/manual/schema.ts`) — a malformed entry fails immediately with a
clear error, not partway through a check run.

| Field | Type | Meaning |
|---|---|---|
| `claim` | `string` | The sentence from your context file, verbatim. Never checked mechanically itself — it's what a human reads in the report. |
| `kind` | one of 8 strings | Which checker to run. See [Assertion kinds](/reference/assertion-kinds). |
| `args` | object | Kind-specific arguments — shape depends on `kind`. |
| `source` | `string` | `"<file>#L<line>"`. Traces a failure back to the exact line that made the claim. |

Example, taken directly from `.groundtruth.jsonc.example`:

```jsonc
{
  "claim": "Do NOT reintroduce a Supabase/Vercel code path or env var.",
  "kind": "env_var_absent",
  "args": { "name": "SUPABASE_URL" },
  "source": "CLAUDE.md#L7"
}
```

Note that this claim covering multiple env vars became one assertion
*per variable* — atomize a compound claim into one checkable fact each,
rather than one assertion trying to represent several facts at once. A
future automated-extraction step is expected to do this atomization for
you (see [ADR-0001](/architecture/decisions#adr-0001-hand-authored-assertions-before-llm-extraction));
today you do it by hand.

## Where the file lives

By default, groundtruth looks for `.groundtruth.jsonc` at the repo root
(the `--repo` value, default `cwd`). Override the filename or location
with `--file` — see [CLI reference](/reference/cli).

## What's not configurable (yet)

- Which context files groundtruth looks for is a fixed list in
  `src/discover.ts` (`CLAUDE.md`, `AGENTS.md`, `.cursor/rules`,
  `.github/copilot-instructions.md`) — informational only today, not
  user-configurable, and doesn't yet drive which assertions run. See
  [Architecture overview](/architecture/overview).
- There's no way to disable or downgrade a specific assertion kind
  project-wide. If a check kind doesn't fit, don't write assertions of
  that kind.
