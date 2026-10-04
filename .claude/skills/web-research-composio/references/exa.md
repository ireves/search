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

**Forum threads on one site (no date filter)**
```json
{"tool_slug": "EXA_SEARCH", "arguments": {
  "query": "Figma variable modes resetting properties of nested component instances",
  "includeDomains": ["forum.figma.com"], "numResults": 5,
  "contents": {"highlights": {"query": "cause, workaround, or Figma staff reply", "maxCharacters": 800}}}}
```
No date filter on purpose: the definitive staff reply can be years old. Several domains are allowed in `includeDomains` (for example `blender.org` and `developer.blender.org`). Highlights don't show who wrote a reply: say "appears to be from staff" unless the page shows a role.

**Case studies from portfolios and company blogs (batch both in one call)**
```json
{"tool_slug": "EXA_SEARCH", "arguments": {
  "query": "designer's portfolio case study of redesigning an app's onboarding with before and after metrics",
  "category": "personal site", "numResults": 8,
  "contents": {"highlights": {"query": "product, what changed, measured result with numbers", "maxCharacters": 1000}}}}
```
```json
{"tool_slug": "EXA_SEARCH", "arguments": {
  "query": "company blog post about redesigning our onboarding, with before and after numbers",
  "excludeDomains": ["medium.com", "linkedin.com", "reddit.com"], "numResults": 8,
  "contents": {"highlights": {"query": "product, what changed, measured result with numbers", "maxCharacters": 1000}}}}
```
Excluding sites doesn't remove agency marketing pages or anonymous clients: mark those as low confidence. Numbers on the author's own site are "primary source, self-reported".

**Job listings (recent, UK, fresh)**
```json
{"tool_slug": "EXA_SEARCH", "arguments": {
  "query": "job posting for a junior or mid-level 3D artist using Blender in the UK",
  "startPublishedDate": "<start of the user's window, e.g. 1 month before today>", "userLocation": "GB",
  "numResults": 8,
  "contents": {"maxAgeHours": 0, "livecrawlTimeout": 30000,
               "highlights": {"query": "company, location, salary, closing date, whether still open", "maxCharacters": 500}}}}
```
Use the user's seniority and tool in place of the example. Listings can be closed even when recent, and old or undated ones still slip through the date filter (one "applications have now closed" listing came back): drop any with no date in the window unless the text shows one. Then read the top 2 or 3 candidates with `EXA_GET_CONTENTS_ACTION` (`text: false`, `maxAgeHours: 0`, a highlights question on open or closed, Blender and experience level) before presenting a job as open. Don't put `linkedin.com` in `includeDomains` for jobs: it returns people's profiles. LinkedIn posts can still appear without it; treat them as unverified, or add `excludeDomains: ["linkedin.com"]` (not together with `includeDomains`). `userLocation: "GB"` doesn't stop non-UK or remote-US jobs appearing. Expect 10 to 15 seconds for a fresh-download search.

**Academic papers**
```json
{"tool_slug": "EXA_SEARCH", "arguments": {
  "query": "academic study measuring dark patterns in subscription cancellation flows across many websites",
  "category": "research paper", "numResults": 8,
  "contents": {"highlights": {"query": "title, year, method, key quantitative finding", "maxCharacters": 1000}}}}
```
The same paper can appear from several sites (arXiv, ACM, ResearchGate) or in two searches. Dedupe by title. Use `numResults: 6` per search: two 8-result paper searches (about 35,000 characters) were moved to the remote workspace.

