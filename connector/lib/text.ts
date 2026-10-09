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
  // "highest" matches "high" and "tallest" matches "tall".
  return word.replace(/(ing|ed|es|s)$/, "").replace(/(?<=\p{L}{3})est$/u, "").slice(0, 8);
}

// Questions that want a figure: a price, rate, size, date, version or count.
const WANTS_FIGURE =
  /\b(how (much|many|tall|high|long|big|old|far|often)|when|what year|since|(price|cost|fee|rate|size|height|weight|length|version|date|number|percent|amount|salary|population|limit|minimum|maximum)s?)\b/i;

const PASSAGE = 600;

// Words that ask for the same thing. A question's word also matches the
// others in its group, at a lower weight.
const SAME_ASK = [
  ["tall", "high", "height", "elevation", "altitude"],
  ["cost", "price", "fee", "charge", "pay"],
  ["old", "age"],
  ["release", "launch", "publish", "date"],
  ["ceo", "chief", "head", "lead"],
].map((group) => group.map(stem));

// Reference lists and citations rarely answer a question.
const CITATIONS = /Retrieved \d|Archived from|ISBN|doi:|↑/g;

function questionTerms(question: string): string[] {
  return [
    ...new Set(
      question
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((w) => w.length > 2 && !STOPWORDS.has(w))
        .map(stem),
    ),
  ];
}

function relatedTerms(terms: string[]): string[] {
  const extra = new Set<string>();
  for (const group of SAME_ASK) if (group.some((t) => terms.includes(t))) for (const t of group) if (!terms.includes(t)) extra.add(t);
  return [...extra];
}

function termsIn(text: string, terms: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const w of text.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    const t = stem(w);
    if (terms.includes(t)) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return counts;
}

interface Passage {
  text: string;
  heading: string;
}

// Splits a page into passages of about PASSAGE characters. Paragraphs stay
// whole where they fit; long ones are cut at line breaks, then at sentence
// ends. Rows cut from a table keep the table's header row. Each passage
// remembers the nearest heading above it.
function passages(text: string): Passage[] {
  const out: Passage[] = [];
  let heading = "";
  let carry = "";
  const push = (part: string) => {
    if (!part.trim()) return;
    if (part.length <= PASSAGE) {
      out.push({ text: part, heading });
      return;
    }
    const lines = part.split("\n");
    const header = lines[0].trim().startsWith("|") ? lines.slice(0, lines[1]?.includes("---") ? 2 : 1).join("\n") : "";
    let piece = "";
    const flush = () => {
      if (piece.trim()) out.push({ text: piece, heading });
      piece = "";
    };
    for (const line of lines) {
      const units = line.length > PASSAGE ? line.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)\s*/g) ?? [line] : [line];
      // Whole lines are joined with a line break; sentences of one long line run on.
      const sep = () => (piece && units.length === 1 ? "\n" : "");
      for (const unit of units) {
        if (piece && piece.length + sep().length + unit.length > PASSAGE) {
          flush();
          if (header && line.trim().startsWith("|") && line !== lines[0]) piece = header;
        }
        piece += sep() + unit;
      }
    }
    flush();
  };
  for (const part of text.split(/\n{2,}/)) {
    const h = part.match(/^#{1,6}\s+(.+)$/m);
    if (h && part.trim().startsWith("#")) heading = h[1];
    // Short parts (headings, list items) travel with the paragraph after them.
    const joined = carry ? `${carry}\n${part}` : part;
    if (joined.length < 120) carry = joined;
    else {
      push(joined);
      carry = "";
    }
  }
  if (carry) push(carry);
  return out;
}

// Cuts a passage to `max` characters around the lines that match the question.
function focus(text: string, terms: string[], max: number): string {
  if (text.length <= max) return text;
  const lines = text.split("\n");
  if (lines.length < 2) return truncate(text, max);
  const hits = lines.map((l) => [...termsIn(l, terms).values()].reduce((a, b) => a + b, 0));
  let best = 0;
  let bestStart = 0;
  for (let i = 0; i < lines.length; i++) {
    let len = 0;
    let score = 0;
    for (let j = i; j < lines.length && len + lines[j].length + 1 <= max; j++) {
      len += lines[j].length + 1;
      score += hits[j];
    }
    if (score > best) {
      best = score;
      bestStart = i;
    }
  }
  let kept = "";
  for (let j = bestStart; j < lines.length; j++) {
    const room = max - kept.length - 1;
    if (lines[j].length <= room) kept += (kept ? "\n" : "") + lines[j];
    else {
      // Part of the next line rather than none of it.
      if (room > 80) kept += (kept ? "\n" : "") + truncate(lines[j], room).replace(/ …$/, "");
      break;
    }
  }
  return kept ? `${bestStart > 0 ? "… " : ""}${kept}${kept.length < text.length ? " …" : ""}` : truncate(text, max);
}

