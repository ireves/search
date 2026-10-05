// The settings page: sign in with the admin password, then add, replace or
// remove API keys. Saved values are write-only: no page, response or tool ever
// shows them again.

import { adminPassword, baseUrl, clientIp, KNOWN_SECRETS, SERVER_TITLE } from "./config.js";
import { getKeys, nowSeconds, randomId, safeEqual, signToken, verifyToken, type TokenPayload } from "./crypto.js";
import { exaCheck } from "./engines/exa.js";
import { parallelCheck } from "./engines/parallel.js";
import { esc, json, page, passkeyFields, redirect, setupNeededPage } from "./html.js";
import { mcpUrl } from "./oauth.js";
import { clearFailures, isLocked, recordFailure } from "./ratelimit.js";
import { addPasskey, MAX_PASSKEYS, passwordSignInAllowed, PASSKEY_SCRIPT, registrationOptions, removePasskey, signinOptions, verifySignin } from "./passkeys.js";
import { backend, bumpEpoch, listSecrets, loadState, readSecret, removeSecret, SECRET_NAME, setSecret, type State } from "./store.js";

const SESSION_TTL = 12 * 3600;

interface Session extends TokenPayload {
  sid: string;
  ep: number;
}

function cookieName(request: Request): string {
  return baseUrl(request).startsWith("https://") ? "__Host-search_session" : "search_session";
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

function sessionCookie(request: Request, value: string, maxAge: number): string {
  const secure = baseUrl(request).startsWith("https://") ? "; Secure" : "";
  return `${cookieName(request)}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

async function currentSession(request: Request, key: CryptoKey): Promise<Session | null> {
  const session = await verifyToken<Session>(key, readCookie(request, cookieName(request)), "session");
  if (!session) return null;
  const state = await loadState();
  return session.ep === state.epoch ? session : null;
}

async function csrfFor(key: CryptoKey, session: Session): Promise<string> {
  return signToken(key, { typ: "csrf", exp: session.exp, sid: session.sid });
}

// Messages are looked up by code, so nothing a visitor types is echoed back.
const MESSAGES: Record<string, [string, string]> = {
  saved: ["ok", "Saved. The value is stored encrypted and can't be viewed again."],
  removed: ["ok", "Removed."],
  signedout: ["ok", "All Claude connections were signed out. Reconnect the connector in Claude to use it again."],
  badname: ["bad", "Names use capital letters, digits and underscores, like EXA_API_KEY."],
  empty: ["bad", "Paste a value first."],
  nostore: ["bad", "No storage is connected yet, so keys can't be saved here. See the note above."],
  failed: ["bad", "That didn't work. Try again in a moment."],
  expired: ["bad", "The page had expired. Try again."],
  "passkey-added": ["ok", "Passkey added. From now on, sign in with it; the admin password no longer signs in."],
  "passkey-invalid": ["bad", "That passkey couldn't be added. Try again on this page's main address."],
  "passkey-full": ["bad", `You already have ${MAX_PASSKEYS} passkeys. Remove one first.`],
  "passkey-removed": ["ok", "Passkey removed."],
};

export async function handleSettings(request: Request): Promise<Response> {
  const password = adminPassword();
  if (!password) return setupNeededPage();
  const { signing } = await getKeys(password);
  const base = baseUrl(request);
  const url = new URL(request.url);

  if (request.method === "POST") {
    const form = new URLSearchParams(await request.text());
    const action = form.get("action");
    if (action === "login") {
      const ip = clientIp(request);
      const state = await loadState(true);
      const fail = async (text: string) => {
        await recordFailure(ip);
        return loginPage(base, state, text);
      };
      if (isLocked(ip)) return loginPage(base, state, "Too many failed attempts. Wait 10 minutes and try again.");
      if (form.get("passkey")) {
        if (!(await verifySignin(request, form.get("passkey"), form.get("pktoken")))) return fail("That passkey wasn't accepted. Try again.");
      } else if (!passwordSignInAllowed(state)) {
        return loginPage(base, state, "Password sign-in is off because a passkey is set up. Use your passkey.");
      } else if (!(await safeEqual(form.get("password") ?? "", password))) {
        return fail("That password isn't right.");
      }
      clearFailures(ip);
      const token = await signToken(signing, { typ: "session", exp: nowSeconds() + SESSION_TTL, sid: randomId(), ep: state.epoch });
      return redirect(`${base}/settings`, { "set-cookie": sessionCookie(request, token, SESSION_TTL) });
    }

    const session = await currentSession(request, signing);
    if (!session) return loginPage(base, await loadState(true), "Please sign in again.");
    const csrf = await verifyToken<TokenPayload & { sid: string }>(signing, form.get("csrf"), "csrf");
    if (!csrf || csrf.sid !== session.sid) return redirect(`${base}/settings?m=expired`);

    if (action === "logout") return redirect(`${base}/settings`, { "set-cookie": sessionCookie(request, "", 0) });
    if (!backend() && action !== "check") return redirect(`${base}/settings?m=nostore`);
    try {
      if (action === "save") {
        const name = (form.get("name") ?? "").trim().toUpperCase();
        const value = form.get("value") ?? "";
        if (!SECRET_NAME.test(name)) return redirect(`${base}/settings?m=badname`);
        if (!value.trim()) return redirect(`${base}/settings?m=empty`);
        await setSecret(name, value);
        return redirect(`${base}/settings?m=saved`);
      }
      if (action === "remove") {
        const name = form.get("name") ?? "";
        if (!SECRET_NAME.test(name)) return redirect(`${base}/settings?m=badname`);
        await removeSecret(name);
        return redirect(`${base}/settings?m=removed`);
      }
      if (action === "passkey-add") {
        const result = await addPasskey(request, form.get("passkey"), form.get("pktoken"), form.get("name") ?? "");
        return redirect(`${base}/settings?m=passkey-${result}`);
      }
      if (action === "passkey-remove") {
        await removePasskey(form.get("id") ?? "");
        return redirect(`${base}/settings?m=passkey-removed`);
      }
      if (action === "signout-all") {
        await bumpEpoch();
        return redirect(`${base}/settings?m=signedout`, { "set-cookie": sessionCookie(request, "", 0) });
      }
      if (action === "check") {
        const [exa, parallel] = await Promise.all([checkKey("EXA_API_KEY", exaCheck), checkKey("PARALLEL_API_KEY", parallelCheck)]);
        return redirect(`${base}/settings?exa=${exa}&parallel=${parallel}`);
      }
    } catch {
      return redirect(`${base}/settings?m=failed`);
    }
    return redirect(`${base}/settings`);
  }

  const session = await currentSession(request, signing);
  if (!session) return loginPage(base, await loadState(true));
  return dashboard(base, await csrfFor(signing, session), url.searchParams);
}

async function checkKey(name: string, check: (key: string) => Promise<number>): Promise<string> {
  const key = await readSecret(name);
  if (!key) return "missing";
  try {
    return String(await check(key));
  } catch {
    return "network";
  }
}

function loginPage(base: string, state: State, message = ""): Response {
  const hasPasskey = Boolean(state.passkeys?.length);
  const passwordAllowed = passwordSignInAllowed(state);
  return page({
    title: "Sign in",
    status: message ? 401 : 200,
    body: `<h1>${esc(SERVER_TITLE)}</h1><p class="muted">Sign in to manage API keys.</p>
<div class="card">${message ? `<p class="bad">${esc(message)}</p>` : ""}
<form method="post" action="${esc(base)}/settings"><input type="hidden" name="action" value="login">
${hasPasskey ? `<button type="button" data-passkey="signin">Sign in with passkey</button>${passkeyFields()}` : ""}
${
  passwordAllowed
    ? `${hasPasskey ? '<p class="muted">Or use the admin password:</p>' : ""}<label for="password">Admin password</label><input id="password" name="password" type="password" autocomplete="current-password" ${hasPasskey ? "" : "required autofocus"}>
<button type="submit"${hasPasskey ? ' class="plain"' : ""}>Sign in${hasPasskey ? " with password" : ""}</button>`
    : ""
}
</form></div>`,
  });
}

function checkLabel(code: string | null): string {
  if (!code) return "";
  if (code === "200") return '<span class="tag ok">works</span>';
  if (code === "missing") return '<span class="tag warn">not set</span>';
  if (code === "401" || code === "403") return '<span class="tag bad">rejected</span>';
  if (code === "402") return '<span class="tag bad">out of credit</span>';
  if (code === "429") return '<span class="tag warn">rate limited</span>';
  return `<span class="tag bad">error ${esc(code)}</span>`;
}

async function dashboard(base: string, csrf: string, params: URLSearchParams): Promise<Response> {
  const store = backend();
  const secrets = await listSecrets(Object.keys(KNOWN_SECRETS));
  const flash = MESSAGES[params.get("m") ?? ""];
  const checks: Record<string, string | null> = { EXA_API_KEY: params.get("exa"), PARALLEL_API_KEY: params.get("parallel") };
  const token = `<input type="hidden" name="csrf" value="${esc(csrf)}">`;
  const state = await loadState(true);
  const passkeys = state.passkeys ?? [];
  const day = (iso?: string) => (iso ? esc(iso.slice(0, 10)) : "never");
  const passkeyRows = passkeys
    .map(
      (k) => `<div class="row"><div class="grow"><strong>${esc(k.name)}</strong><br><span class="muted">Added ${day(k.createdAt)} · last used ${day(k.lastUsedAt)}${k.synced ? " · synced across your devices" : ""}</span></div>
<form method="post" action="${esc(base)}/settings">${token}<input type="hidden" name="action" value="passkey-remove"><input type="hidden" name="id" value="${esc(k.id)}"><button type="submit" class="danger">Remove</button></form></div>`,
    )
    .join("");
  const passwordNote = !passkeys.length
    ? "Add a passkey to sign in with Face ID, Touch ID or a security key instead of the password. Once one exists, the admin password stops working as a sign-in."
    : passwordSignInAllowed(state)
      ? "The admin password also signs in, because ALLOW_PASSWORD_SIGN_IN is set in Vercel. Remove that setting once you've recovered."
      : "Only passkeys sign in. The admin password can't, so a stolen password alone can't get in.";
  const passkeySection = `<h2>Passkeys</h2>
<div class="card"><p class="muted">${passwordNote}</p>${passkeyRows}
${
  passkeys.length < MAX_PASSKEYS
    ? `<form method="post" action="${esc(base)}/settings">${token}<input type="hidden" name="action" value="passkey-add">
<label for="pk-name">Name (optional)</label><input id="pk-name" name="name" type="text" placeholder="iPhone" maxlength="60" autocomplete="off">
<button type="button" data-passkey="register">Add a passkey</button>${passkeyFields()}</form>
<p class="muted">Passkeys only work at <strong class="mono">${esc(new URL(base).host)}</strong>. Always open the connector at that address.</p>`
    : ""
}</div>`;

  const rows = secrets
    .map((s) => {
      const known = KNOWN_SECRETS[s.name];
      const status =
        s.source === "saved"
          ? `<span class="tag ok">saved</span> <span class="muted">${esc(s.updatedAt?.slice(0, 10))}</span>`
          : s.source === "vercel"
            ? '<span class="tag ok">set in Vercel</span>'
            : s.source === "unreadable"
              ? '<span class="tag bad">needs re-entering</span> <span class="muted">(admin password changed)</span>'
              : '<span class="tag warn">not set</span>';
      const removable = s.source === "saved" || s.source === "unreadable";
      return `<div class="card"><div class="row"><div class="grow"><strong>${esc(known?.label ?? s.name)}</strong><br><code>${esc(s.name)}</code></div><div>${status} ${checkLabel(checks[s.name] ?? null)}</div></div>
${known ? `<p class="muted">${esc(known.help)} Get one at <a href="${esc(known.link)}" rel="noreferrer noopener" target="_blank">${esc(new URL(known.link).host)}</a>.</p>` : ""}
<form method="post" action="${esc(base)}/settings">${token}<input type="hidden" name="action" value="save"><input type="hidden" name="name" value="${esc(s.name)}">
<label for="v-${esc(s.name)}">${s.source === "missing" ? "Add" : "Replace"} value</label><input id="v-${esc(s.name)}" name="value" type="password" autocomplete="off" spellcheck="false" required>
<div class="row"><button type="submit">Save</button></div></form>
${removable ? `<form method="post" action="${esc(base)}/settings">${token}<input type="hidden" name="action" value="remove"><input type="hidden" name="name" value="${esc(s.name)}"><button type="submit" class="danger">Remove</button></form>` : ""}
</div>`;
    })
    .join("");

  return page({
    title: "Settings",
    body: `<div class="row"><div class="grow"><h1>${esc(SERVER_TITLE)}</h1></div>
<form method="post" action="${esc(base)}/settings">${token}<input type="hidden" name="action" value="logout"><button type="submit" class="plain">Sign out</button></form></div>
${flash ? `<p class="${flash[0]}">${esc(flash[1])}</p>` : ""}
<h2>Connector address</h2>
<div class="card"><p>Add this as a custom connector in Claude:</p><p><input type="text" readonly value="${esc(mcpUrl(base))}" aria-label="Connector address"></p></div>
${store ? "" : `<div class="note"><strong>Storage not connected.</strong> Keys can't be saved here until a private Vercel Blob store is connected to this project (one-time step, see the setup guide). Keys set as Vercel environment variables still work.</div>`}
<h2>API keys</h2>
<p class="muted">Values are encrypted before they're stored. You can replace or remove a key, but never view it again, here or anywhere else.</p>
${rows}
<form method="post" action="${esc(base)}/settings">${token}<input type="hidden" name="action" value="check"><button type="submit" class="plain">Check keys work</button> <span class="muted">(makes one tiny search with each, under $0.01)</span></form>
<h2>Add another secret</h2>
<div class="card"><form method="post" action="${esc(base)}/settings">${token}<input type="hidden" name="action" value="save">
<label for="n-new">Name</label><input id="n-new" name="name" type="text" placeholder="MY_API_KEY" pattern="[A-Za-z][A-Za-z0-9_]{1,63}" autocomplete="off" required>
<label for="v-new">Value</label><input id="v-new" name="value" type="password" autocomplete="off" required>
<button type="submit">Save</button></form></div>
${passkeySection}
<h2>Connections</h2>
<div class="card"><p>Sign out every Claude app connected to this connector, for example after a lost device. You'll need to reconnect in Claude afterwards.</p>
<form method="post" action="${esc(base)}/settings">${token}<input type="hidden" name="action" value="signout-all"><button type="submit" class="danger">Sign out all connections</button></form></div>
<p class="muted">Storage: ${esc(store?.name ?? "none")}.</p>`,
  });
}

export function homePage(request: Request): Response {
  const base = baseUrl(request);
  return page({
    title: SERVER_TITLE,
    body: `<h1>${esc(SERVER_TITLE)}</h1><p>A private Claude connector for web search.</p>
<div class="card"><p>Connector address for Claude:</p><p><input type="text" readonly value="${esc(mcpUrl(base))}" aria-label="Connector address"></p>
<p><a href="${esc(base)}/settings">Manage API keys</a></p></div>`,
  });
}

// GET /passkey.js
export function passkeyScript(): Response {
  return new Response(PASSKEY_SCRIPT, {
    headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "public, max-age=300", "x-content-type-options": "nosniff" },
  });
}

// POST /passkey/options: a fresh challenge for signing in (anyone) or for
// adding a passkey (signed-in owner only).
export async function passkeyOptions(request: Request): Promise<Response> {
  const password = adminPassword();
  if (!password) return json({ error: "The connector has no ADMIN_PASSWORD yet." }, 503);
  if (request.method !== "POST") return json({ error: "Use POST." }, 405);
  const body = (await request.json().catch(() => ({}))) as { purpose?: string; csrf?: string };
  if (body.purpose === "register") {
    const { signing } = await getKeys(password);
    const session = await currentSession(request, signing);
    const csrf = await verifyToken<TokenPayload & { sid: string }>(signing, body.csrf, "csrf");
    if (!session || !csrf || csrf.sid !== session.sid) return json({ error: "Sign in again, then add the passkey." }, 401);
    if (!backend()) return json({ error: "No storage is connected, so passkeys can't be saved." }, 503);
    return json(await registrationOptions(request));
  }
  const state = await loadState(true);
  if (!state.passkeys?.length) return json({ error: "No passkey is set up yet. Sign in with the admin password." }, 400);
  return json(await signinOptions(request));
}
