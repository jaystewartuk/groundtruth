---
description: "How a groundtruth release ships: npm publish before the tag, one version number across CLI and Action, and the manual Marketplace step."
---

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
this and future packages.
:::

Two artifacts ship from this one repo, from the same tag: the CLI on npm,
and the [GitHub Action](/guide/github-action) on the GitHub Marketplace.
They share a version number on purpose — the Action installs the CLI, and
a released Action ref whose pinned CLI version doesn't exist is broken for
every consumer on its first run.

## How consumers install

```bash
pnpm add -D @groundtruth-sh/cli
```

Standard semver resolution against the npm registry. Installing straight
from git (`pnpm add -D github:jaystewart-dev/groundtruth`) still works
and pins an exact commit instead of a published version — useful for
trying an unreleased `main`.

## Cutting a release

The order matters. npm is published **before** the tag exists, because the
tag is what consumers point the Action at, and the Action resolves its CLI
from npm on its very first run.

1. Bump `version` in `package.json` (semver), **and the `version` input's
   default in `action.yml` to match**. They are two halves of one number;
   the [self-check](/guide/github-action#how-it-works) can't catch this one
   for you, because it runs the local build rather than the published
   package.
2. `pnpm test` and `pnpm typecheck` green; `npm pack --dry-run` to eyeball
   exactly what ships — the `files` field restricts the tarball to `dist/`
   (compiled CLI + library) and `.groundtruth.jsonc.example`. The Action's
   files are not in the tarball and don't need to be: consumers get them
   from the git ref, not from npm.
3. Merge the release commit to `main` through a pull request, like any
   other change.
4. `npm publish` — the `prepare` script rebuilds `dist/` via tsc first,
   and `publishConfig.access: public` keeps the scoped package public.

   ::: warning Publishing needs a human at a security key
   Account-level 2FA means each `npm publish` waits on a browser
   web-authentication link, which expires in about five minutes, and npm
   only offers that link when the CLI is attached to a pty. A granular
   automation token with publish rights is what a release workflow would
   need to remove the dance.
   :::
5. Tag the commit (`git tag vX.Y.Z`), push the tag, and create a GitHub
   release from it — this is what the "Latest release" badge on the
   [home page](/) reflects.
6. On that release page, tick **Publish this Action to the GitHub
   Marketplace**. There is no API for this step; it is a checkbox on the
   release, and it requires 2FA on the account and an accepted Marketplace
   Developer Agreement. The listing takes its name, description and icon
   from `action.yml`'s `name`, `description` and `branding` fields.

None of this is automated — no `.github/workflows/release.yml` exists.
Automating steps 4–5 behind a tag push is a reasonable next step now that
there's a first release behind us; step 6 can't be automated at all.

### On moving major tags

Many Actions offer a floating `@v1` alias alongside exact versions.
groundtruth doesn't, yet: while it is pre-1.0, a floating major would mean
consumers silently taking breaking changes, which is the opposite of what a
CI gate is for. Pin the exact ref. If a `v1` alias is added later it will be
a force-pushed tag repointed at each release — safe for an alias that is
documented as floating, never for a version tag someone may already have
pinned.

## Documentation site releases

Unlike the CLI, this documentation site *does* deploy automatically —
every push to `main` rebuilds and publishes it via
[`.github/workflows/deploy-site.yml`](https://github.com/jaystewart-dev/groundtruth/blob/main/.github/workflows/deploy-site.yml).
There's no versioning for the site; it always reflects `main`.

The site is deliberately not a third place to bump the version: everywhere
the docs pin a released ref — the `jaystewart-dev/groundtruth@vX.Y.Z` lines
in Action examples — the number is substituted at build time from the root
`package.json`'s `version` field (the mechanism lives in
[`site/.vitepress/config.ts`](https://github.com/jaystewart-dev/groundtruth/blob/main/site/.vitepress/config.ts)).
A release commit that bumps `package.json` and `action.yml` therefore
updates every example on the next deploy, with no site edit to forget.
