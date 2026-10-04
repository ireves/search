# Test results: Composio version of the web-research skill (4 October 2026)

All 15 prompts in `test-prompts.md` were run against `.claude/skills/web-research-composio/`, each by a fresh helper agent that read the skill, used only Composio tools and logged every tool call. Exa, Reddit and Parallel were connected in Composio; the Twitter toolkit was not, so X went through Parallel. Helpers had no subagent tool, so prompt 11 took the "no helpers" route (Exa Agent at `auto`, $1 budget). The run used the "Expected behaviour" rules in the task brief, which replace the original column where they differ.

## Summary

| # | Test | Result | Main issue found |
|---|---|---|---|
| 1 | Blender Boolean shading | Pass | Sources mostly pre-4.1 (Auto Smooth removed); skill had no version check. Reddit comments came back |
| 2 | Curve to Mesh twisting | Pass | Reddit search in the subreddit was off-topic; agent ran a second search and read a weak thread to match the expectation |
| 3 | Figma variable modes | Pass | Recipe still carried a 2026 date filter; the helper ignored it. Staff replies conflicted (older "expected", August 2026 "bug") |
| 4 | Onboarding case studies | Pass | No recipe for portfolios plus company blogs; agency pages need a low-confidence flag |
| 5 | Dark patterns research | Partial | 2 searches of 8 papers (about 35,000 characters) were moved to the remote workspace; 9 of 16 hits were `exa.ai/library` pages and 3 papers ended up with no original link |
| 6 | UK junior Blender jobs | Pass | A closed listing slipped through the date filter; `maxAgeHours` placement on reads was unclear |
| 7 | X reactions to Blender 5.2 | Pass | Parallel X results thin (about 3 of 10 were ordinary users); best X content was an Exa news round-up. Reddit search off-topic |
| 8 | YouTube summary | Pass | None. Transcript 5,300 characters against a 6,000 limit, no stray profile |
| 9 | Specific PDF question | Pass | None. 1,254 sites (about 11.1%), 3,300 characters |
| 10 | Latest Blender version | Pass | None. Official page read gave 5.2.2 LTS (15 September 2026); search extract alone showed only 5.2.0 |
| 11 | Add-on comparison | Partial | `EXA_CREATE_AGENT_RUN` failed twice because the skill never showed the argument shape (`query` is top level). Run then worked: 37 searches, $0.63, about 3 minutes |
| 12 | LinkedIn profile | Pass | People results were 15,000 to 17,000 characters for 3 to 4 results (skill said 2,000 to 3,000 each); namesake ranked first and was correctly not exposed |
| 13 | Tablet worth it | Pass | A 5-keyword Reddit query returned nothing; shorter queries worked. Comments came back (8 each) |
| 14 | Working at Framestore | Pass | Parallel Glassdoor worked well (rating, breakdown, dated reviews). Reddit thread thin |
| 15 | Wacom customer service | Partial | Parallel read of Trustpilot gave score and review count, but the star breakdown came back garbled and there was no complaint summary |

Totals: 12 pass, 3 partial, 0 fail.

Every run: no built-in web search or fetch, no direct Exa or Parallel connector, no `composio_search` calls, no `COMPOSIO_SEARCH_TOOLS` calls, and independent calls batched. Every `EXA_SEARCH` had `contents.highlights` with a query and no `contents.text`. Every document read used `text: false` (or a `text.maxCharacters` limit for the transcript) and checked `statuses`. Every Parallel search had `include_domains`, `max_chars_total` and 2 queries; no run used more than 2 Parallel searches. Every Parallel read had an objective and `max_chars_total`, with `full_content` off. Reddit searches used `limit: 5` and comment reads `limit` 8 to 10, and comments came back every time.

## Parallel through Composio (first test)

| | X search (prompt 7) | Glassdoor search and read (prompt 14) | Trustpilot read (prompt 15) |
|---|---|---|---|
| Result size with the cap | 5,500 and 3,500 characters (cap 6,000) | 5,600 search (cap 6,000), 3,000 read (cap 4,000) | about 4,300 whole response, 3,500 of text (cap 4,000) |
| Site filter kept every result on the site | Yes: 11 of 11 on x.com. One was an unrelated article post | Yes: 5 of 5 on glassdoor.com | Not applicable (reads have no filter) |
| `mode` | Unset | Unset | Not available on reads |
| Cost shown | None. Only `usage: [{name: "sku_search", count: 1}]` | None | None (`sku_extract_excerpts`) |
| Content quality | Thin. Mostly the official account; cookie banners in excerpts | Rich: rating 3.7, 506 reviews, 62% recommend, category ratings, dated reviews | Score 1.5 and 264 reviews correct; breakdown garbled; raw reviews, no summary |

Other findings: argument names in the skill worked first time with no schema errors; `session_id` is optional (Parallel returned its own); `after_date` was respected; `publish_date` is sometimes null or stale; the read cuts off mid-sentence at the cap.

## Comparison with the original skill (`test-results.md`)

