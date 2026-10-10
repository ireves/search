// Firecrawl: reads pages through a real browser, including some sites Exa
// and Parallel can't open (Quora, some news sites), and searches with
// Google-style ranking, which finds forum threads and mainstream picks that
// Exa's meaning-based search misses. Optional: used only when
// FIRECRAWL_API_KEY is set. Billed in credits: 1 per page read (1 per PDF
// page), 2 per 10 search results.
// API reference: https://docs.firecrawl.dev/api-reference/endpoint/scrape
// and https://docs.firecrawl.dev/api-reference/endpoint/search

import { addCredits } from "../cost.js";
import { cleanText, isoDay } from "../text.js";
import type { Hit } from "./exa.js";
import { callJson, EngineError } from "./http.js";
import { readSecret } from "../store.js";

const BASE = "https://api.firecrawl.dev";

// The free plan allows 2 requests at a time.
const CONCURRENCY = 2;

// Long PDFs cost a credit per page, so only the first pages are read.
const PDF_MAX_PAGES = 15;

export interface FirecrawlPage {
  url: string;
  ok: boolean;
  title?: string;
  date?: string;
  author?: string;
  content: string;
  error?: string;
}

interface ScrapeReply {
  success?: boolean;
  data?: {
    markdown?: string;
    metadata?: Record<string, unknown> & { statusCode?: number; creditsUsed?: number; error?: string | null };
  };
}

export async function firecrawlKey(): Promise<string | null> {
  return (await readSecret("FIRECRAWL_API_KEY")) ?? null;
}

function text(value: unknown): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === "string" && v.trim() ? v : undefined;
}

async function scrapeOne(key: string, url: string, fresh: boolean): Promise<FirecrawlPage> {
  const data = await callJson<ScrapeReply>("Firecrawl", `${BASE}/v2/scrape`, {
    headers: { authorization: `Bearer ${key}` },
    body: {
      url,
      formats: ["markdown"],
      onlyMainContent: true,
      ...(fresh ? { maxAge: 0 } : {}),
      parsers: [{ type: "pdf", maxPages: PDF_MAX_PAGES }],
      timeout: 25_000,
    },
    timeoutMs: 35_000,
  });
  const meta = data.data?.metadata ?? {};
  addCredits("firecrawl", typeof meta.creditsUsed === "number" ? meta.creditsUsed : 1);
  const status = typeof meta.statusCode === "number" ? meta.statusCode : 200;
  if (!data.success || status >= 400) return { url, ok: false, content: "", error: status >= 400 ? `HTTP ${status}` : "not available" };
  const content = cleanText(data.data?.markdown ?? "");
  return {
    url,
    ok: content.length > 0,
    title: cleanText(text(meta.ogTitle) ?? text(meta.title) ?? "") || undefined,
    date: isoDay(text(meta.publishedTime) ?? text(meta["article:published_time"])),
    author: text(meta.author) ?? text(meta["article:author"]),
    content,
  };
}

// Reads each page in full. A page Firecrawl refuses comes back with ok: false;
// a problem with the key or credit is returned so the caller can say so.
export async function firecrawlScrape(urls: string[], fresh: boolean): Promise<{ pages: FirecrawlPage[]; problem?: EngineError }> {
  const key = await firecrawlKey();
  if (!key) throw new EngineError("Firecrawl", 0, "Firecrawl has no API key.");
  const pages: FirecrawlPage[] = new Array(urls.length);
  let accountProblem: EngineError | null = null;
  let next = 0;
  const worker = async () => {
    while (next < urls.length) {
      const i = next++;
      if (accountProblem) {
        pages[i] = { url: urls[i], ok: false, content: "", error: "skipped" };
        continue;
      }
      try {
        pages[i] = await scrapeOne(key, urls[i], fresh);
      } catch (e) {
        const err = e instanceof EngineError ? e : new EngineError("Firecrawl", 0, (e as Error).message);
        // 403 also means "we do not support this site", so only 401 and 402 are about the account.
        if (err.status === 401 || err.status === 402) accountProblem = err;
        pages[i] = { url: urls[i], ok: false, content: "", error: err.status === 403 ? "site not supported" : "not available" };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, urls.length) }, worker));
  return { pages, problem: accountProblem ?? undefined };
}

