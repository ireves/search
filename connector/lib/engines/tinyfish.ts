// TinyFish: Google-style search results and a page reader that renders
// JavaScript and reads PDFs. Both are free within a daily allowance (12,000
// searches and 1,000 pages a day), so the connector asks TinyFish first to
// save Exa, Parallel and Firecrawl usage. Optional: used only when
// TINYFISH_API_KEY is set.
// API reference: https://docs.tinyfish.ai/search-api/reference and
// https://docs.tinyfish.ai/fetch-api/reference

import { countFree } from "../cost.js";
import { cleanText, isoDay } from "../text.js";
import type { Hit } from "./exa.js";
import { leadingDate } from "./firecrawl.js";
import { callJson, EngineError } from "./http.js";
import { readSecret } from "../store.js";

const SEARCH_URL = "https://api.search.tinyfish.ai";
const FETCH_URL = "https://api.fetch.tinyfish.ai";

export async function tinyfishKey(): Promise<string | null> {
  return (await readSecret("TINYFISH_API_KEY")) ?? null;
}

// 401 and 403 mean the key; 402 means the day's free allowance is used up
// (it resets at midnight UTC); 429 means too many requests.
export function isAccountProblem(err: EngineError): boolean {
  return err.status === 401 || err.status === 402 || err.status === 403 || err.status === 429;
}

export interface TinyfishPage {
  url: string;
  ok: boolean;
  title?: string;
  date?: string;
  author?: string;
  content: string;
  error?: string;
}

interface FetchReply {
  results?: { url?: string; final_url?: string; title?: string | null; author?: string | null; published_date?: string | null; text?: unknown }[];
  errors?: { url?: string; error?: string; status?: number }[];
}

// Plain-language reasons for TinyFish's per-page error codes.
const PAGE_ERRORS: Record<string, string> = {
  timeout: "took too long",
  bot_blocked: "blocks automated readers",
  login_required: "needs a login",
  page_not_found: "page not found",
  content_too_large: "too large",
  empty_content: "empty page",
};

// Reads up to 10 pages in one request, each in full. Pages TinyFish can't read
// come back with ok: false; a problem with the key or the daily allowance is
// returned so the caller can say so and use the other readers.
export async function tinyfishRead(urls: string[], fresh: boolean, timeoutMs: number): Promise<{ pages: TinyfishPage[]; problem?: EngineError }> {
  const key = await tinyfishKey();
  if (!key) throw new EngineError("TinyFish", 0, "TinyFish has no API key.");
  const failed = (error: string) => urls.map((url) => ({ url, ok: false, content: "", error }));
  let data: FetchReply;
  try {
    data = await callJson<FetchReply>("TinyFish", FETCH_URL, {
      headers: { "x-api-key": key },
      body: {
        urls: urls.slice(0, 10),
        format: "markdown",
        ...(fresh ? { ttl: 0 } : {}),
        // TinyFish gives up on a page a little before the request does, so a
        // slow site comes back as its own error and the others still arrive.
        per_url_timeout_ms: Math.min(110_000, Math.max(1000, timeoutMs - 3000)),
      },
      timeoutMs,
    });
  } catch (e) {
    const err = e instanceof EngineError ? e : new EngineError("TinyFish", 0, (e as Error).message);
    if (isAccountProblem(err)) return { pages: failed("not available"), problem: err };
    return { pages: failed(err.status === -1 ? "took too long" : "not available") };
  }
  const read = new Map<string, TinyfishPage>();
  for (const r of data.results ?? []) {
    if (!r.url) continue;
    const content = typeof r.text === "string" ? cleanText(r.text) : "";
    countFree("tinyfishPages", 1);
    read.set(r.url, {
      url: r.url,
      ok: content.length > 0,
      title: r.title ? cleanText(r.title) || undefined : undefined,
      date: isoDay(r.published_date ?? undefined),
      author: r.author || undefined,
      content,
    });
  }
  for (const e of data.errors ?? []) {
    if (e.url && !read.has(e.url)) read.set(e.url, { url: e.url, ok: false, content: "", error: PAGE_ERRORS[e.error ?? ""] ?? "not available" });
  }
  return { pages: urls.map((url) => read.get(url) ?? { url, ok: false, content: "", error: "not available" }) };
}

export interface TinyfishSearchOptions {
  query: string;
  limit: number;
  purpose?: string;
  news?: boolean;
  sites?: string[];
  excludeSites?: string[];
  after?: string;
  before?: string;
  country?: string;
}

interface SearchReply {
  results?: { url?: string; title?: string; snippet?: string; date?: string }[];
}

// Search results only (titles, links and short snippets); no pages are read.
export async function tinyfishSearch(o: TinyfishSearchOptions): Promise<Hit[]> {
  const key = await tinyfishKey();
  if (!key) throw new EngineError("TinyFish", 0, "TinyFish has no API key.");
  const params = new URLSearchParams({ query: o.query.slice(0, 2000) });
  if (o.purpose) params.set("purpose", o.purpose.slice(0, 2000));
  if (o.news) params.set("domain_type", "news");
  if (o.sites?.length) params.set("include_domains", o.sites.join(","));
  else if (o.excludeSites?.length) params.set("exclude_domains", o.excludeSites.join(","));
  if (o.after) params.set("after_date", o.after);
  if (o.before) params.set("before_date", o.before);
  if (o.country) params.set("location", o.country.toUpperCase() === "UK" ? "GB" : o.country.toUpperCase());
  const data = await callJson<SearchReply>("TinyFish", `${SEARCH_URL}?${params}`, { headers: { "x-api-key": key }, timeoutMs: 20_000 });
  countFree("tinyfishSearches", 1);
  const hits: Hit[] = [];
  for (const item of data.results ?? []) {
    if (!item.url || !item.title) continue;
    const lifted = leadingDate(cleanText(item.snippet ?? "").replace(/\s*Read more$/, ""));
    hits.push({
      url: item.url,
      title: cleanText(item.title),
      date: isoDay(item.date) ?? lifted.date,
      excerpt: lifted.text,
      engine: "tinyfish",
    });
    if (hits.length >= o.limit) break;
  }
  return hits;
}

// Free call that proves the key works.
export async function tinyfishCheck(key: string): Promise<number> {
  const response = await fetch("https://agent.tinyfish.ai/v1/wallet", { headers: { "x-api-key": key } });
  return response.status;
}
