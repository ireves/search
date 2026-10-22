# Job search automation: build plan

Status: agreed plan, not built yet (22 October 2026). Written for a fresh Claude conversation that will build it. Read the whole file before doing anything.

## Starting prompt

Paste this into a new Claude Code conversation on the `ireves/search` repository:

> Read `docs/job-search/plan.md` and `docs/data/job-search-comparison.md` in full, then build the job search automation they describe, phase by phase. Start with Phase 0: read my Notion databases and CV page, then show me the exact Notion changes you propose and wait for my go-ahead before changing anything in Notion. Keep the job search code on its own path, as the plan sets out, so it never mixes with the existing search tools. Ask me whenever the plan leaves a decision open. Use plain British English with me.

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
| Server entry point | `connector/api/jobs.ts` | Scheduled runs and a manual "run now" for the admin. Not an MCP endpoint. |
| Routes and schedules | `connector/vercel.json` | Add `/jobs/*` rewrites, `crons` entries and `maxDuration` for `api/jobs.ts`. Leave existing entries unchanged. |
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
- **Memory:** feedback is stored as rows in the Search Preferences database with a new Type, "Memory", shown in a new view called "Memory".
- **CV:** the Notion page is a full record of the user's experience, deliberately unfiltered. Claude uses it as background and never treats it as a finished CV.
- **Job Pick** runs only when the user starts it by hand. Claude must never run it on its own, and the daily run must never run it.
- **Job Pick status change:** it links the Job Applications entry to the Found Roles row and sets the role's Status to "Watch". The user changes it to "Applied" by hand.
- **The daily run never changes a role whose Status is "Watch" or "Applied".**

## 4. Notion

| Database or page | Link |
|---|---|
| Open Roles page, with the Search Preferences database | https://app.notion.com/p/903a964b511d47f8a166dfd159dbafdf |
| Found Roles | https://app.notion.com/p/a4d1690f61d849cba23251f111def6fe |
| Job Applications | https://app.notion.com/p/ireves/75fcf49f17c748edb75ebceabeb695cd?v=6d40b4d2bb6f4f00b4516ae0a2f8a63e |
| CV | https://app.notion.com/p/ireves/CV-4014d7c1f3b98042b717f056951cb71e |

