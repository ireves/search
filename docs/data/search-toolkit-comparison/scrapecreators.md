# ScrapeCreators (via Composio instant account), re-run 10 Oct 2026

The wallet was topped up and this run replaces the earlier 402-blocked attempt. No 402 errors occurred.

## Headline numbers (main run: SCRAPECREATORS_SEARCH_REDDIT, posts, relevance, timeframe all, trim on)
- **Success rate:** 20/20 calls succeeded with no retries. Each call returned 7 posts, a page size the provider fixes.
- **Latency:** mean 6.9 s, median 6.2 s, range 4.9 to 20.1 s. The outlier was Q2.
- **Mean score:** 1.45 out of 3.
  - Score 2: 11 questions.
  - Score 1: 8 questions.
  - Score 0: Q10 only.
  - No question scored 3, because Reddit is never the authoritative source.
- **Mean response size:** about 11,200 characters for 7 posts, with full selftext, score, comment count and dates.

## Best and worst questions
- **Best (score 2):**
  - Q1: r/FIREUK and other posts state the cash ISA limit drops to £12k from April 2027.
  - Q4 and Q14: practitioner benchmarks of search-API cost and accuracy, covering Exa, Tavily and Parallel (Aug and Sep 2026).
  - Q9: r/shortcuts threads on transcribing Voice Memos.
  - Q11: r/Supabase threads on pausing and how to prevent it.
  - Q15, Q17, Q18, Q19.
- **Worst:**
  - Q10 (score 0): seven Starling referral-code spam posts and nothing about YNAB.
  - Q2, Q3, Q7, Q16 (score 1): opinions, but no listings or facts.

## "What do people say" questions
This is where the tool is strongest.
- **Q15:**
  - It returned real, recent Reddit threads (Sep and Oct 2026). Adding "reddit" to the query did no harm.
  - An exact-match post, "Skills vs MCP servers vs plugins — the one test…" (r/ClaudeCode), appeared at rank 6.
  - The post gives a clear rule: a skill teaches Claude a method, while an MCP server gives it access to a system it cannot otherwise reach. It also says plugins are the packaging.
  - LIST_REDDIT_POST_COMMENTS (2.7 s) returned only 3 comments, one of which was "often a small CLI tool is better than an MCP". The thread has little engagement, so the post itself is the value.
- **Q18:**
  - It returned genuine "Notion alternative" and "Simplenote alternative" threads that name Obsidian, Fibery and Coda.
  - Several results are self-promotion by indie app makers (flagged).
- **Answers sit in comments.** The search returns only the posts, so getting the answers means one more call per thread for comments.

## Extras
- **YouTube** (region GB, about 2.0 to 2.3 s, 13 to 20 videos plus Shorts, with views, length and age):
  - **Q5 (score 2):** several direct "add environment variable in Vercel" tutorials, plus the official Vercel channel.
  - **Q9 (score 2):** relevant Voice Memos transcription tutorials.
  - **Q19 (score 2):** Blender tris-to-quads clips, mixed with promotion for a paid Quadify add-on.
- **LinkedIn posts, Q16** (11.6 s, 10 posts, score 2):
  - A recruiter post for a junior product designer role (UK media, 30 Sep 2026).
  - A post listing 10 junior UX and product roles that includes London (1 Oct 2026).
  - Some stale results (2023, Nov 2025) and some off-target ones.

## Strengths
- Recent, real community content with engagement signals.
- Very good for opinions, troubleshooting and comparisons.
- Tolerates typos reasonably well: Q20 still found Claude Code permission threads.
- The YouTube search is fast and rich.

## Limitations and quirks
- Reddit only, with no authoritative sources, so it is weak for facts, prices, product listings and official how-tos.
- Results are vulnerable to spam and referral posts (Q10) and to keyword false hits (r/GarageDoorService for "remote … access").
- No snippet extraction, so answers need comment calls.
- Page size is fixed at 7.

## Cost
- Each tool's description says every page costs 1 credit. The responses do not report credits.
- This run used about 25 credits: 20 Reddit pages, 3 YouTube pages, 1 comment page and 1 LinkedIn page.

## Best suited for
"What do people say" questions, alternatives and recommendations, real-world troubleshooting, and finding video tutorials. Pair it with a general web search for facts.
