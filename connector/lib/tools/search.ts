import { exaSearch, type ExaType, type Hit } from "../engines/exa.js";
import { EngineError } from "../engines/http.js";
import { parallelSearch, type ParallelMode } from "../engines/parallel.js";
import { cleanDomain, keywords, parseDate, today } from "../text.js";
import { fuse, renderHit, withinDates } from "./merge.js";

export const SEARCH_TYPES = [
  "web",
  "news",
  "discussions",
  "x",
  "reviews",
  "papers",
  "people",
  "companies",
  "code",
  "jobs",
  "financial",
] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];

export const DEPTHS = ["fast", "standard", "thorough"] as const;
export type Depth = (typeof DEPTHS)[number];

interface Plan {
  exa?: { category?: string; prefix?: string; fresh?: boolean; defaultAfter?: string };
  parallel?: { include?: string[]; prefix: string; primary?: boolean };
  exaWeight: number;
  parallelWeight: number;
}

// Which engine does what. Exa finds pages by meaning and has the better index
// for articles, papers, people, companies and jobs, but can't reach Reddit or
// X. Parallel covers those and adds official docs and fresher pages to general
// searches. Tested October 2026 (docs/research-findings.md, round 3): Exa alone
// ranked best per result; adding Parallel's advanced mode raised the number of
// useful pages in a 10-result list by 14%, while its fast mode lowered quality.
const PLANS: Record<SearchType, Plan> = {
  web: { exa: {}, parallel: { prefix: "" }, exaWeight: 1, parallelWeight: 0.8 },
  news: { exa: { category: "news" }, parallel: { prefix: "Recent news reporting: " }, exaWeight: 1, parallelWeight: 0.9 },
  discussions: {
    exa: { prefix: "Forum threads and community discussions where people share first-hand experience: " },
    parallel: { include: ["reddit.com"], prefix: "Reddit threads with first-hand experiences, advice and fixes: ", primary: true },
    exaWeight: 1,
    parallelWeight: 1,
  },
  x: {
    parallel: { include: ["x.com", "twitter.com"], prefix: "Posts on X (Twitter) by individual people: ", primary: true },
    exaWeight: 0,
    parallelWeight: 1,
  },
  reviews: {
    exa: { prefix: "Detailed reviews written by real customers, users or employees: " },
    parallel: {
      include: ["trustpilot.com", "glassdoor.com", "glassdoor.co.uk", "reddit.com"],
      prefix: "Customer or employee reviews with ratings, pros and cons: ",
      primary: true,
    },
    exaWeight: 1,
    parallelWeight: 1,
  },
  papers: { exa: { category: "publication" }, exaWeight: 1, parallelWeight: 0 },
  people: { exa: { category: "people" }, exaWeight: 1, parallelWeight: 0 },
  companies: { exa: { category: "company" }, exaWeight: 1, parallelWeight: 0 },
  code: {
    exa: { prefix: "Technical documentation, code or answers about: " },
    parallel: { prefix: "Official documentation, GitHub issues or Stack Overflow answers: " },
    exaWeight: 1,
    parallelWeight: 0.8,
  },
  jobs: {
    exa: { prefix: "Job posting on a company careers page or applicant tracking site: ", fresh: true, defaultAfter: "30d" },
    exaWeight: 1,
    parallelWeight: 0,
  },
  financial: { exa: { category: "financial report" }, exaWeight: 1, parallelWeight: 0 },
};

// Exa's fast and auto cost the same and returned 7 of the same 8 pages, so
// "fast" depth only drops the second engine. deep-lite beat deep on open-ended
// questions in testing (same price, half the wait).
const EXA_TYPE: Record<Depth, ExaType> = { fast: "auto", standard: "auto", thorough: "deep-lite" };
// Parallel: advanced ($5/1k) found far better pages than fast ($1/1k) for
// general searches; on Reddit-only searches fast was as good, basic worst.
const PARALLEL_MODE: Record<Depth, ParallelMode> = { fast: "fast", standard: "advanced", thorough: "advanced" };
const CHARS: Record<Depth, number> = { fast: 700, standard: 800, thorough: 1200 };
const TOTAL_CHARS = 9000;
const DEFAULT_RESULTS = 10;

export interface SearchInput {
  query: string;
  type?: SearchType;
  goal?: string;
  after?: string;
  before?: string;
  sites?: string[];
  exclude_sites?: string[];
  country?: string;
  max_results?: number;
  fresh?: boolean;
  depth?: Depth;
}

