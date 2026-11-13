# Local provider repair — 13 November 2026

The installed and running Codex Web GPT 6.1.18 now accepts the existing local
model bridge and completes native Web model turns. The reviewed source is on
`codex/local-provider-6.1.18`, based on upstream release commit
`1cc49aaa627a995d3f0cf2f971fde7f764996649`. The original main checkout and dirty
6.1.17 worktree are preserved.

## Confirmed causes and repairs

An upstream application update replaced the previous compatibility patch and
rejected `model_provider = "local_model_bridge"`. The narrow exception requires
that exact identifier, `http://127.0.0.1:48111/v1`, and an absolute readable
catalogue no larger than 4 MiB with visible `chatgpt-web-*` entries. The launcher
recognizes the external catalogue without fabricating catalogue requests or
claiming that the native app restarted.

A real native turn then exposed a second issue: Codex 0.169 groups its current
date/timezone preamble after `task_started`, while Web 6.1.18 authenticated it as
historical context. The repair checks its exact native message ID/content,
current task boundary, full world state and turn context. Filesystem/network
permissions still come from the validated native turn context. Historical
messages retain their existing authentication. Forged wrappers, duplicate IDs,
cross-turn proof and malformed current claims are rejected.

The package now carries `localBuildPolicy.localProviderCoexistence = true` and
`updateInstallPolicy = "reviewed-compatible-build-only"`. Release detection
continues; the built-in updater refuses an unreviewed upstream replacement
before downloading or starting an installer. Future releases need an explicit
compatibility review and rebuild. External installers can still replace an app.

The release review on 13 November selected stable v6.1.18, published 8 November,
over the 11 unreleased commits on upstream main. The user fork had no release
assets, so changing the updater repository alone would not supply safe builds.

## Validation and installed artifact

- Runtime: 1156 passed, 107 skipped, no failures.
- Launcher: 487 passed, 1 skipped, no failures.
- Environment: 172 passed, 1 skipped, including 19 calendar regressions.
- Updater guard: 22 targeted tests; packaged newer-release probe blocks install
  with zero downloads. Unmarked updater behavior retains its tests.
- Runtime/launcher typechecks, renderer/runtime builds, relocatable runtime smoke,
  deep/strict signing and packaged readiness/clean exit passed.
- GPT implemented the repair, Astra independently reviewed and probed environment
  boundaries, and Terra reviewed runtime activation. Grok was not called.

Installed application: `/Applications/Codex Web GPT.app`.

- ASAR SHA-256: `3dfea560a38c84e1dbea41b7f44ab641cc61ca8ce48c6ffcfff6e6b049572f9e`
- Runtime CLI SHA-256: `51d8e37f1f90c5b225476c2a3a9fa7cc3d91e5d3f186b0c22920ad772e49032d`
- Runtime bundle ID: `f2c40165a0a76dee8b1834b5e50abee9d4c99571f42dcb2ec3f63d4ef7fad6a5`
- Local ad-hoc signature; not notarized.

## Live verification

The Web runtime was atomically drained with zero active HTTP/browser turns.
Only Codex Web GPT was quit. Its old launcher/runtime exited and port 17841
was released before the signed bundle was transactionally replaced.

The reopened app runs a new runtime process with the reviewed CLI hash and
bundle ID, including same-version managed-runtime replacement. Port 17841 is
healthy and accepting turns. Route status is installed/active with no errors.
The main bridge on 48111 remains healthy. ChatGPT was not quit or restarted.

One new real native app-server thread used `chatgpt-web-5.6-sol` through
`local_model_bridge`. Its turn completed without error; the archived native
rollout contains `BRIDGE\_WEB\_SMOKE\_OK`, which renders as the requested
`BRIDGE_WEB_SMOKE_OK`. The raw delta-only marker assertion was false because
of Markdown escaping; canonical assistant-message readback verified the result.
The diagnostic thread was archived and no retry inference was needed.

All provider blocks/aliases, the default provider and catalogue setting are
semantically unchanged. The normal first runtime upgrade changed only the
Interrupt hook and trusted hash in the global config. Credential values are
excluded from evidence. No restart-required flag was fabricated or cleared.

Private local evidence is in `repair-evidence/`, including
`calendar-final-artifact.json`, `calendar-installed-result.json`,
`calendar-live-activation.json`, `calendar-live-native-web-smoke.json`,
`config-semantic-verification.json` and `live-route-status.json`.
Evidence/logs are not included in the source commit.

## Reproduction and rollback

Run the isolated coexistence smoke with an explicit unpatched runtime bundle:

```sh
launcher/build/runtime/runtime/bun run scripts/smoke-local-provider.ts \
  launcher/build/runtime /path/to/unpatched-app/Contents/Resources/runtime
python3 scripts/smoke-local-package.py
bun scripts/verify-installed-providers.mjs
```

Backups remain in `~/.codex/backups/web-coexistence-20261113T185121Z`:
the original application, `replaced-original.app`, `pre-calendar-fix.app`, and
protected configuration snapshots. Quit only Codex Web GPT before restoring a
bundle. The original upstream bundle rejects the custom provider again; the
intermediate pre-calendar build starts but retains the native-turn defect.
Do not restore global configuration blindly or remove provider aliases.


## Passkey storage follow-up

The installed ASAR is now `4ee686a3151e34c98c02e45872b16c0a80689ec36beaf3a597b7632c9218e628`
with the separately tested passkey-size correction. Runtime source/identity is
unchanged. Full launcher validation is now 491 passed, 1 skipped. See
[PASSKEY_STORAGE_REPAIR.md](PASSKEY_STORAGE_REPAIR.md) for reproduction, live
activation, backup, remaining user login step and upstream issue991.
