# composio_shopping (COMPOSIO_SEARCH_SHOPPING)

Settings: gl "uk", hl "en", no price or sort filters. Query text used verbatim. Underneath it is the SerpAPI google_shopping engine (per search_metadata).

## Headline numbers
- Success rate: 19/20 OK. Q16 failed twice with HTTP 503 "We couldn't get valid results", ~95 s each attempt. Only 10/20 returned any products.
- Latency: mean 20.8 s and median 26.1 s across all 20. Across the 19 successful calls, mean 16.9 s and median 21.8 s. The split is bimodal: about 1 s when Google has shopping results, about 30 s when it has none (the backend waits ~25 s before returning "Fully empty").
- Mean score: 0.15 / 3 (total 3/60).
- Mean response size: ~52,000 chars. A full page is 200 to 300 KB, mostly filter blocks and SerpAPI token URLs.

## Best and worst
- Best: Q2 (2). 40 UK offers (Amazon.co.uk, eBay, OnBuy, kenable, u-buy) with GBP prices. Right-angle USB-C data cables appear, but the top 3 are loose matches (angled Lightning-era lead, straight short cable, 0.5m) and there is no exact 0.2m right-angle item in the top 15. Amazon vertical did better here.
- Q7 (1): 32 Woolite Dark offers from office-supply resellers, no explanation.
- Worst: Q3 Dettol returned nothing at all, even though it is a product query. Eight informational queries were empty after 30 s. The rest returned irrelevant products: Etsy printables, Hansard NI Bills, AI voice recorders, a Figma template bundle, Notion planner templates.
- Quirk: Q20's typo was corrected (it returned "The Claude Code Handbook" book), so Google's spell-correction works, but the result is still useless.

## Strengths
- Multi-retailer UK price comparison in GBP, with seller name, delivery info and rating where available.
- Fast (~1 s) when the query is a real product.

## Limitations and quirks
- Product links are google.com/search?ibp=oshop redirect URLs, not merchant URLs.
- Very slow failure mode: empty results take ~30 s, and the 503 took ~95 s per attempt.
- Huge payloads, so you need to trim to title, price and source.
- Keyword matching means informational queries surface junk products (printables, books, Etsy items).

## Cost
No cost fields in responses. It runs on the Composio Search toolkit (no auth, not the shared wallet).

## Best suited for
Price comparison across UK retailers for a known product name. Amazon (composio_amazon) gave tighter relevance and direct links for the one product query that both handled.
