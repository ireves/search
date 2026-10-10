# Search toolkits compared through Composio

Tested 9 and 10 October 2026. 15 toolkits (24 tools in all) on the same 20 everyday questions, every call made through the Composio connector.

## 1. Verdict

| Need | Best choice | Why |
|---|---|---|
| All-round search for an agent | **Firecrawl** | Highest full score (2.55 of 3), about 1.1 s, never scored 0, found real Reddit threads and UK shops |
| Free all-round search | **DuckDuckGo** (Composio Search) | 2.50 of 3, about 2.1 s, no charge shown, the only tool to find the exact page for the typo question |
| Official sources and facts | **Exa** | 2.45 of 3, the most often right on GOV.UK, vendor docs and product ingredients; $7 per 1,000 searches |
| Speed and price | **Parallel** | About 1.05 s every time and $1 per 1,000, but weaker on shopping, Reddit and "app like X" questions (2.25) |
| Cheapest Google-style results | **TinyFish** or **Serper** | 2.30 and 2.35; TinyFish search is free (rate-limited), Serper about $1 per 1,000 |
| A finished answer, not links | **Browser Use** | 2.58 on the 12 questions it ran, but 10 to 15 s each and about 1p to 2p per answer |
| Avoid for web search | **SerpApi** (through Composio) | 1.50 of 3: no snippets, no UK setting, slow outliers |

The top nine general search tools score between 2.25 and 2.55. With 20 questions, one question scored one point differently moves a tool by 0.05, so treat gaps under about 0.2 as a tie. The clearer differences are in speed, price, region handling and the kind of question each one gets wrong.

