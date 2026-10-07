// Turning raw engine output into short, clean text for Claude.

const TRACKING = /^(utm_|fbclid$|gclid$|mc_|ref$|ref_src$|igshid$|si$|share_id$|rdt$)/i;

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

// One key per document, so the same page found by both engines (or with
// tracking parameters, or as arXiv abs/pdf/html) is shown once.
export function urlKey(url: string): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url.trim().toLowerCase();
  }
  let host = u.hostname.toLowerCase().replace(/^(www|old|new|m|mobile)\./, "");
  if (host === "twitter.com") host = "x.com";
  let path = u.pathname.replace(/\/+$/, "") || "/";
  if (host === "arxiv.org") {
    const id = /\/(?:abs|pdf|html)\/([^/]+?)(?:v\d+)?(?:\.pdf)?$/.exec(path);
    if (id) return `arxiv:${id[1]}`;
  }
  if (host === "reddit.com") path = path.replace(/\/\.json$/, "").toLowerCase();
  const params = [...u.searchParams.entries()]
    .filter(([k]) => !TRACKING.test(k))
    .sort(([a], [b]) => a.localeCompare(b));
  const query = host === "reddit.com" ? "" : new URLSearchParams(params).toString();
  return `${host}${path}${query ? `?${query}` : ""}`;
}

export function titleKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s[|\-–—:]\s[^|\-–—:]{2,40}$/, "") // drop " | Site name" endings
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const BOILERPLATE =
  /^(accept( all)?( cookies)?|cookie (settings|policy|preferences)|we use cookies.*|sign ?in|log ?in|sign ?up|subscribe( now)?|skip to (main )?content|toggle navigation|share( this)?|menu|search|advertisement|open in app|get the app|reply|report|save|follow|more replies|continue this thread|view (more )?comments?|load more|show more|read more)$/i;

