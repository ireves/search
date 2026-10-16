// The problem log's Supabase tables (set-up: docs/connector-setup.md). The
// connector adds rows with a publishable key that may only insert, never read:
// search_calls gets one row per tool call (see trace.ts), search_issues one
// row per log_issue call. Claude reads them back with the Supabase connector,
// through the search_issue_details view. Without SUPABASE_URL and
// SUPABASE_LOG_KEY nothing is recorded here and log_issue falls back to the
// Vercel Blob store.

import { readSecret } from "./store.js";

export type RowWriter = (table: "search_calls" | "search_issues", row: Record<string, unknown>) => Promise<void>;

let writerOverride: RowWriter | null | undefined;

// Used by tests and local development. undefined goes back to the real one.
export function useRowWriter(writer: RowWriter | null | undefined): void {
  writerOverride = writer;
}

export async function rowWriter(): Promise<RowWriter | null> {
  if (writerOverride !== undefined) return writerOverride;
  const [url, key] = await Promise.all([readSecret("SUPABASE_URL"), readSecret("SUPABASE_LOG_KEY")]);
  if (!url || !key) return null;
  const headers: Record<string, string> = { apikey: key, "content-type": "application/json", prefer: "return=minimal" };
  // Legacy anon keys are JWTs and go in authorization too; sb_publishable_ keys must not.
  if (key.startsWith("eyJ")) headers.authorization = `Bearer ${key}`;
  return async (table, row) => {
    const response = await fetch(`${url.replace(/\/+$/, "")}/rest/v1/${table}`, {
      method: "POST",
      headers,
      body: JSON.stringify(row),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`Supabase ${response.status}: ${(await response.text().catch(() => "")).slice(0, 200)}`);
  };
}

// Lets a write finish after the reply has gone, where Vercel allows it.
export async function afterReply(work: Promise<unknown>): Promise<void> {
  const safe = work.catch((e) => console.error(`problem log: ${(e as Error).message}`));
  const context = (globalThis as any)[Symbol.for("@vercel/request-context")]?.get?.();
  if (typeof context?.waitUntil === "function") context.waitUntil(safe);
  else await safe;
}

export function newRef(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8);
}
