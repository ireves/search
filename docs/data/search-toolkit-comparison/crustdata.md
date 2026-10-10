# Crustdata (via Composio instant account), re-run 10 Oct 2026

The wallet was topped up and this run replaces the earlier 402-blocked attempt. No 402 errors occurred.

## Setup
- Only `CRUSTDATA_SCREENER_COMPANY_INFORMATION` works.
- **Input:** `company_domain` plus `enrich_realtime="False"`. It takes a domain, not a question.
- **Domains queried (14 unique, one call each, reused across questions):** exa.ai, vercel.com, apple.com, reckitt.com (Dettol), woolite.com, ynab.com, starlingbank.com, supabase.com, anthropic.com, figma.com, notion.so, parallel.ai, tavily.com, blender.org.
- **Not applicable (score 0):** Q1, Q2, Q8 and Q16, which name no company.

## Headline numbers
- **Calls:** 14 out of 14 returned without an error.
  - 12 returned the right company.
  - woolite.com was not in the database: it returned "will be enriched in the next 24 hours".
  - notion.so returned two wrong companies.
- **Latency per call:** mean 4.4 s, median 1.8 s. The spread was bimodal: about 0.5 to 1.9 s for cached companies and 5 to 11.5 s for others.
- **Mean response size:** about 2,200 characters per call. The responses are small.
- **Mean score:** 0.05 out of 3. Only Q14 scored 1. Every other question scored 0.

## What it returns
LinkedIn- and Crunchbase-style firmographics:
- Name, domains and HQ.
- Headcount band and estimated revenue band.
- Year founded, company type, acquisition status and IPO date.
- LinkedIn description, plus LinkedIn and Crunchbase URLs.

## Useful facts found
- **Exa:** San Francisco, 51 to 200 staff, founded 2021. No pricing.
- **Parallel Web Systems:** San Francisco, 51 to 200 staff, founded 2023.
- **Tavily:** New York, 51 to 200 staff, founded 2024. Acquisition status is "acquired".
- **Starling:** London, 1,001 to 5,000 staff, revenue band $500M to $1B.
- **YNAB:** Lehi, Utah, 201 to 500 staff.
- **Supabase:** 201 to 500 staff. **Vercel:** 501 to 1,000 staff. **Blender Foundation:** Amsterdam, 11 to 50 staff.

## Data quality problems (flagged)
- **Anthropic:** 501 to 1,000 staff, revenue band $10M to $20M and a blank HQ. This is badly out of date.
- **Figma:** the record says it listed on 31 Jul 2025, yet also calls it "Privately Held" and "acquired". Those fields contradict each other, and the description field holds junk ("Trying all the skills").
- **notion.so:** it matched Hustá, a Czech agency on notion.site, and PetFriends from Korea. It did not return Notion.
- The revenue bands for Exa and Parallel ($1M to $2.5M) look low.

## Strengths
- Fast, cheap-looking lookups of basic company facts when you already know the domain.
- Gives LinkedIn and Crunchbase links.

## Limitations
- It cannot take a question, so it does not search.
- It returns no product, pricing, how-to, review, job or discussion content.
- Some records are stale or wrong, and unknown domains trigger slow, asynchronous enrichment that returns nothing now.

## Cost
- Neither the responses nor the tool description give any cost or credit information.
- I used `enrich_realtime="False"` throughout.

## Best suited for
Light firmographic enrichment, such as headcount, HQ and founding year, in a lead or market list. It is not useful for any of the 20 search questions.
