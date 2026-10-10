// Apify: ready-made scrapers ("actors") for job boards Exa and Parallel can't
// search well. Used only for jobs searches, and only when APIFY_API_TOKEN is
// set. Each board is one actor run that waits for its results in the same
// request, so a slow board costs time but no extra moving parts.
// API reference: https://docs.apify.com/api/v2/act-run-sync-get-dataset-items-post

import { addCost } from "../cost.js";
import { cleanText, isoDay, truncate } from "../text.js";
import type { Hit } from "./exa.js";
import { callJson, EngineError } from "./http.js";
import { readSecret } from "../store.js";

const BASE = "https://api.apify.com/v2";

// How long Apify may run a scraper before it gives up, in seconds. A run that
// times out still returns the adverts it found so far.
const RUN_SECONDS = 60;

export type Board = "linkedin" | "indeed" | "glassdoor" | "totaljobs";

export interface JobSearchOptions {
  role: string;
  location?: string;
  // Two-letter country code, upper case.
  country: string;
  // Only adverts posted in the last this many days.
  days?: number;
  limit: number;
  maxChars: number;
}

interface BoardSpec {
  name: string;
  actor: string;
  domains: string[];
  // Prices on Apify's free plan, used to estimate the cost line. Paid plans
  // pay the same or less.
  perItem: number;
  perRun: number;
  onlyCountries?: string[];
  // Memory for the run in MB, where the scraper's own default costs more
  // than this search needs (some charge their run fee per GB).
  memory?: number;
  input: (o: JobSearchOptions) => Record<string, unknown>;
  hit: (item: any, o: JobSearchOptions) => Hit | null;
}

export async function apifyKey(): Promise<string | null> {
  return (await readSecret("APIFY_API_TOKEN")) ?? null;
}

function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

// "London" plus GB becomes "London, United Kingdom"; no place means the whole country.
function place(o: JobSearchOptions): string {
  const country = countryName(o.country);
  if (!o.location) return country;
  return o.location.toLowerCase().includes(country.toLowerCase()) ? o.location : `${o.location}, ${country}`;
}

const SYMBOLS: Record<string, string> = { GBP: "£", USD: "$", EUR: "€" };
const PERIODS: Record<string, string> = { YEAR: "a year", ANNUAL: "a year", MONTH: "a month", MONTHLY: "a month", WEEK: "a week", DAY: "a day", DAILY: "a day", HOUR: "an hour", HOURLY: "an hour" };

export function salary(min?: number | null, max?: number | null, currency?: string | null, period?: string | null): string | undefined {
  const sym = SYMBOLS[(currency ?? "").toUpperCase()] ?? (currency ? `${currency} ` : "");
  const amount = (n: number) => `${sym}${n.toLocaleString("en-GB", { maximumFractionDigits: 2 })}`;
  const lo = typeof min === "number" && min > 0 ? min : undefined;
  const hi = typeof max === "number" && max > 0 ? max : undefined;
  if (!lo && !hi) return undefined;
  const range = lo && hi && lo !== hi ? `${amount(lo)}–${amount(hi)}` : amount((lo ?? hi)!);
  const per = PERIODS[(period ?? "").toUpperCase()];
  return per ? `${range} ${per}` : range;
}

// Descriptions arrive as HTML; keep paragraph breaks before tags are dropped.
function description(html: string | null | undefined, max: number): string {
  if (!html) return "";
  const text = cleanText(html.replace(/<\s*(br|\/p|\/li|\/div|\/h\d)[^>]*>/gi, "\n").replace(/<li[^>]*>/gi, "\n• "));
  return truncate(text, max);
}

