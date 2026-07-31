# Release process

::: tip First release cut
v0.1.0 was published to npm as
[`@groundtruth-sh/cli`](https://www.npmjs.com/package/@groundtruth-sh/cli) on
July 31, 2026. The process below is now a description of what actually
happens, not an intention — it is still manual and single-maintainer.
The name is scoped because npm's name-similarity rule permanently
reserves unscoped `groundtruth` against the unrelated, long-dormant
`ground-truth` package, and the bare `groundtruth` org name was already
taken too; the `groundtruth-sh` npm org — named for the domain — holds
this and future packages (the planned GitHub Action, for one).
:::

## How consumers install

```bash
pnpm add -D @groundtruth-sh/cli
```

Standard semver resolution against the npm registry. Installing straight
from git (`pnpm add -D github:jaystewart-dev/groundtruth`) still works
and pins an exact commit instead of a published version — useful for
trying an unreleased `main`.

## Cutting a release

1. Bump `version` in `package.json` (semver).
2. `pnpm test` and `pnpm typecheck` green; `npm pack --dry-run` to eyeball
   exactly what ships — the `files` field restricts the tarball to `dist/`
   (compiled CLI + library) and `.groundtruth.jsonc.example`.
3. `npm publish` — the `prepare` script rebuilds `dist/` via tsc first,
   and `publishConfig.access: public` keeps the scoped package public.
4. Tag the commit (`git tag vX.Y.Z`), push the tag, and create a GitHub
   release from it — this is what the "Latest release" badge on the
   [home page](/) reflects.

None of this is automated — no `.github/workflows/release.yml` exists.
Automating steps 3–4 behind a tag push is a reasonable next step now that
there's a first release behind us.

## Documentation site releases

Unlike the CLI, this documentation site *does* deploy automatically —
every push to `main` rebuilds and publishes it via
[`.github/workflows/deploy-site.yml`](https://github.com/jaystewart-dev/groundtruth/blob/main/.github/workflows/deploy-site.yml).
There's no versioning for the site; it always reflects `main`.
