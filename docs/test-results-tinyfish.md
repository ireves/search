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

## 4. Accuracy test: 10 factual questions

Each question was asked once through both tools with the same wording. TinyFish returned 10 results, the Search connector 5. Each tool was scored only on what its results said, without opening pages. Answers were then checked against the live official page.

| # | Question | Correct answer (source) | TinyFish | Search connector |
|---|---|---|---|---|
| 1 | Latest Python version | 3.15.0, 9 October 2026 (python.org) | Right in result 2. Results 6 and 9 said 3.14 and "3.14.0a5" | Right in result 1, with the date |
| 2 | Arm CEO and since when | Rene Haas, February 2022 (arm.com) | Right in result 1 | Right in result 1 |
| 3 | National Living Wage, 21 and over, from April 2026 | £12.71 (GOV.UK) | Result 1 snippet showed the old £12.21 rate; result 2 had £12.71. Result 4 said "right now it's £12.21" | Right in result 1 |
| 4 | WCAG 2.5.8 minimum target size | 24 by 24 CSS pixels (W3C) | Right in result 1 | Right in result 1 |
| 5 | Bank of England Bank Rate | 3.75%, held 17 September 2026 (Bank of England) | Right in result 1. One result (NatWest) was dated June with a "next review" already past | Right in result 1, with the next date (5 November) |
| 6 | Figma Professional, Full seat | $16 a month on annual billing (figma.com) | Right in result 1. Others gave $20 on monthly billing (not on the official page's default view) and one garbled "$3/editor" | Right in result 1, plus GBP prices (£14 annual, £18 monthly) from Figma's help centre |
| 7 | Height of Ben Nevis | 1,345 m (Ordnance Survey, via BBC and Guardian reports) | Right in result 1. Britannica's snippet only said "more than about 1340 metres" | Right in result 1, with the 2016 re-survey |
| 8 | Blender 5.3 release date | Expected 10 November 2026 (blender.org) | Result 1 gave only the beta end date; result 3 had 10 November. A Facebook result gave 2025 dates | Right in result 1 |
| 9 | Boiler Upgrade Scheme, air source heat pump | £7,500, or £9,000 for off-gas-grid homes until March 2027 (GOV.UK) | Right in result 1; £9,000 case in results 3 and 6 | Right in results 1 to 3, both amounts |
| 10 | Node.js current LTS | v24.21.0; v26 moves to LTS later in October (nodejs.org) | Right in result 2 | Right in result 1, and noted v26 becomes LTS soon. One result had stray paper details (an unrelated DOI) attached |

**Scores**

| Measure | TinyFish | Search connector |
|---|---|---|
| Right answer somewhere in the results | 10 of 10 | 10 of 10 |
| Right answer in the first result | 6 of 10 | 10 of 10 |
| Questions where at least one result gave a wrong or out-of-date figure | 6 of 10 (1, 3, 5, 6, 8, and a vague figure in 7) | 2 of 10 (an old Python 3.13 announcement in 1; stray details in 10) |
| Dates shown | None | Most results |
| Cost | Free | $0.008 a search |

**Findings**

- Neither tool got a fact wrong when its best source was read. The difference is in how much wrong or out-of-date text sits next to the right answer.
- TinyFish's errors came from short snippets: an official page's snippet can show an old row (GOV.UK showed last year's wage), and third-party pages repeat old figures. With no dates, there is no way to tell which is current without opening the page.
- The Search connector puts the official page first more often and shows dates, so the right answer is easier to pick out.
- A separate quick check with the Search connector's `fetch` (fresh download, question-focused, 700 characters) missed the answer on Python, Arm's start date, the wage and the Figma price: the passages it chose were the wrong parts of the page. A full read of the same pages found every answer. Short question-focused reads of official pages are not reliable enough to confirm a figure.
- Figma's monthly-billing price ($20) is not on the official pricing page's default view, so it could not be confirmed.

## 5. Fix to the fetch tool's question mode

The misses above came from pages read by Firecrawl, where the connector picks the passages itself (`relevantPassages` in `connector/lib/text.ts`). Two faults:

1. **Long blocks were cut from the top.** Pages were split only at blank lines, so a PDF or long table could be one block of 3,000 to 57,000 characters, and only its first part was kept.
2. **Echoes beat answers.** Blocks were ranked by how often they repeated the question's words. GOV.UK's "Previous rates" text (last year's £12.21) outranked the "Current rates" table (£12.71).

Changes:

- Long blocks are split into passages of about 600 characters; rows cut from a table keep the header row.
- The heading above a passage counts towards its score; words in the page title count for less; questions asking "how much", "when" and similar favour passages with figures; earlier passages win close calls; reference lists count for less; a few words match their close equivalents (tall and height, cost and price).
- A long passage is trimmed around its matching lines instead of from the top.
- With a question, `max_chars` is at least 2,500. Below that, the right passage was often left out.
- Workers now send one fetch per question when the pages are on different topics, since one question covers every page in a call.

Tested offline on full copies of 13 pages: the 7 from the accuracy test, plus 6 held-out pages chosen before the code was changed (GOV.UK VAT and income tax, HMRC interest rates, NHS vitamin D, Wikipedia's Mount Everest, and the arXiv paper). Each page had its own question; a check passed if the answer was in the passages returned.

| Size | Before | After |
|---|---|---|
| 700 characters | 5 of 14 | 8 of 14 |
| 2,500 characters | 11 of 14 | 13 of 14 |
| 4,000 characters (default) | 11 of 14 | 13 of 14 |

The remaining miss is Mount Everest at every size: the page is 159,000 characters and the height sits in a table row with none of the question's words. The test copies came from TinyFish, not Firecrawl, and the fix has not been tested on the deployed connector yet. Exa and Parallel pick their own passages, so only the 2,500 floor applies to them.

## 6. Verdict

TinyFish should not replace the Search connector. It is weaker at finding by meaning, gives no dates, ignores date filters, and its reader has no length cap and fails on several sites the connector already reads.

It is worth adding in three narrow places:

1. **Papers:** `search` with `domain_type: research_paper`, free, alongside Exa's paper search.
2. **Bluesky and X profiles:** `fetch_content` as a reader where Firecrawl returns nothing.
3. **Pages that need clicks:** the browser agent with an output shape, for exact figures (star breakdowns, prices behind a selector), at a few pence a run.

## Not decided

- Whether to add TinyFish to the connector as a fourth engine, or only mention it in the skills.
- The browser agent's real charge, since the wallet balance did not drop during the test. Check the TinyFish dashboard.
- These are single runs. Search results can vary between runs.
