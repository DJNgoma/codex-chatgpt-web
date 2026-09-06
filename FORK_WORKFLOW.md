# Personal fork workflow and integration rationale

Recorded on 6 September 2026. This is a fork-maintenance record, not an upstream
release-readiness claim.

## Repository ownership and defaults

- Personal fork and push target: `DJNgoma/codex-chatgpt-web` (`origin`).
- Upstream source: `miuuyy/codex-chatgpt-web` (`upstream`).
- This checkout's GitHub CLI default is the personal fork. Repository-local Git
  settings are `remote.pushDefault = origin` and `push.default = simple`.
- Fetch upstream changes for review, then integrate only the changes deliberately
  selected for a work branch. No automatic upstream merge, pull, release, or
  deployment has been configured. Upstream issues and PRs require an explicit
  repository target.

## Why a new integration branch exists

`passkey-login-supersede` originally described allowing a macOS passkey sign-in
request to supersede an in-progress embedded login. The local work subsequently
expanded to sign-in diagnostics, model-picker inspection, catalogue routing,
managed-hook recovery, and more accurate turn-termination messages.

`codex/passkey-login-integration` names that wider review scope. It starts from
the already-rebased local snapshot
`c5ab1c873a6e0db1324fdf327fa63d96e4c0ff18`, which contains upstream v5.0.4 at
`c648c09` and seven additional fork commits. Publishing that snapshot to fork
`main` is a fast-forward from `9a7428a`, not a history rewrite or a new merge.

The original remote `passkey-login-supersede` at `aca5671` is deliberately
preserved. Its local counterpart has already been rebased and has diverged from
that remote reference; do not force-push it or run an unreviewed pull to reconcile
the two. Continue review on the new integration branch instead. Existing commit
authorship and the local prerebase backup are retained.

The integration branch adds this record separately from the existing application
commits. Uncommitted changes in the active checkout are outside the published
snapshot and must not be silently staged, discarded, or treated as tested.

## Verification of the committed application snapshot

Validation used a separate copy of the committed snapshot with isolated home,
Codex, and application configuration directories:

- 132 launcher tests passed across `browser-host.test.cjs`,
  `codex-catalog-route.test.cjs`, and `renderer-wiring.test.cjs`.
- 168 runtime tests passed across `chatgpt-web-harness.test.ts`,
  `codex-integration.test.ts`, `codex-interrupt-hook.test.ts`, and
  `server-lifecycle.test.ts`.
- Runtime and launcher TypeScript checks passed with `tsc --noEmit`.
- The committed diff against upstream passed `git diff --check`.

These are existing targeted suites, not the full verification, packaging, or
installed-app acceptance suite. The initial runtime run under `/tmp` failed the
durable-runtime-path guard. Moving the same snapshot to a separate durable
directory resolved those environment-related failures without changing source
or weakening the guard.

## Remaining review and publication gates

Catalogue-file contents are disk evidence, not proof that the running Codex
process has reloaded a route. The catalogue verification paths still need review
before an upstream PR, particularly where they clear `codexRestartRequired`.
The line-based TOML detection also needs behavioural edge-case coverage rather
than relying only on source-string assertions.

Compare that work with upstream PR #299, which was confirmed closed without
merging on this date. Recheck current upstream commits and related PRs before
proposing a fix; do not recreate a fix already merged or under active review.

Publishing to the personal fork is authorised. Opening an upstream PR remains
subject to the owner's explicit confirmation after the final diff, duplicate-fix
assessment, and actual test results have been presented.

## Active-use safety

Git metadata changes, isolated tests, and fork pushes do not require closing
ChatGPT. This work does not install a build, replace a running runtime, edit the
live Codex configuration, stop an app, or restart a service. No release tags are
pushed. The inspected `main` push workflow runs CI; release publication is
tag-triggered.

Installed login/session and restart-dependent acceptance checks remain deferred.
Explain the exact interruption and obtain approval before any such test changes
active use.

## Assistance acknowledgement

Prepared with assistance from ChatGPT Web GPT-6 Pro.
