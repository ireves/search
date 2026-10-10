# Exa (via Composio, user's own Exa account)

**Tools:** EXA_SEARCH (main), EXA_ANSWER (extras, q4 and q13 only)
**Settings:** `type: "auto"`, `numResults: 5`, `userLocation: "GB"`, `contents: {highlights: true}`. Calls ran one at a time in the Composio workbench and were timed with `perf_counter`, so the times include Composio overhead.

## Headline numbers
| Metric | Value |
|---|---|
| Success rate | 20/20 (no errors, no retries) |
| Latency, mean / median | 2.77 s / 2.77 s (range 1.64 to 4.71 s) |
| Exa's own reported searchTime, mean | 2.15 s (Composio adds about 0.5 s) |
| Mean score (0 to 3) | **2.55** (12 x 3, 6 x 2, 2 x 1, 0 x 0) |
| Response size, mean / median | 14.4k / 12.0k chars (5 results with highlights) |
| Cost | $0.007 per search (costDollars on every response), so 20 searches cost $0.14. EXA_ANSWER cost $0.005 per call. Total spend $0.15. |

## Best and worst
- **Best (3):** Q1 cash ISA (GOV.UK policy paper dated 17 Sep 2026, legislation.gov.uk), Q3 Dettol (official UK page with the full ingredient list), Q4 Exa pricing, Q5 Vercel, Q6 iCloud+ custom domain, Q8 NI record (all GOV.UK), Q11 Supabase docs, Q12 Claude Code cloud docs, Q14 comparisons, Q16 live London jobs, Q19 Blender manual and Stack Exchange.
- **Worst (1):** Q15 returned no Reddit threads; it matched the words "reddit", "skill" and "MCP" (GitHub repos, MCP listings) and missed the intent. Q18 returned five obscure single-app landing pages and none of the mainstream picks (Obsidian, Bear, Apple Notes).
- **Middling (2):** Q7 Woolite (only US/CA marketing pages), Q9 (the Apple page is about Notes, not Voice Memos), Q10 (YNAB pages never confirm Starling; a third-party site contradicts YNAB), Q17 (Figma Sites appears only inside the Builder.io body text), Q20 (handled the typos but read the query as Remote Control rather than cloud network access).

## Strengths
- Very strong at finding official and primary sources: GOV.UK, vendor docs (Vercel, Supabase, Apple, Claude Code, Blender) and current material dated 2026.
- Handled typos well: Q20 "clade code remote enviroment acces denied" came back as Claude Code docs and anthropics/claude-code GitHub issues.
- The highlights are dense, query-relevant extracts. For Q1, Q3, Q4, Q19 and others the answer is in the snippet itself, so there is no need to fetch the page.
- Latency was steady with no failures. The cost is flat and predictable, and costDollars comes back in every response.

## Limitations and quirks
- **Duplicates:** the same page often appears more than once (Q4 has three near-identical exa.ai pricing pages; also Q12 .md copy, Q3 Morrisons twice, Q2 Pimoroni en-us/en-eu, Q19 manual versions). With only 5 results this costs coverage.
- **Empty highlights on JS-rendered pages:** for the Apple HIG and Liquid Glass pages (Q13), the highlight is just the page title repeated.
- **Dates:** most results have no publishedDate. GOV.UK pages show their original publication year (2012, 2014), which is misleading.
- **userLocation=GB is a soft signal.** Results still included Amazon.ie, Woolite US/CA and Woolworths AU.
- **Weak on discussions and recommendations:** forum, Reddit and "best app" queries drift to keyword-matched product or landing pages.

## EXA_ANSWER extras
| Q | Latency | Cost | Quality |
|---|---|---|---|
| 4 Exa price | 2.23 s | $0.005 | Correct and current: $4/1k instant, $7/1k fast/auto, up to 10 results, +$1/1k extra results. Cites exa.ai plus third-party pricing pages. |
| 13 Liquid Glass HIG | 2.30 s | $0.005 | A good, concise summary (a navigation layer that floats above content, use system components, Regular vs Clear variants, keep it out of the content layer). Cites developer.apple.com and WWDC25. This was better than the search highlights, which came back empty. |

EXA_ANSWER was as fast as or faster than search, cheaper per call, and about 3k chars per response. Citations include some mirrors and low-authority sites.

## Best suited for
An agent's default search for factual, documentation, official-source and current-affairs lookups, where highlights let it answer without fetching pages. EXA_ANSWER fits quick factual questions. It is less suited to Reddit/forum discovery, subjective "app like X" recommendations, and shopping by region without domain filters (use `includeDomains`, e.g. reddit.com or amazon.co.uk).
