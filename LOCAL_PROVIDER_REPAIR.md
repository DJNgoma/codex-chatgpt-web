# Codex Web GPT 6.1.19 local provider update

## Where this lives

This is the record for the 6.1.19 local build of the personal fork
`DJNgoma/codex-chatgpt-web`, the build installed at
`/Applications/Codex Web GPT.app`. Its source is branch
`codex/local-provider-6.1.19`, which is merged into `main`. The only working
copy is `~/Developer/codex-chatgpt-web`, checked out on `main`. The per-version
sibling folders were consolidated into it on 21 November 2026.

`FORK_WORKFLOW.md` on `main` has the branch map, the list of local fixes and
the steps for taking a new upstream release. Installed builds are tagged
`local-build/<version>-r<n>`.

Private evidence for this build is in `repair-evidence/`. Earlier versions are
in `repair-evidence/archive/`. That directory is local only and is never
committed.

This local build is based on upstream v6.1.19, commit
`8e9fac038dcd998bf23716df2b08379a15854ec9`. It carries forward the provider
and current-turn calendar fixes from the reviewed 6.1.18 build. Upstream
6.1.19 incorporates the passkey storage fix, including the 10 MiB aggregate
UTF-16 limit. The upstream localized browser settings and session lifecycle
changes are included.

## Provider and updater behavior

- The Web runtime accepts the existing `local_model_bridge` provider at
  `http://127.0.0.1:48111/v1` when its configured absolute catalogue contains
  visible `chatgpt-web-*` models. CodexDesktopPatches owns the main bridge,
  provider aliases and picker catalogue. The Web launcher owns its runtime
  on port 17841.
- The launcher recognizes the external catalogue without marking a native
  catalogue request or restart as verified. Current-turn calendar fragments
  still require exact native rollout provenance and matching turn context.
- New upstream versions appear in the sidebar and settings as requiring a
  compatibility review. The sidebar opens update settings. Those settings
  explain how to get a reviewed build and allow a fresh release check.
  The packaged updater rejects direct installation before any download or
  installer startup. The next reviewed build should be rebuilt from its
  upstream release tag and tested against the installed DesktopPatches lane.

## Rebuilt preamble after mid-turn compaction (21 November 2026)

Codex CLI 0.171 rebuilds the AGENTS.md and environment message during a
compaction inside a running turn. That item exists only in the rollout's
`compacted.replacement_history`. Its wire copy carries no
`internal_chat_message_metadata_passthrough`. The historical verifier searched
ordinary response items before the task boundary, so every request after such
a compaction failed with "Codex rollout does not authenticate the historical
environment messages" and the goal stalled.

The verifier now also accepts an unattributed environment message when:

- an earlier task's native compaction recorded that exact user message. It
  stays contextual history and grants nothing.
- the running task's latest native compaction recorded that exact user
  message. It is then a current claim. The store parses its single complete
  environment fragment and compares it with this turn's native authority,
  exactly like the existing compaction continuation path. It never changes
  the environment the turn runs with (see the next section).

An ordinary response item recorded after the task boundary still never becomes
historical. A repeated id, a non-user item, changed content and a superseded
compaction are all still rejected. The date-only calendar preamble does not
gain the current-task compaction route. Like any other message it can be
proven historical by an earlier task's compaction.

