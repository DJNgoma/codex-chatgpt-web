# Local provider compatibility repair — 2 November 2026

The installed upstream 6.1.17 launcher rejected `model_provider = "local_model_bridge"`
on startup. Its rollback check rejected the same provider, producing the combined
startup/restoration error. The prior local compatibility fix existed in the 6.1.8
checkout but was absent from the updated installed app.

This branch ports the provider and external-catalogue compatibility changes onto
the exact upstream `v6.1.17` tag (`860fa576eb47d9e20d7d8289235bfea94392d2fd`).
It preserves the upstream version and newer runtime/browser implementation.

The provider exception requires the exact `local_model_bridge` name, provider URL
`http://127.0.0.1:48111/v1`, and an absolute, readable, bounded external catalogue
containing visible ChatGPT Web entries. Other custom providers remain rejected.
Catalogue file evidence permits the model availability check without claiming that
Codex has restarted or completed an authenticated browser turn.

## Installation and rollback

- Installed app: `/Applications/Codex Web GPT.app`, version 6.1.17.
- Candidate: `launcher/build/local-provider-6.1.17/mac-arm64/Codex Web GPT.app`.
- Original app: `launcher/build/local-repair-2026-11-02/original-6.1.17.app`.
- Protected file hashes before installation:
  `launcher/build/local-repair-2026-11-02/protected-before.json`.

The launcher was gracefully quit and relaunched. ChatGPT.app and the local model
bridge were not restarted or patched. The bridge retained PID 1145. Its server
and external catalogue remained byte-identical to their pre-installation hashes.
The active default provider and all three provider aliases were preserved. The
launcher's normal upgrade updated its managed Interrupt hook from its 6.1.8 runtime
path to 6.1.17; the overall Codex config hash therefore changed.

To roll back, gracefully quit only Codex Web GPT and restore the original app
bundle. The original lacks this compatibility fix. Do not change the default
provider to satisfy the original guard or remove provider alias blocks.

An upstream app update can replace this locally patched bundle. Port these source
changes to the exact updated version before reinstalling; do not downgrade a newer
app to this build or alter CodexDesktopPatches ownership.

## Verification

- Runtime and launcher type checks passed; renderer build passed.
- Runtime suite: 1116 passed, 106 skipped, zero failures.
- Launcher suite: 481 passed, one skipped, zero failures.
- Relocatable runtime smoke passed.
- Isolated packaged launcher smoke: version 6.1.17, packaged and runtime verified.
- Installed app deep/strict code signature verification passed.
- Live `/healthz` on port 17841: healthy, accepting turns, no active turns.
- Live route inspection: installed, active, no errors.
- Launcher observed the external catalogue and completed bridge connection.
- CodexDesktopPatches bridge verifier: healthy; required models and legacy aliases
  available on port 48111.
- Launch agent: running, RunAtLoad and KeepAlive remain true.
- `codex doctor`: local provider route exists; rollout provider IDs include
  `local_model_bridge`, `openai`, and `claude_code_bridge`, with the custom aliases
  still defined in config.
- CodexDesktopPatches fast update-health check: catalogue accepted by both the
  ChatGPT bundled CLI and PATH Codex CLI. No appliers were run.
- Full read-only ChatGPT ASAR audit: exit 1, 11 UNKNOWN UI patch results, no
  pristine baseline for ChatGPT 26.1027.61615. This does not establish those UI
  customizations as working or broken. ChatGPT.app and the patches were untouched;
  no reapplication was attempted.

ChatGPT login and authenticated model inference are left to the user. Successful
startup/catalogue checks do not establish an authenticated Web turn.
