// OpenAlex: a free, open index of about 300 million scholarly works (papers,
// preprints, books, theses), with authors, venues, citation counts, DOIs and
// links to free full text. Optional: used for papers searches only when
// OPENALEX_API_KEY is set. Requests without a key share one small daily
// budget per network address, which a Vercel server soon uses up, so the key
// (free, $1 of use a day) is required here.
// Prices: search and semantic search $0.001 a call; looking up one work free.
// API reference: https://developers.openalex.org

import { addCost } from "../cost.js";
import { cleanText, isoDay, keywords } from "../text.js";
import type { Hit } from "./exa.js";
import { callJson, EngineError } from "./http.js";
import { readSecret } from "../store.js";

const BASE = "https://api.openalex.org";

// Only the fields shown to Claude; full records run to tens of thousands of
// characters each.
const FIELDS = "id,doi,title,publication_date,type,cited_by_count,authorships,primary_location,open_access,abstract_inverted_index";

// References name every author; very large collaborations are cut here.
const MAX_AUTHORS = 50;

export async function openalexKey(): Promise<string | null> {
  return (await readSecret("OPENALEX_API_KEY")) ?? null;
}

export interface OpenAlexSearchOptions {
  query: string;
  limit: number;
  after?: string;
  before?: string;
  maxChars: number;
}

interface Authorship {
  author?: { display_name?: string | null } | null;
  raw_author_name?: string | null;
}

interface Work {
  id?: string;
  doi?: string | null;
  title?: string | null;
  publication_date?: string | null;
  type?: string | null;
  cited_by_count?: number | null;
  authorships?: Authorship[] | null;
  primary_location?: { landing_page_url?: string | null; source?: { display_name?: string | null } | null } | null;
  open_access?: { is_oa?: boolean | null; oa_url?: string | null } | null;
  abstract_inverted_index?: Record<string, number[]> | null;
}

interface ListReply {
  meta?: { count?: number; cost_usd?: number };
  results?: Work[];
}

// OpenAlex stores abstracts as word -> positions; this puts the words back
// in order.
export function rebuildAbstract(index: Record<string, number[]> | null | undefined): string {
  if (!index) return "";
  const words: string[] = [];
  for (const [word, places] of Object.entries(index)) for (const at of places) words[at] = word;
  return words.filter(Boolean).join(" ");
}

function cut(text: string, max: number): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const end = slice.lastIndexOf(" ");
  return `${(end > max * 0.6 ? slice.slice(0, end) : slice).trimEnd()}...`;
}

export function workToHit(w: Work, maxChars: number): Hit | null {
  const title = cleanText(w.title ?? "");
  const doi = w.doi?.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
  const url = doi ? `https://doi.org/${doi}` : (w.primary_location?.landing_page_url ?? w.id);
  if (!title || !url) return null;
  const names = (w.authorships ?? []).map((a) => a.author?.display_name ?? a.raw_author_name ?? "").filter(Boolean);
  const venue = w.primary_location?.source?.display_name;
  const free = w.open_access?.is_oa && w.open_access.oa_url && w.open_access.oa_url !== url ? w.open_access.oa_url : undefined;
  const facts = [
    names.length
      ? `Authors: ${names.slice(0, MAX_AUTHORS).join(", ")}${names.length > MAX_AUTHORS ? ` and ${names.length - MAX_AUTHORS} more (full list on the paper's page)` : ""}`
      : "",
    venue ? `In: ${venue}` : "",
    w.type && w.type !== "article" ? `Type: ${w.type}` : "",
    typeof w.cited_by_count === "number" ? `Cited by ${w.cited_by_count}` : "",
    doi ? `DOI: ${doi}` : "",
  ].filter(Boolean);
  const lines = [facts.join(" · ")];
  if (free) lines.push(`Free full text: ${free}`);
  const abstract = cleanText(rebuildAbstract(w.abstract_inverted_index));
  return {
    url,
    title,
    date: isoDay(w.publication_date),
    excerpt: abstract ? cut(abstract, maxChars) : "",
    engine: "openalex",
    facts: lines.filter(Boolean).join("\n") || undefined,
  };
}

// Semantic search (by meaning, like Exa) first. If OpenAlex turns that down,
// one keyword search on the query's main words instead. Retracted works are
// left out.
export async function openalexSearch(o: OpenAlexSearchOptions): Promise<Hit[]> {
  const key = await openalexKey();
  if (!key) throw new EngineError("OpenAlex", 0, "OpenAlex has no API key.");
  const filter = [
    "is_retracted:false",
    o.after ? `from_publication_date:${o.after}` : "",
    o.before ? `to_publication_date:${o.before}` : "",
  ]
    .filter(Boolean)
    .join(",");
  const perPage = Math.min(Math.max(o.limit, 1), 25);
  const call = (search: [string, string]) => {
    const params = new URLSearchParams({ [search[0]]: search[1].slice(0, 500), filter, per_page: String(perPage), select: FIELDS });
    return callJson<ListReply>("OpenAlex", `${BASE}/works?${params}`, {
      headers: { authorization: `Bearer ${key}` },
      timeoutMs: 20_000,
    });
  };
  let data: ListReply;
  try {
    data = await call(["search.semantic", o.query]);
  } catch (e) {
    if (!(e instanceof EngineError) || e.status !== 400) throw e;
    data = await call(["search", keywords(o.query, 6) || o.query]);
  }
  addCost("openalex", data.meta?.cost_usd ?? 0.001);
  return (data.results ?? []).map((w) => workToHit(w, o.maxChars)).filter((h): h is Hit => h !== null);
}

// Free call (one work by ID) that proves the key works.
export async function openalexCheck(key: string): Promise<number> {
  const response = await fetch(`${BASE}/works/W2741809807?select=id`, { headers: { authorization: `Bearer ${key}` } });
  return response.status;
}