Changed files: `src/adapters/chatgpt-web/codex-rollout-environment.ts`,
`environment.ts`, `thread-environment.ts` and `tests/environment.test.ts`
(six tests named "rebuilt preamble" and "calendar preamble does not gain the
compaction route"). Runtime tests: 1178 passed, 112 skipped, 0 failed.

The rebuild replaced only the runtime in the reviewed 6.1.19 bundle. Of 4905
runtime files, `app/cli.js` is the only one that changed. The ASAR is
unchanged. Activated on 21 November 2026 with
`repair-evidence/activate-reviewed-r2.py`.

- Installed runtime CLI SHA-256:
  `86a2997fe0abd9aa75d059cfdf1c7e0a0debba3d155f81d03be45134eaa484c9`
- Runtime bundle id:
  `c3127c22a7ecb1763a0cea219d018103e022886a35310a4bcfd08d9a35194053`
- Rollback bundle:
  `~/.codex/backups/web-coexistence-6.1.19-r2-20261121T104238Z/Codex Web GPT.app`

Replay of the four real request moments, before and after, is in
`repair-evidence/rebuilt-preamble/`. This fix is not upstream as of v6.1.19.
Carry it into the next reviewed build.

## Stable environment across rounds (21 November 2026, build r3)

The first build of the fix above let the first request after a mid-turn
compaction through, and the turn then failed on its second round with "ChatGPT
stopped responding after the task started". The rebuilt preamble's claim merged
its roots into the Full Access workspace list for round one. Once the model had
answered, the same preamble no longer read as a current update, round two
resolved from the rollout alone, and the broker refused the tool loop with
"Codex turn environment changed during an active ChatGPT tool loop".

A rebuilt preamble is still compared with the native authority and rejected on
conflict. It no longer shapes the returned environment. Commit `ac2f8aa`.
Activated with `repair-evidence/activate-reviewed-r3.py`.

- Installed runtime CLI SHA-256:
  `a1206f43252e4731bcdd8fdaa1cdb03f2590be791e346773edf83273090dc172`
- Runtime bundle id prefix: `7eb2676f7edf97ed`
- Tag: `local-build/6.1.19-r3`. The earlier build is `local-build/6.1.19-r2`.
- Rollback bundle:
  `~/.codex/backups/web-coexistence-6.1.19-r3-20261121T111307Z/Codex Web GPT.app`

## Audit of 21 November 2026

An independent read of the whole local patch set found no fail-open path and no
blocking defect in the authentication changes. It did find the items below.
Three commits follow build r3 and are **not installed yet**. They are packaged
as build r4, which is prepared and waits for the launcher to be idle:

- Candidate: `launcher/build/reviewed-6.1.19-r4/mac-arm64/Codex Web GPT.app`
- ASAR SHA-256:
  `78602f6adcf8fb3927fcde44154a1626d066352b42b956da23d9ec4cca1f4284`.
  Two of its 1,063 files differ from the installed ASAR:
  `electron/catalog-verification.cjs` and `electron/codex-catalog-route.cjs`.
- Runtime CLI SHA-256:
  `a8feb056c94b7777648dde9f263ffb24fe1e601acba8cac6d1cfab0699e70411`
- Activate from the checkout root with
  `python3 repair-evidence/activate-reviewed-r4.py`, then tag the commit
  `local-build/6.1.19-r4`.

Changed:

- **Rollout scan time.** Verifying an unattributed environment message took
  29 s on a real 6.7 GB rollout, on the first request of every turn. Records
  spanning read chunks are now joined once instead of re-copied per chunk, and
  before the task boundary only records that name a task boundary or carry a
  claimed message id are parsed. The same request takes 5.9 s. Commit `d006957`.
- **Record size bound.** Raised from 16 MiB to 64 MiB. Native compaction
  records already exceed 10 MiB on this task and grow with it. One record over
  the bound failed every later verification of the thread. Commit `d006957`.
- **Turn diagnostics.** Fork `main` carried turn-retirement and client
  disconnect diagnostics on 6.1.8. They were dropped without record when the
  patch set moved to per-release branches. They are restored, and a submitted
  turn that fails now logs its real reason as `submitted_turn_failed`. Commit
  `16ab981`.
- **Hidden catalogue rows.** The launcher counted hidden ChatGPT Web rows as
  proof that the external catalogue lists the models. It now needs a visible
  row, as the runtime already did. Commit `8f4dcbe`.

Reviewed and left as they are:

- `codexRestartRequired` stays set under an external catalogue. A file cannot
  prove that Codex restarted, so this is the intended evidence policy.
- The updater's review-required policy depends on `localBuildPolicy` in the
  packaged manifest. A launcher test asserts the manifest carries it.
- `TROUBLESHOOTING.md` additions from fork `main` were not ported.

Known limits:

- An ordinary environment update recorded after a mid-turn compaction, in the
  same turn, is still rejected together with the rebuilt preamble. The wire has
  no provenance to tell the two apart. This would stall the turn again.
- A date-only preamble rebuilt by a compaction in the running turn is still
  rejected by design.
- The first request of a turn still reads the whole rollout once.

Verification of the audit commits: runtime tests 1197 passed, 112 skipped, 0
failed. Launcher tests 501 passed, 1 skipped, 0 failed. Both type checks pass.
`bun audit` reports no vulnerabilities in either dependency set.

## Verification and rollback

Runtime tests passed (1172 passed, 112 skipped). Launcher tests passed
(499 passed, 1 skipped), including update settings in all five locales,
review-required state, and the standard updater. Runtime and launcher
typechecks, renderer build, isolated provider comparison against the
checksummed upstream runtime, and relocatable runtime smoke passed.
The ad-hoc-signed macOS package passed deep/strict signature verification and
isolated startup and clean exit. Running the updater directly from the
packaged ASAR confirmed review-required status and zero download attempts
for a simulated future release.

The app was installed at `/Applications/Codex Web GPT.app` on 20 November
2026. The live runtime reported 6.1.19 and an active route. The managed
runtime matched the packaged CLI hash. Codex's provider blocks, default
provider and catalogue hash matched the pre-update snapshot. Startup
refreshed the existing Interrupt hook and its trusted hash to use the new
runtime. The main bridge remained healthy.

- Installed ASAR SHA-256:
  `aff923448636d26dd9ac1156eb5e6868a2625288222d6bbfb3332ae582a40994`
- Installed runtime CLI SHA-256:
  `397c405b5d65679273c8aa6582f2899f8637a3d06f65abb2082a093a2b24f115`
- Rollback bundle:
  `~/.codex/backups/web-coexistence-6.1.19-20261120T064408Z/Codex Web GPT.app`

To roll back, drain and quit only the idle Codex Web GPT launcher, restore
the 6.1.18 bundle, reopen it, and verify the runtime and route. Leave native
ChatGPT and the main bridge running. The backup TOML is for comparison.

Useful checks from this worktree:

```sh
bun scripts/smoke-local-provider.ts launcher/build/runtime /path/to/upstream/runtime
python3 scripts/smoke-local-package.py "/path/to/Codex Web GPT.app"
bun scripts/verify-installed-providers.mjs
```

Run `check-codex-local-bridge-chatgpt-web.sh` and
`check-codex-update-health.sh --fast` from CodexDesktopPatches before and
after activation. Private evidence is in the local `repair-evidence/` directory.
