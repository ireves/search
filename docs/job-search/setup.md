# Job search: setup

What you need to do once so the daily job search can run. The plan is in [plan.md](plan.md).

## 1. Give the server access to Notion

1. Open [Notion's integrations page](https://www.notion.so/profile/integrations) and choose **New integration**.
   - Name: `Job search`.
   - Type: **Internal**.
   - Workspace: the one with Open Roles.
2. On the integration's **Capabilities** tab, tick **Read content** and **Update content**. Leave **Insert content** ticked too (later phases add new rows). Comments and user information aren't needed.
3. Copy the **Internal integration secret** (it starts with `ntn_`). Don't paste it into a chat.
4. Open the **Job Applications** page, choose **•••** (top right) > **Connections**, and add `Job search`. That's the only page it needs: roles, applications, search preferences and Claude's memory are all in Job Applications. Don't share the CV ("Experience") page; only Claude reads it.
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
4. Each stage can take a minute or two. If a report looks right, **Run for real** writes it to Notion.

## 4. Add the Job search connector to Claude

The daily Claude scheduled task starts the server's runs through this connector. There is no other schedule.

The connector comes with the search plugin (it's listed in the plugin's `.mcp.json` as `job-search`), so you don't add it by hand. Do this in the account the scheduled task runs in.

1. Update the search plugin, or install it if you don't have it yet.
   - In Claude, open **Customize** > **Plugins** and update or add `search` from the `ireves-search` marketplace.
   - In Claude Code, run `/plugin` and update or install `search@ireves-search`.
2. Connect it.
   - In Claude, open the search plugin's **Connectors** tab and choose **Connect** for `job-search`.
   - In Claude Code it connects with the plugin, and `/mcp` lists it as `plugin:search:job-search`.
3. Sign in when Claude asks, with your passkey or admin password, as for the Search connector.
4. It has one tool, `run_job_search`. Only the job search scheduled task should use it.

If the connector doesn't appear with the plugin, add it by hand instead:

1. In Claude, open **Settings** > **Connectors** > **Add custom connector**.
2. Name: `Job search`. Address: `https://search-connector.vercel.app/jobs/mcp`.
3. Choose **Connect** and sign in with your passkey or admin password.
   - Keep only one of the two (the plugin's or this one), so Claude sees the tool once.

## 5. Run log clean-up (one line, optional)

The run log tables are already in Supabase. To delete run records older than 90 days automatically, paste this into the Supabase project's **SQL editor** and choose **Run**:

```sql
select cron.schedule('job-search-runs-cleanup', '23 3 * * *', $$delete from public.job_search_stages where at < now() - interval '90 days'; delete from public.job_search_runs where at < now() - interval '90 days'$$);
```

## Limits that shape the design

Checked on 22 October 2026 in [Vercel's function duration docs](https://vercel.com/docs/functions/configuring-functions/duration): on the Hobby plan each function call can run for at most 300 seconds (800 on Pro). So each stage is its own `run_job_search` call, and each stops starting new work after 200 seconds.
