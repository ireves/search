// The user's search preferences (lib/jobs/notes.ts, edited on the
// /preferences page) and the loose filters built from them. Only the user's
// own preferences are used here, never Claude's memory notes. A missed good
// role is worse than an extra one for Claude to reject, so the filters err on
// keeping a role, but only roles of the kinds the user asked for.

import { PREF, PRIORITY_EXCLUDE } from "./config.js";
import { loadNotes, type Preference } from "./notes.js";

export type { Preference };

export interface Preferences {
  all: Preference[];
  roles: Preference[];
  locations: Preference[];
  excludes: Preference[];
  sources: Preference[];
}

export function sortPreferences(list: Preference[]): Preferences {
  const all = list.filter((p) => p.active);
  const kept = all.filter((p) => p.priority !== PRIORITY_EXCLUDE);
  return {
    all,
    roles: kept.filter((p) => p.type === PREF.role && p.name),
    locations: kept.filter((p) => p.type === PREF.location && p.name),
    excludes: all.filter((p) => p.priority === PRIORITY_EXCLUDE && p.name),
    sources: kept.filter((p) => p.type === PREF.company || p.type === PREF.sites),
  };
}

export async function readPreferences(): Promise<Preferences> {
  return sortPreferences((await loadNotes()).preferences);
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9+#]+/g, " ").trim();
const hasWord = (haystack: string, word: string) => ` ${norm(haystack)} `.includes(` ${norm(word)} `);

// Words a level preference also goes by in job titles.
const ALIASES: Record<string, string[]> = { senior: ["sr"], junior: ["jr"] };

// Words that mark a job title as one of the wanted roles: each Role
// preference in full, and its last word ("Designer"), so "Brand Designer" or
// "UI/UX Designer" still get through.
export function roleWords(prefs: Preferences): string[] {
  const words = new Set<string>();
  for (const role of prefs.roles) {
    words.add(norm(role.name));
    const last = norm(role.name).split(" ").pop();
    if (last && last.length > 3) words.add(last);
  }
  return [...words];
}

// Whether a job title is one of the wanted roles: a Role preference in full,
// or its kind ("Product", "UX") with a design word, so "Senior Product
// Designer", "UI/UX Designer" and "Product Design Lead" get through but
// "Graphic Designer" or "Production Designer" don't. A one-word Role
// preference ("Designer") lets any title holding it through.
export function titleWanted(title: string, prefs: Preferences): boolean {
  if (!prefs.roles.length) return true;
  const design = /\bdesign/.test(norm(title));
  return prefs.roles.some((role) => {
    const words = norm(role.name).split(" ");
    if (hasWord(title, role.name)) return true;
    return design && words.length > 1 && words.slice(0, -1).some((w) => hasWord(title, w));
  });
}

// An Exclude preference the job matches, if any (a level such as "Senior" in
// the title, a role, or the company).
export function excludedBy(job: { title: string; company: string }, prefs: Preferences): string | null {
  for (const ex of prefs.excludes) {
    if (ex.type === PREF.company) {
      if (norm(job.company) && hasWord(job.company, ex.name.replace(/\(.*\)/, ""))) return ex.name;
      continue;
    }
    if (ex.type === PREF.level || ex.type === PREF.role || ex.type === null) {
      const names = [ex.name, ...(ALIASES[norm(ex.name)] ?? [])];
      if (names.some((n) => hasWord(job.title, n))) return ex.name;
    }
  }
  return null;
}

// Whether a job's location could suit: empty, or naming one of the Location
// preferences (or the UK, when a UK location is wanted), or a place the
// company's own notes allow ("London and Cupertino Only", "Any Location").
export function locationWanted(location: string, prefs: Preferences, companyNotes = ""): boolean {
  if (!location.trim() || !prefs.locations.length) return true;
  if (/any location/i.test(companyNotes)) return true;
  const places = new Set<string>();
  for (const loc of prefs.locations) {
    for (const part of loc.name.split(/[,/]/)) {
      const p = norm(part);
      if (p) places.add(p);
      if (p === "uk") ["united kingdom", "england", "scotland", "wales", "gb"].forEach((x) => places.add(x));
    }
  }
  for (const word of norm(companyNotes).split(" ")) {
    if (word.length > 3 && !["only", "with", "from", "roles", "jobs"].includes(word)) places.add(word);
  }
  return [...places].some((p) => hasWord(location, p));
}

// For duplicates: the same advert link with tracking parts removed.
export function linkKey(link: string | null): string {
  if (!link) return "";
  try {
    const u = new URL(link.trim());
    for (const k of [...u.searchParams.keys()]) {
      if (/^(utm_|gh_src|source|src|ref|refid|trk|tk|from|campaign|lever-|xkcb|xpse|xfps)/i.test(k)) u.searchParams.delete(k);
    }
    u.hash = "";
    return `${u.hostname.replace(/^www\./, "").toLowerCase()}${u.pathname.replace(/\/+$/, "").toLowerCase()}${u.search}`;
  } catch {
    return link.trim().toLowerCase();
  }
}

export const roleKey = (company: string, title: string) => `${norm(company)}|${norm(title)}`;
