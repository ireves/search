import { exaContents } from "../engines/exa.js";
import { EngineError } from "../engines/http.js";
import { parallelExtract } from "../engines/parallel.js";
import { cleanText, hostOf, truncate } from "../text.js";

export interface FetchInput {
  urls: string[] | string;
  question?: string;
  max_chars?: number;
  fresh?: boolean;
}

interface Page {
  url: string;
  title?: string;
  date?: string;
  content: string;
  note?: string;
  error?: string;
}

// Sites Exa can't read (or reads badly) go straight to Parallel.
const PARALLEL_FIRST = /(^|\.)(x\.com|twitter\.com|glassdoor\.[a-z.]+|trustpilot\.com|linkedin\.com|quora\.com)$/;

// Published papers rarely change, and publishers often refuse or time out on a
// live download (ACM, DOI and PubMed did in testing) while Exa's stored copy works.
const STORED_FIRST = /(^|\.)(doi\.org|arxiv\.org|dl\.acm\.org|ncbi\.nlm\.nih\.gov|sciencedirect\.com|springer\.com|wiley\.com|ieeexplore\.ieee\.org|jstor\.org|nature\.com|science\.org|academic\.oup\.com|tandfonline\.com|sagepub\.com|cambridge\.org|researchgate\.net|semanticscholar\.org|ssrn\.com|biorxiv\.org|medrxiv\.org|plos\.org|frontiersin\.org|mdpi\.com)$/;

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
  const maxChars = Math.min(Math.max(Math.round(input.max_chars ?? (question ? 4000 : 6000)), 500), 20_000);
  // Pages are always read live now; `fresh` is still accepted from older skills.
  const fresh = true;

  const pages = new Map<string, Page>();
  const reddit = urls.filter(isRedditThread);
  const parallelFirst = urls.filter((u) => !reddit.includes(u) && PARALLEL_FIRST.test(hostOf(u)));
  const exaFirst = urls.filter((u) => !reddit.includes(u) && !parallelFirst.includes(u));
  const failures: string[] = [];

  const viaParallel = async (targets: string[]) => {
    if (!targets.length) return;
    try {
      const results = await parallelExtract(targets, question ?? "The main content of the page", maxChars, { fresh });
      for (const r of results) {
        if (r.ok) pages.set(r.url, { url: r.url, title: r.title, date: r.date, content: r.excerpts });
        else pages.set(r.url, { url: r.url, content: "", error: r.error });
      }
    } catch (e) {
      failures.push(e instanceof EngineError ? e.friendly : (e as Error).message);
      for (const t of targets) if (!pages.get(t)?.content) pages.set(t, { url: t, content: "", error: "not available" });
    }
  };

  // Exa reads the live page (stored copies of "latest" pages were out of date
  // in testing), then its stored copy if the site blocked the download, then
  // Parallel. Papers go the other way round.
  const viaExa = async (targets: string[], order: readonly ("live" | "stored")[]) => {
    let pending = targets;
    for (const freshness of order) {
      if (!pending.length) return;
      const retry: string[] = [];
      try {
        const results = await exaContents(pending, question, maxChars, freshness);
        for (const r of results) {
          if (r.ok && !looksThin(r.content, Boolean(question))) {
            const cut = !question && r.content.length >= maxChars * 0.97;
            const note = r.capped
              ? "Only the first 1,000 characters are available: this publisher limits automated reading. Look for other coverage of the same story if more is needed."
              : cut
                ? `Cut off at ${maxChars} characters. Ask again with a question (or a higher max_chars) to reach later parts.`
                : undefined;
            pages.set(r.url, { url: r.url, title: r.title, date: r.date, content: r.content, note });
          } else {
            retry.push(r.url);
          }
        }
      } catch (e) {
        failures.push(e instanceof EngineError ? e.friendly : (e as Error).message);
        retry.push(...pending);
        if (e instanceof EngineError && (e.status === 0 || e.status === 401 || e.status === 402 || e.status === 403)) break;
      }
      pending = retry;
    }
    // Backup reader for pages Exa refused or returned thin.
    await viaParallel(pending);
  };

  const papers = exaFirst.filter((u) => STORED_FIRST.test(hostOf(u)));
  const others = exaFirst.filter((u) => !papers.includes(u));
  await Promise.all([
    viaExa(others, ["live", "stored"]),
    viaExa(papers, ["stored", "live"]),
    viaParallel(parallelFirst),
    ...reddit.map((u) => readReddit(u, question, maxChars, fresh, pages, failures)),
  ]);

  const blocks = urls.map((url) => {
    const p = pages.get(url);
    if (!p || !p.content) {
      return `## ${url}\nCouldn't read this page${p?.error ? ` (${p.error})` : ""}. It may need a login, block automated readers, or no longer exist.`;
    }
    const meta = [p.url, p.date ? `published ${p.date}` : ""].filter(Boolean).join(" · ");
    return [`## ${p.title ?? hostOf(url)}`, meta, p.content, p.note ? `[${p.note}]` : ""].filter(Boolean).join("\n");
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
): Promise<void> {
  const u = new URL(url);
  u.hostname = "www.reddit.com";
  u.search = "";
  const jsonUrl = `${u.toString().replace(/\/+$/, "")}/.json`;
  try {
    const [result] = await parallelExtract([jsonUrl], question ?? "All comments in this thread", maxChars, { full: true, fresh });
    const thread = result?.full ? formatRedditJson(result.full, maxChars) : null;
    if (thread) {
      pages.set(url, { url, title: thread.title, date: thread.date, content: thread.text });
      return;
    }
    const [plain] = await parallelExtract([url], question ?? "The post and all the replies", maxChars, { fresh });
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
