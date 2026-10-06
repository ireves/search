// Exa: semantic (meaning-based) search over its own index, page reading,
// and the Exa Agent for multi-step research. API reference: https://exa.ai/docs

import { cleanText, isoDay, joinExcerpts } from "../text.js";
import { addCost } from "../cost.js";
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

// Exa's own estimate of what a request cost.
type ExaCost = { total?: number } | null;

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

  const data = await callJson<{ results?: ExaResult[]; costDollars?: ExaCost }>("Exa", `${BASE}/search`, {
    headers: await headers(),
    body,
    timeoutMs: o.type === "deep" ? 45_000 : o.fresh ? 40_000 : 25_000,
  });
  addCost("exa", data.costDollars?.total);
  return (data.results ?? []).map((r) => toHit(r, o.maxChars));
}

function toHit(r: ExaResult, maxChars: number): Hit {
  const entity = r.entities?.[0];
  let url = r.url;
  // Papers sometimes come back as Exa library pages; prefer the DOI.
  if (/^https?:\/\/(www\.)?exa\.ai\/library\//.test(url) && entity?.properties?.doi) {
    url = `https://doi.org/${String(entity.properties.doi).replace(/^https?:\/\/doi\.org\//, "")}`;
  }
  return {
    url,
    title: cleanText(r.title ?? "") || url,
    date: isoDay(r.publishedDate),
    author: r.author ?? undefined,
    excerpt: joinExcerpts(r.highlights?.length ? r.highlights : [r.summary ?? r.text ?? ""], maxChars),
    engine: "exa",
    facts: entity ? entityFacts(entity) : undefined,
  };
}

const s = (v: unknown) => (v === null || v === undefined || v === "" ? "" : String(v));

export function entityFacts(entity: { type: string; properties: Record<string, any> }): string | undefined {
  const p = entity.properties ?? {};
  const parts: string[] = [];
  if (entity.type === "person") {
    if (p.location) parts.push(`Location: ${s(p.location)}`);
    const jobs = (p.workHistory ?? []).slice(0, 4).map((w: any) => [s(w.title), w.company ? `at ${s(w.company)}` : "", w.dates ? `(${s(w.dates)})` : ""].filter(Boolean).join(" "));
    if (jobs.length) parts.push(`Work: ${jobs.join("; ")}`);
    const study = (p.educationHistory ?? []).slice(0, 2).map((e: any) => [s(e.degree), s(e.institution), e.dates ? `(${s(e.dates)})` : ""].filter(Boolean).join(", "));
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
}

// Reads known pages. With a question, returns only the passages that answer it.
export async function exaContents(urls: string[], question: string | undefined, maxChars: number, fresh: boolean): Promise<ExaPage[]> {
  const body: Record<string, unknown> = { urls };
  if (question) body.highlights = { query: question, maxCharacters: maxChars };
  else body.text = { maxCharacters: maxChars, verbosity: "compact" };
  if (fresh) {
    body.maxAgeHours = 0;
    body.livecrawlTimeout = 20000;
  }
  const data = await callJson<{
    results?: ExaResult[];
    statuses?: { id: string; status: string; error?: { tag?: string; httpStatusCode?: number | null } | null }[];
    costDollars?: ExaCost;
  }>("Exa", `${BASE}/contents`, { headers: await headers(), body, timeoutMs: fresh ? 45_000 : 30_000 });
  addCost("exa", data.costDollars?.total);

  const byUrl = new Map((data.results ?? []).map((r) => [r.url, r]));
  return urls.map((url, i) => {
    const status = data.statuses?.find((st) => st.id === url);
    const r = byUrl.get(url) ?? data.results?.[i];
    if (!r || status?.status === "error") {
      return { url, ok: false, content: "", error: status?.error?.tag ?? "not available" };
    }
    const content = question ? joinExcerpts(r.highlights ?? [], maxChars) : cleanText(r.text ?? "");
    return { url, ok: content.length > 0, title: cleanText(r.title ?? "") || undefined, date: isoDay(r.publishedDate), content };
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
  return callJson<AgentRun>("Exa", `${BASE}/agent/runs`, { headers: await headers(), body, timeoutMs: 20_000 });
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
