# TinyFish (via Composio): summary

**Tools:** TINYFISH_SEARCH_WEB (20 questions); TINYFISH_FETCH_URLS (extra, Q6 and Q12 top URL)
**Settings:** location "GB", language "en", page 0, domain_type web, fetch_content false. There is no result-count parameter; it returns about 10 results.

## Headline numbers (search, 20 questions)
- Success: 20/20 (no errors, no retries)
- Latency: mean 1.92 s, median 1.83 s, range 1.37 to 3.13 s
- Mean score: **2.45 / 3** (49/60). Eleven questions scored 3; two scored 1 or less (Q7, Q12).
- Results per query: 9.9 on average. Mean response size: 5,428 chars.
- 33 of the 60 top-3 results carry a date, either absolute ("17 Sept 2026") or relative ("3 years ago").

## Best and worst
- Best (3): Q1 cash ISA (GOV.UK first, with a snippet that states the £12k/£20k answer), Q4 Exa pricing (exa.ai/pricing, $7/1k), Q5 Vercel docs, Q6 Apple Support, Q8 GOV.UK x2, Q11 Supabase docs, Q13 HIG Materials page, Q15 Reddit threads, Q16 job boards, Q18, Q19.
- Worst: Q7 Woolite (old Reddit and Facebook posts; woolite.us FAQ only at #5) and Q12 Claude Code allowed domains (GitHub bug, Reddit and YouTube; no official docs).
- Middling: Q17 found no mention of Figma Sites. Q20 tolerated the typos but read the query as "Remote Control" rather than cloud environment.

## Fetch extra (TINYFISH_FETCH_URLS)
- Q6 Apple Support guide: 2.06 s (provider-side 0.97 s), 3.9k chars response, 3.0k chars of clean markdown. It partly answers: it gives the Settings > iCloud > Custom Email Domain route and the icloud.com route, but the DNS steps sit on linked sub-pages. It also includes navigation boilerplate.
- Q12 GitHub issue #19087: 2.64 s, 6.1k chars, clean markdown with the published date. It does not answer the question (no default allowlist).

## Strengths
- Fast and consistent, with a narrow latency spread (never above 3.2 s).
- Google-quality ranking: the top-3 URLs overlap 55/60 with Serper and the #1 result is the same on 18/20 questions. URLs carry Google `srsltid`/`xstg` parameters, so this is almost certainly a Google-backed index.
- Gives a snippet and a date on most results.
- The same toolkit offers fetch, which renders pages to clean markdown in about 2 s. Useful for a search-then-read agent.

## Limitations and quirks
- No answer box, People Also Ask or knowledge graph fields.
- No control over result count.
- Gives "location GB" but the Amazon.com (US) listing still came first for the cable question.
- Leaves tracking parameters (`srsltid`, `xstg`) in the URLs.
- Inherits Google's weaknesses on vague or consumer queries (Woolite, Figma tool).

## Cost
Neither the responses nor the tool description give any cost or credit information (Composio instant account).

## Best suited for
A general-purpose agent web search that needs Google-grade results with snippets and dates, especially when paired with its own fetch for reading pages. It is practically interchangeable with Serper on quality and about 0.3 s slower.
