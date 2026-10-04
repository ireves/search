---
name: web-research
description: Web search and research using the Exa and Parallel connectors instead of Claude's built-in web search and web fetch. Use this whenever you need information from the web - current facts, prices, releases, documentation, software help (Blender, Figma, DaVinci Resolve and similar), product recommendations, Reddit or X discussions, employer reviews, design research, case studies, academic papers, PDFs, job listings, people or companies - or need to read a link, document or YouTube video. Use it even when the user doesn't say "search", and whenever you would otherwise reach for built-in web search.
---

# Web research with Exa and Parallel

Exa is the main tool for everything it can reach. Parallel is used **only for sources Exa can't find or read** (Reddit, X, Glassdoor reviews, detailed Trustpilot pages) and as the backup reader. This widens the search without repeating what Exa already found.
Never fall back to built-in web search or web fetch. If a connector is missing or failing, say so (see "Errors").

Connector tool names carry a prefix that depends on how the user named the connector (for example `Exa_MCP__web_search_advanced_exa` or `Parallel__web_search`). Match on the part after the prefix.

## Step 1: Plan before searching

1. Work out today's date from the environment. Turn any relative time ("recent", "last month", "this year") into exact dates. Never reuse dates from examples.
2. Break the question into the specific facts a good answer needs (usually 2 to 5). This list drives the confidence check in Step 4.
3. Size the job:
   - **Simple** (one fact, one known page): one search or one read. No helpers.
   - **Moderate** (a few facts, one topic): a few searches yourself.
   - **Heavy** (many sources, comparisons, lists, long documents): use helper agents if available (Step 5), otherwise an Exa Agent.

## Step 2: Pick the tool

| Job | Tool |
|---|---|
| Any general search (default) | Exa `web_search_advanced_exa` |
| Design research, case studies, academic papers | Exa only |
| Job listings | Exa, with a published-date filter and a fresh download |
| People, companies, personal blogs, GitHub, financial reports | Exa, with a `category` |
| Read a specific link, long document or PDF | Exa `web_search_advanced_exa` with the exact address pinned (recipe below). Backup: Parallel `web_fetch` |
| YouTube video (full transcript) | Exa `web_fetch_exa` |
| Multi-step research, lists, comparisons, enrichment | Exa `agent_run` (or helpers, Step 5) |
| LinkedIn profiles, Quora answers, pages behind a login | Neither can read them. Say so |

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

Put the exact address (without `https://`) in `includeDomains`. Check that the returned URL is the one you asked for.

## Step 3: Keep the context small

These rules apply everywhere, including normal Claude chats with no helper agents.

- **Searches return trimmed extracts only:** full text off, a `highlightsQuery`, 800 to 1,500 characters per result, 5 to 10 results. Never more than 15 results in one call.
- **Read only when extracts aren't enough,** and only the one or two most promising pages. Use 3,000 to 4,000 characters for one document.
- **Parallel `web_fetch`:** always give an `objective`. Leave `full_content` off unless the user needs the whole page; it returns the text twice and can be tens of thousands of characters.
- **Exa `web_fetch_exa` cuts from the top of the page.** Use it only for YouTube transcripts and short pages, always with `maxCharacters` (3,000 to 8,000).
- **Heavy reading goes to an Exa Agent** (`agent_run`). It searches and reads on Exa's servers and returns a cited answer, using none of the user's Claude allowance. Effort: `minimal` for a few sources, `low` for a list of known scope, `auto` with a $1 `budget` for open-ended research (see `references/exa.md`).
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
4. **Stopping rule:** about 3 rounds. Then answer with what you have and list what you couldn't confirm. Never guess to fill a gap.

## Step 5: Helper agents (Claude Code and Claude Cowork only)

Use helpers when the job is heavy: more than about 4 searches, more than 2 long documents, or a comparison or list across many sources. Don't use them for simple lookups; each helper starts from scratch and uses extra allowance.

- Available when you have a subagent tool (called Agent or Task). Normal claude.ai chats and the mobile app don't have one: use an Exa Agent for heavy work there instead.
- Use the smallest capable model for helpers (Haiku) unless the task needs careful judgement.
- Split the work by angle or sub-question, not by synonym. Aim for 3 to 5 searches per helper. Launch independent helpers together in one message.
- Each helper must return compact output only (facts with source links, plus gaps). Use the template in `references/helpers.md`.
- Merge the results, remove duplicate sources, then run the Step 4 check on the combined findings.

## Step 6: Answer

- Lead with the answer. Link sources inline with descriptive link text.
- Mark confidence where it matters: **well supported** (two or more independent sources agree; mirrors of one page count once), **single source**, or **unconfirmed**. Recheck helper labels against this before using them.
- Say what you couldn't find or reach (for example a LinkedIn profile or a login page).
- For job listings, say whether you confirmed each listing is still open.
- Never describe results as complete or exhaustive unless the set is small, clearly bounded and checked.

## Errors

- **Rate limit or sign-in error:** tell the user which connector failed and how to fix it (for Parallel, connect through `https://search.parallel.ai/mcp-oauth` and sign in; for Exa, sign in or add a key). You may use the other service for the same job meanwhile, but say you did.
- **A connector's tools are missing:** tell the user which connector to add at claude.ai/customize/connectors, then carry on with the other service where possible.
- **Neither service can reach a page:** say so plainly. Don't switch to built-in web fetch.