export interface FirecrawlSearchOptions {
  query: string;
  limit: number;
  news?: boolean;
  sites?: string[];
  excludeSites?: string[];
  after?: string;
  before?: string;
  country?: string;
}

interface SearchItem {
  url?: string;
  title?: string;
  description?: string;
  snippet?: string;
  date?: string;
}

interface SearchReply {
  success?: boolean;
  data?: { web?: SearchItem[]; news?: SearchItem[] };
  creditsUsed?: number;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

// Google-style snippets often open with the page date ("18 Jan 2026 · ..." or
// "Jan 18, 2026 — ..."). Lift it into the date field and drop it from the text.
export function leadingDate(snippet: string): { date?: string; text: string } {
  const m =
    /^(\d{1,2}) ([A-Za-z]{3})[a-z]*\.? (\d{4})\s*[·—–-]\s*/.exec(snippet) ??
    /^([A-Za-z]{3})[a-z]*\.? (\d{1,2}),? (\d{4})\s*[·—–-]\s*/.exec(snippet);
  if (!m) return { text: snippet };
  const [day, mon] = /^\d/.test(m[1]) ? [m[1], m[2]] : [m[2], m[1]];
  const month = MONTHS.indexOf(mon.toLowerCase());
  if (month < 0) return { text: snippet };
  const date = `${m[3]}-${String(month + 1).padStart(2, "0")}-${day.padStart(2, "0")}`;
  return { date, text: snippet.slice(m[0].length) };
}

// Google's custom date range, which Firecrawl passes through as "tbs".
function dateRange(after?: string, before?: string): string | undefined {
  if (!after && !before) return undefined;
  const us = (iso: string) => {
    const [y, m, d] = iso.split("-");
    return `${Number(m)}/${Number(d)}/${y}`;
  };
  return ["cdr:1", after ? `cd_min:${us(after)}` : "", before ? `cd_max:${us(before)}` : ""].filter(Boolean).join(",");
}

// Search results only (titles, links and Google's short snippets); no pages
// are read here, so a search costs 2 credits per 10 results.
export async function firecrawlSearch(o: FirecrawlSearchOptions): Promise<Hit[]> {
  const key = await firecrawlKey();
  if (!key) throw new EngineError("Firecrawl", 0, "Firecrawl has no API key.");
  const tbs = dateRange(o.after, o.before);
  const data = await callJson<SearchReply>("Firecrawl", `${BASE}/v2/search`, {
    headers: { authorization: `Bearer ${key}` },
    body: {
      query: o.query.slice(0, 500),
      limit: Math.min(Math.max(o.limit, 1), 20),
      sources: [o.news ? "news" : "web"],
      ...(o.sites?.length ? { includeDomains: o.sites } : o.excludeSites?.length ? { excludeDomains: o.excludeSites } : {}),
      ...(tbs ? { tbs } : {}),
      ...(o.country ? { country: o.country.toUpperCase() } : {}),
      timeout: 20_000,
    },
    timeoutMs: 25_000,
  });
  const items = (o.news ? data.data?.news : data.data?.web) ?? [];
  addCredits("firecrawl", typeof data.creditsUsed === "number" ? data.creditsUsed : 2 * Math.ceil(Math.max(items.length, 1) / 10));
  const hits: Hit[] = [];
  for (const item of items) {
    if (!item.url || !item.title) continue;
    const lifted = leadingDate(cleanText(item.description ?? item.snippet ?? ""));
    hits.push({
      url: item.url,
      title: cleanText(item.title),
      date: isoDay(item.date) ?? lifted.date,
      excerpt: lifted.text,
      engine: "firecrawl",
    });
  }
  return hits;
}

// Free call that proves the key works.
export async function firecrawlCheck(key: string): Promise<number> {
  const response = await fetch(`${BASE}/v2/team/credit-usage`, { headers: { authorization: `Bearer ${key}` } });
  return response.status;
}
