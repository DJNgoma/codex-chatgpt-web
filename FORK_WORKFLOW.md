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

The integration branch initially added this record separately from the existing
application commits. Its subsequent catalogue-verification fix is described
below. Uncommitted changes in the active checkout are outside the published
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

## Catalogue fix and fork merge validation

The follow-up fix separates catalogue availability from runtime evidence:

- `codexCatalogVerified` remains the catalogue-availability gate for MCP setup.
  `codexCatalogVerificationSource` records whether the evidence is an observed
  bridge request or an external catalogue file. A file can unlock that gate, but
  cannot clear `codexRestartRequired` or produce a runtime-verified report.
- Persisted verification from older fork builds without an evidence source is
  rechecked rather than retaining an unsupported restart-complete claim.
- A pinned TOML parser replaces line matching. Duplicate keys, missing or
  whitespace-only values, quoted keys, comments, multiline strings, escaped
  paths, and invalid file contents now have behavioural regression coverage.
  Relative catalogue paths are rejected with an explicit absolute-path diagnostic
  rather than resolved against an uncertain working directory.
- Config and catalogue reads are size-bounded and reject non-regular files.
  Parse diagnostics do not echo configuration values. Unknown or unreadable
  catalogues are not described as empty, and disk-only results are not green
  runtime-success notices.
- The catalogue fixtures now remove their temporary directories after each test.

The expanded catalogue suite reproduced 22 failing assertions before the fix;
the combined catalogue, evidence-policy, and wiring suites now pass all 69 tests.
The complete `bun run verify` pipeline then passed on macOS arm64 in a separate
worktree with isolated home, Codex, and application-state directories:

- Runtime: 664 tests passed, zero failed.
- Launcher: 338 tests passed, zero failed; one Linux-specific AppImage test was
  skipped on macOS.
- Both dependency audits reported no vulnerabilities.
- Version consistency, both TypeScript checks, launcher production build,
  runtime bundle build, and third-party notices generation passed.
- The relocated runtime and isolated headless-browser smoke check completed with
  `RELOCATABLE_RUNTIME_SMOKE_OK`.

The first full-suite attempt failed three tests because the isolated dependency
installation omitted the Electron binary. A copy-on-write copy of the matching
Electron 41.10.7 test binary corrected that environment. The complete pipeline
was rerun successfully; no application code or tests were weakened to hide those
failures, and the active application's installation was not changed.

Upstream remained at `c648c09`. PR #299 was rechecked and is closed without
merging; it changes runtime doctor diagnostics, not this launcher evidence policy.
The open upstream PRs at review time were #343, #340, #338, and #329, covering
different changes. No upstream merge was necessary and no conflicting files
needed a conflict-resolution edit.

The eight existing edits in the active checkout were reviewed separately. They
cover tunnel-health rediscovery, viewport failure classification, their tests,
and documentation. They remain outside this merge and its verified snapshot.

## Remaining review and publication gates

Fork integration is authorised. Packaged-app acceptance on the other platforms
and installed login/session testing are not established by the macOS verification
pipeline. Keep the tracking issue open for that acceptance scope, and recheck
upstream again before any later PR submission.

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

## 13 October 2026 integration

Merged upstream main `0b6087c` (6.1.8) into the personal fork. Backup branch:
`backup/pre-6.1.8-20261013`. Upstream now owns passkey handoff, authentication
recovery, and semantic Interrupt hook ownership; the older fork variants were
retired. The fork retains read-only external catalogue checks, catalogue evidence
provenance, and specific turn retirement/abort messages. Catalogue request errors
are reported without treating a failed request as successful route verification.

The launcher uses patched `smol-toml` 1.9.1. CodexDesktopPatches supplies explicit
GPT-5.6 family routes for its named 5.6 Sol row; historical aliases retain generic
profiles. The local provider IDs, default provider, and config remain owned by
CodexDesktopPatches. Do not run upstream setup to replace them.

Validation: runtime suite initially 938 passed, 60 skipped, one outdated guard-order
assertion failed. The catalogue-ownership test now isolates that guard using the
built-in provider; the 49 integration tests pass. Launcher suite: 444 passed,
one skipped. Runtime/launcher type checks, renderer build, relocatable runtime
smoke and runtime dependency audit pass. The launcher audit also passes after the
parser upgrade. Packaging verifies the macOS signature and bundled runtime.
Browser fixture skips do not establish authenticated account/model execution.

Installed-app validation caught the upstream custom-provider startup guard. The
fork accepts an existing managed route behind `local_model_bridge` only when its
provider URL is exactly http://127.0.0.1:48111/v1 and a bounded readable external
catalogue contains visible ChatGPT Web entries. Other custom providers and new
foreign-catalogue installs remain guarded. Tests cover healthy startup/preflight,
provider/port mismatches, hidden/empty/malformed catalogues, and config preservation.
