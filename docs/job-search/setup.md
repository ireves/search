# Job search: setup

What you need to do once so the daily job search can run. The plan is in [plan.md](plan.md).

## 1. Give the server access to Notion

1. Open [Notion's integrations page](https://www.notion.so/profile/integrations) and choose **New integration**.
   - Name: `Job search`.
   - Type: **Internal**.
   - Workspace: the one with Open Roles.
2. On the integration's **Capabilities** tab, tick **Read content** and **Update content**. Leave **Insert content** ticked too (later phases add new rows). Comments and user information aren't needed.
3. Copy the **Internal integration secret** (it starts with `ntn_`). Don't paste it into a chat.
4. Open the **Job Applications** page, choose **•••** (top right) > **Connections**, and add `Job search`. That's the only page it needs: roles and applications are in Job Applications. (Your search preferences and Claude's memory are on the connector's own page, section 4.) Don't share the CV ("Experience") page; only Claude reads it.
5. Open the connector's [settings page](https://search-connector.vercel.app/settings), sign in, and save the secret under **Notion integration token (job search)** (`NOTION_TOKEN`).

## 2. Give the server access to Composio

The server reads careers pages, and adverts it can't open itself (such as Indeed's), through Firecrawl on your Composio account. It costs about $0.0008 a page, charged to your Composio balance.

1. Find your Composio Connect consumer key (it starts with `ck_`). It's the same key saved as `COMPOSIO_API_KEY` in the `composio-test` Vercel project. Don't paste it into a chat.
2. On the [settings page](https://search-connector.vercel.app/settings), save it under **Composio Connect consumer key (job search)** (`COMPOSIO_CONSUMER_KEY`).

## 3. Try a dry run

1. Stay signed in on the settings page.
2. Open [search-connector.vercel.app/jobs?stage=recheck](https://search-connector.vercel.app/jobs?stage=recheck) in the same browser.
   - It checks every found role's advert and shows what it would change. Nothing is written to Notion.
3. Then open [search-connector.vercel.app/jobs?stage=companies](https://search-connector.vercel.app/jobs?stage=companies).
   - It reads the job lists of the 12 companies checked longest ago and shows the roles it would add to the Inbox.
4. Then [job sites](https://search-connector.vercel.app/jobs?stage=job_sites) and [LinkedIn posts](https://search-connector.vercel.app/jobs?stage=linkedin_posts).
   - Job sites searches Indeed, LinkedIn and Glassdoor for each role and location you've set; LinkedIn posts looks for recent hiring posts.
5. Each stage can take a minute or two. If a report looks right, **Run for real** writes it to Notion.

## 4. Get the job search tool and skill in Claude

The job search tool, `run_job_search`, is part of the Search connector, so it uses the Search connector's sign-in. The `/job-search` skill, which comes with the search plugin, holds the daily instructions. Do this in the account the scheduled task runs in.

1. Update the search plugin, or install it if you don't have it yet.
   - In Claude, open **Customize** > **Plugins** and update or add `search` from the `ireves-search` marketplace.
   - In Claude Code, run `/plugin` and update or install `search@ireves-search`.
2. Check the Search connector is connected and signed in (**Settings** > **Connectors**).
   - Claude reads the connector's tool list when it connects. If `run_job_search` doesn't show up, disconnect the Search connector and connect it again.
3. Only the `/job-search` skill uses `run_job_search`. The tool's description and the connector's instructions tell Claude never to call it otherwise, and the skill only runs when you or the scheduled task type `/job-search`.

Your search preferences and Claude's memory notes live on the connector's own page, [search-connector.vercel.app/preferences](https://search-connector.vercel.app/preferences), not in Notion. Reading them there costs no Notion searches. Claude reads them, and saves memory notes, through the Search connector's `job_search_notes` tool. To move them from Notion, once:

1. Open [the preferences page](https://search-connector.vercel.app/preferences) and sign in with your passkey (the same one as the settings page).
2. Choose **Import from Notion**.
   - It copies every Preference and Memory row from Job Applications, including paused ones.
   - If the page already has something on it, tick **Replace what's here** first.
3. Check the page looks right. From now on, add, edit and pause preferences and notes there.
4. Once you're happy, delete the Preference and Memory rows (and the Search Preferences and Claude Memory views) in Notion. Nothing reads them any more.

## 5. Run log clean-up (one line, optional)

The run log tables are already in Supabase. To delete run records older than 90 days automatically, paste this into the Supabase project's **SQL editor** and choose **Run**:

```sql
select cron.schedule('job-search-runs-cleanup', '23 3 * * *', $$delete from public.job_search_stages where at < now() - interval '90 days'; delete from public.job_search_runs where at < now() - interval '90 days'$$);
```

## 6. Start the daily task

Follow [`scheduled-task.md`](scheduled-task.md): create the scheduled task with the prompt `/job-search`, and run it beside the old Job Finder task for a few days before switching over.

## 7. Clean up afterwards

Once the new daily task works:

1. Delete the `composio-test` project in Vercel. It holds the test page and the keys `COMPOSIO_API_KEY` and `COMPOSIO_PLATFORM_KEY`.
2. On Composio, revoke the developer platform key, which nothing uses now. Keep the Connect consumer key (`ck_...`) saved on the settings page.
3. If you added the old separate "Job search" connector (address ending `/jobs/mcp`), remove it from **Settings** > **Connectors**. It no longer works; the tool is in the Search connector now.
4. Turn off or delete the old Job Finder scheduled task.

## Limits that shape the design

Checked on 22 October 2026 in [Vercel's function duration docs](https://vercel.com/docs/functions/configuring-functions/duration): on the Hobby plan each function call can run for at most 300 seconds (800 on Pro). So each stage is its own `run_job_search` call, and each stops starting new work after 200 seconds.
