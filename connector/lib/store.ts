// Write-only secret storage.
//
// API keys are encrypted with a key derived from ADMIN_PASSWORD and kept in a
// private Vercel Blob store. Nothing in this module returns a saved value to a
// web page; `readSecret` is only used server-side to call Exa and Parallel.

import { getKeys, seal, unseal, type Sealed } from "./crypto.js";
import { adminPassword } from "./config.js";

const STATE_PATH = "search-connector/state.json";
const CACHE_MS = 30_000;

export interface StoredSecret extends Sealed {
  updatedAt: string;
}

// A passkey's public half. Not secret: it can only check signatures.
export interface StoredPasskey {
  id: string;
  publicKey: string;
  counter: number;
  transports?: string[];
  name: string;
  createdAt: string;
  lastUsedAt?: string;
  synced?: boolean;
}

export interface State {
  v: 1;
  // Bumped to sign out every Claude connection and settings session.
  epoch: number;
  secrets: Record<string, StoredSecret>;
  passkeys?: StoredPasskey[];
}

export interface Backend {
  name: string;
  read(): Promise<string | null>;
  write(body: string): Promise<void>;
}

class BlobBackend implements Backend {
  name = "Vercel Blob";
  async read(): Promise<string | null> {
    const { get } = await import("@vercel/blob");
    const result = await get(STATE_PATH, { access: "private", useCache: false });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    return await new Response(result.stream).text();
  }
  async write(body: string): Promise<void> {
    const { put } = await import("@vercel/blob");
    await put(STATE_PATH, body, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 60,
    });
  }
}

export class MemoryBackend implements Backend {
  name = "memory";
  body: string | null = null;
  async read() {
    return this.body;
  }
  async write(body: string) {
    this.body = body;
  }
}

let backendOverride: Backend | null = null;

// Used by tests and local development.
export function useBackend(backend: Backend | null): void {
  backendOverride = backend;
  cache = null;
}

export function backend(): Backend | null {
  if (backendOverride) return backendOverride;
  if (process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN) return new BlobBackend();
  return null;
}

let cache: { at: number; state: State } | null = null;

const emptyState = (): State => ({ v: 1, epoch: 1, secrets: {} });

export async function loadState(fresh = false): Promise<State> {
  if (!fresh && cache && Date.now() - cache.at < CACHE_MS) return cache.state;
  const store = backend();
  let state = emptyState();
  if (store) {
    const body = await store.read();
    if (body) {
      try {
        const parsed = JSON.parse(body) as State;
        if (parsed && parsed.v === 1 && typeof parsed.epoch === "number") state = parsed;
      } catch {
        // A damaged file is treated as empty rather than locking the owner out.
      }
    }
  }
  cache = { at: Date.now(), state };
  return state;
}

export async function saveState(state: State): Promise<void> {
  const store = backend();
  if (!store) throw new Error("No storage connected. Connect a private Vercel Blob store to this project.");
  await store.write(JSON.stringify(state));
  cache = { at: Date.now(), state };
}

export const SECRET_NAME = /^[A-Z][A-Z0-9_]{1,63}$/;

export async function setSecret(name: string, value: string): Promise<void> {
  const password = adminPassword();
  if (!password) throw new Error("ADMIN_PASSWORD is not set.");
  if (!SECRET_NAME.test(name)) throw new Error("Names use capital letters, digits and underscores, like EXA_API_KEY.");
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 4096) throw new Error("The value is empty or too long.");
  const { encryption } = await getKeys(password);
  const state = await loadState(true);
  state.secrets[name] = { ...(await seal(encryption, trimmed, name)), updatedAt: new Date().toISOString() };
  await saveState(state);
}

export async function removeSecret(name: string): Promise<void> {
  const state = await loadState(true);
  delete state.secrets[name];
  await saveState(state);
}

export async function bumpEpoch(): Promise<void> {
  const state = await loadState(true);
  state.epoch += 1;
  await saveState(state);
}

export type SecretSource = "saved" | "unreadable" | "vercel" | "missing";

export interface SecretStatus {
  name: string;
  source: SecretSource;
  updatedAt?: string;
}

// Names and status only, never values.
export async function listSecrets(names: string[]): Promise<SecretStatus[]> {
  const state = await loadState(true);
  const password = adminPassword();
  const keys = password ? await getKeys(password) : null;
  const all = new Set([...names, ...Object.keys(state.secrets)]);
  const out: SecretStatus[] = [];
  for (const name of all) {
    const stored = state.secrets[name];
    if (stored) {
      const readable = keys ? (await unseal(keys.encryption, stored, name)) !== null : false;
      out.push({ name, source: readable ? "saved" : "unreadable", updatedAt: stored.updatedAt });
    } else if (process.env[name]) {
      out.push({ name, source: "vercel" });
    } else {
      out.push({ name, source: "missing" });
    }
  }
  return out;
}

// Server-side only: the saved value wins over a Vercel environment variable.
export async function readSecret(name: string): Promise<string | null> {
  const state = await loadState();
  const stored = state.secrets[name];
  const password = adminPassword();
  if (stored && password) {
    const { encryption } = await getKeys(password);
    const value = await unseal(encryption, stored, name);
    if (value) return value;
  }
  return process.env[name] || null;
}
