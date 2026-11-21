# Personal fork of codex-chatgpt-web

This is `DJNgoma/codex-chatgpt-web`, a personal fork of
[`miuuyy/codex-chatgpt-web`](https://github.com/miuuyy/codex-chatgpt-web). It
exists to run Codex Web GPT beside a separate local model bridge
(CodexDesktopPatches, `http://127.0.0.1:48111/v1`) and to carry a few fixes
until upstream has them. It is not a release channel. Install upstream from
upstream.

Last updated 21 November 2026.

## Where the current work is

**`main` is the source of the build installed locally**: upstream `v6.1.19`
plus the local patch set below. Work happens on `main`.

Installed builds are tagged `local-build/<version>-r<n>`. A tag names the exact
commit whose runtime is running. `main` can be ahead of the newest tag when
fixes are committed but not installed yet. `LOCAL_PROVIDER_REPAIR.md` says
which, with the hashes and the rollback bundle of each build.

| Branch | Based on | Status | What it holds |
| --- | --- | --- | --- |
| `main` | upstream `v6.1.19` | **Current** | The installed build's source, this file and the fork banner in the README. |
| `codex/local-provider-6.1.19` | upstream `v6.1.19` | Merged into `main` on 21 Nov 2026 | The 6.1.19 port and its fixes up to the merge. |
| `codex/local-provider-6.1.18` | upstream `v6.1.18` | Superseded | Local provider coexistence, calendar preamble, passkey storage bounds (upstream since 6.1.19). |
| `codex/local-provider-6.1.17` | upstream `v6.1.17` | Superseded | First port of the provider and external-catalogue changes onto an upstream release tag. One snapshot commit of what was installed on 2 Nov 2026. |
| `codex/external-catalog-5.0.8` | upstream `v5.0.8` | Historical | First prototype of the external catalogue checks. One snapshot commit. |
| `codex/passkey-login-integration` | upstream 5.0.4 | Historical, in `main`'s history | Passkey sign-in, catalogue routing, hook recovery. |
| `codex/tunnel-health-rediscovery` | upstream 5.0.4 | Closed upstream PR #354 | Tunnel health rediscovery. |
| `codex/viewport-retry-classification` | upstream 5.0.4 | Closed upstream PR #355 | Viewport retry classification. |
| `codex/runtime-reliability-review` | upstream 5.0.4 | Historical | The two fixes above on one review branch. |
| `passkey-login-supersede` | upstream 5.0.1 | Historical. Do not force-push | Original passkey supersede work. Its pre-rebase state is `backup/passkey-login-supersede-prerebase`. |
| `backup/pre-6.1.8-20261013` | upstream 5.0.4 | Backup | Fork `main` before the 6.1.8 merge. |

Until 21 November 2026 `main` stopped at the 6.1.8 integration and the
installed build lived only on a per-release branch. That 6.1.8 state is commit
`e2d4e4b` in `main`'s history.

## The local patch set

Each reviewed build re-applies these on the exact upstream release tag. Check
upstream first: a fix that has landed upstream is dropped, not carried.

| Fix | Since | Upstream |
| --- | --- | --- |
| Accept the existing `local_model_bridge` provider when its URL is exactly `http://127.0.0.1:48111/v1` and its absolute catalogue lists visible `chatgpt-web-*` models | 6.1.8 | Not upstream, local by design |
| Recognise an external catalogue without claiming a restart or a verified native request. Only visible rows count | 6.1.8, visible rows 21 Nov 2026 | Not upstream, local by design |
| Updater shows new upstream versions as needing a compatibility review and refuses direct installation | 6.1.18 | Not upstream, local by design |
| Authenticate the current-turn date/timezone preamble against its native rollout record | 6.1.18 | Open issue #1004 |
| Authenticate the preamble Codex rebuilds in a mid-turn compaction, without letting it change the turn's environment | 6.1.19 (21 Nov 2026) | Not reported yet |
| Read large rollouts once per record, parse only records that can matter, 64 MiB record bound | 6.1.19 (21 Nov 2026) | Not reported yet |
| Name why a turn ended: turn retirement, client disconnect, and the real reason behind "ChatGPT stopped responding" | 6.1.8, dropped 6.1.17 to 6.1.19, restored 21 Nov 2026 | Not upstream |
| Passkey session import accepts browser-valid local storage with aggregate bounds | 6.1.18 | Fixed in 6.1.19 (issue #991), dropped |

When porting, diff the previous build against its upstream tag and account for
every file. The turn diagnostics were lost for three versions because the port
to 6.1.17 started from a new branch and nothing listed what the old one held:

```sh
git diff --stat v<previous> local-build/<previous>-r<n>
```

## One checkout

There is one working copy: `~/Developer/codex-chatgpt-web`, checked out on
`main`. Remotes: `origin` is this fork, `upstream` is
`miuuyy/codex-chatgpt-web`. `remote.pushDefault` is `origin`.

Do not create sibling folders per version. They were consolidated on
21 November 2026:

| Old folder | Now |
| --- | --- |
| `codex-chatgpt-web` (on the 6.1.8 `main`) | The one checkout, on the current `main` |
| `codex-chatgpt-web-local-provider-6.1.19` | Branch `codex/local-provider-6.1.19`, merged into `main` |
| `codex-chatgpt-web-local-provider-6.1.18` | Branch `codex/local-provider-6.1.18` |
| `codex-chatgpt-web-local-provider-6.1.17` | Branch `codex/local-provider-6.1.17` (uncommitted work recorded as a snapshot commit) |
| `codex-chatgpt-web-coexistence` | Branch `codex/external-catalog-5.0.8` (uncommitted work recorded as a snapshot commit) |

When a second tree is needed, for example to port onto a new upstream tag or to
compare with the previous version, add a temporary worktree inside the checkout
and remove it afterwards:

```sh
git worktree add .worktrees/<name> <branch>
git worktree remove .worktrees/<name>
```

`.worktrees/`, `repair-evidence/` and stray `node_modules` links are ignored
through `.git/info/exclude`. Do not put a test worktree under `/tmp`: the
runtime's durable-path guard fails there.

## Private evidence stays local

Build logs, activation scripts, replay scripts and anything derived from real
Codex threads live in `repair-evidence/` in the checkout. Older versions are
under `repair-evidence/archive/<version>/`. None of it is committed. This fork
is public.

## Moving to a new upstream release

1. `git fetch upstream --tags`, then read the upstream changes since the
   installed tag. Decide which rows of the patch set are still needed.
2. `git worktree add -b codex/local-provider-<new> .worktrees/<new> v<new>`.
3. Port the still-needed fixes from `main` and resolve against the new source.
   Account for every file in `git diff --stat v<previous> main`.
4. `bun install --frozen-lockfile` at the root and in `launcher/`.
5. Run the runtime tests (`bun test ./tests`), the launcher tests
   (`node --test tests/*.test.cjs` in `launcher/`), and both type checks.
6. Build the runtime with the exact Bun pinned in `package.json`
   (`packageManager`). A different Bun version is rejected by the build script.
   The installed app embeds that Bun at
   `Contents/Resources/runtime/runtime/bun`.
7. Package, run `scripts/smoke-local-package.py` and
   `scripts/smoke-local-provider.ts`, then activate with the drain, quit, swap
   and verify script kept in `repair-evidence/`. The launcher must be idle.
8. Write the new build into `LOCAL_PROVIDER_REPAIR.md`, tag the commit
   `local-build/<new>-r1` and push the branch and the tag.
9. Merge into `main` so that `main` holds exactly the new branch plus this file
   and the README banner, then remove the worktree:

   ```sh
   git switch main
   git merge --no-commit --no-ff -s ours codex/local-provider-<new>
   git read-tree -u --reset codex/local-provider-<new>
   git checkout ORIG_HEAD -- FORK_WORKFLOW.md   # then re-add the README banner
   git commit
   ```

A runtime-only fix on the installed version does not need a full package. Build
the runtime, replace `Contents/Resources/runtime` in a copy of the installed
app, re-sign it ad hoc and activate it. A change under `launcher/` does need a
full package, because the ASAR changes.

Publishing to this fork is fine. Opening an upstream pull request or issue
needs the owner's explicit confirmation each time. Never push `v*` tags here:
the release workflow is tag-triggered.

## History

### 21 November 2026: consolidation, audit and merge

The per-version folders were reduced to one checkout. A stall after every
mid-turn compaction was fixed in two builds (`local-build/6.1.19-r2`, `-r3`).
An audit of the whole patch set followed: see `LOCAL_PROVIDER_REPAIR.md`.
`codex/local-provider-6.1.19` was then merged into `main` with the branch's
exact tree, so `main` is the installed build's source again. Nothing was
force-pushed.

### 6 September 2026: fork setup and integration rationale

Recorded on 6 September 2026. This is a fork-maintenance record, not an upstream
release-readiness claim.

### Repository ownership and defaults

- Personal fork and push target: `DJNgoma/codex-chatgpt-web` (`origin`).
- Upstream source: `miuuyy/codex-chatgpt-web` (`upstream`).
- This checkout's GitHub CLI default is the personal fork. Repository-local Git
  settings are `remote.pushDefault = origin` and `push.default = simple`.
- Fetch upstream changes for review, then integrate only the changes deliberately
  selected for a work branch. No automatic upstream merge, pull, release, or
  deployment has been configured. Upstream issues and PRs require an explicit
  repository target.

### Why a new integration branch exists

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

### Verification of the committed application snapshot

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

### Catalogue fix and fork merge validation

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

### Remaining review and publication gates

Fork integration is authorised. Packaged-app acceptance on the other platforms
and installed login/session testing are not established by the macOS verification
pipeline. Keep the tracking issue open for that acceptance scope, and recheck
upstream again before any later PR submission.

Publishing to the personal fork is authorised. Opening an upstream PR remains
subject to the owner's explicit confirmation after the final diff, duplicate-fix
assessment, and actual test results have been presented.

### Active-use safety

Git metadata changes, isolated tests, and fork pushes do not require closing
ChatGPT. This work does not install a build, replace a running runtime, edit the
live Codex configuration, stop an app, or restart a service. No release tags are
pushed. The inspected `main` push workflow runs CI; release publication is
tag-triggered.

Installed login/session and restart-dependent acceptance checks remain deferred.
Explain the exact interruption and obtain approval before any such test changes
active use.

### Assistance acknowledgement

Prepared with assistance from ChatGPT Web GPT-6 Pro.

### 13 October 2026 integration

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
