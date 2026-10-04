# Composio version of the skill

A second version of the skill, `.claude/skills/web-research-composio/`, reaches Exa, Reddit, Parallel and (optionally) X through Composio instead of separate connectors. Tested on 4 October 2026 in a Claude Code cloud session.

## Setup

1. Add the Composio connector at [claude.ai/customize/connectors](https://claude.ai/customize/connectors) if it isn't there already.
2. In Composio, connect these toolkits (Claude can give you sign-in links: ask it to "connect Parallel in Composio"):
   - **Exa** (connected)
   - **Reddit** (connected)
   - **Parallel** (connected)
   - **Twitter**: optional, see "X (Twitter)" below
3. Switch off one of the two skills, so Claude doesn't follow two sets of rules:
   - Claude Code: delete or move the folder you don't want from `.claude/skills/`.
   - Claude app: upload only one of the two zipped folders.
4. Switch off built-in web search as described in `setup.md`.

## What the testing found

### Reddit: replaces Parallel for Reddit

- **Comments come back every time,** with upvote scores. Parallel's connector returned only the original post in 5 out of 6 thread reads.
- **Search only works well inside a subreddit.** Reddit's own search matches words, not meaning. "blender boolean shading artifacts fix" across all of Reddit returned a Murder Drones face rig and a Unity article. `subreddit:blenderhelp boolean modifier shading` returned 5 on-topic posts.
- **Results can't be trimmed.** 5 posts came to about 10,000 tokens, similar to a Parallel search.
- Counts as a normal Composio tool call (no extra charge).

### LinkedIn: can't search

- The Composio `linkedin` toolkit only works on your own account: your profile, posting, and company pages you manage. It has no people search and no job search.
- LinkedIn job search isn't available anywhere in Composio. Third-party scrapers (Apify) offer paid LinkedIn profile search, but they scrape LinkedIn against its terms.
- Keep using Exa: `category: "people"` for profiles, and job-listing searches as before.

### X (Twitter): cleaner, but needs setup and costs money per post

- `TWITTER_RECENT_SEARCH` returns structured posts (text, date, likes, author) that you choose field by field. This should be much more compact than Parallel's results, which included profile pages and cookie banners. Not yet tested.
- **Limits:**
  - Only the last 7 days.
  - Since February 2026 you must create your own X developer app and add its keys to Composio ([guide](https://composio.dev/auth/twitter)).
  - X charges your developer account about $0.005 per post returned and $0.01 per profile. A 15-post search costs about $0.08 to $0.23.
- The skill uses Parallel for X unless the Twitter toolkit is connected.

### Composio's premium search and scraping tools: not used

- "Premium tools" are tools where Composio pays the provider with its own account and passes on the cost plus a 5% fee. Approximate prices: Exa search $0.008, Exa page read $0.001, Tavily $0.008, SerpAPI $0.011. The free plan includes $2 a month of these ([Composio pricing](https://composio.dev/pricing)).
- The `composio_search` toolkit is Exa underneath, with fewer controls: no date or site filters, no highlights question, and no PDFs.
- The current setup connects Exa and Parallel with your own accounts, so it's billed by them directly and counts only as normal Composio tool calls (20,000 a month on the free plan).

### Exa through Composio: works well

- The tools can be called directly, without Composio's "find tool" step.
- Searches with a highlights question come back trimmed, as before.
- **Reading a document with a question now works directly** (`EXA_GET_CONTENTS_ACTION`), so the "pin the address in a search" workaround isn't needed. It returned the exact figures asked for from an ACM PDF.
- YouTube transcripts work. One read came back with an unrelated person's profile attached; the skill tells Claude to ignore those.
- The Exa Agent returns straight away and needs checking back for the answer. A minimal run finished in about 5 seconds.
- **Big results are moved.** Composio moves large results to a file in its own workspace and shows only a preview. Claude then needs one more step to pull out the parts it needs.

### Parallel through Composio: tested

Connected and tested on X, Glassdoor and Trustpilot (4 October 2026). The size cap (`max_chars_total`) holds, the site filter kept every result on the target site, and Glassdoor came back with ratings and dated reviews. X results were thin. Trustpilot's star breakdown came back garbled. Composio shows no cost for Parallel, only usage lines. Details in `docs/test-results-composio.md`.

### Still to test

- The X toolkit (`TWITTER_RECENT_SEARCH`), if you set it up. Parallel's X results were thin in testing, so this is the most likely improvement.
- Parallel `mode` options (`turbo`, `fast`, `basic`, `advanced`): every test left it unset.
- The `jq` line in `references/exa.md` that pulls DOIs out of moved paper results.
- A second, unrelated set of test prompts, because several skill examples match the first set.
