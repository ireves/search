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
| 6 | Contrast and reading speed | Partial | Used 8 results (not 6) and a second search; most papers had no DOI link and one study was unnamed. A `jq` line pulled fields from the moved results (not the DOI line as written) |
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

## Rerun with Sonnet (4 October 2026)

Prompts 1, 2, 4, 9 and 13 were rerun on the skill as edited earlier that day, one fresh Sonnet helper each, all five at once. All five finished first time, with no reruns. Tool rules were followed in every run: Composio only, highlights on every search, `text: false` on the one document read, Reddit inside a subreddit with `limit: 5`, Parallel on-site with `max_chars_total`.

| # | Haiku | Sonnet | Main issue (Sonnet) | Cause |
|---|---|---|---|---|
| 1 | Partial | Partial | Dated the sources and said Resolve is now on a later version than most of them, so older advice was flagged. It skipped the step that adds a search of the current manual, so the free-versus-Studio claims stayed on 2020 to 2024 forums | Model (skipped a stated step); the skill gave no site hint, now added |
| 2 | Partial | Pass | Cited both the older Cloth tag docs and the newer Simulation System docs and told the user to check which they use. Reddit ran up front and the thread read added nothing | Model. The Reddit timing is a skill inconsistency (the table says "alongside", the prompt table says "only if thin"), left as is because no harm showed |
| 4 | Partial | Partial | Figures and opinions in separate sections, most figures dated, and the sources' weakness stated. But the headline led with "probably worth it", and two figures (JobLabs, MyUXAcademy) had no date. The real subreddit was used; the London pay search found 0 posts and was not retried | Model. The rules exist and were mostly followed |
| 9 | Fail | Partial | Currency (USD on the live page), VAT (not stated by sources) and billing period were all given, with no conversion. The £14 and £18 figures came from a Help Center extract whose fresh read gave a 404, and the answer cited it anyway (while saying so). No GBP figure on the official page | Skill. Composio reads from outside the UK, so the page shows USD, and the cite rule did not cover "stored extract, failed fresh read". Now covered |
| 13 | Partial | Partial | No star percentages (it gave the overall TrustScore and review count), themes summarised, and the answer drew on other sources too. It never said Trustpilot reviews are one platform's view, and it quoted an old 1.2 score beside the current 3.0 (but flagged the conflict) | Model (the rule is in `parallel.md`). The skill had no note on conflicting Trustpilot scores or the unreliable publish date |

Result: 1 pass, 4 partial, 0 fail, against 0 pass, 4 partial, 1 fail for Haiku on the same five.

### The 4 October rules, checked

- **Prompts 1 and 2 (version against source date):** followed in both. Prompt 2 did it best (two systems, each tied to its own documentation). Prompt 1 flagged the age but did not add the manual search.
- **Prompt 4 (figures against opinions):** mostly followed. Not followed: one undated figure pair and a verdict in the first line.
- **Prompt 9 (currency, VAT, period, no conversion, only loaded pages):** the first three followed. "Only pages that loaded" was bent: the cited page failed its fresh read, though the figure came from a stored extract and the answer said so.
- **Prompt 13 (no star percentages, themes, one platform):** first two followed. Third missed.

### Tool calls and result size

The Haiku run did not record call counts or sizes, so there is nothing to compare. Sonnet figures (Composio calls only, rough characters):

| # | Composio calls (tools inside) | Result size | Moved to workspace |
|---|---|---|---|
| 1 | 2 (3 searches, then one `jq`) | about 49,000 | Yes, despite the flag |
| 2 | 2 (3, then 1) | about 15,500 | No |
| 4 | 2 (4, then 2) | about 38,000 | No |
| 9 | 2 (2, then 1 read of 2 pages) | about 10,000 | No |
| 13 | 1 (3) | about 20,000 | No |
| Total | 9 | about 133,000 | 1 of 5 |

Helpers did one to two rounds each, below the skill's limit of about 3. Prompt 1's result was moved because Reddit post text can't be trimmed; the helper had no `jq` recipe for batched files and had to write one.

### Model or skill

- The slips in prompts 1, 4 and 13 came from the model: the rules were already in the skill and a Sonnet helper still missed some of them, though fewer than Haiku.
- Prompt 9 came from the skill: it cannot get a UK page from Composio, and one rule had a gap. Prompt 2 was fixed by the model.
- Prompt 9 was a Fail on Haiku and is now Partial. Sonnet's answer was honest about what it could not confirm; the missing GBP price is a limit of where Composio runs, which the skill can only warn about.

### Recommendation

Use Sonnet for helpers on answer-heavy work: prices, comparisons, salaries, anything with caveats. It followed the dating, hedging and cost rules noticeably better and all five runs finished first time. Keep Haiku for simple fetching (one page, one list of links) where there is little to judge. Nothing here measures cost, and the five runs are a small sample, so recheck after any further skill change.

### Skill changes made

`SKILL.md` grew by about 120 characters: the manual search for old sources names `includeDomains` on the vendor's docs site, and the cite rule covers a failed fresh read with a stored extract. `references/exa.md`: a `jq` recipe for moved batch results; a manual or release-notes search for old software advice; a note that Composio reads from outside the UK, so prices may show USD only.

Not changed: the Reddit-alongside-or-only-if-thin inconsistency, a salary-source guide, a "how do customers rate X" recipe and a Trustpilot-conflict note. Each was suggested by one helper and is not yet shown to cause harm.
