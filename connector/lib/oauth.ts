// A minimal OAuth 2.1 authorisation server for one owner.
//
// Claude registers itself (Dynamic Client Registration), sends the owner to
// /authorize, where they type the admin password, then swaps the code for
// tokens at /token. Everything is stateless: client IDs, codes and tokens are
// signed with a key derived from ADMIN_PASSWORD. "Sign out all connections" on
// the settings page bumps an epoch stored with the secrets, which invalidates
// every token at once.

import { adminPassword, baseUrl, clientIp } from "./config.js";
import { getKeys, nowSeconds, randomId, safeEqual, sha256b64url, signToken, verifyToken, type TokenPayload } from "./crypto.js";
import { esc, json, page, setupNeededPage } from "./html.js";
import { clearFailures, isLocked, recordFailure } from "./ratelimit.js";
import { loadState } from "./store.js";

const CLIENT_TTL = 10 * 365 * 24 * 3600;
const CODE_TTL = 300;
const ACCESS_TTL = 3600;
const REFRESH_TTL = 90 * 24 * 3600;
const SCOPES = ["search", "offline_access"];

interface ClientToken extends TokenPayload {
  ruris: string[];
  name: string;
}
interface CodeToken extends TokenPayload {
  cid: string;
  ruri: string;
  cc: string;
  scope: string;
  ep: number;
}
interface AccessToken extends TokenPayload {
  cid: string;
  scope: string;
  ep: number;
  aud: string;
}
interface RefreshToken extends AccessToken {
  jti: string;
}

export function mcpUrl(base: string): string {
  return `${base}/mcp`;
}

export function resourceMetadataUrl(base: string): string {
  return `${base}/.well-known/oauth-protected-resource/mcp`;
}

export function protectedResourceMetadata(request: Request): Response {
  const base = baseUrl(request);
  return json({
    resource: mcpUrl(base),
    authorization_servers: [base],
    scopes_supported: SCOPES,
    bearer_methods_supported: ["header"],
    resource_name: "Search (Exa + Parallel)",
  });
}

