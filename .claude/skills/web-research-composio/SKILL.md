---
name: web-research-composio
description: Web search and research through Composio (Exa, Reddit and Parallel toolkits) instead of Claude's built-in web search and web fetch. Use this whenever you need information from the web - current facts, prices, releases, documentation, software help (Blender, Figma, DaVinci Resolve and similar), product recommendations, Reddit or X discussions, employer reviews, design research, case studies, academic papers, PDFs, job listings, people or companies - or need to read a link, document or YouTube video. Use it even when the user doesn't say "search", and whenever you would otherwise reach for built-in web search. Requires the Composio connector.
---

# Web research through Composio

This is the Composio version of the `web-research` skill. If both are installed, keep only one switched on so Claude doesn't see two sets of rules.

Exa is the main tool for everything it can reach. The other services are used **only for sources Exa can't find or read**:

| Source | Service (Composio toolkit) |
|---|---|
| Everything Exa can reach (most of the web, PDFs, YouTube, people, companies) | Exa (`exa`) |
| Reddit | Reddit (`reddit`) |
| X (Twitter), Glassdoor, detailed Trustpilot pages, pages Exa can't read | Parallel (`parallel`) |

Never fall back to built-in web search or web fetch. If a toolkit is missing or failing, say so (see "Errors").

## How to call Composio

1. **Call tools directly.** Use `COMPOSIO_MULTI_EXECUTE_TOOL` with the tool names in this skill (for example `EXA_SEARCH`). There is no need to call `COMPOSIO_SEARCH_TOOLS` first. Only use it if a tool name comes back as unknown (Composio may have renamed it).
2. **Batch independent calls.** Put an Exa search and a Reddit search in the same `tools` list so they run at once. Only batch calls that don't depend on each other's results.
3. **Always set `sync_response_to_workbench: false`.** It doesn't stop a large result being moved (see 4).
4. **Large results get moved.** If a result is too big, Composio saves it to a file in its own remote workspace and shows only a preview. Don't read the whole file: use `COMPOSIO_REMOTE_BASH_TOOL` with `jq` to pull out only the fields you need (titles, links, the relevant text). Prevent this by keeping result limits small (Step 3).
5. **Don't use the `composio_search` toolkit** (`COMPOSIO_SEARCH_WEB`, `COMPOSIO_SEARCH_FETCH_URL_CONTENT` and similar), the `linkedin` toolkit (it only manages the user's own account) or the `twitter` toolkit (not set up).

The Composio tools carry a prefix that depends on how the user named the connector (for example `Composio__COMPOSIO_MULTI_EXECUTE_TOOL`). Match on the part after the prefix.

## Step 1: Plan before searching

1. Work out today's date from the environment. Turn any relative time ("recent", "last month", "this year") into exact dates and use the user's window, not an example's. Never reuse dates or version numbers from examples; check them first.
2. Break the question into the specific facts a good answer needs (usually 2 to 5). This list drives the confidence check in Step 4.
3. Size the job:
   - **Simple** (one fact, one known page): one search or one read, plus one confirming read if it's a "latest" fact (see Step 4). No helpers.
   - **Moderate** (a few facts, one topic, up to about 4 searches): do the searches yourself.
   - **Heavy** (a "compare the top N" or "find all" list, more than about 4 searches, or more than 2 long documents): helper agents if available (Step 5); otherwise an Exa Agent at `auto` with a $1 budget, plus Reddit for any community opinion.

## Step 2: Pick the tool

| Job | Tool |
|---|---|
| Any general search (default) | `EXA_SEARCH` |
| Design research, case studies, academic papers | `EXA_SEARCH` only |
| Job listings | `EXA_SEARCH` with a date filter and a fresh download, then a fresh read of the best few (see `references/exa.md`) |
| People, companies, personal blogs, financial reports | `EXA_SEARCH` with a `category`. `category: "people"` returns LinkedIn profile data even though LinkedIn pages can't be opened |
| Read a specific link, long document or PDF | `EXA_GET_CONTENTS_ACTION` with a highlights question. Backup: `PARALLEL_EXTRACT_WEB_CONTENT` |
| YouTube video (full transcript) | `EXA_GET_CONTENTS_ACTION` with a text limit |
| Multi-step research, lists, comparisons, enrichment | `EXA_CREATE_AGENT_RUN` (or helpers, Step 5) |
| Reddit threads and comments | `REDDIT_SEARCH_ACROSS_SUBREDDITS`, then `REDDIT_RETRIEVE_POST_COMMENTS` |
| X posts | `PARALLEL_SEARCH_WEB` limited to `x.com` |
| Glassdoor, Trustpilot detail | `PARALLEL_SEARCH_WEB` limited to the site, then `PARALLEL_EXTRACT_WEB_CONTENT` |
| Opening LinkedIn pages, LinkedIn job search, Quora, pages behind a login | None of these can. Say so, then offer or run Reddit and Exa (blogs, forums) on the same question, and say that is what you did. For LinkedIn profile details try Exa `category: "people"` |

