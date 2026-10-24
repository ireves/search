# Job search: how it works

Your daily design job search, split between a server that does the repetitive work and Claude, which does the judging. Everything lives in one Notion database, [Job Applications](https://app.notion.com/p/75fcf49f17c748edb75ebceabeb695cd).

## Each day

1. **Claude's scheduled task starts** ([`scheduled-task.md`](scheduled-task.md)) and runs the `/job-search` skill, which asks the server to run four stages, one after the other, through the Search connector's `run_job_search` tool:
   - **Recheck:** opens every found role's advert and marks it Active, Almost Gone or Closed. It also checks your watched and applied roles, but only reports on them.
   - **Companies:** reads the job lists of the 12 companies checked longest ago.
   - **Job sites:** searches Indeed, LinkedIn and Glassdoor for each role and place you want.
   - **LinkedIn posts:** finds recent posts from people hiring.
2. **The server** filters the results with your Search Preferences, leaves out anything already in Notion, saves each advert's text, and adds new roles to the **Inbox** view.
3. **Claude** then:
   - reads your comments on roles and turns them into notes in the **Claude Memory** view, replying under each;
   - reviews every Inbox role (rejecting non-jobs and duplicates, and filling in the summary, fit, positives and negatives);
   - reads careers pages the server couldn't;
   - and ends with a summary, including what it cost.

Reviewed roles appear in the **Open Roles** view.

## When you pick a role

Type `/job-pick` with the role. Claude researches it (interviews, reviews, company health, pay), writes a tailored CV from your CV page, saves both on the role's page and moves it to your applications with Status "Watch". See [the skills guide](../skills-guide.md).

## Giving feedback

- Leave a comment on a role's Notion page, or tell Claude in any conversation (for example "remember I don't want agency roles").
- Claude saves it as a Memory note and uses it from the next run. To pause a note, untick Active in the Claude Memory view.
- Your Search Preferences are yours: Claude never changes them.

## Costs

- **Server, through Composio:** about $0.0008 a page read, $0.00025 to $0.001 a search. A normal day is a few US cents.
- **Search connector:** only when Claude reads careers pages the server couldn't, or a search stage failed.
- Each day's costs are in Claude's summary and in the run log (Supabase, `job_search_runs`).

## More detail

- Setting it up: [`setup.md`](setup.md)
- The full plan and design decisions: [`plan.md`](plan.md)
- The server code: [`connector/lib/jobs/`](../../connector/lib/jobs)
