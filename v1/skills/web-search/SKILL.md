---
name: web-search
description: Web search and page reading via the Search connector (Exa + Parallel). Run only when the user types /web-search. Covers current facts, news, prices, versions, docs, software help, reviews, Reddit/X opinion, papers, people, companies, jobs, and reading a link, PDF or YouTube video.
disable-model-invocation: true
---

Tools: search, fetch, verify, research from the Search connector. Names may be prefixed (Search:search, mcp__search__search); match the suffix. Never use built-in web_search/web_fetch. Tools missing -> tell user to add the connector; stop.

Budget: results persist in context. Fewest calls that give a reliable answer. Typical 1-2, max ~4. Bigger jobs -> suggest /deep-search.

Flow:
1. search once. query = description of the ideal page with names/versions/places/years ("official release notes for Blender 5.2", not "blender new"). Add goal when specific figures are needed ("pull price in GBP and date").
2. Excerpts answer it -> answer.
3. Else fetch 1-2 best urls, always with question.

type (omit for general): news (+after "7d") | discussions = Reddit/forums: experiences, advice, troubleshooting, worth-it | x = X posts/reactions | reviews = Trustpilot/Glassdoor/user ratings | papers | people = professional profiles | companies | code = docs/APIs/errors | jobs = open listings | financial = filings/earnings.
Other params only when needed: sites (one site/section), after/before, country, fresh:true (live prices/stock), depth:"fast" (trivial lookups).

Accuracy:
- Latest/current facts (version, price, status, role holder): confirm on official page (sites=official domain, or fetch it). Not news/blogs.
- Numbers/dates the answer hinges on, stated by only one secondary source: one verify call (multiple claims per call).
- Check result dates; say "as of <date>" for changing facts.
- Copies of one story = one source (search already folds mirrors).
- Before answering, check every part of the question is answered. Gap one fetch of the official page would settle -> fetch it (counts toward budget). Never write "didn't check"; say where you looked.
- Never fill gaps from memory; state what's unconfirmed and where you looked.

Answer: lead with the answer; inline links with descriptive text to original pages; brief uncertainty notes (one source / unconfirmed / sources disagree); no pasted results, quote only proof. Last line: "Search cost: $X (Exa $Y, Parallel $Z)" = sum of each tool result's "Search cost of this call" line since your last reply; add ", Firecrawl N credits" inside the brackets when any line has it.

Errors: "no API key" | "rejected the API key" | "out of credit" -> user updates key at connector settings page (connector URL with /settings instead of /mcp). One engine unavailable -> continue, mention in one line. Login-walled pages (LinkedIn, Quora, paywalls) unreadable -> say so; person background -> type people.
