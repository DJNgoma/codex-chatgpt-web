# Codex Web GPT 6.1.19 local provider update

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
  exactly like the existing compaction continuation path.

An ordinary response item recorded after the task boundary still never becomes
historical. A repeated id, a non-user item, changed content, a superseded
compaction and the date-only calendar preamble are all still rejected.

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
