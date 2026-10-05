---
name: deep-search
description: Verified web research through the Search connector (Exa + Parallel). Use when the user runs /deep-search, or asks for research they can rely on - "fact-check", "verify", "make sure this is correct", "deep research", "research report". Offers two efforts - Auto (sized to the question) or Deep research (a concise cited report of 2 pages or less, saved as a Claude Doc by default). Every key claim is checked against independent sources before it is stated.
---

# Deep search

The user called this because they need to be sure the answer is **factual and correct**. Accuracy beats speed and brevity beats coverage. Never state a fact you haven't sourced; say what you couldn't confirm.

Use only the Search connector's tools: `search`, `fetch`, `verify`, `research`. Their names may carry a prefix (for example `Search:search` or `mcp__search__search`); match the part after it. Never use built-in web search or web fetch. If the connector's tools are missing, say so and stop: the user should add the connector at claude.ai/customize/connectors.

## Step 1: Choose the effort

If the user's message already names the effort ("auto", "quick", "deep research", "report"), use it. Otherwise ask once, before any search, with your multiple-choice tool if you have one (for example AskUserQuestion in Claude Code, or the tappable options in the Claude apps). If you have none, ask in one line.

Question: "How thorough should this be?"

| Option | Description to show |
|---|---|
| **Auto** | Sized to the question: a quick check, a few searches, or a full sweep. Answer in chat. |
| **Deep research** | A concise cited report (2 pages or less) with every key claim cross-checked. Saved as a Claude Doc. |

## Step 2: Plan (both efforts)

1. Get today's date. Turn relative times ("recent", "this year") into exact dates.
2. List the facts a complete answer needs (2 to 6). This list drives the checks in Step 4.
3. Note which facts are "latest" facts (current version, price, status, who holds a role). These need the official source.

## Step 3a: Auto

Pick the smallest path that answers the question.

| Path | When | What to do |
|---|---|---|
| Simple | One fact or one known page | One `search` (or one `fetch`). For a "latest" fact, confirm on the official page. Then `verify` the key fact if only one source states it. |
| Moderate | A few facts, one topic | 2 to 4 `search` calls from different angles in one message, `fetch` the 1 or 2 best pages with a question, then one `verify` call with the key claims. |
| Heavy | "Compare the top N", "find all", many sources | `research` with `effort: "standard"`, plus your own `search` for anything it can't reach (Reddit and X opinion: `type: "discussions"` or `"x"`), then `verify` the claims you'll rely on. |

Answer in chat (see Step 5).

## Step 3b: Deep research

1. **Open the Doc first.** As soon as the user picks Deep research, create the Claude Doc skeleton before searching, following the Claude Docs connector's own instructions (and its docs skill, if one is listed). Use the outline in `references/report.md`. If the user asked for the report somewhere else (chat, a file), do that instead. If Claude Docs isn't available, say so in one line and write the report in chat or as a document.
2. **Start the independent sweep.** Call `research` with `effort: "deep"` and a full brief: the question, scope, time window, the facts from Step 2, and "prefer primary sources; report conflicts and what couldn't be verified". It runs two separate research agents (Exa and Parallel) and may take several minutes. In the same message, start your own searches (next step).
3. **Your own sweep.** 3 to 6 `search` calls, each a different angle, not synonyms: official/primary sources, recent news (`type: "news"` with `after`), studies (`type: "papers"`), practitioner experience (`type: "discussions"`), critics or failure reports. Use `goal` to say which facts to pull. Use `depth: "thorough"` only for hard or obscure sub-questions.
4. **Read the primary sources** that carry the key facts: `fetch` with a `question`, 1 to 4 pages.
5. **Collect the research run.** If `research` returned a `run_id`, call it again with that `run_id` (never start a second run). While you wait, keep working on your own sweep.
6. **Cross-check.** Compare your findings with both research reports. Facts all three agree on are strong. For every disagreement, read the primary source to settle it, or report both sides.
7. **Verify.** Put the claims the report will rest on (numbers, dates, versions, names, quotes) through `verify`, up to 8 per call and 2 calls. Drop or qualify anything not supported.
8. **Write the report** into the Doc (Step 5 and `references/report.md`). End your chat message with one line and the link.

Helpers: in Claude Code or Cowork you may give independent sub-questions to helper agents (3 to 5 searches each, returning facts with links only). In normal chat, rely on `research` instead.

## Step 4: Confidence check (before writing anything)

For each fact from Step 2:

1. Has it got a source? Is that source primary (the organisation, the paper, the filing, the official docs, the transcript) or secondary?
2. Key figures and dates need two independent sources, or one primary source. Copies of the same story or paper count once (`search` already folds mirrors together; still check).
3. "Latest" facts must come from the official page, read today, not from news that may be old.
4. Check dates on every source. Prefer the newest authoritative one; note when sources reflect different dates.
5. If a fact is still missing after about 3 rounds, stop and report it as not confirmed. Never fill a gap with a guess or with memory.

## Step 5: Answer

- Lead with the answer in plain words. Then the supporting points.
- Cite inline with descriptive link text, linking the original source.
- Label confidence where it matters:
  - **confirmed**: a primary source, or two or more independent sources agree,
  - **likely**: one reliable secondary source,
  - **unconfirmed**: implied, partial or conflicting evidence (say what conflicts).
- Say what you couldn't find or reach, and the date the information is current to.
- Auto answers stay short: usually under 250 words. Deep research reports follow `references/report.md` (2 pages or less).
- Don't paste raw tool output. Quote only the words that prove a point.

## Errors

- "has no API key" or "rejected the API key": tell the user to open the connector's settings page (the connector's address without `/mcp`, then `/settings`) and add or replace the key.
- One engine unavailable: carry on with the other and say so in one line.
- A page can't be read (login walls such as LinkedIn or Quora): say so; try `search` with `type: "people"` for professional profiles.
