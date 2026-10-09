# Test results: Composio Search (9 October 2026)

Composio's own search toolkit (`composio_search`) needs no account and has three general web searches, each from a different provider:

- `COMPOSIO_SEARCH_WEB`: Exa. Returns a written answer with numbered citations (8 sources), no snippets.
- `COMPOSIO_SEARCH_TAVILY`: Tavily. Ranked results with long extracts, an optional written answer, and site filters.
- `COMPOSIO_SEARCH_DUCK_DUCK_GO`: DuckDuckGo. About 11 results with snippets and dates.

It also has News, Scholar (Google Scholar through SerpAPI, already tested in [`test-results-serpapi.md`](test-results-serpapi.md)) and a page reader (`COMPOSIO_SEARCH_FETCH_URL_CONTENT`, Exa). The same 10 factual questions as the TinyFish and SerpAPI tests were used, plus six quality tests. 36 calls in all; each took 1.5 to 5 seconds.

## 1. Accuracy: 10 factual questions

"Answer" is the tool's written answer. For DuckDuckGo, which has none, the snippets are scored as before.

| # | Question | Correct | Web (Exa) answer | Tavily answer | DuckDuckGo |
|---|---|---|---|---|---|
| 1 | Latest Python version | 3.15.0, 9 Oct 2026 | Right, citing blog.python.org (dated today) | **Wrong:** "3.14 … released 7 October 2025" (from liquidweb.com) | Right in result 1 (python.org, dated today) |
| 2 | Arm CEO, since when | Rene Haas, Feb 2022 | Right (arm.com, Wikipedia, Business Wire) | Right | Right in result 1 |
| 3 | National Living Wage, 21+ | £12.71 | Right, all 6 citations GOV.UK | Right | Result 1 is GOV.UK but its snippet has no figure; £12.71 at result 4 |
| 4 | WCAG 2.5.8 target size | 24 by 24 CSS pixels | Right, citing W3C first | Right | Result 1 is W3C, no figure in snippet; right at 2 |
| 5 | Bank of England rate | 3.75% | Right, with the meeting date (16 Sept) and next date (5 Nov); all citations Bank of England | Rate right, but said "last held 30 July, next review 17 September" (out of date) | Right at result 2 (MoneySavingExpert, 17 Sept) |
| 6 | Figma Professional, Full seat | $16 a month yearly ($20 monthly) | Right, both prices | Right ($16) | figma.com first, no price in snippet; $16 at result 5 |
| 7 | Ben Nevis height | 1,345 m | Right, with the 2016 survey detail | Right | Right in result 1 |
| 8 | Blender 5.3 release date | 10 Nov 2026 | Right, with beta and release-candidate dates | Right | Right in result 1 (blender.org) |
| 9 | Heat pump grant | £7,500 (£9,000 off the gas grid) | Right, both amounts, citing GOV.UK | Right (£7,500) | GOV.UK first, no figure in snippet; £7,500 at result 3 |
| 10 | Node.js LTS | v24 (v26 becomes LTS on 28 Oct) | Right, including the 28 October change | **Contradicts itself:** "Node.js 26 is the current LTS line", then "Node.js 24 is the active LTS line" | Right in result 1 |

| Measure | Composio Web (Exa) | Tavily | DuckDuckGo | SerpAPI | TinyFish | Search connector |
|---|---|---|---|---|---|---|
| Right answer given | 10 of 10 | 8 of 10 (1 wrong, 1 contradictory; 1 more with out-of-date dates) | 10 of 10 somewhere in results | 8 of 10 | 10 of 10 | 10 of 10 |
| Right answer first (answer, or result 1) | 10 of 10 | 8 of 10 | 5 of 10 | 3 of 10 | 6 of 10 | 10 of 10 |
| Official source first | At least 7 of 10 | 0 of 10 | 8 of 10 | 1 of 10 | not counted | 9 of 10 |
| Dates shown | On most citations | No | Often | Often | No | Most results |

## 2. Quality tests

| Test | Tool | Result |
|---|---|---|
| Reddit: Blender Boolean shading fix | Tavily, limited to reddit.com | 4 of 8 on topic; the other 4 were unrelated threads (a game's voice chat, Disney films, dogs). No dates, no comment counts |
| Same | DuckDuckGo with `site:reddit.com` | 8 of 8 on topic. No dates, no comment counts |
| Personal blogs on terrain generation | Web (Exa) | 7 of 8 genuine personal or indie blogs, mostly 2025 and 2026, all dated. Matches the Search connector (8 of 8), which also uses Exa |
| Bank of England news, past month, UK | News | 10 articles (BBC, Guardian, FT, Reuters, Bank of England, Commons Library), all from the last month, with exact publish times and snippets. Better than SerpAPI's news (headlines only) |
| GOV.UK wage page, with a question | Page reader with a summary question | Correct one-line answer (£12.71) plus the page text, which included the current-rates table. 1.3 seconds |
| arXiv PDF, with a question | Page reader with a summary question | Worked, although the tool says it doesn't read PDFs. The summary had the right figures (4.9 vs 6.2 clicks) but mislabelled one pair: it called 3.5 and 5.8 clicks "American newspapers subscribing from Europe"; the paper gives those for American readers on American sites |

## 3. Verdict

- **Composio Web is Exa's answer service.** It was the most accurate tool tested, matching the Search connector: 10 of 10 right, mostly from official sources, with dates. Since the Search connector already uses Exa, it adds little except a ready-made written answer. Its answers should still be checked against the cited pages, as with any summary.
- **Tavily** wrote confident answers from out-of-date third-party pages (Python, Bank of England dates) and contradicted itself once. Its site filter let off-topic Reddit threads through. Not recommended.
- **DuckDuckGo** ranks official sites well (8 of 10 first) and shows dates, but its snippets often leave out the figure, so a page read is needed. A reasonable free backup.
- **News** is good for recent coverage: it has a time filter and country setting, and gives exact dates and snippets.
- None of the searches return Reddit comment counts.
