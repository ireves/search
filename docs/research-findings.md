# Exa and Parallel: research findings

Research for a Claude skill that replaces Claude's built-in web search with Exa (first choice) and Parallel (backup, plus Reddit and X).

Tested on 4 October 2026 through the Exa and Parallel connectors in a Claude Code cloud session.

## 1. What each tool is for

| Tool | What it does | Best for |
|---|---|---|
| Exa `web_search_exa` | Finds pages by meaning, returns long extracts ("highlights") | Default search. Finding blogs, people, companies, docs, forum posts |
| Exa `web_fetch_exa` | Reads a known page as clean text | Reading pages, PDFs, **YouTube transcripts** |
| Exa `agent_run` | Runs its own multi-step research and returns a cited answer | Questions needing several searches, lists, comparisons |
| Exa `web_search_advanced_exa` | Search with domain, date and category filters | "Only from this site" or "only from last month" searches. **Not switched on in your connector yet** |
| Parallel `web_search` | Keyword-style search, returns short extracts | Reddit, X (Twitter), quick fact checks |
| Parallel `web_fetch` | Reads a known page, can focus on a stated goal | Reading Reddit threads in full, X pages, pages Exa can't open |

## 2. Test results

| Test | Exa | Parallel | Winner |
|---|---|---|---|
| Blender question, asked for Reddit | 0 Reddit results (Blender Artists and Stack Exchange instead) | 6 of 10 results from Reddit | Parallel |
| Open a Reddit thread | Refused (`SOURCE_NOT_AVAILABLE`) | Full thread with comments | Parallel |
| Latest Blender version | 5.2 LTS (missed the 5.2.2 patch), plus 5.3 due date | 5.2.2 LTS, 15 Sept 2026 | Parallel, slightly |
| Personal blogs on terrain generation | 8 genuine personal dev blogs | Spam PDF, Medium listicles, tag pages | Exa, clearly |
| Blender out-of-memory fixes | Good forum answers, some from 2017 | Stack Exchange and Reddit, mostly old | Draw |
| X posts about Blender 5.2 | None. Gave LinkedIn and Mastodon posts | 10 real X posts with dates | Parallel |
| Open an X profile | Refused | Worked | Parallel |
| YouTube video | **Full transcript** | Description and comment count only | Exa |
| PDF (arXiv) | Worked | Worked | Draw |
| Medium article | Worked | Worked | Draw |
| LinkedIn profile | Failed | Login wall | Neither |
| Exa agent, "5.2 vs 5.1 features" (minimal effort) | 6 cited points, 3 searches, $0.012 | n/a | Exa |

## 3. Limitations and quirks found

**Exa**
- Does not index or open Reddit or X at all. This confirms why Parallel is needed.
- Results are long. A 6 result search returned several times more text than Parallel's 10 results, which fills Claude's memory quickly.
- Does not honour dates reliably when asked in plain words ("2025 to 2026" still returned 2017 posts). The advanced tool has proper date filters.
- Indexes LinkedIn *posts* in search, but cannot open LinkedIn *profiles*.
- Words like AND, NOT and quote marks are ignored. It matches meaning, not exact words.
- The free plan has rate limits. The agent tool needs a signed-in account and costs money (very little at low effort).
- Long agent runs (over about 12 minutes) return a "still running" ID that must be checked again.

**Parallel**
- **Hit the free limit on the very first call through the anonymous connector.** Fixed by reconnecting at `https://search.parallel.ai/mcp-oauth` and signing in with a Parallel account. After that, 6 calls in a row (including 4 at once) all worked.
- With an account, search extracts are much longer than when anonymous (some single results over 10,000 characters), so results now take up more room in Claude's memory.
- Full-page fetch (`full_content`) returns the page text twice, once as extracts and once in full. Use goal-focused fetch unless the whole page is really needed.
- Weak at "find me things like this" searches. Returns low-quality pages.
- Reddit results often have no date, so recency is hard to judge. Fetching the thread does return its date.
- Ignores dates in the search wording. Asking for X posts from "September 2026" returned posts from June and July plus unrelated profiles.
- Reddit extracts in search are short (about 200 to 300 characters). Fetch the thread for the full answers.
- Focused fetch took 23 seconds on a fresh page. Full-page fetch of a cached page took under 1 second.
- Cost per call: $0.001 per search or page.

