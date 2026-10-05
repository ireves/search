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
  /^(accept( all)?( cookies)?|cookie (settings|policy|preferences)|we use cookies.*|sign ?in|log ?in|sign ?up|subscribe( now)?|skip to (main )?content|toggle navigation|share( this)?|menu|search|advertisement|open in app|get the app|reply|report|save|follow|more replies|continue this thread|view (more )?comments?|load more|show more|read more|post|user avatar|relevant people|open (menu|navigation|settings menu)|expand user menu|go to reddit home|log in to reddit|get the reddit app|like|copy link|copied)$/i;

// Site chrome that turns up mid-line (X and Reddit page furniture, script
// fallback notices). Only long, distinctive phrases, so real text is safe.
const INLINE_CHROME = [
  /Notice: This page displays a fallback because interactive scripts did not run\.( Possible causes include disabled JavaScript or failure to load scripts or stylesheets\.)?/g,
  /\b(Skip to main content|Open menu Open navigation|Go to Reddit Home|Expand user menu|Open settings menu|Log in to Reddit|Get the Reddit app)\b/g,
  /\b(Post Log in Sign up|See what[’']s happening|Log in with username or email|Sign up now to get your own personalized timeline!?|Don[’']t miss what[’']s happening|People on X are the first to know\.?)/gi,
];
// X puts "user avatar" before each post's author.
const AVATAR = /(^|\n)([*-]\s*)?user avatar\s+/gi;

const CUT_MARKERS = /\n(?:#+\s*)?(Related Answers|People also ask|More posts you may like|Related posts|Top Posts|Trending Today|You may also like|Recommended for you)\b[\s\S]*$/i;

export function cleanText(input: string | null | undefined): string {
  if (!input) return "";
  let s = input.replace(/\r\n?/g, "\n");
  s = s.replace(CUT_MARKERS, "\n");
  // Parallel's section labels.
  s = s.replace(/Section Title:[^\n]*\nContent:\n?/g, "");
  s = s.replace(/\.{3}\s*\(content truncated\)/gi, "…");
  // Images and link targets cost tokens and add nothing. Links may carry a
  // hover title ([text](url "title")), common in menus.
  s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, "");
  s = s.replace(/\[\]\((?:[^()]|\([^)]*\))*\)/g, "");
  s = s.replace(/\[([^\]]{1,300})\]\((?:[^()\s]|\([^)]*\))+(?:\s+"[^"]*")?\)/g, "$1");
  s = s.replace(/<[^>]{1,200}>/g, "");
  s = s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  for (const re of INLINE_CHROME) s = s.replace(re, " ");
  s = s.replace(AVATAR, "$1$2");
  const seen = new Set<string>();
  const lines = s
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .filter((l) => !(l.length < 60 && BOILERPLATE.test(l.replace(/[^\w\s']/g, "").trim())))
    .filter((l) => !/^[|\-:*#\s]+$/.test(l) || l === "")
    // A paragraph repeated on the same page (headers shown twice, sticky banners).
    .filter((l) => {
      if (l.length < 40) return true;
      const key = l.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  s = lines.join("\n").replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

// For research reports, where link targets are the citations: keeps each
// link's address ("text (url)") and only drops images and excess blank lines.
export function cleanReport(input: string | null | undefined): string {
  if (!input) return "";
  let s = input.replace(/\r\n?/g, "\n");
  s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, "");
  s = s.replace(/\[\s*([^\]]{0,300}?)\s*\]\(((?:[^()\s]|\([^)]*\))+)(?:\s+"[^"]*")?\)/g, (_m, text: string, url: string) => {
    const label = text.replace(/\s+/g, " ").replace(/\s*\(new window\)\s*/gi, " ").trim();
    return !label || label === url ? url : `${label} (${url})`;
  });
  s = s.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

// Excerpts often repeat the page title as their first line, and Exa's
// highlights leave tiny fragments between "..." gaps. Both cost tokens only.
export function tidyExcerpt(text: string, title: string): string {
  const titleKeyNorm = title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const lines = text.split("\n").map((l) => l.trim());
  const isGap = (l: string | undefined) => l === "..." || l === "…";
  const out: string[] = [];
  lines.forEach((line, i) => {
    const bare = line.replace(/^#+\s*/, "");
    if (titleKeyNorm && bare && bare.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() === titleKeyNorm) return;
    const words = line.replace(/\.{3}|…/g, " ").trim();
    // Code, table rows and list items are short on purpose; keep them.
    const structured = /^(```|\||[-*+]\s|#)/.test(line) || /[`{}<>=$\\/|]/.test(line);
    const fragment =
      !isGap(line) &&
      !structured &&
      words.length < 18 &&
      !/\d/.test(words) &&
      !/[.!?:]$/.test(words) &&
      (/\.{3}|…/.test(line) || isGap(lines[i - 1]) || isGap(lines[i + 1]));
    if (isGap(line) || fragment) {
      if (out.length && out[out.length - 1] !== "…") out.push("…");
      return;
    }
    if (line === "" && (out.length === 0 || out[out.length - 1] === "")) return;
    out.push(line);
  });
  while (out.length && (out[0] === "…" || out[0] === "")) out.shift();
  while (out.length && (out[out.length - 1] === "…" || out[out.length - 1] === "")) out.pop();
  return out.join("\n").replace(/\n{2,}/g, "\n");
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
