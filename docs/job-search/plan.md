# Job search automation: build plan

Status: agreed plan (22 October 2026), being built. Phases 0 to 6 are built; Job Pick and the daily task still need their first real runs; see section 11 for progress. Written for a fresh Claude conversation that will build it. Read the whole file before doing anything.

**Changes since the first draft:**
- One database. Found roles, the inbox, applications, search preferences and Claude's memory all live in Job Applications, separated by an "Entry type" column and shown in different views. There is no Found Roles, Job Inbox or separate Search Preferences database. Section 4 describes the setup as built.
- No Vercel schedule. The daily Claude scheduled task starts the server's stages through the **Job search** connector (`/jobs/mcp`, one tool: `run_job_search`). It shares the Search connector's sign-in but is a separate connector, so its tool never sits beside search.
- Composio's managed Firecrawl allows plain page reads only (no `jsonOptions` extraction, tested 22 Oct 2026). The server reads careers pages as Markdown and keeps links named after a wanted role.

## Starting prompt

Paste this into a new Claude Code conversation on the `ireves/search` repository:

> Read `docs/job-search/plan.md` and `docs/data/job-search-comparison.md` in full, then build the job search automation they describe, phase by phase. Phase 0 (the Notion setup) is done, so start with Phase 1. Read my Notion databases first to check they match section 4, and ask before changing anything in Notion. Keep the job search code on its own path, as the plan sets out, so it never mixes with the existing search tools. Ask me whenever the plan leaves a decision open. Use plain British English with me.

## 1. What this is

A daily job search for design roles in the UK, logged in Notion. It replaces the current Claude scheduled task (the "Claude Job Searching" prompt), which does everything with Claude and haiku helpers.

The new version splits the work:

- **The Vercel server** does the repetitive work every day, without Claude: rechecking found roles, reading company job lists, searching job sites and LinkedIn posts, filtering, removing duplicates and collecting each advert's text.
- **Claude** does only what needs judgement: deciding which roles are relevant, rating them against the CV, writing summaries, positives and negatives, learning from feedback, and reading the pages the server couldn't.
- **Job Pick**, a new skill, runs only when the user starts it, to research a role they intend to apply for and tailor their CV.

The top priority is the **relevance and quality** of the roles logged, then correctness. Cost and speed come after.

## 2. Keep it separate from the search tools

The repo's existing search tools (the Search connector's `search`, `fetch`, `verify`, `research`, and the uni-search, better-search, search-report and search-log skills) have nothing to do with job searching. The job search must not change how they behave, and must not appear among their tools.

| Part | Path | Notes |
|---|---|---|
| Server code | `connector/lib/jobs/` | All job search logic. May reuse small helpers (`lib/engines/http.ts`, `lib/store.ts` secrets), never `lib/tools/*` or `lib/mcp.ts`. |
| Server entry point | `connector/api/jobs.ts` | `/jobs/mcp` (the Job search connector, for the daily Claude run) and `/jobs` (a dry run and "run for real" page for the owner). |
| Routes | `connector/vercel.json` | `/jobs` and `/jobs/mcp` rewrites, the Job search sign-in address, and `maxDuration` for `api/jobs.ts`. Existing entries unchanged. |
| Tests | `connector/test/jobs.test.ts` | Plus fixtures under `connector/test/fixtures/jobs/`. |
| Run log tables | `connector/supabase/job-search.sql` | New tables in the same Supabase project, separate from `search_calls` and `search_issues`. |
| Job Pick skill | `skills/job-pick/SKILL.md` | With its own worker brief in `skills/job-pick/references/`. |
| Job Pick worker | `agents/job-pick-worker.md` | Its own haiku worker. Do not reuse or edit `agents/search-worker.md` (its copies are checked by `scripts/check-worker-copies.sh`). |
| Daily Claude prompt | `docs/job-search/scheduled-task.md` | The new scheduled task prompt the user pastes into Claude. Not a skill. |
| Docs | `docs/job-search/` | This plan, setup steps, and how it works in plain English. |

Two small, deliberate touches to shared files:

1. `connector/lib/mcp.ts` `INSTRUCTIONS`: add `/job-pick` to the list of skills allowed to use the Search connector. Change nothing else there.
2. `.claude-plugin/plugin.json` description and `README.md`: mention Job Pick in one line each.

