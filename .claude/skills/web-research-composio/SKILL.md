---
name: web-research-composio
description: Web search and research through Composio (Exa, Reddit, Parallel and optionally X/Twitter toolkits) instead of Claude's built-in web search and web fetch. Use this whenever you need information from the web - current facts, prices, releases, documentation, software help (Blender, Figma, DaVinci Resolve and similar), product recommendations, Reddit or X discussions, employer reviews, design research, case studies, academic papers, PDFs, job listings, people or companies - or need to read a link, document or YouTube video. Use it even when the user doesn't say "search", and whenever you would otherwise reach for built-in web search. Requires the Composio connector.
---

# Web research through Composio

This is the Composio version of the `web-research` skill. If both are installed, keep only one switched on so Claude doesn't see two sets of rules.

Exa is the main tool for everything it can reach. The other services are used **only for sources Exa can't find or read**:

| Source | Service (Composio toolkit) |
|---|---|
| Everything Exa can reach (most of the web, PDFs, YouTube, people, companies) | Exa (`exa`) |
| Reddit | Reddit (`reddit`) |
| X (Twitter) | Parallel (`parallel`), or X (`twitter`) if the user has set it up |
| Glassdoor, detailed Trustpilot pages, pages Exa can't read | Parallel (`parallel`) |

Never fall back to built-in web search or web fetch. If a toolkit is missing or failing, say so (see "Errors").

## How to call Composio

1. **Call tools directly.** Use `COMPOSIO_MULTI_EXECUTE_TOOL` with the tool names in this skill (for example `EXA_SEARCH`). There is no need to call `COMPOSIO_SEARCH_TOOLS` first. Only use it if a tool name comes back as unknown (Composio may have renamed it).
2. **Batch independent calls.** Put an Exa search and a Reddit search in the same `tools` list so they run at once. Only batch calls that don't depend on each other's results.
3. **Always set `sync_response_to_workbench: false`.**
4. **Large results get moved.** If a result is too big, Composio saves it to a file in its own remote workspace and shows only a preview. Don't read the whole file: use `COMPOSIO_REMOTE_BASH_TOOL` with `jq` to pull out only the fields you need (titles, links, the relevant text). Prevent this by keeping result limits small (Step 3).
5. **Don't use the `composio_search` toolkit** (`COMPOSIO_SEARCH_WEB`, `COMPOSIO_SEARCH_FETCH_URL_CONTENT` and similar). It runs Exa without date, site or highlight controls, can't read PDFs, and is charged against Composio's small monthly "premium tools" allowance.

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
| Job listings | `EXA_SEARCH`, with a published-date filter and a fresh download |
| People, companies, personal blogs, financial reports | `EXA_SEARCH` with a `category`. `category: "people"` returns LinkedIn profile data (headline, work history, profile URL) even though LinkedIn pages can't be opened |
| Read a specific link, long document or PDF | `EXA_GET_CONTENTS_ACTION` with a highlights question (recipe below). Backup: `PARALLEL_EXTRACT_WEB_CONTENT` |
| YouTube video (full transcript) | `EXA_GET_CONTENTS_ACTION` with a text limit |
| Multi-step research, lists, comparisons, enrichment | `EXA_CREATE_AGENT_RUN` (or helpers, Step 5) |
| Reddit threads and comments | `REDDIT_SEARCH_ACROSS_SUBREDDITS`, then `REDDIT_RETRIEVE_POST_COMMENTS` |
| X posts | `PARALLEL_SEARCH_WEB` limited to `x.com`, or `TWITTER_RECENT_SEARCH` if set up (last 7 days only) |
| Glassdoor, Trustpilot detail | `PARALLEL_SEARCH_WEB` limited to the site, then `PARALLEL_EXTRACT_WEB_CONTENT` |
| Opening LinkedIn pages, LinkedIn job search, Quora, pages behind a login | None of these can. Say so (but try Exa `category: "people"` for profile details). The Composio `linkedin` toolkit only manages the user's own account and posts; it can't search |

### When to add Reddit, X or Parallel (Exa-blind sources only)

Add these **alongside** Exa, in the same batched call, whenever the question would benefit:

