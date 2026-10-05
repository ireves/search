# Setting up the Search connector

The Search connector is one Claude connector that combines Exa and Parallel. It runs on your own Vercel account and connects straight to Claude: no Composio, and no separate Exa or Parallel connectors.

It comes with two skills:

- **web-search**: everyday searching in normal chats, replacing Claude's built-in web search. Short and light on usage.
- **deep-search**: for when you need to be sure the answer is right. Type `/deep-search` and pick **Auto** or **Deep research** (a cited report of 2 pages or less, saved as a Claude Doc).

You'll need: a Vercel account (the free plan works), an Exa account and a Parallel account.

## 1. Get your API keys

1. Exa: sign in at [dashboard.exa.ai/api-keys](https://dashboard.exa.ai/api-keys) and create a key. Exa gives $10 of free credit each month.
2. Parallel: sign in at [platform.parallel.ai](https://platform.parallel.ai) and create a key.
3. Keep both somewhere safe for step 3. You won't need the Vercel dashboard to add them.

## 2. Put the connector on Vercel (one time)

Already done for your account: the project is at [search-connector.vercel.app](https://search-connector.vercel.app) with private key storage connected. Only the admin password is left:

1. Open [the project's environment variables](https://vercel.com/iuri7/search-connector/settings/environment-variables).
2. Add `ADMIN_PASSWORD` with a password of at least 12 characters. Tick **Sensitive** so it can't be read back.
3. Ask Claude to redeploy the connector, or open **Deployments** and redeploy the latest one.

To set it up on another account, ask Claude (with the Vercel connector switched on), or:

1. Go to [vercel.com/new](https://vercel.com/new) and import the GitHub repository `ireves/search`.
2. Under **Root Directory**, choose `connector`.
3. Under **Environment Variables**, add one:
   - Name: `ADMIN_PASSWORD`
   - Value: a password of at least 12 characters. You'll type it when connecting Claude and when managing keys.
4. Select **Deploy** and wait for it to finish.
5. Add storage for your keys:
   - Open the project's **Storage** tab and select **Create**, then **Blob**.
   - Set access to **Private**, then connect it to this project.
   - Open **Deployments** and redeploy the latest one, so it picks up the storage.
6. Under **Settings**, then **Deployment Protection**, set Vercel Authentication to **Only Preview Deployments**. Otherwise Vercel puts its own login in front of the connector and Claude can't reach it.
7. Note your project's main address, shown under **Domains**, for example `https://search-yourname.vercel.app`. Use this one, not the long address of a single deployment: Vercel puts a login in front of those.

This is the only time you need the Vercel dashboard. If you ever change `ADMIN_PASSWORD`, every Claude connection signs out and saved keys need adding again.

## 3. Add your keys (no dashboard needed)

1. Open `https://<your-address>/settings` and sign in with your admin password.
2. Paste the Exa key into **Exa API key** and select **Save**. Do the same for Parallel.
3. Select **Check keys work**. Both should show **works**.

How the keys are protected:

- They're encrypted before they're stored, in private storage that only this project can read.
- Once saved, a key can be replaced or removed, but never displayed again: not on the settings page, not to Claude, not anywhere.
- The settings page only opens with your admin password, and blocks repeated wrong guesses.
- You can add other secrets the same way under **Add another secret**.

## 4. Connect Claude

### Claude apps (web, desktop, mobile) and Cowork

1. Go to [claude.ai/customize/connectors](https://claude.ai/customize/connectors) and add a custom connector.
2. Name it `Search` and paste `https://<your-address>/mcp` as the address.
3. Select **Connect**. A page from your connector opens: type your admin password and select **Connect**.
4. Remove the old Exa and Parallel connectors (and any Composio search tools), so Claude doesn't see two sets of search tools.

### Claude Code

Run this once in a terminal, then type `/mcp` inside Claude Code and sign in:

```
claude mcp add --transport http search https://<your-address>/mcp
```

## 5. Install the skills

The skills are in the `skills` folder of this repository.

### Claude apps and Cowork

1. Zip each skill folder on its own: `skills/web-search` and `skills/deep-search` (zip the folder itself, so `SKILL.md` sits inside it).
2. In Claude, open **Settings**, find **Skills** (under **Capabilities** at the time of writing) and upload each zip.
3. Custom skills need a paid plan with code execution switched on.

### Claude Code

Copy the folders into your personal skills folder:

```
cp -r skills/web-search skills/deep-search ~/.claude/skills/
```

## 6. Switch off built-in web search

So Claude always uses the connector:

1. **Claude apps:** turn off **Web search** in the chat's tools menu.
2. **Claude Code:** add this to `~/.claude/settings.json`:
   ```json
   { "permissions": { "deny": ["WebSearch", "WebFetch"] } }
   ```
3. **Personal preferences** (Settings, then Profile), as a backup. Paste:
   > For anything from the web, use the web-search skill with the Search connector. Never use built-in web search or web fetch. When I say /deep-search or ask for verified facts, use the deep-search skill.

## 7. Check it works

1. In a new chat, ask: "What's the latest version of Blender?"
   - Claude should load **web-search**, call `search`, and confirm the version on blender.org.
2. Type `/deep-search` followed by a question.
   - Claude should ask **Auto** or **Deep research** before searching.
   - With Deep research, a Claude Doc should appear first and fill in as the research progresses.

## Costs (approximate, October 2026)

| Action | Cost |
|---|---|
| A normal `search` (both engines) | about $0.008 |
| A `fetch` of one page | about $0.001 to $0.002 |
| `verify`, per claim | about $0.008 |
| `research` quick / standard / deep | about $0.03 / $0.10 / up to $1.10 |

Vercel's free plan covers personal use of the connector itself.

## Problems

| What you see | What to do |
|---|---|
| "has no API key" | Add the key on the settings page. |
| "rejected the API key" or "out of credit" | Replace the key, or top up the account with Exa or Parallel. |
| "Storage not connected" on the settings page | Connect a private Blob store (step 2, sub-step 5). |
| Claude asks you to reconnect | Normal after "Sign out all connections" or a password change. Reconnect in Claude's connector settings. |
| "Setup needed" page | `ADMIN_PASSWORD` is missing or shorter than 12 characters. Add it in Vercel and redeploy. |