The existing `search` tool's `type: jobs` stays as it is. The server's job search does not use it.

## 3. Decisions already made (do not reopen)

- **Composio Connect, not the Composio developer platform.** The developer platform needs a paid monthly plan. Connect works from Vercel with the user's `ck_` consumer key (tested 22 Oct 2026, see section 9).
- **Job sites:** Composio Job Search toolkit, mainly `JOB_SEARCH_JOBS_SEARCH_API_SEARCH_JOBS` (LinkedIn, Indeed and Glassdoor in one call). `JOB_SEARCH_JOBS_API_LINKEDIN_SEARCH_JOBS` is a fast extra. Do not use Composio Google Jobs (returns generic pages) or Bing (no links). See `docs/data/job-search-comparison.md`.
- **LinkedIn posts from hiring managers:** `SCRAPECREATORS_SEARCH_LINKEDIN_POSTS` (Google-indexed public posts, so incomplete, and noisy: about 1 in 10 results was a real job post in testing). Claude judges every post.
- **Company careers pages:** free hiring-service job lists first (Greenhouse, Lever, Ashby, Workable), then `FIRECRAWL_SCRAPE` through Composio for companies with their own site (it rendered Apple's careers page in full).
- **Candidate potential:** a new select column, Strong, Average or Weak. Weak roles are still logged.
- **Positives and negatives** go inside each role's page, not in columns.
- **One database:** found roles, the inbox, applications, preferences and memory are all rows in Job Applications, told apart by "Entry type" (Role, Application, Preference, Memory). The server's Notion key only needs Job Applications.
- **Claude starts the server's runs** from the daily scheduled task, through the Job search connector. No Vercel schedule.
- **Memory:** feedback is stored as Memory rows in Job Applications, shown in the "Claude Memory" view.
- **Feedback comes two ways:** comments on a role's Notion page, and what the user says in Claude conversations. Both become Memory rows (Memory source "Comment" or "Chat").
- **CV:** the Notion page is a full record of the user's experience, deliberately unfiltered. Claude uses it as background and never treats it as a finished CV.
- **Job Pick** runs only when the user starts it by hand. Claude must never run it on its own, and the daily run must never run it.
- **Job Pick status change:** it changes the same row's Entry type from Role to Application and sets Status to "Watch", so the row moves from the Open Roles view to the Job Applications view. The user changes Status to "Applied" by hand.
- **The daily run never changes an Application row.** If a watched role's advert has closed, the run report lists it and Claude mentions it in the summary (confirmed by the user).
- **Missing choices:** when Job Position or Location in Job Applications has no fitting choice, Job Pick adds a new one.
- **Job Listing Websites rows:** skip indeed.com (the job site search covers Indeed); read startup.jobs with Firecrawl like a company's own site.

## 4. Notion (set up on 22 October 2026)

| Database or page | Link | Data source |
|---|---|---|
| Open Roles page (holds the CV page, and Open Roles and Search Preferences views of Job Applications) | https://app.notion.com/p/3e94d7c1f3b9803195b7c38df745adc9 | |
| Job Applications (roles, inbox, applications, preferences, memory) | https://app.notion.com/p/75fcf49f17c748edb75ebceabeb695cd | `collection://ddd195a9-676b-4b7a-95d8-a784d1c378d9` |
| CV page (titled "Experience", on Open Roles) | https://app.notion.com/p/4014d7c1f3b98042b717f056951cb71e | |
| Found Roles (old), kept for reference only, not used | https://app.notion.com/p/a4d1690f61d849cba23251f111def6fe | `collection://2b2cf01f-9124-415a-8b38-38990f5475f2` |
| Search Preferences (old), kept for reference only, not used | https://app.notion.com/p/903a964b511d47f8a166dfd159dbafdf | `collection://2c863bb5-d98b-488d-8541-f0630801d31f` |

Job Applications is a top-level page, not on Open Roles. The server's Notion integration is shared with Job Applications only.

### Job Applications

Every row has an **Entry type**: Application (the user's own applications), Role (found by the daily runs), Preference (the user's search preferences) or Memory (Claude's notes). Columns:

| Column | Kind | Used by |
|---|---|---|
| Name (row title, renamed from "Company") | Title | All: company name for Applications and Roles; the preference itself (e.g. UX Designer, London, UK, Apple); the note itself for Memory |
| Job Position, Location, Files, Stages, Email | User's own columns, unchanged | Applications |
| Status | Choice: Watch, Applied, Unsuccessful, Successful (a single choice, changed from Notion's status kind so new rows start empty) | Applications only; empty on Role and Memory rows |
| Links | Web link | Advert link for Roles and Applications; careers page for Company and Job Listing Websites preferences |
| Deadline | Date | Closing date for Roles and Applications |
| Notes | Text | All |
| Entry type | Choice: Application, Role, Preference, Memory | All |
| Role | Text | Job title |
| Role location | Text | Where the job is based, as the advert says |
| Pay, Summary, Why it matches, Reason | Text | Roles |
| Level | Choice: Internship, Graduate, Junior, Mid, Senior, Unknown | Roles |
| Date found | Date | Roles |
| Advert status | Choice: Active, Almost Gone, Closed | Roles (the old Found Roles "Status") |
| Tag | Choice: New, Interested, Not for me | Roles, set by the user |
| Candidate potential | Choice: Strong, Average, Weak | Roles |
| Source | Choice: LinkedIn, Indeed, Glassdoor, Careers page, LinkedIn post | Roles |
| Review status | Choice: New, Needs Claude, Added, Rejected | Roles |
| Active | Tick box | Preferences and Memory: untick to pause |
| Preference type | Choice: Role, Location, Pay, Company, Level, Company type, Job Listing Websites | Preferences |
| Priority | Choice: High, Medium, Low, Exclude | Preferences |
| Last checked, Last result | Date; choice: Read OK, Used Firecrawl, Needs Claude (plus the old Used JobsPipe, Used web search, Could not read) | Company and Job Listing Websites preferences, set by the server |
| Hiring service, Board ID | Choice: Greenhouse, Lever, Ashby, Workable, Own site; text | Company preferences, filled in by the server |
| Memory source | Choice: Comment, Chat, Pattern | Memory |
| Source role | Link to a row in the same database | Memory |
| Date added | Created time | Memory |

Views (each shows only its own columns):

1. **Job Applications**: Entry type = Application. Same columns as before the change.
2. **Open Roles** (called Found Roles in the first draft): Entry type = Role and Review status = Added, newest first. Also shown on the Open Roles page.
3. **Inbox**: Entry type = Role and Review status = New or Needs Claude.
4. **Claude Memory**: Entry type = Memory, newest first.
5. **Search Preferences**: Entry type = Preference, by Preference type. Also shown on the Open Roles page.

Each row's page (shared by every view) always shows Entry type and the user's application columns. The role, preference and memory columns show only when filled in, so a role's page shows its role details and a preference's page its preference details. Comments sit beside the page content, where the user leaves feedback on a role.

The 29 rows from the old Found Roles database were copied in as Role rows with Review status "Added" (their pages had no content). The 19 existing applications were marked Application. The 65 rows from the old Search Preferences database were copied in as Preference rows; the two unnamed Job Listing Websites rows were named after their sites (indeed.com, startup.jobs).

A Role row's page holds, from the top: a "Positives" heading with 1 to 3 bullet points, a "Negatives" heading with 1 to 3 bullet points, then the advert text (about 4,000 characters at most) inside a folded (toggle) section called "Advert". The server writes only the folded advert section; Claude adds the headings above it.

The server works out Hiring service and Board ID from the careers page link (or a hiring-service link on the careers page) and fills them in. Some careers links are already Greenhouse job list links (for example `https://boards-api.greenhouse.io/v1/boards/monzo/jobs`).

## 5. The daily server run (Vercel, no Claude)

Runs when the daily Claude scheduled task calls `run_job_search`, one stage per call: `recheck`, `companies`, `job_sites`, then `linkedin_posts`. Each call stays inside Vercel's 300-second limit.

1. **Read Notion.** Active Preference rows and the Role and Application rows of Job Applications. The server ignores Memory rows.
2. **Recheck found roles.** Only Role rows with Review status "Added", Advert status not Closed, and Tag not "Not for me":
   - Company on a hiring service: the job missing from its list means closed.
   - Otherwise: open the advert link. Gone (404 or 410), or the page says it's closed or no longer accepting applications, means closed.
   - Set Advert status to Closed, Almost Gone (Deadline within 3 days) or Active, as the current task does. Change only Advert status.
   - Blocked or unreachable (Indeed blocks the server): read the advert through Firecrawl on Composio instead (about $0.0008 a page, at most 40 a run). Firecrawl gets through Indeed (tested 22 Oct 2026).
   - Still can't tell: leave it as it is and list it in the run report.
   - Application rows with Status "Watch" or "Applied": check the advert the same way but never change the row. If one has closed, list it in the run report so Claude mentions it in the summary (confirmed by the user).
3. **Choose today's companies.** The 12 Company and Job Listing Websites rows with the oldest "Last checked" (empty first), as now. Skip the indeed.com row (the job site search covers Indeed); treat other job listing sites, such as startup.jobs, as an own site.
4. **Check each company:**
   - Hiring service known: read its free job list. Endpoints tested on 22 Oct 2026: Greenhouse `https://boards-api.greenhouse.io/v1/boards/{id}/jobs`, Lever `https://api.lever.co/v0/postings/{id}?mode=json`, Ashby `https://api.ashbyhq.com/posting-api/job-board/{id}?includeCompensation=true`. Workable's list returned "too many requests" (Cloudflare error 1015) from the test machine; test it from Vercel and find its correct endpoint.
   - Workable's list turned away requests from the test machine (Cloudflare error 1015) but answered later; when it refuses, the server reads the Workable careers page through Firecrawl instead.
   - Own site: `FIRECRAWL_SCRAPE` through Composio, as plain Markdown (waiting 3 seconds for the page to load). Links whose text names a wanted role, on the company's own site or a hiring service, become jobs. A hiring-service link found on the page is used straight away and saved for next time.
   - Nothing worked (no careers link, or the page came back nearly empty): add a Role row with Review status "Needs Claude", Source "Careers page", the company as Name, the careers page link in Links, and the Reason. Not added again while one is still waiting.
   - Update the company's "Last checked" and "Last result" ("Read OK", "Used Firecrawl", "Needs Claude"). Fill in "Hiring service" and "Board ID" when first worked out.
5. **Search job sites** (stage `job_sites`). For each Role and Location preference pair: `JOB_SEARCH_JOBS_SEARCH_API_SEARCH_JOBS` (Indeed, LinkedIn and Glassdoor, UK settings, the last 72 hours, 25 results) and `JOB_SEARCH_JOBS_API_LINKEDIN_SEARCH_JOBS` (the last week). A "Remote" location searches the whole UK with the remote setting. The employer's own advert link is kept when the job site gives one. Tested 22 Oct 2026: about 20 and 10 results a search, at about $0.00025 and $0.0005.
6. **Search LinkedIn posts** (stage `linkedin_posts`). For each Role preference: `SCRAPECREATORS_SEARCH_LINKEDIN_POSTS` for "hiring {role} {first location}", posted in the last week (about $0.001 a search). Only posts whose text reads like a hiring post are kept; the post text is the advert. Posts become Role rows with Review status "New" and Source "LinkedIn post"; Claude decides if each is a real job.
7. **Filter.** Use only Preference rows here, never Memory notes:
   - Drop roles that match an "Exclude" preference.
   - Drop roles whose title has no link to any Role preference. Keep this loose: a missed good role is worse than an extra one for Claude to reject. Built as: the title names a Role preference or its last word ("Designer").
   - Drop roles clearly elsewhere: a location is kept when empty, when it names a Location preference (or the UK, for "London, UK"), or a place in the company's Notes ("London and Cupertino Only", "Any Location").
   - Don't drop roles for missing pay or level.
8. **Remove duplicates.** Against every Role and Application row, including Rejected ones (same link after removing tracking parts, or same company and title), and across sources: the same job on several sites becomes one row, preferring the employer's own advert link.
9. **Collect advert text.** In order: the job list's own description (Lever, Ashby) or the hiring service's advert (Greenhouse); else the advert page opened directly, when the text names the role and runs to 200 characters or more; else the advert page through Firecrawl (main content, as plain text, at most 30 a run). Save it in the row's page inside a folded section called "Advert", trimmed to about 4,000 characters. The report counts where each advert's text came from, and any left without.
10. **Write the new rows** (Entry type Role, Review status New, Date found today, and whichever of Name, Role, Role location, Pay, Deadline, Links, Source the source gave) and the run log (section 7).

Rules for the server: never apply for a job, fill in a form, sign in or create an account. Never invent details: leave a field empty when it isn't given.

## 6. The daily Claude run (scheduled task)

Write the new prompt to `docs/job-search/scheduled-task.md`, in the same style as the user's current prompt (numbered steps, plain words, helpers as haiku sub-agents with full briefs and the 400-word report limit). It starts the server itself (step 1). Claude uses the Job search connector for step 1, the Notion connector throughout, and the Search connector only for step 6.

1. **Run the server.** Call the Job search connector's `run_job_search` with `stage: "recheck"`, then `"companies"`, `"job_sites"` and `"linkedin_posts"`. Keep the reports for the summary. If a call fails, say so in the summary and carry on.
2. **Read context.** Active Memory rows (Claude Memory view), the user's active Preference rows (Search Preferences view), and the CV page.
3. **Process feedback.** Read new comments on Role rows since the last run, and any feedback the user has given in Claude conversations (for example "remember I don't want agency roles").
   - Turn each into a Memory row (Entry type Memory, the note as Name, Active ticked, Memory source "Comment" with Source role linked, or "Chat" for feedback from a conversation) or an update to an existing one. In any conversation, when the user gives job search feedback, Claude saves it the same way straight away.
   - Reply under the comment saying what was noted, for example "Noted: added 'skip roles needing 5+ years'". A reply from Claude marks the comment as processed.
   - Unclear comment: ask in the reply instead of guessing.
   - A new note that contradicts an older one: the newest wins. Untick the older one and say so in the summary.
4. **Review the Inbox** (Role rows with Review status "New"):
   - Reject only when the row is not a real job advert, is a duplicate, matches an Exclude preference, or breaks an active Memory "never" note. Set Review status "Rejected" with a one-line Reason.
   - LinkedIn posts: keep only real job posts. Find the advert link if there is one; otherwise use the post link.
   - For every kept role, fill in the same row (no new row is created):
     - Check or complete Name (company), Role, Links, Role location, Level, Pay, Deadline; set Advert status "Active" and Tag "New", as in the current prompt.
     - Summary: one or two sentences on what the job involves day to day.
     - Candidate potential: Strong (matches most requirements), Average (matches the core, with gaps) or Weak (missing key requirements). Judged against the full CV page and Memory.
     - Why it matches: one short sentence naming the preferences it meets, plus the parts of the CV that suit it.
     - Page, above the folded "Advert" section, under a "Positives" heading: 1 to 3 points on what is good about the role or company, one per line, each based on the advert or on known facts about the company.
     - Page, under a "Negatives" heading: 1 to 3 points, one per line. Look for red flags such as pay not listed, short contracts, unclear duties, unrealistic requirements for the level, or recent layoffs. Base each on facts and on Memory notes about what matters to the user. If nothing worrying stands out, give the weakest point of the advert. Never invent a problem.
   - Set Review status to "Added", which moves the row from the Inbox view to the Open Roles view.
   - Save each role as soon as it's done.
5. **Notice patterns.** If several roles tagged "Not for me" share a trait, add a Memory row with Active unticked and Memory source "Pattern", as a suggestion, and mention it in the summary.
6. **Pages the server couldn't read** (Role rows with Review status "Needs Claude"). Turn each advert found into its own Role row and review it as in step 4; set the original row to "Rejected" with Reason "Checked by Claude". Use the current prompt's Round C: Search connector `search` (type "jobs", limited to the company's site with `sites`) and `fetch` to confirm adverts are open, through haiku helpers, 3 companies per helper.
7. **Summary.**
   - New roles, Strong first, with title and company.
   - Roles whose Advert status changed to Almost Gone or Closed.
   - Watched roles that have closed.
   - New Memory notes and suggestions.
   - Companies checked, and any marked "Could not read".
   - The Search connector cost, if it was used.

Permissions: Claude may add and edit Memory rows and review Role rows, never the user's Preference rows. It never changes Tag on existing rows, never deletes rows, never edits Application rows, and never runs Job Pick.

## 7. Logging and reliability

Composio Connect is designed for chat assistants, so it could change without notice. Build for that:

- **Use the official MCP client library** (`@modelcontextprotocol/sdk`) to talk to `https://connect.composio.dev/mcp` with the `x-consumer-api-key` header. The test used hand-written JSON-RPC, which was fine for a test only.
- **Use only two Connect tools:** `COMPOSIO_REMOTE_WORKBENCH`, to run a short Python script that calls the job tools with `run_composio_tool` and prints compact JSON after a fixed marker, and `COMPOSIO_GET_TOOL_SCHEMAS`, for the weekly check. Direct `COMPOSIO_MULTI_EXECUTE_TOOL` replies are cut to a preview when large ("...14 more items"), so don't rely on them.
- **One config file** (`connector/lib/jobs/config.ts`) holds every tool name and setting.
- **Small batches.** The workbench stops each script after 180 seconds. Set timeouts and retry once.
- **Check results.** A call that reports success but returns nothing usable (for example 0 jobs from a search that usually finds 40) counts as a failure.
- **Weekly check** that each Composio tool still exists and takes the same settings. Flag any change in the run log.
- **Clear errors.** Key rejected (401), balance empty (402 `Metering_WalletBalanceExhausted`), tool missing, and time limit each get their own message.
- **Fallback to Claude.** If job sites or LinkedIn posts fail, the server records it, and the Claude run's summary says so. The Claude run can then search those role and location pairs with the Search connector and the Indeed connector, as the current task does.
- **Run log in Supabase** (`connector/supabase/job-search.sql`): one row per run and per stage, with counts, failures, Composio charges (from `instant_charge`) and time taken. Claude reads it with the Supabase connector. Store no CV text and no personal data beyond what's in the adverts.
- **Dry-run mode** for the manual "run now": does everything except write to Notion, and returns a report. Use it before the first real run.

## 8. Things to check while building

- **Vercel limits:** checked 22 Oct 2026 (see setup.md). 300 seconds per call on the Hobby plan, so each stage is its own `run_job_search` call and stops starting new work after 200 seconds. (No Vercel schedule is used.)
- **Composio Connect terms:** whether automated use from a server is allowed. If unclear, tell the user before relying on it.
- **Workable** job list endpoint, tested from Vercel.
- **Tell rows apart by Entry type**, never by Status.

## 9. Keys and setup (the user does these)

1. **Composio Connect key** (`ck_...`). It's already in the test project's `COMPOSIO_API_KEY` variable. Add it on the connector's settings page (`https://search-connector.vercel.app/settings`) as `COMPOSIO_CONSUMER_KEY` (listed there as "Composio Connect consumer key"). Never ask the user to paste a key into chat.
2. **Notion access for the server.** A Notion internal integration shared with Job Applications only, its token saved on the settings page as `NOTION_TOKEN`. Done 22 Oct 2026.
3. **Job search connector in Claude.** Bundled with the search plugin in `.mcp.json` (server `job-search`, `https://search-connector.vercel.app/jobs/mcp`). Update or install the plugin and sign in when Claude asks, in the account the scheduled task runs in. If it doesn't appear, add the same address by hand as a custom connector named "Job search" (setup.md, section 4).
4. **Clean up** after the real version works: delete the `composio-test` Vercel project (it holds the test page and the keys `COMPOSIO_API_KEY` and `COMPOSIO_PLATFORM_KEY`), and revoke the unused developer platform key on Composio.

Test results that this plan relies on (22 Oct 2026, `composio-test` project): through Connect and the workbench, the job site search returned 45 London listings (15 each from Glassdoor, Indeed and LinkedIn) with links, and Firecrawl returned Apple's careers page in full (24,464 characters), in 13 seconds. The LinkedIn posts search found an Apple designer's hiring post. Total cost of all tests: under 1 US cent.

## 10. Job Pick skill

`skills/job-pick/SKILL.md`, front matter with `disable-model-invocation: true` so it runs only when the user types `/job-pick` or explicitly asks to run Job Pick. Follow the structure of the existing skills (uni-search is the closest model) and the repo's `Skill version:` rule in `CLAUDE.md`.

1. **Confirm the role.** The user names a row in the Open Roles view or gives a link. Reopen the advert with `fetch` (fresh) and confirm it's still open. If it has closed, say so and stop unless the user wants to continue.
2. **Research**, through `agents/job-pick-worker.md` haiku workers using the Search connector (`search`, `fetch`, `verify`):
   - The hiring process and interview stages: the advert, the company's careers pages, Glassdoor UK interview reviews (`type: reviews`, `glassdoor.co.uk`).
   - Candidate and employee experience: Glassdoor, Reddit (`type: discussions`), LinkedIn posts.
   - Company health: Companies House (the official UK company register), recent UK news on layoffs, funding or restructuring (`type: news`).
   - Pay: the advert compared with UK salary data for similar roles.
3. **Check facts.** Run key claims through `verify`. Every finding gets its source link and date. Label anything older than about 12 months as older. Leave out or flag anything that doesn't apply to a UK candidate. Never state unconfirmed claims as fact.
4. **Tailored CV.** Pick from the CV page what fits this role and company, under 500 words:
   - British spelling and plain, specific wording.
   - No em dashes, and none of the stock phrases that make text sound machine-written ("spearheaded", "passionate about", "leveraged", "results-driven" and similar).
   - Never add experience, figures or skills that aren't on the CV page.
   - Count the words before saving.
   - The user will provide a writing style reference later. Leave a clearly marked place in the skill for it.
5. **Save to Job Applications.** Use the same row (if the user gave only a link, first create a Role row for it). Fill Job Position and Location, adding a new choice when none fits, and Deadline and Links if empty. Add two folding (toggle) headings to its page: "Research" (findings with sources) and "Tailored CV". Check Notion's current markdown rules for toggle headings.
6. **Move it to Job Applications:** set Entry type to "Application" and Status to "Watch". Change nothing else.
7. **Report.** A short reply with the entry's link. Log failures with the Search connector's `log_issue` (app and outcome as the other skills do), and end with the search cost line.

## 11. Build order

0. **Read and propose.** Done on 22 October 2026: Notion set up as in section 4.
1. **Server foundation.** Notion client, secrets, run log tables, dry-run mode, the recheck step (section 5, step 2), with tests. Deploy, dry-run, show the user the report. Built and merged 22 Oct 2026 (ireves/search#36): `lib/jobs/`, `api/jobs.ts`, run log tables created in Supabase. The user's dry run matched expectations.
2. **Company job lists.** Hiring-service lists and Firecrawl through Composio Connect, with the reliability measures in section 7. Built 22 Oct 2026, with: the Job search connector (`/jobs/mcp`) in place of a Vercel schedule, preferences moved into Job Applications, and Firecrawl for adverts the recheck can't open (Indeed). Filter, duplicate and advert-text steps (section 5, steps 7 to 10) are built for company jobs; Phase 3 adds the job site and LinkedIn post sources to them.
3. **Job sites and LinkedIn posts.** Searches, filters, duplicates, advert text, writing new Role rows. Built 22 Oct 2026 as two more stages, `job_sites` and `linkedin_posts`, sharing the company stage's duplicate, advert-text and writing steps. An empty reply from every search is reported as a failure, so the Claude run can search those pairs itself.
4. **Daily Claude prompt.** Write `docs/job-search/scheduled-task.md`. Run it alongside the old task for a few days, compare the results with the user, then switch over. Written 22 Oct 2026, modelled on the old "Job Finder" task. Feedback given in any conversation is saved by Claude as a Memory row (Memory source "Chat"), as the Job search connector's instructions tell it.
5. **Job Pick.** Skill and worker. Test on one real role the user chooses. Written 22 Oct 2026: `skills/job-pick/` and `agents/job-pick-worker.md` (Haiku). Not yet tested on a real role.
6. **Wrap up.** Docs, README line, plugin description, `search_changes` rows in Supabase for each merged change (as `CLAUDE.md` requires, probably with a new area such as "jobs"), and the clean-up in section 9. Done 22 Oct 2026: `docs/job-search/README.md` (how it works), setup sections 6 and 7, `search_changes` rows with area "jobs". The clean-up steps are the user's.

At each phase: run `npm run typecheck` and `npm test` in `connector/`, keep changes on the job search paths, and open a draft pull request.
