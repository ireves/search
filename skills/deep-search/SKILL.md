---
name: deep-search
description: Verified web research via the Search connector (Exa + Parallel). Use when the user runs /deep-search or asks for research they can rely on ("fact-check", "verify", "make sure this is correct", "deep research", "research report"). Offers Auto (sized to the question) or Deep research (concise cited report, max 2 pages, Claude Doc by default). Every key claim is checked against independent sources.
---

Purpose: user needs the answer factual and correct. Accuracy > speed; brevity > coverage. Never state an unsourced fact. Dig until each point is settled; skimming the first results is the main failure to avoid.

Tools: search, fetch, verify, research from the Search connector. Names may be prefixed (Search:search, mcp__search__search); match the suffix. Never use built-in web_search/web_fetch. Tools missing -> tell user to add the connector at claude.ai/customize/connectors; stop.

STEP 1 EFFORT
If the message names it (auto/quick -> Auto; deep research/report -> Deep research), use it. Else ask once before any search, with a multiple-choice tool if available (AskUserQuestion, or the Claude apps' option chips), else one line.
Question: "How thorough should this be?"
Option "Auto": "Sized to the question: a quick check, a few searches, or a full sweep. Answer in chat."
Option "Deep research": "A concise cited report (2 pages or less) with every key claim cross-checked. Saved as a Claude Doc."

STEP 2 PLAN
- Get today's date; convert relative times to exact dates.
- List the points a complete answer needs (2-6). This is the ledger for step 3.
- Mark status-sensitive points: anything described as current (company trading, product sold, project maintained, version latest, person in role, fix still needed, price, rule in force). Each needs a STATUS CHECK.

STEP 3 LOOP (both efforts)
After every round, update the ledger per point: answered (source + date) | partial | open. Note leads (promising, unconfirmed details).
- Open point -> next round from a new angle, not a synonym: other source type (official/primary, issue tracker/changelog, news, papers, discussions, critics), the cause instead of the symptom, exact error text, alternative approach or workaround.
- Lead -> dig: fetch with question; check it fits (version, platform, region, date); look for confirmation it worked, or later reports it failed or was superseded.
- Point answered by one secondary source -> second independent source or verify.
- Stop a point after 3 distinct angles; report it as not confirmed with what was tried.
Never write "not sure", "may", "appears to" about something not yet searched for.

STATUS CHECK
- Needs dated evidence from the last ~12 months. Own website, profile, directory entry, "about" page or old press release = description, not proof of status.
- Search for change: type news, after ~2y, query as a page description ("news that <name> entered administration, closed, was acquired or rebranded"; software: deprecated, discontinued, fixed in a later version). Official registers via sites (Companies House: find-and-update.company-information.service.gov.uk; SEC; OpenCorporates).
- Lists: one sector-wide closures/takeovers news search, then verify each kept entity ("<name> is still trading in <year>"). Drop or flag defunct ones.
- Latest version/price/role: read the official page with fetch or search fresh:true (stored copies can be months behind).
- Old posts = "last activity <date>", never "active".

Search parameters (tested Oct 2026): max_results 10 for lists/discovery (same price as 8), 5 for one fact. depth thorough (2x cost) for lists, obscure topics, or after a standard search left gaps. type companies/people = self-descriptions, never status evidence. goal shapes excerpts, barely ranking; a new angle needs a separate search.

STEP 3A AUTO (starting size; the loop decides when to stop)
- Simple (one fact/page): 1 search or fetch -> STATUS CHECK if current -> verify if only one source.
- Moderate (few facts, one topic): 2-4 searches, different angles, in one message -> fetch 1-2 best pages with question -> loop on open points -> 1 verify call with key claims.
- Heavy (compare top N, find all, many sources): research effort "standard" + own searches for gaps (Reddit/X opinion: type discussions/x) -> STATUS CHECK every entity -> verify relied-on claims.
Answer in chat (step 5).

STEP 3B DEEP RESEARCH
1. Doc first: on choice, create the Claude Doc skeleton before searching, per the Claude Docs connector's instructions (load its docs skill if listed). Outline: references/report.md. User asked for another destination -> use it. Docs unavailable -> say so in one line; report in chat (or a file in Claude Code).
2. research effort "deep" with full brief: question, scope, time window, step-2 points, "prefer primary sources; give the date of the newest evidence for each entity's status; report conflicts and what couldn't be verified". Runs Exa + Parallel agents; minutes. Same message: start step 3.
3. Own sweep, 3-6 searches, distinct angles: official/primary; news (type news + after); studies (papers); practitioners (discussions); critics/failure reports. goal = facts to pull. depth "thorough" for hard/obscure sub-questions.
4. fetch primary sources carrying key facts, with question, 1-4 pages.
5. research returned run_id -> call again with run_id (never a second run). Keep working meanwhile.
6. Cross-check own findings vs both agent reports. Agent claims are leads, not proof; agents also cite stale pages. All agree -> strong. Disagreement -> read primary source to settle, or report both.
7. Gap round: run the loop on every point still partial/open and every lead from step 6; STATUS CHECK every entity and "current" fact in the report.
8. verify claims the report rests on (numbers, dates, versions, names, status): <=8 per call, <=2 calls. Drop or qualify unsupported ones.
9. Write report into the Doc (step 5 + references/report.md). Chat reply: one line + link.
Helpers: Claude Code/Cowork only, optional for independent sub-questions (3-5 searches each, return facts + links + dates only). Chat: use research instead.

STEP 4 CONFIDENCE CHECK (before writing)
Per point:
- Source exists? Primary (organisation, paper, filing, register, official docs, transcript) or secondary?
- Key figures/dates: 2 independent sources or 1 primary. Mirrors/copies = 1.
- Status-sensitive: dated evidence <12 months, or labelled with its last-known date.
- Check every source date; prefer newest authoritative; note date differences.
- Open after 3 distinct angles -> report not confirmed, with what was tried. Never guess or use memory.

STEP 5 ANSWER
- Answer first, plain words; then support.
- Inline descriptive links to original sources.
- Labels where it matters: confirmed (primary, or 2+ independent agree) | likely (one reliable secondary) | unconfirmed (implied/partial/conflicting; say what conflicts).
- Status with date: "trading (last filing Mar 2026)", "in administration since Aug 2025", "last activity 2020; status unknown".
- State gaps/unreachable sources and the as-of date.
- Auto: usually <250 words. Deep research: references/report.md, <=2 pages.
- No raw tool output; quote only proof.

ERRORS
- "no API key" / "rejected the API key": user adds/replaces key at connector settings page (connector URL with /settings instead of /mcp).
- One engine unavailable: continue with the other; mention in one line.
- Unreadable login-walled page (LinkedIn, Quora): say so; for people try search type people.
