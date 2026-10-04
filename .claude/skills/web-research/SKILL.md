---
name: web-research
description: Web search and research using the Exa and Parallel connectors instead of Claude's built-in web search and web fetch. Use this whenever you need information from the web - current facts, prices, releases, documentation, software help (Blender, Figma, DaVinci Resolve and similar), Reddit or X discussions, design research, case studies, academic papers, PDFs, job listings, people or companies - or need to read a link, document or YouTube video. Use it even when the user doesn't say "search", and whenever you would otherwise reach for built-in web search.
---

# Web research with Exa and Parallel

Exa is the main tool. Parallel covers what Exa can't reach (Reddit, X) and acts as the backup.
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
| Software help (Blender, Figma, and so on) | **Both, in the same turn:** Exa for forums and docs, Parallel `web_search` for Reddit, official manuals and the newest threads |
| Reddit or X (Twitter), searching or reading | Parallel only. Exa cannot reach either |
| Exa refuses a page, or returns thin or broken extracts | Parallel `web_fetch` with an objective |
| Multi-step research, lists, comparisons, enrichment | Exa `agent_run` (or helpers, Step 5) |
| LinkedIn profiles, pages behind a login | Neither can read them. Say so |

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
- **Heavy reading goes to an Exa Agent** (`agent_run`, minimal or low effort). It searches and reads on Exa's servers and returns a short cited answer, using none of the user's Claude allowance.
- Don't repeat large tool output back to the user. Quote only what supports the answer.

## Step 4: Confidence check (do this before answering)

Search results are close matches, not proof. After each round:

1. Tick off which planned facts now have a source, and which are still missing or rest on a single weak source.
2. If gaps remain, try these in order and stop once covered:
   - **Different angle,** not a synonym swap (for example practitioner view, official docs, a complaint or bug report, a newer date range). `additionalQueries` runs several wordings in one Exa call.
   - **The other service.** Parallel finds different sources, especially Reddit and the newest threads. Exa finds better case studies, papers and job pages.
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
