# Test prompts for the connector skills

New prompts, unrelated to the examples used while building the skills, so the tests measure judgement rather than copying.

## web-search (normal chat)

| # | Prompt | Expected behaviour |
|---|---|---|
| 1 | What's the current version of Python? | One `search`, confirmed on python.org (`sites` or `fetch`); no `research` |
| 2 | Is the Framework Laptop 16 worth it for 3D work? | `search` with `type: "discussions"` plus one general `search`; owners' experiences and specs, linked |
| 3 | Summarise https://www.youtube.com/watch?v=dQw4w9WgXcQ | One `fetch`; transcript-based summary |
| 4 | What did Ofcom announce this week? | `search` with `type: "news"` and `after: "7d"` |
| 5 | How do I fix "ENOSPC: System limit for number of file watchers reached"? | `search` with `type: "code"`; answer cites docs or Stack Overflow |
| 6 | How do employees rate Monzo? | `search` with `type: "reviews"`; Glassdoor or Trustpilot figures with dates |

Check: no built-in web search, two to four calls at most, sources linked, uncertainty mentioned.

## deep-search

| # | Prompt | Expected behaviour |
|---|---|---|
| 7 | /deep-search How much does a UK heat pump installation cost after the grant? | Menu first (Auto or Deep research). Auto: moderate path, official grant page read, `verify` on the figures |
| 8 | /deep-search deep research: evidence on four-day working week trials in the UK | No menu (effort given). Claude Doc skeleton first, `research` with `effort: "deep"`, own searches across papers, news and discussions, `verify`, report of 2 pages or less |
| 9 | /deep-search Who is the current CEO of Arm, and since when? | Auto, simple path: official page plus `verify`; date stated |
| 10 | /deep-search Compare the five most popular open-source password managers | Auto, heavy path: `research` standard plus own searches; table only if useful |
| 11 | /deep-search auto: who are the key players in UK vertical farming? | Status check: one news search for closures, then `verify` per company. Jones Food Company (administration April 2025) and Vertical Future (administration August 2025) not listed as active |
| 12 | (web-search) How do I stop macOS stealing Blender's Ctrl+Space shortcut, and has Blender changed it? | Finds the macOS fix, then follows the lead about Blender changing the Mac default (issue tracker or release notes) |

Check: every key figure has a primary source or two independent ones; disagreements and gaps reported; report sections match `skills/deep-search/references/report.md`; no "not sure" without a search behind it; every entity called current has a dated status.
