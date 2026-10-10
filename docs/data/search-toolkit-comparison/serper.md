# Serper (via Composio): summary

**Tools:** SERPER_SEARCH_WEB (20 questions); SERPER_SEARCH_SHOPPING (extra, Q2)
**Settings:** country_code "gb", language_code "en", result_count 10, autocorrect true (default). Shopping used country_code "gb" and language_code "en".

## Headline numbers (web search, 20 questions)
- Success: 20/20 (no errors, no retries)
- Latency: **mean 1.61 s, median 1.48 s**, range 1.13 to 2.38 s. This was the fastest and most consistent of the three.
- Mean score: **2.45 / 3** (49/60). Eleven questions scored 3; two scored 1 (Q7, Q12).
- Results per query: 9.9. Mean response size: 4,270 chars, the leanest of the full-snippet tools.
- 34 of the 60 top-3 results are dated.

## Best and worst
- Best (3): Q1 (HL, then GOV.UK), Q4 Exa pricing, Q5 Vercel docs, Q6 Apple Support x2, Q8 GOV.UK x2, Q11 Supabase docs, Q13 HIG, Q15 Reddit, Q16 job boards, Q18, Q19.
- Worst: Q7 Woolite (Reddit and Facebook only) and Q12 Claude Code allowed domains (no official docs).
- Q14 differed from TinyFish: Reddit r/Rag, Firecrawl's Parallel alternatives (Sept 2026) and a fastcrw comparison. Still a 2.

## Shopping extra (SERPER_SEARCH_SHOPPING, Q2)
- 2.32 s, 40 products, 24k chars. Prices are in GBP from Amazon.co.uk, kenable and AliExpress, so it is properly UK-localised.
- Score 2: #3 and #5 are 0.2 m right-angle USB-C 20 Gbps extensions, but #1 is a 1 m charge cable.
- Links go to Google Shopping pages, not merchants, and some links are null.

## Strengths
- Fastest, with a tight spread. The output is clean and structured (organic, answer_box, knowledge_graph, people_also_ask, top_stories, related_searches, next_cursor).
- Google ranking: results are almost identical to TinyFish (55/60 top-3 overlap).
- Real UK localisation on Shopping.
- Simple cursor pagination.

## Limitations and quirks
- answer_box, knowledge_graph, people_also_ask, top_stories and related_searches were **null on all 20 queries**. The Composio wrapper seems not to populate them, or Serper returned none for gb. So no direct-answer text was available.
- Even with gl=gb, Amazon.com (US) came first for the cable question.
- No content fetch in this toolkit.
- Shopping links are Google redirect URLs rather than merchant URLs.

## Cost
The tool description says Shopping costs 2 credits per page; web search is presumably 1 credit. Responses report no credit count.

## Best suited for
High-volume, low-latency Google SERP lookups for agents, and UK product and price checks through Shopping. It is the best price/speed default if snippets and links are enough.
