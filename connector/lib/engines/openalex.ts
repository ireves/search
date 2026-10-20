// OpenAlex: a free, open index of about 300 million scholarly works (papers,
// preprints, books, theses), with authors, venues, citation counts, DOIs and
// links to free full text. Optional: used for papers searches only when
// OPENALEX_API_KEY is set. Requests without a key share one small daily
// budget per network address, which a Vercel server soon uses up, so the key
// (free, $1 of use a day) is required here.
// Prices: search and semantic search $0.001 a call; looking up one work free;
// downloading a full-text copy (PDF or Grobid TEI XML) $0.01.
// API reference: https://developers.openalex.org
// Full text: https://help.openalex.org/download/full-text-pdfs

import { addCost } from "../cost.js";
import { cleanText, isoDay, keywords } from "../text.js";
import type { Hit } from "./exa.js";
import { callJson, EngineError } from "./http.js";
import { recordStep } from "../trace.js";
import { readSecret } from "../store.js";

const BASE = "https://api.openalex.org";
const CONTENT = "https://content.openalex.org";
const DOWNLOAD_COST = 0.01;

// Only the fields shown to Claude; full records run to tens of thousands of
// characters each.
const FIELDS = "id,doi,title,publication_date,type,cited_by_count,authorships,primary_location,open_access,has_content,abstract_inverted_index";

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
  has_content?: { pdf?: boolean | null; grobid_xml?: boolean | null } | null;
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
  // OpenAlex keeps its own copy of many papers, paywalled ones included;
  // fetch reads it from the work's address.
  const workId = w.id?.match(/W\d+$/)?.[0];
  if (workId && (w.has_content?.grobid_xml || w.has_content?.pdf)) lines.push(`Full text from OpenAlex (fetch reads it, $0.01): https://openalex.org/${workId}`);
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

// Semantic search (by meaning, like Exa) first. If OpenAlex turns that down
// or says it is unavailable (503), one keyword search on the query's main
// words instead. Retracted works are
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
    if (!(e instanceof EngineError) || (e.status !== 400 && e.status !== 503)) throw e;
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

// ---------------------------------------------------------------------------
// Full text. OpenAlex keeps cached copies of about 60 million papers (PDFs,
// and Grobid's TEI XML parse of most of them), paywalled ones included. A
// download needs the key and costs $0.01; finding out whether a copy exists
// (looking up the work) is free. The XML is preferred: it is already split
// into title, abstract, sections and paragraphs, so no PDF parsing is needed.

// The OpenAlex work ID in an OpenAlex address (openalex.org/W123,
// api.openalex.org/works/W123, content.openalex.org/works/W123.pdf).
export function openalexWorkId(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (!/(^|\.)openalex\.org$/.test(u.hostname)) return null;
  return u.pathname.match(/^\/(?:works\/)?(W\d+)(?:\.[a-z-]+)?\/?$/i)?.[1].toUpperCase() ?? null;
}

// The DOI in a doi.org address, or null.
export function doiOf(url: string): string | null {
  try {
    const u = new URL(url);
    if (!/^(dx\.)?doi\.org$/.test(u.hostname)) return null;
    const doi = decodeURIComponent(u.pathname.slice(1));
    return /^10\.\d{4,9}\/\S+$/.test(doi) ? doi : null;
  } catch {
    return null;
  }
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : all;
    }
    return ENTITIES[e.toLowerCase()] ?? all;
  });
}

// Grobid's TEI XML as plain text: abstract, then each section under its
// heading. The reference list is left out (long, and rarely what is asked).
export function teiToText(xml: string): { title?: string; text: string } {
  const plain = (part: string) =>
    decodeEntities(
      part
        .replace(/<head[^>]*>([\s\S]*?)<\/head>/g, "\n\n$1\n\n")
        .replace(/<\/(p|figDesc|item|row|formula)>/g, "\n\n")
        .replace(/<\/cell>/g, " | ")
        .replace(/<[^>]+>/g, " "),
    )
      .split("\n")
      .map((l) => l.replace(/\s+/g, " ").replace(/ ([,.;:)])/g, "$1").replace(/\( /g, "(").trim())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  const header = xml.match(/<titleStmt>([\s\S]*?)<\/titleStmt>/)?.[1] ?? "";
  const title = plain(header.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1] ?? "") || undefined;
  const abstract = plain(xml.match(/<abstract[^>]*>([\s\S]*?)<\/abstract>/)?.[1] ?? "");
  const body = plain(xml.match(/<body[^>]*>([\s\S]*?)<\/body>/)?.[1] ?? "");
  return { title, text: [abstract ? `Abstract\n\n${abstract}` : "", body].filter(Boolean).join("\n\n") };
}

