const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { catalogVerificationPatch } = require("../electron/catalog-verification.cjs");
const main = fs.readFileSync(path.join(__dirname, "../electron/main.cjs"), "utf8");
const external = { source: "external", readable: true, models: [{ slug: "chatgpt-web-6-pro", visible: true }] };

test("external monitor opens the gate without a model request and revokes removed entries", async () => {
  const start = main.indexOf("function startCatalogVerificationMonitor(");
  const source = main.slice(start, main.indexOf("\nfunction ", start + 1));
  const state = { coreSetupComplete: true, codexCatalogVerified: false, codexRestartRequired: true };
  let picker = external;
  let tick;
  let healthReads = 0;
  let writes = 0;
  const errors = [];
  vm.runInNewContext(source + "\nstartCatalogVerificationMonitor({ logger, stateStore });", {
    LAUNCHER_PROFILE: { codexHome: "/unused" },
    catalogVerificationPatch, inspectCodexModelPicker: () => picker,
    catalogVerificationInFlight: false, catalogVerificationTimer: null, lastOperation: null,
    stopCatalogVerificationMonitor() {},
    runtimeSupervisor: { readConfig: () => ({}), proxyHealthPayload: async () => { healthReads++; return {}; } },
    stateStore: { read: () => ({ ...state }), update: patch => { writes++; return Object.assign(state, patch); } },
    setInterval: callback => { tick = callback; return { unref() {} }; },
    logger: { info() {}, debug: (...args) => errors.push(args) }, send() {},
  });
  const poll = async () => { tick(); await new Promise(resolve => setImmediate(resolve)); };
  assert.equal(state.codexCatalogVerified, true);
  assert.equal(state.codexCatalogVerificationSource, "external-model-catalog");
  assert.equal(state.codexRestartRequired, true, "file evidence must not assert a restart");
  await poll();
  assert.equal(writes, 1, "unchanged checks should not keep rewriting state");
  picker = { ...external, models: [] };
  await poll();
  assert.equal(state.codexCatalogVerified, false);
  picker = external;
  await poll();
  assert.equal(state.codexCatalogVerified, true);
  picker = { ...external, readable: false, error: "Model catalog is unreadable" };
  await poll();
  assert.equal(state.codexCatalogVerified, false);
  assert.equal(healthReads, 0, "external evidence does not require a fabricated catalog request");
  assert.deepEqual(errors, []);
});

test("reinstalling an already configured external catalogue never invokes setup", async () => {
  const source = main.slice(main.indexOf('handle("launcher:setup-core",'), main.indexOf('handle("launcher:setup-mcp",'));
  const state = { coreSetupComplete: true, codexCatalogVerified: false, codexRestartRequired: true };
  let setup;
  let installs = 0;
  vm.runInNewContext(source, {
    handle: (_name, handler) => { setup = handler; }, IS_DEV_PROFILE: false,
    LAUNCHER_PROFILE: { codexHome: "/unused" }, inspectCodexModelPicker: () => external,
    catalogVerificationPatch,
    stateStore: { read: () => state, update: patch => Object.assign(state, patch) },
    runtimeHost: { setupCore: async () => { installs++; } },
    send() {}, startCatalogVerificationMonitor() {}, logger: {},
  });
  assert.equal((await setup()).ok, true);
  assert.equal(installs, 0);
  assert.equal(state.codexCatalogVerified, true);
  assert.equal(state.codexRestartRequired, true);
});

test("a catalogue containing only hidden compatibility aliases cannot unlock setup", () => {
  assert.equal(catalogVerificationPatch({ coreSetupComplete: true }, {
    ...external, models: [{ slug: "chatgpt-web-pro", visible: false }],
  }, null), null);
});
