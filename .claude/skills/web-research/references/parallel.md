# Parallel tools: settings, recipes and quirks

Parallel is used **only for sources Exa can't find or read**, plus as the backup reader. This widens the search without duplicating Exa's results.

## Coverage (tested October 2026)

| Source | Exa | Parallel | Use |
|---|---|---|---|
| Reddit | Can't search or read | Searches and reads threads with comments | **Parallel** |
| X (Twitter) | Can't search or read | Searches posts and reads profiles | **Parallel** |
| Glassdoor | Finds pages, but reads only the title | Reads full reviews: pros, cons, ratings, role, date | Exa to find, **Parallel to read** |
| Trustpilot | Partial review text | Score, rating breakdown, dated reviews (long) | **Parallel** when detail matters, with a tight objective |
| Pages Exa refuses or returns thin or broken | n/a | Usually reads them | **Parallel** backup |
| Quora | Error page | Error page | Neither |
| LinkedIn profiles | Not found | Login wall | Neither |
| Everything else tested (Hacker News, Facebook groups, Instagram, TikTok, Threads, Bluesky, Steam, App Store, Amazon, YouTube, Substack, Medium, Stack Overflow, NYT, WSJ, BBC, Guardian) | Works | Works | **Exa only**, to avoid duplicates |

## `web_search`

| Option | Notes |
|---|---|
| `objective` | Plain description of what you're looking for. Keep it to one specific need |
| `search_queries` | 2 or 3 short keyword queries (3 to 6 words). **Always start each with `site:` for the target platform** (`site:reddit.com`, `site:x.com`, `site:glassdoor.co.uk`, `site:trustpilot.com`). Different angles, not synonyms |
| `session_id` | Generate one random value (UUID or 32+ hex characters) at the start of the conversation and reuse it on every Parallel call |
| `model_name` | The active model's identifier, if you know it. Analytics only |

With `site:reddit.com`, 10 out of 10 results stayed on Reddit in testing. Ignore any result not on the target platform.

Cost: about $0.001 per call.

## `web_fetch`

| Option | Notes |
|---|---|
| `urls` | Up to 20 at once |
| `objective` | **Always set.** What to pull out (under 200 characters). Keeps the result focused |
| `search_queries` | Optional; pass the queries that found these URLs |
| `full_content` | Leave off. When on, the page text is returned twice and can run to tens of thousands of characters |
| `allow_live_fetch` | Leave on for fresh content. Set `false` for faster cached-only reads |

A focused read can take around 20 seconds on a page Parallel hasn't seen recently.

## Recipes

**Software troubleshooting (Reddit)**
```json
{"objective": "Reddit threads where Blender users explain working fixes for shading artifacts after the Boolean modifier",
 "search_queries": ["site:reddit.com blender boolean shading artifacts", "site:reddit.com blenderhelp weighted normal boolean"]}
```

**Buying advice or "is it worth it" (Reddit)**
```json
{"objective": "Reddit users' first-hand experience choosing a drawing tablet for Blender sculpting, including regrets",
 "search_queries": ["site:reddit.com drawing tablet blender sculpting", "site:reddit.com huion vs wacom blender"]}
```

**Reaction to a release (X, then Reddit)**
```json
{"objective": "What 3D artists on X are saying about the Blender 5.2 LTS release, praise and complaints",
 "search_queries": ["site:x.com blender 5.2", "site:x.com blender 5.2 LTS cloth"]}
```

**Employer reviews (Glassdoor)**: find with Exa or Parallel, then read with Parallel:
```json
{"urls": ["https://www.glassdoor.com/Reviews/Employee-Review-Framestore-E139697-RVW101097830.htm"],
 "objective": "role, date, rating, pros and cons given by the employee"}
```

**Company review score (Trustpilot)**
```json
{"urls": ["https://www.trustpilot.com/review/www.wacom.com"],
 "objective": "TrustScore, number of reviews, star breakdown, and the three most common complaints in the latest reviews"}
```
Trustpilot reads can be very long even with an objective. Ask for counts and themes, not every review.

**Read a Reddit thread for the answers**
```json
{"urls": ["https://www.reddit.com/r/blenderhelp/comments/uxq2kk/weird_edges_after_boolean"],
 "objective": "all fixes suggested by commenters, and whether the poster said it worked"}
```

## Quirks found in testing

- Ignores dates written in the objective or queries ("September 2026" returned June and July posts). Check dates in the results yourself.
- Reddit results in search usually have no date; reading the thread returns it.
- Some Reddit pages include Reddit's own AI-generated "Related Answers" or "People also ask" summaries. These aren't user posts: don't quote them as community opinion, and skip off-topic threads padded with them.
- Reddit extracts in search are short (about 200 to 300 characters). Read the thread when the answer matters.
- The anonymous connector shares a free allowance and hits rate limits quickly. Connecting through `https://search.parallel.ai/mcp-oauth` with a Parallel account fixes this.
