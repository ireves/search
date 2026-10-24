// The job search Inbox in Supabase (supabase/job-inbox.sql): new roles
// waiting for Claude's review, and companies whose careers page the server
// couldn't read. Uses SUPABASE_URL and SUPABASE_LOG_KEY, like the run log.
// Roles Claude keeps are written to Notion's Open Roles (lib/jobs/review.ts).

import { randomId } from "../crypto.js";
import { readSecret } from "../store.js";
import { INBOX, RUN_LOG } from "./config.js";

export interface InboxRow {
  id: string;
  at?: string;
  found: string;
  kind: "role" | "needs_claude";
  status: "new" | "added" | "rejected";
  company: string;
  title: string | null;
  link: string | null;
  keys: string[];
  role_key: string | null;
  location: string | null;
  pay: string | null;
  source: string | null;
  advert: string | null;
  reason: string | null;
  notion_url: string | null;
  reviewed_at: string | null;
}

// The columns the duplicate check needs.
export type InboxKeys = Pick<InboxRow, "company" | "kind" | "status" | "keys" | "role_key">;

export interface InboxStore {
  keys(): Promise<InboxKeys[]>;
  byStatus(status: InboxRow["status"]): Promise<InboxRow[]>;
  byIds(ids: string[]): Promise<InboxRow[]>;
  insert(rows: InboxRow[]): Promise<void>;
  update(id: string, patch: Partial<InboxRow>): Promise<void>;
}

export const newInboxId = () => randomId(6);

export class InboxError extends Error {
  get friendly(): string {
    return this.message;
  }
}

let override: InboxStore | null | undefined;

// Used by tests. undefined goes back to the real one.
export function useInbox(store: InboxStore | null | undefined): void {
  override = store;
}

export async function inbox(): Promise<InboxStore> {
  if (override !== undefined) {
    if (!override) throw new InboxError("The job search Inbox isn't set up.");
    return override;
  }
  const [base, key] = await Promise.all([readSecret(RUN_LOG.urlSecret), readSecret(RUN_LOG.keySecret)]);
  if (!base || !key) throw new InboxError(`The job search Inbox needs ${RUN_LOG.urlSecret} and ${RUN_LOG.keySecret} on the connector's settings page.`);
  const root = `${base.replace(/\/+$/, "")}/rest/v1/${INBOX.table}`;
  const headers: Record<string, string> = { apikey: key, "content-type": "application/json" };
  if (key.startsWith("eyJ")) headers.authorization = `Bearer ${key}`;

  async function call<T>(method: string, query: string, body?: unknown, prefer?: string): Promise<T> {
    const response = await fetch(`${root}${query}`, {
      method,
      headers: { ...headers, ...(prefer ? { prefer } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(INBOX.timeoutMs),
    });
    const text = await response.text();
    if (!response.ok) throw new InboxError(`The Inbox in Supabase answered ${response.status}: ${text.slice(0, 200)}`);
    return (text ? JSON.parse(text) : null) as T;
  }

  // Supabase returns at most 1,000 rows a request.
  async function all<T>(query: string): Promise<T[]> {
    const rows: T[] = [];
    for (let offset = 0; offset < INBOX.maxRows; offset += 1000) {
      const page = await call<T[]>("GET", `${query}&order=at.asc&limit=1000&offset=${offset}`);
      rows.push(...page);
      if (page.length < 1000) break;
    }
    return rows;
  }

  return {
    keys: () => all<InboxKeys>("?select=company,kind,status,keys,role_key"),
    byStatus: (status) => all<InboxRow>(`?select=*&status=eq.${status}`),
    byIds: async (ids) => (ids.length ? call<InboxRow[]>("GET", `?select=*&id=in.(${ids.map(encodeURIComponent).join(",")})`) : []),
    async insert(rows) {
      for (let i = 0; i < rows.length; i += 100) await call("POST", "", rows.slice(i, i + 100), "return=minimal");
    },
    async update(id, patch) {
      await call("PATCH", `?id=eq.${encodeURIComponent(id)}`, patch, "return=minimal");
    },
  };
}
