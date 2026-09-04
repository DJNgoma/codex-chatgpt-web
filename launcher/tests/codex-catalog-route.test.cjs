const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { codexUsesExternalModelCatalog } = require("../electron/codex-catalog-route.cjs");

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
