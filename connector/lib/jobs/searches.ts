// Stage 3 of the daily run, in two calls:
//   job_sites: for each Role and Location preference pair, Composio's job
//     search (LinkedIn, Indeed and Glassdoor in one call) and its LinkedIn job
//     search, adverts from the last few days.
//   linkedin_posts: for each Role preference, public LinkedIn posts from the
//     last week that read like hiring posts. Claude decides which are real.
// Both filter loosely with the user's preferences, leave out duplicates
// (preferring the employer's own advert link), collect advert text and add
// each new role to the Inbox (Review status New).

import { SEARCHES, SOURCE_POST, SOURCE_SITES } from "./config.js";
import { composio, type ComposioError, type SearchItem, type SearchRequest, type SearchResult } from "./composio.js";
import { claim, fillAdverts, loadExisting, writeRoles, type Pending } from "./inbox.js";
import { notion } from "./notion.js";
import { excludedBy, locationWanted, readPreferences, roleWords, titleWanted, type Preference, type Preferences } from "./prefs.js";
import { ukToday } from "./recheck.js";

export interface SearchReport {
  search: string;
  tool: string;
  raw: number;
  matched: number;
  added: string[];
  dropped: { title: string; why: string }[];
  error?: string;
}

export interface SearchesResult {
  counts: Record<string, number>;
  searches: SearchReport[];
  failures: { where: string; error: string }[];
  charge: number;
}

const isRemote = (loc: Preference) => /remote/i.test(loc.name);
// LinkedIn's job search wants country names in full.
const linkedinPlace = (name: string) => name.replace(/\bUK\b/, "United Kingdom");

export function jobSearchCalls(prefs: Preferences): { calls: SearchRequest[]; labels: Record<string, string> } {
  const calls: SearchRequest[] = [];
  const labels: Record<string, string> = {};
  const locations = prefs.locations.length ? prefs.locations : [{ name: "United Kingdom" } as Preference];
  for (const role of prefs.roles) {
    for (const loc of locations) {
      const remote = isRemote(loc);
      const place = remote ? "United Kingdom" : loc.name;
      const id = `${calls.length}`;
      calls.push({
        id,
        kind: "jobs",
        tool: SEARCHES.jobs.tool,
        args: {
          search_term: role.name,
          location: place,
          country_indeed: SEARCHES.jobs.countryIndeed,
          site_name: SEARCHES.jobs.sites,
          hours_old: SEARCHES.jobs.hoursOld,
          results_wanted: SEARCHES.jobs.resultsWanted,
          ...(remote ? { is_remote: true } : {}),
        },
      });
      labels[id] = `${role.name}, ${loc.name} (job sites)`;
      const lid = `${calls.length}`;
      calls.push({
        id: lid,
        kind: "linkedin_jobs",
        tool: SEARCHES.linkedin.tool,
        args: { query: role.name, location: linkedinPlace(place), date_posted: SEARCHES.linkedin.datePosted, ...(remote ? { workplace_types: "remote" } : {}) },
      });
      labels[lid] = `${role.name}, ${loc.name} (LinkedIn jobs)`;
    }
  }
  return { calls, labels };
}

export function postSearchCalls(prefs: Preferences): { calls: SearchRequest[]; labels: Record<string, string> } {
  const place = prefs.locations.find((l) => !isRemote(l))?.name.split(",")[0].trim() ?? "";
  const calls: SearchRequest[] = [];
  const labels: Record<string, string> = {};
  for (const role of prefs.roles) {
    const id = `${calls.length}`;
    calls.push({ id, kind: "posts", tool: SEARCHES.posts.tool, args: { query: `hiring ${role.name} ${place}`.trim(), date_posted: SEARCHES.posts.datePosted } });
    labels[id] = `hiring ${role.name} ${place}`.trim();
  }
  return { calls, labels };
}

// The employer's own advert link, when the job site gives a specific one
// (not just their careers page).
export function bestLink(item: SearchItem): string {
  const direct = item.direct?.trim();
  if (direct && /^https?:/i.test(direct) && !direct.endsWith("#")) {
    try {
      const path = new URL(direct).pathname.replace(/\/+$/, "").toLowerCase();
      if (path && !["/jobs", "/careers", "/careers/jobs", "/job", "/vacancies", "/join-us", "/work-with-us"].includes(path)) return direct;
    } catch {
      // fall back to the job site's link
    }
  }
  return item.link;
}

