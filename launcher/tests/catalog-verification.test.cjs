const test = require("node:test");
const assert = require("node:assert/strict");
const { catalogVerificationPatch, legacyCatalogVerificationPatch } = require("../electron/catalog-verification.cjs");

const pending = { coreSetupComplete: true, codexCatalogVerified: false, codexRestartRequired: true };
const bridge = { source: "bridge", readable: true, models: [] };
const external = { source: "external", readable: true, models: [{ slug: "chatgpt-web/pro" }] };

test("external catalogue entries unlock the catalogue gate without clearing the restart requirement", () => {
  const patch = catalogVerificationPatch(pending, external, null);
  assert.deepEqual(patch, { codexCatalogVerified: true, codexCatalogVerificationSource: "external-model-catalog" });
  assert.equal({ ...pending, ...patch }.codexRestartRequired, true);
  assert.equal(pending.codexCatalogVerified, false);
});

test("even previous bridge requests cannot prove an external catalogue was loaded", () => {
  const patch = catalogVerificationPatch(pending, external, { successful_model_catalog_requests: 3 });
  assert.equal(patch.codexCatalogVerificationSource, "external-model-catalog");
  assert.equal(Object.hasOwn(patch, "codexRestartRequired"), false);
});

test("an observed bridge catalogue request clears the restart requirement", () => {
  assert.deepEqual(catalogVerificationPatch(pending, bridge, { successful_model_catalog_requests: 1 }), {
    codexCatalogVerified: true,
    codexCatalogVerificationSource: "codex-request",
    codexRestartRequired: false,
  });
});

for (const count of [undefined, null, 0, -1, 0.5, "1", true, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
  test(`invalid or absent request evidence cannot verify the runtime: ${String(count)}`, () => {
    assert.equal(catalogVerificationPatch(pending, bridge, { successful_model_catalog_requests: count }), null);
  });
}

test("a failed health request cannot manufacture bridge evidence", () => {
  assert.equal(catalogVerificationPatch(pending, bridge, null), null);
});

test("missing routes, invalid configs and empty catalogues cannot unlock setup", () => {
  assert.equal(catalogVerificationPatch({ ...pending, coreSetupComplete: false }, external, null), null);
  assert.equal(catalogVerificationPatch(pending, { ...external, readable: false }, null), null);
  assert.equal(catalogVerificationPatch(pending, { ...external, models: [] }, null), null);
  assert.equal(catalogVerificationPatch(pending, { ...bridge, source: "unknown" }, { successful_model_catalog_requests: 1 }), null);
});

test("ambiguous legacy verification is rechecked once without changing installed route state", () => {
  assert.deepEqual(legacyCatalogVerificationPatch({ ...pending, codexCatalogVerified: true, codexRestartRequired: false }), {
    codexCatalogVerified: false, codexRestartRequired: true,
  });
  assert.equal(legacyCatalogVerificationPatch(pending), null);
  assert.equal(legacyCatalogVerificationPatch({ ...pending, coreSetupComplete: false, codexCatalogVerified: true }), null);
  for (const source of ["codex-request", "external-model-catalog"]) {
    assert.equal(legacyCatalogVerificationPatch({ ...pending, codexCatalogVerified: true, codexCatalogVerificationSource: source }), null);
  }
});