Read all four before proposing changes, and use their real property names. Changes to propose (wait for the user's go-ahead):

**Search Preferences**
- New Type option "Memory", and a view called "Memory" filtered to Type = Memory.
- Add a filter "Type is not Memory" to the user's existing views, so Memory rows don't mix with their own preferences.
- Memory rows need: the note (title), Type, Active (existing tick box), Source (link to the role or "chat"), Date added. Reuse existing columns where they fit; otherwise propose new ones.
- For Company rows: "Hiring service" (Greenhouse, Lever, Ashby, Workable, Own site) and "Board ID" (the company's name on that service, for example `creativex`). The server works these out from the careers page link and fills them in.

**Found Roles**
- New select "Candidate potential": Strong, Average, Weak.
- New text column "Summary".
- Status options "Watch" and "Applied", if they don't exist yet.
- Each role's page body holds two headings, "Positives" and "Negatives", each with 1 to 3 bullet points.

**Job Inbox (new database on the Open Roles page)**
A holding area between the server and Claude, so Found Roles only ever gets reviewed roles. Proposed columns: Title, Company, Link, Location, Pay, Closing date, Source (job site name, careers page, LinkedIn post), Found on, Review status (New, Added, Rejected, Needs Claude), Reason (why rejected, or what Claude needs to do), Found Role (link to the row Claude created). The page body holds the advert text, trimmed to about 4,000 characters.

**Job Applications**
- A link (relation) to Found Roles. Find the existing properties and fill the relevant ones; ask the user if any are unclear.

## 5. The daily server run (Vercel, no Claude)

Runs every morning (UK time) on a Vercel cron schedule. Split into stages if one run can't fit the time limits (see section 8).

1. **Read Notion.** Search Preferences (Active rows only, excluding Memory rows) and Found Roles.
2. **Recheck found roles.** Only rows where Status is not Closed, Watch or Applied, and Tag is not "Not for me":
   - Company on a hiring service: the job missing from its list means closed.
   - Otherwise: open the advert link. Gone (404 or 410), or the page says it's closed or no longer accepting applications, means closed.
   - Set Status to Closed, Almost Gone (closing date within 3 days) or Active, as the current task does. Change only Status.
   - Can't tell: leave Status as it is and list it in the run report.
   - Roles on Watch: never change their Status. If one has closed, list it in the run report so Claude mentions it in the summary. (This was an assumption, not yet confirmed by the user. Confirm before building.)
3. **Choose today's companies.** The 12 Company and Job Listing Websites rows with the oldest "Last checked" (empty first), as now.
4. **Check each company:**
   - Hiring service known: read its free job list. Endpoints tested on 22 Oct 2026: Greenhouse `https://boards-api.greenhouse.io/v1/boards/{id}/jobs`, Lever `https://api.lever.co/v0/postings/{id}?mode=json`, Ashby `https://api.ashbyhq.com/posting-api/job-board/{id}?includeCompensation=true`. Workable's list returned "too many requests" (Cloudflare error 1015) from the test machine; test it from Vercel and find its correct endpoint.
   - Own site: `FIRECRAWL_SCRAPE` through Composio, using its `jsonOptions` to pull out a list of jobs (title, link, location). That runs Firecrawl's own extraction, not Claude.
   - Nothing worked: add a Job Inbox row with Review status "Needs Claude" and the careers page link.
   - Update the company's "Last checked" and "Last result" ("Read OK", "Used Firecrawl", "Needs Claude"). Fill in "Hiring service" and "Board ID" when first worked out.
5. **Search job sites.** For each Role and Location preference pair: `JOB_SEARCH_JOBS_SEARCH_API_SEARCH_JOBS` with UK settings and postings since the last run (with some overlap). Optionally `JOB_SEARCH_JOBS_API_LINKEDIN_SEARCH_JOBS`.
6. **Search LinkedIn posts.** For each Role preference: `SCRAPECREATORS_SEARCH_LINKEDIN_POSTS` with hiring phrases and the location, posted in the last week. Optionally per Company row. Posts go to the Inbox with Source "LinkedIn post"; Claude decides if each is a real job.
7. **Filter.** Use only the user's own (non-Memory) preferences here:
   - Drop roles that match an "Exclude" preference.
   - Drop roles whose title has no link to any Role preference. Keep this loose: a missed good role is worse than an extra one for Claude to reject.
   - Don't drop roles for missing pay or level.
8. **Remove duplicates.** Against Found Roles and Job Inbox (same link after removing tracking parts, or same company and title), and across sources: the same job on several sites becomes one row, preferring the employer's own advert link.
9. **Collect advert text.** From the job site result where it includes a description, else by opening the advert. Save it in the Inbox row's page body.
10. **Write the Inbox rows** and the run log (section 7).

Rules for the server: never apply for a job, fill in a form, sign in or create an account. Never invent details: leave a field empty when it isn't given.

## 6. The daily Claude run (scheduled task)

Write the new prompt to `docs/job-search/scheduled-task.md`, in the same style as the user's current prompt (numbered steps, plain words, helpers as haiku sub-agents with full briefs and the 400-word report limit). It runs after the server, for example two hours later. Claude uses the Notion connector, and the Search connector only for step 5.

1. **Read context.** Active Memory rows, the user's own active preferences, and the CV page.
2. **Process feedback.** Read new comments on Found Roles rows since the last run.
   - Turn each into a Memory row (Active ticked, Source set) or an update to an existing one.
   - Reply under the comment saying what was noted, for example "Noted: added 'skip roles needing 5+ years'". A reply from Claude marks the comment as processed.
   - Unclear comment: ask in the reply instead of guessing.
   - A new note that contradicts an older one: the newest wins. Untick the older one and say so in the summary.
3. **Review the Job Inbox** (Review status "New"):
   - Reject only when the row is not a real job advert, is a duplicate, matches an Exclude preference, or breaks an active Memory "never" note. Set Review status "Rejected" with a one-line Reason.
   - LinkedIn posts: keep only real job posts. Find the advert link if there is one; otherwise use the post link.
   - For every kept role, create a Found Roles row:
     - Role, Company, Link, Location, Level, Pay, Date found, Closing date, Status and Tag "New", as in the current prompt.
     - Summary: one or two sentences on what the job involves day to day.
     - Candidate potential: Strong (matches most requirements), Average (matches the core, with gaps) or Weak (missing key requirements). Judged against the full CV page and Memory.
     - Why it matches: one short sentence naming the preferences it meets, plus the parts of the CV that suit it.
     - Page body, under a "Positives" heading: 1 to 3 points on what is good about the role or company, one per line, each based on the advert or on known facts about the company.
     - Page body, under a "Negatives" heading: 1 to 3 points, one per line. Look for red flags such as pay not listed, short contracts, unclear duties, unrealistic requirements for the level, or recent layoffs. Base each on facts and on Memory notes about what matters to the user. If nothing worrying stands out, give the weakest point of the advert. Never invent a problem.
   - Set the Inbox row to "Added" and link it to the new Found Roles row.
   - Save each role as soon as it's done.
4. **Notice patterns.** If several roles tagged "Not for me" share a trait, add a Memory row with Active unticked, as a suggestion, and mention it in the summary.
5. **Pages the server couldn't read** (Inbox rows "Needs Claude"). Use the current prompt's Round C: Search connector `search` (type "jobs", limited to the company's site with `sites`) and `fetch` to confirm adverts are open, through haiku helpers, 3 companies per helper.
6. **Summary.**
   - New roles, Strong first, with title and company.
   - Roles that changed to Almost Gone or Closed.
   - Watched roles that have closed.
   - New Memory notes and suggestions.
   - Companies checked, and any marked "Could not read".
   - The Search connector cost, if it was used.

Permissions: Claude may add and edit Memory rows only, never the user's own preference rows. It never changes Tag on existing rows or deletes rows. It never changes Status on Watch or Applied roles. It never runs Job Pick.

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

- **Vercel limits** on the user's plan: how often crons may run, how long a function may run, and whether timing is exact. Check the current Vercel docs; don't rely on memory. Split the run into stages if needed.
- **Composio Connect terms:** whether automated use from a server is allowed. If unclear, tell the user before relying on it.
- **Workable** job list endpoint, tested from Vercel.
- **Status options** "Watch" and "Applied" in Found Roles.
- **The Watch assumption** in section 5, step 2.

## 9. Keys and setup (the user does these)

1. **Composio Connect key** (`ck_...`). It's already in the test project's `COMPOSIO_API_KEY` variable. For the search connector, add it as a secret on the connector's settings page (`https://search-connector.vercel.app/settings`) under a new name such as `COMPOSIO_CONSUMER_KEY`, which needs adding to the settings page's known secrets. Never ask the user to paste a key into chat.
2. **Notion access for the server.** The user creates a Notion internal integration, copies its token, shares the Open Roles page (and so its databases), the CV page and Job Applications with it, and adds the token on the settings page as `NOTION_TOKEN`. The server only needs Open Roles and Job Applications; the CV page is only read by Claude, so don't share it with the integration unless a later need appears.
3. **Cron secret:** `CRON_SECRET` as a Vercel environment variable, checked by `api/jobs.ts`.
4. **Clean up** after the real version works: delete the `composio-test` Vercel project (it holds the test page and the keys `COMPOSIO_API_KEY` and `COMPOSIO_PLATFORM_KEY`), and revoke the unused developer platform key on Composio.

Test results that this plan relies on (22 Oct 2026, `composio-test` project): through Connect and the workbench, the job site search returned 45 London listings (15 each from Glassdoor, Indeed and LinkedIn) with links, and Firecrawl returned Apple's careers page in full (24,464 characters), in 13 seconds. The LinkedIn posts search found an Apple designer's hiring post. Total cost of all tests: under 1 US cent.

## 10. Job Pick skill

`skills/job-pick/SKILL.md`, front matter with `disable-model-invocation: true` so it runs only when the user types `/job-pick` or explicitly asks to run Job Pick. Follow the structure of the existing skills (uni-search is the closest model) and the repo's `Skill version:` rule in `CLAUDE.md`.

1. **Confirm the role.** The user names a Found Roles row or gives a link. Reopen the advert with `fetch` (fresh) and confirm it's still open. If it has closed, say so and stop unless the user wants to continue.
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
5. **Save to Job Applications.** Create an entry, fill the relevant properties, link it to the Found Roles row, and add two folding (toggle) headings: "Research" (findings with sources) and "Tailored CV". Check Notion's current markdown rules for toggle headings.
6. **Update Found Roles:** set the role's Status to "Watch". Change nothing else.
7. **Report.** A short reply with the entry's link. Log failures with the Search connector's `log_issue` (app and outcome as the other skills do), and end with the search cost line.

## 11. Build order

0. **Read and propose.** Read the four Notion pages, propose the exact Notion changes in section 4, and wait for the go-ahead. Then make them, including creating Job Inbox.
1. **Server foundation.** Notion client, secrets, run log tables, dry-run mode, the recheck step (section 5, step 2), with tests. Deploy, dry-run, show the user the report.
2. **Company job lists.** Hiring-service lists and Firecrawl through Composio Connect, with the reliability measures in section 7.
3. **Job sites and LinkedIn posts.** Searches, filters, duplicates, advert text, Inbox writes.
4. **Daily Claude prompt.** Write `docs/job-search/scheduled-task.md`. Run it alongside the old task for a few days, compare the results with the user, then switch over.
5. **Job Pick.** Skill and worker. Test on one real role the user chooses.
6. **Wrap up.** Docs, README line, plugin description, `search_changes` rows in Supabase for each merged change (as `CLAUDE.md` requires, probably with a new area such as "jobs"), and the clean-up in section 9.

At each phase: run `npm run typecheck` and `npm test` in `connector/`, keep changes on the job search paths, and open a draft pull request.