| Area | Original skill (Exa and Parallel connectors) | Composio version |
|---|---|---|
| Overall | 14 pass, 1 partial | 12 pass, 3 partial |
| Reddit comments | Reads often returned only the post (5 of 6); needed a `/.json` trick | Comments came back in every run (prompts 1, 2, 11, 13, 14) |
| Reddit search size | Parallel: 11,000 to 20,000 characters, often off topic | 5,000 to 10,000 characters; on topic in a subreddit for software help, weak for niche questions |
| Reading a document with a question | Needed a pinned-address search workaround | Direct read with highlights: 3,300 characters for the ACM answer |
| Latest version (prompt 10) | Partial: called 5.2.2 unconfirmed | Pass: official page read gave 5.2.2 |
| Parallel searches | 20,000+ characters, no cap | Capped: 3,500 to 5,600 characters |
| Glassdoor | Three searches at 20,000+ characters each | One search plus one read, about 9,000 characters, richer content |
| X | Noisy; best content from news round-ups | Same: thin results, best content from a news round-up |
| Trustpilot | 20,000 character Parallel search | One capped read; score right, breakdown unreliable |
| Heavy job | Exa Agent worked | Same, but the call shape was undocumented, costing two failed calls |
| Large results | Not an issue | One case moved to the remote workspace (paper searches) and an extra step needed; people search returned 15,000 to 17,000 characters |
| Extra steps | None | Reddit comments need a second call; moved results need a `jq` step |

Verdict: the Composio version is better on Reddit (reliable comments, smaller results), on Parallel size and on reading documents. It is not better on X, and it adds a Composio-specific cost (moved results, the undocumented Agent call). The two sets of tests are not identical: this run changed the expected behaviour for Reddit, X and LinkedIn, and the starting skill was different, so the pass counts are not a like for like score.

## Fixes applied

Skill files (`SKILL.md` and `references/`):

1. **Exa Agent call shape:** the task goes in a top-level `query`; `input` is only for rows (`data`, `exclusion`). Added a recipe, polling advice (`sleep 50` in the remote shell, poll about once a minute, early polls show $0) and a note that its ranking is a small-sample count. Schema checked against Composio after the run.
2. **Reddit:** 2 to 4 keywords after the subreddit (a 5-keyword query returned nothing); one retry then say Reddit had nothing; don't read comments from an off-topic thread; subreddit shortlist; `depth: 1` by default with `depth: 2` for follow-ups (the recipe said 2, Step 3 said 1); relative permalinks need `https://www.reddit.com`; softened "all 5 results were on topic"; release-reaction search advice.
3. **Software help:** check the app version against source dates (Auto Smooth was removed in Blender 4.1); use the release notes for "since version" facts.
4. **"Latest" facts:** read the official page with `maxAgeHours: 0`; batch the search and read when the address is obvious; stored search extracts can lag the live page.
5. **People searches:** each person is 2,000 to 6,000 characters, not 2,000 to 3,000; use 3 results; pair with a normal search to confirm identity; if the top hit is a namesake, report no match.
6. **Papers:** use 6 results per search; the DOI is in `entities[0].properties`; sketch of a `jq` line (marked as not tested as written); fallbacks when there is no DOI; dedupe by title.
7. **Jobs:** drop undated results unless the text shows a date; read the top 2 or 3 with `maxAgeHours: 0`; LinkedIn posts can appear without a site filter; `userLocation` doesn't exclude non-UK jobs.
8. **Forum recipe:** removed the `startPublishedDate` that contradicted the "avoid date filters for troubleshooting" rule; added a portfolio plus company-blog recipe; "primary source, self-reported" label; say "undated"; order conflicting sources by date.
9. **Content reads:** `maxAgeHours` is top level on reads; `statuses[].source` is `cached` or `crawled`; search results have no `statuses`; YouTube reads omit the description; a transcript shorter than the limit that ends with a sign-off is complete; fallback is `PARALLEL_EXTRACT_WEB_CONTENT` with an objective.
10. **X:** query in user voice; the Exa news round-up is a second step, not just a fallback.
11. **Exa and Glassdoor:** Exa now returns partial Glassdoor excerpts (no ratings); watch for other businesses with the same name; SEO spam in review pages.
12. **`references/parallel.md`:** marked as tested through Composio; removed "not yet tested"; recorded result sizes, the site filter result, `mode` and cost behaviour, result shape, and the Glassdoor, X and Trustpilot findings. `references/x.md` keeps "not yet tested" because the Twitter toolkit is still not connected.

## Not fixed, needs a decision

- **Cost of Parallel isn't visible in Composio.** Only usage lines appear, so spend has to be checked in Parallel's own dashboard.
- **X quality.** Parallel through Composio returned mostly the official account. Only the Twitter toolkit (paid per post, last 7 days) would fix that.
- **Trustpilot star breakdown** can't be trusted from Parallel; the skill now says to hedge.
- **The `jq` line for DOIs** hasn't been run as written.
- **Test set overlap:** several skill recipes still use the same examples as the test prompts (Boolean, Figma modes, onboarding, dark patterns, the ACM PDF), so those tests partly measure copying. Prompts 9 and 10 passed cleanly, but a second set of unrelated prompts would give a fairer measure.
