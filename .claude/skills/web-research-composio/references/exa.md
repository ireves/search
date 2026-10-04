# Exa through Composio: settings, recipes and quirks

Exa searches by meaning (embeddings), not keywords. Describe the page you want to find, not the fact you want to know.

All calls go through `COMPOSIO_MULTI_EXECUTE_TOOL` as `{"tool_slug": "...", "arguments": {...}}`.

## Contents

- Which Exa tool to use
- `EXA_SEARCH` options
- Recipes
- `EXA_GET_CONTENTS_ACTION`
- Exa Agent (`EXA_CREATE_AGENT_RUN` and `EXA_GET_AGENT_RUN`)
- Writing good queries
- Quirks found in testing

## Which Exa tool to use

| Tool | Use for | Avoid for |
|---|---|---|
| `EXA_SEARCH` | All searches | Reddit and X (returns nothing) |
| `EXA_GET_CONTENTS_ACTION` | Reading known links, PDFs and YouTube transcripts, with a question | Reddit, X, LinkedIn |
| `EXA_CREATE_AGENT_RUN` then `EXA_GET_AGENT_RUN` | Multi-step research, lists, comparisons, enrichment | Single lookups |
| `EXA_ANSWER`, `EXA_CREATE_RESEARCH` | Don't use. The Agent replaces them | |

## `EXA_SEARCH` options

These differ from the direct Exa connector. Extract settings sit inside `contents`.

| Option | Notes |
|---|---|
| `query` | A description of the ideal page. Long, natural phrases work best |
| `numResults` | 5 for a named thing, 8 to 10 for a narrow search, up to 15 for broad discovery. Never above 15; run more angles instead |
| `contents.highlights` | Always set: `{"query": "<facts to pull out>", "maxCharacters": 800 to 1500}`. This is what keeps results short and on topic |
| `contents.text` | **Never set in a search.** It adds the full page text. Leaving it out returns no text |
| `contents.maxAgeHours` | Omit to use Exa's stored copy (fast). `0` forces a fresh download: use only for pages that change (jobs, news, prices), with `contents.livecrawlTimeout: 30000` |
| `contents.summary` | A short Exa-written summary per page. Compact but can drop details; don't rely on it for exact figures |
| `includeDomains` / `excludeDomains` | Site names (`forum.figma.com`) or paths (`arxiv.org/pdf`). Leave out `https://`. **Use one or the other, never both** |
| `startPublishedDate` / `endPublishedDate` | `YYYY-MM-DD`. Undated pages can still slip through, so check dates in results. Not supported with `category: "company"` or `"people"` |
| `category` | `company`, `people`, `research paper`, `news`, `personal site`, `financial report`. (No `pdf` or `github` here: use `includeDomains: ["github.com"]` for GitHub) |
| `userLocation` | Country code, for example `GB` for UK jobs or prices |
| `includeText` / `excludeText` | **Exactly one phrase of up to 5 words**, in a list. More than one phrase is rejected |
| `additionalQueries` | Only works with the `deep` search types. For different angles, batch separate `EXA_SEARCH` calls instead |
| `type` | Leave as `auto`. `deep-lite`, `deep` and `deep-reasoning` are slower (4 to 40 seconds) and dearer; prefer the Agent for deep work |

Cost: about $0.007 per search (charged by Exa to the connected Exa account).

## Recipes

**General search**
```json
{"tool_slug": "EXA_SEARCH", "arguments": {
  "query": "detailed case study of a product team redesigning their onboarding flow, with before and after metrics",
  "numResults": 8,
  "contents": {"highlights": {"query": "company, what changed, measured result with numbers", "maxCharacters": 1000}}}}
```

**Recent forum threads on one site**
```json
{"tool_slug": "EXA_SEARCH", "arguments": {
  "query": "Figma variable modes resetting properties of nested component instances",
  "includeDomains": ["forum.figma.com"], "startPublishedDate": "2026-01-01", "numResults": 5,
  "contents": {"highlights": {"query": "cause, workaround, or Figma staff reply", "maxCharacters": 800}}}}
```

**Job listings (recent, UK, fresh)**
```json
{"tool_slug": "EXA_SEARCH", "arguments": {
  "query": "job posting for a junior or mid-level 3D artist using Blender in the UK",
  "startPublishedDate": "<start of the user's window, e.g. 1 month before today>", "userLocation": "GB",
  "numResults": 8,
  "contents": {"maxAgeHours": 0, "livecrawlTimeout": 30000,
               "highlights": {"query": "company, location, salary, closing date, whether still open", "maxCharacters": 500}}}}
```
Listings can be closed even when recent. Check the extract (or read the page) before presenting a job as open. Don't put `linkedin.com` in `includeDomains` for jobs: it returns people's profiles, not job posts.

**Academic papers**
```json
{"tool_slug": "EXA_SEARCH", "arguments": {
  "query": "academic study measuring dark patterns in subscription cancellation flows across many websites",
  "category": "research paper", "numResults": 8,
  "contents": {"highlights": {"query": "title, year, method, key quantitative finding", "maxCharacters": 1000}}}}
```
The same paper often appears from several sites (arXiv, ACM, ResearchGate). Treat those as one source.

**People**
```json
{"tool_slug": "EXA_SEARCH", "arguments": {
  "query": "senior environment artist at Framestore London",
  "category": "people", "numResults": 4,
  "contents": {"highlights": {"query": "current role, employer, location", "maxCharacters": 500}}}}
```

## `EXA_GET_CONTENTS_ACTION`

