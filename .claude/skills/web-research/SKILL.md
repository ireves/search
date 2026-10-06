---
name: web-research
description: Web search and research using the Exa and Parallel connectors. Run only when the user types /web-research. Covers current facts, prices, releases, documentation, software help (Blender, Figma, DaVinci Resolve and similar), product recommendations, Reddit or X discussions, employer reviews, design research, case studies, academic papers, PDFs, job listings, people or companies, and reading a link, document or YouTube video.
disable-model-invocation: true
---

# Web research with Exa and Parallel

Exa is the main tool for everything it can reach. Parallel is used **only for sources Exa can't find or read** (Reddit, X, Glassdoor reviews, detailed Trustpilot pages) and as the backup reader. This widens the search without repeating what Exa already found.
Never fall back to built-in web search or web fetch. If a connector is missing or failing, say so (see "Errors").

Connector tool names carry a prefix that depends on how the user named the connector (for example `Exa_MCP__web_search_advanced_exa` or `Parallel__web_search`). Match on the part after the prefix.

## Step 1: Plan before searching

1. Work out today's date from the environment. Turn any relative time ("recent", "last month", "this year") into exact dates and use the user's window, not an example's. Never reuse dates or version numbers from examples; check them first.
2. Break the question into the specific facts a good answer needs (usually 2 to 5). This list drives the confidence check in Step 4.
3. Size the job:
   - **Simple** (one fact, one known page): one search or one read, plus one confirming read if it's a "latest" fact (see Step 4). No helpers.
   - **Moderate** (a few facts, one topic, up to about 4 searches): do the searches yourself.
   - **Heavy** (a "compare the top N" or "find all" list, more than about 4 searches, or more than 2 long documents): helper agents if available (Step 5); otherwise an Exa Agent at `auto` with a $1 budget, plus Parallel for any Reddit or X opinion.

## Step 2: Pick the tool

| Job | Tool |
|---|---|
| Any general search (default) | Exa `web_search_advanced_exa` |
| Design research, case studies, academic papers | Exa only |
| Job listings | Exa, with a published-date filter and a fresh download |
| People, companies, personal blogs, GitHub, financial reports | Exa, with a `category`. `category: "people"` returns LinkedIn profile data (headline, work history, profile URL) even though LinkedIn pages can't be opened |
| Read a specific link, long document or PDF | Exa `web_search_advanced_exa` with the exact address pinned (recipe below). Backup: Parallel `web_fetch` |
| YouTube video (full transcript) | Exa `web_fetch_exa` |
| Multi-step research, lists, comparisons, enrichment | Exa `agent_run` (or helpers, Step 5) |
| Opening LinkedIn pages, Quora answers, pages behind a login | Neither can read them. Say so (but try Exa `category: "people"` for profile details) |
| Reactions on X when Parallel's results are noisy | Exa: news articles and round-ups that embed X posts |

### When to add Parallel (Exa-blind sources only)

Add a Parallel search **alongside** Exa, in the same turn, whenever the question would benefit from one of these. Always limit Parallel to the platform with `site:` so it can't return pages Exa already covers.

| Question type | Parallel source | Example `search_queries` |
|---|---|---|
| Software help and troubleshooting (Blender, Figma, Resolve, games, coding tools) | Reddit | `site:reddit.com blender boolean shading fix` |
| "Is X worth it?", product or tool recommendations, buying advice | Reddit | `site:reddit.com best drawing tablet for blender` |
| Real-world experience: careers, salaries, courses, freelancing, studios, hobbies, travel, local tips | Reddit | `site:reddit.com framestore junior artist experience` |
| Community reaction to a release, update, announcement or controversy | X, then Reddit | `site:x.com blender 5.2`, `site:reddit.com blender 5.2 release` |
| What creators, developers or official accounts are posting right now | X | `site:x.com figma config announcement` |
| What it's like to work somewhere (pros, cons, ratings, interview experiences) | Glassdoor (read with `web_fetch`) | `site:glassdoor.co.uk framestore reviews` |
| A company's detailed review score, rating breakdown and dated reviews | Trustpilot (read with `web_fetch`) | `site:trustpilot.com wacom` |
| Exa refuses a page, or its extracts are thin or broken | Any page (backup reader) | `web_fetch` with an objective |

Rules:
- Don't run unrestricted Parallel web searches. If a Parallel result isn't on the target platform, ignore it.
- **Keep Parallel small.** Its results can't be trimmed: one search returned 10,000 to 22,000 characters in testing, much of it Reddit page clutter. Use **at most 2 queries per call** and **at most 2 Parallel searches per question**, then read only the one or two most promising threads.
- **Reddit threads often come back without comments.** If a read returns only the original post, read it again with `/.json` added to the end of the thread address (see `references/parallel.md`).
- For software help, the Reddit search is a supplement: forums and official docs from Exa usually carry the fix. Keep it to one Reddit search unless the user asks about community experience.
- Exa can reach Hacker News, Facebook groups, Instagram and TikTok captions, Threads, Bluesky, Steam, App Store and Amazon reviews, YouTube, Substack, Medium, Stack Overflow and major news sites. Don't use Parallel for those.
- Skip Parallel when Exa already answers the question well and community opinion adds nothing (a version number, a definition, an official spec).

Full settings, recipes and quirks: `references/exa.md` and `references/parallel.md`. Read the relevant file before your first call to that service in a conversation.

### The default Exa search (memorise this shape)

```json
{
  "query": "<a description of the ideal page, not keywords>",
  "numResults": 8,
  "textMaxCharacters": 1,
  "enableHighlights": true,
  "highlightsQuery": "<the specific facts you need from each page>",
  "highlightsMaxCharacters": 1200
}
```

`textMaxCharacters: 1` is essential. Without it Exa also returns the full text of every page (5 results reached 39,000 characters in testing; with it, 8,500).