function daysAgo(days: number | null | undefined): string | undefined {
  if (typeof days !== "number" || !Number.isFinite(days) || days < 0) return undefined;
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

function facts(board: string, parts: (string | null | undefined | false)[]): string {
  return [board, ...parts].filter((p): p is string => typeof p === "string" && p.trim() !== "").join(" · ");
}

const BOARDS: Record<Board, BoardSpec> = {
  linkedin: {
    name: "LinkedIn",
    actor: "curious_coder~linkedin-jobs-scraper",
    domains: ["linkedin.com"],
    perItem: 0.002,
    perRun: 0.00005,
    input: (o) => ({
      keywords: o.role,
      location: place(o),
      datePosted: !o.days ? "anyTime" : o.days <= 1 ? "past24Hours" : o.days <= 7 ? "pastWeek" : o.days <= 30 ? "pastMonth" : "anyTime",
      limitPerSource: o.limit,
      // Company pages cost an extra request per advert and add little here.
      scrapeCompany: false,
    }),
    hit: (item, o) => {
      if (!item?.title || !(item.link || item.id)) return null;
      const pay = Array.isArray(item.salaryInfo) ? item.salaryInfo.filter(Boolean).join("–") : undefined;
      return {
        url: item.id ? `https://www.linkedin.com/jobs/view/${item.id}` : String(item.link).split("?")[0],
        title: `${cleanText(item.title)}${item.companyName ? ` · ${cleanText(item.companyName)}` : ""}`,
        date: isoDay(item.postedAt),
        excerpt: description(item.descriptionText ?? item.descriptionHtml, o.maxChars),
        facts: facts("LinkedIn", [
          item.location,
          pay,
          item.employmentType,
          item.seniorityLevel,
          item.applicantsCount ? `${item.applicantsCount} applicants` : undefined,
        ]),
        engine: "apify",
      };
    },
  },
  indeed: {
    name: "Indeed",
    actor: "valig~indeed-jobs-scraper",
    domains: ["indeed.com", "indeed.co.uk"],
    perItem: 0.0001,
    perRun: 0.001,
    input: (o) => {
      const code = o.country.toLowerCase() === "gb" ? "uk" : o.country.toLowerCase();
      // Indeed only offers 1, 3, 7 and 14 days; anything longer means no limit.
      const window = !o.days ? "" : (["1", "3", "7", "14"].find((d) => Number(d) >= o.days!) ?? "");
      return { country: code, title: o.role, ...(o.location ? { location: o.location } : {}), limit: o.limit, datePosted: window };
    },
    hit: (item, o) => {
      if (!item?.title || !item.url) return null;
      const where = [item.location?.city, item.location?.countryName].filter(Boolean).join(", ");
      const types = item.jobTypes && typeof item.jobTypes === "object" ? Object.values(item.jobTypes).join(", ") : undefined;
      const pay = item.baseSalary ? salary(item.baseSalary.min, item.baseSalary.max, item.baseSalary.currencyCode, item.baseSalary.unitOfWork) : undefined;
      return {
        url: item.url,
        title: `${cleanText(item.title)}${item.employer?.name ? ` · ${cleanText(item.employer.name)}` : ""}`,
        date: isoDay(item.datePublished ?? item.dateOnIndeed),
        excerpt: description(item.description?.text ?? item.description?.html, o.maxChars),
        facts: facts("Indeed", [where, pay, types, item.jobUrl && item.jobUrl !== item.url ? `Apply: ${item.jobUrl}` : undefined]),
        engine: "apify",
      };
    },
  },
  glassdoor: {
    name: "Glassdoor",
    actor: "valig~glassdoor-jobs-scraper",
    domains: ["glassdoor.com", "glassdoor.co.uk"],
    perItem: 0.0004,
    perRun: 0.001,
    input: (o) => ({ keywords: o.role, location: place(o), ...(o.days ? { daysOld: o.days } : {}), limit: o.limit, sortBy: "relevant_desc" }),
    hit: (item, o) => {
      if (!item?.title || !(item.seoUrl || item.url)) return null;
      const pay = item.pay ? salary(item.pay.min, item.pay.max, item.pay.currency, item.pay.period) : undefined;
      return {
        url: item.seoUrl ?? item.url,
        title: `${cleanText(item.title)}${item.employer?.name ? ` · ${cleanText(item.employer.name)}` : ""}`,
        date: daysAgo(item.ageInDays),
        excerpt: description(item.description, o.maxChars),
        facts: facts("Glassdoor", [
          item.location?.name,
          pay,
          typeof item.rating === "number" && item.rating > 0 ? `company rated ${item.rating}/5` : undefined,
          item.easyApply ? "Easy Apply" : undefined,
        ]),
        engine: "apify",
      };
    },
  },
  totaljobs: {
    name: "Totaljobs",
    actor: "blackfalcondata~totaljobs-scraper",
    domains: ["totaljobs.com"],
    perItem: 0.00139,
    perRun: 0.01,
    onlyCountries: ["GB"],
    memory: 1024,
    input: (o) => ({
      // The board's own search takes its keywords as a web-address slug.
      query: o.role.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, ""),
      ...(o.location ? { location: o.location } : {}),
      ...(o.days ? { age: o.days } : {}),
      maxResults: o.limit,
      sort: "relevance",
      compact: true,
      // Opening each advert's own page doubles the time; the search page's
      // snippet is enough here.
      includeDetails: false,
    }),
    hit: (item, o) => {
      if (!item?.title || !item.url) return null;
      const s = item.unifiedSalary;
      const pay = s?.salaryAvailable === false ? undefined : s ? salary(s.min, s.max, s.currency, s.period) : undefined;
      return {
        url: item.url,
        title: `${cleanText(item.title)}${item.company ? ` · ${cleanText(item.company)}` : ""}`,
        date: isoDay(item.datePosted),
        excerpt: description(item.description ?? item.textSnippetCleaned ?? item.textSnippet, o.maxChars),
        facts: facts("Totaljobs", [item.location, pay, item.workFromHome ? "remote or hybrid" : undefined]),
        engine: "apify",
      };
    },
  },
};