// For a page read in full: keeps the passages that best match the question,
// in page order, so a long page fits the limit without cutting from the top.
// Pages that already fit are returned whole.
export function relevantPassages(text: string, question: string, max: number): string {
  if (text.length <= max) return text;
  const { terms, scored } = rankPassages(text, question);
  if (!terms.length || !scored.some((s) => s.score > 0)) return truncate(text, max);
  const chosen: typeof scored = [];
  let used = 0;
  for (const s of [...scored].sort((a, b) => b.score - a.score || a.i - b.i)) {
    if (s.score <= 0) break;
    const room = max - used - 5;
    if (room < 150) break;
    // The " …" markers focus() may add are counted in.
    const piece = focus(s.block, terms, Math.min(room, Math.max(Math.floor(max / 2), PASSAGE)) - 4);
    chosen.push({ ...s, block: piece });
    // Room for the joins: a blank line and sometimes a "…" line.
    used += piece.length + 5;
  }
  chosen.sort((a, b) => a.i - b.i);
  return chosen.map((s, k) => (k > 0 && s.i !== chosen[k - 1].i + 1 ? `…\n${s.block}` : s.block)).join("\n\n");
}

// Scores each passage of a page against a question. Exported so rankings can
// be inspected when tuning.
export function rankPassages(text: string, question: string): { terms: string[]; scored: { i: number; block: string; score: number }[] } {
  const asked = questionTerms(question);
  const related = relatedTerms(asked);
  const terms = [...asked, ...related];
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
  const parts = passages(deduped);
  const counted = parts.map((p) => termsIn(p.text, terms));
  const inHeading = parts.map((p) => termsIn(p.heading, terms));
  // Words found all over the page count for less than rare ones. Words in the
  // page's title describe the whole page, so they count for less too.
  const title = termsIn(deduped.match(/^#\s+(.+)$/m)?.[1] ?? "", terms);
  const weight = new Map(
    terms.map((t) => {
      let w = Math.log((parts.length + 1) / (counted.filter((c) => c.has(t)).length + 0.5));
      if (title.has(t)) w *= 0.3;
      if (related.includes(t)) w *= 0.6;
      return [t, Math.max(w, 0)];
    }),
  );
  const wantsFigure = WANTS_FIGURE.test(question);
  const scored = parts.map((p, i) => {
    let score = 0;
    for (const [t, n] of counted[i]) score += (weight.get(t) ?? 0) * (1 + Math.log2(n) / 4);
    // A word in the heading above counts half, unless the passage has it too.
    for (const t of inHeading[i].keys()) if (!counted[i].has(t)) score += (weight.get(t) ?? 0) / 2;
    if (score > 0) {
      // The answer to "how much" or "when" usually carries a figure.
      if (wantsFigure && /\d/.test(p.text)) score *= 1.3;
      // Pages tend to lead with what is current; earlier passages win ties.
      score *= 1 + 0.2 * (1 - i / parts.length);
      // The opening passages (a summary table, a lead paragraph) usually hold
      // the page's key facts.
      if (i < 5) score *= 1 + 0.1 * (5 - i);
      if ((p.text.match(CITATIONS) ?? []).length > 1) score *= 0.3;
    }
    return { i, block: p.text, score };
  });
  return { terms, scored };
}

// Author names as the engines give them, for references. Drops values that
// are a link or an empty byline. Keeps every name; only a very long list is cut.
export function cleanAuthor(author: string | null | undefined): string | undefined {
  const a = cleanText(String(author ?? "")).replace(/^by\s+/i, "").trim();
  if (!a || /^https?:\/\//i.test(a) || /^(unknown|admin|n\/a|none)$/i.test(a)) return undefined;
  return a.length > 1000 ? `${a.slice(0, 1000).replace(/[,;\s]+\S*$/, "")} and others (list cut; full list on the page)` : a;
}
