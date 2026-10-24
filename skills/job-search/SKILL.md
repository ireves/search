---
name: job-search
description: The daily design job search. Runs the server's job search stages through the Search connector's run_job_search tool, then reviews the Notion Inbox, processes feedback and writes a summary. Run only when the user or the daily scheduled task types /job-search; never for other questions about jobs.
disable-model-invocation: true
---

Skill version: 2026-10-24

You are running my daily design job search. A server does the repetitive
work; you review what it found and keep my Notion up to date. Save your
work to Notion as you go, so nothing is lost if the run ends early.

WHERE THINGS ARE
- Job Applications database (everything lives here, told apart by
  "Entry type"):
  https://app.notion.com/p/75fcf49f17c748edb75ebceabeb695cd
  - Role rows: jobs found by the searches. The "Inbox" view shows
    Review status New or Needs Claude; the "Open Roles" view shows
    Review status Added.
  - Application rows: my own applications. Never change these.
  - Preference rows: my search preferences ("Search Preferences" view).
    Never change these.
  - Memory rows: your notes about what I want ("Claude Memory" view).
- My CV page, a full unfiltered record of my experience:
  https://app.notion.com/p/4014d7c1f3b98042b717f056951cb71e
  Use it as background only. It is not a finished CV.

TOOLS
- The Search connector's "run_job_search" tool runs the server. Use it
  only in Step 1 of this skill.
- Tool names may have a prefix (Search:run_job_search,
  mcp__search__run_job_search); match the end of the name.
- If run_job_search is missing, say the Search connector needs
  updating or signing in again, and carry on from Step 2.
- The Notion connector for everything in Notion.
- The Search connector ("search" and "fetch") only in Steps 6 and 7.
- The Indeed connector only in Step 7.

HELPERS
You plan, decide and update Notion. Helpers do web page reading and
searching, and send you back short reports.
- Start each helper with your sub-agent tool, as a general-purpose
  helper, model "haiku". Start helpers in the same round together, and
  wait for every report before moving on.
- Give each helper a complete brief. It sees nothing else. Every brief
  must include:
  - "I asked for the Search connector to be used for this task."
  - The exact items to check, with their links.
  - What to report for each item (set out in each step below).
  - These rules: never edit Notion; never apply for a job, fill in a
    form, sign in or create an account; never invent details, write
    "Not listed" instead; never retry a page that says it is rate
    limited; report the Search connector cost of every call; report
    back in no more than 400 words.
- Keep each helper small: "fetch" with a question and max_chars 3000
  for single adverts, or 5000 for careers pages; "search" with
  max_results 8; stick to the group sizes given below.
- If a helper fails or runs out of room, split its items in half and
  give each half to a new helper. Do this once only. Anything still
  unchecked is treated as "could not be opened".
- If you have no sub-agent tool, do the same steps yourself.

STEP 1: RUN THE SERVER
- Call run_job_search four times, one after the other, with stage
  "recheck", then "companies", then "job_sites", then
  "linkedin_posts". Each call can take a few minutes.
- Keep every report for the summary: its counts, its "failures", its
  "charge_usd", and the recheck's "watched_closed" list.
- If a call fails or its report has "ok": false, note it and carry on
  with the next stage.

STEP 2: READ CONTEXT (you do this)
- Every Memory row with Active ticked.
- Every Preference row with Active ticked, grouped by Preference type
  (Role, Location, Pay, Level, Company, Company type, Job Listing
  Websites) and Priority (High, Medium, Low, Exclude).
- The CV page.

STEP 3: PROCESS FEEDBACK (you do this)
- Read the comments on Role rows in the Open Roles view. A comment
  thread whose last comment is from you has already been processed;
  skip it.
