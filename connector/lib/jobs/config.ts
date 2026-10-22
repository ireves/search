// Every setting the job search server uses, in one place, so a change on
// Notion's, Composio's or a hiring service's side means editing this file
// only. The job search is separate from the Search connector's tools: nothing
// here is imported by lib/tools or lib/mcp.ts.

export const NOTION = {
  api: "https://api.notion.com/v1",
  version: "2025-09-03",
  tokenSecret: "NOTION_TOKEN",
  // Job Applications holds roles, applications, preferences and Claude's
  // memory, told apart by Entry type (docs/job-search/plan.md, section 4).
  applications: "ddd195a9-676b-4b7a-95d8-a784d1c378d9",
  // Notion allows about 3 requests a second per integration.
  gapMs: 350,
  timeoutMs: 20_000,
};

// Column names and choices in Job Applications.
export const COL = {
  name: "Name",
  role: "Role",
  links: "Links",
  deadline: "Deadline",
  entryType: "Entry type",
  reviewStatus: "Review status",
  advertStatus: "Advert status",
  tag: "Tag",
  status: "Status",
  roleLocation: "Role location",
  pay: "Pay",
  dateFound: "Date found",
  source: "Source",
  reason: "Reason",
  notes: "Notes",
  active: "Active",
  preferenceType: "Preference type",
  priority: "Priority",
  lastChecked: "Last checked",
  lastResult: "Last result",
  hiringService: "Hiring service",
  boardId: "Board ID",
};

export const ENTRY = { role: "Role", application: "Application", memory: "Memory", preference: "Preference" } as const;
export const ADVERT = { active: "Active", almostGone: "Almost Gone", closed: "Closed" } as const;
export const REVIEW = { new: "New", needsClaude: "Needs Claude", added: "Added", rejected: "Rejected" } as const;
export const TAG_NOT_FOR_ME = "Not for me";
export const SOURCE_CAREERS = "Careers page";
export const PREF = { role: "Role", location: "Location", company: "Company", level: "Level", sites: "Job Listing Websites" } as const;
export const PRIORITY_EXCLUDE = "Exclude";
export const RESULT = { ok: "Read OK", firecrawl: "Used Firecrawl", needsClaude: "Needs Claude" } as const;
// Application rows the recheck looks at (report only, never changed).
export const WATCHED_STATUSES = ["Watch", "Applied"];

export const RECHECK = {
  // A Deadline this many days away or fewer makes a role Almost Gone.
  almostGoneDays: 3,
  concurrency: 6,
  pageTimeoutMs: 15_000,
  // Stop starting new checks after this long, so the run ends inside the
  // function's time limit (300 seconds on Vercel's Hobby plan).
  budgetMs: 200_000,
  // Adverts the server can't open itself (Indeed blocks it) are read through
  // Firecrawl instead, at most this many a run.
  maxFirecrawl: 40,
  userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  timeZone: "Europe/London",
};

export const COMPANIES = {
  // Company and Job Listing Websites rows checked each run, oldest first.
  perRun: 12,
  // Job sites the job site search already covers.
  skipSites: [/(^|\.)indeed\./i],
  // A careers page shorter than this (after Firecrawl) didn't really load.
  minPageChars: 300,
  // Advert text saved in each new row's page.
  advertChars: 4000,
  // Shorter than this, the text read isn't really the advert.
  minAdvertChars: 200,
  // Adverts read through Firecrawl when they won't open directly, per run.
  maxFirecrawlAdverts: 30,
  budgetMs: 200_000,
};

