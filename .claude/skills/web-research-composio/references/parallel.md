# Parallel through Composio: settings, recipes and quirks

Parallel is used **only for X (unless the X toolkit is set up), Glassdoor, detailed Trustpilot pages, and as the backup reader** for pages Exa can't read. Reddit now goes through the Reddit toolkit.

**Not yet tested through Composio** (the `parallel` toolkit wasn't connected when this was written). The settings below come from Composio's tool descriptions; the coverage notes come from testing Parallel's own connector. Check results closely the first few times.

## Coverage (tested October 2026 with Parallel's own connector)

| Source | Parallel | Notes |
|---|---|---|
| X (Twitter) | Searches posts and reads profiles | Noisy: profile pages, cookie banners, official accounts |
| Glassdoor | Search extracts often include review pros and cons; reading gives the overall rating and breakdown | Exa reads only the title |
| Trustpilot | Score, rating breakdown, dated reviews (long) | Use a tight objective |
| Pages Exa refuses or returns thin or broken | Usually reads them | Backup reader |
| Quora, LinkedIn | Error page or login wall | Neither service works |

## `PARALLEL_SEARCH_WEB`

| Option | Notes |
|---|---|
| `objective` | Plain description of what you're looking for. One specific need |
| `search_queries` | **At most 2** short keyword queries (3 to 6 words). Different angles, not synonyms |
| `advanced_settings.source_policy.include_domains` | **Always set** to the target site (`["x.com"]`, `["glassdoor.co.uk"]`, `["trustpilot.com"]`). This replaces typing `site:` into the query |
| `advanced_settings.source_policy.after_date` | `YYYY-MM-DD`. Useful for release reactions. Still check dates in results |
| `advanced_settings.max_results` | 5 to 10. More than 10 costs extra |
| `max_chars_total` | **Always set,** 6,000 for a search. Parallel's own connector returned 9,000 to 22,000 characters per search with no way to trim |
| `mode` | Leave unset until tested. `turbo` and `fast` are cheaper; `basic` and `advanced` cost 5 times more |
| `session_id` | Generate one random value at the start of the conversation and reuse it on every Parallel call |

Cost (Parallel's prices, charged to the connected Parallel account): $1 per 1,000 searches in `turbo` or `fast` mode, $5 per 1,000 in `basic` or `advanced`.

## `PARALLEL_EXTRACT_WEB_CONTENT`

| Option | Notes |
|---|---|
| `urls` | Up to 20 at once |
| `objective` | **Always set.** What to pull out (under 200 characters) |
| `max_chars_total` | **Always set,** 4,000 per page read |
| `advanced_settings.full_content` | Leave off. It returns the whole page |

Cost: $1 per 1,000 links. Don't use the older `PARALLEL_EXTRACT` or `PARALLEL_SEARCH` tools.

## Recipes

**Reaction to a release (X)**: confirm the version with Exa first; don't take it from this example.
```json
{"tool_slug": "PARALLEL_SEARCH_WEB", "arguments": {
  "objective": "What 3D artists on X are saying about the Blender 5.2 LTS release, praise and complaints",
  "search_queries": ["blender 5.2", "blender 5.2 LTS cloth"],
  "max_chars_total": 6000,
  "advanced_settings": {"max_results": 8, "source_policy": {"include_domains": ["x.com"], "after_date": "<release date>"}}}}
```

**Employer reviews (Glassdoor)**
```json
{"tool_slug": "PARALLEL_SEARCH_WEB", "arguments": {
  "objective": "Employee reviews of working at Framestore: pros, cons, ratings",
  "search_queries": ["framestore reviews", "framestore employee reviews"],
  "max_chars_total": 6000,
  "advanced_settings": {"max_results": 5, "source_policy": {"include_domains": ["glassdoor.co.uk", "glassdoor.com"]}}}}
```
Then read the best page:
```json
{"tool_slug": "PARALLEL_EXTRACT_WEB_CONTENT", "arguments": {
  "urls": ["<Glassdoor review page>"],
  "objective": "overall rating, rating breakdown, common pros and cons, review dates",
  "max_chars_total": 4000}}
```

**Company review score (Trustpilot)**
```json
{"tool_slug": "PARALLEL_EXTRACT_WEB_CONTENT", "arguments": {
  "urls": ["https://www.trustpilot.com/review/www.wacom.com"],
  "objective": "TrustScore, number of reviews, star breakdown, and the three most common complaints in the latest reviews",
  "max_chars_total": 4000}}
```
Ask for counts and themes, not every review.

**Backup reader** (when Exa's `statuses` shows an error or the extract is thin)
```json
{"tool_slug": "PARALLEL_EXTRACT_WEB_CONTENT", "arguments": {
  "urls": ["<the link Exa failed on>"],
  "objective": "<the precise question>",
  "max_chars_total": 4000}}
```

## Quirks (from Parallel's own connector; recheck through Composio)

- Ignored dates written in the objective or queries. Use `after_date` and check dates in the results.
- X results are noisy. Look for posts by individual users. If X results are thin, Exa can read news round-ups that embed X posts.
- Trustpilot reads can be very long even with an objective.
- `old.reddit.com` addresses hit a login wall. Reddit now goes through the Reddit toolkit anyway.
