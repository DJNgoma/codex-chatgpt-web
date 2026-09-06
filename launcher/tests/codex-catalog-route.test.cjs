const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  codexUsesExternalModelCatalog,
  externalCatalogListsChatGptWebModels,
  inspectCodexModelPicker,
} = require("../electron/codex-catalog-route.cjs");

function codexHome(config) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-catalog-route-"));
  if (config !== null) fs.writeFileSync(path.join(dir, "config.toml"), config);
  return dir;
}

test("a pinned top-level model_catalog_json is an external picker route", () => {
  const home = codexHome([
    'model = "claude-opus"',
    'model_catalog_json = "/Users/example/.codex/local-bridge/model-catalog.json"',
    'model_provider = "local_model_bridge"',
    "",
  ].join("\n"));
  assert.equal(codexUsesExternalModelCatalog(home), true);
});

test("an ordinary Codex config is not an external picker route", () => {
  const home = codexHome('model = "gpt-5.6-sol"\nmodel_provider = "openai"\n');
  assert.equal(codexUsesExternalModelCatalog(home), false);
});

test("model_catalog_json inside a table is not a top-level route", () => {
  // Only assignments before the first table header are top-level; a key of the same
  // name nested in a provider table must not unlock the gate.
  const home = codexHome([
    'model = "gpt-5.6-sol"',
    "",
    "[model_providers.someone_else]",
    'model_catalog_json = "/tmp/not-top-level.json"',
    "",
  ].join("\n"));
  assert.equal(codexUsesExternalModelCatalog(home), false);
});

test("a commented-out assignment does not count", () => {
  const home = codexHome('model = "gpt-5.6-sol"\n# model_catalog_json = "/tmp/disabled.json"\n');
  assert.equal(codexUsesExternalModelCatalog(home), false);
});

test("a missing config or unusable home is not an external route", () => {
  assert.equal(codexUsesExternalModelCatalog(codexHome(null)), false);
  assert.equal(codexUsesExternalModelCatalog(""), false);
  assert.equal(codexUsesExternalModelCatalog(undefined), false);
});

function catalogHome(config, catalog) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-catalog-models-"));
  const catalogPath = path.join(dir, "model-catalog.json");
  if (catalog !== null) fs.writeFileSync(catalogPath, catalog);
  fs.writeFileSync(
    path.join(dir, "config.toml"),
    config.replace("__CATALOG__", catalogPath.replaceAll("\\", "\\\\")),
  );
  return { dir, catalogPath };
}

const CATALOG = JSON.stringify({
  models: [
    { slug: "gpt-5.6-sol", display_name: "GPT-5.6 Sol", visibility: "list" },
    { slug: "chatgpt-web-5.6-sol", display_name: "ChatGPT Web 5.6 Sol", visibility: "list" },
    { slug: "chatgpt-web-pro", display_name: "ChatGPT Web", visibility: "hide" },
    { slug: "chatgpt-web/luna", display_name: "ChatGPT Web — Luna", visibility: "list" },
    { slug: "chatgpt-website-clone", display_name: "Not ours", visibility: "list" },
  ],
});

test("a bridge-owned picker reports no catalog of its own to read", () => {
  const home = codexHome('model = "gpt-5.6-sol"\nopenai_base_url = "http://127.0.0.1:17841/v1"\n');
  assert.deepEqual(inspectCodexModelPicker(home), {
    source: "bridge",
    catalogPath: null,
    readable: true,
    models: [],
    error: null,
  });
  assert.equal(externalCatalogListsChatGptWebModels(home), false);
});

test("an external catalog reports the ChatGPT Web models it lists and their visibility", () => {
  const { dir, catalogPath } = catalogHome('model_catalog_json = "__CATALOG__"\n', CATALOG);
  const picker = inspectCodexModelPicker(dir);
  assert.equal(picker.source, "external");
  assert.equal(picker.catalogPath, catalogPath);
  assert.equal(picker.readable, true);
  // Both slug shapes count; a slug that merely starts with the same letters does not.
  assert.deepEqual(picker.models, [
    { slug: "chatgpt-web-5.6-sol", displayName: "ChatGPT Web 5.6 Sol", visible: true },
    { slug: "chatgpt-web-pro", displayName: "ChatGPT Web", visible: false },
    { slug: "chatgpt-web/luna", displayName: "ChatGPT Web — Luna", visible: true },
  ]);
  assert.equal(externalCatalogListsChatGptWebModels(dir), true);
});

test("an external catalog without ChatGPT Web models is not evidence that the picker has them", () => {
  const { dir } = catalogHome(
    'model_catalog_json = "__CATALOG__"\n',
    JSON.stringify({ models: [{ slug: "gpt-5.6-sol", display_name: "GPT-5.6 Sol" }] }),
  );
  assert.equal(codexUsesExternalModelCatalog(dir), true);
  assert.equal(externalCatalogListsChatGptWebModels(dir), false);
  assert.deepEqual(inspectCodexModelPicker(dir).models, []);
});

test("an unreadable or malformed catalog is reported, never guessed at", () => {
  const missing = catalogHome('model_catalog_json = "__CATALOG__"\n', null);
  const gone = inspectCodexModelPicker(missing.dir);
  assert.equal(gone.readable, false);
  assert.match(gone.error, /unreadable/);
  assert.equal(externalCatalogListsChatGptWebModels(missing.dir), false);

  const broken = catalogHome('model_catalog_json = "__CATALOG__"\n', "{ not json");
  const malformed = inspectCodexModelPicker(broken.dir);
  assert.equal(malformed.readable, false);
  assert.match(malformed.error, /could not be read as JSON/);
});

test("a model_catalog_json that is not a quoted path is reported instead of resolved", () => {
  const home = codexHome("model_catalog_json = 42\n");
  const picker = inspectCodexModelPicker(home);
  assert.equal(picker.source, "external");
  assert.equal(picker.catalogPath, null);
  assert.equal(picker.readable, false);
  assert.match(picker.error, /not a quoted path/);
});
