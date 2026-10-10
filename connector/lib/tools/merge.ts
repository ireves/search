import type { Hit } from "../engines/exa.js";
import { cleanAuthor, hostOf, titleKey, urlKey } from "../text.js";

export interface Ranked extends Hit {
  score: number;
  mirrors: string[];
  // A different passage from another engine's copy of the same page, kept
  // because copies can disagree (one engine's stored copy may be out of date).
  alt?: string;
}

// Same opening words = same passage.
const samePassage = (a: string, b: string) => a.includes(b.slice(0, 80)) || b.includes(a.slice(0, 80));

// Reciprocal rank fusion: a page ranked high by either engine rises, and one
// found by both rises further. Duplicate pages and mirrored copies of the same
// document (same title on another site) are folded into one entry. Each
// engine's top result keeps a place, so a second engine's best find is never
// crowded out by pages the other two agree on.
export function fuse(lists: { hits: Hit[]; weight: number }[], limit: number): Ranked[] {
  const K = 10;
  const byUrl = new Map<string, Ranked>();
  for (const { hits, weight } of lists) {
    hits.forEach((hit, rank) => {
      const key = urlKey(hit.url);
      const add = weight / (K + rank + 1);
      const existing = byUrl.get(key);
      if (existing) {
        existing.score += add;
        if (hit.excerpt && !samePassage(existing.excerpt, hit.excerpt)) {
          // The newer copy's passage leads; with no dates to go on, the longer one.
          const newer = Boolean(hit.date && (!existing.date || hit.date > existing.date));
          const older = Boolean(existing.date && (!hit.date || existing.date > hit.date));
          const swap = newer || (!older && hit.excerpt.length > existing.excerpt.length);
          const [lead, other] = swap ? [hit.excerpt, existing.excerpt] : [existing.excerpt, hit.excerpt];
          existing.excerpt = lead;
          if (newer) existing.date = hit.date;
          existing.alt ??= other.length >= 80 ? other : undefined;
        }
        if (!existing.date && hit.date) existing.date = hit.date;
        existing.facts ??= hit.facts;
        existing.author ??= hit.author;
      } else {
        byUrl.set(key, { ...hit, score: add, mirrors: [] });
      }
    });
  }
  const sorted = [...byUrl.values()].sort((a, b) => b.score - a.score);
  const byTitle = new Map<string, Ranked>();
  const entryFor = new Map<string, Ranked>();
  const out: Ranked[] = [];
  for (const hit of sorted) {
    const tk = titleKey(hit.title);
    const twin = tk.length >= 30 ? byTitle.get(tk) : undefined;
    if (twin && hostOf(twin.url) !== hostOf(hit.url)) {
      twin.score += hit.score;
      const host = hostOf(hit.url);
      if (!twin.mirrors.includes(host)) twin.mirrors.push(host);
      entryFor.set(urlKey(hit.url), twin);
      continue;
    }
    if (tk.length >= 30) byTitle.set(tk, hit);
    entryFor.set(urlKey(hit.url), hit);
    out.push(hit);
  }
  const top = out.slice(0, limit);
  if (lists.length > 1) {
    const firsts = new Set(lists.map(({ hits }) => hits[0] && entryFor.get(urlKey(hits[0].url))).filter((x): x is Ranked => Boolean(x)));
    for (const first of firsts) {
      if (top.includes(first)) continue;
      // Replace the lowest-ranked entry that isn't itself an engine's top result.
      for (let i = top.length - 1; i >= 0; i--) {
        if (!firsts.has(top[i])) {
          top[i] = first;
          break;
        }
      }
    }
    top.sort((a, b) => b.score - a.score);
  }
  return top;
}

export function withinDates(hit: Hit, after?: string, before?: string): boolean {
  if (!hit.date) return true;
  if (after && hit.date < after) return false;
  if (before && hit.date > before) return false;
  return true;
}

export function renderHit(hit: Ranked, n: number | string): string {
  const by = cleanAuthor(hit.author);
  const head = `[${n}] ${hit.title}${hit.date ? ` (${hit.date})` : ""}${by ? ` · by ${by}` : ""}`;
  const lines = [head, hit.url];
  if (hit.facts) lines.push(hit.facts);
  if (hit.excerpt) lines.push(hit.excerpt);
  if (hit.alt) lines.push(`Another copy of this page says: ${hit.alt.length > 300 ? `${hit.alt.slice(0, 300).trimEnd()}...` : hit.alt}`);
  if (hit.mirrors.length) lines.push(`Same document also on: ${hit.mirrors.join(", ")}`);
  return lines.join("\n");
}
