# Context.dev (via Composio instant account)

**Verdict: not a search engine.** Its only search-like tool, `CONTEXT_DEV_SEARCH_BRANDS`, looks up company brands by name or domain. It returns at most 10 entries (name, domain, logo URL), with no pages, snippets, dates or answers. Its page reader (`SCRAPE_WEBPAGE_MARKDOWN`) is good when you already know the URL.

## Main run: CONTEXT_DEV_SEARCH_BRANDS, all 20 questions
- Success rate: 20/20 (no errors)
- Latency: mean 1.18 s, median 1.06 s (range 0.60 to 3.10 s)
- Mean score: **0.30 / 3** (six questions scored 1, fourteen scored 0)
- Mean response size: 2,345 characters (always 10 brands)
- Best: Q4, Q11, Q12, Q13, Q19. Each surfaced the right official domain (exa.ai, supabase.com, claude.ai, apple.com, blender.org with blenderartists.org) but nothing that answers the question. Q18 surfaced Standard Notes by accident.
- Worst: the other 14 questions scored 0. Results matched single common words in the question, for example "line" from "command line" (LINE, Linear), "how" (Gardening Know How), "2026" (Milano Cortina 2026), "step" (Stepstone) and "UK" (an adult site appeared in Q16's top 3).
- Q20 typo test: failed. The tool says it has no typo tolerance, so "clade" matched Clade companies and "access denied" error pages.

## Extras: reading pages
| Page | Latency | Size | Result |
|---|---|---|---|
| gov.uk/check-national-insurance-record (Q8) | 4.27 s | 3,351 chars (2,861 Markdown) | Clean main content with links, current (refers to 6 April 2026). It covers checking the record; paying is only linked. |
| support.apple.com/en-gb/102540 (Q6) | 6.05 s | 3,649 chars (3,190 Markdown) | No redirect. Clean, with the published date (30 Sep 2026). It covers limits and requirements, but the DNS steps are on a linked page. |
| code.claude.com Claude Code on the web (Q12) | 0.26 s | error | 402: wallet exhausted |
| exa.ai/pricing (Q4), plus a retry | 0.30 s / 0.39 s | error | 402: wallet exhausted |
| supabase billing docs (Q11) | n/a | error | 402: wallet exhausted |
| EXTRACT_STRUCTURED_WEB_DATA on exa.ai/pricing | not run | n/a | Wallet already exhausted |

The two scrapes that worked returned clean output with no navigation or cookie clutter. Both were partial answers, because the key steps were on a linked page.

## Quirks and limitations
- The tool is described as a prefix search, but it actually matches individual words anywhere in the query.
- Results have no ranking explanation or relevance score. `tranco_rank` and `id` were always null.
- The page reader is slower (4 to 6 s) but reliable, and it supports UK proxies (`country: gb`) and cache control.

## Cost
Scraping costs about 1 Context.dev credit per page. Extracting costs 10 credits or more (it scales with the number of pages). No cost is stated for brand search, and responses carry no credit fields. Partway through the run, the shared Composio instant wallet ran out (error 402 `Metering_WalletBalanceExhausted`), and every instant toolkit was blocked from then on.

## Best suited for
- Looking up a company's domain or logo from its name.
- Turning a known URL into clean Markdown for an agent to read.

It is not a way to discover pages for open questions. It needs a separate search tool to supply the URLs.
