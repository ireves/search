# Test results: TinyFish against the Search connector (9 October 2026)

TinyFish was tested through its claude.ai connector (`search`, `fetch_content` and the browser agent `run_web_automation`). The same tests were run on the same day through the current Search connector (Exa and Parallel, with Firecrawl reading pages first). Most tests repeat ones in [`research-findings.md`](research-findings.md), so older results are given too.

TinyFish prices at the time: search and page reading free, browser agent $0.016 a step, browser time $0.002 a minute.

## 1. Search

| Test | TinyFish | Search connector (today) | Earlier result | Winner |
|---|---|---|---|---|
| Blender Boolean shading fix, from Reddit | 10 of 10 on Reddit, one-line snippets, includes a 2026 thread | 4 Reddit, 3 Blender Artists, 1 Stack Exchange, with the actual fixes in long extracts. $0.012 | Parallel 6 of 10 Reddit; Exa none | TinyFish for Reddit only; Search connector for a usable answer |
| Latest Blender version | 5.2.2 LTS, 15 September 2026, in the snippet of result 3. Result 1 snippet showed 2020 releases | 5.2.2 LTS plus 5.3 due 10 November 2026. $0.007 | Parallel 5.2.2; Exa missed it | Both pass; Search connector more complete |
| Personal blogs on terrain generation | About 6 of 10 genuine blogs; also Reddit, Medium, LinkedIn, a tag page | 8 of 8 genuine personal or studio blogs, several from 2025 and 2026. $0.008 | Exa 8 genuine; Parallel spam and listicles | Search connector |
| X reactions to Blender 5.2 | 9 x.com results, mostly profile pages; about 3 real reactions from ordinary users | 8 results, almost all the official Blender account. $0.005 | Parallel 10 real dated posts | TinyFish, slightly (more ordinary users) |
| Figma variable modes resetting nested instances | 9 Figma forum threads and 1 Reddit thread, all on topic. No dates | 4 forum threads with dates (2024 to 2025) and 4 Reddit, 2 of them off topic. $0.012 | Parallel found 2026 threads and a staff reply | Draw (TinyFish more on topic; Search connector dated) |
| Onboarding case studies with numbers | 8 of 10 genuine designer case studies | 8 of 8 genuine, with the before and after figures in the extracts. $0.008 | Exa 6 genuine | Search connector, slightly |
| Junior 3D artist jobs, UK, since 1 September | Date filter not honoured: senior roles, board search pages, a Philippines job, a Facebook post | 8 dated listings from September 2026 (Framestore, Blue Zoo, Rebellion), pages re-downloaded. One in Prague. $0.007 | Exa 8 listings | Search connector, clearly |
| Papers on cancellation dark patterns (`research_paper`) | 10 distinct papers with authors, year, venue, citation count and PDF link (looks like Google Scholar). Includes 2025 and 2026 papers | 8 papers with DOIs and abstracts; 2 only as `exa.ai/library` links. $0.007 | Exa 4 sources; Parallel repeated one paper | TinyFish, slightly (more variety, PDF links) |

**Patterns**

- TinyFish search looks like Google results: short snippets (one or two lines), no publish dates, and leftover "Missing: ... Show results with" text in some snippets.
- Short snippets keep results small, but the answer is rarely in the snippet, so a page read usually follows.
- `include_domains` kept every result on the named site (Reddit, x.com, Glassdoor, NYT).
- `after_date` did not filter the jobs search.
- The `research_paper` type is the strongest part: authors, citations and direct PDF links in one call.

## 2. Reading pages (`fetch_content`)

| Page | TinyFish | Search connector (today) | Earlier result |
|---|---|---|---|
| Reddit thread | Full thread with comments and post date. 9 s | Not retested (Parallel reads Reddit) | Parallel worked |
| YouTube video | Footer links only. No transcript, no description text | Full transcript | Exa transcript |
| X profile | Recent posts in full, no dates. 1.6 s | Not retested | Parallel worked |
| Bluesky profile | About 30 posts with relative dates ("2mo", "1d") | Not retested | Firecrawl returned an empty page |
| Instagram profile | Name, bio and follower count only | Not retested | Firecrawl refused |
| LinkedIn profile | Blocked | Not retested | Failed everywhere |
| Quora question | Blocked | Answers read (via Firecrawl) | Firecrawl worked |
| Glassdoor reviews | Blocked | Rating 3.8, 508 reviews, category ratings (via Firecrawl) | Parallel and Firecrawl worked |
| Trustpilot | Refused (HTTP 403) | Score 1.2, 282 reviews, review text | Parallel worked; breakdown garbled |
| Tripadvisor | Full page: rating, star breakdown, dated reviews | Not retested | Firecrawl worked |
| NYT article | "Login required" | Not retested | Exa gave the lead paragraph |
| FT article | Blocked | Not retested | Firecrawl worked on a free-registration article |
| PubMed, JSTOR | Returned as success, but the text was a cookie or bot-check page | PubMed: page frame only, no abstract | Firecrawl hit the same bot checks |
| arXiv PDF, with a stated purpose | Whole paper, 99,000 characters. Answer present (4.9 vs 6.2 clicks) but `purpose` did not shorten it | Only the relevant passages, about 4,000 characters, including the phone-only cancellations (WSJ, NRC) | Parallel about 10,000 characters |

**Patterns**

- No length limit. A PDF came back at 99,000 characters and was too big to show; it had to be cut down with a script. `include_selectors` helps on web pages but not on PDFs.
- Blocked pages are reported clearly as errors, except bot-check and cookie pages, which come back as a success with junk text. The connector's existing short-page check would catch these.
- Reads Bluesky and X profiles well, where Firecrawl does not.
- Weaker than the Search connector on YouTube, Quora, Glassdoor and Trustpilot.

## 3. Browser agent (`run_web_automation`)

Task: the Wacom Trustpilot page, which TinyFish's reader refused and which Parallel read with a garbled star breakdown in earlier tests. Asked for the score, review count, the share of each star level and the 5 newest reviews, with a fixed output shape.

| Measure | Result |
|---|---|
| Result | Score 1.2, 282 reviews, stars 12% / 1% / 2% / 5% / 80% (adds up to 100%), 5 dated reviews from 28 August to 30 September 2026 |
| Steps and time | 5 steps, 27 seconds |
| Cost | About $0.08 at the listed rate (the wallet balance did not visibly change during the test) |

This is the one thing neither Exa, Parallel nor Firecrawl can do: click through a page and return exact figures in a set shape. It suits pages where the figure is behind a tab, button or filter.

## 4. Verdict

TinyFish should not replace the Search connector. It is weaker at finding by meaning, gives no dates, ignores date filters, and its reader has no length cap and fails on several sites the connector already reads.

It is worth adding in three narrow places:

1. **Papers:** `search` with `domain_type: research_paper`, free, alongside Exa's paper search.
2. **Bluesky and X profiles:** `fetch_content` as a reader where Firecrawl returns nothing.
3. **Pages that need clicks:** the browser agent with an output shape, for exact figures (star breakdowns, prices behind a selector), at a few pence a run.

## Not decided

- Whether to add TinyFish to the connector as a fourth engine, or only mention it in the skills.
- The browser agent's real charge, since the wallet balance did not drop during the test. Check the TinyFish dashboard.
- These are single runs. Search results can vary between runs.
