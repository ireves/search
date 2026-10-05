import type { Hit } from "../engines/exa.js";
import { hostOf, titleKey, urlKey } from "../text.js";

export interface Ranked extends Hit {
  score: number;
  mirrors: string[];
}

// Reciprocal rank fusion: a page ranked high by either engine rises, and one
// found by both rises further. Duplicate pages and mirrored copies of the same
// document (same title on another site) are folded into one entry.
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
        if (!existing.date && hit.date) existing.date = hit.date;
        if (hit.excerpt && !existing.excerpt.includes(hit.excerpt.slice(0, 80))) {
          existing.excerpt = existing.excerpt.length >= hit.excerpt.length ? existing.excerpt : hit.excerpt;
        }
        existing.facts ??= hit.facts;
      } else {
        byUrl.set(key, { ...hit, score: add, mirrors: [] });
      }
    });
  }
  const sorted = [...byUrl.values()].sort((a, b) => b.score - a.score);
  const byTitle = new Map<string, Ranked>();
  const out: Ranked[] = [];
  const sentenceSets = new Map<Ranked, Set<string>>();
  for (const hit of sorted) {
    const tk = titleKey(hit.title);
    // Same title on another site, or mostly the same passages (copies of a
    // paper, syndicated news): one source, shown once.
    const titleTwin = tk.length >= 30 ? byTitle.get(tk) : undefined;
    const twin = titleTwin && hostOf(titleTwin.url) !== hostOf(hit.url) ? titleTwin : copyOf(hit, out, sentenceSets);
    if (twin) {
      twin.score += hit.score;
      const host = hostOf(hit.url);
      if (host !== hostOf(twin.url) && !twin.mirrors.includes(host)) twin.mirrors.push(host);
      continue;
    }
    if (tk.length >= 30) byTitle.set(tk, hit);
    sentenceSets.set(hit, sentences(hit.excerpt));
    out.push(hit);
  }
  return out.slice(0, limit);
}

function sentences(text: string): Set<string> {
  return new Set(
    text
      .split(/\n|(?<=[.!?])\s+/)
      .map((x) => x.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim())
      .filter((x) => x.length >= 30),
  );
}

// A result whose passages are at least 70% already shown under another result.
function copyOf(hit: Ranked, kept: Ranked[], sets: Map<Ranked, Set<string>>): Ranked | undefined {
  const mine = sentences(hit.excerpt);
  if (mine.size < 3) return undefined;
  for (const other of kept) {
    const theirs = sets.get(other);
    if (!theirs) continue;
    let shared = 0;
    for (const x of mine) if (theirs.has(x)) shared++;
    if (shared / mine.size >= 0.7) return other;
  }
  return undefined;
}

export function withinDates(hit: Hit, after?: string, before?: string): boolean {
  if (!hit.date) return true;
  if (after && hit.date < after) return false;
  if (before && hit.date > before) return false;
  return true;
}

export function renderHit(hit: Ranked, n: number | string): string {
  const head = `[${n}] ${hit.title}${hit.date ? ` (${hit.date})` : ""}`;
  const lines = [head, hit.url];
  if (hit.facts) lines.push(hit.facts);
  if (hit.excerpt) lines.push(hit.excerpt);
  if (hit.mirrors.length) lines.push(`Same document also on: ${hit.mirrors.join(", ")}`);
  return lines.join("\n");
}
