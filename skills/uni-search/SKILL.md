---
name: uni-search
description: Sourced web research via the Search connector (Exa + Parallel), for university work and anything that must be right. Run only when the user types /uni-search. Offers Auto (sized to the question, answer in chat) or Research (cited report up to 3 pages, as a Claude Doc or in chat). Every claim has a source; nothing unsubstantiated.
disable-model-invocation: true
---

Purpose: the answer must be factual, correct, complete and sourced. Accuracy > speed. Answer every part of the question, then be brief (cut words, never asked-for facts). No claim without a source. Your own reasoning (comparisons, implications) is allowed only when labelled as such and built on cited facts.

Tools: search, fetch, verify, research from the Search connector, run by workers (WORKERS below). Names may be prefixed (Search:search, mcp__search__search); match the suffix. Never use built-in web_search/web_fetch. Connector tools missing -> tell user to add the connector at claude.ai/customize/connectors; stop.

STEP 1 MODE
Message names it (auto/quick -> Auto; research/report/deep -> Research) -> use it. Else ask once before any search, with a multiple-choice tool (AskUserQuestion, or the Claude apps' option chips), else one line.
Question: "How thorough should this be?"
Option "Auto": "Sized to the question: a quick check, a few searches, or a full sweep. Sourced answer in chat."
Option "Research": "In-depth research with every key claim cross-checked. A cited report of up to 3 pages."
Research chosen -> straight away, before any search, ask (skip if the message already says doc or chat):
Question: "Where should the research go?"
Option "Claude Doc": "A shareable doc that fills in as the research runs."
Option "Chat": "The full report here in the conversation."

STEP 2 PLAN (yours)
- Today's date from context or the first result header ("today is"); convert relative times to exact dates.
- List every fact a complete answer needs. Comparison = one fact per item x attribute (each table cell). This list drives STEPS 3-7 and goes in every worker brief as FACTS.
- Mark "latest" facts (current version/price/status/role holder/rule): need the official page, read today.
- Question rests on a premise (X happened, Y is true)? Add "is the premise true" as a fact.
- Brief params (workers pass them as written): search query = description of the ideal page with names/versions/places/years; goal = facts to pull; type: news | discussions (Reddit/forums) | x | reviews | papers | people | companies | code | jobs | financial (omit for general); sites; exclude_sites; after/before (YYYY-MM-DD or 7d/3m/1y); country (two-letter: GB); fresh:true (live prices/status); depth fast | standard | thorough. fetch: urls (<=5) + question. verify: claims (<=8). research: task + effort quick | standard | deep, or run_id.

STEP 3A AUTO (smallest path that works)
- Simple (one fact/page): 1 worker: search (+ sites=official domain for latest facts); after: read best 1 if excerpts don't state it; after: if only one site states the key fact, verify what you found for it.
- Moderate (few facts, one topic): 2 workers in one message, distinct angles (official/primary; independent reporting or papers), each 1-2 searches + read best 1-2 with a question listing its FACTS. Then STEP 4 gaps + verify in one worker.
- Heavy (2+ items compared, top N, find all, many sources): in one message: research worker (effort "standard"); one read worker per 1-2 items (official pricing/docs/product pages, question = that item's facts); one search worker for opinion if asked (type discussions/x/reviews). Then STEP 4 gaps + verify in one worker.
Then STEP 4 for anything still missing (Simple), STEP 5, STEP 6 (Heavy only). Answer in chat (STEP 7).

STEP 3B RESEARCH
1. Read references/report.md now (sections and length; needed for the skeleton and the write-up). Destination Claude Doc -> create the skeleton now, before searching, per the Claude Docs connector's instructions (load its docs skill if listed). Docs unavailable -> say so in one line; report in chat.
2. In one message: research worker (effort "deep", full brief: question, scope, time window, step-2 facts, "prefer primary sources; report conflicts and what couldn't be verified") + 2-3 sweep workers covering 3-6 distinct angles (not synonyms): official/primary; news (type news + after); studies (type papers); practitioners (type discussions); critics/failure reports. Each: searches with goal = facts to pull, then read best 1-2. depth "thorough" only for hard/obscure sub-questions.
3. Sweep digests back -> read worker for primary sources carrying key facts not yet read (1-4 pages, question = those facts).
4. Research digest back (still running -> new worker collects with the run_id; never a second run). Cross-check: sweep vs both agents. All agree -> strong. Disagree -> read the primary source to settle, or report both.
5. STEP 4 gap check, then verify the claims the report rests on (numbers, dates, versions, names, quotes): <=8 per call, <=2 calls, one worker. Drop or qualify unsupported ones.
6. STEP 5, then STEP 6 source check (required), then write with exactly the references/report.md sections (STEP 7). Doc: fill sections; chat reply = one line + link + cost line. Chat: the report itself, same sections.

STEP 4 GAP CHECK (yours; Auto and Research)
Go through the step-2 list. Gap = missing; partial; "(partial)" or NOT FOUND in a digest; only from agent claims; or you'd write "did not check".
- Agent claims are leads, not sources: confirm on the page they cite or the official page.
- All gaps -> one worker: read where each would be stated (official pricing/docs/changelog/model page; else search sites=official domain). Up to 2 gap rounds.
- Still missing -> "not found", naming the pages checked. Never write "I did not check X".

STEP 5 CONFIDENCE (yours)
- Primary (organisation, paper, filing, official docs, transcript) or secondary?
- Key figures/dates: 2 independent sources or 1 primary. Mirrors/copies = 1.
- Latest facts: official page, read today. Check every source date; prefer newest authoritative; note differences.
- Digest says CONFLICTS or "different" in verify -> resolve from the primary source or report both.
- Never guess or fill from memory.

STEP 6 SOURCE CHECK (Research always, even when pages were already read; Auto heavy)
Confirms each claim, as you have worded it, is on the page you cite. Before writing, list each claim you will cite with its url, citing only pages a worker read or quoted. One check worker (<=10, numbered). "different"/"not stated"/"link failed" -> fix the claim, swap to a source that states it, or drop it.

STEP 7 ANSWER
- Answer first, plain words; then support. Premise false -> say so first.
- Inline descriptive links to original sources on every factual sentence or bullet.
- Labels where it matters: confirmed (primary, or 2+ independent agree) | likely (one reliable secondary) | unconfirmed (implied/partial/conflicting; say what conflicts).
- State gaps/unreachable sources and the as-of date.
- Every step-2 fact appears: its value, or "not found on <page>". Never drop one to save space.
- Tables: source link in every cell, or one source per row/column.
- Auto: short as completeness allows (usually <250 words; comparisons longer). Research: references/report.md, <=3 pages (~1,400 words).
- No raw tool output or digests; quote only proof.
- Last line of the chat reply: "Search cost: $X (Exa $Y, Parallel $Z)" = sum of every worker COST line and any "Search cost of this call" line since your last reply; add ", Firecrawl N credits" inside the brackets when any line has it. Not in the Doc.

WORKERS
- You plan, judge and write; workers make every connector call and return short digests (findings + urls), so raw results never fill your context.
- Start: your sub-agent tool (Agent/Task), subagent_type "search:search-worker" (or the listed agent ending in "search-worker"), model "haiku". Only if it is not listed but the tool exists: read references/worker.md and paste it at the top of the brief for a general-purpose sub-agent, model "haiku" (don't read it otherwise). No sub-agent tool, or a worker replies "NO SEARCH TOOLS" -> make the same calls yourself; keep the plan.
- Brief (self-contained; the worker sees nothing else): "User ran /uni-search." + JOBS (exact calls and params; "after" for chained jobs; "read best N"; "verify what you found for FACTS x,y") + FACTS + LIMIT (Auto 300 words, Research 500, research jobs 700).
- Independent workers in one message so they run together. Run them in the foreground (run_in_background false where offered) and wait for every digest before replying; never send the user an "it's still running" message. Never repeat a call a worker already made.
- Digests are leads with quotes. You decide what's true. Need exact wording a digest lacks -> one read job with a narrower question.

ERRORS
- "no API key" / "rejected the API key" / "out of credit": user adds/replaces key at the connector settings page (connector URL with /settings instead of /mcp).
- One engine unavailable: continue with the other; mention in one line.
- Unreadable login-walled page (LinkedIn, Quora): say so; for people try search type people.
