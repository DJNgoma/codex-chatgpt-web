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
