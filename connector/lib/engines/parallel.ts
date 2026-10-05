// Parallel: keyword-plus-objective web search with live crawling, page
// extraction, and the Task API for deep research. API reference: https://docs.parallel.ai

import { cleanText, hostOf, isoDay, joinExcerpts, tidyExcerpt } from "../text.js";
import type { Hit } from "./exa.js";
import { apiKey, callJson } from "./http.js";

// Partner-database entries Parallel mixes into results (tagged
// utm_source=parallel). They sit behind a login and rarely answer anything.
const PARTNER_NOISE = /(^|\.)platform\.tracxn\.com$/;

const BASE = "https://api.parallel.ai";
const CLIENT_MODEL = "claude";

export type ParallelMode = "turbo" | "fast" | "basic" | "advanced";

export interface ParallelSearchOptions {
  objective: string;
  queries: string[];
  mode: ParallelMode;
  maxResults: number;
  maxCharsPerResult: number;
  includeDomains?: string[];
  excludeDomains?: string[];
  afterDate?: string;
  location?: string;
  fresh?: boolean;
  sessionId?: string;
}

interface ParallelResult {
  url: string;
  title?: string | null;
  publish_date?: string | null;
  excerpts?: string[] | null;
  full_content?: string | null;
}

async function headers(): Promise<Record<string, string>> {
  return { "x-api-key": await apiKey("Parallel") };
}

export async function parallelSearch(o: ParallelSearchOptions): Promise<Hit[]> {
  const sourcePolicy: Record<string, unknown> = {};
  if (o.includeDomains?.length) sourcePolicy.include_domains = o.includeDomains;
  else if (o.excludeDomains?.length) sourcePolicy.exclude_domains = o.excludeDomains;
  if (o.afterDate) sourcePolicy.after_date = o.afterDate;
  const advanced: Record<string, unknown> = {
    max_results: Math.min(o.maxResults, 20),
    excerpt_settings: { max_chars_per_result: o.maxCharsPerResult },
  };
  if (Object.keys(sourcePolicy).length) advanced.source_policy = sourcePolicy;
  if (o.location) advanced.location = o.location.toLowerCase();
  if (o.fresh) advanced.fetch_policy = { max_age_seconds: 600 };

  // Path filters (reddit.com/r/x) aren't supported in turbo mode.
  const hasPath = [...(o.includeDomains ?? []), ...(o.excludeDomains ?? [])].some((d) => d.includes("/"));
  const mode = hasPath && o.mode === "turbo" ? "fast" : o.mode;

  const data = await callJson<{ results?: ParallelResult[] }>("Parallel", `${BASE}/v1/search`, {
    headers: await headers(),
    body: {
      objective: o.objective.slice(0, 5000),
      search_queries: o.queries.filter(Boolean).slice(0, 5).map((q) => q.slice(0, 200)),
      mode,
      client_model: CLIENT_MODEL,
      max_chars_total: o.maxCharsPerResult * Math.min(o.maxResults, 20),
      ...(o.sessionId ? { session_id: o.sessionId } : {}),
      advanced_settings: advanced,
    },
    timeoutMs: o.fresh || mode === "advanced" ? 40_000 : 20_000,
  });
  return (data.results ?? [])
    .filter((r) => !PARTNER_NOISE.test(hostOf(r.url)))
    .map((r) => {
      const title = cleanText(r.title ?? "") || r.url;
      return {
        url: r.url,
        title,
        date: isoDay(r.publish_date),
        excerpt: tidyExcerpt(joinExcerpts(r.excerpts ?? [], o.maxCharsPerResult), title),
        engine: "parallel" as const,
      };
    });
}

export interface ParallelPage {
  url: string;
  ok: boolean;
  title?: string;
  date?: string;
  excerpts: string;
  full?: string;
  error?: string;
}

export async function parallelExtract(
  urls: string[],
  objective: string | undefined,
  maxChars: number,
  opts: { full?: boolean; fresh?: boolean } = {},
): Promise<ParallelPage[]> {
  const advanced: Record<string, unknown> = { excerpt_settings: { max_chars_per_result: maxChars } };
  if (opts.full) advanced.full_content = { max_chars_per_result: Math.max(maxChars, 60_000) };
  if (opts.fresh) advanced.fetch_policy = { max_age_seconds: 600 };
  const data = await callJson<{
    results?: ParallelResult[];
    errors?: { url: string; error_type?: string; http_status_code?: number; content?: string }[];
  }>("Parallel", `${BASE}/v1/extract`, {
    headers: await headers(),
    body: {
      urls,
      ...(objective ? { objective: objective.slice(0, 5000) } : {}),
      client_model: CLIENT_MODEL,
      max_chars_total: maxChars * urls.length,
      advanced_settings: advanced,
    },
    timeoutMs: 60_000,
  });
  return urls.map((url) => {
    const r =
      data.results?.find((x) => x.url === url) ??
      data.results?.find((x) => sameDoc(x.url, url)) ??
      (urls.length === 1 && data.results?.length === 1 ? data.results[0] : undefined);
    if (!r) {
      const err = data.errors?.find((e) => e.url === url);
      return { url, ok: false, excerpts: "", error: err ? `${err.error_type ?? "error"} ${err.http_status_code ?? ""}`.trim() : "not available" };
    }
    const excerpts = joinExcerpts(r.excerpts ?? [], maxChars);
    return {
      url,
      ok: Boolean(excerpts || r.full_content),
      title: cleanText(r.title ?? "") || undefined,
      date: isoDay(r.publish_date),
      excerpts,
      full: r.full_content ?? undefined,
    };
  });
}

