// Shared test set-up: a fixed admin password, in-memory storage and a fake
// network that answers like Exa and Parallel.

process.env.ADMIN_PASSWORD = "correct horse battery staple";
process.env.RESEARCH_WAIT_MS = "3000";
delete process.env.BLOB_STORE_ID;
delete process.env.BLOB_READ_WRITE_TOKEN;

import { MemoryBackend, setSecret, useBackend } from "../lib/store.js";

export const BASE = "https://search.example.com";

export interface Call {
  url: string;
  method: string;
  body: any;
  headers: Record<string, string>;
}

export const calls: Call[] = [];
type Handler = (call: Call) => { status?: number; body: unknown } | undefined;
let handlers: Handler[] = [];

const realFetch = globalThis.fetch;

export function mockNetwork(...list: Handler[]): void {
  handlers = list;
  calls.length = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const call: Call = {
      url,
      method: init?.method ?? "GET",
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
      headers: Object.fromEntries(Object.entries((init?.headers as Record<string, string>) ?? {})),
    };
    calls.push(call);
    for (const h of handlers) {
      const reply = h(call);
      if (reply) return new Response(JSON.stringify(reply.body), { status: reply.status ?? 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "unmocked " + url }), { status: 404 });
  }) as typeof fetch;
}

export function restoreNetwork(): void {
  globalThis.fetch = realFetch;
}

export async function freshStore(withKeys = true): Promise<MemoryBackend> {
  const store = new MemoryBackend();
  useBackend(store);
  if (withKeys) {
    await setSecret("EXA_API_KEY", "exa-test-key-123");
    await setSecret("PARALLEL_API_KEY", "parallel-test-key-456");
  }
  return store;
}

export function req(path: string, init: RequestInit & { form?: Record<string, string>; json?: unknown } = {}): Request {
  const headers = new Headers(init.headers);
  headers.set("host", "search.example.com");
  headers.set("x-forwarded-proto", "https");
  let body = init.body;
  if (init.form) {
    headers.set("content-type", "application/x-www-form-urlencoded");
    body = new URLSearchParams(init.form).toString();
  }
  if (init.json !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(init.json);
  }
  return new Request(`${BASE}${path}`, { ...init, headers, body, redirect: "manual" });
}

export const exaResult = (url: string, title: string, highlight: string, date?: string) => ({
  id: url,
  url,
  title,
  publishedDate: date ? `${date}T00:00:00.000Z` : undefined,
  highlights: [highlight],
});

export const parallelResult = (url: string, title: string, excerpt: string, date: string | null = null) => ({
  url,
  title,
  publish_date: date,
  excerpts: [excerpt],
});
