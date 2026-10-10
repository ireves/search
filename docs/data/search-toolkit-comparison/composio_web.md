# composio_web (COMPOSIO_SEARCH_WEB, Exa-backed)

Settings: query only (the tool has no other parameters: no region, count or date filters). Query text used verbatim. It returns `answer` (synthesised text with [n] citations) plus `citations` (8 per query, with title, url, publishedDate, image).

## Headline numbers
- Success rate: 20/20 OK, all with 8 citations and an answer. No 429s when run sequentially.
- Latency: mean 2.13 s, median 2.15 s (range 1.6 to 2.9 s), and that includes the generated answer.
- Mean score: 2.55 / 3 (total 51/60). The best Composio Search tool by far.
- Mean response size: ~3,400 chars (compact: no snippets, just the answer and citation metadata).

## Best and worst
- Score 3 (13 questions): Q1 (GOV.UK, answer exactly right), Q2 (0.2m right-angle USB-C cables, though amazon.ie rather than .co.uk), Q3 (dettol.co.uk with the full ingredient list: benzalkonium chloride + didecyldimonium chloride 0.25 g/100 g), Q4 (exa.ai/docs pricing: $4 per 1k Instant, $7 per 1k Fast/Auto, +$1 per 1k for extra results), Q5 (Vercel docs), Q7 (official Woolite), Q8 (three GOV.UK pages), Q11 (Supabase docs plus a GitHub keep-alive tool), Q12 (code.claude.com cloud-environments), Q13 (Apple Liquid Glass docs and WWDC), Q14 (Exa vs Parallel vs Tavily benchmarks), Q16 (live London listings with salary), Q19 (Blender Stack Exchange and the manual).
- Weak: Q10 (1). The answer says YNAB does not reliably support Starling direct import, sourced only from third-party sync sellers (BudgetSyncer, Sync for YNAB) with no YNAB help page, so it is possibly wrong or biased. Q15 (1): no Reddit threads, only dev.to and a GitHub repo.
- Middling (2): Q6 (the answer's steps are right but it cites the wrong Apple page), Q9 (third-party blogs only), Q17 (Framer and Figment, no Figma Sites), Q18 (niche vendor apps, not the mainstream picks), Q20 (typo understood; GitHub issues rather than the docs).

## Strengths
- Strong source selection: official docs and GOV.UK rank first for factual and how-to queries.
- Current: 2026-dated pages, and Q4 pricing is up to date.
- The answer text is usually accurate and well cited, so it often removes the need to click through.
- Typo tolerant, compact and fast.

## Limitations and quirks
- No snippets per citation, only the answer and titles. publishedDate is often missing.
- No region parameter. The UK focus came from the query wording, and Q2 surfaced amazon.ie.
- The answer can over-commit on thin, vendor-biased sources (Q10). Reddit-specific intent is ignored (Q15).
- Some near-duplicate citations (Framer x2, Medly x2).

## Cost
No costDollars or credits in responses. It runs on the Composio Search toolkit (no auth, not the shared wallet), with Exa underneath.

## Best suited for
General web questions, how-tos, documentation lookups and quick factual answers with citations. It is the sensible default among the Composio Search tools, with the verticals reserved for products, papers, images or tickers.
