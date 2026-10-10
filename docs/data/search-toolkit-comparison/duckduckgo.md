# Composio Search DuckDuckGo (COMPOSIO_SEARCH_DUCK_DUCK_GO)

Settings: default (`query` only, `start` 0). The tool has no region, language or result-count parameter.

## Headline numbers
- Success: 20/20, with no retries.
- Latency: mean 2.13 s, median 2.12 s, range 1.43 to 2.76 s.
- Mean score: 2.60 / 3.
- Mean response size: 6,188 characters, for about 11 results per call (10 on Q10).

## Evidence that it is DuckDuckGo
- Favicons are served from external-content.duckduckgo.com.
- `date_raw` uses .NET-style ISO timestamps (for example 2026-06-23T00:00:00.0000000), which hints that the results are Bing-backed.

## Best and worst questions
- Best (3): Q1 (GOV.UK factsheet first), Q4 (exa.ai/pricing first), Q6 (two Apple Support pages), Q8 (both GOV.UK pages), Q11 (Supabase docs first), Q12 (code.claude.com), Q16 (LinkedIn/Indeed London listings), Q20 (the typo resolved straight to the Claude Code cloud-environments doc).
- Worst: Q15 scored 1, with no Reddit threads in the top 3 even though the query said "reddit". Q2 scored 2 (only US Amazon and Walmart). Q3 scored 2 (generic Dettol transparency page, Pakistan and Australian sites). Q17 scored 2 (Figma plugins, but Figma Sites and Framer were not named).

## Strengths
- It surfaces official sources very consistently: GOV.UK, Apple, Vercel, Supabase, YNAB help and Claude docs.
- About half the results carry a date, which helps judge freshness.
- It is very tolerant of typos.
- It returns about 10 results per call at no extra latency.

## Limitations and quirks
- There is no UK region setting, so shopping queries return US retailers.
- Snippets are short (about 160 to 200 characters) and there is no answer field, so an agent must fetch pages to answer.
- It ignores intent words such as "reddit".
- Some results duplicate each other, for example two Woolite pages and two LinkedIn pages.
- It cannot fetch page content.

## Cost
The tool description and the response give no cost information. It is a Composio-hosted search.

## Best suited for
A cheap and fast first-pass link finder that is strong on official and documentation sources. Pair it with a fetch or scrape tool when the agent needs content.
