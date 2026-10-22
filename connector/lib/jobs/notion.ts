// A small Notion API client for the job search: query a data source and
// change a page's columns. Uses the NOTION_TOKEN secret (a Notion internal
// integration shared with Open Roles and Job Applications).

import { readSecret } from "../store.js";
import { NOTION } from "./config.js";

export class NotionError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }

  get friendly(): string {
    if (this.status === 0 && /no token/.test(this.message)) return this.message;
    if (this.status === 401) return "Notion rejected the token. Check NOTION_TOKEN on the connector's settings page.";
    if (this.status === 403 || this.status === 404) return "Notion couldn't find the database. Share Open Roles and Job Applications with the integration.";
    if (this.status === 429) return "Notion rate limit reached.";
    if (this.status === -1) return "Notion took too long to respond.";
    if (this.status >= 500) return `Notion had a server error (${this.status}).`;
    return `Notion error ${this.status}: ${this.message.slice(0, 200)}`;
  }
}

export interface NotionPage {
  id: string;
  url?: string;
  properties: Record<string, any>;
}

export interface Notion {
  query(dataSource: string, filter?: unknown): Promise<NotionPage[]>;
  update(pageId: string, properties: Record<string, unknown>): Promise<void>;
  create(dataSource: string, properties: Record<string, unknown>, children?: unknown[]): Promise<string>;
}

let lastCall = 0;
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function call<T>(token: string, method: string, path: string, body?: unknown, retried = false): Promise<T> {
  const wait = lastCall + NOTION.gapMs - Date.now();
  if (wait > 0) await pause(wait);
  lastCall = Date.now();
  let response: Response;
  try {
    response = await fetch(`${NOTION.api}${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, "notion-version": NOTION.version, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(NOTION.timeoutMs),
    });
  } catch (error) {
    const timedOut = (error as Error).name === "TimeoutError" || (error as Error).name === "AbortError";
    throw new NotionError(timedOut ? -1 : 0, timedOut ? "timeout" : `network error: ${(error as Error).message}`);
  }
  const text = await response.text();
  if (response.status === 429 && !retried) {
    const after = Number(response.headers.get("retry-after")) || 1;
    await pause(Math.min(after, 10) * 1000);
    return call(token, method, path, body, true);
  }
  if (!response.ok) {
    let message = text;
    try {
      message = JSON.parse(text)?.message ?? text;
    } catch {
      // keep raw text
    }
    throw new NotionError(response.status, message);
  }
  return JSON.parse(text) as T;
}

let override: Notion | null = null;

// Used by tests.
export function useNotion(client: Notion | null): void {
  override = client;
}

export async function notion(): Promise<Notion> {
  if (override) return override;
  const token = await readSecret(NOTION.tokenSecret);
  if (!token) throw new NotionError(0, `Notion has no token. Add ${NOTION.tokenSecret} on the connector's settings page.`);
  return {
    async query(dataSource, filter) {
      const pages: NotionPage[] = [];
      let cursor: string | undefined;
      do {
        const body: Record<string, unknown> = { page_size: 100 };
        if (filter) body.filter = filter;
        if (cursor) body.start_cursor = cursor;
        const reply = await call<{ results: NotionPage[]; has_more: boolean; next_cursor: string | null }>(token, "POST", `/data_sources/${dataSource}/query`, body);
        pages.push(...reply.results);
        cursor = reply.has_more && reply.next_cursor ? reply.next_cursor : undefined;
      } while (cursor && pages.length < 2000);
      return pages;
    },
    async update(pageId, properties) {
      await call(token, "PATCH", `/pages/${pageId}`, { properties });
    },
    async create(dataSource, properties, children) {
      const body: Record<string, unknown> = { parent: { type: "data_source_id", data_source_id: dataSource }, properties };
      if (children?.length) body.children = children;
      const page = await call<{ id: string }>(token, "POST", "/pages", body);
      return page.id;
    },
  };
}

// Reading column values.
export const text = (prop: any): string =>
  (prop?.title ?? prop?.rich_text ?? []).map((t: any) => t?.plain_text ?? t?.text?.content ?? "").join("").trim();
export const select = (prop: any): string | null => prop?.select?.name ?? prop?.status?.name ?? null;
export const url = (prop: any): string | null => prop?.url ?? null;
export const dateStart = (prop: any): string | null => prop?.date?.start ?? null;

export const selectValue = (name: string) => ({ select: { name } });
export const textValue = (value: string) => ({ rich_text: value ? [{ type: "text", text: { content: value.slice(0, 2000) } }] : [] });
export const titleValue = (value: string) => ({ title: [{ type: "text", text: { content: value.slice(0, 2000) } }] });
export const urlValue = (value: string | null) => ({ url: value || null });
export const dateValue = (value: string | null) => ({ date: value ? { start: value } : null });

// A folded section holding long text, split into paragraphs of Notion's
// 2,000-character limit.
export function toggleBlock(heading: string, body: string): unknown {
  const parts: string[] = [];
  for (const para of body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)) {
    for (let i = 0; i < para.length; i += 2000) parts.push(para.slice(i, i + 2000));
  }
  return {
    object: "block",
    type: "toggle",
    toggle: {
      rich_text: [{ type: "text", text: { content: heading } }],
      children: parts.slice(0, 90).map((content) => ({ object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content } }] } })),
    },
  };
}