const CUT_MARKERS = /\n(?:#+\s*)?(Related Answers|People also ask|More posts you may like|Related posts|Top Posts|Trending Today|You may also like|Recommended for you)\b[\s\S]*$/i;

export function cleanText(input: string | null | undefined): string {
  if (!input) return "";
  let s = input.replace(/\r\n?/g, "\n");
  s = s.replace(CUT_MARKERS, "\n");
  // Parallel's section labels.
  s = s.replace(/Section Title:[^\n]*\nContent:\n?/g, "");
  s = s.replace(/\.{3}\s*\(content truncated\)/gi, "…");
  // Images and link targets cost tokens and add nothing.
  s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, "");
  s = s.replace(/\[([^\]]{1,300})\]\((?:[^()\s]|\([^)]*\))+(?:\s+"[^"]*")?\)/g, "$1");
  s = s.replace(/<[^>]{1,200}>/g, "");
  s = s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  const lines = s
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .filter((l) => !(l.length < 60 && BOILERPLATE.test(l.replace(/[^\w\s']/g, "").trim())))
    .filter((l) => !/^[|\-:\s]+$/.test(l) || l === "");
  s = lines.join("\n").replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(".\n"), cut.lastIndexOf("\n"));
  const end = stop > max * 0.6 ? stop + 1 : Math.max(cut.lastIndexOf(" "), max * 0.8);
  return `${cut.slice(0, end).trimEnd()} …`;
}

// Joins excerpts, dropping repeats and near-repeats.
export function joinExcerpts(parts: (string | null | undefined)[], max: number): string {
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const raw of parts) {
    const text = cleanText(raw);
    if (!text) continue;
    const key = text.toLowerCase().replace(/[^a-z0-9]+/g, " ").slice(0, 120);
    if (seen.has(key)) continue;
    if (kept.some((k) => k.includes(text))) continue;
    seen.add(key);
    kept.push(text);
  }
  return truncate(kept.join("\n…\n"), max);
}

export function isoDay(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  if (!m || m[1].startsWith("1970")) return undefined;
  return m[1];
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// "7d", "2w", "3m", "1y", "2026", "2026-09" or "2026-09-14" -> "YYYY-MM-DD".
export function parseDate(input: string | undefined, now = new Date()): string | undefined {
  if (!input) return undefined;
  const s = input.trim().toLowerCase();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}$/.test(s)) return `${s}-01`;
  if (/^\d{4}$/.test(s)) return `${s}-01-01`;
  const rel = /^(\d{1,4})\s*(d|day|days|w|week|weeks|m|month|months|y|year|years)$/.exec(s);
  if (rel) {
    const n = Number(rel[1]);
    const d = new Date(now);
    const unit = rel[2][0];
    if (unit === "d") d.setUTCDate(d.getUTCDate() - n);
    if (unit === "w") d.setUTCDate(d.getUTCDate() - 7 * n);
    if (unit === "m") d.setUTCMonth(d.getUTCMonth() - n);
    if (unit === "y") d.setUTCFullYear(d.getUTCFullYear() - n);
    return d.toISOString().slice(0, 10);
  }
  if (s === "today") return now.toISOString().slice(0, 10);
  const parsed = Date.parse(input);
  return Number.isNaN(parsed) ? undefined : new Date(parsed).toISOString().slice(0, 10);
}

// Accepts "example.com", "https://example.com/docs/" or "*.example.com".
export function cleanDomain(input: string): string {
  return input
    .trim()
    .replace(/^site:/i, "")
    .replace(/^[a-z]+:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
}

const STOPWORDS = new Set(
  "a an and are as at be been but by did do does for from had has have how in into is it its of on or that the their there these this those to was were what when where which who why will with".split(
    " ",
  ),
);

// Short keyword queries for engines that want them (Parallel).
export function keywords(text: string, maxWords = 6): string {
  const words = text
    .replace(/["“”'‘’()[\]{}?!,;:]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w.toLowerCase()));
  return words.slice(0, maxWords).join(" ").slice(0, 200) || text.slice(0, 200);
}

function stem(word: string): string {
  return word.replace(/(ing|ed|es|s)$/, "").slice(0, 8);
}

// For a page read in full: keeps the paragraphs that share the most words
// with the question, in page order, so a long page fits the limit without
// cutting from the top. Pages that already fit are returned whole.
export function relevantPassages(text: string, question: string, max: number): string {
  if (text.length <= max) return text;
  const terms = [
    ...new Set(
      question
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((w) => w.length > 2 && !STOPWORDS.has(w))
        .map(stem),
    ),
  ];
  // Lines repeated on the page (share buttons, menus) are dropped.
  const seen = new Set<string>();
  const deduped = text
    .split("\n")
    .filter((line) => {
      const key = line.trim().toLowerCase();
      if (key.length < 20) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join("\n");
  // Short lines (headings, list items) travel with the paragraph after them.
  const blocks: string[] = [];
  let carry = "";
  for (const part of deduped.split(/\n{2,}/)) {
    const joined = carry ? `${carry}\n${part}` : part;
    if (joined.length < 120) carry = joined;
    else {
      blocks.push(joined);
      carry = "";
    }
  }
  if (carry) blocks.push(carry);
  const counted = blocks.map((block) => {
    const counts = new Map<string, number>();
    for (const w of block.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
      const t = stem(w);
      if (terms.includes(t)) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return counts;
  });
  // Words found all over the page (often the title's) count for less than rare ones.
  const weight = new Map(terms.map((t) => [t, Math.log((blocks.length + 1) / (counted.filter((c) => c.has(t)).length + 0.5))]));
  const scored = blocks.map((block, i) => {
    let score = 0;
    for (const [t, n] of counted[i]) score += (weight.get(t) ?? 0) * (1 + Math.log2(n) / 2);
    return { i, block, score };
  });
  if (!terms.length || !scored.some((s) => s.score > 0)) return truncate(text, max);
  const chosen: typeof scored = [];
  let used = 0;
  for (const s of [...scored].sort((a, b) => b.score - a.score || a.i - b.i)) {
    if (s.score <= 0) break;
    const piece = truncate(s.block, Math.floor(max / 2));
    if (used + piece.length + 3 > max) continue;
    chosen.push({ ...s, block: piece });
    used += piece.length + 3;
  }
  chosen.sort((a, b) => a.i - b.i);
  return chosen.map((s, k) => (k > 0 && s.i !== chosen[k - 1].i + 1 ? `…\n${s.block}` : s.block)).join("\n\n");
}