### When to add Reddit or Parallel (Exa-blind sources only)

Add these **alongside** Exa, in the same batched call, whenever the question would benefit:

| Question type | Source |
|---|---|
| Software help and troubleshooting | Reddit, in the app's help subreddit |
| "Is X worth it?", product or tool recommendations, buying advice | Reddit |
| Real-world experience: careers, salaries, courses, freelancing, employers, hobbies, travel, local tips | Reddit |
| Community reaction to a release, update, announcement or controversy | X (Parallel), then Reddit |
| What creators, developers or official accounts are posting right now | X (Parallel) |
| What it's like to work somewhere | Glassdoor (Parallel), plus Reddit |
| A company's detailed review score, rating breakdown and dated reviews | Trustpilot (Parallel) |
| Exa refuses a page, or its extracts are thin or broken | Parallel (backup reader) |

Rules:
- **Reddit: search inside one subreddit with 2 to 4 keywords** (`subreddit:<name> <keywords>`). Reddit's own search matches words, not meaning: across all of Reddit it returns unrelated posts, and long queries return nothing. If you don't know the subreddit, find it with `REDDIT_GET_SUBREDDITS_SEARCH`, or batch searches in two likely ones.
- **If no Reddit result matches the question,** try one different wording or subreddit, then say Reddit had nothing useful. Don't read comments from an off-topic thread.
- **Reddit comments** come from `REDDIT_RETRIEVE_POST_COMMENTS`, which needs the post `id` from the search, so it is always a second call. Read only the one or two most promising threads.
- **Parallel: always limit to the target site** with `advanced_settings.source_policy.include_domains`, always set `max_chars_total`, use at most 2 `search_queries` per call and at most 2 searches per question (page reads don't count). Ignore any result that isn't about the question.
- **X searches:** first settle which announcement or release the user means (Exa, with its date) and say which you chose. Write queries the way a user would post, not as a product name (product names return mostly the official account). Then search Exa for news articles that embed X posts: these often carry the best reactions.
- For software help, Reddit is a supplement: forums and official docs from Exa usually carry the fix. Keep it to one Reddit search (plus one retry) unless the user asks about community experience.
- Exa can reach Hacker News, Facebook groups, Instagram and TikTok captions, Threads, Bluesky, Steam, App Store and Amazon reviews, YouTube, Substack, Medium, Stack Overflow and major news sites. Don't use Parallel for those.
- Skip Reddit and Parallel when Exa already answers the question well and community opinion adds nothing (a version number, a definition, an official spec).

Full settings, recipes and quirks: `references/exa.md`, `references/reddit.md` and `references/parallel.md`. Read the relevant file before your first call to that service in a conversation.

### The default Exa search (memorise this shape)

```json
{"tool_slug": "EXA_SEARCH",
 "arguments": {
   "query": "<a description of the ideal page, not keywords>",
   "numResults": 8,
   "contents": {"highlights": {"query": "<the specific facts you need from each page>", "maxCharacters": 1200}}
 }}
```

Never add `contents.text` to a search: it returns the full text of every page.

### Reading one known document with Exa

```json
{"tool_slug": "EXA_GET_CONTENTS_ACTION",
 "arguments": {
   "urls": ["<the link>"],
   "text": false,
   "highlights": {"query": "<the precise question you need answered from it>", "maxCharacters": 3500}
 }}
```

`text: false` is essential: this tool returns the full page text unless told not to. Check `statuses` in the result: a failed page still returns "successful" overall. For pages that change (prices, downloads, job listings), add `maxAgeHours: 0` at the top level of `arguments`.

## Step 3: Keep the context small

These rules apply everywhere, including normal Claude chats with no helper agents.

- **Exa searches:** highlights with a question, 500 to 1,500 characters per result (500 for job listings), 5 to 10 results, never more than 15. People searches: 3 results (each carries a long profile block). Paper searches: 6 results.
- **Reddit:** search `limit: 5`; comment reads `limit: 8` to `10`, `depth: 1` (2 when replies matter) and `sort: "top"`. Neither can be trimmed further.
- **Parallel:** `max_chars_total` of 6,000 for a search and 4,000 for a read.
- **Read only when extracts aren't enough,** and only the one or two most promising pages.
- **YouTube transcripts:** `text: {"maxCharacters": 3000 to 8000}`. If the transcript fills the whole limit, it was probably cut off: say so, or read again with a higher limit (up to about 20,000) if the ending matters.
- **Heavy reading goes to an Exa Agent** (`EXA_CREATE_AGENT_RUN`). It searches and reads on Exa's servers and returns a cited answer, using none of the user's Claude allowance. Effort: `minimal` for a few sources, `low` for a short list of known scope, `auto` with a $1 `budget` for "compare the top N" and open-ended research (see `references/exa.md` for the call shape and waiting).
- Don't repeat large tool output back to the user. Quote only what supports the answer.

## Step 4: Confidence check (do this before answering)

Search results are close matches, not proof. After each round:

1. Tick off which planned facts now have a source, and which are still missing or rest on a single weak source.
2. If gaps remain, try these in order and stop once covered:
   - **Different angle,** not a synonym swap (for example practitioner view, official docs, a complaint or bug report, a newer date range). Batch several angles as separate `EXA_SEARCH` calls in one execute call.
   - **The other services, within their lanes.** If opinion or experience is missing, add Reddit, X or Glassdoor. If facts, papers or listings are missing, widen Exa (new filters, `category`, another angle).
   - **Read the best page** with a focused question when an extract hints at the answer but is cut off.
   - **Exa Agent** when the question clearly needs many steps.
3. Back up key facts (numbers, dates, prices, versions) with two independent sources where possible.
4. **"Latest" facts need the official page.** For the current version, price, availability or status of something, read the official page with `maxAgeHours: 0`. Exa's stored copies can lag behind the live page. If the official address is obvious, batch the search and the read.
5. **Prices:** state the currency, whether tax is included and the billing period. If the page shows another currency, say so and don't convert. Check prices from an Exa Agent on the official pages too.
6. **Software instructions:** check the app version against each source's date. Advice from before a major release may describe settings that no longer exist. If most sources are over a year old, add a search of the current manual or release notes (`includeDomains` set to the vendor's docs site).
7. **Stopping rule:** about 3 rounds. Then answer with what you have and list what you couldn't confirm. Never guess to fill a gap.

