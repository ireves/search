// Exa: semantic (meaning-based) search over its own index, page reading,
// and the Exa Agent for multi-step research. API reference: https://exa.ai/docs

import { cleanText, isoDay, joinExcerpts, tidyExcerpt } from "../text.js";
import { apiKey, callJson } from "./http.js";

const BASE = "https://api.exa.ai";

export interface Hit {
  url: string;
  title: string;
  date?: string;
  author?: string;
  excerpt: string;
  engine: "exa" | "parallel";
  // Structured profile data (people, companies, papers), already compact.
  facts?: string;
}

export type ExaType = "instant" | "fast" | "auto" | "deep-lite" | "deep";

export interface ExaSearchOptions {
  query: string;
  objective?: string;
  highlightQuery?: string;
  numResults: number;
  type: ExaType;
  category?: string;
  includeDomains?: string[];
  excludeDomains?: string[];
  startPublishedDate?: string;
  endPublishedDate?: string;
  userLocation?: string;
  fresh?: boolean;
  maxChars: number;
}

interface ExaResult {
  id?: string;
  url: string;
  title?: string | null;
  publishedDate?: string | null;
  author?: string | null;
  highlights?: string[];
  text?: string;
  summary?: string;
  entities?: { type: string; properties: Record<string, any> }[];
}

async function headers(): Promise<Record<string, string>> {
  return { "x-api-key": await apiKey("Exa") };
}

// Category searches for people and companies reject date and exclude filters.
const NO_DATE_FILTERS = new Set(["people", "company"]);

export async function exaSearch(o: ExaSearchOptions): Promise<Hit[]> {
  const body: Record<string, unknown> = {
    query: o.query,
    type: o.type,
    numResults: o.numResults,
    contents: {
      highlights: { maxCharacters: o.maxChars, ...(o.highlightQuery ? { query: o.highlightQuery } : {}) },
      ...(o.fresh ? { maxAgeHours: 0, livecrawlTimeout: 15000 } : {}),
    },
  };
  if (o.objective) body.objective = o.objective.slice(0, 4000);
  if (o.category) body.category = o.category;
  if (o.includeDomains?.length) body.includeDomains = o.includeDomains;
  const datesAllowed = !o.category || !NO_DATE_FILTERS.has(o.category);
  if (o.excludeDomains?.length && datesAllowed) body.excludeDomains = o.excludeDomains;
  if (o.startPublishedDate && datesAllowed) body.startPublishedDate = `${o.startPublishedDate}T00:00:00.000Z`;
  if (o.endPublishedDate && datesAllowed) body.endPublishedDate = `${o.endPublishedDate}T23:59:59.999Z`;
  if (o.userLocation) body.userLocation = o.userLocation.toUpperCase();

  const data = await callJson<{ results?: ExaResult[] }>("Exa", `${BASE}/search`, {
    headers: await headers(),
    body,
    timeoutMs: o.type === "deep" ? 45_000 : o.fresh ? 40_000 : 25_000,
  });
  return (data.results ?? []).map((r) => toHit(r, o.maxChars));
}

const LIBRARY = /^https?:\/\/(www\.)?exa\.ai\/library\//;

function toHit(r: ExaResult, maxChars: number): Hit {
  const entity = r.entities?.[0];
  let url = r.url;
  // Papers sometimes come back as Exa library pages; prefer the DOI.
  if (LIBRARY.test(url) && entity?.properties?.doi) {
    url = `https://doi.org/${String(entity.properties.doi).replace(/^https?:\/\/doi\.org\//, "")}`;
  }
  const title = cleanText(r.title ?? "") || url;
  return {
    url,
    title,
    date: isoDay(r.publishedDate),
    author: r.author ?? undefined,
    excerpt: tidyExcerpt(joinExcerpts(r.highlights?.length ? r.highlights : [r.summary ?? r.text ?? ""], maxChars), title),
    engine: "exa",
    facts: entity ? entityFacts(entity) : undefined,
  };
}

const s = (v: unknown): string => {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "object") return s((v as any).name ?? (v as any).title ?? "");
  return String(v);
};

// Exa sends dates as {from, to}; older responses used plain strings.
const span = (d: any): string => {
  if (!d) return "";
  if (typeof d !== "object") return String(d);
  const from = s(d.from).slice(0, 7);
  const to = d.to ? s(d.to).slice(0, 7) : "now";
  if (!from) return "";
  return from === to ? from : `${from} to ${to}`;
};

