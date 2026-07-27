# ADR-0003: Regex-based symbol matching for `symbol_at_path`

## Status

Accepted

## Context

The `symbol_at_path` assertion kind checks a claim like "`entitlementsFor()`
in `entitlements.ts` is the single place tier logic is decided." Verifying
this precisely requires understanding the file's actual export surface,
which a full TypeScript/JS AST parse gives you but a text search does not.

## Decision

`symbol_at_path` is implemented as a regex match for
`export function`/`const`/`class`/`interface`/`type`/`enum` declarations,
not a full AST parse. It reports `failing`, not `passing`, for a symbol
reached only via re-export (`export { X } from "./y"`) — a known false
negative, disclosed in the root README rather than left as a silent gap.

## Consequences

- No parser dependency (e.g. `typescript`'s compiler API or a `swc`
  binding) needed for the MVP checker set.
- Re-export patterns produce a false `failing` today. Because the
  assertion registry design ([overview.md](../architecture/overview.md#extension-point-assertion-kinds))
  makes every kind's checker swappable behind the same `Checker` type
  without touching the CLI or report layer, replacing the regex
  implementation with an AST-based one later is a scoped, single-file
  change to `src/assertions/symbol-at-path.ts`.
- `env_var_absent` inherited the same "disclose, don't hide" pattern: it
  requires an exact string/key match on JSON files rather than a substring
  search, and the README says so directly rather than presenting it as
  complete coverage.

## Alternatives considered

- **Full AST parse from the start.** Rejected for the MVP: adds a parser
  dependency and parsing-edge-case surface before the core check/report
  loop was proven out. Revisit once `symbol_at_path` sees real usage
  against re-export-heavy codebases.

## References

- `src/assertions/symbol-at-path.ts`
- Root [README § Known MVP limitations](../../README.md#the-groundtruthjsonc-format)
- [`architecture/overview.md`](../architecture/overview.md) (registry extension point)
