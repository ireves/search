---
name: deep-search
description: Verified web research via the Search connector (Exa + Parallel). Use when the user runs /deep-search or asks for research they can rely on ("fact-check", "verify", "make sure this is correct", "deep research", "research report"). Offers Auto (sized to the question) or Deep research (concise cited report, max 2 pages, Claude Doc by default). Every key claim is checked against independent sources.
---

Purpose: the answer must be factual and correct. Accuracy > speed; brevity > coverage. Never state an unsourced fact.

Tools: search, fetch, verify, research (Search connector; names may be prefixed, e.g. Search:search; match the suffix). Never built-in web_search/web_fetch. Tools missing -> tell user to add the connector at claude.ai/customize/connectors; stop.
Tool facts: fetch reads the live page. research runs remote agents and returns a cited answer (quick ~$0.01; standard ~$0.05; deep = two independent agents, ~$0.20, 2-10 min). Use research instead of spawning helper agents.

STEP 1 EFFORT
Message names it (auto/quick -> Auto; deep research/report -> Deep research) -> use it. Else ask once before any search, with a multiple-choice tool if available (AskUserQuestion, or the Claude apps' option chips), else one line.
Question: "How thorough should this be?"
Option "Auto": "Sized to the question: a quick check, a few searches, or a full sweep. Answer in chat."
Option "Deep research": "A concise cited report (2 pages or less) with every key claim cross-checked. Saved as a Claude Doc."

STEP 2 PLAN
- Today's date; turn relative times into exact dates.
- List the 2-6 facts a complete answer needs (drives step 4).
- Mark "latest" facts (current version/price/status/role holder/rule in force): need the official page.

STEP 3A AUTO (smallest path that works)
- Simple (one fact or page): 1 search or fetch. Latest fact -> fetch the official page with question. Only one source states it -> verify.
- Moderate (a few facts, one topic): research quick -> search/fetch only for facts it left unconfirmed or "latest" facts -> 1 verify call on the key claims.
- Heavy (comparison, top N, find all, many sources): research standard -> own searches for gaps (opinion: type discussions/x) -> verify the claims you rely on.
Answer in chat (step 5).

STEP 3B DEEP RESEARCH
1. Doc first: on choice, create the Claude Doc skeleton before searching, per the Claude Docs connector's instructions (load its docs skill if listed). Outline: references/report.md. User asked for another destination -> use it. Docs unavailable -> say so in one line; report in chat (or a file in Claude Code).
2. research effort "deep" with the full brief: question, scope, time window, step-2 facts, "prefer primary sources; report conflicts and what couldn't be verified". Same message: start step 3.
3. Own sweep, 3-5 searches, distinct angles (not synonyms): official/primary; news (type news + after); studies (type papers); practitioners (type discussions); critics/failure reports. goal = facts to pull. depth "thorough" only for hard/obscure sub-questions.
4. fetch the primary sources behind key facts, with question, 1-4 pages.
5. research returned run_id -> call again with run_id (never a second run). Keep working meanwhile.
6. Cross-check your findings against both agent reports. All agree -> strong. Disagree -> read the primary source to settle it, or report both.
7. verify the claims the report rests on (numbers, dates, versions, names, quotes): <=8 per call, <=2 calls. Drop or qualify unsupported ones.
8. Write the report into the Doc (step 5 + references/report.md). Chat reply: one line + link.

STEP 4 CONFIDENCE CHECK (before writing)
Per fact:
- Source exists? Primary (organisation, paper, filing, official docs, transcript) or secondary?
- Key figures/dates: 2 independent sources or 1 primary. Mirrors/copies = 1. An agent's statement alone = 0: it needs its cited source.
- Latest facts: official page, read live (fetch).
- Check every source date; prefer the newest authoritative; note date differences.
- Missing after ~3 rounds -> report not confirmed. Never guess or use memory.

STEP 5 ANSWER
- Answer first, plain words; then support.
- Inline descriptive links to original sources.
- Labels where it matters: confirmed (primary, or 2+ independent agree) | likely (one reliable secondary) | unconfirmed (implied/partial/conflicting; say what conflicts).
- State gaps/unreachable sources and the as-of date.
- Auto: usually <250 words. Deep research: references/report.md, <=2 pages.
- No raw tool output; quote only proof.

ERRORS
- "no API key" / "rejected the API key": user adds/replaces the key on the connector settings page (connector URL with /settings instead of /mcp).
- One engine unavailable: continue with the other; mention it in one line.
- Unreadable login-walled page (LinkedIn, Quora): say so; for people use search type people.
