const fs = require("node:fs");
const path = require("node:path");

// Codex only requests this bridge's model catalog when it builds its picker from the
// route we install. A config that pins a top-level `model_catalog_json` builds the
// picker from that file instead and never calls us, so a check that waits for that
// request can never complete. Every `setup` run resets the verification flag, so the
// MCP page otherwise locks itself again halfway through its own flow and stays locked.
//
// Only the region before the first table header holds top-level assignments, so a
// `model_catalog_json` inside `[some.table]` must not count.
function codexUsesExternalModelCatalog(codexHome) {
  const home = typeof codexHome === "string" && codexHome.trim() ? codexHome.trim() : null;
  if (!home) return false;
  let text;
  try {
    text = fs.readFileSync(path.join(home, "config.toml"), "utf8");
  } catch {
    return false;
  }
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("#")) continue;
    if (line.startsWith("[")) break;
    if (/^model_catalog_json\s*=/.test(line)) return true;
  }
  return false;
}

module.exports = { codexUsesExternalModelCatalog };