Search tips:
- **Date filters** suit news, jobs, releases and prices. For troubleshooting, avoid them: the definitive answer (often a staff reply or a manual page) can be years old.
- A result with no date, or only a year, is "undated". Don't guess how recent it is.
- When sources disagree, order them by date and report the trend.

## Step 5: Helper agents (Claude Code and Claude Cowork only)

Use helpers when the job is heavy: more than about 4 searches, more than 2 long documents, or a comparison or list across many sources. Don't use them for simple lookups; each helper starts from scratch and uses extra allowance.

- Available when you have a subagent tool (called Agent or Task). Normal claude.ai chats and the mobile app don't have one: use an Exa Agent for heavy work there instead.
- Use the smallest capable model for helpers (Haiku) unless the task needs careful judgement.
- Split the work by angle or sub-question, not by synonym. Aim for 3 to 5 searches per helper. Launch independent helpers together in one message.
- Each helper must return compact output only (facts with source links, plus gaps). Use the template in `references/helpers.md`.
- Merge the results, remove duplicate sources, then run the Step 4 check on the combined findings.

## Step 6: Answer

- Lead with the answer. Link sources inline with descriptive link text.
- **Link the original source,** never Exa's own library pages (`exa.ai/library/...`). For papers, use the DOI or publisher page (see `references/exa.md`); if there's none, say no original link was found.
- For Reddit, link the thread (add `https://www.reddit.com` to relative `/r/...` links), and say how many upvotes or comments backed a view when it matters.
- Mark confidence where it matters:
  - **well supported**: two or more independent sources agree (mirrors of one page count once),
  - **primary source**: straight from the thing itself (the paper, the transcript, the official page). Claims on a company's or author's own site about their own results are "primary source, self-reported",
  - **single source**: only one secondary source says it,
  - **unconfirmed**: implied or partly stated.
  Recheck helper labels against these before using them.
- Cite only pages you read successfully (check `statuses`); if a fresh read failed but a stored extract gave the figure, say so. Don't add figures or claims no source gave. Keep figures and opinions apart, date each figure, and say when a transcript was cut off. Don't call a mood "overwhelming" from a handful of posts.
- Say what you couldn't find or reach (for example a LinkedIn page or a login page).
- **People who share a name:** confirm you have the right person before reporting details. If a private individual turns up by mistake, mention only enough to avoid confusion.
- For job listings, say whether you confirmed each listing is still open.
- Never describe results as complete or exhaustive unless the set is small, clearly bounded and checked.

## Errors

- **"No active connection" for a toolkit:** call `COMPOSIO_MANAGE_CONNECTIONS` with that toolkit's name (`exa`, `reddit` or `parallel`) and give the user the sign-in link it returns as a clickable link. Carry on with the other services meanwhile, and say you did.
- **Rate limit (HTTP 429):** Reddit allows about 1 to 2 requests a second. Wait briefly and retry once, or carry on without it.
- **The Composio connector is missing:** tell the user to add it at claude.ai/customize/connectors. Don't switch to built-in web search.
- **Neither service can reach a page:** say so plainly. Don't switch to built-in web fetch.
