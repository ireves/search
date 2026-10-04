# Test results: Exa search types against the Exa Agent (4 October 2026)

Two questions were run through Composio with each Exa search type and, for the list question, an Exa Agent. The deep types were given the same `systemPrompt` and `outputSchema` (company, status, newest dated activity, source). Answers were checked against the French company register listings and a US bankruptcy record found in the same tests.

## Question 1: a list with status checks

"Which companies are currently developing flat glass touchscreens with surface haptics that make the glass feel textured? Tanvas and Hap2U are no longer active."

| Option | Time | Cost | Result |
|---|---|---|---|
| `auto` | 2.5 s | $0.007 | 10 pages, 6 of them Tanvas's own old pages. Found HaptonTech and Uniphy. No status information |
| `deep-lite` | 7 s | $0.012 | 3 companies, all called active. Two are loose matches (a force-touch product, a glass maker's 2022 page) |
| `deep` | 19 s | $0.012 | 6 companies, with careful notes on which are only loosely related. No liquidation found, but Vibra Nova wasn't listed |
| `deep-reasoning` | 17 s | $0.015 | 2 companies. **Listed Vibra Nova as "still active, no liquidation evidence"**, which is wrong |
| Exa Agent, `auto`, $1 cap | 2 min 22 s | $0.59 (39 searches) | 6 companies, each with a correct status: HaptonTech active (IFA Berlin, 3 September 2026), Vibra Nova and Hap2U in liquidation, Tanvas in US bankruptcy since 2022, Senseg bought in 2016, Continental's joint display uncertain. Checked Dutch, French and US records. Named 3 more leads it couldn't confirm |

## Question 2: one status check

"Is Vibra Nova, the French haptics company that took over Hap2U's assets, still operating?"

| Option | Time | Cost | Result |
|---|---|---|---|
| `auto` | 2.6 s | $0.007 | Top two results were register pages showing the liquidation |
| `deep-lite` | 7 s | $0.012 | Correct: in liquidation. Gave the court's decision date (19 November 2025) |
| `deep` | 12 s | $0.012 | Correct, citing the official French register and two listing sites |
| `deep-reasoning` | 16 s | $0.015 | Correct, with the newest register update (January 2026) |

## Findings

1. **For one fact, `auto` is enough.** A focused query found the register pages first, at about half the cost and a fifth of the time of the deep types. The deep types add a written answer, which saves Claude reading the extracts, but it found nothing `auto` missed.
2. **For lists, the deep types are not reliable.** They returned 2 to 6 companies, mixed in loose matches, and `deep-reasoning` repeated the original mistake of calling a liquidated company active. Slower and more "reasoning" did not mean more accurate.
3. **The Exa Agent was the only option that got the list right.** It cost about 85 times as much as an `auto` search and took over 2 minutes, but it checked registers in three countries and labelled every company correctly. This supports SKILL.md Step 1: lists and comparisons start with an Exa Agent.
4. The Agent still needs checking: its status for Continental is a judgement, and it missed the patent holders found in the original test (Haptych, Nippon Electric Glass).

## Changes made

- `references/exa.md`: the `type` row now records these results and keeps `auto` as the default.
- `COMPOSIO_REMOTE_BASH_TOOL` timed out at 60 seconds on a `sleep 120`, as already noted in `references/exa.md`; `sleep 55` worked.