## 4. Lessons from Exa's own Claude skills

Sources read: Exa's official plugin skills ([`search`](https://github.com/exa-labs/exa-mcp-server/tree/main/skills/search) and [`exa-agent`](https://github.com/exa-labs/exa-mcp-server/tree/main/skills/exa-agent)), their [agent-skills](https://github.com/exa-labs/agent-skills) repo and the [X search skill](https://exa.ai/docs/reference/x-search-claude-skill).

1. **Describe the page, not the fact.** "Blog post by a practitioner comparing X and Y" works better than "X vs Y".
2. **Work out exact dates first.** Turn "last month" into real dates before searching.
3. **Match effort to the question.** One search for a simple fact. Several helpers searching from different angles for hard questions.
4. **Keep raw results out of the main chat.** Exa sends searches to cheaper helper agents, which return only a short summary. This matters given how long Exa's results are.
5. **Vary angles, not synonyms.** "Overrated" and "overhyped" find the same pages. "Skeptic view" and "practitioner view" find different ones.
6. **Results are matches, not proof.** Check that each result really answers the question.
7. **Agent: start at low effort**, give it a clear output format, and never call the results complete or exhaustive.
8. **On errors, say what's wrong.** Don't quietly switch to another search tool.
9. Result counts: 5 for a named thing, 10 for a narrow search, 15 for broad discovery, never over 25.

## 5. Suggested routing for the skill (draft)

1. Default to **Exa search**.
2. Use **Parallel search** when:
   - the question is about Reddit or X, or would benefit from user experiences (software help such as Blender)
   - Exa returns nothing useful
   - a very recent fact needs a second check
3. To read a page, use **Exa fetch** first. Use **Parallel fetch** for Reddit, X, or when Exa refuses a page.
4. Use the **Exa agent** for questions needing several searches, lists or comparisons. Start at minimal or low effort.
5. For software questions, run Exa and Parallel side by side: Exa finds forums and docs, Parallel finds Reddit.
6. Tell the user plainly when neither can reach something (LinkedIn profiles, logged-in pages).

## 6. Decisions needed before building

1. ~~Add a free Parallel API key?~~ Done: Parallel now connects through a signed-in account.
2. Switch on Exa's advanced search in the connector, for date and site filters?
3. Should the skill block Claude's built-in search entirely, or only prefer Exa and Parallel?
4. Where will you use it: Claude Code, the Claude app, or both? This changes how the skill is installed.

## 7. Round 2: niche software, design research and jobs

Tested on 4 October 2026, with Parallel connected through a signed-in account.

| Test | Exa | Parallel | Winner |
|---|---|---|---|
| Blender: Curve to Mesh profile twisting | Good forum answers (use Set Curve Normal, Z Up), mostly 2022 to 2025 | Official 5.2 manual, the same forum fix, a note that "Free" normal mode arrived in 4.1, and a related bug report | Parallel, slightly (more current) |
| Figma: variable modes resetting nested instances | Main forum threads from 2023 and 2024 | Same main thread plus 2026 threads, including a Figma staff reply saying it's expected behaviour, and the official help page | Parallel |
| Onboarding redesign case studies with real numbers | 6 genuine designer case studies with before and after figures | Mostly agency pages, a vendor blog, a Medium post and listicles. 1 good case study | Exa, clearly |
| Research on cancellation dark patterns | 4 different sources: CHI 2024 paper, 2022 journal study, 2024 regulator sweep of 642 companies, the 2019 Princeton crawl | The same CHI paper 6 times (different copies), plus one newer 2025 paper Exa missed | Exa (more variety). Parallel found the newest paper |
| Junior or mid 3D artist jobs, UK | 8 specific listings with dates, some with salaries (Framestore, Blue Zoo, Sanders Studios). 1 had already closed | Mostly job board search pages (Jooble, Indeed, Totaljobs) and a Vietnamese listing | Exa, clearly |
| Product designer jobs at London fintechs | 7 real listings on company job pages, with dates and some salaries | Some real listings, but also non-fintech roles, the job site's own careers page and a huge Indeed search page | Exa |
| Indeed connector (extra check) | n/a | n/a | Returned only 1 job for "Blender 3D artist" in the UK |

