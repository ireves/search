import { strict as assert } from "node:assert";
import { createHash, createSign, generateKeyPairSync, randomBytes, type KeyObject } from "node:crypto";
import { before, after, test } from "node:test";
import { isoCBOR } from "@simplewebauthn/server/helpers";
import { BASE, freshStore, mockNetwork, req, restoreNetwork } from "./helpers.js";
import settings from "../api/settings.js";
import oauth from "../api/oauth.js";
import { loadState } from "../lib/store.js";

// A software passkey: what a phone or laptop does, done in code.
class SoftAuthenticator {
  id = randomBytes(16);
  private keys = generateKeyPairSync("ec", { namedCurve: "P-256" });
  private counter = 0;
  constructor(private origin: string, private rpID: string) {}

  private authData(flags: number, attested?: Uint8Array): Buffer {
    const count = Buffer.alloc(4);
    count.writeUInt32BE(this.counter);
    return Buffer.concat([createHash("sha256").update(this.rpID).digest(), Buffer.from([flags]), count, ...(attested ? [Buffer.from(attested)] : [])]);
  }

  private clientData(type: string, challenge: string): Buffer {
    return Buffer.from(JSON.stringify({ type, challenge, origin: this.origin, crossOrigin: false }));
  }

  create(options: any) {
    const jwk = (this.keys.publicKey as KeyObject).export({ format: "jwk" }) as { x: string; y: string };
    const cose = isoCBOR.encode(
      new Map<number, number | Uint8Array>([
        [1, 2],
        [3, -7],
        [-1, 1],
        [-2, Buffer.from(jwk.x, "base64url")],
        [-3, Buffer.from(jwk.y, "base64url")],
      ]),
    );
    const idLen = Buffer.alloc(2);
    idLen.writeUInt16BE(this.id.length);
    const attested = Buffer.concat([Buffer.alloc(16), idLen, this.id, Buffer.from(cose)]);
    const authData = this.authData(0x01 | 0x04 | 0x40, attested);
    const attestationObject = isoCBOR.encode(new Map<string, unknown>([["fmt", "none"], ["attStmt", new Map()], ["authData", authData]]) as any);
    const id = this.id.toString("base64url");
    return {
      id,
      rawId: id,
      type: "public-key",
      clientExtensionResults: {},
      response: {
        clientDataJSON: this.clientData("webauthn.create", options.challenge).toString("base64url"),
        attestationObject: Buffer.from(attestationObject).toString("base64url"),
        transports: ["internal"],
      },
    };
  }

  get(options: any) {
    this.counter += 1;
    const authData = this.authData(0x01 | 0x04);
    const clientData = this.clientData("webauthn.get", options.challenge);
    const signer = createSign("SHA256");
    signer.update(Buffer.concat([authData, createHash("sha256").update(clientData).digest()]));
    const id = this.id.toString("base64url");
    return {
      id,
      rawId: id,
      type: "public-key",
      clientExtensionResults: {},
      response: {
        clientDataJSON: clientData.toString("base64url"),
        authenticatorData: authData.toString("base64url"),
        signature: signer.sign(this.keys.privateKey).toString("base64url"),
      },
    };
  }
}

const device = new SoftAuthenticator(BASE, "search.example.com");

before(async () => {
  await freshStore(false);
  mockNetwork();
});
after(restoreNetwork);

async function passwordLogin(): Promise<Response> {
  return settings.fetch(req("/settings", { method: "POST", form: { action: "login", password: "correct horse battery staple" } }));
}

async function options(purpose: string, cookie?: string, csrf?: string) {
  const res = await settings.fetch(req("/passkey/options", { method: "POST", headers: cookie ? { cookie } : {}, json: { purpose, csrf } }));
  return { res, body: (await res.json()) as any };
}

test("no passkey yet: sign-in options refuse, the password works", async () => {
  assert.equal((await options("signin")).res.status, 400);
  assert.equal((await passwordLogin()).status, 303);
});

test("adding a passkey needs a signed-in session", async () => {
  assert.equal((await options("register")).res.status, 401);
});

