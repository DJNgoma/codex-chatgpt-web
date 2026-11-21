# CodexDesktopPatches coexistence, 21 September 2026

This is a local compatibility branch based on the installed upstream **v5.0.8**,
not an upstream release or a replacement for CodexDesktopPatches.

## Ownership and cause

CodexDesktopPatches owns `local_model_bridge` on port 48111, its provider aliases,
and `model_catalog_json`. Its ChatGPT Web lane forwards Web turns to the launcher
on port 17841. The launcher owns the signed-in browser and MCP runtime.

The stock launcher only unlocks MCP after observing `/v1/models`. Codex does not
make that request when its picker is supplied by the external catalogue. Updating
the installed launcher to 5.0.8 removed the older fork's catalogue detection and
restored an impossible restart requirement.

Keep those existing owners. Do not replace `model_provider`, remove aliases,
merge the two catalogues by hand, or rerun DesktopPatches appliers to satisfy this
launcher gate. Do not use `unlock-codex-web-gpt-mcp.sh` to manufacture a catalogue
request: that counter cannot prove Codex loaded an external catalogue.

## Compatibility change

- Parse the configured catalogue read-only using pinned `smol-toml` 1.8.0.
- Require a readable catalogue with a visible ChatGPT Web row before unlocking
  MCP. Continue checking and revoke availability if the file or models disappear.
- Record `external-model-catalog` as the evidence source. Preserve the raw restart
  flag; display an external-catalogue explanation instead of claiming a restart
  happened. A model entry alone does not prove a working Web turn or connector.
- Show **Already configured** and prevent redundant core installation for an
  existing external catalogue. Preserve upstream setup and diagnostics otherwise.
- Keep browser smoke and MCP connector verification independent of catalogue
  detection. No browser smoke result or model request is fabricated.

This does not add upstream's rejected external-provider route mode. Normal
launcher lifecycle and MCP setup still use upstream's managed integration journal.
The existing `openai_base_url` is retained; the selected custom provider and the
local bridge's direct native upstream keep ordinary Codex traffic independent of
the Web launcher. Do not manually remove managed journal entries.

## Upstream review

Checked live on 21 September 2026:

- [Issue #324](https://github.com/miuuyy/codex-chatgpt-web/issues/324): provider-scoped
  routing closed as not planned.
- [PR #360](https://github.com/miuuyy/codex-chatgpt-web/pull/360): external-provider
  mode closed without merge; maintainer asks for coordination before another
  implementation.
- [Issue #438](https://github.com/miuuyy/codex-chatgpt-web/issues/438) and
  [PR #473](https://github.com/miuuyy/codex-chatgpt-web/pull/473): related install /
  restart symptoms. PR closed because disabling reinstall did not identify the
  different causes.
- [PR #598](https://github.com/miuuyy/codex-chatgpt-web/pull/598): open browser-host-only
  proposal. It hides MCP and assumes another bridge owner, so it does not fit this
  installation's launcher-owned Full harness.
- Latest published release is v5.0.8. Main has additional stabilization changes;
  this narrow repair does not silently deploy those unreleased changes.

No issue, comment, or PR was posted upstream.

## Validation and maintenance

The full launcher suite passed **358 tests**, with one platform-specific skip.
TypeScript, production renderer build, diff whitespace, and the installed app's
ASAR integrity and code signature checks passed. Added tests exercise the live
monitor callback, revocation, hidden-only entries, and the no-write reinstall path.

After installation, direct checks showed both bridge services healthy, catalogue
verification sourced from the external file with **zero** model-catalogue
requests, and the 5.0.8 browser smoke and MCP checks completed. Immediately after installation, hashes of Codex's configuration, catalogue, bridge
server, and LaunchAgent were unchanged. The final check still matched the
configuration, catalogue, and LaunchAgent. Separate Muse maintenance changed
`server.js` at 18:57:21 and left a backup matching our original hash. The Web
handler was unchanged, the original bridge process remained healthy, and this
task did not edit or restart that bridge.

An ephemeral Codex CLI probe then completed through the existing provider and
catalogue, using the 5.6 Sol Web lane at low effort. It returned
`COEXISTENCE_OK` (Markdown-escaped in the raw stream) with exit code 0. The probe
used the installed provider settings but omitted unrelated MCP/plugin startup;
no tools or file changes were requested. This proves the response route; the
separate launcher MCP check supplies connector-verification evidence.

The primary checkout stays on its existing main branch. Source changes live on
`codex/external-catalog-5.0.8` in the sibling `codex-chatgpt-web-coexistence`
worktree. An official launcher update can replace this compatibility build again.
Review and port this small patch before the next update; do not downgrade to the
5.0.4 checkout or blindly install a patch onto another version.

To prepare another candidate from the matching version:

```sh
bun install --frozen-lockfile
bun install --cwd launcher --frozen-lockfile
bun run launcher:test
node scripts/prepare-local-coexistence.cjs /absolute/new/candidate-directory
```

The helper prepares and verifies a separate app bundle. It never installs it or
changes Codex. Close only **Codex Web GPT**, with no active Web turns, before
swapping bundles. Keep the existing bundle for rollback and reopen the launcher.
The original installed bundle from this repair is retained at
`launcher/build/coexistence/original-5.0.8.app`. Rollback restores that bundle while
the launcher is closed; it restores the old detection limitation as well.

One separate diagnostic drift was observed: the DesktopPatches ChatGPT Web
verifier expects two stream-terminal code markers absent from the current server.
Its failure is not evidence that the provider or catalogue is absent. That
verifier and stream behavior need their own review; no bridge applier was run here.
