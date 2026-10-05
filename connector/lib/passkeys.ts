// Passkey sign-in (WebAuthn), as in the icloud-mcp project.
//
// A passkey is a key pair kept by the owner's device (iCloud Keychain, Google
// Password Manager, a security key). The server stores only the public half and
// checks a signature over a fresh challenge, so there is nothing to phish or
// leak. A passkey works only on the hostname it was made for, which is why
// PUBLIC_URL should be pinned to the final address before adding one.
//
// The first passkey is added from the settings page after signing in with the
// admin password, which plays the role icloud-mcp's setup code plays. Once a
// passkey exists, the password stops working as a sign-in (it still unlocks
// the stored keys server-side), unless ALLOW_PASSWORD_SIGN_IN=true is set in
// Vercel to recover from a lost passkey. Removing the last passkey turns
// password sign-in back on.
//
// Challenges are stateless: each one travels to the browser inside a signed,
// five-minute token and comes back with the signed response.

import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { adminPassword, baseUrl } from "./config.js";
import { b64url, fromB64url, getKeys, nowSeconds, signToken, verifyToken, type TokenPayload } from "./crypto.js";
import { loadState, saveState, type State, type StoredPasskey } from "./store.js";

const CHALLENGE_TTL = 300;
export const MAX_PASSKEYS = 5;
const RP_NAME = "Search connector";
// Every passkey belongs to the single owner. A fixed user ID means re-adding a
// passkey on the same device replaces the old one rather than piling up.
const USER_ID = new TextEncoder().encode("search-connector-owner");

type Purpose = "signin" | "register";

interface ChallengeToken extends TokenPayload {
  c: string;
  p: Purpose;
  rp: string;
}

export function passwordSignInAllowed(state: State): boolean {
  return !state.passkeys?.length || process.env.ALLOW_PASSWORD_SIGN_IN === "true";
}

function relyingParty(request: Request): { rpID: string; origin: string } {
  const origin = baseUrl(request);
  return { rpID: new URL(origin).hostname, origin };
}

async function signingKey(): Promise<CryptoKey> {
  const password = adminPassword();
  if (!password) throw new Error("ADMIN_PASSWORD is not set.");
  return (await getKeys(password)).signing;
}

async function challengeToken(challenge: string, purpose: Purpose, rpID: string): Promise<string> {
  return signToken(await signingKey(), { typ: "pkchal", exp: nowSeconds() + CHALLENGE_TTL, c: challenge, p: purpose, rp: rpID });
}

// A signed challenge can be used once per server instance. Together with the
// five-minute expiry this stops a captured response being replayed.
const used = new Map<string, number>();
function markUsed(challenge: string): boolean {
  const now = Date.now();
  for (const [c, at] of used) if (now - at > CHALLENGE_TTL * 1000) used.delete(c);
  if (used.has(challenge)) return false;
  used.set(challenge, now);
  return true;
}

async function readChallenge(token: string | null | undefined, purpose: Purpose, rpID: string): Promise<string | null> {
  const payload = await verifyToken<ChallengeToken>(await signingKey(), token, "pkchal");
  if (!payload || payload.p !== purpose || payload.rp !== rpID) return null;
  return markUsed(payload.c) ? payload.c : null;
}

export async function signinOptions(request: Request): Promise<{ options: unknown; token: string }> {
  const { rpID } = relyingParty(request);
  const state = await loadState(true);
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "required",
    allowCredentials: (state.passkeys ?? []).map((p) => ({ id: p.id, transports: p.transports })),
  });
  return { options, token: await challengeToken(options.challenge, "signin", rpID) };
}

export async function registrationOptions(request: Request): Promise<{ options: unknown; token: string }> {
  const { rpID } = relyingParty(request);
  const state = await loadState(true);
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userName: "owner",
    userDisplayName: `Search connector (${rpID})`,
    userID: USER_ID,
    attestationType: "none",
    excludeCredentials: (state.passkeys ?? []).map((p) => ({ id: p.id, transports: p.transports })),
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
  });
  return { options, token: await challengeToken(options.challenge, "register", rpID) };
}

function parse(json: string | null | undefined): any {
  if (!json || json.length > 20_000) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// True when the response is a valid, user-verified signature from a stored passkey.
export async function verifySignin(request: Request, responseJson: string | null, token: string | null): Promise<boolean> {
  const { rpID, origin } = relyingParty(request);
  const response = parse(responseJson);
  const challenge = await readChallenge(token, "signin", rpID);
  if (!response || !challenge) return false;
  const state = await loadState(true);
  const stored = state.passkeys?.find((p) => p.id === response.id);
  if (!stored) return false;
  try {
    const result = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: { id: stored.id, publicKey: fromB64url(stored.publicKey), counter: stored.counter, transports: stored.transports },
    });
    if (!result.verified) return false;
    stored.counter = result.authenticationInfo.newCounter;
    stored.lastUsedAt = new Date().toISOString();
    await saveState(state).catch(() => undefined);
    return true;
  } catch {
    return false;
  }
}