// Stage 3: job sites (LinkedIn, Indeed and Glassdoor through Composio's Job
// Search toolkit) and hiring posts on LinkedIn.
export const SEARCHES = {
  jobs: {
    tool: "JOB_SEARCH_JOBS_SEARCH_API_SEARCH_JOBS",
    sites: ["indeed", "linkedin", "glassdoor"],
    countryIndeed: "UK",
    // Adverts posted in the last three days: daily runs overlap, so a
    // missed day or a weekend loses nothing. Duplicates are left out.
    hoursOld: 72,
    resultsWanted: 25,
    expects: ["search_term", "location", "site_name", "hours_old", "results_wanted", "country_indeed", "is_remote"],
  },
  linkedin: {
    tool: "JOB_SEARCH_JOBS_API_LINKEDIN_SEARCH_JOBS",
    datePosted: "week",
    expects: ["query", "location", "date_posted", "workplace_types"],
  },
  posts: {
    tool: "SCRAPECREATORS_SEARCH_LINKEDIN_POSTS",
    datePosted: "last-week",
    // Wording that marks a post as a job post rather than a design post.
    hiring: /\b(hiring|we'?re looking for|looking for an?|join (our|the) team|open role|vacanc(y|ies)|apply)\b/i,
    expects: ["query", "date_posted"],
  },
  textChars: 4000,
  // A search that usually finds about 20 adverts coming back with none at all
  // counts as a failure.
  budgetMs: 200_000,
};

export const SOURCE_SITES: Record<string, string> = { indeed: "Indeed", linkedin: "LinkedIn", glassdoor: "Glassdoor" };
export const SOURCE_POST = "LinkedIn post";

// Wording on an advert page that means it has closed. Matched against the
// page's visible text in lower case.
export const CLOSED_PHRASES = [
  "no longer accepting applications",
  "not accepting applications",
  "no longer available",
  "no longer open",
  "job has expired",
  "job posting has expired",
  "this job is closed",
  "this job has closed",
  "this position is closed",
  "this position has been filled",
  "position has been filled",
  "this role has been filled",
  "this role is closed",
  "this vacancy is closed",
  "vacancy has closed",
  "vacancy is now closed",
  "applications are now closed",
  "applications have closed",
  "posting has been removed",
  "job not found",
];

// Hiring services with free job lists. Link patterns give the board name
// (and, for an advert, the job id).
export const HIRING_SERVICES = {
  greenhouse: {
    name: "Greenhouse",
    link: /^https?:\/\/(?:job-boards|boards)\.(eu\.)?greenhouse\.io\/([^/?#]+)\/jobs\/(\d+)/i,
    board: /^https?:\/\/(?:boards-api\.(?:eu\.)?greenhouse\.io\/v1\/boards|(?:job-boards|boards)\.(?:eu\.)?greenhouse\.io)\/([^/?#]+)/i,
    job: (eu: boolean, board: string, id: string) => `https://boards-api.${eu ? "eu." : ""}greenhouse.io/v1/boards/${board}/jobs/${id}`,
    list: (board: string) => `https://boards-api.greenhouse.io/v1/boards/${board}/jobs`,
  },
  lever: {
    name: "Lever",
    link: /^https?:\/\/jobs\.(eu\.)?lever\.co\/([^/?#]+)\/([0-9a-f-]{36})/i,
    board: /^https?:\/\/(?:jobs\.(?:eu\.)?lever\.co|api\.(?:eu\.)?lever\.co\/v0\/postings)\/([^/?#]+)/i,
    job: (eu: boolean, board: string, id: string) => `https://api.${eu ? "eu." : ""}lever.co/v0/postings/${board}/${id}`,
    list: (board: string) => `https://api.lever.co/v0/postings/${board}?mode=json`,
  },
  ashby: {
    name: "Ashby",
    link: /^https?:\/\/jobs\.ashbyhq\.com\/([^/?#]+)\/([0-9a-f-]{36})/i,
    board: /^https?:\/\/(?:jobs\.ashbyhq\.com|api\.ashbyhq\.com\/posting-api\/job-board)\/([^/?#]+)/i,
    list: (board: string) => `https://api.ashbyhq.com/posting-api/job-board/${board}?includeCompensation=true`,
  },
  workable: {
    name: "Workable",
    board: /^https?:\/\/apply\.workable\.com\/([^/?#]+)/i,
    // Workable's widget list. It turns requests away from some servers
    // (Cloudflare error 1015); the careers page is then read with Firecrawl.
    list: (board: string) => `https://apply.workable.com/api/v1/widget/accounts/${board}`,
    page: (board: string) => `https://apply.workable.com/${board}/`,
  },
};

// Composio Connect: the user's own Composio account, reached as an MCP
// server with their consumer key. Only two of its tools are used.
export const COMPOSIO = {
  url: "https://connect.composio.dev/mcp",
  keySecret: "COMPOSIO_CONSUMER_KEY",
  keyHeader: "x-consumer-api-key",
  workbench: "COMPOSIO_REMOTE_WORKBENCH",
  schemas: "COMPOSIO_GET_TOOL_SCHEMAS",
  // The workbench stops each script after 180 seconds.
  scriptTimeoutMs: 175_000,
  callTimeoutMs: 190_000,
  batchSize: 15,
  marker: "@@JOBS_RESULT@@",
  scrape: {
    tool: "FIRECRAWL_SCRAPE",
    // Composio's managed Firecrawl allows plain reads only (no JSON
    // extraction or browser actions; tested 22 Oct 2026).
    args: { formats: ["markdown", "links"], waitFor: 3000, timeout: 45_000, location: { country: "GB" } },
    keepChars: 60_000,
    // Settings the weekly check expects the tool to still take.
    expects: ["url", "formats", "waitFor", "timeout", "onlyMainContent", "location"],
  },
};

// The run log in Supabase (supabase/job-search.sql). Uses the same project
// and insert-only key as the Search connector's problem log.
export const RUN_LOG = {
  urlSecret: "SUPABASE_URL",
  keySecret: "SUPABASE_LOG_KEY",
  runs: "job_search_runs",
  stages: "job_search_stages",
};

export const STAGES = ["recheck", "companies", "job_sites", "linkedin_posts"] as const;
export type StageName = (typeof STAGES)[number];
