// Every setting the job search server uses, in one place, so a change on
// Notion's or a hiring service's side means editing this file only.
// The job search is separate from the Search connector's tools: nothing here
// is imported by lib/tools or lib/mcp.ts.

export const NOTION = {
  api: "https://api.notion.com/v1",
  version: "2025-09-03",
  tokenSecret: "NOTION_TOKEN",
  // Job Applications holds roles, the inbox, applications and Claude's memory,
  // told apart by Entry type (docs/job-search/plan.md, section 4).
  applications: "ddd195a9-676b-4b7a-95d8-a784d1c378d9",
  preferences: "2c863bb5-d98b-488d-8541-f0630801d31f",
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
};

export const ENTRY = { role: "Role", application: "Application", memory: "Memory" } as const;
export const ADVERT = { active: "Active", almostGone: "Almost Gone", closed: "Closed" } as const;
export const REVIEW_ADDED = "Added";
export const TAG_NOT_FOR_ME = "Not for me";
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
  userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  timeZone: "Europe/London",
};

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

// Hiring services whose job adverts can be checked without opening the page.
// Each link pattern gives the board name and job id.
export const HIRING_SERVICES = {
  greenhouse: {
    link: /^https?:\/\/(?:job-boards|boards)\.(eu\.)?greenhouse\.io\/([^/?#]+)\/jobs\/(\d+)/i,
    job: (eu: boolean, board: string, id: string) => `https://boards-api.${eu ? "eu." : ""}greenhouse.io/v1/boards/${board}/jobs/${id}`,
  },
  lever: {
    link: /^https?:\/\/jobs\.(eu\.)?lever\.co\/([^/?#]+)\/([0-9a-f-]{36})/i,
    job: (eu: boolean, board: string, id: string) => `https://api.${eu ? "eu." : ""}lever.co/v0/postings/${board}/${id}`,
  },
  ashby: {
    link: /^https?:\/\/jobs\.ashbyhq\.com\/([^/?#]+)\/([0-9a-f-]{36})/i,
    list: (board: string) => `https://api.ashbyhq.com/posting-api/job-board/${board}`,
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

export const STAGES = ["recheck"] as const;
export type StageName = (typeof STAGES)[number];
