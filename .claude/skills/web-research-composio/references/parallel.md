# Parallel through Composio: settings, recipes and quirks

Parallel is used **only for X (unless the X toolkit is set up), Glassdoor, detailed Trustpilot pages, and as the backup reader** for pages Exa can't read. Reddit now goes through the Reddit toolkit.

**Tested through Composio on 4 October 2026** (X search, Glassdoor search and read, Trustpilot read). The argument names below worked first time with no schema errors. The coverage table comes from earlier testing with Parallel's own connector.

## Coverage (tested October 2026 with Parallel's own connector)

| Source | Parallel | Notes |
|---|---|---|
| X (Twitter) | Searches posts and reads profiles | Noisy: profile pages, cookie banners, official accounts |
| Glassdoor | Search extracts often include review pros and cons; reading gives the overall rating and breakdown | Exa finds pages and partial excerpts, no ratings |
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
| `max_chars_total` | **Always set,** 6,000 for a search. **Tested: the cap holds** (3,500 to 5,600 characters came back; Parallel's own connector returned 9,000 to 22,000 with no way to trim) |
| `mode` | Left unset in every test; the default worked. `turbo` and `fast` are cheaper; `basic` and `advanced` cost 5 times more (not tested) |
| `session_id` | Optional. Not passing it worked: Parallel returned its own in the result |

Cost (Parallel's prices, charged to the connected Parallel account): $1 per 1,000 searches in `turbo` or `fast` mode, $5 per 1,000 in `basic` or `advanced`. **Composio shows no cost for Parallel**, only usage lines (`sku_search`, `sku_extract_excerpts`), unlike Exa's `costDollars`.

Result shape: `data.results[]` with `title`, `url`, `excerpts` (a list of fragments joined by "..."), `publish_date` (sometimes null, and not always the page's freshness), plus `search_id`, `session_id` and `usage`. An extract is nested one level deeper: `data.results[0].response.data.results[]`.

## `PARALLEL_EXTRACT_WEB_CONTENT`

| Option | Notes |
|---|---|
| `urls` | Up to 20 at once |
| `objective` | **Always set.** What to pull out (under 200 characters) |
| `max_chars_total` | **Always set,** 4,000 per page read. Tested: about 3,500 characters came back, cut off mid-sentence at the end |
| `advanced_settings.full_content` | Leave off. It returns the whole page (came back `null`) |

There is no `mode` or site filter on reads. The objective picks which fragments come back; it does not summarise them, so you have to do the summarising. Cost: $1 per 1,000 links. Don't use the older `PARALLEL_EXTRACT` or `PARALLEL_SEARCH` tools.

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
Ask for counts and themes, not every review. Tested on Wacom: the TrustScore (1.5) and review count (264) came back, but the star breakdown came back garbled (percentages fused to the star labels, and a reviewer's quoted figure contradicted it), so hedge on the exact split. The reply was raw review snippets mixed with advertisement fragments, with no complaint summary: summarise the themes yourself and say it is one platform's view.

**Backup reader** (when Exa's `statuses` shows an error or the extract is thin)
```json
{"tool_slug": "PARALLEL_EXTRACT_WEB_CONTENT", "arguments": {
  "urls": ["<the link Exa failed on>"],
  "objective": "<the precise question>",
  "max_chars_total": 4000}}
```

## Quirks

- **Site filter (tested):** `include_domains` kept every result on the target site (x.com: 11 of 11; glassdoor: 5 of 5). Posts on the right site can still be unrelated (an AI-agent article on x.com).
- **`after_date` (tested):** respected on X.
- **X (tested, Blender 5.2):** only about 3 of 10 results were posts by ordinary users. Most were the official account. Excerpts carry cookie banners and "Relevant people" boilerplate. Query in user voice ("just updated to blender 5.2"). The best X content came from an Exa news round-up (Creative Bloq) that embeds tweets: run that as the second step, not just a fallback.
- **Glassdoor (tested, Framestore):** a search plus one read returned the overall rating, review count, recommend and CEO approval percentages, category ratings on role-specific pages, pros and cons, dated reviews and reviewer role and tenure. Much richer than Exa.
- Earlier testing with Parallel's own connector: it ignored dates written in the objective or queries (use `after_date`); Trustpilot reads were long (the cap now keeps them down).
- `old.reddit.com` addresses hit a login wall. Reddit goes through the Reddit toolkit anyway.