export async function runSearch(input: SearchInput): Promise<{ text: string; isError: boolean }> {
  const query = input.query?.trim();
  if (!query) return { text: "Give a query.", isError: true };
  const type: SearchType = SEARCH_TYPES.includes(input.type as SearchType) ? (input.type as SearchType) : "web";
  const depth: Depth = DEPTHS.includes(input.depth as Depth) ? (input.depth as Depth) : "standard";
  const plan = PLANS[type];
  const limit = Math.min(Math.max(Math.round(input.max_results ?? DEFAULT_RESULTS), 1), 15);
  const perResult = Math.max(400, Math.min(CHARS[depth], Math.floor((depth === "thorough" ? 14_000 : TOTAL_CHARS) / limit)));
  const after = parseDate(input.after) ?? parseDate(plan.exa?.defaultAfter);
  const before = parseDate(input.before);
  const sites = (input.sites ?? []).map(cleanDomain).filter(Boolean);
  const excluded = (input.exclude_sites ?? []).map(cleanDomain).filter(Boolean);
  const fresh = Boolean(input.fresh || plan.exa?.fresh);
  const goal = input.goal?.trim();

  // A site list from Claude overrides the plan's own domains. Exa can't reach
  // Reddit or X at all, so those go to Parallel whatever the type.
  const parallelDomains = sites.length ? sites : plan.parallel?.include;
  const onlyExaBlind = sites.length > 0 && sites.every((d) => /(^|\.)(reddit\.com|x\.com|twitter\.com)$/.test(d.split("/")[0]));
  const exaActive = Boolean(plan.exa) && !onlyExaBlind;
  const parallelActive =
    onlyExaBlind || (Boolean(plan.parallel) && (depth !== "fast" || Boolean(plan.parallel!.primary) || !exaActive));

  const notes: string[] = [];
  const jobs: Promise<{ hits: Hit[]; weight: number } | null>[] = [];

  if (exaActive) {
    jobs.push(
      exaSearch({
        query: `${plan.exa!.prefix ?? ""}${query}`,
        objective: goal,
        highlightQuery: goal ? `${query}. ${goal}` : query,
        numResults: limit,
        type: EXA_TYPE[depth],
        category: plan.exa!.category,
        includeDomains: sites.length ? sites : undefined,
        excludeDomains: excluded.length ? excluded : undefined,
        startPublishedDate: after,
        endPublishedDate: before,
        userLocation: input.country,
        fresh,
        maxChars: perResult,
      })
        .then((hits) => ({ hits, weight: plan.exaWeight || 1 }))
        .catch((e) => {
          notes.push(`Exa unavailable: ${e instanceof EngineError ? e.friendly : (e as Error).message}`);
          return null;
        }),
    );
  }
  if (parallelActive) {
    const mode = PARALLEL_MODE[depth];
    const prefix = plan.parallel?.prefix ?? "";
    jobs.push(
      parallelSearch({
        objective: `${prefix}${query}${goal ? `. ${goal}` : ""}`,
        queries: [keywords(query, 7)],
        mode,
        maxResults: plan.parallel?.primary || !exaActive ? limit : Math.max(4, Math.ceil(limit * 0.6)),
        maxCharsPerResult: perResult,
        includeDomains: parallelDomains?.length ? parallelDomains : undefined,
        excludeDomains: excluded.length ? excluded : undefined,
        afterDate: after,
        location: input.country,
        fresh,
      })
        .then((hits) => ({ hits, weight: plan.parallelWeight || 1 }))
        .catch((e) => {
          notes.push(`Parallel unavailable: ${e instanceof EngineError ? e.friendly : (e as Error).message}`);
          return null;
        }),
    );
  }

  const settled = (await Promise.all(jobs)).filter((x): x is { hits: Hit[]; weight: number } => x !== null);
  if (!settled.length) return { text: notes.join("\n") || "No search engine is available.", isError: true };

  const filtered = settled.map((l) => ({ ...l, hits: l.hits.filter((h) => withinDates(h, after, before)) }));
  const results = fuse(filtered, limit);

  const header = [
    `Search: "${query}" · ${type}${depth !== "standard" ? ` · ${depth}` : ""} · ${results.length} result${results.length === 1 ? "" : "s"} · today is ${today()}`,
  ];
  if (after || before) header.push(`Published ${after ? `from ${after}` : ""}${after && before ? " " : ""}${before ? `to ${before}` : ""} (undated pages kept).`);
  if (fresh) header.push("Pages re-downloaded for freshness.");
  if (!results.length) {
    notes.push("No results. Describe the page you want in more words, loosen filters, or try another type.");
  }
  const body = results.map((hit, i) => renderHit(hit, i + 1)).join("\n\n");
  return { text: [header.join("\n"), body, notes.join("\n")].filter(Boolean).join("\n\n"), isError: false };
}
