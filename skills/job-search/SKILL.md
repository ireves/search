---
name: job-search
description: The daily design job search. Runs the server's job search stages through the Search connector's run_job_search tool, then reviews the Inbox (job_search_inbox), processes feedback and writes a summary. Run only when the user or the daily scheduled task types /job-search; never for other questions about jobs.
disable-model-invocation: true
---

Skill version: 2026-10-24d

You are running my daily design job search. A server does the repetitive
work; you review what it found and keep my Notion up to date. Save each
decision as you go, so nothing is lost if the run ends early.

WHERE THINGS ARE
- The Inbox: roles the server found that are waiting for your review,
  and companies whose careers page it couldn't read. It is not in
  Notion: use the Search connector's "job_search_inbox" tool.
- Job Applications database in Notion, rows told apart by "Entry type":
  https://app.notion.com/p/75fcf49f17c748edb75ebceabeb695cd
  - Role rows: roles you kept, in the "Open Roles" view (Review status
    Added). job_search_inbox writes them; you never create them
    yourself.
  - Application rows: my own applications. Never change these.
- My search preferences and your memory notes about what I want are
  not in Notion. Read and save them with the Search connector's
  "job_search_notes" tool. I edit them on the connector's
  /preferences page.
  - Preferences: never change these.
  - Memory notes: yours to add and switch on or off, as below.
- My CV page, a full unfiltered record of my experience:
  https://app.notion.com/p/4014d7c1f3b98042b717f056951cb71e
  Use it as background only. It is not a finished CV.

TOOLS
- The Search connector's "run_job_search" tool runs the server. Use it
  only in Step 1 of this skill.
- The Search connector's "job_search_notes" tool reads my preferences
  and your memory notes, and saves memory notes.
- The Search connector's "job_search_inbox" tool lists and reads the
  Inbox, and keeps ("add") or rejects each row. Use it only in Steps 4,
  6 and 7.
- Tool names may have a prefix (Search:run_job_search,
  mcp__search__run_job_search); match the end of the name.
- If run_job_search, job_search_notes or job_search_inbox is missing,
  say the Search connector needs connecting again, and carry on with
  what you can.
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
- Call job_search_notes with action "read" once. It gives my active
  preferences grouped by type (Role, Location, Pay, Level, Company,
  Company type, Job Listing Websites), each with its Priority (High,
  Medium, Low, Exclude), and every memory note with its id. Use the
  active memory notes; keep the ids for Steps 3 and 5.
- The CV page.

STEP 3: PROCESS FEEDBACK (you do this)
- Read the comments on Role rows in the Open Roles view. A comment
  thread whose last comment is from you has already been processed;
  skip it.
