// The user's search preferences (Preference rows in Job Applications) and the
// loose filters built from them. Only the user's own preferences are used
// here, never Claude's Memory notes. A missed good role is worse than an
// extra one for Claude to reject, so every filter errs on keeping a role.

import { COL, ENTRY, NOTION, PREF, PRIORITY_EXCLUDE } from "./config.js";
import { dateStart, select, text, url, type Notion, type NotionPage } from "./notion.js";

export interface Preference {
  id: string;
  name: string;
  type: string | null;
  priority: string | null;
  notes: string;
  link: string | null;
  lastChecked: string | null;
  hiringService: string | null;
  boardId: string;
}

export interface Preferences {
  all: Preference[];
  roles: Preference[];
  locations: Preference[];
  excludes: Preference[];
  sources: Preference[];
}

function toPreference(page: NotionPage): Preference {
  const p = page.properties;
  return {
    id: page.id,
    name: text(p[COL.name]),
    type: select(p[COL.preferenceType]),
    priority: select(p[COL.priority]),
    notes: text(p[COL.notes]),
    link: url(p[COL.links]),
    lastChecked: dateStart(p[COL.lastChecked]),
    hiringService: select(p[COL.hiringService]),
    boardId: text(p[COL.boardId]),
  };
}

export async function readPreferences(client: Notion): Promise<Preferences> {
  const pages = await client.query(NOTION.applications, {
    and: [
      { property: COL.entryType, select: { equals: ENTRY.preference } },
      { property: COL.active, checkbox: { equals: true } },
    ],
  });
  const all = pages.filter((p) => select(p.properties[COL.entryType]) === ENTRY.preference && p.properties[COL.active]?.checkbox === true).map(toPreference);
  const kept = all.filter((p) => p.priority !== PRIORITY_EXCLUDE);
  return {
    all,
    roles: kept.filter((p) => p.type === PREF.role && p.name),
    locations: kept.filter((p) => p.type === PREF.location && p.name),
    excludes: all.filter((p) => p.priority === PRIORITY_EXCLUDE && p.name),
    sources: kept.filter((p) => p.type === PREF.company || p.type === PREF.sites),
  };
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

export function titleWanted(title: string, prefs: Preferences): boolean {
  if (!prefs.roles.length) return true;
  return roleWords(prefs).some((w) => hasWord(title, w));
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