| Question type | Source | Example |
|---|---|---|
| Software help and troubleshooting (Blender, Figma, Resolve, games, coding tools) | Reddit, in the right subreddit | `subreddit:blenderhelp boolean modifier shading` |
| "Is X worth it?", product or tool recommendations, buying advice | Reddit | `subreddit:blender drawing tablet sculpting` |
| Real-world experience: careers, salaries, courses, freelancing, studios, hobbies, travel, local tips | Reddit | `subreddit:vfx framestore junior` |
| Community reaction to a release, update, announcement or controversy | X, then Reddit | Parallel query `blender 5.2` limited to `x.com` |
| What creators, developers or official accounts are posting right now | X | Parallel query `figma config announcement` limited to `x.com` |
| What it's like to work somewhere | Glassdoor (Parallel) | `framestore reviews` limited to `glassdoor.co.uk` |
| A company's detailed review score, rating breakdown and dated reviews | Trustpilot (Parallel) | read `trustpilot.com/review/<site>` |
| Exa refuses a page, or its extracts are thin or broken | Parallel (backup reader) | `PARALLEL_EXTRACT_WEB_CONTENT` with an objective |

Rules:
- **Reddit search works best inside one subreddit, with 2 to 4 keywords.** Reddit's own search matches words, not meaning. Across all of Reddit it returned unrelated posts in testing; inside `subreddit:name` it was usually on topic, but not always (a niche question returned popular, unrelated posts; a 5-keyword query returned nothing). If you don't know the subreddit, find it with `REDDIT_GET_SUBREDDITS_SEARCH` first, or batch searches in two likely subreddits.
- **If no result matches the question,** try one different wording or subreddit, then say Reddit had nothing useful. Don't read comments from an off-topic thread.
- **Reddit comments come back reliably** with `REDDIT_RETRIEVE_POST_COMMENTS` (unlike Parallel). Read only the one or two most promising threads. The comment read depends on the post `id` from the search, so it is always a second call.
- **Limit Parallel to the target site** with `advanced_settings.source_policy.include_domains`. If a result isn't on that site, ignore it.
- **Keep Parallel small:** always set `max_chars_total` (6,000 for a search) and at most 2 `search_queries` per call, and at most 2 Parallel searches per question. Page reads (`PARALLEL_EXTRACT_WEB_CONTENT`) don't count towards the 2.
- **X searches:** write the queries the way a user would post ("just updated to blender 5.2", "blender 5.2 is broken"). Product-name queries return mostly the official account.
- For software help, Reddit is a supplement: forums and official docs from Exa usually carry the fix. Keep it to one Reddit search (plus one retry if it found nothing relevant) unless the user asks about community experience.
- Exa can reach Hacker News, Facebook groups, Instagram and TikTok captions, Threads, Bluesky, Steam, App Store and Amazon reviews, YouTube, Substack, Medium, Stack Overflow and major news sites. Don't use Parallel for those.
- Skip Reddit, X and Parallel when Exa already answers the question well and community opinion adds nothing (a version number, a definition, an official spec).

Full settings, recipes and quirks: `references/exa.md`, `references/reddit.md`, `references/parallel.md` and `references/x.md`. Read the relevant file before your first call to that service in a conversation.

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
   "urls": ["https://dl.acm.org/doi/pdf/10.1145/3359183"],
   "text": false,
   "highlights": {"query": "<the precise question you need answered from it>", "maxCharacters": 3500}
 }}