Reads known links. Unlike the direct connector's `web_fetch_exa`, it can take a question, so there's no need to pin an address inside a search.

**Read a document or PDF with a question (tested on an ACM PDF: returned exactly the asked figures)**
```json
{"tool_slug": "EXA_GET_CONTENTS_ACTION", "arguments": {
  "urls": ["https://dl.acm.org/doi/pdf/10.1145/3359183"],
  "text": false,
  "highlights": {"query": "how many dark pattern instances, on how many sites, how many deceptive", "maxCharacters": 3500}}}
```

**YouTube transcript**
```json
{"tool_slug": "EXA_GET_CONTENTS_ACTION", "arguments": {
  "urls": ["https://www.youtube.com/watch?v=<id>"],
  "text": {"maxCharacters": 6000}}}
```

- **`text` defaults to `true`** (full page). Always set `text: false` when using `highlights`, or give `text` a `maxCharacters`.
- `urls` takes several links at once.
- **Check `statuses`.** The call reports success even when a link failed. Look for `CRAWL_NOT_FOUND`, `CRAWL_LIVECRAWL_TIMEOUT` or `SOURCE_NOT_AVAILABLE`, and try Parallel for that link.
- `maxAgeHours: 0` forces a fresh download for pages that change.
- Fails on Reddit, X and LinkedIn.

## Exa Agent (`EXA_CREATE_AGENT_RUN` and `EXA_GET_AGENT_RUN`)

- Runs its own searches and reading on Exa's servers and returns a cited answer. Uses Exa credit, not the user's Claude allowance.
- **It returns straight away** with `status: "running"` and an `id`. Call `EXA_GET_AGENT_RUN` with `runId` set to that `id` until `status` is `completed`. In testing a `minimal` run was done within 5 seconds; `auto` runs can take about 3 minutes. Do other useful work between checks (for example the Reddit search) rather than checking in a tight loop. Don't start a duplicate run.
- `effort`: always set it. Choose by job:

  | Job | Effort | Tested cost and time |
  |---|---|---|
  | One question needing a few sources | `minimal` | 3 searches, $0.012, about 5 seconds |
  | A short list of known scope | `low` | 3 searches, $0.025; thin for a "compare the top 5" question |
  | "Compare the top N", open-ended or hard research | `auto` with `budget: {"maxCostDollars": 1}` | 30 searches, $0.63, about 3 minutes, finished under the cap |
  | The user asks for a deep dive | `auto` with a higher cap the user agrees to, or `medium` to `xhigh` | not yet measured |

  `auto` is charged by usage and defaults to a $5 cap, so never send it without a `budget`. The cap is a ceiling, not a fixed price. If `stopReason` is `budget_reached`, tell the user the answer may be incomplete. Fixed efforts have a flat price and reject `budget`.
- The answer is in `output.text`; citations are in `output.grounding`. Use them to link sources, but don't repeat the list to the user.
- A `minimal` run on "current stable Blender version" answered 5.2 LTS and missed the 5.2.2 patch release. For "latest" facts, still read the official page (SKILL.md Step 4).
- Exa Agents can't reach Reddit or X, so "what users say" comes from store reviews, forums and blogs. When Reddit opinion matters, add a Reddit search.
- `outputSchema`: give one for lists or tables. Use a top-level object, put rows in a named array with `maxItems`, include a source URL field per row, and a `coverage_notes` field.
- To refine or extend, pass `previousRunId`, and `input.exclusion` to avoid repeats.
- Optional `dataSources` add paid partner data (for example `similarweb` for site traffic, `particle` for podcast transcripts). Only use when clearly useful and name the data in the query.

## Writing good queries

| Looking for | Weak | Better |
|---|---|---|
| Blog posts about X | `X` | `in-depth blog post about X written by a practitioner` |
| A company doing Y | `Y company` | `startup building Y for small studios` with `category: company` |
| Software fix | `blender curve twist` | `forum answer explaining how to stop the profile twisting when using Curve to Mesh in Blender geometry nodes` |

- AND, OR, NOT and quote marks are just words to Exa.
- One or two word queries give scattered results.
- If nothing useful comes back: make the query longer and more specific, then try a different angle. If several angles fail, the topic may have little coverage; say so.

## Quirks found in testing

- No Reddit or X. Use the Reddit toolkit and Parallel for those.
- Sites Exa searches well with `includeDomains` (tested October 2026): Hacker News, Facebook groups, Instagram and TikTok (captions), Threads, Bluesky, Steam reviews, App Store reviews, Amazon reviews, YouTube, Substack, Medium, Stack Overflow, Pinterest, NYT, WSJ, BBC, the Guardian, The Verge.
- Glassdoor: finds review pages but reads only the title. Read them with Parallel.
- Trustpilot: reads some review text and sometimes the score, but not the star breakdown. Use Parallel when the breakdown matters.
- Quora: returns an error page instead of answers.
- `category: "people"` returns LinkedIn-derived profile data: headline, location, work and education history, profile URL. Each result carries a 2,000 to 3,000 character profile block on top of highlights, so use 3 to 5 results.
- **Unrelated `entities` blocks:** a YouTube read came back with a profile of a person who had nothing to do with the video. Ignore any `entities` block that doesn't match the page.
- Papers and people can come back with Exa library links (`exa.ai/library/...`). Link the original (DOI, arXiv, publisher, official page) in answers.
- A fresh download (`maxAgeHours: 0`) gives the same quality as the stored copy but can take up to 10 times longer.
- Results show whether a page came from the stored copy or a fresh download (`statuses[].source`: `cached` or `live`) on content reads.
