# Tavily via Composio Search "LLM Search" (COMPOSIO_SEARCH_TAVILY)

Settings: max_results 5, search_depth "basic", include_answer true. Extras: search_depth "advanced" for q1, q12 and q14. All calls were made through the Composio workbench (`run_composio_tool`), one at a time.

## Headline numbers
- Success: 20/20, with no retries.
- Latency: mean 2.67 s, median 2.55 s, range 2.16 to 3.80 s. Tavily's own `response_time` field was mostly 1.7 to 2.8 s, so Composio adds about 0.5 s.
- Mean score: 2.45 / 3, the lowest of the three toolkits in this run.
- Mean response size: 7,505 characters for 5 results. That is the largest of the three, because the response includes long content extracts plus the answer.
- Q1 caveat: my warm-up call was uncached and took 2.37 s, which is the figure recorded. The repeat in the main run took 0.34 s and returned `response_time: 0`, so it came from Tavily's cache.

## Evidence that it is Tavily
- The response carries `request_id` (a UUID), `response_time`, `answer`, `images`, `follow_up_questions` and `results[].score/raw_content/id`. These are exactly the fields of Tavily's /search API.
- Composio's output schema is literally named `TavilySearchResponse`, and it also declares `usage.credits` and `auto_parameters`. Neither was returned.
- The repeated query came back with `response_time` 0, which points to a Tavily cache.

## Best and worst questions
- Best (3): Q1 ISA (correct answer), Q4 Exa price ($7 per 1k, $4 per 1k for instant), Q5 Vercel, Q6 iCloud+, Q8 NI, Q12 Claude Code docs, Q13 Liquid Glass, Q17 Figma-to-site, Q19 Blender.
- Worst: Q10 YNAB/Starling scored 1. A 2024 Hacker News thread came top, and the answer admitted it could not confirm. Q16 jobs scored 2, with generic boards and a mechanical-design role. Q3 Dettol scored 2: the ingredients came from an Indian listing and Australian/Irish SDS PDFs.

## Strengths
- The `answer` field is a usable synthesis, and it was factually right on Q1, Q4, Q8, Q11 and Q19.
- The snippets are long extracts from the page, so an agent can often answer without fetching.
- Handled the typo query (Q20) by recognising it was about Claude Code.

## Limitations and quirks
- No dates on any result. There is also no region or country parameter, so it surfaced US Amazon, IG South Africa and US Woolite.
- It sometimes favours vendor or blog pages over official ones. Q14 ranked Tavily's own blog first, and Q6 put a blog above Apple.
- The answer can over-reach. On Q16 it quoted "936 Junior Designer jobs"; on Q18 it suggested Todoist and Trello as note apps.
- It returned near-duplicate pages, such as two Woolite product pages.

## Advanced depth (extras)
| Q | basic latency | advanced latency | Tavily response_time | Verdict |
|---|---|---|---|---|
| 1 | 2.37 s | 3.49 s | 3.03 s | Same quality, now with RBS/Fidelity |
| 12 | 3.66 s | 3.95 s | 3.32 s | Better: the answer lists the default Trusted domains |
| 14 | 2.96 s | 4.34 s | 3.91 s | Better: less vendor bias, includes a Firecrawl round-up |

Advanced took about 0.9 s more on average (3.93 s against 3.00 s) and returned about 30% more characters. It is worth using for specific technical questions.

## Cost
No per-call cost is shown. Tavily's public pricing is 1 credit per basic search and 2 per advanced search, billed through Composio.

## Best suited for
Quick factual questions where a ready-made answer plus extracts helps an agent. It is weaker for UK-local shopping and jobs queries, and for anything where dates matter.