**Patterns**
- **Software help:** Parallel is a little better. It pulls in official manuals, bug reports and newer forum threads alongside the community answers. Exa's answers are good but older.
- **Design research and case studies:** Exa is much better. Parallel tends to return marketing pages and listicles.
- **Academic papers:** Exa gives more variety. Parallel repeats the same paper from several sites, but can surface newer papers.
- **Job listings:** Exa is much better. It finds the actual job pages, while Parallel finds job board search pages. Exa can still return closed listings, so check the page.
- **Size:** both now return very long results. A single Parallel result pointing at an Indeed search page was several thousand characters of tracking links.

**Routing update**
- Software questions: run both. Exa for community answers, Parallel for Reddit, official docs and the newest threads.
- Design research, case studies and papers: Exa only.
- Jobs: Exa first. Open each listing to check it's still open.

## 8. Reading long documents without overloading Claude's memory

Test: find the cancel-versus-subscribe click counts and the phone-only cancellations in a 30+ page research paper (arXiv 2309.17145).

| Tool | What came back | Answered the question? |
|---|---|---|
| Parallel fetch with a stated goal | About 10,000 characters of only the relevant passages, taken from all through the paper, including the results tables | Yes, fully (4.9 vs 6.2 clicks to cancel; WSJ and NRC needed a phone call) |
| Exa fetch, capped at 6,000 characters | The first 6,000 characters of the paper (title, abstract, introduction) | No. The cap cuts from the top, so the answer was never reached |

**Lesson:** for long documents, read with Parallel and give it a precise goal. Exa's fetch is fine for short pages, or when the start of the page holds the answer (articles, YouTube transcripts).

## 9. Exa API: question-focused reading (not available in the Exa connector)

Exa's `/contents` API accepts `highlights: { query, maxCharacters }` (passages matching a question, up to a length) and `summary: { query }` (a short summary focused on a question). The connector's `web_fetch_exa` only offers a plain length limit. Tested directly against the API with a temporary key.

| Test | Exa API | Parallel `web_fetch` with a goal |
|---|---|---|
| Research paper (stored by Exa already), highlights capped at 4,000 characters | 9 of 10 key facts in 3,905 characters. Under 1 second. $0.001 | All key facts in about 10,000 characters |
| Same paper, highlights capped at 10,000 characters | All 10 key facts in 7,055 characters | (as above) |
| Same paper, summary with a question | Correct short summary of the main figures. Missed the Dutch phone-only case. 3.6 seconds. $0.001 | n/a |
| Long PDF that Exa had to fetch fresh (regulator report) | Only 491 characters, broken into fragments with "..." gaps. 4 seconds | About 3,000 readable characters with the full context |
| Search with focused highlights (3 results, 1,500 character cap each) | About 2,800 characters in total, on-topic. $0.007 | n/a |

**Findings**
- On pages Exa already has stored, its question-focused highlights match Parallel and use less space.
- On freshly fetched PDFs it can return thin, broken extracts. Parallel was more reliable there.
- The same option on Exa's search keeps search results short, which addresses the size problem seen with the connector.
- Summaries are compact but can drop details. Fine for a quick check, not for anything that needs exact figures.

## 10. Exa advanced search tool (`web_search_advanced_exa`)

Tested through Exa's hosted connector server (`https://mcp.exa.ai/mcp?tools=web_search_advanced_exa`) with a temporary API key. It isn't switched on in the claude.ai Exa connector yet.

