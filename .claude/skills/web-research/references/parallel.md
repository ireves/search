# Parallel tools: settings, recipes and quirks

Parallel is used **only for sources Exa can't find or read**, plus as the backup reader. This widens the search without duplicating Exa's results.

## Coverage (tested October 2026)

| Source | Exa | Parallel | Use |
|---|---|---|---|
| Reddit | Can't search or read | Searches threads; reading often returns only the original post (use the `/.json` trick below for comments) | **Parallel** |
| X (Twitter) | Can't search or read | Searches posts and reads profiles | **Parallel** |
| Glassdoor | Finds pages, but reads only the title | `site:` search extracts often already include review pros and cons; reading gives the overall rating and breakdown | **Parallel** |
| Trustpilot | Partial review text | Score, rating breakdown, dated reviews (long) | **Parallel** when detail matters, with a tight objective |
| Pages Exa refuses or returns thin or broken | n/a | Usually reads them | **Parallel** backup |
| Quora | Error page | Error page | Neither |
| LinkedIn profiles | Not found | Login wall | Neither |
| Everything else tested (Hacker News, Facebook groups, Instagram, TikTok, Threads, Bluesky, Steam, App Store, Amazon, YouTube, Substack, Medium, Stack Overflow, NYT, WSJ, BBC, Guardian) | Works | Works | **Exa only**, to avoid duplicates |

## `web_search`

| Option | Notes |
|---|---|
| `objective` | Plain description of what you're looking for. Keep it to one specific need |
| `search_queries` | **At most 2** short keyword queries (3 to 6 words). Each extra query adds thousands of characters. **Always start each with `site:` for the target platform** (`site:reddit.com`, `site:x.com`, `site:glassdoor.co.uk`, `site:trustpilot.com`). Different angles, not synonyms |
| `session_id` | Generate one random value (UUID or 32+ hex characters) at the start of the conversation and reuse it on every Parallel call. The response shows its own session ID; that's normal |
| `model_name` | The active model's identifier, if you know it. Analytics only |

With `site:reddit.com`, 10 out of 10 results stayed on Reddit in testing, but often only 2 or 3 were on topic. Ignore any result not on the target platform or not about the question.

**Size:** one search typically returns 9,000 to 22,000 characters and can't be trimmed. Limit yourself to 2 Parallel searches per question.

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

**Reaction to a release (X, then Reddit)**: confirm the version with Exa first; don't take it from this example.
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
In testing, 5 out of 6 thread reads returned only the original post. When that happens, read the same thread with `/.json` added to the end of the address. This returns the comments as raw data (comment text in `"body"` fields, with vote `"score"`), which the objective still filters:
```json
{"urls": ["https://www.reddit.com/r/blender/comments/1uvujby/unoffical_blender_52_release_discussion/.json"],
 "objective": "comment text: what commenters like and dislike about Blender 5.2"}
```
`old.reddit.com` addresses now hit a login wall; don't use them.

## Quirks found in testing

- Ignores dates written in the objective or queries ("September 2026" returned June and July posts). Check dates in the results yourself.
- Reddit results in search usually have no date; reading the thread returns it.
- Some Reddit pages include Reddit's own AI-generated "Related Answers" or "People also ask" summaries. These aren't user posts: don't quote them as community opinion, and skip off-topic threads padded with them.
- Reddit extracts in search are short (about 200 to 300 characters). Read the thread when the answer matters.
- X results are noisy: profile pages, cookie banners and posts from official accounts. Look for posts by individual users. If X results are thin, Exa can read news round-ups that embed X posts.
- The anonymous connector shares a free allowance and hits rate limits quickly. Connecting through `https://search.parallel.ai/mcp-oauth` with a Parallel account fixes this.
