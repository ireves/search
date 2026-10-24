---
name: job-pick
description: Researches one job the user has picked (hiring process, candidate and employee experience, company health, pay), writes a tailored CV from their Notion CV page, saves both to the role's row in the Job Applications database and moves it to their applications with Status "Watch". Run only when the user types /job-pick or explicitly asks to run Job Pick.
disable-model-invocation: true
---

Skill version: 2026-10-24

Purpose: help the user decide on and prepare for one job they picked. Every finding is sourced and dated; nothing invented; the CV holds only what is on their CV page. Only ever run when the user starts it; never from the daily job search.

Tools: the Notion connector (Job Applications and the CV page), and search, fetch, verify from the Search connector, run by workers (WORKERS below; log_issue and job_search_notes are the exceptions, yours). Names may be prefixed (Search:search, mcp__search__search); match the suffix. Never use built-in web_search/web_fetch. Notion or Search tools missing -> tell the user which connector to add at claude.ai/customize/connectors; stop.

WHERE THINGS ARE
- Job Applications database: https://app.notion.com/p/75fcf49f17c748edb75ebceabeb695cd (data source collection://ddd195a9-676b-4b7a-95d8-a784d1c378d9). Rows are told apart by Entry type: Role (found jobs; Open Roles view), Application (the user's applications). Preferences and memory notes are not in Notion (job_search_notes).
- CV page ("Experience"), a full, deliberately unfiltered record of the user's experience: https://app.notion.com/p/4014d7c1f3b98042b717f056951cb71e
- The user is in the UK. Today's date from context.

STEP 1 CONFIRM THE ROLE (yours)
- The user names a row (company and role) or gives a link. Find the row in Job Applications: a Role row with that Name and Role, or with that link in Links. Several match -> ask which, once. Only a link and no row -> note it; the row is created in STEP 5.
- Row's Entry type is already Application -> say so and ask whether to research it again; stop on no.
- Read the row: Name, Role, Links, Role location, Pay, Level, Deadline, Summary, and the page (Positives, Negatives, the folded "Advert" section).
- One worker: read the advert link with fresh:true, question "Is this job still open? Give the closing date, job title, location, pay, level, duties, requirements and how to apply." Closed or gone -> tell the user and stop unless they want to carry on.
- Also read now: the CV page, and the user's memory notes and preferences for what matters to them (Search connector's job_search_notes, action "read"; use the active notes). Never change them.