- For each new comment from me:
  - Turn it into a memory note with job_search_notes, action
    "add_memory": the note short and specific (for example "Skip roles
    needing 5+ years"), source "Comment", role_link the Notion link of
    the row it was left on, role_name "Role at Company". If an existing
    note says nearly the same thing, reword that one instead with
    "update_memory" and its id.
  - Reply under the comment saying what you noted, for example
    "Noted: added 'skip roles needing 5+ years'".
  - If the comment is unclear, ask in your reply instead of guessing,
    and add no memory note yet.
  - If the new note contradicts an older one, the newest wins: switch
    the older one off ("update_memory" with active false) and say so in
    the summary.

STEP 4: REVIEW THE INBOX (you do this)
Call job_search_inbox with action "list". Work through every row with
kind "role" (rows with kind "needs_claude" are for Step 6). Read the
advert text with "read", up to 10 ids at a time.
- Check every row against my preferences from Step 2. Reject it when:
  - it is not a real job advert, or is a duplicate of another row;
  - the job is not one of my Role preferences. Close variants count
    (for example "UI/UX Designer", "Mobile Product Designer", "Product
    Designer (UI-leaning)"); other kinds of design job do not (for
    example Graphic, Content, Production, Brand or Service Designer,
    or UX Researcher on its own);
  - it is not in one of my Location preferences. "Remote" means remote
    work I can do from the UK; a remote job limited to another country
    or region is rejected;
  - it matches a preference with Priority "Exclude" (for example a
    Senior, Lead or Manager level, in the title or the advert's stated
    level), or breaks an active memory note that says never.
  Reject it with job_search_inbox: action "reject", its id and a
  one-line reason naming the preference it fails. Missing pay or level
  is never a reason to reject, and neither is a Low or Medium priority
  preference: those only lower Candidate potential and go in
  why_it_matches.
- Source "LinkedIn post": keep it only if the post is advertising a
  real job. If the post links to an advert, give that link as link;
  otherwise the post link stays. Give the hiring company as company,
  not the person who posted, and the job title as title.
- Keep every other row with job_search_inbox: action "add", its id,
  and your review:
  - company, title, link and location only to correct the row's.
  - level: Internship, Graduate, Junior, Mid, Senior or Unknown (Senior
    for Lead roles). pay: as written, or "Not listed". deadline
    (YYYY-MM-DD) only if the advert gives one.
  - advert_status: "Almost Gone" if the deadline is within 3 days,
    otherwise "Active".
  - summary: one or two sentences on what the job involves day to day.
  - candidate_potential: "Strong" (I match most of the requirements),
    "Average" (I match the core, with gaps) or "Weak" (I'm missing key
    requirements). Judge against the full CV page and memory notes.
  - why_it_matches: one short sentence naming the preferences it meets
    and the parts of my CV that suit it.
  - positives: 1 to 3 points on what is good about the role or
    company, each based on the advert or known facts.
  - negatives: 1 to 3 points. Look for red flags such as pay not
    listed, short contracts, unclear duties, unrealistic requirements
    for the level or recent layoffs. Base each on facts and on what the
    memory notes say matters to me. If nothing worrying stands out,
    give the weakest point of the advert. Never invent a problem.
  The tool writes the role to Open Roles (Tag "New", Review status
  Added) with the advert text on its page, and returns its Notion link.
- If a row has no advert text (advert_chars 0) and its link can't tell
  you enough, give it to a helper to open with "fetch" (up to 8 rows
  per helper), asking for the job's duties, requirements, location,
  pay, level and closing date.
- Save each decision as soon as it's made.

STEP 5: NOTICE PATTERNS (you do this)
- Look at Role rows I have tagged "Not for me". If several share a
  trait that no memory note covers yet (for example all agency roles,
  or all need 5+ years), add a memory note with job_search_notes:
  "add_memory", source "Pattern", active false, as a suggestion for me
  to switch on at /preferences. Mention it in the summary.

STEP 6: PAGES THE SERVER COULDN'T READ
Every Inbox row with kind "needs_claude" is a company whose careers
page the server couldn't read. Its link is the careers page.
- Helpers: up to 3 companies per helper. Each uses the Search
  connector's "search" with type "jobs" and the query "[company] [role]
  [location]" for my Role and Location preferences, limited with
  "sites" to the company's own website (and its hiring service website
  if known). It keeps only results linking to the company's own job
  advert or a hiring service page for that company, opens each with
  "fetch" (fresh) to check it is still open, and reports for each
  matching role: title, link, location, level, pay and closing date, as
  written, or "Not listed".
- You: review each reported role as in Step 4. Keep one with
  job_search_inbox "add" without an id: company, title, link, source
  "Careers page" and your review. The tool refuses roles already in
  Job Applications or the Inbox; skip those. Then reject the
  "needs_claude" row with reason "Checked by Claude".

STEP 7: IF A SEARCH STAGE FAILED
Only if the job_sites or linkedin_posts report in Step 1 failed, or its
failures say every search came back empty:
- job_sites: list every pair of one Role preference and one Location
  preference. Helpers take up to 4 pairs each and search them with the
  Indeed connector and the Search connector's "search" (type "jobs"),
  reporting in the Step 6 format.
- linkedin_posts: skip it for today and say so in the summary.
- You: keep new roles as in Step 6, with source "Indeed" or "LinkedIn"
  as found.

STEP 8: SUMMARY
Finish with a short summary listing:
- New roles added, Strong first, with title and company.
- Roles whose Advert status changed to Almost Gone or Closed.
- Watched or applied roles whose advert has closed (from the recheck's
  watched_closed list).
- New memory notes, notes you switched off, and pattern suggestions.
- Companies checked today, and any passed to you as "Needs Claude".
- Anything that failed, from the server reports and your own steps.
- Costs: Composio (add up every report's charge_usd) and the Search
  connector (added up from every helper's report), if used.

RULES
- Never apply for a job, fill in a form, sign in, or create an account.
- Never invent details. If something isn't in the advert, leave it
  blank or write "Not listed".
- Never change the Tag column on existing rows. I update that myself.
- Never edit Application rows or my preferences, and never delete rows
  or memory notes.
- Never run Job Pick.