export function authorizationServerMetadata(request: Request): Response {
  const base = baseUrl(request);
  return json({
    issuer: base,
    authorization_endpoint: `${base}/authorize`,
    token_endpoint: `${base}/token`,
    registration_endpoint: `${base}/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: SCOPES,
  });
}

// Only Claude's own callback and local (Claude Code) addresses may receive codes.
// ALLOWED_REDIRECT_URIS can add exact extra addresses, comma-separated.
export function redirectAllowed(uri: string): boolean {
  let u: URL;
  try {
    u = new URL(uri);
  } catch {
    return false;
  }
  if (u.hash) return false;
  if (u.protocol === "https:" && (u.hostname === "claude.ai" || u.hostname === "claude.com") && u.pathname === "/api/mcp/auth_callback") {
    return true;
  }
  if (u.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)) return true;
  const extra = (process.env.ALLOWED_REDIRECT_URIS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return extra.includes(uri);
}

function isLoopback(u: URL): boolean {
  return u.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
}

// Loopback addresses match on any port (RFC 8252); everything else exactly.
export function redirectMatches(registered: string[], requested: string): boolean {
  if (!redirectAllowed(requested)) return false;
  if (registered.includes(requested)) return true;
  const r = new URL(requested);
  if (!isLoopback(r)) return false;
  return registered.some((reg) => {
    try {
      const g = new URL(reg);
      return isLoopback(g) && g.hostname === r.hostname && g.pathname === r.pathname && g.search === r.search;
    } catch {
      return false;
    }
  });
}

async function signingKey(): Promise<CryptoKey | null> {
  const password = adminPassword();
  if (!password) return null;
  return (await getKeys(password)).signing;
}

async function readBody(request: Request): Promise<Record<string, string>> {
  const type = request.headers.get("content-type") ?? "";
  const out: Record<string, string> = {};
  if (type.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    for (const [k, v] of Object.entries(body)) if (typeof v === "string") out[k] = v;
    return out;
  }
  const text = await request.text();
  for (const [k, v] of new URLSearchParams(text)) out[k] = v;
  return out;
}

function oauthError(error: string, description: string, status = 400): Response {
  return json({ error, error_description: description }, status);
}

export async function register(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") return preflight();
  if (request.method !== "POST") return oauthError("invalid_request", "Use POST.", 405);
  const key = await signingKey();
  if (!key) return oauthError("server_error", "The connector has no ADMIN_PASSWORD yet.", 503);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const ruris = Array.isArray(body?.redirect_uris) ? (body!.redirect_uris as unknown[]).filter((u): u is string => typeof u === "string") : [];
  if (!ruris.length || ruris.length > 10) return oauthError("invalid_redirect_uri", "Give 1 to 10 redirect_uris.");
  const bad = ruris.find((u) => !redirectAllowed(u));
  if (bad) return oauthError("invalid_redirect_uri", `Redirect address not allowed: ${bad}`);
  const name = typeof body?.client_name === "string" ? body.client_name.slice(0, 100) : "MCP client";
  const issued = nowSeconds();
  const clientId = await signToken(key, { typ: "client", exp: issued + CLIENT_TTL, ruris, name } satisfies ClientToken);
  return json(
    {
      client_id: clientId,
      client_id_issued_at: issued,
      client_name: name,
      redirect_uris: ruris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    },
    201,
  );
}

export function preflight(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type, authorization, mcp-protocol-version",
    },
  });
}

interface AuthorizeParams {
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  code_challenge_method: string;
  state: string;
  scope: string;
  resource: string;
  response_type: string;
}

function pickParams(source: Record<string, string>): AuthorizeParams {
  const get = (k: string) => source[k] ?? "";
  return {
    client_id: get("client_id"),
    redirect_uri: get("redirect_uri"),
    code_challenge: get("code_challenge"),
    code_challenge_method: get("code_challenge_method"),
    state: get("state"),
    scope: get("scope"),
    resource: get("resource"),
    response_type: get("response_type"),
  };
}

function errorRedirect(p: AuthorizeParams, error: string, description: string, base: string): Response {
  const u = new URL(p.redirect_uri);
  u.searchParams.set("error", error);
  u.searchParams.set("error_description", description);
  if (p.state) u.searchParams.set("state", p.state);
  u.searchParams.set("iss", base);
  return new Response(null, { status: 302, headers: { location: u.toString(), "cache-control": "no-store" } });
}

function errorPage(message: string, status = 400): Response {
  return page({ title: "Can't connect", status, body: `<h1>Can't connect</h1><p>${esc(message)}</p>` });
}

export async function authorize(request: Request): Promise<Response> {
  const key = await signingKey();
  if (!key) return setupNeededPage();
  const base = baseUrl(request);
  const url = new URL(request.url);
  const form = request.method === "POST" ? await readBody(request) : {};
  const p = pickParams(request.method === "POST" ? form : Object.fromEntries(url.searchParams));

  const client = await verifyToken<ClientToken>(key, p.client_id, "client");
  if (!client) return errorPage("This connection request is out of date. Remove the connector in Claude and add it again.");
  if (!p.redirect_uri || !redirectMatches(client.ruris, p.redirect_uri)) {
    return errorPage("The return address in this request isn't one Claude registered.");
  }
  // From here, errors go back to Claude.
  if (p.response_type !== "code") return errorRedirect(p, "unsupported_response_type", "Only code is supported.", base);
  if (!p.code_challenge || p.code_challenge_method !== "S256") {
    return errorRedirect(p, "invalid_request", "PKCE with S256 is required.", base);
  }
  if (p.resource && p.resource.replace(/\/+$/, "") !== mcpUrl(base)) {
    return errorRedirect(p, "invalid_target", "Unknown resource.", base);
  }

  const target = new URL(p.redirect_uri);
  const formTargets = [target.origin];
  let message = "";

  if (request.method === "POST") {
    if (form.decision === "deny") return errorRedirect(p, "access_denied", "The owner declined.", base);
    const ip = clientIp(request);
    if (isLocked(ip)) {
      message = "Too many wrong passwords. Wait 10 minutes and try again.";
    } else if (await safeEqual(form.password ?? "", adminPassword()!)) {
      clearFailures(ip);
      const state = await loadState();
      const code = await signToken(key, {
        typ: "code",
        exp: nowSeconds() + CODE_TTL,
        cid: await sha256b64url(p.client_id),
        ruri: p.redirect_uri,
        cc: p.code_challenge,
        scope: p.scope || "search",
        ep: state.epoch,
      } satisfies CodeToken);
      target.searchParams.set("code", code);
      if (p.state) target.searchParams.set("state", p.state);
      target.searchParams.set("iss", base);
      return new Response(null, { status: 302, headers: { location: target.toString(), "cache-control": "no-store" } });
    } else {
      await recordFailure(ip);
      message = "That password isn't right.";
    }
  }

  const hidden = (Object.keys(p) as (keyof AuthorizeParams)[])
    .map((k) => `<input type="hidden" name="${k}" value="${esc(p[k])}">`)
    .join("");
  const local = isLoopback(target);
  return page({
    title: "Connect to Claude",
    formTargets,
    status: message ? 401 : 200,
    body: `<h1>Connect Search to ${esc(client.name)}</h1>
<p class="muted">Signing in lets this app use your Exa and Parallel keys through this connector. Your keys are never shown to it.</p>
<div class="card"><p>Sign-in will return to <strong class="mono">${esc(target.host)}</strong>${local ? ' <span class="tag warn">a program on this computer</span>' : ""}.</p>
${local ? '<p class="muted">Only continue if you just started this connection from Claude Code on this computer.</p>' : ""}
${message ? `<p class="bad">${esc(message)}</p>` : ""}
<form method="post" action="${esc(base)}/authorize">${hidden}
<label for="password">Admin password</label><input id="password" name="password" type="password" autocomplete="current-password" required autofocus>
<div class="row"><button type="submit" name="decision" value="allow">Connect</button><button type="submit" name="decision" value="deny" class="plain" formnovalidate>Cancel</button></div>
</form></div>`,
  });
}

async function issueTokens(key: CryptoKey, cid: string, scope: string, ep: number, aud: string): Promise<Response> {
  const now = nowSeconds();
  const access = await signToken(key, { typ: "access", exp: now + ACCESS_TTL, cid, scope, ep, aud } satisfies AccessToken);
  const refresh = await signToken(key, {
    typ: "refresh",
    exp: now + REFRESH_TTL,
    cid,
    scope,
    ep,
    aud,
    jti: randomId(),
  } satisfies RefreshToken);
  return json({ access_token: access, token_type: "Bearer", expires_in: ACCESS_TTL, refresh_token: refresh, scope });
}

export async function token(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") return preflight();
  if (request.method !== "POST") return oauthError("invalid_request", "Use POST.", 405);
  const key = await signingKey();
  if (!key) return oauthError("server_error", "The connector has no ADMIN_PASSWORD yet.", 503);
  const body = await readBody(request);
  const base = baseUrl(request);
  const state = await loadState();
  const cid = body.client_id ? await sha256b64url(body.client_id) : "";

  if (body.grant_type === "authorization_code") {
    const code = await verifyToken<CodeToken>(key, body.code, "code");
    if (!code) return oauthError("invalid_grant", "The code is invalid or has expired.");
    if (!body.client_id || code.cid !== cid) return oauthError("invalid_grant", "The code was issued to another client.");
    if (body.redirect_uri !== code.ruri) return oauthError("invalid_grant", "redirect_uri doesn't match.");
    if (!body.code_verifier || (await sha256b64url(body.code_verifier)) !== code.cc) {
      return oauthError("invalid_grant", "PKCE check failed.");
    }
    if (code.ep !== state.epoch) return oauthError("invalid_grant", "Connections were reset. Sign in again.");
    if (!(await verifyToken<ClientToken>(key, body.client_id, "client"))) return oauthError("invalid_client", "Unknown client.", 401);
    return issueTokens(key, cid, code.scope, state.epoch, mcpUrl(base));
  }

  if (body.grant_type === "refresh_token") {
    const refresh = await verifyToken<RefreshToken>(key, body.refresh_token, "refresh");
    if (!refresh || refresh.ep !== state.epoch) return oauthError("invalid_grant", "The refresh token is invalid or has expired.");
    if (body.client_id && refresh.cid !== cid) return oauthError("invalid_grant", "The token was issued to another client.");
    return issueTokens(key, refresh.cid, refresh.scope, state.epoch, refresh.aud);
  }

  return oauthError("unsupported_grant_type", "Use authorization_code or refresh_token.");
}

// For the MCP endpoint: returns null when the request carries a valid token.
export async function requireBearer(request: Request): Promise<Response | null> {
  const base = baseUrl(request);
  const challenge = (error?: string) => {
    const parts = [`Bearer resource_metadata="${resourceMetadataUrl(base)}"`, `scope="search"`];
    if (error) parts.push(`error="${error}"`);
    return json({ error: error ?? "unauthorized", error_description: "Sign in to use this connector." }, 401, {
      "www-authenticate": parts.join(", "),
    });
  };
  const key = await signingKey();
  if (!key) return json({ error: "server_error", error_description: "ADMIN_PASSWORD is not set." }, 503);
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return challenge();
  const access = await verifyToken<AccessToken>(key, match[1].trim(), "access");
  if (!access) return challenge("invalid_token");
  const state = await loadState();
  if (access.ep !== state.epoch || access.aud !== mcpUrl(base)) return challenge("invalid_token");
  return null;
}
