const test = require("node:test");
const assert = require("node:assert/strict");
const { validatePasskeyLoginState } = require("../electron/passkey-login-state.cjs");

function cookie(name, domain, extra = {}) {
  return {
    name,
    value: `${name}-value`,
    domain,
    path: "/",
    expires: -1,
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    ...extra,
  };
}

test("passkey transfer retains only portable ChatGPT/OpenAI state", () => {
  const state = validatePasskeyLoginState({
    cookies: [
      cookie("chatgpt", ".chatgpt.com"),
      cookie("openai", "auth.openai.com"),
      cookie("partitioned", ".chatgpt.com", { partitionKey: "https://accounts.google.com" }),
      cookie("identity-provider", ".accounts.google.com"),
      cookie("lookalike", ".chatgpt.com.attacker.example"),
      cookie("userinfo", "attacker.example@chatgpt.com"),
      cookie("port", "chatgpt.com:443"),
    ],
    origins: [
      { origin: "https://chatgpt.com", localStorage: [{ name: "chat", value: "kept" }] },
      { origin: "https://auth.openai.com", localStorage: [{ name: "auth", value: "ignored" }] },
      { origin: "https://accounts.google.com", localStorage: [{ name: "idp", value: "ignored" }] },
    ],
  });

  assert.deepEqual(state.cookies.map(value => value.name), ["chatgpt", "openai"]);
  assert.equal(state.cookies[0].domain, ".chatgpt.com");
  assert.equal(state.cookies[1].domain, undefined);
  assert.deepEqual(state.localStorage, [{ name: "chat", value: "kept" }]);
});

test("passkey transfer fails closed without an allowed session cookie", () => {
  assert.throws(() => validatePasskeyLoginState({
    cookies: [cookie("google", ".accounts.google.com")],
    origins: [],
  }), /no ChatGPT\/OpenAI cookies/);
});

test("passkey transfer rejects malformed allowed-domain cookie fields", () => {
  assert.throws(() => validatePasskeyLoginState({
    cookies: [cookie("broken", ".chatgpt.com", { path: "relative" })],
    origins: [],
  }), /invalid cookie path/);
  assert.throws(() => validatePasskeyLoginState({
    cookies: [cookie("broken", ".chatgpt.com", { sameSite: "Unknown" })],
    origins: [],
  }), /invalid cookie SameSite/);
});

function storageState(localStorage) {
  return { cookies: [cookie("session", ".chatgpt.com")],
    origins: [{ origin: "https://chatgpt.com", localStorage }] };
}

test("passkey transfer preserves a browser-valid value above the old generic string limit", () => {
  const value = "x".repeat(3 * 1024 * 1024);
  const result = validatePasskeyLoginState(storageState([{ name: "large-state", value }]));
  assert.equal(result.localStorage[0].value, value);
});

test("passkey transfer accounts for names at the UTF16 storage boundary", () => {
  const value = "x".repeat(5 * 1024 * 1024 - 1);
  assert.equal(validatePasskeyLoginState(storageState([{ name: "k", value }])).localStorage[0].value.length, value.length);
  assert.throws(() => validatePasskeyLoginState(storageState([{ name: "kk", value }])), /local-storage.*too large/);
});

test("passkey transfer bounds aggregate local storage across entries and origins", () => {
  const entry = { name: "state", value: "x".repeat(2 * 1024 * 1024) };
  assert.throws(() => validatePasskeyLoginState(storageState([entry, entry, entry])), /local-storage.*too large/);
  const state = storageState([entry]);
  state.origins.push(state.origins[0], state.origins[0]);
  assert.throws(() => validatePasskeyLoginState(state), /local-storage.*too large/);
});

test("passkey transfer retains general cookie bounds and rejects invalid storage values", () => {
  const state = storageState([]);
  state.cookies[0].value = "x".repeat(2 * 1024 * 1024 + 1);
  assert.throws(() => validatePasskeyLoginState(state), /cookie value is too large/);
  assert.throws(() => validatePasskeyLoginState(storageState([{ name: "key", value: 42 }])), /invalid local-storage value/);
  assert.throws(() => validatePasskeyLoginState(storageState([{ name: "key", value: "x".repeat(5 * 1024 * 1024 + 1) }])), /local-storage.*too large/);
});
