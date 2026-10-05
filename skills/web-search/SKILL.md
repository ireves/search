---
name: web-search
description: Default web search and page reading via the Search connector (Exa + Parallel); replaces built-in web search and web fetch. Use for anything from the web (current facts, news, prices, versions, docs, software help, reviews, Reddit/X opinion, papers, people, companies, jobs) or to read a link, PDF or YouTube video, even if the user doesn't say "search".
---

Tools: search, fetch, verify, research (Search connector; names may be prefixed, e.g. Search:search; match the suffix). Never built-in web_search/web_fetch. Tools missing -> tell user to add the connector; stop.

Budget: output stays in context. Fewest calls for a reliable answer: usually 1-2, max 4; independent calls in one message. Bigger jobs -> suggest /deep-search.

ROUTE (first match)
1. Link given -> fetch (question if the user asks something specific).
2. One fact -> search max_results 5; answer if an excerpt states it.
3. Latest/current (version, price, status, role holder, rule in force) -> search, then fetch the official page with question (fetch is live; excerpts can be stale).
4. Error/how-to/software -> search type code or web; + type discussions for user fixes.
5. Opinion/experience/"worth it" -> type discussions; ratings of a product/employer/company -> + type reviews.
6. Recent events -> type news, after "7d"/"30d".
7. papers | people (3 results; confirm identity) | companies (one named company: add its site, "Monzo monzo.com") | jobs | financial -> that type.
8. Several facts, comparison, list, "top N" -> research quick (one topic) or standard (several entities, or facts that must be current); then verify 1-3 key numbers/dates.

QUERY: describe the ideal page with names, versions, places, years ("official release notes for Blender 5.2", not "blender new"). goal = facts to pull + preferred sources. sites = one site/section only. fresh = live prices/stock only. Nothing useful -> one retry, more specific or another type; then report the gap.

READ: excerpts suffice -> stop. Else fetch 1-2 best links with question (always for long pages/PDFs). "publisher limits" / "Couldn't read" -> use another source.

ACCURACY: "as of <date>" for changing facts. Key number/date from one secondary source -> verify (batch claims); judge supported/contradicted/outdated/not found. research = leads: check its [n] sources for critical facts. Copies of one story = one source. Never fill gaps from memory; say what's unconfirmed.

ANSWER: answer first; inline descriptive links to original pages; brief uncertainty notes; quote only proof; never paste results.

ERRORS: "no API key" / "rejected the API key" / "out of credit" -> user fixes the key on the connector's settings page (connector URL with /settings instead of /mcp). One engine down -> continue, mention it in one line. Login-walled pages (LinkedIn, Quora, paywalls) unreadable -> say so; person background -> type people.
