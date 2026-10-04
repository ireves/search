# Exa tools: settings, recipes and quirks

Exa searches by meaning (embeddings), not keywords. Describe the page you want to find, not the fact you want to know.

## Contents

- Which Exa tool to use
- `web_search_advanced_exa` options
- Recipes
- `web_fetch_exa`
- `agent_run`
- Writing good queries
- Quirks found in testing

## Which Exa tool to use

| Tool | Use for | Avoid for |
|---|---|---|
| `web_search_advanced_exa` | All searches, and reading a specific document (pin its address) | Reddit and X (returns nothing) |
| `web_fetch_exa` | YouTube transcripts; short pages you want whole | Long documents (it cuts from the top and can't take a question) |
| `agent_run` | Multi-step research, lists, comparisons, enrichment | Single lookups |
| `web_search_exa` | Backup only, if the advanced tool is unavailable | Normal use (it can't be trimmed, so results are long) |

## `web_search_advanced_exa` options

| Option | Notes |
|---|---|
| `query` | A description of the ideal page. Long, natural phrases work best |
| `numResults` | 5 for a named thing, 8 to 10 for a narrow search, up to 15 for broad discovery. Never above 15; run more angles instead |
| `textMaxCharacters` | **Always set to 1.** Otherwise full page text is returned as well |
| `enableHighlights` | Always `true` |
| `highlightsQuery` | The specific facts to pull out of each page. This is what keeps results short and on topic |
| `highlightsMaxCharacters` | Total per result. 800 to 1,500 for searches; 3,000 to 4,000 when reading one document |
| `includeDomains` / `excludeDomains` | Site names (`forum.figma.com`), paths (`arxiv.org/pdf`) or a full address to pin one document. Leave out `https://` |
| `startPublishedDate` / `endPublishedDate` | `YYYY-MM-DD`. Works well. Undated pages can still slip through, so check dates in results |
| `category` | `company`, `publication`, `news`, `pdf`, `github`, `personal site`, `people`, `financial report` |
| `userLocation` | Country code, for example `GB` for UK jobs or prices |
| `additionalQueries` | Extra wordings searched in the same call. Use different angles, not synonyms |
| `maxAgeHours` | Omit to use Exa's stored copy (fast). `0` forces a fresh download: use only for pages that change (jobs, news, prices), and pair with `livecrawlTimeout: 30000` |
| `enableSummary` / `summaryQuery` | A short Exa-written summary per page. Compact but can drop details; don't rely on it for exact figures |
| `includeText` / `excludeText` | Results must or must not contain these strings |
| `subpages` / `subpageTarget` | Also read linked subpages (1 to 10). Costly in size; use rarely |
| `type` | Leave as `auto` |

Cost: about $0.007 per call.

## Recipes

**General search**
```json
{"query": "detailed case study of a product team redesigning their onboarding flow, with before and after metrics",
 "numResults": 8, "textMaxCharacters": 1, "enableHighlights": true,
 "highlightsQuery": "company, what changed, measured result with numbers", "highlightsMaxCharacters": 1000}
```

**Recent forum threads on one site**
```json
{"query": "Figma variable modes resetting properties of nested component instances",
 "includeDomains": ["forum.figma.com"], "startPublishedDate": "2026-01-01",
 "numResults": 5, "textMaxCharacters": 1, "enableHighlights": true,
 "highlightsQuery": "cause, workaround, or Figma staff reply", "highlightsMaxCharacters": 800}
```

**Job listings (recent, UK, fresh)**
```json
{"query": "job posting for a junior or mid-level 3D artist using Blender in the UK",
 "startPublishedDate": "<about 6 weeks before today>", "userLocation": "GB",
 "maxAgeHours": 0, "livecrawlTimeout": 30000,
 "numResults": 8, "textMaxCharacters": 1, "enableHighlights": true,
 "highlightsQuery": "company, location, salary, closing date, whether still open", "highlightsMaxCharacters": 500}
```
Listings can be closed even when recent. Check the extract (or read the page) before presenting a job as open.

**Academic papers**
```json
{"query": "academic study measuring dark patterns in subscription cancellation flows across many websites",
 "category": "publication", "numResults": 8, "textMaxCharacters": 1, "enableHighlights": true,
 "highlightsQuery": "title, year, method, key quantitative finding", "highlightsMaxCharacters": 1000}
```
The same paper often appears from several sites (arXiv, ACM, ResearchGate). Treat those as one source.

**Read one known document (PDF or page)**
```json
{"query": "Dark Patterns at Scale: Findings from a Crawl of 11K Shopping Websites",
 "includeDomains": ["dl.acm.org/doi/pdf/10.1145/3359183"], "numResults": 1,
 "textMaxCharacters": 1, "enableHighlights": true,
 "highlightsQuery": "how many dark pattern instances, on how many sites, how many deceptive",
 "highlightsMaxCharacters": 3500}
```
Searching by title alone may land on a summary page instead of the file; pinning the address avoids that. If the extract comes back thin or broken by many "..." gaps, read the same link with Parallel `web_fetch`.

## `web_fetch_exa`

- Options: `urls` (several at once) and `maxCharacters` (per page). No question option.
- It returns the page from the top down, so a 6,000 character limit on a long paper only reaches the introduction.
- Best for YouTube links: it returns the full transcript, which Parallel can't.
- Fails on Reddit, X and LinkedIn (`SOURCE_NOT_AVAILABLE` or `ENTITY_NOT_FOUND`).

## `agent_run`

- Runs its own searches and reading on Exa's servers and returns a cited answer. Uses Exa credit, not the user's Claude allowance. A minimal-effort test made 3 searches and cost about $0.012.
- `effort`: always set it. Choose by job:

  | Job | Effort | Tested cost and time |
  |---|---|---|
  | One question needing a few sources | `minimal` | 3 searches, $0.012 |
  | A list or comparison of known scope | `low` | not yet measured |
  | Open-ended or hard research where the right depth isn't clear | `auto` with `budget: {"maxCostDollars": 1}` | 30 searches, $0.63, about 3 minutes, finished under the cap |
  | The user asks for a deep dive | `auto` with a higher cap the user agrees to, or `medium` to `xhigh` | not yet measured |

  `auto` is charged by usage and defaults to a $5 cap, so never send it without a `budget`. The cap is a ceiling, not a fixed price. If `stopReason` is `budget_reached`, tell the user the answer may be incomplete. Fixed efforts have a flat price and reject `budget`.
- Each `agent_run` call waits about 50 seconds before returning `status: "running"`. Keep calling with the `runId`; tell the user it's still working if it takes more than a minute or two.
- The answer includes a long citation list (`grounding`, one entry per field). Use it to link sources, but don't repeat it to the user.
- Exa Agents can't reach Reddit or X, so "what users say" comes from store reviews, forums and blogs. When Reddit opinion matters, add a Parallel search for it.
- `outputSchema`: give one for lists or tables. Use a top-level object, put rows in a named array with `maxItems`, include a source URL field per row, and a `coverage_notes` field.
- If the response says `status: "running"`, call again with `runId` set to the returned `id`. Don't start a duplicate run.
- To refine or extend, pass `previousRunId`, and `input.exclusion` to avoid repeats.
- Read `output.grounding` for the citations. Don't assume the result is complete; say "best-effort" unless the set was small and checked.
- Optional `dataSources` add paid partner data (for example `similarweb` for site traffic, `particle` for podcast transcripts). Only use when clearly useful and name the data in the query.
- Needs a signed-in Exa account.

## Writing good queries

| Looking for | Weak | Better |
|---|---|---|
| Blog posts about X | `X` | `in-depth blog post about X written by a practitioner` |
| A company doing Y | `Y company` | `startup building Y for small studios` with `category: company` |
| Software fix | `blender curve twist` | `forum answer explaining how to stop the profile twisting when using Curve to Mesh in Blender geometry nodes` |

- AND, OR, NOT and quote marks are just words to Exa.
- One or two word queries give scattered results.
- Word order changes results slightly; a reworded second call can surface different pages.
- If nothing useful comes back: make the query longer and more specific, then try a different angle. If several angles fail, the topic may have little coverage; say so.

## Quirks found in testing

- No Reddit or X: searching with `includeDomains: ["reddit.com"]` returns zero results.
- Results arrive as raw data, which adds about 500 characters per result.
- A fresh download (`maxAgeHours: 0`) gives the same quality as the stored copy but can take up to 10 times longer (19 s against 2 s on one PDF).
- The connector doesn't say whether a page came from the stored copy or a fresh download.
- The free plan has rate limits; a signed-in account lifts them.
