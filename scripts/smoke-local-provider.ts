import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { defaultConfig, saveConfig } from "../src/config";
import { installCodexIntegration } from "../src/codex-integration";

// Failure cases and scope: repair-evidence/coexistence-smoke-plan.md.
const candidate = resolve(process.argv[2] ?? "launcher/build/runtime");
const upstream = process.argv[3];
assert(upstream, "Provide the unpatched upstream runtime bundle as argument 3; the installed app may already be repaired");
const root = mkdtempSync(join(tmpdir(), "codex-web-local-provider-smoke-"));
process.env.CODEX_HOME = join(root, "codex");
process.env.CODEX_CHATGPT_WEB_HOME = join(root, "web");
mkdirSync(process.env.CODEX_HOME, { recursive: true });
const configPath = join(process.env.CODEX_HOME, "config.toml");
const catalogPath = join(root, "catalog.json");
const listener = Bun.listen({ hostname: "127.0.0.1", port: 0, socket: { data() {} } });
const port = listener.port;
listener.stop();
let child: ReturnType<typeof Bun.spawn> | undefined;
function run(bundle: string, args: string[]) {
  return Bun.spawnSync([join(bundle, "runtime/bun"), join(bundle, "app/cli.js"), ...args], {
    env: process.env, stdout: "pipe", stderr: "pipe", timeout: 15_000,
  });
}
try {
  const config = defaultConfig("browser-only");
  config.port = port;
  config.browserHost = "managed-chrome";
  config.subagentProtocol = "native";
  config.runtimeCommand = [join(candidate, "runtime/bun"), join(candidate, "app/cli.js")];
  saveConfig(config);
  installCodexIntegration(config);
  const catalog = JSON.stringify({ models: [{ slug: "chatgpt-web-6-sol", visibility: "list" }] });
  writeFileSync(catalogPath, catalog);
  const owned = readFileSync(configPath, "utf8");
  const proxy = `model_provider = "local_model_bridge"\nmodel_catalog_json = ${JSON.stringify(catalogPath)}\n${owned}\n`
    + '[model_providers.local_model_bridge]\nbase_url = "http://127.0.0.1:48111/v1"\n'
    + '[model_providers.claude_code_bridge]\nbase_url = "http://127.0.0.1:48111/v1"\n';
  writeFileSync(configPath, proxy);
  const before = run(upstream, ["route", "status"]);
  const oldStatus = JSON.parse(before.stdout.toString());
  assert(oldStatus.errors.some((error: string) => error.includes("custom provider")));
  const after = run(candidate, ["route", "status"]);
  assert.equal(after.exitCode, 0);
  assert.deepEqual(JSON.parse(after.stdout.toString()).errors, []);
  const connect = run(candidate, ["route", "connect"]);
  assert.equal(connect.exitCode, 0, connect.stderr.toString());
  assert.equal(JSON.parse(connect.stdout.toString()).active, true);
  assert.equal(readFileSync(configPath, "utf8"), proxy);
  assert.equal(readFileSync(catalogPath, "utf8"), catalog);
  child = Bun.spawn([...config.runtimeCommand, "serve"], { env: process.env, stdout: "pipe", stderr: "pipe" });
  let health: any;
  for (let i = 0; i < 100; i++) {
    try { health = await (await fetch(`http://127.0.0.1:${port}/healthz`)).json(); if (health.status === "ok") break; } catch {}
    await Bun.sleep(100);
  }
  assert.equal(health?.status, "ok");
  assert.equal(health?.accepting_turns, true);
  assert.equal(readFileSync(configPath, "utf8"), proxy);
  assert.equal(readFileSync(catalogPath, "utf8"), catalog);
  console.log(JSON.stringify({ result: "LOCAL_PROVIDER_COEXISTENCE_SMOKE_OK", version: health.version,
    upstreamRejectionReproduced: true, candidateRouteConnected: true, health: "ok", acceptingTurns: true,
    syntheticConfigUnchanged: true, syntheticCatalogUnchanged: true, inferenceRequests: 0 }, null, 2));
} finally {
  if (child && child.exitCode === null) { child.kill("SIGTERM"); await child.exited; }
  rmSync(root, { recursive: true, force: true });
}
