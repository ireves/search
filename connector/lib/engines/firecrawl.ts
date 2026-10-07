// Firecrawl: reads pages through a real browser, including some sites Exa
// and Parallel can't open (Quora, some news sites). Optional: used only when
// FIRECRAWL_API_KEY is set. Billed in credits, 1 per page (1 per PDF page).
// API reference: https://docs.firecrawl.dev/api-reference/endpoint/scrape

import { addCredits } from "../cost.js";
import { cleanText, isoDay } from "../text.js";
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

// Free call that proves the key works.
export async function firecrawlCheck(key: string): Promise<number> {
  const response = await fetch(`${BASE}/v2/team/credit-usage`, { headers: { authorization: `Bearer ${key}` } });
  return response.status;
}