async function pdfToText(data: ArrayBuffer): Promise<string> {
  const { extractText } = await import("unpdf");
  const { text } = await extractText(new Uint8Array(data), { mergePages: true });
  return (Array.isArray(text) ? text.join("\n\n") : text).replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export interface FullText {
  url: string;
  title?: string;
  date?: string;
  author?: string;
  content: string;
  format: "TEI XML" | "PDF";
}

// Reads one paper's full text from OpenAlex's copy. Returns null (with the
// reason) when OpenAlex has no copy; throws EngineError for API failures.
export async function openalexFullText(
  ref: { workId?: string; doi?: string },
  timeoutMs: number,
): Promise<FullText | { missing: string }> {
  const key = await openalexKey();
  if (!key) throw new EngineError("OpenAlex", 0, "OpenAlex has no API key.");
  const began = Date.now();
  const left = () => Math.max(1000, timeoutMs - (Date.now() - began));
  const path = ref.workId ? ref.workId : `doi:${ref.doi!.split("/").map(encodeURIComponent).join("/")}`;
  let work: Work;
  try {
    work = await callJson<Work>("OpenAlex", `${BASE}/works/${path}?select=id,doi,title,publication_date,authorships,has_content`, {
      headers: { authorization: `Bearer ${key}` },
      timeoutMs: Math.min(left(), 10_000),
    });
  } catch (e) {
    if (e instanceof EngineError && e.status === 404) return { missing: "OpenAlex doesn't know this work" };
    throw e;
  }
  const id = work.id?.match(/W\d+$/)?.[0];
  const format = work.has_content?.grobid_xml ? "TEI XML" : work.has_content?.pdf ? "PDF" : null;
  if (!id || !format) return { missing: "OpenAlex has no full-text copy of this work" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), left());
  let response: Response;
  const download = `/works/${id}.${format === "PDF" ? "pdf" : "grobid-xml"}`;
  const step = { engine: "OpenAlex", purpose: "paper full text", endpoint: download };
  const sent = Date.now();
  try {
    response = await fetch(`${CONTENT}${download}`, {
      headers: { authorization: `Bearer ${key}` },
      signal: controller.signal,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      let message = text;
      try {
        message = JSON.parse(text)?.message ?? JSON.parse(text)?.error ?? text;
      } catch {
        // keep raw text
      }
      recordStep({ ...step, status: response.status, ms: Date.now() - sent, error: String(message).slice(0, 500) });
      throw new EngineError("OpenAlex", response.status, String(message));
    }
    recordStep({ ...step, status: response.status, ms: Date.now() - sent });
    addCost("openalex", Number(response.headers.get("x-ratelimit-cost-usd")) || DOWNLOAD_COST);
    const body = format === "PDF" ? await pdfToText(await response.arrayBuffer()) : null;
    const tei = format === "TEI XML" ? teiToText(await response.text()) : null;
    // Not cleanText: it strips anything between < and >, which in a paper is
    // often maths ("p < 0.05 ... > 3").
    const content = (body ?? tei!.text).trim();
    if (!content) return { missing: `OpenAlex's ${format} copy has no readable text` };
    const names = (work.authorships ?? []).map((a) => a.author?.display_name ?? a.raw_author_name ?? "").filter(Boolean);
    return {
      url: `https://openalex.org/${id}`,
      title: cleanText(work.title ?? "") || tei?.title,
      date: isoDay(work.publication_date),
      author: names.length ? `${names.slice(0, 3).join(", ")}${names.length > 3 ? " et al." : ""}` : undefined,
      content,
      format,
    };
  } catch (e) {
    if (e instanceof EngineError) throw e;
    const aborted = (e as Error).name === "AbortError";
    throw new EngineError("OpenAlex", aborted ? -1 : 0, aborted ? "timeout" : `could not read the copy: ${(e as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}