export function entityFacts(entity: { type: string; properties: Record<string, any> }): string | undefined {
  const p = entity.properties ?? {};
  const parts: string[] = [];
  if (entity.type === "person") {
    if (p.location) parts.push(`Location: ${s(p.location)}`);
    // Current roles first, then the most recent past ones.
    const history = [...(p.workHistory ?? [])].sort((a: any, b: any) => {
      const current = (w: any) => (w?.dates && typeof w.dates === "object" && !w.dates.to ? 1 : 0);
      return current(b) - current(a) || s(b?.dates?.from ?? "").localeCompare(s(a?.dates?.from ?? ""));
    });
    const jobs = history.slice(0, 4).map((w: any) => [s(w.title), w.company ? `at ${s(w.company)}` : "", span(w.dates) ? `(${span(w.dates)})` : ""].filter(Boolean).join(" "));
    if (jobs.length) parts.push(`Work: ${jobs.join("; ")}`);
    const study = (p.educationHistory ?? []).slice(0, 2).map((e: any) => {
      const what = [s(e.degree), s(e.institution)].filter(Boolean).join(", ");
      return span(e.dates) ? `${what} (${span(e.dates)})` : what;
    });
    if (study.length) parts.push(`Education: ${study.join("; ")}`);
  } else if (entity.type === "company") {
    if (p.description) parts.push(cleanText(s(p.description)).slice(0, 300));
    const facts = [
      p.foundedYear ? `founded ${s(p.foundedYear)}` : "",
      p.headquarters?.city || p.headquarters?.country ? `HQ ${[p.headquarters.city, p.headquarters.country].filter(Boolean).join(", ")}` : "",
      p.workforce?.total ? `~${s(p.workforce.total)} staff` : "",
      p.financials?.fundingTotal ? `funding ${s(p.financials.fundingTotal)}` : "",
      p.financials?.fundingLatestRound?.name
        ? `latest round ${s(p.financials.fundingLatestRound.name)} ${s(p.financials.fundingLatestRound.amount)} ${s(p.financials.fundingLatestRound.date)}`.trim()
        : "",
    ].filter(Boolean);
    if (facts.length) parts.push(facts.join(" · "));
  } else if (entity.type === "publication") {
    const facts = [
      p.authors?.length ? `Authors: ${p.authors.slice(0, 5).map((a: any) => s(a.name)).join(", ")}${p.authors.length > 5 ? " et al." : ""}` : "",
      p.year ? `Year: ${s(p.year)}` : "",
      p.citationCount ? `Cited by ${s(p.citationCount)}` : "",
      p.doi ? `DOI: ${s(p.doi)}` : "",
    ].filter(Boolean);
    if (facts.length) parts.push(facts.join(" · "));
  }
  return parts.length ? parts.join("\n") : undefined;
}

export interface ExaPage {
  url: string;
  ok: boolean;
  title?: string;
  date?: string;
  content: string;
  error?: string;
  // Some publishers only let Exa return the first 1,000 characters.
  capped?: boolean;
}

const sameUrl = (a: string, b: string) => a.replace(/\/+$/, "").toLowerCase() === b.replace(/\/+$/, "").toLowerCase();

// Reads known pages. With a question, returns only the passages that answer it.
// "live" downloads the page now (current prices, versions, "latest" pages);
// "stored" uses Exa's copy. Never a positive maxAgeHours: in testing (October
// 2026) that returned a different document from Exa's paper library under the
// requested address. (Library IDs alone prove nothing: DOI and PubMed links
// legitimately come back with them.)
export async function exaContents(urls: string[], question: string | undefined, maxChars: number, freshness: "live" | "stored"): Promise<ExaPage[]> {
  const body: Record<string, unknown> = { urls };
  if (question) body.highlights = { query: question, maxCharacters: maxChars };
  else body.text = { maxCharacters: maxChars, verbosity: "compact" };
  if (freshness === "live") {
    body.maxAgeHours = 0;
    body.livecrawlTimeout = 20000;
  }
  const data = await callJson<{
    results?: ExaResult[];
    statuses?: { id: string; status: string; error?: { tag?: string; httpStatusCode?: number | null } | null }[];
  }>("Exa", `${BASE}/contents`, { headers: await headers(), body, timeoutMs: freshness === "live" ? 45_000 : 30_000 });

  const results = data.results ?? [];
  return urls.map((url, i) => {
    const status = data.statuses?.find((st) => sameUrl(st.id, url));
    const r =
      results.find((x) => sameUrl(x.url, url) || (x.id !== undefined && sameUrl(x.id, url))) ??
      (results.length === urls.length ? results[i] : undefined);
    if (!r || status?.status === "error") {
      return { url, ok: false, content: "", error: status?.error?.tag ?? "not available" };
    }
    const content = question ? joinExcerpts(r.highlights ?? [], maxChars) : cleanText(r.text ?? "");
    const capped = !question && maxChars > 1000 && (r.text ?? "").length === 1000;
    return { url, ok: content.length > 0, title: cleanText(r.title ?? "") || undefined, date: isoDay(r.publishedDate), content, capped };
  });
}

// Exa Agent: runs its own searches and reading, returns a cited answer.
export type ExaEffort = "minimal" | "low" | "medium" | "high" | "xhigh" | "auto";

export interface AgentRun {
  id: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  stopReason?: string | null;
  output?: {
    text?: string | null;
    grounding?: { field: string; citations: { url: string; title?: string }[]; confidence?: string | null }[];
  } | null;
  costDollars?: { total?: number } | null;
  error?: { message?: string } | null;
}

export async function exaAgentStart(query: string, effort: ExaEffort, systemPrompt: string, maxCostDollars?: number): Promise<AgentRun> {
  const body: Record<string, unknown> = { query, effort, systemPrompt };
  if (effort === "auto") body.budget = { maxCostDollars: maxCostDollars ?? 1 };
  return callJson<AgentRun>("Exa", `${BASE}/agent/runs`, { headers: await headers(), body, timeoutMs: 20_000, idempotent: false });
}

export async function exaAgentGet(id: string): Promise<AgentRun> {
  return callJson<AgentRun>("Exa", `${BASE}/agent/runs/${encodeURIComponent(id)}`, { headers: await headers(), timeoutMs: 20_000 });
}

// Cheapest call that proves the key works.
export async function exaCheck(key: string): Promise<number> {
  const response = await fetch(`${BASE}/search`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key },
    body: JSON.stringify({ query: "Exa search API documentation", type: "instant", numResults: 1 }),
  });
  return response.status;
}
