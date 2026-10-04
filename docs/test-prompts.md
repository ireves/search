# Test prompts for the web-research skill

Use these to check the skill picks the right tools. They come from the research in `research-findings.md`.

| # | Prompt | Expected behaviour |
|---|---|---|
| 1 | How do I fix shading artifacts after using the Boolean modifier in Blender? | Exa advanced search **and** Parallel search in the same turn; Parallel returns Reddit threads |
| 2 | Why does Curve to Mesh twist my profile in Blender geometry nodes, and what's the current fix? | Both services; mentions Set Curve Normal (Z Up, Free mode since 4.1) |
| 3 | Figma variable modes keep resetting properties on nested instances. Is this a bug? | Exa with `includeDomains: forum.figma.com` and a 2026 date filter; finds staff replies saying it's expected behaviour |
| 4 | Find case studies of onboarding redesigns with real before and after numbers. | Exa only; personal portfolios and company blogs, not listicles |
| 5 | What research exists on dark patterns in subscription cancellation? | Exa with `category: publication`; several distinct sources; mirrors counted once |
| 6 | Find junior Blender 3D artist jobs in the UK posted in the last month. | Exa with a published-date filter, `userLocation: GB`, fresh download; says whether listings were checked as open |
| 7 | What are people on X saying about the latest Blender release? | Parallel only |
| 8 | Summarise this YouTube video: https://www.youtube.com/watch?v=eaXk97ujbPQ | Exa `web_fetch_exa` (transcript) |
| 9 | In https://dl.acm.org/doi/pdf/10.1145/3359183, how many sites used dark patterns? | Exa advanced search with the exact address pinned; answers 1,254 sites (about 11.1%) |
| 10 | What's the latest Blender version? | One quick Exa search; no helpers; checks the patch version (for example 5.2.x) |
| 11 | Compare the 5 most recommended Blender hard-surface add-ons, with prices and what Reddit users say about each. | Heavy job: helpers in Claude Code or Cowork (Exa and Parallel angles), Exa Agent in a normal chat |
| 12 | Find Ton Roosendaal's LinkedIn profile details. | Says LinkedIn profiles can't be read by either service |

Check every run for:

- no built-in web search or web fetch calls,
- `textMaxCharacters: 1` and a `highlightsQuery` on every Exa advanced search,
- an `objective` on every Parallel fetch, and `full_content` left off,
- gaps and confidence stated in the answer.
