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
