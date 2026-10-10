# Browser Use (Composio Instant): summary

**Setup:** `BROWSER_USE_START_RUN` with model `bu-ultrafast` (Instant only offers `bu-ultrafast` or `gpt-5.6-luna`, and ultrafast is the cheaper and faster one), `max_cost_usd` 0.5, UK proxy. The task was "Search the web and answer briefly, with the source URLs you used: <question>". The schema has no step cap. Results were polled with `GET_RUN_STATUS` about every 5 s and read with `GET_RUN`. Steps and cost came from `LIST_RUN_EVENTS`. Up to 4 runs went at once.

**Stopped early: the Instant wallet ran out.** Q1 to Q12 finished. Q13 to Q16 were accepted, but every later status or get call failed with "Wallet balance is exhausted. Add credits to resume Instant tool calls or connect your account." Q17 to Q20 were never started.

## Headline numbers
- Success rate: 12 of 16 started (75%), 12 of 20 overall. All 4 failures were caused by the wallet, not by the tool.
- Latency (wall clock, from start until a poll saw "completed"): mean 14.2 s, median 12.7 s, range 11.8 to 23.4 s (11 runs; Q1's figure was an artefact of a late poll). The server-side time from creation to completion was mean 9.4 s, median 7.7 s. Wall clock adds the 5 s poll interval plus about 1 s per Composio call.
- Steps: 3 to 9 (mean 3.9). Internal searches: 1 to 3 per run.
- Mean score: 2.58 on completed questions; 1.94 across the 16 started; 1.55 across all 20.
- Response size: about 1.4k chars, a single answer string with no result list.
- Cost: from the events, about $0.009 to $0.025 per run (mean about $0.012). That is LLM spend plus $0.007 for each internal search. `total_cost_usd` was null.

## Best and worst
- **Best (3):** Q1 cash ISA (GOV.UK), Q3 Dettol (official UK page and the full ingredient list), Q4 Exa pricing (exa.ai/pricing, $7 per 1k), Q5 Vercel docs, Q6 iCloud+ (Apple support), Q8 NI record (GOV.UK), Q11 Supabase docs, Q12 Claude Code cloud-environments docs.
- **Worst:** Q10 YNAB/Starling (1). It was inconclusive and leaned on a sync vendor's page. Q9 (2) used weak sources and missed the transcripts built into iOS 18. Q7 (2) used US pages and a thin explanation. Q2 (2) found only one true C-to-C cable, on amazon.ie.

## Strengths
- It returns a finished, cited answer, not a list of links. The answers were short, accurate and sensibly caveated, with no made-up facts in the 12.
- It favours strong sources: GOV.UK, vendor docs, Apple support.
- It is fast for an agent, at about 7 to 9 s on the server for most questions. bu-ultrafast mostly calls a built-in search function and only sometimes opens pages, so it acts more like "search plus summarise" than slow browsing.

## Limitations and quirks
- **Billing trap:** Instant requires `max_cost_usd`, and the schema says that amount is "charged when the run is accepted". With $0.50 per run, 16 runs ($8 reserved) emptied the wallet, even though actual usage was about $0.19. Set the cap to around $0.05.
- Once the wallet ran out, even read-only status and result calls failed, so the four runs that had already been accepted could not be read.
- It is asynchronous: each question needs a start call and then polling. There is no step cap and no cancel slug in the allowed set.
- Answers have no titles, dates or snippets. The URLs have to be pulled out of the text.
- It does one quick pass. When the first search is inconclusive (Q10), it gives up instead of digging further.
- The workbench MCP call times out at 60 s (not the 180 s cell limit), so polling has to run in a background thread with short cells.

## Best suited for
Getting a short, sourced answer to a factual or how-to question in about 10 to 15 s, when you want the conclusion rather than the results. It is not a good fit for bulk SERP-style retrieval, and not for runs on a small Instant wallet unless the cost cap is kept low.
