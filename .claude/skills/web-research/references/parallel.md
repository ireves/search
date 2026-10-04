# Parallel tools: settings, recipes and quirks

Parallel runs its own web index with keyword-style search. It reaches Reddit and X, which Exa can't, and its reader picks out the passages that match a stated goal from anywhere in a page.

## When to use Parallel

- Reddit and X (Twitter): searching and reading.
- Software questions, alongside Exa: it adds Reddit threads, official manuals, bug trackers and the newest forum posts.
- Backup reader when Exa refuses a page or returns thin or broken extracts.
- A second source for a key fact.

Avoid it for design research, case studies, "find things like this" and job listings: it tends to return marketing pages, listicles and job board search pages there.

## `web_search`

| Option | Notes |
|---|---|
| `objective` | Plain description of what you're looking for, including preferred sources. Keep it to one specific need |
| `search_queries` | 2 or 3 short keyword queries (3 to 6 words each). Different angles, not synonyms. `site:` works, for example `site:x.com` |
| `session_id` | Generate one random value (UUID or 32+ hex characters) at the start of the conversation and reuse it on every Parallel call |
| `model_name` | The active model's identifier, if you know it. Analytics only |

For Reddit, put "reddit" or a subreddit (for example `r/blenderhelp`) in the queries.

Cost: about $0.001 per call.

## `web_fetch`

| Option | Notes |
|---|---|
| `urls` | Up to 20 at once |
| `objective` | **Always set.** What to pull out of the pages (under 200 characters). This is what keeps the result focused |
| `search_queries` | Optional; pass the queries that found these URLs |
| `full_content` | Leave off. When on, the page text is returned twice and can run to tens of thousands of characters |
| `allow_live_fetch` | Leave on for fresh content. Set `false` for faster cached-only reads |

A focused read can take around 20 seconds on a page Parallel hasn't seen recently.

## Recipes

**Reddit troubleshooting**
```json
{"objective": "Reddit threads where Blender users explain how to fix shading artifacts after the Boolean modifier, with working fixes",
 "search_queries": ["blender boolean shading artifacts reddit", "r/blenderhelp boolean weighted normal fix"]}
```

**Read a Reddit thread for the answers**
```json
{"urls": ["https://www.reddit.com/r/blenderhelp/comments/uxq2kk/weird_edges_after_boolean"],
 "objective": "all fixes suggested by commenters, and whether the poster said it worked"}
```

**X posts**
```json
{"objective": "What people on X are saying about the Blender 5.2 LTS release. Prefer x.com posts.",
 "search_queries": ["Blender 5.2 LTS x.com", "site:x.com Blender 5.2"]}
```

## Quirks found in testing

- Ignores dates written in the objective or queries ("September 2026" returned June and July posts). Check dates in the results yourself.
- Reddit results in search usually have no date; reading the thread returns it.
- Reddit extracts in search are short (about 200 to 300 characters). Read the thread when the answer matters.
- Results can be long, especially job board or search pages full of tracking links. Prefer specific pages.
- The same paper can appear several times from different mirrors. Count it as one source.
- Can't read LinkedIn profiles (login wall). Reads X profiles and posts.
- The anonymous connector shares a free allowance and hits rate limits quickly. Connecting through `https://search.parallel.ai/mcp-oauth` with a Parallel account fixes this.
