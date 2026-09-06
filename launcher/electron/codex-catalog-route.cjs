const fs = require("node:fs");
const path = require("node:path");

// A catalog large enough to exhaust memory is not a catalog we can answer questions about.
const MAX_CATALOG_BYTES = 32 * 1024 * 1024;
const CHATGPT_WEB_SLUG = /^chatgpt-web([/-]|$)/;

function codexConfigPath(codexHome) {
  const home = typeof codexHome === "string" && codexHome.trim() ? codexHome.trim() : null;
  return home ? path.join(home, "config.toml") : null;
}

// Only the region before the first table header holds top-level assignments, so a key of the
// same name nested in `[some.table]` is a different setting and must not be read as this one.
function readTopLevelAssignment(codexHome, key) {
  const configPath = codexConfigPath(codexHome);
  if (!configPath) return null;
  let text;
  try {
    text = fs.readFileSync(configPath, "utf8");
  } catch {
    return null;
  }
  const assignment = new RegExp(`^${key}\\s*=\\s*(.*)$`);
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("#")) continue;
    if (line.startsWith("[")) break;
    const match = assignment.exec(line);
    if (match) return match[1].trim();
  }
  return null;
}

// A TOML basic string is all this key is ever written as, and a path is not worth a TOML parser.
function unquoteTomlString(value) {
  if (typeof value !== "string") return null;
  const match = /^"([^"]*)"$/.exec(value) || /^'([^']*)'$/.exec(value);
  return match ? match[1] : null;
}

// Codex only requests this bridge's model catalog when it builds its picker from the
// route we install. A config that pins a top-level `model_catalog_json` builds the
// picker from that file instead and never calls us, so a check that waits for that
// request can never complete. Every `setup` run resets the verification flag, so the
// MCP page otherwise locks itself again halfway through its own flow and stays locked.
function codexUsesExternalModelCatalog(codexHome) {
  return readTopLevelAssignment(codexHome, "model_catalog_json") !== null;
}

function chatGptWebModelsIn(catalog) {
  const models = Array.isArray(catalog?.models) ? catalog.models : [];
  const found = [];
  for (const model of models) {
    const slug = typeof model?.slug === "string" ? model.slug : null;
    if (!slug || !CHATGPT_WEB_SLUG.test(slug)) continue;
    found.push({
      slug,
      displayName: typeof model?.display_name === "string" ? model.display_name : slug,
      // Codex hides a `hide` entry from the picker; it is installed but not selectable.
      visible: model?.visibility !== "hide",
    });
  }
  return found;
}

function readExternalCatalog(catalogPath) {
  let stats;
  try {
    stats = fs.statSync(catalogPath);
  } catch (error) {
    return { readable: false, models: [], error: `Model catalog is unreadable: ${messageOf(error)}` };
  }
  if (stats.size > MAX_CATALOG_BYTES) {
    return { readable: false, models: [], error: `Model catalog is too large to inspect: ${stats.size} bytes` };
  }
  try {
    return { readable: true, models: chatGptWebModelsIn(JSON.parse(fs.readFileSync(catalogPath, "utf8"))), error: null };
  } catch (error) {
    return { readable: false, models: [], error: `Model catalog could not be read as JSON: ${messageOf(error)}` };
  }
}

function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}

// Answers the only question the Install models button can otherwise answer by redoing its work:
// which source builds Codex's picker, and does that source already list the ChatGPT Web models.
// Read-only by construction — it never asks this bridge for `/v1/models`, because that request is
// the launcher's proof that *Codex* restarted onto the route, and asking for it here would forge it.
function inspectCodexModelPicker(codexHome) {
  const catalogAssignment = readTopLevelAssignment(codexHome, "model_catalog_json");
  if (catalogAssignment === null) {
    return { source: "bridge", catalogPath: null, readable: true, models: [], error: null };
  }
  const catalogPath = unquoteTomlString(catalogAssignment);
  if (!catalogPath) {
    return {
      source: "external",
      catalogPath: null,
      readable: false,
      models: [],
      error: `model_catalog_json is not a quoted path: ${catalogAssignment}`,
    };
  }
  return { source: "external", catalogPath, ...readExternalCatalog(catalogPath) };
}

// The picker will show ChatGPT Web models only if the source that owns it lists them. An external
// catalog that happens to exist proves nothing on its own: this bridge does not write into one.
function externalCatalogListsChatGptWebModels(codexHome) {
  const picker = inspectCodexModelPicker(codexHome);
  return picker.source === "external" && picker.models.length > 0;
}

module.exports = {
  codexUsesExternalModelCatalog,
  externalCatalogListsChatGptWebModels,
  inspectCodexModelPicker,
};