```

`text: false` is essential: this tool returns the full page text unless told not to. Check `statuses` in the result: a failed page still returns "successful" overall. For pages that change (a download page, prices, job listings), add `maxAgeHours: 0` at the top level of `arguments`.

## Step 3: Keep the context small

These rules apply everywhere, including normal Claude chats with no helper agents.

- **Exa searches return trimmed extracts only:** highlights with a question, 500 to 1,500 characters per result (500 for job listings), 5 to 10 results. Never more than 15 results in one call. People searches (`category: "people"`) carry a profile block of 2,000 to 6,000 characters per result that highlights can't shrink, so use 3 results. Expect about 1,500 to 2,000 characters per result in ordinary searches, so two 8-result searches come to about 17,000 characters. Paper searches (`category: "research paper"`) run larger and 2 searches of 8 results were moved to the remote workspace: use 6 results each, and see `references/exa.md` for the `jq` line that pulls out titles, links and DOIs.
- **Reddit searches return whole post texts and can't be trimmed.** Use `limit: 5`. Comment reads also include the whole original post: use `limit: 8` to `10`, `depth: 1` and `sort: "top"` (depth 1 shows replies only as empty "more" stubs; use 2 when replies matter).
- **Parallel:** always set `max_chars_total`; at most 2 queries per call and 2 calls per question.
- **Read only when extracts aren't enough,** and only the one or two most promising pages. Use 3,000 to 4,000 characters of highlights for one document.
- **YouTube transcripts:** set `text: {"maxCharacters": 3000 to 8000}`. If the transcript fills the whole limit, it was probably cut off: say the summary may miss the end, or read again with a higher limit (up to about 20,000) if the ending matters. A transcript shorter than the limit that ends with a sign-off is complete. The video description (and any links in it) is not included: say so if the user needs them.
- **Heavy reading goes to an Exa Agent** (`EXA_CREATE_AGENT_RUN`). It searches and reads on Exa's servers and returns a cited answer, using none of the user's Claude allowance. Effort: `minimal` for a few sources, `low` for a short list of known scope, `auto` with a $1 `budget` for "compare the top N" and open-ended research (see `references/exa.md`).
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
4. **"Latest" facts need the official page.** For the current version, price, availability or status of something, read the official page (download page, pricing page, release list) with `maxAgeHours: 0` to confirm, rather than relying on announcements or news that may be out of date. Exa's stored search extracts can lag behind the live page (a release page showed 5.2.0 while the live download page showed 5.2.2). If the official address is obvious, batch the search and the read in one call. For "since which version" facts, the release notes are the best source.
   - **Software instructions:** check the app version against the date of each source. Advice from before a major release may describe removed settings (Blender's Auto Smooth checkbox went in 4.1). If most sources are older than a year, add a search of the current manual.
5. **Stopping rule:** about 3 rounds. Then answer with what you have and list what you couldn't confirm. Never guess to fill a gap.

Search tips that came out of testing:
- **Date filters** suit news, jobs, releases and prices. For troubleshooting, avoid them or keep them loose: the definitive answer (often a staff reply or a manual page) can be years old.
- Some results have no `publishedDate`, or only a year (01-01). Say "undated" and don't infer how recent they are.
- When sources disagree (for example older staff replies saying "expected" and a newer one saying "bug"), order them by date and report the trend.
- Reddit search has no exact dates, only `time_filter` (`day`, `week`, `month`, `year`, `all`).

## Step 5: Helper agents (Claude Code and Claude Cowork only)

Use helpers when the job is heavy: more than about 4 searches, more than 2 long documents, or a comparison or list across many sources. Don't use them for simple lookups; each helper starts from scratch and uses extra allowance.

- Available when you have a subagent tool (called Agent or Task). Normal claude.ai chats and the mobile app don't have one: use an Exa Agent for heavy work there instead.
- Use the smallest capable model for helpers (Haiku) unless the task needs careful judgement.
- Split the work by angle or sub-question, not by synonym. Aim for 3 to 5 searches per helper. Launch independent helpers together in one message.
- Each helper must return compact output only (facts with source links, plus gaps). Use the template in `references/helpers.md`.
- Merge the results, remove duplicate sources, then run the Step 4 check on the combined findings.

## Step 6: Answer

- Lead with the answer. Link sources inline with descriptive link text.
- **Link the original source.** Exa sometimes returns its own library pages (`exa.ai/library/...`) for papers and people. Link the paper, publisher, DOI or official page instead (the DOI is in the result's `entities[0].properties`, see `references/exa.md`). If there is no DOI, search the title on the likely publisher, or say no original link was found.
- For Reddit, link the thread (`permalink`; comment results give a relative `/r/...` path, so add `https://www.reddit.com`), and say how many upvotes or comments backed a view when it matters.
- Mark confidence where it matters:
  - **well supported**: two or more independent sources agree (mirrors of one page count once),
  - **primary source**: the answer comes straight from the thing itself (the paper, the video transcript, the official page). A case study on its author's own site is "primary source, self-reported",
  - **single source**: only one secondary source says it,
  - **unconfirmed**: implied or partly stated.
  Recheck helper labels against these before using them.
- Say what you couldn't find or reach (for example a LinkedIn profile or a login page).
- **People who share a name:** confirm you have the right person before reporting details. If a private individual turns up by mistake, mention only enough to avoid confusion.
- For job listings, say whether you confirmed each listing is still open.
- Never describe results as complete or exhaustive unless the set is small, clearly bounded and checked.

## Errors

- **"No active connection" for a toolkit:** call `COMPOSIO_MANAGE_CONNECTIONS` with that toolkit's name (`exa`, `reddit`, `parallel` or `twitter`) and give the user the sign-in link it returns as a clickable link. Carry on with the other services meanwhile, and say you did.
- **Rate limit (HTTP 429):** Reddit allows about 1 to 2 requests a second. Wait briefly and retry once, or carry on without it.
- **The Composio connector is missing:** tell the user to add it at claude.ai/customize/connectors. Don't switch to built-in web search.
- **Neither service can reach a page:** say so plainly. Don't switch to built-in web fetch.