**Options it offers:** category (company, publication, news, pdf, github, personal site, people, financial report), include or exclude domains, published and crawled date ranges, must-contain or must-not-contain text, country, extra query wordings, highlights with a question and a length cap, summaries with a question, text length cap, freshness (`maxAgeHours`), and subpage crawling.

| Test | Result |
|---|---|
| Highlights switched on, nothing else | **Also returned the full text of every page.** 5 results = 39,000 characters of raw data |
| Same, plus `textMaxCharacters: 1` | 5 results = 8,500 characters in total. Extracts went straight to the fix. 3.6 seconds, $0.007 |
| Figma threads, forum only, published since 1 January 2026 | 5 threads, all from 2026, including two Figma staff replies. Matches or beats Parallel's earlier result |
| UK Blender jobs, published since 1 September 2026 | 8 listings, all posted in September 2026 (Framestore, Blue Zoo and others). 11.8 seconds |
| One specific paper (title as the search, arxiv.org only, question-focused highlights) | Found the paper; all 5 key facts in 3,905 characters. 1.9 seconds |
| Reddit only (`includeDomains: reddit.com`) | 0 results. Exa still can't reach Reddit |

**Quirks**
- Always set `textMaxCharacters: 1` (or another small number), otherwise full page text is sent too.
- Results come back as raw data rather than tidy text, which adds about 500 characters per result.
- Pages with no known date can still slip through a date filter.
- Costs about $0.007 per search, compared with $0.001 for a Parallel search.

**Verdict:** this fixes Exa's two biggest weaknesses from the earlier tests: oversized results and ignored dates. It should replace `web_search_exa` as the main search tool in the skill.

## 11. Stored copy vs fresh download (fairer test)

Run through the new custom Exa connector (`web_search_advanced_exa`), which now works in claude.ai. Each document was found by searching for its exact title on its own website, with question-focused highlights capped at 3,000 characters and full text switched off. "Fresh" = `maxAgeHours: 0` with a 30-second timeout.

| Document | Type | Stored copy | Fresh download |
|---|---|---|---|
| ICPEN regulator report (oaic.gov.au) | PDF | All 4 key figures, clean text. 1.9 s | All 4 key figures, identical text. 18.9 s |
| "Roach Motel" paper (arxiv.org/pdf) | PDF | All key facts. Some small "..." gaps in less relevant parts. 5.1 s | Same facts, slightly fewer gaps. 5.6 s |
| "Dark Patterns at Scale" (dl.acm.org) | Asked for the PDF | Returned the abstract page instead of the PDF. 2 of 5 key facts (the rest aren't in the abstract). 14 s | Same page, same result. 32.6 s |
| Blender manual, Set Curve Normal | Web page | Complete, clean. 3.3 s | Identical. 3.6 s |

Each search cost $0.007.

**Findings**
- The regulator PDF that came back as 491 broken characters earlier was complete both times here. So neither "PDF" nor "fresh download" explains the earlier failure. It was either a one-off glitch or something specific to the direct page-reading API, which I couldn't retest without a key.
- A fresh download gives the same quality but can take up to 10 times longer. The skill should use the stored copy by default and only ask for a fresh download when the page is likely to have changed recently.
- Searching for a document by title doesn't always land on the exact file. On the ACM site it chose the abstract page over the PDF. When the exact file matters, read the link directly with Parallel.
- The connector doesn't say whether a page came from the stored copy or a fresh download. Only the time taken hints at it.

## 12. Reading an exact link with Exa (pinning the address)

`includeDomains` accepts full web addresses, not just site names. Putting a document's exact address there makes the advanced tool read that one document with question-focused highlights.

| Document | Result |
|---|---|
| "Dark Patterns at Scale" PDF (`dl.acm.org/doi/pdf/10.1145/3359183`), which the title search had missed | Exact PDF returned. All 5 key facts (1,818 instances, 1,254 sites, about 11.1%, 234 deceptive instances, 183 sites). 4.5 s, $0.007 |
| Figma forum thread (exact thread address) | Exact thread returned, with the staff replies and the user workaround. 6.5 s |

**Routing update:** reading a specific link, long document or PDF now goes to **Exa first** (advanced tool, exact address pinned, question-focused highlights, full text off). Parallel's reader is the backup, and the first choice for Reddit and X links.

## 13. Exa Agent at Auto effort with a $1 cap

Question (test prompt 11): compare the 5 most recommended Blender hard-surface add-ons, with price, store, Blender 5.x compatibility, and what users praise and complain about. Structured output requested (5 rows with evidence links, coverage notes, known gaps).

| Measure | Result |
|---|---|
| Cost | $0.63 ($0.48 agent work + $0.15 for 30 searches). Under the $1 cap; finished normally (`schema_satisfied`) |
| Time | About 3 minutes. Each `agent_run` call waited about 50 seconds before saying "still running" |
| Output | Hard Ops/Boxcutter bundle, MESHmachine, Fluent 4, DECALmachine, KIT OPS 4 PRO, each with USD price, store link, best use, praise, complaints and 3 to 4 evidence links |
| Strengths | Version-specific compatibility (for example KIT OPS confirmed only up to Blender 5.0), honest gaps, notes that the list is a shortlist rather than a measured ranking |
| Weaknesses | User opinion came almost entirely from the store's own review pages; no Reddit (Exa can't reach it) and few independent forums. The citation list was long (about 10,000 characters) |

