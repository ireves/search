---
name: web-search
description: Default web search and page reading through the Search connector (Exa + Parallel), replacing built-in web search and web fetch. Use whenever you need anything from the web - current facts, news, prices, versions, docs, software help, reviews, Reddit or X opinion, papers, people, companies, jobs - or need to read a link, PDF or YouTube video. Use it even when the user doesn't say "search".
---

# Web search

Use the Search connector's tools instead of built-in web search and web fetch. Never fall back to the built-in ones. Tool names may carry a prefix (such as `Search:search`); match the part after it.

Keep it lean: each call's results stay in the conversation, so make the fewest calls that give a reliable answer.

## The usual pattern

1. **One `search`.** Write the query as a description of the page you want, with names, versions, places and years ("official release notes for Blender 5.2", not "blender new"). Add `goal` when you need specific figures ("pull the price in GBP and the date").
2. **Answer from the excerpts** if they settle it.
3. **Otherwise `fetch`** the one or two best links, always with a `question`.
4. Stop. Most questions need one or two calls; never more than about four. For bigger research jobs, suggest `/deep-search`.

## Pick the type

Leave `type` out for general searches. Otherwise:

| Need | `type` |
|---|---|
| Latest reporting | `news` (add `after`, e.g. `"7d"`) |
| Experiences, advice, troubleshooting, "is it worth it" | `discussions` (Reddit and forums) |
| Reactions and posts on X | `x` |
| Ratings of a company, product or employer | `reviews` |
| Studies | `papers` |
| A person's professional background | `people` |
| Company facts | `companies` |
| Documentation, APIs, error messages | `code` |
| Open job listings | `jobs` |
| Filings, earnings | `financial` |

Other options, only when needed: `sites` to stay on one site, `after`/`before` for a date window, `country` for local results, `fresh: true` for live prices or stock, `depth: "fast"` for trivial lookups.

## Getting facts right

- **"Latest" or "current" facts** (version, price, status, who holds a role): confirm on the official page, not news or blogs. Use `sites` with the official domain, or `fetch` the official page.
- **Numbers and dates the answer depends on:** if only one secondary source states them, run one `verify` call with those claims (several claims fit in one call).
- **Check dates** in results; say "as of [date]" for anything that changes.
- **Copies of one story count once.** `search` already folds obvious mirrors together.
- **Never fill a gap from memory.** Say what you couldn't confirm.

## Answering

- Lead with the answer. Link sources inline with descriptive text; link the original page.
- Mention uncertainty briefly where it matters ("one source", "unconfirmed", "sources disagree").
- Don't paste results back; quote only what proves a point.

## Problems

- "has no API key", "rejected the API key" or "out of credit": tell the user to update the key on the connector's settings page (the connector address with `/settings` in place of `/mcp`).
- One engine unavailable: the other still answers; mention it in one line.
- A page that needs a login (LinkedIn, Quora, paywalls) can't be read: say so. For a person's background try `type: "people"`.
