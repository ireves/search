import { strict as assert } from "node:assert";
import { createHash, randomBytes } from "node:crypto";
import { after, before, test } from "node:test";
import { BASE, freshStore, mockNetwork, req, restoreNetwork } from "./helpers.js";
import mcp from "../api/mcp.js";
import oauth from "../api/oauth.js";
import { bumpEpoch } from "../lib/store.js";

const CALLBACK = "https://claude.ai/api/mcp/auth_callback";

before(async () => {
  await freshStore();
  mockNetwork();
});
after(restoreNetwork);

function pkce() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

async function registerClient(redirect = CALLBACK) {
  const res = await oauth.fetch(req("/register", { method: "POST", json: { redirect_uris: [redirect], client_name: "Claude" } }));
  return { res, body: (await res.json()) as any };
}

async function signIn(clientId: string, redirect: string, challenge: string, password = "correct horse battery staple") {
  return oauth.fetch(
    req("/authorize", {
      method: "POST",
      form: {
        client_id: clientId,
        redirect_uri: redirect,
        code_challenge: challenge,
        code_challenge_method: "S256",
        response_type: "code",
        state: "xyz",
        resource: `${BASE}/mcp`,
        password,
        decision: "allow",
      },
    }),
  );
}

async function fullSignIn() {
  const { body: client } = await registerClient();
  const { verifier, challenge } = pkce();
  const res = await signIn(client.client_id, CALLBACK, challenge);
  const code = new URL(res.headers.get("location")!).searchParams.get("code")!;
  const tokenRes = await oauth.fetch(
    req("/token", {
      method: "POST",
      form: { grant_type: "authorization_code", code, client_id: client.client_id, redirect_uri: CALLBACK, code_verifier: verifier },
    }),
  );
  return { client, tokens: (await tokenRes.json()) as any, tokenRes };
}

test("unauthenticated MCP request gets 401 pointing at the metadata", async () => {
  const res = await mcp.fetch(req("/mcp", { method: "POST", json: { jsonrpc: "2.0", id: 1, method: "tools/list" } }));
  assert.equal(res.status, 401);
  assert.match(res.headers.get("www-authenticate")!, /resource_metadata="https:\/\/search\.example\.com\/\.well-known\/oauth-protected-resource\/mcp"/);
});

test("discovery documents describe this server", async () => {
  const pr = (await (await oauth.fetch(req("/.well-known/oauth-protected-resource/mcp"))).json()) as any;
  assert.equal(pr.resource, `${BASE}/mcp`);
  assert.deepEqual(pr.authorization_servers, [BASE]);
  const as = (await (await oauth.fetch(req("/.well-known/oauth-authorization-server"))).json()) as any;
  assert.equal(as.issuer, BASE);
  assert.equal(as.registration_endpoint, `${BASE}/register`);
  assert.deepEqual(as.code_challenge_methods_supported, ["S256"]);
});

test("registration only accepts Claude and local callback addresses", async () => {
  assert.equal((await registerClient()).res.status, 201);
  assert.equal((await registerClient("http://localhost:4567/callback")).res.status, 201);
  assert.equal((await registerClient("https://evil.example/callback")).res.status, 400);
});

test("sign-in page shows where the code goes, and a wrong password is refused", async () => {
  const { body: client } = await registerClient();
  const { challenge } = pkce();
  const params = new URLSearchParams({
    client_id: client.client_id,
    redirect_uri: CALLBACK,
    code_challenge: challenge,
    code_challenge_method: "S256",
    response_type: "code",
    state: "abc",
  });
  const page = await oauth.fetch(req(`/authorize?${params}`));
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /claude\.ai/);
  assert.match(page.headers.get("content-security-policy")!, /form-action 'self' https:\/\/claude\.ai/);
  const wrong = await signIn(client.client_id, CALLBACK, challenge, "nope");
  assert.equal(wrong.status, 401);
});

test("full sign-in, MCP calls, refresh, and sign-out-all", async () => {
  const { tokens, tokenRes } = await fullSignIn();
  assert.equal(tokenRes.status, 200);
  assert.ok(tokens.access_token && tokens.refresh_token);

  const auth = { authorization: `Bearer ${tokens.access_token}` };
  const init = await mcp.fetch(
    req("/mcp", { method: "POST", headers: auth, json: { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } } }),
  );
  const initBody = (await init.json()) as any;
  assert.equal(initBody.result.protocolVersion, "2025-06-18");
  assert.ok(initBody.result.instructions.includes("search"));

  const note = await mcp.fetch(req("/mcp", { method: "POST", headers: auth, json: { jsonrpc: "2.0", method: "notifications/initialized" } }));
  assert.equal(note.status, 202);

  const list = (await (await mcp.fetch(req("/mcp", { method: "POST", headers: auth, json: { jsonrpc: "2.0", id: 2, method: "tools/list" } }))).json()) as any;
  assert.deepEqual(
    list.result.tools.map((t: any) => t.name),
    ["search", "fetch", "verify", "research"],
  );

  const refreshed = (await (
    await oauth.fetch(req("/token", { method: "POST", form: { grant_type: "refresh_token", refresh_token: tokens.refresh_token } }))
  ).json()) as any;
  assert.ok(refreshed.access_token);

  await bumpEpoch();
  const after = await mcp.fetch(req("/mcp", { method: "POST", headers: auth, json: { jsonrpc: "2.0", id: 3, method: "tools/list" } }));
  assert.equal(after.status, 401);
  const refreshAfter = await oauth.fetch(req("/token", { method: "POST", form: { grant_type: "refresh_token", refresh_token: tokens.refresh_token } }));
  assert.equal(((await refreshAfter.json()) as any).error, "invalid_grant");
});

test("a code can't be swapped without the right PKCE verifier", async () => {
  const { body: client } = await registerClient();
  const { challenge } = pkce();
  const res = await signIn(client.client_id, CALLBACK, challenge);
  const code = new URL(res.headers.get("location")!).searchParams.get("code")!;
  const bad = await oauth.fetch(
    req("/token", {
      method: "POST",
      form: { grant_type: "authorization_code", code, client_id: client.client_id, redirect_uri: CALLBACK, code_verifier: "wrong" },
    }),
  );
  assert.equal(bad.status, 400);
  assert.equal(((await bad.json()) as any).error, "invalid_grant");
});

test("Claude Code's loopback callback matches on any port", async () => {
  const { body: client } = await registerClient("http://localhost/callback");
  const { challenge } = pkce();
  const res = await signIn(client.client_id, "http://localhost:51234/callback", challenge);
  assert.equal(res.status, 302);
  assert.match(res.headers.get("location")!, /^http:\/\/localhost:51234\/callback\?code=/);
});
