# composio_amazon (COMPOSIO_SEARCH_AMAZON)

Settings: amazon_domain "amazon.co.uk", page 1 (default, ~20 products per page). Query text used verbatim.

## Headline numbers
- Success rate: 20/20 calls returned OK (no errors, no retries); only 6/20 returned any products.
- Latency: mean 2.07 s, median 2.16 s (Q2 0.35 s is probably cached, as the same query was run once as a schema probe).
- Mean score: 0.25 / 3 (total 5/60).
- Mean response size: ~2,000 chars (12.7k for a full 22-product page, ~180 chars when empty).

## Best and worst
- Best: Q2 (score 3). 22 UK listings with GBP price, rating, review count and ASIN link. Exact matches ("Right Angle USB C to USB C Short Cable 0.2M", UseBean 0.2m right angle, aceyoon 90 degree 20cm with data sync) at positions 4 to 7. The top 3 were looser: 0.5m, 2m and a straight 20cm cable.
- Partial: Q3 (1), where the Dettol Protect 24 hour spray listing comes back at #2 but with no ingredients. Q7 (1) gives Woolite Dark product listings but nothing on how it works.
- Worst: 14 questions came back empty. Q9, Q11 and Q20 returned irrelevant products (AI voice recorders, project-management books, a remote-sensing book).

## Strengths
- Clean, structured product data: title, price (string and number), old price, rating, reviews, "bought in past month", Prime flag, thumbnail, link.
- Correctly localised to amazon.co.uk in GBP.
- Fast enough (~2 s) and reliable.

## Limitations and quirks
- Product catalogue only. Informational questions return empty results or junk matched on keywords, and it does not flag the junk as low confidence.
- Relevance ranking is weak for spec-heavy queries. Sponsored-looking or near-miss items come first, so you need to filter on the title.
- No product descriptions or ingredients, so it cannot answer "what is in X" questions.
- Some items have a null price (for example the Dettol 3-pack).

## Cost
No cost fields in responses. It runs on the Composio Search toolkit (no auth, not the shared wallet).

## Best suited for
UK product discovery and price checks when the query is clearly a product (cables, household goods). Use it as a shopping vertical, never as a general search.
