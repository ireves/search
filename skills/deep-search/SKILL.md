---
name: deep-search
description: Verified web research via the Search connector (Exa + Parallel). Run only when the user types /deep-search. Offers Auto (sized to the question) or Deep research (concise cited report, max 2 pages, Claude Doc by default). Every key claim is checked against independent sources.
disable-model-invocation: true
---

Purpose: user needs the answer factual and correct. Accuracy > speed; brevity > coverage. Never state an unsourced fact.

Tools: search, fetch, verify, research from the Search connector. Names may be prefixed (Search:search, mcp__search__search); match the suffix. Never use built-in web_search/web_fetch. Tools missing -> tell user to add the connector at claude.ai/customize/connectors; stop.

STEP 1 EFFORT
If the message names it (auto/quick -> Auto; deep research/report -> Deep research), use it. Else ask once before any search, with a multiple-choice tool if available (AskUserQuestion, or the Claude apps' option chips), else one line.
Question: "How thorough should this be?"
Option "Auto": "Sized to the question: a quick check, a few searches, or a full sweep. Answer in chat."
Option "Deep research": "A concise cited report (2 pages or less) with every key claim cross-checked. Saved as a Claude Doc."

STEP 2 PLAN
- Get today's date; convert relative times to exact dates.
- List facts a complete answer needs (2-6). Drives step 4.
- Mark "latest" facts (current version/price/status/role holder): need official source.

STEP 3A AUTO (smallest path that works)
- Simple (one fact/page): 1 search or fetch. Latest fact -> confirm on official page. verify key fact if only one source states it.
- Moderate (few facts, one topic): 2-4 searches, different angles, in one message -> fetch 1-2 best pages with question -> 1 verify call with key claims.
- Heavy (compare top N, find all, many sources): research effort "standard" + own search for gaps (Reddit/X opinion: type discussions/x) -> verify relied-on claims.
Answer in chat (step 5).

STEP 3B DEEP RESEARCH
1. Doc first: on choice, create the Claude Doc skeleton before searching, per the Claude Docs connector's instructions (load its docs skill if listed). Outline: references/report.md. User asked for another destination -> use it. Docs unavailable -> say so in one line; report in chat (or a file in Claude Code).
2. research effort "deep" with full brief: question, scope, time window, step-2 facts, "prefer primary sources; report conflicts and what couldn't be verified". Runs Exa + Parallel agents; minutes. Same message: start step 3.
3. Own sweep, 3-6 searches, distinct angles (not synonyms): official/primary; news (type news + after); studies (papers); practitioners (discussions); critics/failure reports. goal = facts to pull. depth "thorough" only for hard/obscure sub-questions.
4. fetch primary sources carrying key facts, with question, 1-4 pages.
5. research returned run_id -> call again with run_id (never a second run). Keep working meanwhile.
6. Cross-check own findings vs both agent reports. All agree -> strong. Disagreement -> read primary source to settle, or report both.
7. verify claims the report rests on (numbers, dates, versions, names, quotes): <=8 per call, <=2 calls. Drop or qualify unsupported ones.
8. Write report into the Doc (step 5 + references/report.md). Chat reply: one line + link.
Helpers: Claude Code/Cowork only, optional for independent sub-questions (3-5 searches each, return facts + links only). Chat: use research instead.

STEP 4 CONFIDENCE CHECK (before writing)
Per fact:
- Source exists? Primary (organisation, paper, filing, official docs, transcript) or secondary?
- Key figures/dates: 2 independent sources or 1 primary. Mirrors/copies = 1.
- Latest facts: official page, read today.
- Check every source date; prefer newest authoritative; note date differences.
- Missing after ~3 rounds -> report not confirmed. Never guess or use memory.

STEP 5 ANSWER
- Answer first, plain words; then support.
- Inline descriptive links to original sources.
- Labels where it matters: confirmed (primary, or 2+ independent agree) | likely (one reliable secondary) | unconfirmed (implied/partial/conflicting; say what conflicts).
- State gaps/unreachable sources and the as-of date.
- Auto: usually <250 words. Deep research: references/report.md, <=2 pages.
- No raw tool output; quote only proof.

ERRORS
- "no API key" / "rejected the API key": user adds/replaces key at connector settings page (connector URL with /settings instead of /mcp).
- One engine unavailable: continue with the other; mention in one line.
- Unreadable login-walled page (LinkedIn, Quora): say so; for people try search type people.
