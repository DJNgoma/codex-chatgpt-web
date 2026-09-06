const fs = require("node:fs");
const path = require("node:path");
const { parse } = require("smol-toml");

// A catalog large enough to exhaust memory is not a catalog we can answer questions about.
const MAX_CATALOG_BYTES = 32 * 1024 * 1024;
const MAX_CONFIG_BYTES = 1024 * 1024;
const CHATGPT_WEB_SLUG = /^chatgpt-web([/-]|$)/;

function codexConfigPath(codexHome) {
  const home = typeof codexHome === "string" && codexHome.trim() ? codexHome.trim() : null;
  return home ? path.join(home, "config.toml") : null;
}

// Bound reads on the opened descriptor as well as by stat, and never block on a FIFO.
function readBoundedText(filePath, maxBytes, label) {
  let fd;
  try {
    if (!fs.statSync(filePath).isFile()) throw new Error(`${label} must be a regular file`);
    fd = fs.openSync(filePath, fs.constants.O_RDONLY | fs.constants.O_NONBLOCK);
    const stats = fs.fstatSync(fd);
    if (!stats.isFile()) throw new Error(`${label} must be a regular file`);
    if (stats.size > maxBytes) throw new Error(`${label} is too large to inspect`);
    const buffer = Buffer.alloc(stats.size + 1);
    let size = 0;
    while (size < buffer.length) {
      const count = fs.readSync(fd, buffer, size, buffer.length - size, null);
      if (count === 0) break;
      size += count;
    }
    if (size > stats.size) throw new Error(`${label} changed size while being inspected`);
    return buffer.toString("utf8", 0, size);
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

function configuredCatalog(codexHome) {
  const configPath = codexConfigPath(codexHome);
  if (!configPath) return { source: "unknown", catalogPath: null, error: "Codex configuration home is unavailable" };
  let text;
  try {
    text = readBoundedText(configPath, MAX_CONFIG_BYTES, "Codex config");
  } catch (error) {
    return { source: "unknown", catalogPath: null, error: fileError("Codex config", error) };
  }
  let config;
  try {
    config = parse(text);
  } catch {
    // Parser errors can contain the offending config line, including secrets. Do not echo it.
    return { source: "unknown", catalogPath: null, error: "Codex config is not valid TOML" };
  }
  if (!Object.hasOwn(config, "model_catalog_json")) {
    return { source: "bridge", catalogPath: null, error: null };
  }
  const catalogPath = config.model_catalog_json;
  if (typeof catalogPath !== "string" || !catalogPath.trim() || !path.isAbsolute(catalogPath)) {
    return { source: "external", catalogPath: null, error: "model_catalog_json must be a non-empty absolute path" };
  }
  return { source: "external", catalogPath, error: null };
}

// Codex only requests this bridge's model catalog when it builds its picker from the
// route we install. A config that pins a top-level `model_catalog_json` builds the
// picker from that file instead and never calls us, so a check that waits for that
// request can never complete. Every `setup` run resets the verification flag, so the
// MCP page otherwise locks itself again halfway through its own flow and stays locked.
function codexUsesExternalModelCatalog(codexHome) {
  const config = configuredCatalog(codexHome);
  return config.source === "external" && config.error === null;
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
  let text;
  try {
    text = readBoundedText(catalogPath, MAX_CATALOG_BYTES, "Model catalog");
  } catch (error) {
    return { readable: false, models: [], error: fileError("Model catalog", error) };
  }
  try {
    const catalog = JSON.parse(text);
    if (!catalog || !Array.isArray(catalog.models)) {
      return { readable: false, models: [], error: "Model catalog must contain a models array" };
    }
    return { readable: true, models: chatGptWebModelsIn(catalog), error: null };
  } catch {
    return { readable: false, models: [], error: "Model catalog could not be read as JSON" };
  }
}

function fileError(label, error) {
  // Filesystem errors use stable codes; our own bounded-read errors contain no file contents.
  return error?.code ? `${label} is unreadable (${error.code})` : error.message;
}

// Answers the only question the Install models button can otherwise answer by redoing its work:
// which source builds Codex's picker, and does that source already list the ChatGPT Web models.
// Read-only by construction — it never asks this bridge for `/v1/models`, because that request is
// the launcher's proof that *Codex* restarted onto the route, and asking for it here would forge it.
function inspectCodexModelPicker(codexHome) {
  const config = configuredCatalog(codexHome);
  if (config.error) {
    return { ...config, readable: false, models: [] };
  }
  if (config.source === "bridge") {
    return { ...config, readable: true, models: [] };
  }
  return { ...config, ...readExternalCatalog(config.catalogPath) };
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
