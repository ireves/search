# Test prompts for the search skills (version 2)

New prompts, unrelated to the examples used while building the skills, so the tests measure judgement rather than copying. Version 1's list is in [`v1/docs/connector-test-prompts.md`](../v1/docs/connector-test-prompts.md); running the same prompts on both versions compares accuracy, cost and speed.

In the tables, "worker" means Claude hands the calls to `search:search-worker` (Haiku) and only sees its short digest.

## better-search

| # | Prompt | Expected behaviour |
|---|---|---|
| 1 | /better-search auto: What's the current version of Python? | One worker: `search` with `sites` python.org, or a read of it; version confirmed on python.org |
| 2 | /better-search deep: Is the Framework Laptop 16 worth it for 3D work? | 2 to 3 workers at once, every `search` at `depth: "thorough"`, including `type: "discussions"`; a clear recommendation with reasons; answer not padded |
| 3 | /better-search Summarise https://www.youtube.com/watch?v=dQw4w9WgXcQ | No menu (link only); one read job; transcript-based summary |
| 4 | /better-search What did Ofcom announce this week? | Menu first (Auto or Deep). Auto: `type: "news"` with `after: "7d"` |
| 5 | /better-search auto: How do I fix "ENOSPC: System limit for number of file watchers reached"? | `type: "code"`; numbered fix steps; link to the docs or answer used |
| 6 | /better-search auto: How do employees rate Monzo? | `type: "reviews"`; Glassdoor or Trustpilot figures with dates |

Check: no built-in web search; Auto uses 1 to 4 calls; helpful links but no citation list or confidence labels; the cost line adds up the workers' COST lines.

## uni-search

| # | Prompt | Expected behaviour |
|---|---|---|
| 7 | /uni-search How much does a UK heat pump installation cost after the grant? | Menu first (Auto or Research). Auto: moderate path, two workers, official grant page read, `verify` on the figures |
| 8 | /uni-search research: evidence on four-day working week trials in the UK | No mode menu; destination menu (Claude Doc or Chat) before any search. Doc: skeleton first. One research worker (`effort: "deep"`) and 2 to 3 sweep workers in the same message; `verify`; source check worker; report of up to 3 pages with the sections in `skills/uni-search/references/report.md` |
| 9 | /uni-search auto: Who is the current CEO of Arm, and since when? | Simple path: one worker chains search, read of the official page, and `verify` if only one site states it; date stated |
| 10 | /uni-search auto: Compare the five most popular open-source password managers | Heavy path: research worker (`standard`) plus read workers for each product's official pages; source check; table with a source per row |
| 11 | /uni-search research, in chat: Did the UK ban new petrol cars in 2030? | Premise check: the question is a simplification, so the answer opens with what the rule actually covers (which cars, which year, any changes since it was announced), from the official GOV.UK page |

Check: every key figure has a primary source or two independent ones; disagreements and gaps reported; nothing stated without a source; the main Claude never calls the connector itself when workers are available.

## Fallback

| # | Setup | Expected behaviour |
|---|---|---|
| 12 | Any prompt above in a chat without Cowork features (no workers) | Claude makes the same calls itself; answer quality unchanged |