export type AddResult = "added" | "invalid" | "full";

export async function addPasskey(request: Request, responseJson: string | null, token: string | null, name: string): Promise<AddResult> {
  const { rpID, origin } = relyingParty(request);
  const response = parse(responseJson);
  const challenge = await readChallenge(token, "register", rpID);
  if (!response || !challenge) return "invalid";
  const state = await loadState(true);
  const list = state.passkeys ?? [];
  if (list.length >= MAX_PASSKEYS) return "full";
  let info;
  try {
    const result = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
    if (!result.verified) return "invalid";
    info = result.registrationInfo;
  } catch {
    return "invalid";
  }
  const record: StoredPasskey = {
    id: info.credential.id,
    publicKey: b64url(info.credential.publicKey),
    counter: info.credential.counter,
    transports: info.credential.transports,
    name: name.trim().slice(0, 60) || "Passkey",
    createdAt: new Date().toISOString(),
    synced: info.credentialBackedUp,
  };
  state.passkeys = [...list.filter((p) => p.id !== record.id), record];
  await saveState(state);
  return "added";
}

export async function removePasskey(id: string): Promise<void> {
  const state = await loadState(true);
  state.passkeys = (state.passkeys ?? []).filter((p) => p.id !== id);
  await saveState(state);
}

// The browser half. Served from /passkey.js so the pages need no inline script.
// Buttons marked data-passkey="signin" or "register" fetch options, ask the
// device for a passkey, put the signed response into the form and submit it.
export const PASSKEY_SCRIPT = `(() => {
  const toBuf = (s) => { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; const b = atob(s); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u.buffer; };
  const toStr = (buf) => { if (!buf) return undefined; const u = new Uint8Array(buf); let s = ""; for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s).replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/, ""); };
  const supported = typeof window.PublicKeyCredential === "function";
  document.querySelectorAll("[data-passkey-unsupported]").forEach((el) => { el.hidden = supported; });
  document.querySelectorAll("button[data-passkey]").forEach((button) => {
    if (!supported) { button.hidden = true; return; }
    button.addEventListener("click", async () => {
      const form = button.closest("form");
      const purpose = button.dataset.passkey;
      const message = form.querySelector("[data-passkey-error]");
      const show = (text) => { if (message) { message.textContent = text; message.hidden = !text; } };
      show("");
      button.disabled = true;
      try {
        const csrf = form.querySelector("[name=csrf]");
        const res = await fetch("/passkey/options", { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ purpose, csrf: csrf ? csrf.value : undefined }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Couldn't start.");
        const o = data.options;
        o.challenge = toBuf(o.challenge);
        let json;
        if (purpose === "register") {
          o.user.id = toBuf(o.user.id);
          o.excludeCredentials = (o.excludeCredentials || []).map((c) => ({ ...c, id: toBuf(c.id) }));
          const cred = await navigator.credentials.create({ publicKey: o });
          json = { id: cred.id, rawId: toStr(cred.rawId), type: cred.type, authenticatorAttachment: cred.authenticatorAttachment || undefined, clientExtensionResults: cred.getClientExtensionResults(),
            response: { clientDataJSON: toStr(cred.response.clientDataJSON), attestationObject: toStr(cred.response.attestationObject), transports: cred.response.getTransports ? cred.response.getTransports() : [] } };
        } else {
          o.allowCredentials = (o.allowCredentials || []).map((c) => ({ ...c, id: toBuf(c.id) }));
          const cred = await navigator.credentials.get({ publicKey: o });
          json = { id: cred.id, rawId: toStr(cred.rawId), type: cred.type, authenticatorAttachment: cred.authenticatorAttachment || undefined, clientExtensionResults: cred.getClientExtensionResults(),
            response: { clientDataJSON: toStr(cred.response.clientDataJSON), authenticatorData: toStr(cred.response.authenticatorData), signature: toStr(cred.response.signature), userHandle: toStr(cred.response.userHandle) } };
        }
        form.querySelector("[name=passkey]").value = JSON.stringify(json);
        form.querySelector("[name=pktoken]").value = data.token;
        form.submit();
      } catch (error) {
        button.disabled = false;
        show(error && error.name === "NotAllowedError" ? "Cancelled or timed out. Try again." : error && error.name === "InvalidStateError" ? "This device already has a passkey here." : (error && error.message) || "That didn't work.");
      }
    });
  });
})();`;
