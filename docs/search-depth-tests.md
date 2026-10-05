# Why searches stayed shallow, and which settings help

Tests run on 5 October 2026 through the Search connector, after test runs of `web-search` and `deep-search` gave shallow answers. The aim was to find general fixes, using two problems seen in those runs as examples:

- Companies described as active when public records showed they had gone bust.
- Claude saying it wasn't sure about something it had never searched for.

## 1. What went wrong

| Problem | Cause |
|---|---|
| Defunct companies listed as active | A search for "leading UK vertical farming companies" returns each company's own website and profile. These describe the company as it presents itself and never mention administration. Nothing in the old skills asked Claude to check whether something still exists. |
| "Not sure" without looking | The old `web-search` skill said "typical 1-2 calls, max ~4" and "excerpts answer it -> answer". Claude treated the first results as the answer and stopped. |
| No follow-up on promising leads | Neither skill said what to do with a partial answer, so Claude reported it instead of reading further. |

## 2. Test: key players in a sector

Question: who are the key players in UK vertical farming?

| Search | What came back | Showed that firms had collapsed? |
|---|---|---|
| General search, standard depth | Company websites, a 2024 Jones Food Company launch article, a 2024 investment press release | No. Jones Food Company appeared as a growing business |
| `type: companies`, 10 results | Ten company profiles, including Vertical Future ("#1 CEA technology company") | No. Only a hint: "~8 staff (-75.8% a year)" |
| General search, `goal` asking for closures | Almost the same results as without a goal | No |
| General search, `depth: fast` | Same kind of results | No |
| General search, `depth: thorough` | Added The Grocer (17 Dec 2025): GrowUp rescued from administration; the article also names the Jones Food Company and Vertical Future collapses | Yes, partly |
| `type: news`, after 2023, "UK vertical farming company enters administration, liquidation or closes down" | BBC, The Grocer, HortiDaily: Jones Food Company (administration, April 2025, owed £22m) and Vertical Future (administration, August 2025) | **Yes, fully** |
| `verify`: "Vertical Future is currently trading" | City AM (3 Oct 2025): collapsed owing £7.9m; FreshPlaza: administrators appointed 5 Aug 2025 | **Yes** |
| `verify`: "Fischer Farms is operating its Norfolk farm in 2026" | Its own site plus January 2026 trade news | Yes: correctly shown as still running |
| Companies House (`sites` set to the register) | Fischer Farms: "Company status Active", last statement March 2026 | Yes: an official record |

**Lessons**
- Search results answer "who exists", not "who still exists". A separate search for closures is needed, and it's cheap: one news search found two collapses.
- `verify` works well for status when the claim is phrased as "X is still trading in 2026".
- Companies House pages can be searched and read, so official status can be checked directly.
- The `goal` setting changes which passages are shown much more than which pages are found. To find different pages, run another search.

## 3. Test: "latest version" from an official page

Question: what is the latest Python version? Search limited to python.org.

| Setting | Result |
|---|---|
| Stored copy (default) | The downloads page said 3.14.6 (June 2026); another page said 3.14.7 (August 2026) |
| `fresh: true` | 3.14.8, released 30 September 2026. This is correct |

**Lesson:** even the official page can be months out of date in the stored copy. For "latest" facts, re-download the page.

## 4. Test: fixing a problem

Question: Blender's Ctrl+Space shortcut doesn't work on a Mac.

| Setting | Result |
|---|---|
| `depth: fast`, 5 results | The fix was in result 1 (macOS uses Ctrl+Space to switch language; turn that off). Result 2 was a 2025 Blender plan to change this shortcut on Mac |
| `type: discussions`, 5 results | Same fix, plus older Reddit and forum threads |

**Lessons**
- Fast is enough for a well-known fix.
- Result 2 was a lead worth following: if a newer Blender changed the default, the answer changes. The new skills tell Claude to follow leads like this rather than stop at the first fix.

## 5. Cost of each setting

Prices from [Exa's pricing page](https://exa.ai/pricing) and [Parallel's pricing page](https://docs.parallel.ai/resources/pricing), October 2026.

| Connector call | Engines used | Cost |
|---|---|---|
| `search`, fast | Exa fast | about $0.007 |
| `search`, standard (default) | Exa auto + Parallel fast | about $0.008 |
| `search`, thorough | Exa deep + Parallel advanced | about $0.017 |
| `search`, discussions or reviews | Exa + Parallel basic | about $0.012 |
| `fetch` | Exa contents (Parallel as backup) | about $0.001 per page |
| `verify` | Exa + Parallel per claim | about $0.008 per claim |
| `research`, quick / standard / deep | Exa Agent (+ Parallel pro for deep) | $0.025 / $0.10 / up to $1.10 |

- Exa charges the same for 1 to 10 results, and $0.001 for each result after 10. So 10 results cost the same as 8.
- `fresh` costs nothing extra; it is only slower.

**Best value:** standard depth by default; 10 results for lists; `thorough` when a list or an obscure topic matters (twice the cost, and it found the closure news here); one extra news search plus one `verify` call for status checks (about $0.03 in total). This is far cheaper than a research agent and caught everything the agent is meant to catch here.

## 6. Bug found: research results lost after 60 seconds

The `research` tool waited up to 170 seconds before replying. In Claude Code, the call gave up after 60 seconds, so the run was paid for but its result could never be collected. The wait is now 45 seconds; after that the tool returns a code to collect the result later.

## 7. Not tested

These Exa options would need an Exa API key in the test environment (the connector doesn't expose them):

| Option | What it might add |
|---|---|
| `deep-lite` search type ($0.012, about 4 seconds) | A cheaper, faster middle step between standard and thorough |
| `deep-reasoning` ($0.015, 12 to 40 seconds) | Harder questions |
| `subpages` with `subpageTarget` (for example "news", "press") | Reading a company's news page in the same search, to see its latest activity |
| `additionalQueries` (deep types only) | Several angles in one search |
| `summary` | Short summaries instead of passages; earlier tests showed they drop details |

## 8. What changed

**Skills** (`skills/web-search`, `skills/deep-search`)
1. A loop replaces the fixed call counts. After each search, Claude checks every point of the answer: answered, partly answered, or open.
2. Open points get a new search from a different angle (another kind of source, the cause rather than the symptom, the exact error, another approach). Promising leads get read and checked.
3. A point is only given up after 3 different attempts, and the answer then says what was tried.
4. Claude may not say it's unsure about something it hasn't searched for.
5. Status check: anything called current needs dated evidence from the last year. A company's own site or profile doesn't count. For lists, one news search for closures, then a check on each company kept.
6. Settings guidance from these tests (10 results for lists, `thorough` for lists and hard topics, `fresh` for "latest" facts, `goal` doesn't change ranking).

**Connector**
1. Search results end with the date of the newest result, and a warning when everything is over a year old.
2. Company and people searches add a reminder that profiles don't show whether something still exists.
3. `verify` also asks for newer information (closures, takeovers, new versions) and shows the date of the newest evidence for each claim.
4. `research` waits 45 seconds instead of 170.
