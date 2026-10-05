# Test prompts for the connector skills

New prompts, unrelated to the examples used while building the skills, so the tests measure judgement rather than copying.

## web-search (normal chat)

| # | Prompt | Expected behaviour |
|---|---|---|
| 1 | What's the current version of Python? | One `search`, then `fetch` of python.org with a question (live page, so the newest patch release); no `research` |
| 2 | Is the Framework Laptop 16 worth it for 3D work? | `search` with `type: "discussions"` plus one general `search`; owners' experiences and specs, linked |
| 3 | Summarise https://www.youtube.com/watch?v=dQw4w9WgXcQ | One `fetch`; transcript-based summary |
| 4 | What did Ofcom announce this week? | `search` with `type: "news"` and `after: "7d"` |
| 5 | How do I fix "ENOSPC: System limit for number of file watchers reached"? | `search` with `type: "code"`; answer cites docs or Stack Overflow |
| 6 | How do employees rate Monzo? | `search` with `type: "reviews"`; Glassdoor or Trustpilot figures with dates |
| 7 | Compare the main differences between Bitwarden and Proton Pass for a family | web-search route 8: `research` quick or standard, then `verify` on prices; no chain of 4 searches |
| 8 | Summarise https://www.theguardian.com/business/article/2024/jul/08/largest-uk-public-sector-trial-four-day-week-sees-huge-benefits-research-finds- | One `fetch`; Claude says only the first 1,000 characters were available and finds other coverage if needed |

Check: no built-in web search, two to four calls at most, sources linked, uncertainty mentioned, no helper agents spawned for searching.

## deep-search

| # | Prompt | Expected behaviour |
|---|---|---|
| 9 | /deep-search How much does a UK heat pump installation cost after the grant? | Menu first (Auto or Deep research). Auto: moderate path: `research` quick, the official grant page read with `fetch`, `verify` on the figures |
| 10 | /deep-search deep research: evidence on four-day working week trials in the UK | No menu (effort given). Claude Doc skeleton first, `research` with `effort: "deep"`, own searches across papers, news and discussions, `verify`, report of 2 pages or less |
| 11 | /deep-search Who is the current CEO of Arm, and since when? | Auto, simple path: official page plus `verify`; date stated |
| 12 | /deep-search Compare the five most popular open-source password managers | Auto, heavy path: `research` standard plus own searches; table only if useful |

Check: every key figure has a primary source or two independent ones; disagreements and gaps reported; report sections match `skills/deep-search/references/report.md`.
