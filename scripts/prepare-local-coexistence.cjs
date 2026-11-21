// Prepare a reversible macOS launcher candidate without touching Codex or the live app.
// Usage: node scripts/prepare-local-coexistence.cjs /absolute/output-directory [installed-app]
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const asar = require("../launcher/node_modules/@electron/asar");

async function main() {
  if (process.platform !== "darwin") throw new Error("This local packaging helper requires macOS");
  const output = process.argv[2];
  if (!output || !path.isAbsolute(output) || fs.existsSync(output)) {
    throw new Error("Supply a new absolute output directory");
  }
  const root = path.resolve(__dirname, "..");
  const installed = process.argv[3] || "/Applications/Codex Web GPT.app";
  const original = path.join(installed, "Contents/Resources/app.asar");
  const pkg = JSON.parse(asar.extractFile(original, "package.json"));
  if (pkg.version !== "5.0.8") throw new Error("Review and port the compatibility changes before patching another version");
  const upstream = execFileSync("git", ["show", "v5.0.8:launcher/electron/main.cjs"], { cwd: root });
  const current = fs.readFileSync(path.join(root, "launcher/electron/main.cjs"));
  const existing = asar.extractFile(original, "electron/main.cjs");
  if (!existing.equals(upstream) && !existing.equals(current)) {
    throw new Error("Installed launcher contains other changes; review them before packaging");
  }
  execFileSync("bun", ["run", "launcher:build"], { cwd: root, stdio: "inherit" });
  fs.mkdirSync(output, { recursive: true, mode: 0o700 });
  const bundle = path.join(output, "Codex Web GPT.app");
  execFileSync("/bin/cp", ["-cR", installed, bundle]);
  const stage = path.join(output, "asar");
  const archive = path.join(bundle, "Contents/Resources/app.asar");
  asar.extractAll(original, stage);
  for (const name of ["main.cjs", "codex-catalog-route.cjs", "catalog-verification.cjs"]) {
    fs.copyFileSync(path.join(root, "launcher/electron", name), path.join(stage, "electron", name));
  }
  fs.rmSync(path.join(stage, "dist"), { recursive: true });
  fs.cpSync(path.join(root, "launcher/dist"), path.join(stage, "dist"), { recursive: true });
  fs.cpSync(path.join(root, "launcher/node_modules/smol-toml"), path.join(stage, "node_modules/smol-toml"), { recursive: true });
  pkg.dependencies = { ...pkg.dependencies, "smol-toml": "1.8.0" };
  fs.writeFileSync(path.join(stage, "package.json"), JSON.stringify(pkg, null, 2) + "\n");
  await asar.createPackageWithOptions(stage, archive, { unpack: "assets/linux-appimage-runner.sh" });
  const hash = crypto.createHash("sha256").update(asar.getRawHeader(archive).headerString).digest("hex");
  execFileSync("/usr/libexec/PlistBuddy", ["-c", `Set :ElectronAsarIntegrity:Resources/app.asar:hash ${hash}`, path.join(bundle, "Contents/Info.plist")]);
  const entitlements = path.join(output, "entitlements.plist");
  fs.writeFileSync(entitlements, execFileSync("/usr/bin/codesign", ["-d", "--entitlements", ":-", installed], { stdio: ["ignore", "pipe", "ignore"] }));
  execFileSync("/usr/bin/codesign", ["--force", "--sign", "-", "--options", "runtime", "--entitlements", entitlements, bundle]);
  execFileSync("/usr/bin/codesign", ["--verify", "--deep", "--strict", bundle]);
  console.log(`Candidate verified: ${bundle}\nThe live application has not been changed.`);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