About half the results link to `exa.ai/library/publication/...`. The original DOI is in `entities[0].properties`, which is a JSON string and shows only as `{object}` in the preview. Pull it out with `COMPOSIO_REMOTE_BASH_TOOL`, for example (this line is a sketch, not tested as written; check the file's shape first with `jq 'keys'`; the path to the results varies):
```
jq -r '.. | objects | select(has("entities")) | [.title, .publishedDate, .url, (.entities[0].properties // "" | fromjson? | .doi // "no doi")] | @tsv' /path/to/saved.json
```
Some library entries have no DOI. Then search the title on the likely publisher, or say no original link was found. `publishedDate` of 01-01 is only the year.

**People**
```json
{"tool_slug": "EXA_SEARCH", "arguments": {
  "query": "senior environment artist at Framestore London",
  "category": "people", "numResults": 3,
  "contents": {"highlights": {"query": "current role, employer, location", "maxCharacters": 500}}}}
```
Each person carries a work-history block of 2,000 to 6,000 characters that `maxCharacters` doesn't shrink, so three results can be 10,000 to 17,000 characters. For a famous person, batch this with a normal `EXA_SEARCH` (Wikipedia, the official site) to confirm who they are. A people search can rank an unrelated namesake first: if nothing matches, say no match was found and don't give the namesake's details. `publishedDate` on profiles is crawl time, and results carry `exa.ai/library/person/...` ids that must not be linked.

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
- **Check `statuses`.** The call reports success even when a link failed. Look for `CRAWL_NOT_FOUND`, `CRAWL_LIVECRAWL_TIMEOUT` or `SOURCE_NOT_AVAILABLE`, and try `PARALLEL_EXTRACT_WEB_CONTENT` (with an objective) for that link. Search results have no `statuses`; only reads do.
- `maxAgeHours: 0` forces a fresh download for pages that change (top level of `arguments` on reads; inside `contents` on searches).
- A YouTube read returns the transcript only, not the video description or its links.
- Fails on Reddit, X and LinkedIn.

## Exa Agent (`EXA_CREATE_AGENT_RUN` and `EXA_GET_AGENT_RUN`)

- Runs its own searches and reading on Exa's servers and returns a cited answer. Uses Exa credit, not the user's Claude allowance.
- **Call shape (a wrong guess cost two failed calls):** the task goes in a top-level `query`. `input` is only for rows to enrich (`input.data`) or avoid (`input.exclusion`), never for the question.
  ```json
  {"tool_slug": "EXA_CREATE_AGENT_RUN", "arguments": {"query": "<the task, with what to return>", "effort": "auto", "budget": {"maxCostDollars": 1}}}
  ```
  Then `{"tool_slug": "EXA_GET_AGENT_RUN", "arguments": {"runId": "<id>"}}`. Don't name candidates in the query unless the user did, or the ranking gets biased.
- **It returns straight away** with `status: "running"` and an `id`. Call `EXA_GET_AGENT_RUN` with `runId` set to that `id` until `status` is `completed`. In testing a `minimal` run was done within 5 seconds; `auto` runs can take about 3 minutes. Do other useful work between checks (for example the Reddit search) rather than checking in a tight loop. To wait, use `COMPOSIO_REMOTE_BASH_TOOL` with `sleep 50` (a `sleep 150` timed out at about 60 seconds), then poll about once a minute. A running poll shows cost $0 and no searches for the first minute or so: that doesn't mean it is stuck. Tested `auto` run: 37 searches, $0.63, about 3 minutes, 4 polls, finished under the cap. Don't start a duplicate run. Its ranking is a count over a small sample of pages: call it "not exhaustive".
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
- Glassdoor: finds review pages (sometimes on regional domains such as glassdoor.com.au) with partial review excerpts but no ratings. Read them with Parallel. It can also surface pages for other businesses with the same name (an Indeed page mixed several "Framestore" companies): check the company matches.
- Review-style pages from Exa include SEO spam. Prefer reviewers who say they tested the product.
- Trustpilot: reads some review text and sometimes the score, but not the star breakdown. Use Parallel when the breakdown matters.
- Quora: returns an error page instead of answers.
- `category: "people"` returns LinkedIn-derived profile data: headline, location, work and education history, profile URL. Each result carries a 2,000 to 6,000 character profile block on top of highlights, so use 3 results.
- **Unrelated `entities` blocks:** a YouTube read came back with a profile of a person who had nothing to do with the video. Ignore any `entities` block that doesn't match the page.
- Papers and people can come back with Exa library links (`exa.ai/library/...`). Link the original (DOI, arXiv, publisher, official page) in answers.
- A fresh download (`maxAgeHours: 0`) gives the same quality as the stored copy but can take up to 10 times longer.
- Results show whether a page came from the stored copy or a fresh download (`statuses[].source`: `cached` or `crawled`) on content reads.
- Stored copies can lag: a search extract of the Blender release page showed 5.2.0 while the live download page showed 5.2.2.
