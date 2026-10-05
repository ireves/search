// Keys, encryption and signed tokens.
//
// Everything is derived from ADMIN_PASSWORD, so the deployment needs only one
// secret. Changing the password signs out every Claude connection and makes
// saved API keys unreadable (they must be added again on the settings page).

const enc = new TextEncoder();
const dec = new TextDecoder();

const PBKDF2_ITERATIONS = 210_000;
const PBKDF2_SALT = "search-connector/v1";

export function b64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

export function fromB64url(text: string): Uint8Array<ArrayBuffer> {
  const bytes = Buffer.from(text, "base64url");
  const out = new Uint8Array(new ArrayBuffer(bytes.length));
  out.set(bytes);
  return out;
}

export function randomId(bytes = 16): string {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

interface Keys {
  encryption: CryptoKey;
  signing: CryptoKey;
}

let cached: { password: string; keys: Promise<Keys> } | null = null;

export function getKeys(password: string): Promise<Keys> {
  if (cached && cached.password === password) return cached.keys;
  const keys = deriveKeys(password);
  cached = { password, keys };
  return keys;
}

async function deriveKeys(password: string): Promise<Keys> {
  const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const master = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: enc.encode(PBKDF2_SALT), iterations: PBKDF2_ITERATIONS },
    base,
    256,
  );
  const hkdf = await crypto.subtle.importKey("raw", master, "HKDF", false, ["deriveKey"]);
  const sub = (info: string, algorithm: AesKeyGenParams | HmacKeyGenParams, usages: KeyUsage[]) =>
    crypto.subtle.deriveKey(
      { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(32), info: enc.encode(info) },
      hkdf,
      algorithm,
      false,
      usages,
    );
  const [encryption, signing] = await Promise.all([
    sub("secrets-encryption", { name: "AES-GCM", length: 256 }, ["encrypt", "decrypt"]),
    sub("token-signing", { name: "HMAC", hash: "SHA-256", length: 256 }, ["sign", "verify"]),
  ]);
  return { encryption, signing };
}

export interface Sealed {
  iv: string;
  ct: string;
}

// AES-256-GCM. The secret's name is bound in as associated data, so a stored
// value can't be swapped under a different name.
export async function seal(key: CryptoKey, plaintext: string, label: string): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: enc.encode(label) },
    key,
    enc.encode(plaintext),
  );
  return { iv: b64url(iv), ct: b64url(new Uint8Array(ct)) };
}

export async function unseal(key: CryptoKey, sealed: Sealed, label: string): Promise<string | null> {
  try {
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromB64url(sealed.iv), additionalData: enc.encode(label) },
      key,
      fromB64url(sealed.ct),
    );
    return dec.decode(pt);
  } catch {
    return null;
  }
}

// Signed tokens: "<payload>.<signature>", both base64url. The payload is not
// secret (it never holds credentials), only tamper-proof.
export type TokenPayload = Record<string, unknown> & { typ: string; exp: number };

export async function signToken(key: CryptoKey, payload: TokenPayload): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return `${body}.${b64url(new Uint8Array(sig))}`;
}

export async function verifyToken<T extends TokenPayload>(
  key: CryptoKey,
  token: string | null | undefined,
  typ: string,
): Promise<T | null> {
  if (!token || token.length > 8192) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  let ok = false;
  try {
    ok = await crypto.subtle.verify("HMAC", key, fromB64url(sig), enc.encode(body));
  } catch {
    return null;
  }
  if (!ok) return null;
  let payload: T;
  try {
    payload = JSON.parse(dec.decode(fromB64url(body)));
  } catch {
    return null;
  }
  if (payload.typ !== typ) return null;
  if (typeof payload.exp !== "number" || payload.exp < nowSeconds()) return null;
  return payload;
}

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export async function sha256b64url(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(text));
  return b64url(new Uint8Array(digest));
}

// Compares two strings without leaking where they differ.
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([sha256b64url(a), sha256b64url(b)]);
  let diff = ha.length ^ hb.length;
  for (let i = 0; i < Math.min(ha.length, hb.length); i++) diff |= ha.charCodeAt(i) ^ hb.charCodeAt(i);
  return diff === 0 && a.length === b.length;
}