async function runSearches(
  kind: "job_sites" | "linkedin_posts",
  options: { dry: boolean; now?: Date; budgetMs?: number },
): Promise<SearchesResult> {
  const today = ukToday(options.now);
  const deadlineAt = Date.now() + (options.budgetMs ?? SEARCHES.budgetMs);
  const client = await notion();
  const prefs = await readPreferences();
  const result: SearchesResult = { counts: { searches: 0, empty_searches: 0, raw: 0, matched: 0, duplicates: 0, added: 0 }, searches: [], failures: [], charge: 0 };
  const { calls, labels } = kind === "job_sites" ? jobSearchCalls(prefs) : postSearchCalls(prefs);
  result.counts.searches = calls.length;
  if (!calls.length) {
    result.failures.push({ where: kind, error: "No active Role preferences to search for." });
    return result;
  }

  let replies: SearchResult[] = [];
  try {
    replies = await (await composio()).search(calls, { keywords: roleWords(prefs), textChars: SEARCHES.textChars });
  } catch (error) {
    result.failures.push({ where: kind === "job_sites" ? "job site search through Composio" : "LinkedIn post search through Composio", error: (error as ComposioError).friendly ?? (error as Error).message });
    return result;
  }

  const existing = await loadExisting(client);
  const pending: Pending[] = [];
  // Items with the employer's own link go first, so that copy is kept when
  // the same job is on several sites.
  const all = replies.flatMap((r) => r.items.map((item) => ({ reply: r, item })));
  all.sort((a, b) => Number(bestLink(b.item) !== b.item.link) - Number(bestLink(a.item) !== a.item.link));
  const reports = new Map<string, SearchReport>();
  for (const r of replies) {
    result.charge += r.charge ?? 0;
    result.counts.raw += r.raw;
    if (r.ok && r.raw === 0) result.counts.empty_searches++;
    const report: SearchReport = { search: labels[r.id] ?? r.id, tool: calls.find((c) => c.id === r.id)?.tool ?? "", raw: r.raw, matched: 0, added: [], dropped: [], ...(r.error ? { error: r.error } : {}) };
    reports.set(r.id, report);
    result.searches.push(report);
    if (!r.ok) result.failures.push({ where: report.search, error: r.error ?? "failed" });
  }

  for (const { reply, item } of all) {
    const report = reports.get(reply.id)!;
    if (!item.link) continue;
    if (kind === "linkedin_posts") {
      if (!SEARCHES.posts.hiring.test(item.text ?? "")) continue;
    } else if (!titleWanted(item.title, prefs)) {
      continue;
    }
    report.matched++;
    result.counts.matched++;
    const excluded = excludedBy({ title: item.title, company: item.company }, prefs);
    if (excluded) {
      report.dropped.push({ title: item.title, why: `excluded: ${excluded}` });
      continue;
    }
    if (kind === "job_sites" && !locationWanted(item.location, prefs)) {
      report.dropped.push({ title: item.title, why: `location: ${item.location}` });
      continue;
    }
    const job = { title: item.title, link: bestLink(item), location: item.location, pay: item.pay ?? "", advert: item.text ?? "" };
    if (!claim(existing, item.company, job, job.link !== item.link ? [item.link] : [])) {
      result.counts.duplicates++;
      continue;
    }
    report.added.push(`${item.title} (${item.company || "unknown"})`);
    result.counts.added++;
    pending.push({
      company: item.company || "Unknown",
      service: kind === "job_sites" ? "Job site" : "LinkedIn post",
      board: "",
      source: kind === "job_sites" ? (SOURCE_SITES[item.site ?? ""] ?? "LinkedIn") : SOURCE_POST,
      job,
      // A post is its own advert.
      trusted: kind === "linkedin_posts",
    });
  }

  // A search that usually finds about 20 adverts returning nothing at all
  // means the tool has stopped working, even if it says it succeeded.
  if (replies.length && result.counts.raw === 0) {
    result.failures.push({ where: kind, error: "Every search came back empty. The Composio tool may have changed; the Claude run should search these role and location pairs itself." });
  }

  const adverts = await fillAdverts(pending, deadlineAt);
  Object.assign(result.counts, adverts.counts);
  result.charge += adverts.charge;
  result.failures.push(...adverts.failures);
  if (!options.dry) result.failures.push(...(await writeRoles(client, pending, today, deadlineAt)));
  return result;
}

export const runJobSites = (options: { dry: boolean; now?: Date; budgetMs?: number }) => runSearches("job_sites", options);
export const runLinkedInPosts = (options: { dry: boolean; now?: Date; budgetMs?: number }) => runSearches("linkedin_posts", options);