test("add a passkey, then only the passkey signs in", async () => {
  const cookie = (await passwordLogin()).headers.get("set-cookie")!.split(";")[0];
  const html = await (await settings.fetch(req("/settings", { headers: { cookie } }))).text();
  const csrf = /name="csrf" value="([^"]+)"/.exec(html)![1];
  assert.match(html, /data-passkey="register"/);
  assert.match(html, /<script src="\/passkey\.js" defer><\/script>/);

  const { body: reg } = await options("register", cookie, csrf);
  assert.equal(reg.options.rp.id, "search.example.com");
  const credential = device.create(reg.options);
  const added = await settings.fetch(
    req("/settings", {
      method: "POST",
      headers: { cookie },
      form: { action: "passkey-add", csrf, name: "Test phone", passkey: JSON.stringify(credential), pktoken: reg.token },
    }),
  );
  assert.equal(added.headers.get("location"), `${BASE}/settings?m=passkey-added`);
  assert.equal((await loadState(true)).passkeys?.length, 1);

  // The same challenge can't be used twice.
  const replay = await settings.fetch(
    req("/settings", { method: "POST", headers: { cookie }, form: { action: "passkey-add", csrf, passkey: JSON.stringify(credential), pktoken: reg.token } }),
  );
  assert.equal(replay.headers.get("location"), `${BASE}/settings?m=passkey-invalid`);

  // The password no longer signs in.
  const pw = await passwordLogin();
  assert.equal(pw.status, 401);
  assert.match(await pw.text(), /Password sign-in is off/);

  // The passkey does.
  const { body: auth } = await options("signin");
  const assertion = device.get(auth.options);
  const ok = await settings.fetch(
    req("/settings", { method: "POST", form: { action: "login", passkey: JSON.stringify(assertion), pktoken: auth.token } }),
  );
  assert.equal(ok.status, 303);
  assert.match(ok.headers.get("set-cookie")!, /search_session=/);
});

test("a forged signature is refused", async () => {
  const { body: auth } = await options("signin");
  const assertion = device.get(auth.options);
  assertion.response.signature = Buffer.from("not a signature").toString("base64url");
  const res = await settings.fetch(req("/settings", { method: "POST", form: { action: "login", passkey: JSON.stringify(assertion), pktoken: auth.token } }));
  assert.equal(res.status, 401);
});

test("Claude's connect page signs in with the passkey", async () => {
  const reg = (await (
    await oauth.fetch(req("/register", { method: "POST", json: { redirect_uris: ["https://claude.ai/api/mcp/auth_callback"], client_name: "Claude" } }))
  ).json()) as any;
  const fields = {
    client_id: reg.client_id,
    redirect_uri: "https://claude.ai/api/mcp/auth_callback",
    code_challenge: "x".repeat(43),
    code_challenge_method: "S256",
    response_type: "code",
    state: "s",
  };
  const pageHtml = await (await oauth.fetch(req(`/authorize?${new URLSearchParams(fields)}`))).text();
  assert.match(pageHtml, /Connect with passkey/);
  assert.doesNotMatch(pageHtml, /name="password"/);

  const { body: auth } = await options("signin");
  const res = await oauth.fetch(
    req("/authorize", { method: "POST", form: { ...fields, passkey: JSON.stringify(device.get(auth.options)), pktoken: auth.token } }),
  );
  assert.equal(res.status, 302);
  assert.match(res.headers.get("location")!, /^https:\/\/claude\.ai\/api\/mcp\/auth_callback\?code=/);

  const pw = await oauth.fetch(req("/authorize", { method: "POST", form: { ...fields, password: "correct horse battery staple", decision: "allow" } }));
  assert.equal(pw.status, 401);
});

test("ALLOW_PASSWORD_SIGN_IN re-enables the password for recovery", async () => {
  process.env.ALLOW_PASSWORD_SIGN_IN = "true";
  try {
    assert.equal((await passwordLogin()).status, 303);
  } finally {
    delete process.env.ALLOW_PASSWORD_SIGN_IN;
  }
});

test("the browser script is served", async () => {
  const res = await settings.fetch(req("/passkey.js"));
  assert.equal(res.headers.get("content-type"), "text/javascript; charset=utf-8");
  const js = await res.text();
  assert.match(js, /navigator\.credentials\.get/);
  new Function(js); // parses as valid JavaScript
});
