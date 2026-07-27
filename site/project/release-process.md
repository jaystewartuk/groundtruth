# Release process

::: warning No releases yet
groundtruth hasn't cut a tagged release or published to npm. `package.json`
is still at `0.0.1`, and the only install path today is
[git-install via pnpm](/guide/getting-started#_1-install). What follows is
the intended process, not a description of something that's happened —
distinguishing the two is the point of this page.
:::

## How consumers install today

```bash
pnpm add -D github:jaystewart-dev/groundtruth
```

pnpm resolves and pins a specific commit into the consumer's
`pnpm-lock.yaml`. A new commit to `main` doesn't reach anyone until they
run `pnpm update groundtruth` — there's no floating "latest" the way
semver ranges against an npm registry would give you.

## What "publishing a release" will mean

1. Bump `version` in `package.json` (currently `0.0.1`, semver).
2. Tag the commit (`git tag vX.Y.Z`) and push the tag — this is what the
   `og:image` "Latest release" badge on the [home page](/) will start
   reflecting once a first tag exists.
3. `pnpm publish` to npm, restricted to what `package.json`'s `files`
   field ships: `dist/` (compiled CLI + library) and
   `.groundtruth.jsonc.example`.
4. Update the [Getting started](/guide/getting-started) install command
   from the git-install form to `pnpm add -D groundtruth`.

None of this is automated yet — no `.github/workflows/release.yml`
exists. Automating step 2–3 behind a tag push is a reasonable next step
once there's a first release to cut.

## Documentation site releases

Unlike the CLI, this documentation site *does* deploy automatically —
every push to `main` rebuilds and publishes it via
[`.github/workflows/deploy-site.yml`](https://github.com/jaystewart-dev/groundtruth/blob/main/.github/workflows/deploy-site.yml).
There's no versioning for the site; it always reflects `main`.
