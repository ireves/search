# OpenAlex (OPENALEX_QUERY_WORKS)

Settings: `search=<question>`, `per_page=5`, no `select` (full work records). Run sequentially in the Composio workbench, 9 Oct 2026.

## Headline numbers
- Success rate: 20/20 calls OK (no errors). 3 returned zero results (Q10, Q19, Q20).
- Latency: mean 1.26 s, median 1.04 s (range 0.79 to 2.78 s).
- Mean score: **0.20 / 3** (four questions at 1, the rest 0).
- Mean response size: ~69,000 chars for 5 records (up to 148k), because full work records include an inverted-index abstract, authorships, locations and so on. Use `select=id,title,doi,publication_date,cited_by_count` to cut this sharply.

## Per-question picture
- Scored 1 (loosely related only): Q8 (a 1998 UK study of Class 2 NI contributions), Q12 (an arXiv "Claude Code Complete User Handbook", Aug 2026), Q14 (2026 arXiv papers on agentic search and reranking, but no Exa/Parallel/Tavily comparison), Q15 (2026 arXiv papers on MCP tool descriptions and agent "skills", but no Reddit discussion).
- Scored 0: everything else. Consumer, product, how-to, jobs and pricing questions return unrelated papers (for example "Exa" matched exascale and exoplanet papers).
- Q19 (Blender trimesh to quadmesh) returned **zero** results, so it was not a partial win as expected. Q20 (typos) returned zero: no typo tolerance.
- Spam flag: Q6's top hit was a Zenodo "Warmy coupon code" SEO page. Zenodo deposits leak spam into results.

## Extra: fair academic query
"retrieval augmented generation web search agents evaluation" took 0.94 s, returned 5 results from 33,140 matches, and all were on topic and credible: "Evaluation of Retrieval-Augmented Generation: A Survey" (2025, 172 citations), "Active Retrieval Augmented Generation" (EMNLP 2023, 459 citations), "Benchmarking RAG for Medicine" (ACL Findings 2024, 276 citations), WeKnow-RAG (arXiv 2024) and a 2025 BISE RAG overview. Quality is **3/3 for literature discovery**. Ranking is by relevance, not recency.

## Strengths
- Fast and reliable (about 1 s), with DOIs, publication dates, citation counts, open-access links and author/institution metadata.
- Very good for finding scholarly literature, including recent arXiv preprints (2026 papers indexed).
- Rich filters (year, type, OA status), sorting, group_by and cursor paging.

## Limitations and quirks
- Not a web search engine. It is useless for consumer, how-to, product, pricing, jobs or community questions.
- It has no relevance floor: it returns noise rather than nothing when the query has no scholarly match.
- Its keyword search has no fuzzy matching, so typos or niche jargon give zero results.
- Abstracts come as an inverted index and must be rebuilt, and payloads are large unless you use `select`.
- Some spam reaches results through Zenodo.

## Cost
Keyword search showed no per-call cost in responses. The tool description says `semantic_search` costs $0.001 per call (not used). Composio instant-account calls draw on a shared Composio wallet: just after this run, calls started failing with 402 "Wallet balance is exhausted".

## Best suited for
Academic and research questions: literature reviews, finding papers, citation counts, research trends. Route to it only when the query is clearly scholarly.
