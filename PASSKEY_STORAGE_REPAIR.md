# Passkey session storage-size repair — 13 November 2026

Confirmed upstream bug: both release v6.1.18 and main
`f08d16509e6a5447a0d0f2943abb172c69705160` use the same generic
2 Mi-character string limit for localStorage values. The observed Chrome capture
completed; launcher validation then rejected a value before session import.
Actual private storage keys/values were not inspected or retained.

The repaired validator keeps cookie/name limits independent and accepts valid
large localStorage values, with a 10 MiB aggregate UTF-16 key/value budget.
All origin/domain filters, malformed-state rejection, the 16 MiB transfer-file
bound, temporary cleanup and authentication/session inspection are preserved.
No entries are truncated or silently dropped.

Wrote failure cases and regressions first. The synthetic 3 Mi-character value
fails with the exact reported error in unmodified current upstream source.
After correction: 7 validator tests pass; full launcher suite 491 pass, 1 skip.
An offline real-Electron import preserved all 3,145,728 characters by SHA-256,
set the synthetic allowed cookie, called session inspection, verified cleanup,
and rejected an aggregate oversize transfer without changing existing state.
This is synthetic import verification, not a new live authenticated login.

The first concurrent packaged test reached readiness but timed out during
exit. With other Web GPT instances closed as requested, packaged readiness
and clean exit passed in 9.52 seconds (exit0, runtimeVerified true).
The separate Electron smoke initially lost its result when destroying the last
window triggered exit; it now persists the artifact before app exit. Final
artifact confirms `ok:true`; no production lifecycle change was needed.

Installed signed ASAR SHA-256:
`4ee686a3151e34c98c02e45872b16c0a80689ec36beaf3a597b7632c9218e628`.
Runtime CLI and bundle identity remain the reviewed calendar-fix versions.
The previous installed app is retained at
`~/.codex/backups/web-coexistence-20261113T185121Z/pre-passkey-size-fix.app`.

User authorized closing all Web GPT test instances. macOS had multiple old
builds/backups registered with the same bundle ID. They were unregistered from
LaunchServices without removing their files; the installed app was registered
and its actual running executable path was verified in `/Applications`.
ChatGPT and main bridge48111 remained running. Web runtime17841 is healthy;
provider/default/catalogue settings and all provider aliases are preserved.

Upstream issue filed and body/state read back:
`https://github.com/miuuyy/codex-chatgpt-web/issues/991` (open at verification).
The issue includes only synthetic reproduction and test evidence, no session
state, credentials, private paths, screenshots or full logs.

Real passkey retry remains for Daliso: choose Use passkey and complete the
biometric confirmation. The repaired import is installed and ready.
Private evidence is retained in `repair-evidence/passkey-*` and excluded from
source commits. Repeat the isolated import smoke using the source Electron
binary with `launcher/scripts/smoke-passkey-large-state.cjs` and an absolute
output JSON path; verify `ok:true`, not merely the process exit code.
