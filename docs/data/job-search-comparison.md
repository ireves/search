# Job search: Composio "Job Search" toolkit vs current tools

Run 22 October 2026. Five UK searches, same on every tool:

1. junior product designer, London
2. UX researcher, Manchester
3. data analyst, Bristol
4. graphic designer (part time), Leeds
5. python software engineer, Edinburgh

Tools compared:
- **Search connector**, `search` with `type: jobs`, `location`, `country: GB`, 10 results (Exa plus the Apify job boards: LinkedIn, Indeed, Glassdoor, Totaljobs).
- **Indeed connector**, `search_jobs` with `country_code: GB`.
- **Composio Job Search toolkit** (instant account, no sign-in needed), seven of its search tools.

"On target" counts results whose title matches the role. "In the city" counts results whose location names the city (strict: Salford does not count for Manchester, so this undercounts a little).

## Results

| Tool | Results (5 searches) | On target | In the city | Has link | Has salary | Avg time | Cost per search |
|---|---|---|---|---|---|---|---|
| Composio Jobs Search API (LinkedIn + Indeed + Glassdoor in one call) | 100 | 80 | 40 | 100 | 24 | 4.0 s | $0.00025 |
| Composio LinkedIn | 50 | 37 | 28 | 50 | 0 | 1.0 s | $0.0005 |
| Composio Glassdoor (glassdoor.co.uk) | 34 | 24 | 25 | 34 | 29 | 3.7 s | $0.0025 |
| Composio JSearch (Google for Jobs) | 30 | 30 | 24 | 30 | 0 | 4.5 s (one call 24 s) | $0.0025 |
| Composio Bing | 72 | 64 | 63 | **0** | 0 | 1.2 s | $0.0005 |
| Composio Indeed | 63 | 33 | n/a | 63 | 0 | 0.7 s | $0.0005 |
| Composio Google Jobs | 50 | **0** | 1 | 50 | 0 | 1.8 s | $0.0006 |
| Search connector (jobs) | 50 | ~35 | **9** | 50 | 9 | not timed | $0.007 to $0.052 (total $0.085) |
| Indeed connector | 35 | ~14 | ~20 | 35 | 0 | not timed | free |

## What stood out

- **The Search connector's job boards were mostly down.** Apify reported "out of credit" for all four boards on three of the five searches, and for some boards on the other two. Without them the connector only had Exa, and Exa returned jobs in the US, India, Brazil and Switzerland. Only 9 of 50 results were in the right city, all from the two searches where some boards still worked.
- **Exa ignores the place.** The connector passes `location` to the job boards only, not to Exa (`connector/lib/tools/search.ts`). So when the boards fail, nothing keeps results local.
- **Composio's Jobs Search API was the best all-rounder.** One call returns LinkedIn, Indeed and Glassdoor together, with direct apply links (often the employer's own page), salaries where given, and posting dates. It is the cheapest tool tested. Its replies are large (about 84,000 characters for 20 jobs) because they include full descriptions.
- **Composio LinkedIn was the fastest useful tool** (about 1 second) with clean, relevant UK results, but no salaries.
- **Composio Glassdoor gives salaries on almost every job**, but some look wrong: a "Junior Product Designer" at Entrust shows £109,000 to £119,000. It returned few results for Manchester (1) and Leeds (3).
- **JSearch** returned nothing for two of the five searches, and its first call took 24 seconds. Asking for specific fields made it fail with an error.
- **Bing** finds relevant, local jobs but gives no links, so it is not usable on its own.
- **Google Jobs** is not usable: it returned general pages such as "Jobs in London | Indeed" for every search.
- **Composio Indeed** and the **Indeed connector** return the same listings and ignore the role a lot (a junior product designer search returned an AI engineer and a merchandiser). The Indeed connector also returned jobs up to seven months old.
- The same strong listings appeared across tools (Entrust, Chelsea FC and Wise for London; Bupa for Manchester; Babcock and Bristol City Council for Bristol), which suggests the good tools are finding the real market.

## Cost

Composio charges per call from its own wallet (shown as `instant_charge` in each reply). All 35 Composio calls in this test cost under $0.04 in total. The Search connector cost $0.085 for five searches, of which $0.050 was Apify for the two searches where some boards worked.

## Suggested next steps

1. Top up Apify credit, or the connector's job searches stay mostly non-local.
2. Pass the location into the Exa query for job searches, so results stay local even without the boards.
3. Consider replacing the four Apify boards with Composio's Jobs Search API (plus LinkedIn as a fast extra). It would be far cheaper and quicker, but the connector would need a Composio API key.