Eight of the toolkits are not web search engines (OpenAlex, Akta, Crustdata, Context.dev, ScrapeCreators, and Composio's Amazon, Shopping, Scholar, Image and Finance tools). They scored near zero on general questions, as expected, but several are very good at their own job. See section 6.

## 2. How the test was run

1. Each toolkit was reached only through Composio. All except Exa ran on Composio's own provider accounts ("Instant" accounts, paid from a shared Composio balance). Exa ran on your own Exa key.
2. The 20 questions were sent word for word, with about 5 to 10 results and a UK setting where the tool allowed one.
3. Each call was timed from Composio's remote workbench, one call at a time. Times therefore include about 0.5 s of Composio overhead. Exa and Tavily both report their own time, which confirmed this.
4. A separate worker built checked reference answers (GOV.UK, Apple, Vercel, Supabase, Anthropic docs and so on) and a price list from each vendor's pricing page.
5. Two graders then re-scored every general search tool question by question against those answers, so the same evidence got the same score across tools:
   - 3: the right answer, from a strong current source, visible in what came back
   - 2: useful but weaker source, partly outdated, or the answer needs digging
   - 1: loosely related
   - 0: irrelevant, empty or wrong
6. Confident wrong statements in answer text were marked down harder than an empty result.

## 3. Results: general web search

| Toolkit (tool) | Score /3 | Full marks (of 20) | Median time | Size per call (chars) | Results | Dated results | Answer text | List price per 1,000 |
|---|---|---|---|---|---|---|---|---|
| Firecrawl (`FIRECRAWL_SEARCH`) | **2.55** | 12 | 1.12 s | 3,900 | 5 | Dates inside snippets only | No | about $7.60 (Hobby plan) |
| DuckDuckGo (`COMPOSIO_SEARCH_DUCK_DUCK_GO`) | **2.50** | 12 | 2.12 s | 6,200 | 11 | About half | No | None shown (Composio Search) |
| Exa (`EXA_SEARCH`, auto, highlights) | **2.45** | 11 | 2.77 s | 14,400 | 5 | About a quarter | No (separate Answer tool) | $7 (seen on every call) |
| Serper (`SERPER_SEARCH_WEB`) | 2.35 | 10 | 1.48 s | 4,300 | 10 | Over half | No | about $1 (unverified) |
| Composio web search (`COMPOSIO_SEARCH_WEB`, uses Exa) | 2.35 | 11 | 2.15 s | 3,400 | 8 | About 40% | Yes, cited | None shown (Composio Search) |
| TinyFish (`TINYFISH_SEARCH_WEB`) | 2.30 | 10 | 1.83 s | 5,400 | 10 | Over half | No | $0 (rate-limited) |
| Parallel (`PARALLEL_SEARCH_WEB`, fast) | 2.25 | 9 | 1.05 s | 12,000 | 5 | About a sixth | No | $1 |
| Tavily (as Composio "LLM Search") | 2.25 | 8 | 2.55 s | 7,500 | 5 | None | Yes | $8 (pay as you go) |
| SerpApi (`SERPAPI_SEARCH`) | 1.50 | 2 | 1.60 s (one call 18 s) | 900 | 5 | None | No | $10 to $25 |
| Browser Use (`BROWSER_USE_START_RUN`) | 2.58* | 8 of 12 | 12.7 s | 1,400 | One answer | n/a | Yes, cited | about $9 to $25 per 1,000 runs |

\* Browser Use only finished questions 1 to 12 (see section 7), so its score is not directly comparable.

"Size per call" matters for an agent: it is roughly how much of the model's working memory each search uses up.

### Where each tool won and lost

| # | Question | Best | Notable failures |
|---|---|---|---|
| 1 | Cash ISA 2027 changes | Exa, TinyFish, Serper, Composio web, Browser Use (GOV.UK paper of 17 Sept 2026) | SerpApi: social posts only |
| 2 | 0.2 m right-angle USB-C cable | Firecrawl (Amazon UK, exact cable) | Parallel read "0.2m" as 2 m; most others showed US shops |
| 3 | Dettol 24h spray ingredients | Exa, Composio web, Browser Use (correct actives) | Tavily's answer gave ingredients of a different, Indian product |
| 4 | Exa price per 1,000 | Almost all ($7) | SerpApi had the page but no snippet |
| 5 | Vercel env variables in dashboard | Exa, Parallel, DuckDuckGo, Composio web | Google-based tools ranked overview and CLI pages first |
| 6 | iCloud+ custom email domain | Parallel, Exa, DuckDuckGo, Serper, Firecrawl, TinyFish | None serious |
| 7 | How Woolite Darks works | Exa, Parallel, Tavily, DuckDuckGo | Google-based tools gave Reddit and Facebook posts; no UK Woolite page exists anywhere |
| 8 | NI record and voluntary contributions | All but SerpApi (GOV.UK) | SerpApi: accountants and Facebook |
| 9 | Transcribe voice memos with a Shortcut | Exa, Parallel, Composio web, Tavily | No tool paired Apple's own page with the Shortcuts action |
| 10 | YNAB and Starling direct import | Exa, DuckDuckGo, TinyFish, Serper | Composio web confidently said "no", based on sellers of sync tools. No official page names Starling |
| 11 | Stop Supabase pausing a free project | Most tools (Supabase docs) | SerpApi and Tavily missed the docs |
| 12 | Claude Code cloud network allowed domains | Exa, Parallel, Tavily, DuckDuckGo, Composio web | Firecrawl, TinyFish, Serper all returned the same GitHub bug and Reddit post |
| 13 | Liquid Glass HIG summary | Firecrawl, TinyFish, Serper, Tavily, DuckDuckGo | Exa found Apple's page but returned empty extracts |
| 14 | Exa vs Parallel vs Tavily | Exa, Composio web, Firecrawl | Parallel led with a company-profile stub page; most sources are vendor blogs |
| 15 | Reddit: Claude skills vs MCP | Firecrawl, TinyFish, Serper, SerpApi | Exa, Parallel and Composio web ignored "reddit" |
| 16 | Junior product designer jobs, London | Exa, Composio web (individual adverts) | SerpApi Jobs found only 2 adverts |
| 17 | "That tool that turns Figma designs into a website" | Parallel (figma.com/sites first), SerpApi | Tavily's answer confused it with a Notion tool |
| 18 | App like Notion but simpler | DuckDuckGo, Firecrawl, TinyFish, Serper | Parallel returned Notion's own App Store page 5 times; Tavily suggested Todoist and Trello |
| 19 | Trimesh to quads in Blender | Nearly all (Alt+J, Blender manual) | SerpApi: Blender home page |
| 20 | Typo test ("clade code remote enviroment acces denied") | DuckDuckGo (exact docs page) | All understood the typos; most read it as a Remote Control error |

### Patterns

1. **Two families of search engine.** Exa, Parallel and Composio web search match meaning. They are best at official documents and product facts, and worst when the question names a place to look ("reddit") or asks for opinions ("app like X"). Firecrawl, TinyFish, Serper and DuckDuckGo return Google- or Bing-style rankings. They find Reddit threads and mainstream recommendations, but sometimes rank forum posts above official pages (Woolite, Claude Code, Vercel).
2. **TinyFish and Serper are near copies.** Their top three results overlapped on 55 of 60 slots and their first result matched on 18 of 20 questions. Both appear to be Google results.
3. **UK settings barely work.** Even with a UK setting, US Amazon, US Woolite and UAE shops appeared for most tools. Only Firecrawl and Serper Shopping gave properly UK results. DuckDuckGo, Tavily, SerpApi and Composio web search have no region setting at all through Composio.
4. **Written answers help but can mislead.** Tavily, Composio web search and Browser Use give a ready-made answer. These were usually right, but produced the only confidently wrong statements in the test (Dettol ingredients, YNAB and Starling, Supabase rules, note apps).
5. **Dates are patchy.** Tavily, SerpApi and Firecrawl return no date field. GOV.UK pages often show their first publication year (2012, 2014), which makes current pages look old.
6. **Duplicates waste slots.** Exa and Parallel, which return only 5 results, often gave the same page twice (for example three copies of Exa's pricing page).

## 4. Price

| Vendor | Main unit | Free allowance | Approx. per 1,000 basic searches |
|---|---|---|---|
| TinyFish | Search and fetch free; browser agents paid | Search free, 30 a minute, 500 an hour | $0 |
| Parallel | Per request (fast or turbo) | 5,000 a month | $1 ($5 for basic or advanced modes) |
| Serper | 1 credit per search | 2,500 once | about $1 (unverified) |
| OpenAlex | Per call | $1 a day per key | $1 (papers only) |
| ScrapeCreators | 1 credit per request | 100 credits | $1.88 (social media only) |
| Context.dev | Credits | 1,000 credits a month | about $2.50 |
| Exa | Per request | $20 at sign-up, then $10 a month | $7 |
| Firecrawl | 2 credits per 10 results | 500 searches a month | about $7.60 on Hobby, $1.20 to $1.66 on bigger plans |
| Tavily | 1 credit basic, 2 advanced | 1,000 credits a month | $8 |
| Akta | Credits | 25 credits | about $10 for news search |
| SerpApi | Monthly plans | 250 a month | $10 to $25 |
| Browser Use | Model cost plus 20% | $1 once | about $9 to $25 per 1,000 answers (observed) |
| Crustdata | Credits | Trial on request | Unclear |

Sources: each vendor's pricing page, read on 10 October 2026 (full list with links in the source data). Serper's page could not be read, so its price comes from third-party write-ups.

**Composio's own charges.** The free Hobby plan includes 100,000 tool calls a month. Pro is $29 a month, then $0.0003 a call. "Instant" toolkits (everything here except Exa and Composio Search) run on Composio's provider accounts. Their usage comes out of your Composio balance at the provider's list price, with no mark-up. When the balance runs out, every Instant toolkit stops with a "wallet exhausted" error. Composio Search tools (DuckDuckGo, web search, LLM Search, Amazon and so on) showed no charge beyond the tool call.

## 5. Toolkit notes

**Firecrawl.** Fast (0.8 to 2.4 s) and steady, with clean extracts. The only tool to find the exact cable on Amazon UK, and it found real Reddit threads. Missed the Claude Code docs. Can also read the found pages in the same call (Markdown), at about 8 to 10 s and a much larger response.

**DuckDuckGo (Composio Search).** No settings at all (no region, no result count), short snippets and no answer text, so an agent must open pages to read them. Despite that it found official pages very consistently, was the only tool to find the exact Claude Code page for the typo question, and costs nothing beyond the Composio call.

**Exa.** The strongest on official and primary sources, with long, relevant extracts that often contain the answer. Weak on Reddit and recommendation questions. Returned empty extracts for Apple's design pages. The separate Exa Answer tool gave correct, cited answers in about 2.3 s for $0.005.

**Serper.** The fastest Google-style tool (1.1 to 2.4 s) with lean responses. The Composio wrapper never returned Google's answer box, "People also ask" or knowledge panel. Serper Shopping gave proper UK prices in pounds.

**Composio web search.** Exa underneath, plus a cited written answer, in a compact 3,400 characters. Usually right, but gave the most serious wrong answer of the test (YNAB and Starling). No region setting.

**TinyFish.** Google-quality results with dates on most of them, free search, and a page reader in the same toolkit (about 2 s, clean Markdown). Practically the same results as Serper, about 0.3 s slower. Leaves Google tracking codes in links.

**Parallel.** The fastest tool tested (0.9 to 1.3 s, very steady) and cheap. Long Markdown extracts. Through Composio it is locked to "fast" mode: the better "basic" and "advanced" modes were refused. Weak on shopping, Reddit and recommendations, and it surfaced company-profile pages tagged with a Parallel tracking code at the top for two questions.

**Tavily (Composio "LLM Search").** Composio's "LLM Search" tool is Tavily: the response fields match Tavily's own exactly. The dedicated Tavily toolkits need your own API key, which was not connected. Its written answer is handy but contained wrong or muddled statements on several questions (Dettol, note apps, the Figma tool, the typo question). No dates and no region setting. "Advanced" depth cost about 0.9 s more and was better on two of three technical questions.

**SerpApi.** Through Composio the general Google search returns titles and links only, with no snippets, and does not accept a region. One call took 18 s. Its specialist tools were mixed: Google Jobs found two real London adverts with full descriptions, Google Forums returned nothing, and Shopping returned US prices.

**Browser Use.** A browser agent that searches, reads and writes a short cited answer. On the 12 questions it finished, answers were accurate with good sources, in about 8 s on its own servers and 13 s end to end. It gives up quickly when the first search is inconclusive (YNAB). See section 7 for its billing behaviour.

## 6. Specialist toolkits

| Toolkit | General score | Time | What it is good for | What it cannot do |
|---|---|---|---|---|
| OpenAlex | 0.20 | about 1 s | Scholarly papers: a fair research query scored 3 of 3, with citation counts and DOIs | Everyday questions; returns unrelated papers rather than nothing, and fails on typos |
| Composio Scholar | 0.75 | about 1.3 s | Papers, theses and firm reports; occasionally a useful PDF (ISA, Supabase) | Always returns 10 results, so never signals "nothing good" |
| Composio Image | 2.0* | about 1.3 s | Finding product photos, and oddly good at finding the right page (Vercel docs, Claude Code docs) | No text at all; US results only |
| Composio Amazon (amazon.co.uk) | 0.25 | about 2 s | UK product search in pounds; found three exact cables | Anything not a product: 14 of 20 came back empty |
| Composio Shopping | 0.15 | 1 s to 30 s | Price comparison across UK shops for a known product | Takes about 30 s to say "no results"; huge responses; one 95 s failure |
| Composio Finance | 0 | 1.2 to 1.8 s with tickers | Live prices, charts and news once you know the ticker (Apple, Reckitt, GBP-USD all worked) | Plain-language questions: all 20 returned nothing while reporting success |
| Akta | 0.55 | about 7 s | Company news with summaries and sentiment; company profiles (found that Tavily has been acquired, and Parallel's pricing) | General questions ("Woolite" matched "Wolverine") |
| Crustdata | 0.05 | 0.5 to 11 s | Basic company facts (head count, HQ, founding year) from a web address | Any question; some records out of date or wrong (Anthropic, Figma, Notion) |
| Context.dev | 0.30 | about 1 s | Finding a company's web address and logo; turning a known page into clean text (4 to 6 s) | Searching: it matches single words ("line", "how", "2026") |
| ScrapeCreators | see note | | Reddit, YouTube and LinkedIn search | See note |

\* Scored on whether the images and their source pages were relevant.

**ScrapeCreators note:** Re-run in progress after the Composio balance was topped up; results to follow.

## 7. Things to know when using these through Composio

1. **One shared balance pays for most toolkits.** Composio's Instant accounts all draw on your one Composio balance. It ran out partway through this test and every Instant toolkit stopped at once, including read-only status checks. Your own Exa key and Composio Search kept working.
2. **Browser Use holds money up front.** Each run reserves its cost cap when it starts. With a $0.50 cap, 16 runs reserved $8, although they used only about $0.19. This is what emptied the balance. Set the cap near $0.05, or connect your own Browser Use key.
3. **Instant accounts limit the tools and settings.** Parallel only allows "fast" mode. Crustdata only allows company look-ups. TinyFish, Firecrawl and Context.dev only allow two or three of their tools.
4. **Wrappers hide some features.** Serper's answer box, SerpApi's snippets and region setting, and Tavily's dates did not come through.
5. **"Success" can mean empty.** Composio Finance and Shopping report success with no results, so check the result itself.
6. **Composio adds about half a second** to each call compared with the provider's own reported time.

## 8. What this means for your Search connector

Your own connector pairs Exa (meaning-based search) with Parallel. Your earlier tests found Parallel strong on Reddit and X with your own key; here, locked to Composio's fast mode, it ignored "reddit" in the question. This test supports the pairing for official facts, with two adjustments to consider:

1. For Reddit and "what do people recommend" questions, a Google-style tool did clearly better here than both Exa and Parallel's fast mode. Firecrawl (already an optional reader in your connector) or Serper would fill that gap cheaply.
2. Don't rely on a single engine for UK shopping or jobs. Firecrawl, Exa and Serper Shopping were the only tools that reliably returned UK shops and London adverts.

## 9. Limits of this test

1. One run of 20 questions per tool. Scores are a guide, not a ranking to two decimal places.
2. The graders were Claude workers checking against reference answers built for this test. Questions 2, 15, 16 and 18 have no single right answer.
3. Each tool was tested at one setting. Paid modes (Parallel basic or advanced, Exa deep, Tavily advanced on all questions) would likely score higher and cost more.
4. Times were measured from Composio's workbench in one region on one day.
5. Prices are list prices from 10 October 2026. Serper's price and Crustdata's price per credit are unverified.
6. Tavily was tested only through Composio's LLM Search tool, and Browser Use only on 12 questions.
