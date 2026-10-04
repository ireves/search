# Test prompts for the web-research skill

> This file covers the earlier version of the skill, which used separate Exa and Parallel connectors and has since been removed. It is kept for reference.

Use these to check the skill picks the right tools. They come from the research in `research-findings.md`.

| # | Prompt | Expected behaviour |
|---|---|---|
| 1 | How do I fix shading artifacts after using the Boolean modifier in Blender? | Exa advanced search **and** Parallel with `site:reddit.com` in the same turn; Parallel results are Reddit only |
| 2 | Why does Curve to Mesh twist my profile in Blender geometry nodes, and what's the current fix? | Exa (forums, manual) plus Parallel `site:reddit.com`; mentions Set Curve Normal (Z Up, Free mode since 4.1) |
| 3 | Figma variable modes keep resetting properties on nested instances. Is this a bug? | Exa with `includeDomains: forum.figma.com` and a 2026 date filter; finds staff replies saying it's expected behaviour |
| 4 | Find case studies of onboarding redesigns with real before and after numbers. | Exa only; personal portfolios and company blogs, not listicles |
| 5 | What research exists on dark patterns in subscription cancellation? | Exa with `category: publication`; several distinct sources; mirrors counted once |
| 6 | Find junior Blender 3D artist jobs in the UK posted in the last month. | Exa with a published-date filter, `userLocation: GB`, fresh download; says whether listings were checked as open |
| 7 | What are people on X saying about the latest Blender release? | Exa confirms the version first; Parallel `site:x.com` (then Reddit) for reactions; Exa news round-ups that embed X posts if X results are thin |
| 8 | Summarise this YouTube video: https://www.youtube.com/watch?v=eaXk97ujbPQ | Exa `web_fetch_exa` (transcript) |
| 9 | In https://dl.acm.org/doi/pdf/10.1145/3359183, how many sites used dark patterns? | Exa advanced search with the exact address pinned; answers 1,254 sites (about 11.1%) |
| 10 | What's the latest Blender version? | One Exa search plus a read of the official download or releases page; no helpers; gives the patch version (for example 5.2.2) |
| 11 | Compare the 5 most recommended Blender hard-surface add-ons, with prices and what Reddit users say about each. | Heavy job: helpers in Claude Code or Cowork; otherwise Exa Agent at `auto` with a $1 budget, plus Parallel `site:reddit.com` |
| 12 | Find Ton Roosendaal's LinkedIn profile details. | Says LinkedIn pages can't be opened, tries Exa `category: "people"` (3 to 5 results), checks identity, doesn't expose namesakes |
| 13 | Is a Huion Kamvas worth it over a Wacom for Blender sculpting? | Exa for reviews and specs; Parallel `site:reddit.com` for owner experiences; no unrestricted Parallel search |
| 14 | What's it like to work at Framestore as a junior artist? | Exa finds pages; Parallel reads Glassdoor reviews and searches `site:reddit.com` for first-hand accounts |
| 15 | How do customers rate Wacom's customer service? | Parallel reads Trustpilot with a tight objective (score, breakdown, top complaints) |

Check every run for:

- no built-in web search or web fetch calls,
- every Parallel search limited with `site:` to Reddit, X, Glassdoor or Trustpilot (or a Parallel read used as backup),
- `textMaxCharacters: 1` and a `highlightsQuery` on every Exa advanced search,
- at most 2 queries per Parallel search and 2 Parallel searches per question,
- original sources linked (no `exa.ai/library` links),
- an `objective` on every Parallel fetch, and `full_content` left off,
- gaps and confidence stated in the answer.
