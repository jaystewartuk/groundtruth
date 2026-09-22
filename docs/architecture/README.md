# Architecture

> **Summary:** groundtruth is a single-process CLI, no server, no database,
> no network calls. Everything below describes one Node process reading
> local files and exiting with a status code.

- [`overview.md`](overview.md) — components, request flow, data flow, and
  where the system's boundaries are.

There is one document here because there is one architecture layer today:
a CLI over a local filesystem. Split this into more documents (e.g. a
`extraction.md` for the LLM-based extraction layer) when the corresponding
code exists — see the [Roadmap](../../README.md#roadmap).
