# Test results: SerpAPI through Composio (9 October 2026)

SerpAPI returns Google's results. It was tested through Composio's SerpAPI toolkit (Composio's shared "instant" account), using the same 10 factual questions as the TinyFish accuracy test in [`test-results-tinyfish.md`](test-results-tinyfish.md), section 4, plus four quality tests. 25 searches in all.

## 1. Which SerpAPI tool to use

| Tool | What came back |
|---|---|
| `SERPAPI_SEARCH` (Google) | Only 5 results, title and link only: no snippet, no date. It takes a query and nothing else. Some results did not match the query: "Arm Holdings CEO since when" returned unrelated companies with "Holdings" in their names; the wage question returned pages about the word "April". Not usable |
| `SERPAPI_GOOGLE_LIGHT_SEARCH` | 7 to 10 results with snippet, date (when Google shows one) and Google's answer box. Takes country, language, Google domain and result count. Used for the accuracy test below, set to google.co.uk |

## 2. Accuracy: 10 factual questions

Scored on the snippets only, as before. Correct answers were checked against the official pages on the same day.

| # | Question | Correct answer | SerpAPI (Google Light, UK) |
|---|---|---|---|
| 1 | Latest Python version | 3.15.0, 9 Oct 2026 | **Wrong.** Answer box: "3.14.0.a.5" (wpexperts.io). No result gave 3.15. python.org at 6, 8 and 9, but with old snippets |
| 2 | Arm CEO, since when | Rene Haas, Feb 2022 | Right in result 2 (Wikipedia). arm.com first, but its snippet has no answer |
| 3 | National Living Wage, 21+, April 2026 | £12.71 | Right in the answer box and result 1 (payfit.com). Result 5 (Facebook) gave last year's £12.21. No GOV.UK result |
| 4 | WCAG 2.5.8 target size | 24 by 24 CSS pixels | Right in result 1. Results 2 to 4 gave 44 by 44 (a different, stricter rule). No W3C result |
| 5 | Bank of England rate | 3.75% | Right in results 2 and 3 (one dated 17 Sept 2026). Result 4 said 3.0% (old). No Bank of England result |
| 6 | Figma Professional, Full seat | $16 a month, paid yearly | Answer box and result 1 (Reddit, Feb 2025): $20 a month. $16 only at result 8 (third party). figma.com at 2, 3, 7, 10 with no price |
| 7 | Ben Nevis height | 1,345 m | Result 1 (Reddit): 978 m, which is Scafell Pike. Results 2 and 4 gave 1,343 and 1,344 m. Right in result 3 |
| 8 | Blender 5.3 release date | 10 Nov 2026 | **Not found.** Best was the release candidate date (4 Nov) at result 3 |
| 9 | Heat pump grant | £7,500 (£9,000 off the gas grid) | Answer box: £2,500 (air-to-air, a different product). Right in results 3 and 4 |
| 10 | Node.js LTS | v24.21.0 | Answer box and result 1: Node 24 is LTS (right line, older patch, Oct 2025) |

| Measure | SerpAPI | TinyFish | Search connector |
|---|---|---|---|
| Right answer somewhere in the results | 8 of 10 | 10 of 10 | 10 of 10 |
| Right answer first | 3 of 10 (wage, WCAG, Node.js) | 6 of 10 | 10 of 10 |
| Google's answer box right | 2 of 5 (wrong: Python; misleading: heat pump grant, Figma) | n/a | n/a |
| Questions with a wrong or old figure in the results | 9 of 10 | 6 of 10 | 2 of 10 |
| Dates shown | Often | No | Most results |

The official source (GOV.UK, W3C, Bank of England) was missing entirely for 4 questions, despite the UK settings.

## 3. Quality tests

| Test | Tool | Result |
|---|---|---|
| Papers on cancellation dark patterns | `SERPAPI_SCHOLAR_SEARCH` | Excellent. 10 papers with authors, venue, year, citation counts and PDF links. The same list as TinyFish's paper search (both appear to use Google Scholar) |
| Bank of England news | `SERPAPI_NEWS_SEARCH` | Good. 10 articles from Reuters, CNBC, NYT, Morningstar and others, all from the last month, with relative dates ("3 weeks ago"). Headlines only, no snippets |
| Blender Boolean shading fix | `SERPAPI_GOOGLE_FORUMS_SEARCH` | A 6-word query returned nothing. A 3-word query returned 8 threads (Stack Exchange 2014, Reddit, Facebook, Blender Artists 2023, Quora) with dates for some. No vote or comment counts, despite the tool's description. Each result carries about 1,500 characters of icon data |
| Junior 3D artist jobs, UK | `SERPAPI_GOOGLE_JOBS_SEARCH` | 2 listings, both from job aggregators, no posting dates. The Search connector found 8 dated listings for a similar search |

## 4. Verdict

SerpAPI is Google as it appears to a person, with the same problems: answer boxes and top results that repeat old or wrong figures from third-party pages. It is the least accurate of the three tools on factual questions and should not replace the Search connector.

Worth considering only for:

1. **Google Scholar**, as a check on Exa's paper search (TinyFish's paper search, which is free, returns the same list).
2. **Google News**, for a quick list of recent coverage with dates.

Other notes: use Google Light, not the plain Google tool, through Composio; keep forum queries short; cost is not shown in the Composio responses.