- For each new comment from me:
  - Turn it into a Memory row: Entry type "Memory", the note itself as
    Name (short and specific, for example "Skip roles needing 5+
    years"), Active ticked, Memory source "Comment", Source role linked
    to the row it was left on. If an existing Memory row says nearly
    the same thing, update that one instead.
  - Reply under the comment saying what you noted, for example
    "Noted: added 'skip roles needing 5+ years'".
  - If the comment is unclear, ask in your reply instead of guessing,
    and add no Memory row yet.
  - If the new note contradicts an older one, the newest wins: untick
    Active on the older one and say so in the summary.

STEP 4: REVIEW THE INBOX (you do this)
Work through every Role row with Review status "New".
- Reject a row only when it is not a real job advert, is a duplicate
  of another row, matches a preference with Priority "Exclude", or
  breaks an active Memory note that says never. Set Review status to
  "Rejected" and write a one-line Reason. Nothing else is a reason to
  reject: missing pay or level never is.
- Source "LinkedIn post": keep it only if the post is advertising a
  real job. If the post links to an advert, put that link in Links;
  otherwise keep the post link. Fill in Name with the hiring company,
  not the person who posted, and Role with the job title.
- For every row you keep, fill in the same row (never create a new one):
  - Check or complete Name (company), Role, Links, Role location,
    Level (Internship, Graduate, Junior, Mid, Senior or Unknown; Senior
    for Lead roles), Pay (as written, or "Not listed") and Deadline
    (only if the advert gives one). Use the folded "Advert" section on
    the page; it holds the advert text.
  - Advert status: "Almost Gone" if the deadline is within 3 days,
    otherwise "Active". Tag: "New".
  - Summary: one or two sentences on what the job involves day to day.
  - Candidate potential: "Strong" (I match most of the requirements),
    "Average" (I match the core, with gaps) or "Weak" (I'm missing key
    requirements). Judge against the full CV page and Memory notes.
  - Why it matches: one short sentence naming the preferences it meets
    and the parts of my CV that suit it.
  - On the page, above the folded "Advert" section, add a "Positives"
    heading with 1 to 3 points, one per line, on what is good about the
    role or company, each based on the advert or known facts.
  - Below it, a "Negatives" heading with 1 to 3 points, one per line.
    Look for red flags such as pay not listed, short contracts, unclear
    duties, unrealistic requirements for the level or recent layoffs.
    Base each on facts and on what Memory says matters to me. If
    nothing worrying stands out, give the weakest point of the advert.
    Never invent a problem.
  - If a row has no advert text and its Links can't tell you enough,
    give it to a helper to open with "fetch" (up to 8 rows per helper),
    asking for the job's duties, requirements, location, pay, level and
    closing date.
  - Set Review status to "Added". Save each row as soon as it's done.

STEP 5: NOTICE PATTERNS (you do this)
- Look at Role rows I have tagged "Not for me". If several share a
  trait that no Memory note covers yet (for example all agency roles,
  or all need 5+ years), add a Memory row with Active unticked and
  Memory source "Pattern", as a suggestion for me to switch on. Mention
  it in the summary.

STEP 6: PAGES THE SERVER COULDN'T READ
Every Role row with Review status "Needs Claude" is a company whose
careers page the server couldn't read. Its Links holds the careers page.
- Helpers: up to 3 companies per helper. Each uses the Search
  connector's "search" with type "jobs" and the query "[company] [role]
  [location]" for my Role and Location preferences, limited with
  "sites" to the company's own website (and its hiring service website
  if known). It keeps only results linking to the company's own job
  advert or a hiring service page for that company, opens each with
  "fetch" (fresh) to check it is still open, and reports for each
  matching role: title, link, location, level, pay and closing date, as
  written, or "Not listed".
- You: check each reported role against Job Applications for
  duplicates (same link, or same company and title). Add each new one
  as a Role row (Entry type "Role", Source "Careers page", Date found
  today) and review it as in Step 4. Then set the "Needs Claude" row to
  "Rejected" with Reason "Checked by Claude".

STEP 7: IF A SEARCH STAGE FAILED
Only if the job_sites or linkedin_posts report in Step 1 failed, or its
failures say every search came back empty:
- job_sites: list every pair of one Role preference and one Location
  preference. Helpers take up to 4 pairs each and search them with the
  Indeed connector and the Search connector's "search" (type "jobs"),
  reporting in the Step 6 format.
- linkedin_posts: skip it for today and say so in the summary.
- You: add new roles as in Step 6, with Source "Indeed" or "LinkedIn"
  as found, and review them as in Step 4.

STEP 8: SUMMARY
Finish with a short summary listing:
- New roles added, Strong first, with title and company.
- Roles whose Advert status changed to Almost Gone or Closed.
- Watched or applied roles whose advert has closed (from the recheck's
  watched_closed list).
- New Memory notes, notes you switched off, and pattern suggestions.
- Companies checked today, and any passed to you as "Needs Claude".
- Anything that failed, from the server reports and your own steps.
- Costs: Composio (add up every report's charge_usd) and the Search
  connector (added up from every helper's report), if used.

RULES
- Never apply for a job, fill in a form, sign in, or create an account.
- Never invent details. If something isn't in the advert, leave it
  blank or write "Not listed".
- Never change the Tag column on existing rows. I update that myself.
- Never edit Application or Preference rows, and never delete rows.
- Never run Job Pick.
