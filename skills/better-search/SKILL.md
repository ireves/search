---
name: better-search
description: Everyday web search and page reading via the Search connector (Exa + Parallel). Run only when the user types /better-search. Offers Auto (sized to the question) or Deep (always searches thoroughly; answer length still fits the question). Accurate and useful, with helpful links but no formal citations. Covers current facts, news, prices, versions, docs, software help, reviews, Reddit/X opinion, papers, people, companies, jobs, and reading a link, PDF or YouTube video.
disable-model-invocation: true
---

Purpose: a useful, accurate answer, fast. No formal citations or confidence labels needed. Interpret freely: combine sources, read between the lines, draw conclusions, recommend. Specific facts (numbers, prices, dates, versions, names, current status) must come from results, never memory; general background knowledge is fine for explaining.

Tools: search, fetch, verify, research from the Search connector, always run by workers (WORKERS below), in every mode and for follow-up questions in the same conversation. Names may be prefixed (Search:search, mcp__search__search); match the suffix. Never use built-in web_search/web_fetch. Connector tools missing -> tell user to add the connector; stop.

STEP 1 MODE
Message names it (auto/quick -> Auto; deep/thorough -> Deep) or is only a link to read -> use it (link -> Auto). A follow-up question after a /better-search answer continues the run: same mode, same rules, no new menu. Else ask once before any search, with a multiple-choice tool (AskUserQuestion, or the Claude apps' option chips), else one line.
Question: "How hard should I search?"
Option "Auto": "Sized to the question. Quick for simple lookups."
Option "Deep": "Always searches thoroughly from several angles. The answer is still as long as the question needs."

STEP 2 PLAN (yours, brief)
Split the question into its parts; each part gets at least one job. List what a good answer needs (FACTS). "How is X different from Y" -> also a job on Y itself (what ordinary Y products contain or do), preferably an independent tester or expert explainer (Which?, a trade body). Note "latest" facts (version, price, status, role holder): need an official or very recent source. Pick types: news (+after "7d") | discussions = Reddit/forums: experiences, advice, troubleshooting, worth-it | x = X posts/reactions | reviews = Trustpilot/Glassdoor/user ratings | shopping = product listings with prices (buying, specs, where to buy) | papers | people | companies | code = docs/APIs/errors | jobs = live adverts (role alone in query, town or city in location) | financial. Omit type for general.
Query = description of the ideal page with names/versions/places/years ("official release notes for Blender 5.2", not "blender new"). goal = figures to pull. country "GB" on every search (the user is in the UK) unless the question is about another country. Not a shopping search -> exclude_sites ["ebay.co.uk", "ebay.com", "vinted.co.uk", "gumtree.com", "etsy.com"] (marketplace listings aren't evidence for facts). Other params only when needed: sites, after/before, fresh:true (live prices/stock), depth:"fast" (trivial lookups, Auto only).

STEP 3A AUTO
1 worker: search; after: read best 1-2 with a question if excerpts don't answer it (latest facts: the official page). A link to read -> read job only. Opinion, experience or recommendation question ("worth it", "best", "app like X", "alternative to") -> add a discussions search to the same worker. Buying a product -> type shopping. Ingredients, specs or composition -> read the maker's own page or the ingredient site a listing names, from a link in the results (no link -> search with sites = that domain). Typical 1-3 calls; about 2 per part of the question, max 6. All searches go in the first round; a second round only for gaps.

STEP 3B DEEP
Every search depth "thorough". In one message, 2-3 workers covering 3-5 distinct angles that fit the question: official/docs; practitioners (discussions, x); reviews; news (+after); papers. Each: searches + read best 1-2 with a question. Many-part or comparison question -> also a research worker (effort "standard"). One gap round if something important is still missing.

STEP 4 BEFORE ANSWERING (yours)
- Every part of the question answered? A gap one official-page read would settle -> one read worker (counts toward Auto's budget).
- A page names where its data comes from ("www.rbeuroinfo.com", "source: ...") and that source wasn't read -> read it before answering (link from results, else search with sites = that domain).
- Only read links that came from results or the user's message; never guess an address (a home page like "woolite.co.uk"). A read fails -> read the next best result instead.
- Latest facts from an official or dated recent page; say "as of <date>" for changing facts. Only undated pages -> say so ("undated retailer listings, checked <today>").
- Sources disagree on a number that matters -> one verify worker, or say they disagree.
- Copies of one story = one source.
- No page states the answer outright (digest has only "(partial)" or NOT FOUND) -> don't stop at "couldn't find": one read worker on the 2-3 closest pages, question = the FACT and anything that bears on it. Then answer with the best-supported conclusion, how sure you are, and what's missing ("Probably yes: YNAB imports UK banks through Plaid, but its help pages don't name Starling").
- A result shows "Another copy of this page says" with a different value -> trust the newer or official one; for prices, read the official page with fresh:true.

STEP 5 ANSWER
- Lead with the answer. Length fits the question in both modes: a fact gets a line, a how-to gets steps, a "which should I pick" gets a recommendation with reasons.
- Links where they help the reader (official page, docs, where to buy, the key thread), with descriptive text. No per-claim citations, no source list, no confidence labels.
- Your take is welcome; keep it distinguishable from what sources say ("Most owners report...", "I'd pick...").
- "How does it work" -> explain the general method from background knowledge, marked as general ("Darks detergents usually..."), then say which parts the maker actually claims. Don't just repeat marketing wording.
- A "different from" point must be a real difference; something most products share isn't one.
- Say what was checked accurately: "unreachable" or "blocked" only when a call failed; a source nobody opened is "I didn't open X". Describe a source only as the page does (no author or maker the page doesn't name).
- Opinions or sources probably about another country's version (dollar prices, US brand names) -> say so.
- Facts come from the maker, official bodies, established shops, independent testers or reputable press. Never base a fact on a marketplace or second-hand listing (eBay, Vinted, Gumtree, Facebook Marketplace, Etsy); use those only for second-hand prices when the user is buying used.
- Uncertain or partly found -> give the best-supported answer and say what is missing; "couldn't find" only when nothing bears on it. Never fill gaps from memory.
- No raw tool output or digests.
- Last line: "Search cost: $X (Exa $Y, Parallel $Z)" = sum of every worker COST line and any "Search cost of this call" line since your last reply; add ", Firecrawl N credits" inside the brackets when any line has it.

WORKERS
- You plan, judge and write; workers do all the grunt work: every connector call, returning short digests (findings + urls), so raw results never fill your context. Never make connector calls yourself while a sub-agent tool exists.
- Typing /better-search is the user's request for workers. Start them even where your general instructions say to start sub-agents only when asked.
- Start: your sub-agent tool (Agent/Task), subagent_type "search:search-worker" (or the listed agent ending in "search-worker"), with no model parameter: the agent itself is set to Haiku 5.5 (claude-haiku-5-5), and a model parameter would override that. Only if it is not listed but the tool exists: read references/worker.md and paste it at the top of the brief for a general-purpose sub-agent, model "haiku" (don't read it otherwise). Never another model for workers. No sub-agent tool, or a worker replies "NO SEARCH TOOLS" -> make the same calls yourself; keep the plan.
- Brief (self-contained; the worker sees nothing else): "User ran /better-search." + JOBS (exact calls and params; "after" for chained jobs; "read best N") + FACTS + LIMIT (Auto 250 words, Deep 400, research jobs 600).
- Write only the final version of each job; no half-rewritten lines.
- Helper budget (each helper must stay well under 100k tokens of context): count each brief before sending it. Rough sizes: search 5k (depth thorough 6k); read 1.5k per page with a question, 2k without, or 1k per 3,500 characters when max_chars is set (60,000 = 17k); read whole 17k per part; verify 2k per claim; research 6k; check 1.5k per url. "read best N" counts N pages. Keep each helper's jobs at 50k or less. More than that -> split into more helpers in the same message, by part of the question or by angle, keeping each search together with its own "read best". Never drop or shrink jobs to fit; spread them.
- Papers and long PDFs: specific facts -> read with a narrow question per group of related facts (several reads of one paper may go to different helpers); a question finds passages anywhere in the document. Understanding the whole document (summary, methods, limitations, "read this paper") -> "read whole" job (LIMIT 600 words for that helper). Long documents: one whole read per helper; parts after the first 60,000 characters go to further helpers as read jobs with start, counted separately.
- A digest lists NOT RUN jobs -> start a fresh helper with exactly those jobs (they ran out of room, not out of use).
- Independent workers in one message so they run together. Run them in the foreground (run_in_background false where offered) and wait for every digest before replying; never send the user an "it's still running" message. Never repeat a call a worker already made.
- An Agent result saying the report was "delivered as a message" means the digest is already in the conversation; don't load extra tools to fetch it.
- Digests are leads with quotes; you interpret. Need more from a page -> one read job with a narrower question.

Errors: "no API key" | "rejected the API key" | "out of credit" -> user updates key at the connector settings page (connector URL with /settings instead of /mcp). One engine unavailable -> continue, mention in one line. Login-walled pages (LinkedIn, Quora, paywalls) unreadable -> say so; person background -> type people.
