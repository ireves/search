# Akta (via Composio instant account), re-run 10 Oct 2026

The wallet was topped up and this run replaces the earlier 402-blocked attempt. No 402 errors occurred.

## Headline numbers (main run: AKTA_SEARCH_NEWS, query = question text, limit 10, defaults otherwise)
- **Success rate:** 20/20 calls succeeded with no retries. Each call returned 10 articles.
- **Latency:** mean 7.35 s, median 7.32 s, range 3.2 to 11.4 s. It is slow for a news index.
- **Mean score:** 0.55 out of 3. No question scored above 1. Eleven questions scored 1 and nine scored 0.
- **Mean response size:** about 19,200 characters per call for 10 articles with AI summaries and entity tags.

## Best and worst questions
- **Least bad (score 1):**
  - Q6: iCloud+ news. 9to5Mac reported that custom-domain addresses rose from 3 to 10 per domain, but there were no setup steps.
  - Q8: an Irish Times piece on the UK tightening Class 2 voluntary contributions for Irish residents.
  - Q13: consumer pieces on customising Liquid Glass in iOS 27.
  - Q16: The Economist hiring a junior motion-graphics designer in London.
  - Q19: CG Channel on the Blender "Smart Remesh" retopology add-on.
- **Worst (score 0):**
  - Q7 ("Woolite Darks"): it matched Marvel's Wolverine game articles.
  - Q3 (Dettol): random spray launches.
  - Q1 (ISA): fintech press releases.
  - Q20: it returned four "Access Denied" MarketScreener junk pages.

## Strengths
- Fresh news (July to October 2026) with dates, publisher names, AI summaries, sentiment scores and company and entity tags.
- Rich filters (company, dates, country, taxonomy codes, sentiment) that suit company or industry monitoring.
- The extras were the useful part:
  - **Q14 enrichment** (structured; sections firmographic, product_offering and business_model; about 1 to 2 s):
    - **Parallel:** founded 2023, 101 to 250 staff. Its search costs $5 per 1,000 requests. It claims state-of-the-art results against Exa and Tavily, which is a vendor claim.
    - **Tavily:** marked as Acquired. Nebius agreed in Feb 2026 to buy it for $275M, rising to as much as $400M. It gives 1,000 free credits a month and pay-as-you-go costs $0.008 per credit.
    - **exa.ai:** "Company not found" for both https://exa.ai and https://www.exa.ai.
  - **Q18 product reviews** (Notion):
    - G2 rates Notion 4.6 from 9,317 reviews. The top con is "Learning Curve" (1,608 mentions).
    - The 10 reviews returned were all from Dec 2024.
    - Nothing named simpler alternatives (score 1).

## Limitations and quirks
- **Not a web search engine.** It matches the query semantically against a news corpus, so how-to, product, pricing and Reddit questions return off-topic articles. The keyword "Woolite" matched "Wolverine", and the corpus contains junk "Access Denied" pages.
- **Limited history:** without an Enterprise plan, news goes back only about six months.
- **Limits on the managed (Composio) account:**
  - `AKTA_LIST_COMPANY_JOB_POSTS` rejects limit 25 ("page or offset exceeds the supported bound"). Limit 10 works.
  - `AKTA_GET_COMPANY_ENRICHMENT` rejects `concise` output. It needs explicit non-premium sections with structured output.
  - `AKTA_GENERATE_COMPANY_LIST` accepts structured filters only. I did not run it because it returns companies, not jobs.
- **Q16 job posts:**
  - The tool needs a named company and cannot search roles across the market.
  - Monzo (London) returned only one job, a senior service analyst post on LinkedIn, so coverage looks thin.

## Cost
- Each tool's description says every call uses Akta credits, and enrichment sections cost more.
- SEARCH_NEWS is described as reporting the credits it uses, but the responses had no credit field.

## Best suited for
Company and industry news monitoring, and company profiles (firmographics, pricing, go-to-market) for known startups. It does not suit general Q&A or how-to search.
