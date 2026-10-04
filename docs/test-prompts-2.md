# Test prompts for the web-research skill: second set

A second set of 15 prompts on topics that don't appear in the skill's examples or in the first set (`test-prompts.md`). They check whether the skill works on new questions, not whether Claude copies the examples. Written for the Composio version (`.claude/skills/web-research-composio/`).

| # | Prompt | Expected behaviour |
|---|---|---|
| 1 | DaVinci Resolve stutters when I play back H.265 footage from my phone. How do I fix it? | Exa (Blackmagic forum, manual) plus one Reddit search inside the Resolve subreddit (found or confirmed with `REDDIT_GET_SUBREDDITS_SEARCH`); no date filter on the forum search; checks advice against the current Resolve version |
| 2 | How do I make a seamless tiling texture in Substance 3D Designer? | Exa first; current Adobe documentation or a dated tutorial; flags steps that may have changed between versions; Reddit only if Exa is thin |
| 3 | Find Product Designer roles in London or remote within the UK, posted in the last 2 weeks. Look across several job sites (for example LinkedIn, Indeed, Otta or Welcome to the Jungle, Dribbble Jobs, Working Not Working and company career pages) and tell me which sites you could and couldn't search. | One Exa search per site, batched, each with `includeDomains`, a date filter for the user's 2-week window and a fresh download; says LinkedIn job listings can't be searched; reports which sites returned listings, none, or couldn't be read; reads the best 2 or 3 listings with `maxAgeHours: 0` to confirm they're open; links the listing, not a search page; no Composio `linkedin` toolkit |
| 4 | What do mid-level product designers earn in London, and is it worth moving from an agency to an in-house role? | Exa for salary surveys and reports (dated, with sources named); Reddit inside a UX or design careers subreddit for experiences; keeps figures and opinions apart; says how old each salary figure is |
| 5 | Find examples of well-designed empty states in mobile apps, with explanations of why they work. | Exa only (design blogs, case studies, pattern libraries); no Reddit or Parallel |
| 6 | What does research say about how text contrast affects reading speed for older adults? | `EXA_SEARCH` with `category: "research paper"`, 6 results; original DOI or publisher links, never `exa.ai/library`; duplicates counted once; uses the `jq` step if results are moved |
| 7 | In WCAG 2.2 (https://www.w3.org/TR/WCAG22/), what is the minimum target size in success criterion 2.5.8, and what are the exceptions? | One `EXA_GET_CONTENTS_ACTION` read with `text: false` and a highlights question; answers 24 by 24 CSS pixels and lists the exceptions; labelled primary source |
| 8 | Find a talk from Figma's Config 2026 conference about design systems and summarise it. | Exa finds the video; `EXA_GET_CONTENTS_ACTION` with a `text.maxCharacters` limit for the transcript; says if the transcript was cut off |
| 9 | How much is a Figma Professional seat in the UK right now? | Reads Figma's official pricing page with `maxAgeHours: 0`; states the currency, whether VAT is included and monthly against yearly billing; no helpers |
| 10 | Compare the 5 most recommended portfolio website builders for product designers, with prices and what designers on Reddit say about each. | Heavy job: helpers in Claude Code, otherwise an Exa Agent at `auto` with a $1 budget and the task in a top-level `query`; plus Reddit inside a design subreddit; prices checked on official pages |
| 11 | Who leads design at Monzo, and what's their background? | Exa `category: "people"` with 3 results, batched with a normal search (company site, interviews) to confirm identity; doesn't report a namesake; says LinkedIn pages can't be opened |
| 12 | What's it like to work as a designer at Deliveroo? | Parallel limited to Glassdoor (search, then one read); Reddit inside a relevant subreddit; checks the Glassdoor page is for the right company |
| 13 | How do customers rate Squarespace's customer support? | `PARALLEL_EXTRACT_WEB_CONTENT` on Trustpilot with an objective and `max_chars_total`; hedges on the star breakdown; summarises themes itself; says it's one platform's view |
| 14 | What are designers on X saying about Figma's latest big announcement? | Exa confirms what the announcement was and its date first; Parallel limited to `x.com` with user-voice queries and `after_date`; then an Exa search for news articles that embed X posts; Reddit only if X is thin |
| 15 | What are people on Quora saying about becoming a UX designer without a degree? | Says Quora can't be read; offers or runs Reddit and Exa (blogs, forums) instead and says that's what it did |

Check every run for:

- no built-in web search or fetch, no direct Exa or Parallel connector, and no `composio_search`, `linkedin` or `twitter` toolkit calls;
- tools called directly through `COMPOSIO_MULTI_EXECUTE_TOOL`, and independent calls batched;
- every `EXA_SEARCH` with `contents.highlights` and a query, and never `contents.text`;
- every question-style `EXA_GET_CONTENTS_ACTION` with `text: false`, and `statuses` checked;
- every Parallel search with `include_domains`, `max_chars_total` and at most 2 queries, and at most 2 Parallel searches per question;
- Reddit searches inside a subreddit, with 2 to 4 keywords and `limit: 5`; no comments read from off-topic threads;
- original sources linked, with confidence labels and gaps stated;
- whether Claude copied anything from the skill's examples (placeholder text, example sites or subreddits that don't fit the question).
