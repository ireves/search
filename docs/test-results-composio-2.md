# Test results: Composio version of the web-research skill, second set (4 October 2026)

All 15 prompts in `test-prompts-2.md` were run against `.claude/skills/web-research-composio/`, each by a fresh helper agent that read the skill, used only Composio tools and logged every tool call. Prompts 3, 10 and 11 used Sonnet; the rest used Haiku. Exa, Reddit and Parallel were connected; the Twitter toolkit was not. Helpers had no subagent tool, so prompt 10 took the "no helpers" route (Exa Agent at `auto`, $1 budget). Runs were in three groups of five. Two helpers needed handling: prompt 4 returned only a short summary with no log, so it was rerun once; prompt 5's helper failed while sending its report, but the full report came back in the failure notice, so it was used and not rerun.

## Summary

| # | Test | Result | Main issue found |
|---|---|---|---|
| 1 | DaVinci Resolve H.265 stutter | Partial | Good Exa and Reddit use, but no check of the Resolve version (sources from 2020 and 2022), and an unsupported "proxies solve 80%" claim |
| 2 | Cinema 4D cloth drape | Partial | Cited R25 documentation and did not flag that the simulation tools changed in later releases; Reddit ran up front, not only because Exa was thin |
| 3 | Product Designer jobs | Pass | Fresh reads, date filter and per-site report all done. "Confirmed open" was weak (no closed notice, not a real confirmation) |
| 4 | Salaries and agency vs in-house | Partial | Gave "yes, worth it" more firmly than the sources allow; guessed a wrong subreddit (0 results); opinion and figures mixed. Needed a rerun for the format |
| 5 | Empty states | Partial | Exa only, as expected, but examples included a desktop dashboard and Notion rather than mobile apps, and "measurably increases activation" had no figure |
| 6 | Contrast and reading speed | Partial | Used 8 results (not 6) and a second search; most papers had no DOI link and one study was unnamed. The `jq` line worked as written |
| 7 | WCAG 2.5.8 | Pass | 24 by 24 CSS pixels, all five exceptions, one read, about 2,100 characters |
| 8 | Config 2026 talk | Partial | Found the talk and read the transcript, but the transcript was cut off at the limit and the answer did not say so |
| 9 | Figma Professional price | Fail | Pricing page read gave USD only; the answer cited a Help Center page that had returned a 404, left a £14 vs £12 conflict open, and said nothing about VAT |
| 10 | Portfolio builders | Partial | Exa Agent worked ($0.61, 32 searches, about 5 minutes) and Reddit was good. Prices were not re-checked on official pages |
| 11 | Design lead at Monzo | Pass | Right person, identity confirmed, LinkedIn limit stated. The people search used a guessed job title and returned directors |
| 12 | Designer at Deliveroo | Partial | Three Reddit searches found nothing; the answer leaned on 2017 and 2018 blog posts without dating them in the text |
| 13 | Squarespace support | Partial | Reported the Trustpilot star percentages without hedging (the skill says they are unreliable) and did not say it was one platform's view |
| 14 | Designers on X about Figma | Partial | Never settled which announcement was "latest"; no Exa news step; no posts linked; "overwhelmingly positive" from about four posts |
| 15 | Quora | Partial | Correctly said Quora cannot be read, but made no tool calls and offered no Reddit or Exa alternative |

Totals: 3 pass, 11 partial, 1 fail.

Every run: no built-in web search or fetch, no direct Exa or Parallel connector, no `composio_search`, `linkedin` or `twitter` calls. Every `EXA_SEARCH` had `contents.highlights` with a query and none used `contents.text`. Every question-style document read used `text: false` and a highlights question. Parallel searches all used `include_domains` and `max_chars_total`. Only prompt 6 had a result moved to the remote workspace. The tool rules were followed well; the weaker results are mostly in the final answers (unsupported claims, missing caveats, wrong source choice) and are mostly Haiku-level slips.

## Prompt 3: job sites (searched 4 October 2026, window from 20 September)