function sameDoc(a: string, b: string): boolean {
  return a.replace(/\/+$/, "").toLowerCase() === b.replace(/\/+$/, "").toLowerCase();
}

// Task API (deep research). Text output gives a cited markdown report.
export interface TaskRun {
  run_id: string;
  status: string;
  is_active?: boolean;
  error?: { message?: string } | null;
}

export interface TaskResult {
  run: TaskRun;
  output?: {
    type: string;
    content: unknown;
    basis?: { field: string; citations?: { url: string; title?: string; excerpts?: string[] | null }[]; reasoning?: string; confidence?: string | null }[];
  } | null;
}

export type Processor = "lite" | "base" | "core" | "pro" | "ultra";

export async function parallelTaskStart(input: string, processor: Processor, description: string): Promise<TaskRun> {
  return callJson<TaskRun>("Parallel", `${BASE}/v1/tasks/runs`, {
    headers: await headers(),
    body: {
      input: input.slice(0, 15_000),
      processor,
      task_spec: { output_schema: { type: "text", description } },
    },
    timeoutMs: 20_000,
    idempotent: false,
  });
}

// Waits up to `waitSeconds` for the result. Returns null while still running.
export async function parallelTaskResult(runId: string, waitSeconds: number): Promise<TaskResult | null> {
  try {
    return await callJson<TaskResult>("Parallel", `${BASE}/v1/tasks/runs/${encodeURIComponent(runId)}/result?timeout=${Math.max(1, Math.floor(waitSeconds))}`, {
      headers: await headers(),
      timeoutMs: (waitSeconds + 15) * 1000,
    });
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 408 || status === -1) return null;
    throw error;
  }
}

// Responses API: a synchronous research agent that searches, reads and answers
// with citations in about 10 seconds (low) to a minute (medium). Asking for a
// JSON answer makes it number its citations against a source list; free text
// only gets internal "[doc 103]" markers that can't be linked.
export type ResponsesEffort = "low" | "medium" | "high";

export interface CitedAnswer {
  answer: string;
  sources: { n: number; url: string; title: string }[];
  // False when the [n] markers in the answer can't be matched to the sources.
  numbered: boolean;
  searches: number;
  pagesRead: number;
}

const CITED_ANSWER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["answer", "sources"],
  properties: {
    answer: {
      type: "string",
      description:
        "Concise markdown answer. Cite every factual claim inline with [n] matching the sources list. Exact figures with dates and units. Where sources disagree, say so. End with 'Not verified:' listing anything that could not be confirmed, if any.",
    },
    sources: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["n", "url", "title"],
        properties: { n: { type: "integer" }, url: { type: "string" }, title: { type: "string" } },
      },
    },
  },
};

export async function parallelRespond(input: string, effort: ResponsesEffort, instructions: string, timeoutMs: number): Promise<CitedAnswer> {
  const data = await callJson<{
    output?: { type: string; action?: { type?: string }; content?: { text?: string; annotations?: { url?: string; title?: string }[] }[] }[];
  }>("Parallel", `${BASE}/v1/responses`, {
    headers: await headers(),
    body: {
      model: "parallel",
      input: input.slice(0, 15_000),
      instructions,
      reasoning: { effort },
      text: { format: { type: "json_schema", name: "cited_answer", schema: CITED_ANSWER_SCHEMA, strict: true } },
    },
    timeoutMs,
  });
  const output = data.output ?? [];
  const message = output.find((o) => o.type === "message")?.content?.[0];
  const searches = output.filter((o) => o.type === "web_search_call" && o.action?.type === "search").length;
  const pagesRead = output.filter((o) => o.type === "web_search_call" && o.action?.type === "open_page").length;
  const raw = message?.text ?? "";
  // Every page the agent drew on, attached by Parallel whatever the format.
  const seen = new Set<string>();
  const annotated = (message?.annotations ?? [])
    .filter((a) => a.url && !seen.has(a.url) && seen.add(a.url))
    .map((a, i) => ({ n: i + 1, url: a.url!, title: a.title ?? "" }));
  try {
    const parsed = JSON.parse(raw) as { answer?: string; sources?: { n: number; url: string; title: string }[] };
    if (typeof parsed.answer === "string") {
      const listed = (parsed.sources ?? []).filter((x) => x?.url && Number.isInteger(x.n));
      // The model sometimes leaves its list empty and numbers citations from
      // its own reading list instead; those numbers can't be linked.
      if (listed.length) return { answer: parsed.answer, sources: listed, numbered: true, searches, pagesRead };
      return { answer: parsed.answer, sources: annotated, numbered: false, searches, pagesRead };
    }
  } catch {
    // Fall through to plain text.
  }
  return { answer: raw, sources: annotated, numbered: false, searches, pagesRead };
}

export async function parallelCheck(key: string): Promise<number> {
  const response = await fetch(`${BASE}/v1/search`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key },
    body: JSON.stringify({
      objective: "Parallel Web Systems search API documentation",
      search_queries: ["Parallel search API"],
      mode: "turbo",
      advanced_settings: { max_results: 1 },
    }),
  });
  return response.status;
}