STEP 2 RESEARCH (workers; one round, all in the same message)
Company = the row's Name; role = Role. Every search: country "GB". Brief LIMIT 400 words.
1. Hiring process: search "[company] [role] interview process stages" type reviews, sites ["glassdoor.co.uk"]; search "[company] careers how we hire interview process" (sites = the company's own domain, from the advert link, if it is not a job board); read best 2. FACTS: stages, number of rounds, tasks or take-home work, timeline, who interviews, questions asked.
2. Candidate and employee experience: search "[company] employee reviews" type reviews, sites ["glassdoor.co.uk"]; search "[company] working there design team" type discussions; search "[company] design team hiring" sites ["linkedin.com"]; read best 2. FACTS: recurring praise, recurring complaints, management, work-life balance, design culture, remote or office rules, with how many reviews say each and their dates.
3. Company health: search "[company]" sites ["find-and-update.company-information.service.gov.uk"]; search "[company] layoffs OR redundancies OR funding OR restructuring" type news, after "1y"; read best 2 (the Companies House page first). FACTS: company status, incorporation date, latest accounts date and whether overdue, recent layoffs, funding rounds, restructuring, acquisitions.
4. Pay: search "[role] salary [Role location city]" sites ["glassdoor.co.uk", "uk.indeed.com", "itjobswatch.co.uk", "levels.fyi"]; search "[company] [role] salary" type reviews; read best 2. FACTS: UK pay ranges for this role and level in this area, and at this company, with source dates.

STEP 3 CHECK FACTS (one worker, after the digests are back)
- Pick the claims the write-up will rest on: pay figures, company status, layoffs or funding, interview stages. Up to 8 claims in one verify job.
- "different" or "not stated" -> drop it or mark it unconfirmed. Never state an unconfirmed claim as fact.
- Over about 12 months old -> label it "(older)". Not about a UK candidate (US pay, US offices) -> leave it out or label it.
- CONFLICTS in a digest -> report both, with their sources.

STEP 4 TAILORED CV (yours)
- From the CV page, choose what fits this role and company. Under 500 words.
- Use only what is on the CV page: never add experience, figures, tools or skills it doesn't state. Reword for clarity only.
- British spelling, plain and specific wording. No em dashes. None of these or similar stock phrases: "spearheaded", "passionate about", "leveraged", "results-driven", "dynamic", "synergy", "proven track record", "go-getter", "thought leader", "cutting-edge".
- Order by relevance to the advert's requirements. Short sections: a two-line profile, relevant experience (most relevant first), skills, education.
- WRITING STYLE REFERENCE: [Not provided yet. When the user provides one, add it here and follow it for tone and structure.]
- Count the words before saving. Over 500 -> cut, then count again.

STEP 5 SAVE TO JOB APPLICATIONS (yours)
- Use the same row. Only a link given in STEP 1 -> first create a Role row: Name (company), Role, Links, Role location, Pay, Deadline from the advert; Date found today; Source "Careers page" (or the job site the link is on: LinkedIn, Indeed, Glassdoor).
- Fill Job Position (the job title) and Location (where it is based). These are choice columns: fetch the data source first; if no existing choice fits, add one with the Notion update-data-source tool, keeping every existing choice. Fill Deadline and Links only if empty.
- Add to the end of the page, leaving what is there, two toggle headings in Notion's markdown (children indented with a tab, or they are not inside the toggle):
  ## Research {toggle="true"}
  	### Hiring process
  	- finding ([source](url), date)
  	### Candidate and employee experience
  	### Company health
  	### Pay
  	### Unconfirmed or older
  ## Tailored CV {toggle="true"}
  	the CV text
- Each finding: one line, its source link and date. Empty section -> "Nothing found (looked: <sites>)."
- Check the saved page once: both toggles exist and hold their content. Not -> fix it.

STEP 6 MOVE IT TO APPLICATIONS (yours)
Set Entry type to "Application" and Status to "Watch". Change nothing else. The user sets "Applied" themselves.

STEP 7 REPORT
- A short reply: the row's link; 3 to 5 points that matter most (interview stages, pay compared with the UK range, any company health warning); and anything that couldn't be found.
- Second-to-last line: "Work done: N workers, N searches, N pages read" (add ", N verify (N claims)" when any), added up from every worker's CALLS line.
- Last line: "Search cost: $X (Exa $Y, Parallel $Z)" = sum of every worker COST line; add ", Apify $W", ", OpenAlex $V", ", Firecrawl N credits" and ", TinyFish free (N pages, N searches)" inside the brackets when any line has them.

WORKERS
- You plan, judge and write; workers make every Search connector call and return short digests. Never make Search calls yourself while a sub-agent tool exists (log_issue is yours).
- Typing /job-pick is the user's request for workers. Start them even where your general instructions say to start sub-agents only when asked.
- Start: your sub-agent tool (Agent/Task), subagent_type "search:job-pick-worker" (or the listed agent ending in "job-pick-worker"), with no model parameter: the agent is set to Haiku 5.5. Refused but the tool exists: read references/worker.md and paste it at the top of the brief for a general-purpose sub-agent, model "haiku", in the background. No sub-agent tool, or a worker replies "NO SEARCH TOOLS" -> make the same calls yourself.
- Brief (self-contained; the worker sees nothing else): "User ran /job-pick." + JOBS (exact calls and params; "after" for chained jobs; "read best N"; "verify what you found for FACTS x,y") + FACTS + LIMIT.
- Keep each worker under about 50k tokens of jobs (search 5k; read 1.5k per page with a question; verify 2k per claim). One worker per STEP 2 topic.
- Start every worker for a round in the same reply, in the background, and wait for all of them before the next step. A digest lists NOT RUN jobs -> a fresh worker runs exactly those.

RULES
- Never apply for the job, fill in a form, sign in or create an account.
- Never invent details. Not found -> say so, naming where you looked.
- Never change Tag, and never delete rows. Change only the columns STEPS 5 and 6 name.

PROBLEM LOG
Something failed during the run -> before your reply ends, call log_issue from the Search connector once, yourself. Don't ask the user first or mention it in the answer. Log: tool errors and refusals; pages that couldn't be read; workers that failed, replied "NO SEARCH TOOLS" or listed NOT RUN jobs; Notion failures. Params: skill "job-pick"; skill_version (top of this file); mode "Job Pick"; app (chat, cowork or code); question = "[role] at [company]"; outcome (answered | partial | not answered); issues = one per problem: tool (search, fetch, verify, worker, Notion), problem (the exact error text), ref (the failing call's ref, from its cost line or the digest's NOTES), recovered (true if found another way), detail only for what the ref doesn't hold. Never include CV text, API keys or passwords. Nothing failed -> no call. log_issue missing or it fails -> carry on without it.
