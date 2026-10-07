import { strict as assert } from "node:assert";
import { after, before, test } from "node:test";
import { freshStore, mockNetwork, req, restoreNetwork } from "./helpers.js";
import settings from "../api/settings.js";
import { readSecret, type MemoryBackend } from "../lib/store.js";

let store: MemoryBackend;
before(async () => {
  store = await freshStore(false);
  mockNetwork((c) => (c.url.includes("exa.ai") ? { body: { results: [] } } : c.url.includes("parallel.ai") ? { status: 401, body: {} } : undefined));
});
after(restoreNetwork);

async function login(): Promise<string> {
  const res = await settings.fetch(req("/settings", { method: "POST", form: { action: "login", password: "correct horse battery staple" } }));
  assert.equal(res.status, 303);
  return res.headers.get("set-cookie")!.split(";")[0];
}

async function csrfFrom(cookie: string): Promise<string> {
  const html = await (await settings.fetch(req("/settings", { headers: { cookie } }))).text();
  return /name="csrf" value="([^"]+)"/.exec(html)![1];
}

test("settings need the admin password", async () => {
  const res = await settings.fetch(req("/settings"));
  assert.match(await res.text(), /Admin password/);
  const wrong = await settings.fetch(req("/settings", { method: "POST", form: { action: "login", password: "guess" } }));
  assert.equal(wrong.status, 401);
});

test("keys can be saved and removed but never displayed", async () => {
  const cookie = await login();
  const csrf = await csrfFrom(cookie);
  const secret = "exa-SUPER-secret-value-987";

  const saved = await settings.fetch(req("/settings", { method: "POST", headers: { cookie }, form: { action: "save", name: "EXA_API_KEY", value: secret, csrf } }));
  assert.equal(saved.headers.get("location"), "https://search.example.com/settings?m=saved");
  assert.equal(await readSecret("EXA_API_KEY"), secret);
  assert.ok(!store.body!.includes(secret), "stored encrypted");

  const html = await (await settings.fetch(req("/settings?m=saved", { headers: { cookie } }))).text();
  assert.ok(!html.includes(secret), "value never shown");
  assert.match(html, /saved/);

  const removed = await settings.fetch(req("/settings", { method: "POST", headers: { cookie }, form: { action: "remove", name: "EXA_API_KEY", csrf } }));
  assert.match(removed.headers.get("location")!, /m=removed/);
  assert.equal(await readSecret("EXA_API_KEY"), null);
});

test("changes need the page's token", async () => {
  const cookie = await login();
  const res = await settings.fetch(req("/settings", { method: "POST", headers: { cookie }, form: { action: "save", name: "EXA_API_KEY", value: "x", csrf: "forged" } }));
  assert.match(res.headers.get("location")!, /m=expired/);
  assert.equal(await readSecret("EXA_API_KEY"), null);
});

test("check reports whether each key works without revealing it", async () => {
  const cookie = await login();
  const csrf = await csrfFrom(cookie);
  await settings.fetch(req("/settings", { method: "POST", headers: { cookie }, form: { action: "save", name: "EXA_API_KEY", value: "k1", csrf } }));
  await settings.fetch(req("/settings", { method: "POST", headers: { cookie }, form: { action: "save", name: "PARALLEL_API_KEY", value: "k2", csrf } }));
  const res = await settings.fetch(req("/settings", { method: "POST", headers: { cookie }, form: { action: "check", csrf } }));
  assert.equal(res.headers.get("location"), "https://search.example.com/settings?exa=200&parallel=401&firecrawl=missing");
});
