// Offline Electron integration smoke; never opens the user's browser profile.
const { app, BrowserWindow, session } = require("electron");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { BrowserHost } = require("../electron/browser-host.cjs");
const home = fs.mkdtempSync(path.join(os.tmpdir(), "passkey-size-smoke-"));
app.setPath("userData", home);
const reportPath = process.argv[2];
if (!reportPath) throw new Error("Provide an output JSON artifact path");
const report = { synthetic: true, liveAuthenticationAttempted: false, ok: false };
fs.writeFileSync(reportPath, JSON.stringify({ ...report, phase: "main-loaded" }) + "\n");
const timeout = setTimeout(() => { report.error = "Smoke timeout"; finish(1); }, 30_000);
function finish(code) {
  clearTimeout(timeout);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
  fs.rmSync(home, { recursive: true, force: true });
  app.exit(code);
}
app.whenReady().then(async () => {
  const isolated = session.fromPartition(`passkey-size-smoke-${process.pid}`);
  await isolated.protocol.handle("https", () => new Response("<!doctype html><title>Offline passkey import fixture</title>"));
  const win = new BrowserWindow({ show: false, webPreferences: { session: isolated, sandbox: true, contextIsolation: true } });
  const value = "x".repeat(3 * 1024 * 1024);
  const expectedHash = createHash("sha256").update(value).digest("hex");
  let cleaned = 0, inspected = false;
  const host = Object.assign(Object.create(BrowserHost.prototype), {
    authView: null, turnTabs: new Map(), view: { webContents: win.webContents }, state: { authenticated: false },
    waitForAuthenticated: async () => {
      const cookies = await isolated.cookies.get({ url: "https://chatgpt.com" });
      assert.ok(cookies.some(c => c.name === "synthetic-session" && c.value === "synthetic-only"));
      const readback = await win.webContents.executeJavaScript('localStorage.getItem("large-state")');
      assert.equal(createHash("sha256").update(readback).digest("hex"), expectedHash);
      report.importedCharacters = readback.length;
      report.hashMatched = true;
      host.state.authenticated = true;
      return { authenticated: true };
    },
    runSessionInspection: async () => { inspected = true; },
    activateHomeSurface() {}, show() {}, logger: { info() {} }, snapshot() { return { ...this.state }; },
  });
  const state = { cookies: [{ name: "synthetic-session", value: "synthetic-only", domain: ".chatgpt.com", path: "/", expires: -1, httpOnly: true, secure: true, sameSite: "Lax" }],
    origins: [{ origin: "https://chatgpt.com", localStorage: [{ name: "large-state", value }] }] };
  await host.installPasskeyLogin({ storageState: state, cleanup: async () => { cleaned++; } });
  assert.ok(inspected);
  const invalid = { ...state, origins: [{ origin: "https://chatgpt.com", localStorage: [
    { name: "first", value }, { name: "second", value },
  ] }] };
  await assert.rejects(() => host.installPasskeyLogin({ storageState: invalid, cleanup: async () => { cleaned++; } }), /local-storage.*too large/);
  assert.equal(await win.webContents.executeJavaScript('localStorage.getItem("large-state").length'), value.length);
  assert.equal(cleaned, 2);
  report.invalidTransferPreservedExistingSession = true;
  report.cleanupVerified = true;
  report.sessionInspectionCalled = inspected;
  report.ok = true;
  await isolated.clearStorageData();
  finish(0);
}).catch(error => { report.error = error.message; finish(1); });
