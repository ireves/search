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

## 15. Firecrawl on the pages both engines failed (October 2026)

Firecrawl's `/v2/scrape` (markdown, main content only) tried on the kinds of page that failed for Exa and Parallel, using the free plan.

| Page | Exa / Parallel | Firecrawl |
|---|---|---|
| Quora question | Error page from both | Full answers (the page starts with Quora's "Something went wrong" banner, but the answers follow) |
| FT article (free-registration article) | Nothing | Whole article text. Not tested on a subscriber-only article |
| LinkedIn profile | Failed | Refused: people profiles are a separate paid feature |
| Glassdoor reviews | Parallel worked | Full reviews |
| X profile | Parallel worked | Worked, but marked as 30 credits |
| Reddit thread, NYT | Parallel / Exa worked | Refused: "we do not support this site" (HTTP 403) |

Pages cost 1 credit each; pages that return 403 or 404 still cost 1; PDFs cost 1 per PDF page. The test used 11 of the 1,000 free monthly credits.

**Connector update:** Firecrawl reads pages first when its key is set, except Reddit, NYT, LinkedIn, X, PDFs and YouTube. Anything it can't read goes on to Exa and Parallel as before.
