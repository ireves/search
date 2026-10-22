// The job search run log: one row per run in job_search_runs and one per
// stage in job_search_stages (supabase/job-search.sql). Written with the
// Supabase project's insert-only key; Claude reads it back with the Supabase
// connector. Holds counts, failures and advert details only, never CV text.
// Without SUPABASE_URL and SUPABASE_LOG_KEY nothing is recorded.

import { readSecret } from "../store.js";
import { RUN_LOG } from "./config.js";

export type RunLogWriter = (table: string, row: Record<string, unknown>) => Promise<void>;

let override: RunLogWriter | null | undefined;

// Used by tests. undefined goes back to the real one.
export function useRunLog(writer: RunLogWriter | null | undefined): void {
  override = writer;
}

export async function runLog(): Promise<RunLogWriter | null> {
  if (override !== undefined) return override;
  const [base, key] = await Promise.all([readSecret(RUN_LOG.urlSecret), readSecret(RUN_LOG.keySecret)]);
  if (!base || !key) return null;
  const headers: Record<string, string> = { apikey: key, "content-type": "application/json", prefer: "return=minimal" };
  if (key.startsWith("eyJ")) headers.authorization = `Bearer ${key}`;
  return async (table, row) => {
    const response = await fetch(`${base.replace(/\/+$/, "")}/rest/v1/${table}`, {
      method: "POST",
      headers,
      body: JSON.stringify(row),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`Supabase ${response.status}: ${(await response.text().catch(() => "")).slice(0, 200)}`);
  };
}
