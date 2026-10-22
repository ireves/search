# Job search: setup

What you need to do once so the daily job search can run. The plan is in [plan.md](plan.md).

## 1. Give the server access to Notion

1. Open [Notion's integrations page](https://www.notion.so/profile/integrations) and choose **New integration**.
   - Name: `Job search`.
   - Type: **Internal**.
   - Workspace: the one with Open Roles.
2. On the integration's **Capabilities** tab, tick **Read content** and **Update content**. Leave **Insert content** ticked too (later phases add new rows). Comments and user information aren't needed.
3. Copy the **Internal integration secret** (it starts with `ntn_`). Don't paste it into a chat.
4. Share two pages with the integration:
   - Open the **Open Roles** page, choose **•••** (top right) > **Connections**, and add `Job search`. This covers Search Preferences.
   - Do the same on the **Job Applications** page. It's a separate page, so it needs its own connection.
   - Don't share the CV ("Experience") page. Only Claude reads it.
5. Open the connector's [settings page](https://search-connector.vercel.app/settings), sign in, and save the secret under **Notion integration token (job search)** (`NOTION_TOKEN`).

## 2. Try a dry run

1. Stay signed in on the settings page.
2. Open [search-connector.vercel.app/jobs](https://search-connector.vercel.app/jobs) in the same browser.
   - It checks every found role's advert and shows what it would change. Nothing is written to Notion.
   - It can take a minute or two.
3. If the report looks right, **Run for real** writes those changes to Notion.

## 3. The scheduled run (set up after the dry run looks right)

1. In Vercel, open the `search-connector` project > **Settings** > **Environment Variables**.
2. Add `CRON_SECRET` for Production, with a long random value (at least 16 characters). Vercel sends it with each scheduled run, and the server refuses any run without it.
3. The schedule itself is added to `connector/vercel.json` in a later change, once you've approved the dry run.

## 4. Run log clean-up (one line, optional)

The run log tables are already in Supabase. To delete run records older than 90 days automatically, paste this into the Supabase project's **SQL editor** and choose **Run**:

```sql
select cron.schedule('job-search-runs-cleanup', '23 3 * * *', $$delete from public.job_search_stages where at < now() - interval '90 days'; delete from public.job_search_runs where at < now() - interval '90 days'$$);
```

## Limits that shape the design

Checked on 22 October 2026 in [Vercel's cron docs](https://vercel.com/docs/cron-jobs/usage-and-pricing) and [function duration docs](https://vercel.com/docs/functions/configuring-functions/duration):

- **Hobby plan:** scheduled runs at most once a day, and they can start up to 59 minutes after the set time. Each function call can run for at most 300 seconds.
- **Pro plan:** runs as often as once a minute, on time, for up to 800 seconds.

The server is built for the Hobby limits. Each stage stops starting new checks after 200 seconds, and later stages get their own daily schedule if one call can't fit them all.
