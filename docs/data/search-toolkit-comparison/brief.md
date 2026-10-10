# Search toolkit benchmark: shared brief for workers

We are comparing search toolkits, reached ONLY through the Composio connector (mcp__Composio__* tools; load them with ToolSearch "select:mcp__Composio__COMPOSIO_SEARCH_TOOLS,mcp__Composio__COMPOSIO_GET_TOOL_SCHEMAS,mcp__Composio__COMPOSIO_MULTI_EXECUTE_TOOL,mcp__Composio__COMPOSIO_REMOTE_WORKBENCH"). Do NOT use WebSearch, WebFetch, the Search connector, TinyFish MCP, browser-use plugin or any non-Composio tool to search. Pass session_id "find" to Composio meta tools.

All toolkits below are already connected (Composio "instant accounts"; only the listed tool slugs work on them). Do not create new connections.

## The 20 questions (use the text exactly as the query, unless the tool needs a different input shape; then note the adaptation)

1. cash ISA allowance 2027 changes
2. 0.2m right angle data usb-c cable
3. Dettol 24h protect spray ingredients
4. Exa search API price per 1000 searches
5. how to add environment variable in Vercel dashboard without command line
6. set up custom email domain with iCloud+ step by step
7. How does Woolite Darks work
8. how to check National Insurance record and pay voluntary contributions
9. iPhone shortcut transcribe voice memo to text automatically
10. does YNAB support Starling Bank direct import 2026
11. Supabase free project paused after inactivity how to prevent
12. Claude Code cloud environment network access allowed domains
13. Apple Liquid Glass Human Interface Guidelines summary
14. Exa vs Parallel vs Tavily search API for AI agents
15. reddit Claude skills vs MCP servers when to use which
16. junior product designer jobs London UK
17. that tool that turns figma designs into a website
18. app like notion but simpler for personal notes
19. How to convert trimesh to a quadmesh in Blender
20. clade code remote enviroment acces denied   (typos are deliberate: tests typo tolerance)

Today is 9 October 2026. The user is in the UK.

## What a good result looks like (grading guide; facts marked ? are unverified, judge by source quality)

1. From 6 April 2027 the cash ISA limit falls from £20,000 to £12,000 for under-65s; over-65s keep £20,000; total ISA allowance stays £20,000 (Autumn Budget, Nov 2025). Best: GOV.UK, MoneySavingExpert, major UK press.
2. Product listings (e.g. Amazon UK, specialist shops) for a ~20 cm right-angle (90°) USB-C cable that carries data, not charge-only.
3. Ingredients / active substance for a Dettol "24h" protection disinfectant spray (official Dettol page, retailer listing or safety data sheet). Generic Dettol pages score lower.
4. Exa's official pricing page or a recent source quoting Exa's per-1,000 search price (? $5 per 1k searches historically; may have changed by 2026).
5. Vercel docs: Project > Settings > Environment Variables, add name/value, pick environments, save, redeploy.
6. Apple support article on iCloud+ Custom Email Domain (iCloud.com or Settings), buy domain or use your own, add DNS records (MX, SPF TXT, DKIM CNAME), verify.
7. Woolite official page or credible explainer on how Woolite Darks protects dark colours from fading.
8. GOV.UK: check NI record (HMRC app / personal tax account), pay voluntary Class 2/3 contributions (online service, gaps usually up to 6 years back).
9. How to transcribe voice memos on iPhone (Voice Memos built-in transcripts in iOS 18+, Shortcuts "Transcribe Audio" action or similar), with automation.
10. Whether YNAB's UK direct import (Open Banking) supports Starling (official YNAB help page best; ? it does).
11. Supabase free projects pause after 7 days inactivity; prevent by upgrading or keeping the project active (scheduled pings). Supabase docs or credible guides.
12. Claude Code on the web docs (code.claude.com/docs/en/claude-code-on-the-web): network access levels and the default allowed domain list.
13. Apple HIG Liquid Glass / Materials page (developer.apple.com/design/human-interface-guidelines) or a good summary.
14. Comparison articles or benchmarks covering Exa, Parallel and Tavily for AI agents.
15. Actual Reddit threads discussing Claude Skills vs MCP servers.
16. Live job listings (LinkedIn, Indeed, Welcome to the Jungle, company pages) for junior product designer roles in London.
17. Vague query. Good answers: Figma Sites, Framer, Anima, Locofy, Builder.io, Webflow plugin. Best: names Figma Sites or a list of such tools.
18. Recommendations: Apple Notes, Obsidian, Bear, Craft, Anytype, Capacities, Simplenote, etc. Reddit/listicles fine.
19. Blender: Edit Mode, select all, Face > Tris to Quads (Alt+J); for clean topology use Remesh (Quad) / QuadriFlow. Docs, Stack Exchange, Blender Artists.
20. Should be understood as "Claude Code remote environment access denied": Claude Code on the web docs on network access / permissions, or GitHub issues about it.

## Scoring per question (0 to 3)
- 3: top results directly answer the question from a strong source (official or highly credible), current.
- 2: relevant and useful but weaker source, partly outdated, or answer needs digging.
- 1: loosely related; user would need to search again.
- 0: irrelevant, empty, or error.
Also flag: outdated info, wrong facts, spam/SEO pages, duplicates, missing dates.

## How to run (measure speed fairly)
- Get each tool's input schema first with COMPOSIO_GET_TOOL_SCHEMAS (include output_schema if helpful).
- Use COMPOSIO_REMOTE_WORKBENCH to run the queries with `run_composio_tool(slug, args)` and time each call with `time.perf_counter()`. Run calls one at a time (sequentially) so latency is clean; split into cells of about 5 to 8 calls to stay within the 180 s cell limit. Retry a failed call once and record both.
- Use sensible settings: about 5 to 10 results per query, UK region where the tool supports it (gl="uk", country="GB", etc). Keep settings the same across questions for a tool. Record the exact settings used.
- For each call record: latency (s), ok/error (with error text), number of results, response size in characters (len(json.dumps(result))), and the top 3 results (title, URL, date if given, snippet trimmed to ~200 chars). If the tool gives a direct answer text, keep the first ~400 chars of it.
- Keep printed output compact. Store full responses in the workbench under /mnt/files/bench/<toolkit>/ if useful.
- Note any cost information you see (tool descriptions, response fields like costDollars, credits used).

## What to write (use the Write tool, local files)
Directory: /tmp/claude-0/-home-user-search/eea1d099-8765-560d-8f5c-e345e78a017b/scratchpad/results/
1. `<toolkit>.json`: {"toolkit":..., "tool_slugs":[...], "settings":{...}, "cost_info":"...", "rows":[{"q":1,"query_used":"...","ok":true,"latency_s":1.23,"n_results":5,"chars":12345,"top":[{"title":...,"url":...,"date":...,"snippet":...}],"answer":"...","score":0-3,"note":"..."}]}
2. `<toolkit>.md`: short summary: success rate, mean and median latency, mean score, mean response size, best and worst questions, strengths, limitations, quirks, cost notes, what it is best suited for.

Finish with a reply of at most 250 words: per toolkit, the headline numbers and 3 to 5 key insights. Plain British English.