Compared with minimal effort (3 searches, $0.012), Auto did 10 times the searching for about 50 times the price, and produced a much more complete, checkable answer.

**Skill update:** minimal for a few sources, low for a list of known scope, Auto with a $1 cap for open-ended research, higher only on request. When Reddit opinion matters, add a Parallel search alongside the agent.

## 14. Which sources only Parallel can reach

Each site tested with Exa (`includeDomains` set to that site) and, where Exa looked weak, Parallel (`site:` search or `web_fetch` with an objective).

| Source | Exa | Parallel | Verdict |
|---|---|---|---|
| Reddit, X | Nothing | Full search and reading | Parallel only |
| Glassdoor | Finds review pages, reads only the title | Full review: role, date, rating, pros, cons | Parallel to read |
| Trustpilot | Partial review text, no score | Score, star breakdown, dated reviews (very long) | Parallel when detail matters |
| Quora | Error page ("Something went wrong") | Same error page | Neither |
| Hacker News, Facebook groups, Instagram, TikTok, Threads, Bluesky, Amazon reviews, Steam, App Store, YouTube, Pinterest, Substack, Medium, Stack Overflow | Results found, mostly useful extracts | Not needed | Exa only |
| NYT, WSJ | Articles found with a well-worded search (lead paragraph only) | Also found (one via an archive copy) | Exa only |
| FT | Nothing | Nothing | Neither |

`site:reddit.com` in Parallel kept 10 of 10 results on Reddit, so limiting Parallel with `site:` reliably avoids duplicating Exa. Some Reddit pages carried Reddit's auto-generated "Related Answers" text, which isn't user content.

**Skill update:** Parallel is now added alongside Exa for software help, buying advice, real-world experience, reactions to releases, creator posts, employer reviews and company review scores, but always limited to Reddit, X, Glassdoor or Trustpilot. Unrestricted Parallel web searches are no longer used.

## 15. Round 3: settings, costs and quality of the Search connector (5 October 2026)

Everything below was tested by calling the Exa and Parallel APIs directly with temporary keys, and then by running the connector's own tools against the live services. The test set had 16 everyday questions (facts, troubleshooting, opinions, news, papers, people, companies, jobs, prices), 14 pages to read (news, docs, a forum, a blog, a 30-page PDF, GOV.UK, Wikipedia, GitHub, Stack Overflow, YouTube, a shop page, an annual report, a review) and 2 research briefs. For the 8 hardest questions, every page any setting returned (about 200) was scored by hand: 2 = directly useful or authoritative, 1 = somewhat useful, 0 = off-topic, paywalled or junk.

