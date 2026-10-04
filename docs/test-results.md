# Test results: web-research skill (4 October 2026)

All 15 prompts in `test-prompts.md` were run, each by a fresh helper agent that loaded the skill and logged every tool call. Helpers had no subagent tool, so heavy jobs took the normal-chat route (Exa Agent). Four runs were cut short by a Claude usage limit and were rerun.

## Summary

| # | Test | Result | Main issue found |
|---|---|---|---|
| 1 | Blender Boolean shading | Pass | Parallel Reddit search: 11,000 characters, only 2 results on topic |
| 2 | Curve to Mesh twisting | Pass | Reddit search added nothing |
| 3 | Figma variable modes | Pass | Date filter would have hidden the key 2024-25 staff replies |
| 4 | Onboarding case studies | Pass | None. Rejected made-up "case studies" correctly |
| 5 | Dark patterns research | Pass | Linked Exa library pages instead of the papers |
| 6 | UK junior Blender jobs | Pass | `linkedin.com` in the site filter returned people profiles; recipe date window clashed with the user's |
| 7 | X reactions to Blender 5.2 | Pass | X results noisy; best X content came from a news article embedding posts |
| 8 | YouTube summary | Pass | One source labelled "well supported"; no guidance for transcripts over the limit |
| 9 | Specific PDF question | Pass | None |
| 10 | Latest Blender version | Partial | Called 5.2.2 "unconfirmed" when the official download page lists it |
| 11 | Add-on comparison | Pass | Exa Agent at `low` was thin (3 searches); Reddit thread reads returned no comments |
| 12 | LinkedIn profile | Pass | Skill said LinkedIn is unreachable, but Exa's people category returns profile data |
| 13 | Tablet worth it | Pass | Reddit reads returned no comments; very different `additionalQueries` got crowded out |
| 14 | Working at Framestore | Pass | Three Parallel searches at 20,000+ characters each |
| 15 | Wacom customer service | Pass | Parallel Reddit search 20,000 characters with off-topic threads |

Every run: no built-in web search or fetch; every Parallel search limited with `site:`; every Exa advanced search had `textMaxCharacters: 1` and a `highlightsQuery`.

## Fixes applied

1. **Reddit comments:** reading a thread often returns only the original post (5 of 6 in one test). Adding `/.json` to the thread address returns the comments (tested). `old.reddit.com` now needs a login.
2. **Parallel size:** at most 2 queries per Parallel search and 2 Parallel searches per question; for software help, one Reddit search unless community experience is asked for.
3. **"Latest" facts:** confirm the current version, price or status on the official page.
4. **Confidence labels:** added "primary source" for answers taken straight from the paper, transcript or official page.
5. **LinkedIn:** pages can't be opened, but Exa `category: "people"` returns profile data; use 3 to 5 results (each carries a 2,000-3,000 character block); check identity with shared names.
6. **Links:** link original papers and pages, not `exa.ai/library` pages.
7. **Jobs:** use the user's date window; don't put `linkedin.com` in the site filter.
8. **Search tips:** date filters suit news, jobs, releases and prices but can hide older definitive troubleshooting answers; very different angles go in separate calls, not `additionalQueries`.
9. **Pinning several addresses** works; check each one came back.
10. **X:** confirm the version with Exa before searching X; use news round-ups that embed X posts when X results are thin.
11. **Long transcripts:** say when a transcript fills the limit, or read again with a higher limit.
12. **Heavy jobs without helpers:** "compare the top N" goes to an Exa Agent at `auto` with a $1 budget (`low` was too thin).

## Known limitation of this test set

Several recipes in the skill use the same examples as the test prompts (Blender Boolean, Figma modes, onboarding case studies, dark-pattern papers, the ACM PDF). Those tests partly measure whether Claude copies the example. A second set of unrelated prompts would give a fairer measure.
