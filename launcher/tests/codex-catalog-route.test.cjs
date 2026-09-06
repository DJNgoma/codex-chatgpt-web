const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const roots = [];
test.afterEach(() => {
  for (const dir of roots.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});
const {
  codexUsesExternalModelCatalog,
  externalCatalogListsChatGptWebModels,
  inspectCodexModelPicker,
} = require("../electron/codex-catalog-route.cjs");

function codexHome(config) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-catalog-route-"));
  roots.push(dir);
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
  roots.push(dir);
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

test("a model_catalog_json that is not a path is reported instead of resolved", () => {
  const home = codexHome("model_catalog_json = 42\n");
  const picker = inspectCodexModelPicker(home);
  assert.equal(picker.source, "external");
  assert.equal(picker.catalogPath, null);
  assert.equal(picker.readable, false);
  assert.match(picker.error, /non-empty absolute path/);
});

for (const [name, config] of [
  ["empty basic string", 'model_catalog_json = ""\n'],
  ["whitespace-only path", 'model_catalog_json = "   "\n'],
  ["missing value", "model_catalog_json =\n"],
  ["duplicate keys", 'model_catalog_json = "/a.json"\nmodel_catalog_json = "/b.json"\n'],
  ["quoted duplicate key", 'model_catalog_json = "/a.json"\n"model_catalog_json" = "/b.json"\n'],
  ["relative path", 'model_catalog_json = "catalog.json"\n'],
  ["boolean value", "model_catalog_json = true\n"],
  ["array value", 'model_catalog_json = ["/a.json"]\n'],
]) {
  test(`invalid catalogue setting fails closed: ${name}`, () => {
    const home = codexHome(config);
    assert.equal(codexUsesExternalModelCatalog(home), false);
    const picker = inspectCodexModelPicker(home);
    assert.equal(picker.readable, false);
    assert.deepEqual(picker.models, []);
    assert.ok(picker.error);
    assert.equal(externalCatalogListsChatGptWebModels(home), false);
  });
}

for (const delimiter of ['"""', "'''"]) {
  test(`assignment text inside ${delimiter} strings is not a catalogue setting`, () => {
    const home = codexHome(`instructions = ${delimiter}\nmodel_catalog_json = "/not-a-setting.json"\n${delimiter}\n`);
    assert.equal(codexUsesExternalModelCatalog(home), false);
    assert.equal(inspectCodexModelPicker(home).source, "bridge");
  });
  test(`table text inside ${delimiter} strings does not hide a real setting`, () => {
    const { dir } = catalogHome(`instructions = ${delimiter}\n[not.a.table]\n${delimiter}\nmodel_catalog_json = "__CATALOG__"\n`, CATALOG);
    assert.equal(externalCatalogListsChatGptWebModels(dir), true);
  });
}

for (const key of ["model_catalog_json", '"model_catalog_json"', "'model_catalog_json'"]) {
  test(`a ${key} key and trailing comment are parsed as TOML`, () => {
    const { dir, catalogPath } = catalogHome(`${key} = "__CATALOG__" # pinned picker\n`, CATALOG);
    assert.equal(codexUsesExternalModelCatalog(dir), true);
    assert.equal(inspectCodexModelPicker(dir).catalogPath, catalogPath);
    assert.equal(externalCatalogListsChatGptWebModels(dir), true);
  });
}

test("basic-string escapes are decoded before the catalogue file is opened", () => {
  const { dir, catalogPath } = catalogHome('model_catalog_json = "__CATALOG__"\n', CATALOG);
  const escaped = JSON.stringify(catalogPath).replace("model-catalog", "model\\u002dcatalog");
  fs.writeFileSync(path.join(dir, "config.toml"), `model_catalog_json = ${escaped}\n`);
  assert.equal(inspectCodexModelPicker(dir).catalogPath, catalogPath);
  assert.equal(externalCatalogListsChatGptWebModels(dir), true);
});

test("literal paths preserve backslashes and hashes without treating them as escapes or comments", () => {
  const home = codexHome("");
  const catalogPath = path.join(home, "catalog#literal.json");
  fs.writeFileSync(catalogPath, CATALOG);
  fs.writeFileSync(path.join(home, "config.toml"), `model_catalog_json = '${catalogPath}' # literal path\n`);
  assert.equal(inspectCodexModelPicker(home).catalogPath, catalogPath);
  assert.equal(externalCatalogListsChatGptWebModels(home), true);
});

test("a missing configuration reports unknown instead of claiming bridge ownership", () => {
  const picker = inspectCodexModelPicker(codexHome(null));
  assert.equal(picker.source, "unknown");
  assert.equal(picker.readable, false);
});

test("parse errors never echo configuration values into diagnostics", () => {
  const home = codexHome('secret = "do-not-expose-this-value"\nsecret = "duplicate"\n');
  const picker = inspectCodexModelPicker(home);
  assert.equal(picker.source, "unknown");
  assert.match(picker.error, /valid TOML/);
  assert.doesNotMatch(picker.error, /do-not-expose|duplicate/);
});

test("non-file catalogue paths are rejected before reading", () => {
  const home = codexHome("");
  fs.writeFileSync(path.join(home, "config.toml"), `model_catalog_json = ${JSON.stringify(home)}\n`);
  const picker = inspectCodexModelPicker(home);
  assert.equal(picker.readable, false);
  assert.match(picker.error, /regular file/);
});

test("oversized catalogues fail closed", () => {
  const { dir, catalogPath } = catalogHome('model_catalog_json = "__CATALOG__"\n', "{}");
  fs.truncateSync(catalogPath, 32 * 1024 * 1024 + 1);
  const picker = inspectCodexModelPicker(dir);
  assert.equal(picker.readable, false);
  assert.match(picker.error, /too large/);
});

test("invalid catalogue shape is not treated as an empty valid catalogue", () => {
  for (const catalog of ["null", "[]", "{}", '{"models": {}}']) {
    const { dir } = catalogHome('model_catalog_json = "__CATALOG__"\n', catalog);
    const picker = inspectCodexModelPicker(dir);
    assert.equal(picker.readable, false);
    assert.deepEqual(picker.models, []);
  }
});