### Reading one known document with Exa

```json
{
  "query": "<the document's title or a description of it>",
  "includeDomains": ["dl.acm.org/doi/pdf/10.1145/3359183"],
  "numResults": 1,
  "textMaxCharacters": 1,
  "enableHighlights": true,
  "highlightsQuery": "<the precise question you need answered from it>",
  "highlightsMaxCharacters": 3500
}
```

Put the exact address (without `https://`) in `includeDomains`. Check that the returned URL is the one you asked for. You can pin several addresses in one call; check every one came back, as a page can drop out silently.

## Step 3: Keep the context small

These rules apply everywhere, including normal Claude chats with no helper agents.

- **Searches return trimmed extracts only:** full text off, a `highlightsQuery`, 500 to 1,500 characters per result (500 for job listings), 5 to 10 results. Never more than 15 results in one call. People searches (`category: "people"`) carry a 2,000 to 3,000 character profile block per result, so use 3 to 5 results.
- **Parallel searches:** at most 2 queries per call and 2 calls per question (see above).
- **Read only when extracts aren't enough,** and only the one or two most promising pages. Use 3,000 to 4,000 characters for one document.
- **Parallel `web_fetch`:** always give an `objective`. Leave `full_content` off unless the user needs the whole page; it returns the text twice and can be tens of thousands of characters.
- **Exa `web_fetch_exa` cuts from the top of the page.** Use it only for YouTube transcripts and short pages, always with `maxCharacters` (3,000 to 8,000). If a transcript fills the whole limit, it was probably cut off: say the summary may miss the end, or read again with a higher limit (up to about 20,000) if the ending matters.
- **Heavy reading goes to an Exa Agent** (`agent_run`). It searches and reads on Exa's servers and returns a cited answer, using none of the user's Claude allowance. Effort: `minimal` for a few sources, `low` for a short list of known scope, `auto` with a $1 `budget` for "compare the top N" and open-ended research (see `references/exa.md`).
- Don't repeat large tool output back to the user. Quote only what supports the answer.

## Step 4: Confidence check (do this before answering)

Search results are close matches, not proof. After each round:

1. Tick off which planned facts now have a source, and which are still missing or rest on a single weak source.
2. If gaps remain, try these in order and stop once covered:
   - **Different angle,** not a synonym swap (for example practitioner view, official docs, a complaint or bug report, a newer date range). `additionalQueries` runs several wordings in one Exa call.
   - **The other service, within its lane.** If opinion or experience is missing, add Parallel on Reddit, X or Glassdoor. If facts, papers or listings are missing, widen Exa (new filters, `category`, `additionalQueries`).
   - **Read the best page** with a focused question when an extract hints at the answer but is cut off.
   - **Exa Agent** when the question clearly needs many steps.
3. Back up key facts (numbers, dates, prices, versions) with two independent sources where possible.
4. **"Latest" facts need the official page.** For the current version, price, availability or status of something, read the official page (download page, pricing page, release list) to confirm, rather than relying on announcements or news that may be out of date.
5. **Stopping rule:** about 3 rounds. Then answer with what you have and list what you couldn't confirm. Never guess to fill a gap.

Search tips that came out of testing:
- **Date filters** suit news, jobs, releases and prices. For troubleshooting, avoid them or keep them loose: the definitive answer (often a staff reply or a manual page) can be years old.
- **`additionalQueries`** are merged into one ranked list, so a very different angle can be crowded out. Run very different angles as separate calls. `includeDomains` and date filters apply to the extra queries too.

## Step 5: Helper agents (Claude Code and Claude Cowork only)

Use helpers when the job is heavy: more than about 4 searches, more than 2 long documents, or a comparison or list across many sources. Don't use them for simple lookups; each helper starts from scratch and uses extra allowance.

- Available when you have a subagent tool (called Agent or Task). Normal claude.ai chats and the mobile app don't have one: use an Exa Agent for heavy work there instead.
- Use the smallest capable model for helpers (Haiku) unless the task needs careful judgement.
- Split the work by angle or sub-question, not by synonym. Aim for 3 to 5 searches per helper. Launch independent helpers together in one message.
- Each helper must return compact output only (facts with source links, plus gaps). Use the template in `references/helpers.md`.
- Merge the results, remove duplicate sources, then run the Step 4 check on the combined findings.

## Step 6: Answer

- Lead with the answer. Link sources inline with descriptive link text.
- **Link the original source.** Exa sometimes returns its own library pages (`exa.ai/library/...`) for papers and people. Link the paper, publisher, DOI or official page instead (the DOI is often in the result's details).
- Mark confidence where it matters:
  - **well supported**: two or more independent sources agree (mirrors of one page count once),
  - **primary source**: the answer comes straight from the thing itself (the paper, the video transcript, the official page),
  - **single source**: only one secondary source says it,
  - **unconfirmed**: implied or partly stated.
  Recheck helper labels against these before using them.
- Say what you couldn't find or reach (for example a LinkedIn profile or a login page).
- **People who share a name:** confirm you have the right person before reporting details. If a private individual turns up by mistake, mention only enough to avoid confusion.
- For job listings, say whether you confirmed each listing is still open.
- Never describe results as complete or exhaustive unless the set is small, clearly bounded and checked.

## Errors

- **Rate limit or sign-in error:** tell the user which connector failed and how to fix it (for Parallel, connect through `https://search.parallel.ai/mcp-oauth` and sign in; for Exa, sign in or add a key). You may use the other service for the same job meanwhile, but say you did.
- **A connector's tools are missing:** tell the user which connector to add at claude.ai/customize/connectors, then carry on with the other service where possible.
- **Neither service can reach a page:** say so plainly. Don't switch to built-in web fetch.
