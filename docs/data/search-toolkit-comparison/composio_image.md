# composio_image (COMPOSIO_SEARCH_IMAGE)

Settings: num 10. The tool has no gl or hl parameter, and the backend used gl=us, hl=en (SerpAPI google_images). Query text used verbatim. Scored on the relevance of the images and of their source pages (`link`), since that is all the tool returns.

## Headline numbers
- Success rate: 20/20 OK, all with 10 image results.
- Latency: mean 1.79 s, median 1.33 s (max 4.3 s).
- Mean score: 2.0 / 3 (total 40/60). Easily the best of the Composio verticals.
- Mean response size: ~24,000 chars (a lot of it is SerpAPI metadata, related_searches and suggested_searches with thumbnails).

## Best and worst
- Score 3: Q5 (vercel.com/docs/environment-variables plus the Vercel env-vars UI blog, whose image is the settings screenshot), Q12 (code.claude.com/docs/en/cloud-environments, the exact page), Q19 (a Blender Artists "Convert mesh to quads" thread plus a tris-to-quads tutorial).
- Good where images genuinely help: Q2 (0.2m right-angle cables at Adafruit, Amazon.com and AliExpress, but mostly USB-A to C and US shops), Q3 (Dettol Protect 24h product pages whose pack shots could show the label), Q7 (official woolite.us Darks Defense pages), Q13 (Apple WWDC25 Liquid Glass videos and explainers, but not the HIG page), Q17 (a run of Figma Community "Figma to website" plugins, though not Figma Sites or Framer).
- Also decent: Q14 (2026 Exa/Tavily comparisons and a benchmark article), Q16 (Indeed UK and Just London Jobs listings), Q18 (2026 Notion-alternative listicles), Q20 (typo understood; Claude Code GitHub issues on remote environments).
- Worst: Q15 (0, junk: shirt trends, a Facebook page). Q10 (1, YNAB import pages but nothing on Starling).

## Strengths
- Works as a surprisingly good "page finder": Google Images surfaces official docs, guides and listings whose pages carry a relevant image.
- Fast, never empty, and tolerates typos.
- Each result gives the image URL, source page link, source name and dimensions. Good for visual product checks (cable angle, Dettol label).

## Limitations and quirks
- No snippets or text, only page titles, so every answer needs a follow-up fetch. Scores assume the user clicks through.
- Region is fixed to US (no gl parameter), which hurts UK queries: US shops, the woolite.us product name, no GOV.UK result for Q8.
- Duplicates are common (the same page appears 2 to 3 times with different images: Q5, Q12, Q16).
- Social media (Instagram, LinkedIn, YouTube) is heavily represented, for example as the Q1 sources.

## Cost
No cost fields in responses. It runs on the Composio Search toolkit (no auth, not the shared wallet).

## Best suited for
Visual product identification, and as a cheap way to discover candidate pages (docs, tutorials, listings) to fetch afterwards. Not for direct answers.
