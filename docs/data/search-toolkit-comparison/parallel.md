# Parallel (PARALLEL_SEARCH_WEB via Composio instant account)

**Settings:** mode=fast, objective = question text, search_queries = [question text], advanced_settings {location: "gb", max_results: 5}, default excerpt sizing. Sequential calls from the Composio workbench, timed with perf_counter.

**Mode note:** the instant (managed) account accepts only `mode=fast`. Turbo, Basic and Advanced all return HTTP 400 "Managed Parallel Search Web requires mode=fast". So every benchmark row uses fast, and the Basic/Advanced comparison for Q1, Q12 and Q14 could not be run. It was tried on Q1 and rejected; Q12 and Q14 were skipped to avoid wasted calls.

## Headline numbers
- Success rate: 20/20 (no retries needed, no 402 wallet errors)
- Latency: mean 1.05 s, median 1.05 s, range 0.89 to 1.32 s (very consistent)
- Mean score: 2.20 / 3 (nine 3s, seven 2s, three 1s, one 0)
- Results: always 5. Response size: mean 12.0k chars, median 13.4k chars
- Cost: $1 per 1,000 requests in fast mode (from the tool description), so about $0.02 for the 20 queries. The response includes `usage: [{sku_search: 1}]` but no dollar figure.

## Scores
3: Q1, 4, 5, 6, 8, 11, 12, 17, 19 · 2: Q3, 7, 9, 10, 13, 14, 16 · 1: Q2, 15, 20 · 0: Q18

**Best:** Q1 (GOV.UK factsheet quoting £12,000 from April 2027 in the snippet), Q6 (three Apple Support pages), Q8 (GOV.UK NI record and voluntary contributions), Q11 (Supabase pausing docs), Q12 (code.claude.com cloud-environments), Q17 (Figma Sites, then Framer).
**Worst:** Q18 (five copies of Notion's own App Store page in different locales), Q2 (read "0.2m" as 2m; US and UAE stores), Q15 (no Reddit at all; a Tracxn stub at #1), Q20 (typos understood, but only third-party GitHub/Stack Overflow, no official docs).

## Strengths
- Very fast and predictable (~1 s) and cheap ($1/1k).
- Strong at official documentation: GOV.UK, Apple Support, Vercel, Supabase, Blender manual, Claude Code docs, Exa pricing.
- Long, relevant markdown excerpts (often answer-bearing, e.g. Q1, Q11) and good for feeding an LLM.
- Handled the vague Q17 well, and the typo query Q20 was understood as Claude Code.

## Limitations and quirks
- Duplicates: the same page under tracking-param or `.md` variants (Q4, Q5, Q13), locale copies (Q9, Q18, Q19).
- Tracxn company stubs carrying `utm_source=parallel` turn up at #1 for Q14 and Q15: looks like a partner/spam source.
- `location: gb` has a weak effect: US Woolite, US Belkin and UAE UGREEN pages appear.
- Ignores site intent such as "reddit"; recommendation queries (Q18) can collapse onto the named product.
- Dates are sparse (about 1 in 6 results) and sometimes misleading (a 2014 first-publish date on a current GOV.UK page).
- No direct answer text; you get excerpts only.
- On the Composio instant account you are locked to fast mode, so the higher-quality Basic/Advanced modes cannot be tested or used.

## Best suited for
Low-cost, low-latency grounding for agents on factual or documentation lookups where official sources exist. Less good for shopping/product specifics, community-opinion (Reddit) queries and "alternatives to X" recommendations. Pair with domain filters or a deduplication step.