### 15.1 Answers to the six questions

**1. Are we using everything useful that Exa and Parallel offer?** Mostly, with five gaps, now fixed:

- Parallel ran in its cheapest search mode (`fast`) with one automatically built keyword query. That lowered the quality of merged results below Exa on its own. Its `advanced` mode, which Parallel recommends for agents that can wait, found far better pages.
- Pages were read from stored copies. Stored copies of "latest" pages can be weeks old, so a "check the official page" step could confirm an out-of-date answer.
- Parallel's Responses API (a synchronous research agent, launched July 2026) wasn't used. It gave the best research value of anything tested.
- Exa's `deep-lite` mode wasn't used. It matched `deep` on price and did better on open-ended questions, in half the time.
- People results printed "[object Object]" because Exa changed the shape of its work-history data.

Settings tested and left out: Exa's "dynamic highlights" (see 15.3), Exa's `excludeSections` (made no difference), a positive `maxAgeHours` (returned the wrong document), Parallel's `basic` mode (worst on Reddit), Parallel's `high` research effort (no better than `medium` at five times the price), and Exa's `/answer` endpoint (cheap and quick, but leans on secondary sites; a candidate for later).

**2. Best parameters and combinations** (now the connector's defaults):

| Job | Engines and settings | Cost |
|---|---|---|
| General search | Exa `auto` + Parallel `advanced`, merged, 10 results, about 800 characters each | about $0.012 |
| Hard or obscure search | Exa `deep-lite` + Parallel `advanced`, 1,200 characters each | about $0.017 |
| Reddit, X, reviews | Parallel `advanced` limited to those sites, plus Exa for forums and review sites | about $0.012 |
| Papers, people, companies, jobs, filings | Exa only, with its category | about $0.007 |
| Read a page | Exa live download; with a question, only the matching passages (up to 4,000 characters) | about $0.001 a page |
| Check claims | Exa `auto` + Parallel `advanced` per claim, 4 independent sites | about $0.012 a claim |
| Research, quick / standard | Parallel Responses API, low / medium effort | about $0.01 / $0.05 |
| Research, deep | Exa Agent `medium` + Parallel Task `pro`, side by side | about $0.20 |

**3. Can the skill be clearer for cheaper models while staying flexible?** Yes. The everyday skill now opens with a numbered routing list ("first match wins") that maps each kind of question to one tool and its settings, with explicit defaults (for example 5 results for a single fact). Vague phrases such as "when needed" were replaced by rules, and the skill names the cases where a cheaper model typically goes wrong: trusting stale excerpts for "latest" facts, chaining many searches for comparisons, and treating a research agent's summary as proof.

**4. Is the skill writing as cheap as it can be?** Close to it, and further squeezing isn't worth it. The everyday skill is about 730 tokens and loads only when used. One search result costs about 2,000 to 2,300 tokens, so a rule that saves one unnecessary search saves three times the whole skill. Turning the text into symbols and abbreviations would save perhaps 200 tokens a load but makes smaller models more likely to misread a rule. The tool descriptions, which sit in every conversation where the connector is on, stayed at about 1,200 tokens.

**5. Can the server reduce clutter and the need for helper agents?** Yes, in four ways:

- Exa's page text was already clean. The clutter came from Parallel and from gaps in the connector's own clean-up: menu links with hover titles slipped through, and so did script-fallback notices, X and Reddit page furniture and paragraphs repeated on the same page. These are now removed. Exa's `excludeSections` setting changed only 1 of 14 pages, by 4%, so it isn't used.
- Copies of the same document (the same passages on another site, up to 40% of one result set) are now shown once.
- Reading with a question returns only the passages that answer it, from anywhere in a document.
- The research tool now returns a finished, cited answer in 10 to 60 seconds for one to five cents. That does the job of a helper agent without filling Claude's context with raw results, so the skills no longer suggest helper agents for searching.

**6. Best cost-to-quality ratio for most questions.**

| Kind of question | Typical calls | Cost | Context added |
|---|---|---|---|
| One fact | 1 search (5 results) | about $0.012 | about 1,200 tokens |
| Latest or current fact | 1 search + 1 live page read | about $0.015 | about 2,500 tokens |
| Opinion or experience | 1 or 2 searches (discussions, reviews) | $0.012 to $0.024 | 2,000 to 4,500 tokens |
| Comparison or several facts | research quick or standard + 1 verify | $0.03 to $0.08 | 2,000 to 3,000 tokens |
| Deep research report | research deep + 3 to 5 searches + 2 to 4 page reads + up to 2 verify calls | $0.30 to $0.50 | 15,000 to 25,000 tokens |

### 15.2 Search results

**Exa excerpt settings** (16 questions, 8 results each; every setting found all 14 checkable facts):

| Setting | Average characters per search |
|---|---|
| Fixed 900 characters per result, steered by the question (previous default) | 7,584 |
| Exa's own sizing (`highlights: true`) | 21,741 |
| Dynamic highlights, low | 5,164 |
| Dynamic highlights, medium | 7,664 |

Dynamic highlights spend one shared budget across all results. In practice they gave one or two pages most of it and left the others about 250 characters each (one comparison search: 5,130 characters on one page, about 250 on each of the other seven). That suits single-answer questions but loses breadth on comparisons and opinions, so fixed per-result budgets stay.

**Parallel excerpt sizes** without a cap were large (`fast`: 18,499 characters on average; one search returned 75,800 because of a 62,000-character annual report excerpt), so the connector keeps its caps.

**Engines and modes, scored by hand** (8 hardest questions, top 8 results, maximum 128):

| Setting | Score | Very useful results | Useless results |
|---|---|---|---|
| Exa `auto` alone | 100 | 40 | 4 |
| Exa `deep-lite` alone | 94 | 37 | 5 |
| Exa `deep` alone | 85 | 32 | 8 |
| Parallel `advanced`, connector's keyword query | 82 | 31 | 13 |
| Parallel `advanced`, two hand-written queries | 74 | 24 | 14 |
| Parallel `fast`, two hand-written queries | 61 | 21 | 24 |
| Parallel `fast`, connector's keyword query (previous) | 34 | 11 | 17 |
| Previous merge: Exa `auto` + Parallel `fast` | 86 | 32 | 10 |
| New merge: Exa `auto` + Parallel `advanced`, 10 results (out of 160) | 114 | 44 | 10 |

The mode mattered far more than the queries: Parallel `advanced` with the connector's own crude keyword query beat `fast` with hand-written queries. Exa `fast` costs the same as `auto` and returned 7 of the same 8 pages. On 8 obscure factual questions every mode found the answer, so the slower modes earn their keep on open-ended questions only. Parallel's best additions were official documentation (the Blender manual, Figma's help centre), newer pages (python.org's 3.14.8 release page) and counter-evidence (a BBC piece on firms where the four-day week failed).

**Reddit and X.** On Reddit-only searches, Parallel `fast` and `advanced` both stayed on topic; `basic`, which the connector used before, pulled in off-topic threads (r/sunglasses for "Blender") and page clutter. On X, every mode was dominated by official accounts.

**People and companies.** A people search for "Ton Roosendaal, founder of Blender" returned a different Ton Roosendaal; confirming identity matters. A company search for "Monzo, UK digital bank" returned Starling, Metro Bank and Nomo but not Monzo, because the company category finds companies *like* the description; "Monzo Bank, monzo.com" put Monzo first.

### 15.3 Reading pages

| Test | Result |
|---|---|
| python.org "latest release" page | Exa's stored copy: Python 3.14.7 (5 August). Live download: 3.14.8 (30 September), the correct answer |
| Live download of all 14 pages | All worked, in 0.4 to 4 seconds, with the same quality as stored copies |
| `maxAgeHours: 24` or `168` on the four-day-week PDF | Returned a Polish law paper from Exa's library under the PDF's address, three times out of three. `0` and no setting returned the right document |
| Live download of paper links (ACM, DOI, PubMed) | Timed out or refused; Exa's stored copies of the same links worked |
| Guardian article and PCMag review | Exactly 1,000 characters from Exa (a publisher limit); Parallel got 453 characters and nothing |
| Questions on 9 pages, Exa vs Parallel | Exa found the facts on 8 of 9 pages; on the 30-page PDF Exa found 6 of 6 key figures and Parallel 1 of 6 |
| `excludeSections` (header, navigation, footer and so on) | No change on stored copies; on live copies, 1 of 14 pages shrank by 4% |
| Parallel full page text | Kept menus as links with hover titles, which the connector's clean-up then missed |

### 15.4 Research agents (2 briefs: a 5-product comparison and a UK heat pump cost question)

| Option | Cost | Time | Verdict |
|---|---|---|---|
| Exa `/answer` | $0.005 | 3 s | Good short answer, mostly secondary sites |
| Parallel Responses, low | $0.01 | 9 to 18 s | Good; up to 31 sources |
| Exa Agent, low | $0.025 | 28 to 35 s | Answered one English brief in Spanish |
| Parallel Task, base / core | $0.01 / $0.025 | 2 to 4 min | Good |
| Parallel Responses, medium | $0.05 | 36 s | Excellent; found the newest audits and official statistics |
| Exa Agent, medium | $0.10 | 61 to 72 s | Excellent, used Ofgem's own figures; missed one 2026 audit |
| Parallel Task, pro | $0.10 | 97 to 104 s | Excellent, the longest report |
| Parallel Responses, high | $0.25 | 75 to 82 s | No better than medium |

Asking Parallel's Responses API for a JSON answer makes it number its citations against a source list. In free text it uses internal markers such as "[doc 103]" that can't be linked, and once in JSON it numbered citations from its own reading list and left the source list empty; the connector now removes numbers it can't link and lists the pages the agent used.

### 15.5 Old and new connector, end to end

The same 8 hard questions through both versions of the connector, scored as above:

| Version | Results | Score | Score per result | Characters |
|---|---|---|---|---|
| Before | 61 | 80 | 1.31 | 59,776 |
| After | 80 | 110 | 1.38 | 65,104 |

38% more useful material for 9% more text. Reading python.org's latest release page now gives 3.14.8 in 437 characters, where the previous version gave the outdated 3.14.7 in 4,043. Deep research took under 2 minutes and about $0.20 for two independent reports with working reference links.

### 15.6 Changes made

- Search: Parallel `advanced` instead of `fast`/`basic`/`turbo`; 10 results by default; Exa `deep-lite` for `thorough`; Parallel partner-database entries dropped; copies folded by content.
- Reading: live download first, then Exa's stored copy, then Parallel; published papers try the stored copy first (live downloads from ACM, DOI and PubMed failed in testing while stored copies worked); never the positive `maxAgeHours` that caused the wrong-document result; note for publisher-capped pages.
- Verify: Parallel `advanced`.
- Research: Parallel Responses API for `quick` and `standard`, with numbered citations; `deep` is Exa Agent `medium` + Parallel Task `pro` (about $0.20, down from up to $1.10); all agents told to prefer primary sources and use the task's language; report links kept.
- Clean-up: menu links with hover titles, script notices, X and Reddit furniture, repeated paragraphs, title echoes and tiny fragments removed.
- People results: readable work and education history, current roles first.
- One automatic retry after a rate limit; Claude often runs several searches at once, and Exa's limit was hit during testing.
- Skills: routing list, live reading for "latest" facts, research agents in place of helper agents, updated costs.

### 15.7 Limits of these tests

- Relevance scores are one person's judgement on 8 questions, and results vary between runs of the same search.
- Research options were compared on 2 briefs only.
- The separate-connectors skill (`.claude/skills/web-research`) wasn't changed, because it uses Exa's and Parallel's hosted connectors, which don't offer these settings.