export const BOARD_NAMES = Object.keys(BOARDS) as Board[];

// Which boards to ask: those that cover the country, narrowed by any site
// list Claude gave and minus any sites it left out.
export function boardsFor(country: string, sites: string[], excluded: string[]): Board[] {
  const matches = (domains: string[], list: string[]) => list.some((s) => domains.some((d) => s === d || s.startsWith(`${d}/`) || s.endsWith(`.${d}`)));
  return BOARD_NAMES.filter((b) => {
    const spec = BOARDS[b];
    if (spec.onlyCountries && !spec.onlyCountries.includes(country)) return false;
    if (sites.length && !matches(spec.domains, sites)) return false;
    return !matches(spec.domains, excluded);
  });
}

// Runs one board's scraper and waits for its adverts.
export async function apifyJobs(board: Board, o: JobSearchOptions): Promise<Hit[]> {
  const spec = BOARDS[board];
  const key = await apifyKey();
  if (!key) throw new EngineError("Apify", 0, "Apify has no API key.");
  const params = new URLSearchParams({
    timeout: String(RUN_SECONDS),
    maxItems: String(o.limit),
    ...(spec.memory ? { memory: String(spec.memory) } : {}),
    // A ceiling on what one run can charge, in case a scraper ignores the limit.
    maxTotalChargeUsd: (spec.perRun + spec.perItem * o.limit * 2 + 0.01).toFixed(3),
  });
  const items = await callJson<unknown[]>(`${spec.name} via Apify`, `${BASE}/acts/${spec.actor}/run-sync-get-dataset-items?${params}`, {
    headers: { authorization: `Bearer ${key}` },
    body: spec.input(o),
    timeoutMs: (RUN_SECONDS + 20) * 1000,
  });
  const list = Array.isArray(items) ? items.slice(0, o.limit) : [];
  addCost("apify", spec.perRun + spec.perItem * list.length);
  return list.map((item) => spec.hit(item, o)).filter((h): h is Hit => h !== null);
}

export function boardName(board: Board): string {
  return BOARDS[board].name;
}

// Free call that proves the key works.
export async function apifyCheck(key: string): Promise<number> {
  const response = await fetch(`${BASE}/users/me`, { headers: { authorization: `Bearer ${key}` } });
  return response.status;
}
