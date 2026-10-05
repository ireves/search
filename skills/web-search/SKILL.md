---
name: web-search
description: Default web search and page reading via the Search connector (Exa + Parallel); replaces built-in web search and web fetch. Use for anything from the web (current facts, news, prices, versions, docs, software help, reviews, Reddit/X opinion, papers, people, companies, jobs) or to read a link, PDF or YouTube video, even if the user doesn't say "search".
---

Tools: search, fetch, verify, research from the Search connector. Names may be prefixed (Search:search, mcp__search__search); match the suffix. Never use built-in web_search/web_fetch. Tools missing -> tell user to add the connector; stop.

Budget: results persist in context, so no wasted calls, but stopping early is the bigger risk. Simple fact 1-2 calls; most questions 2-5; up to ~8 while a key point is still open. Bigger jobs -> suggest /deep-search.

LOOP
1. Points: list (silently) what a complete answer needs: 1-5 points.
2. Search. query = description of the ideal page with names/versions/places/years ("official release notes for Blender 5.2", not "blender new"). goal = facts to pull.
3. Assess each point after every call: answered (source + date) | partial | open. Note leads: promising details not yet confirmed.
4. Follow up, one round per call, parallel calls when independent:
   - Open point -> new angle, not a synonym: other source type (official docs, issue tracker/changelog, news, discussions, papers), the cause instead of the symptom, the exact error text, another approach or workaround.
   - Lead -> dig: fetch it with question; check it fits (version, platform, region, date); look for proof it worked (replies, later posts, changelog) or later reports it stopped working.
   - Changeable fact -> STATUS CHECK (below).
5. Stop when every point is answered, or a point has had 3 distinct attempts. Then answer.

Never write "not sure", "may", "couldn't confirm" or "appears to" about something not yet searched for. Search it first; if still unresolved, say what was tried.

STATUS CHECK (anything described as current: a company trading, a product sold, a project maintained, a version latest, a person in a role, a fix still needed, a price, a rule in force)
- Needs dated evidence from the last ~12 months. Own website, profile, directory listing or "about" page = description, not proof of status.
- Newest evidence older than ~12 months -> status unknown -> look for change: search type news, after ~2y, query as a page description: "news that <name> entered administration, closed, was acquired or rebranded" (software: deprecated, discontinued, replaced, fixed in a later version). Official registers (Companies House, SEC, OpenCorporates) via sites.
- Lists (key players, best tools): one sector-wide news search for closures/takeovers, then verify the status of each entity you keep ("X is still trading in <year>"). Drop or flag defunct ones.
- Old posts = "last activity <date>", never "active".

Parameters (tested Oct 2026):
- type (omit for general): news (+after "7d"/"2y") | discussions = Reddit/forums | x | reviews | papers | people | companies (self-descriptions only; never status evidence) | code | jobs | financial.
- max_results: 5 for one fact; 10 for lists/discovery (same price as 8).
- depth: fast for trivial lookups; thorough (2x cost, slower) for lists, obscure topics, or when a standard search left gaps. It surfaced closure news a standard search missed.
- fresh:true on official pages for latest/current facts. Stored copies of python.org were two releases behind.
- sites (one site or section, e.g. an official domain or register), after/before, country.
- goal shapes excerpts, barely ranking. Different angle = separate search.

Accuracy:
- Numbers/dates the answer hinges on, from only one secondary source: one verify call (several claims per call).
- Check result dates; say "as of <date>" for changing facts. Copies of one story = one source.
- Never fill gaps from memory.

Answer: lead with the answer; inline links with descriptive text to original pages; label status with its date ("trading, last filing March 2026"; "went into administration Aug 2025"); brief uncertainty notes (one source / sources disagree / not found after <what was tried>); no pasted results, quote only proof.

Errors: "no API key" | "rejected the API key" | "out of credit" -> user updates key at connector settings page (connector URL with /settings instead of /mcp). One engine unavailable -> continue, mention in one line. Login-walled pages (LinkedIn, Quora, paywalls) unreadable -> say so; person background -> type people.
