# composio_scholar (COMPOSIO_SEARCH_SCHOLAR)

Settings: query only, start 0 (first page, 10 results). Query text used verbatim. Google Scholar via SerpAPI.

## Headline numbers
- Success rate: 20/20 OK; 19/20 returned a full 10 results (Q10 returned 1).
- Latency: mean 1.27 s, median 1.25 s (range 0.8 to 2.0 s). The fastest of the Composio verticals.
- Mean score: 0.75 / 3 (total 15/60).
- Mean response size: ~7,700 chars (compact: title, link, pdf_link, authors, publication_year, citation_count, snippet, source).

## Best and worst
- Best: Q1 (2). Accountancy-firm budget PDFs that Scholar indexes (Autumn Budget 2025, Spring Statement 2026) correctly state the £20k ISA allowance and the £12k cash cap from April 2027.
- Useful snippets: Q11, where theses state "Supabase's free tier automatically pauses a project after seven days of inactivity" but say nothing on prevention. Q12 and Q20 return an arXiv "Claude Code Complete User Handbook" (2026) on permission and deny rules. Q17 returns theses on Figma-to-website pipelines and Figma Make.
- Worst: Q2, Q4, Q5, Q10, Q14 and Q16 scored 0 (robotics papers that mention USB-C, the GitHub search API, design-employment studies).

## Strengths
- Never empty and never errors. Fast and small payloads.
- Recent coverage is better than expected: 2026 arXiv papers on Claude Code, MCP and Liquid Glass appear.
- Typo tolerant: Q20 "clade code ... enviroment acces" still found Claude Code papers.
- Picks up grey literature (firm PDFs, theses, books), which sometimes contains real practical facts.

## Limitations and quirks
- Academic index, so how-to, product, job, Reddit and pricing questions get only tangential papers.
- Ranking matches keywords loosely. It always returns 10 results, so nothing signals "no good answer".
- Some items have no link (Q13's top Liquid Glass paper had null link and snippet). Snippets are fragments with ellipses.
- Dates are given as publication_year only.

## Cost
No cost fields in responses. It runs on the Composio Search toolkit (no auth, not the shared wallet).

## Best suited for
Finding papers, theses and reports, and occasionally an authoritative PDF on a policy topic. It is not a substitute for web search on everyday questions.
