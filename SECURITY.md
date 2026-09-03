# Security policy

## Supported versions

groundtruth is pre-1.0 and single-maintainer. Fixes land on the latest
published version of `@groundtruth-sh/cli` only; there are no maintained
release branches. Pin a version in CI if you need reproducibility, and
upgrade to pick up a fix.

## Reporting a vulnerability

Report privately through GitHub's
[private vulnerability reporting](https://github.com/jaystewartuk/groundtruth/security/advisories/new)
— it opens a draft advisory only the maintainer can see. Please do not open
a public issue for something exploitable.

Expect an acknowledgement within a few days. If a report is valid, the fix
and the advisory are published together.

## What counts

groundtruth reads files and exits. It makes no network calls, opens no
ports, stores no credentials, and never writes to the repository it checks.
That keeps the interesting surface small but not empty:

- **The GitHub Action** (`action/run.mjs`) runs on a runner with the
  workspace checked out, and installs the published CLI from npm. Its
  `version` input is validated against a strict character allowlist
  (`sanitizeVersion`) precisely so a workflow input cannot smuggle an extra
  argument into the install command or a path traversal into the install
  directory. A way past that is a vulnerability — please report it.
- **Assertion arguments** are paths and names read from a
  `.groundtruth.jsonc` file, joined against the repo root. A crafted
  assertions file can make the checker read a file outside the repo. This
  is treated as in scope for reporting, but note the honest threat model
  below.

## Threat model, stated plainly

**A `.groundtruth.jsonc` file is trusted input, at the same level as the
repository's own build configuration.** Anyone who can change it can
already change `package.json` scripts or a workflow file, which is a far
shorter path to arbitrary execution. So groundtruth does not attempt to
sandbox the assertions file against its own author, and treating it as
untrusted input from a fork is not a supported use.

What groundtruth *does* promise is that it only ever reads. It does not
execute anything from the repository it checks, evaluate any expression out
of an assertions file, or write to the checked repo. A report showing it
doing any of those is a vulnerability regardless of the above.

## Dependencies

Runtime dependencies are deliberately few — `jsonc-parser`, `yaml`, and
`zod` — and the Action's runner has none at all. Dependabot opens security
and version updates; `pnpm audit` runs against a clean install.