| Site | Result | Confirmed open by reading |
|---|---|---|
| Welcome to the Jungle (Otta has merged into it) | Returned listings (Lendable, PetLabCo, NTT DATA) | 2 (Lendable undated) |
| Company career pages (Ashby boards) | Returned listings (Fyxer, Synthesia, Healf, Metaview, others) | 3 (Fyxer, Synthesia, Healf) |
| Indeed | Exa returned only US category pages. Parallel found UK listings but with no posting dates | 0 |
| Dribbble Jobs | Listings, but none were UK Product Designer roles | 0 |
| Working Not Working | None for the UK (Parallel gave one undated page) | 0 |
| LinkedIn | Could not be searched (stated without a call) | 0 |

In total 5 listings were read fresh and showed no closed notice; 4 of those carried a date inside the window. Metaview mixed London and San Francisco text and was left unconfirmed. The helper counted these as "confirmed", which is a weaker test than the skill implied; the skill now defines it.

## Prompt 7

Correct: 24 by 24 CSS pixels, with the five exceptions (spacing, equivalent, inline, user agent control, essential) and both notes. The answer linked the W3C page but did not use the words "primary source".

## Comparison with the first set

| Area | First set | Second set |
|---|---|---|
| Overall | 12 pass, 3 partial, 0 fail | 3 pass, 11 partial, 1 fail |
| Tool use | Rules followed | Rules followed just as well |
| Failure type | Tool shape problems (Agent call, moved results) | Answer quality: unsupported claims, missing caveats |
| Reading one document (prompt 7) | Pass (ACM PDF) | Pass (W3C page), one call |
| Exa Agent (prompt 10 here, 11 before) | Failed twice on call shape | Worked first time with the new recipe; took 5 minutes, not 3 |
| Reddit | Comments came back every time | Same. Subreddit guessing and employer topics with no coverage were the new problems |
| Parallel | Capped and on-site | Same. X remained thin (about 4 usable posts) |
| People search | Namesake ranked first | Right person, but the wrong job title was guessed |
| Prices | Not tested | Weak: the one price question failed |

The scores are not like for like. The second set has no copied examples to lean on, and 12 of 15 helpers were Haiku. Haiku skipped checks that the skill already states (version check, 6 papers, hedging the Trustpilot split). Treat the lower pass rate as partly a model effect: the fixes below mainly make those checks harder to miss.

## Fixes applied

`SKILL.md` grew by about 660 characters:

1. **Quora and other unreachable sources:** say so, then offer or run Reddit and Exa on the same question and say that is what was done.
2. **Prices:** state currency, tax and billing period; do not convert; check Exa Agent prices on official pages.
3. **X:** settle which announcement is meant (with its date) before searching, and say which was chosen.
4. **Answer rules:** cite only pages read successfully; no figures no source gave; keep figures and opinions apart and date each figure; say when a transcript was cut off; no "overwhelming" from a handful of posts.

`references/exa.md`: job sites that return the wrong country or only category pages count as "couldn't be searched reliably" (try Parallel on the local domain); merged boards; a definition of "confirmed open"; papers use one categorised search, 6 results, each named with its own link; "who leads X" runs a normal search first, then a people search with the name; Exa Agent `auto` takes 3 to 5 minutes (about 6 polls); Agent prices need a fresh official read.

`references/parallel.md`: do not report Trustpilot star percentages; X sample size and linking posts; employer accounts older than 2 to 3 years are dated, and a careers page is self-reported.

`references/reddit.md`: employers or niches with no coverage; don't guess subreddit names.

## Not fixed, needs a decision

- **Model for helpers.** Haiku skipped several checks. Using Sonnet for answer-heavy prompts (prices, comparisons, anything with caveats) would probably lift the pass rate, but costs more. Worth a rerun of prompts 1, 2, 4, 9 and 13 on Sonnet to separate model effect from skill gaps.
- **Prices in GBP.** The official pricing page returned USD only to a helper without a UK location. The skill now says to state this; it cannot fetch a UK-specific page unless a regional address exists. Decide whether that is acceptable.
- **Exa Agent speed.** The guide now says 3 to 5 minutes; earlier tests showed about 3. Run times may vary.
- **Skill changes untested.** The edits above have not been rerun against the prompts.
- **X quality** and **Parallel cost visibility** remain as in the first results file.
