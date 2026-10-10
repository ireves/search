import { exaContents } from "../engines/exa.js";
import { firecrawlKey, firecrawlScrape } from "../engines/firecrawl.js";
import { EngineError } from "../engines/http.js";
import { parallelExtract } from "../engines/parallel.js";
import { cleanAuthor, cleanText, hostOf, relevantPassages, truncate } from "../text.js";

export interface FetchInput {
  urls: string[] | string;
  question?: string;
  max_chars?: number;
  start?: number;
  fresh?: boolean;
}

interface Page {
  url: string;
  title?: string;
  date?: string;
  author?: string;
  content: string;
  note?: string;
  error?: string;
}

// Sites Exa can't read (or reads badly) go straight to Parallel.
const PARALLEL_FIRST = /(^|\.)(x\.com|twitter\.com|glassdoor\.[a-z.]+|trustpilot\.com|linkedin\.com|quora\.com)$/;

// When a Firecrawl key is set, Firecrawl reads pages first, to save Exa and
// Parallel usage. Skipped where it refuses the site (see section 16 of
// docs/research-findings.md), charges far more (X: about 30 credits a page;
// PDFs: a credit per page) or where Exa does better (YouTube transcripts).
const FIRECRAWL_SKIP =
  /(^|\.)(reddit\.com|redd\.it|nytimes\.com|linkedin\.com|yelp\.[a-z.]+|instagram\.com|facebook\.com|tiktok\.com|threads\.(net|com)|pinterest\.[a-z.]+|craigslist\.org|x\.com|twitter\.com|youtube\.com|youtu\.be)$/;

// A whole fetch call gets this long (fresh reads a little longer). Firecrawl
// gets the first half; a page it times out on gets one last try with Parallel
// in the time left, instead of waiting on every reader in turn.
const BUDGET_MS = 30_000;
const FRESH_BUDGET_MS = 45_000;
// A reader isn't started with less time than this left.
const MIN_TRY_MS = 2000;
const TOO_SLOW = "took too long";

// Per page at most this many characters: enough for most whole papers. Longer
// documents are read in parts with start.
export const FETCH_PAGE_CHARS = 60_000;
// All pages in one call together return at most this many characters (about
// 22,000 tokens), so one reply stays a known share of a helper's memory.
export const FETCH_TOTAL_CHARS = 80_000;
// Furthest point start can reach into a document.
const MAX_START = 500_000;

// The part of a document from start, cut at a sentence end within max
// characters. next says where the following part begins, when there is more.
export function windowOf(text: string, start: number, max: number): { content: string; next?: number } {
  const part = text.slice(start);
  if (part.length <= max) return { content: part };
  const room = max - 2; // leaves space for the " …" marker
  const cut = part.slice(0, room);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(".\n"), cut.lastIndexOf("\n"));
  const end = stop > room * 0.6 ? stop + 1 : Math.max(cut.lastIndexOf(" "), Math.floor(room * 0.8));
  return { content: `${part.slice(0, end).trimEnd()} …`, next: start + end };
}

const moreNote = (next: number) => `More follows. Read on with start: ${next}, or ask a question to get the relevant passages from anywhere in it.`;

// Short pages that are only a bot check, a block or a login wall.
const BLOCK_PAGE = /captcha|checking your browser|verify you are human|are you a robot|access denied|log ?in to (a free account|continue)|sign ?in to continue/i;

function looksBlocked(content: string): boolean {
  return content.length < 2000 && BLOCK_PAGE.test(content);
}

function looksLikePdf(url: string): boolean {
  const path = new URL(url).pathname.toLowerCase();
  return path.endsWith(".pdf") || (hostOf(url) === "arxiv.org" && path.startsWith("/pdf/"));
}

function normaliseUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  try {
    const u = new URL(/^[a-z]+:\/\//i.test(s) ? s : `https://${s}`);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

function isRedditThread(url: string): boolean {
  return /(^|\.)reddit\.com$/.test(hostOf(url)) && /\/comments\//.test(new URL(url).pathname);
}

function looksThin(content: string, withQuestion: boolean): boolean {
  if (content.length < (withQuestion ? 150 : 250)) return true;
  const gaps = (content.match(/…/g) ?? []).length;
  return gaps >= 5 && content.length < 1200;
}

export async function runFetch(input: FetchInput): Promise<{ text: string; isError: boolean }> {
  const list = (Array.isArray(input.urls) ? input.urls : [input.urls]).map((u) => normaliseUrl(String(u ?? "")));
  const urls = [...new Set(list.filter((u): u is string => Boolean(u)))].slice(0, 5);
  if (!urls.length) return { text: "Give 1 to 5 web addresses in urls.", isError: true };
  const question = input.question?.trim() || undefined;
  const asked = Math.min(Math.max(Math.round(input.max_chars ?? (question ? 4000 : 6000)), 500), FETCH_PAGE_CHARS);
  const maxChars = Math.min(asked, Math.floor(FETCH_TOTAL_CHARS / urls.length));
  // start only applies to reading from the top; a question searches the whole document.
  const start = question ? 0 : Math.min(Math.max(Math.round(input.start ?? 0), 0), MAX_START);
  // Ask the readers for a little more than needed, to tell whether more follows.
  const want = start + maxChars + 1000;
  const fresh = Boolean(input.fresh);
  const budget = Number(process.env.FETCH_BUDGET_MS) || (fresh ? FRESH_BUDGET_MS : BUDGET_MS);
  const began = Date.now();
  const deadline = began + budget;
  const left = () => deadline - Date.now();
  const minTry = Math.min(MIN_TRY_MS, budget / 10);

  const pages = new Map<string, Page>();
  const reddit = urls.filter(isRedditThread);
  const failures: string[] = [];
  const slow = new Set<string>();

  // Firecrawl first where it suits; whatever it can't read goes on to the others.
  let others = urls.filter((u) => !reddit.includes(u));
  const firecrawlFirst = (await firecrawlKey()) ? others.filter((u) => !FIRECRAWL_SKIP.test(hostOf(u)) && !looksLikePdf(u)) : [];
  const viaFirecrawl = async () => {
    if (!firecrawlFirst.length) return;
    const { pages: read, problem } = await firecrawlScrape(firecrawlFirst, fresh, began + budget / 2, minTry);
    if (problem) failures.push(`${problem.friendly} Exa and Parallel read the pages instead.`);
    for (const r of read) {
      if (r.error === TOO_SLOW) slow.add(r.url);
      if (!r.ok || looksThin(r.content, false) || looksBlocked(r.content)) continue;
      const view = question ? { content: relevantPassages(r.content, question, maxChars) } : windowOf(r.content, start, maxChars);
      if (!view.content) continue;
      pages.set(r.url, {
        url: r.url,
        title: r.title,
        date: r.date,
        author: r.author,
        content: view.content,
        note: view.next ? moreNote(view.next) : undefined,
      });
    }
  };

  const tooLate = (targets: string[]) => {
    if (left() >= minTry) return false;
    for (const t of targets) if (!pages.get(t)?.content) pages.set(t, { url: t, content: "", error: TOO_SLOW });
    return true;
  };

  const viaParallel = async (targets: string[]) => {
    if (!targets.length || tooLate(targets)) return;
    try {
      // Reading on from start needs the full text; otherwise the main passages do.
      const whole = start > 0;
      const results = await parallelExtract(targets, question ?? "The main content of the page", maxChars, {
        fresh,
        timeoutMs: left(),
        ...(whole ? { full: true, fullChars: want } : {}),
      });
      for (const r of results) {
        const view = whole && r.full ? windowOf(cleanText(r.full), start, maxChars) : { content: r.ok ? r.excerpts : "" };
        if (r.ok && view.content) {
          pages.set(r.url, { url: r.url, title: r.title, date: r.date, content: view.content, note: "next" in view && view.next ? moreNote(view.next) : undefined });
        } else pages.set(r.url, { url: r.url, content: "", error: r.ok ? "nothing past that point" : r.error });
      }
    } catch (e) {
      const timedOut = e instanceof EngineError && e.status === -1;
      if (!timedOut) failures.push(e instanceof EngineError ? e.friendly : (e as Error).message);
      for (const t of targets) if (!pages.get(t)?.content) pages.set(t, { url: t, content: "", error: timedOut ? TOO_SLOW : "not available" });
    }
  };

  const viaExa = async (targets: string[]) => {
    if (!targets.length || tooLate(targets)) return;
    let retry: string[] = [];
    try {
      // Leave Parallel a share of the time as the backup reader.
      const results = await exaContents(targets, question, question ? maxChars : want, fresh, Math.max(minTry, Math.floor(left() * 0.6)));
      for (const r of results) {
        const view = question ? { content: r.content } : windowOf(r.content, start, maxChars);
        if (r.ok && view.content && (start > 0 || !looksThin(view.content, Boolean(question)))) {
          pages.set(r.url, {
            url: r.url,
            title: r.title,
            date: r.date,
            author: r.author,
            content: view.content,
            note: "next" in view && view.next ? moreNote(view.next) : undefined,
          });
        } else {
          retry.push(r.url);
        }
      }
    } catch (e) {
      failures.push(e instanceof EngineError ? e.friendly : (e as Error).message);
      retry = targets;
    }
    // Backup reader for pages Exa refused or returned thin.
    await viaParallel(retry);
  };

  const viaOthers = async () => {
    await viaFirecrawl();
    others = others.filter((u) => !pages.get(u)?.content);
    // Pages Firecrawl timed out on are probably slow sites: one last try with
    // Parallel, skipping Exa.
    const parallelFirst = others.filter((u) => PARALLEL_FIRST.test(hostOf(u)) || slow.has(u));
    await Promise.all([viaExa(others.filter((u) => !parallelFirst.includes(u))), viaParallel(parallelFirst)]);
  };

  await Promise.all([viaOthers(), ...reddit.map((u) => readReddit(u, question, maxChars, fresh, pages, failures, left, minTry))]);

  const blocks = urls.map((url) => {
    const p = pages.get(url);
    if (!p || !p.content) {
      return `## ${url}\nCouldn't read this page${p?.error ? ` (${p.error})` : ""}. It may need a login, block automated readers, or no longer exist.`;
    }
    const by = cleanAuthor(p.author);
    const meta = [p.url, p.date ? `published ${p.date}` : "", by ? `by ${by}` : ""].filter(Boolean).join(" · ");
    return [`## ${p.title ?? hostOf(url)}`, meta, truncate(p.content, maxChars + 2), p.note ? `[${p.note}]` : ""].filter(Boolean).join("\n");
  });
  const anyOk = urls.some((u) => pages.get(u)?.content);
  const notes = [...new Set(failures)];
  return { text: [...blocks, ...(notes.length ? [notes.join("\n")] : [])].join("\n\n---\n\n"), isError: !anyOk };
}

// Reddit threads often come back without comments. The thread's .json address
// returns the whole discussion, which is rebuilt here as a readable list.
async function readReddit(
  url: string,
  question: string | undefined,
  maxChars: number,
  fresh: boolean,
  pages: Map<string, Page>,
  failures: string[],
  left: () => number,
  minTry: number,
): Promise<void> {
  const u = new URL(url);
  u.hostname = "www.reddit.com";
  u.search = "";
  const jsonUrl = `${u.toString().replace(/\/+$/, "")}/.json`;
  try {
    const [result] = await parallelExtract([jsonUrl], question ?? "All comments in this thread", maxChars, { full: true, fresh, timeoutMs: left() });
    const thread = result?.full ? formatRedditJson(result.full, maxChars) : null;
    if (thread) {
      pages.set(url, { url, title: thread.title, date: thread.date, content: thread.text });
      return;
    }
    if (left() < minTry) {
      pages.set(url, { url, content: "", error: TOO_SLOW });
      return;
    }
    const [plain] = await parallelExtract([url], question ?? "The post and all the replies", maxChars, { fresh, timeoutMs: left() });
    if (plain?.ok) pages.set(url, { url, title: plain.title, date: plain.date, content: plain.excerpts });
    else if (result?.excerpts) pages.set(url, { url, title: result.title, content: result.excerpts });
    else pages.set(url, { url, content: "", error: plain?.error });
  } catch (e) {
    failures.push(e instanceof EngineError ? e.friendly : (e as Error).message);
    pages.set(url, { url, content: "", error: "not available" });
  }
}

interface RedditComment {
  author: string;
  score: number;
  body: string;
  replies: RedditComment[];
}

export function formatRedditJson(raw: string, maxChars: number): { title: string; date?: string; text: string } | null {
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    const start = raw.indexOf("[");
    const end = raw.lastIndexOf("]");
    if (start < 0 || end <= start) return null;
    try {
      data = JSON.parse(raw.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  const post = data?.[0]?.data?.children?.[0]?.data;
  if (!post?.title) return null;
  const date = post.created_utc ? new Date(post.created_utc * 1000).toISOString().slice(0, 10) : undefined;

  const walk = (children: any[] | undefined): RedditComment[] =>
    (children ?? [])
      .filter((c) => c?.kind === "t1" && c.data?.body && c.data.body !== "[deleted]" && c.data.body !== "[removed]")
      .map((c) => ({
        author: c.data.author ?? "?",
        score: Number(c.data.score ?? 0),
        body: cleanText(c.data.body),
        replies: walk(c.data.replies?.data?.children),
      }))
      .sort((a, b) => b.score - a.score);
  const comments = walk(data?.[1]?.data?.children);

  const head = [
    `r/${post.subreddit ?? "?"} · u/${post.author ?? "?"}${date ? ` · ${date}` : ""} · ${post.score ?? 0} points · ${post.num_comments ?? comments.length} comments`,
    cleanText(post.selftext ?? "") ? truncate(cleanText(post.selftext), Math.floor(maxChars * 0.3)) : "",
    comments.length ? "Comments, highest voted first:" : "No comments returned.",
  ].filter(Boolean);
  let text = head.join("\n");
  const add = (c: RedditComment, depth: number): boolean => {
    const line = `${"  ".repeat(depth)}- [${c.score}] ${c.author}: ${truncate(c.body.replace(/\n+/g, " "), 600)}`;
    if (text.length + line.length + 1 > maxChars) return false;
    text += `\n${line}`;
    if (depth < 2) for (const r of c.replies.slice(0, 3)) if (!add(r, depth + 1)) return false;
    return true;
  };
  for (const c of comments) if (!add(c, 0)) break;
  return { title: cleanText(post.title), date, text };
}
