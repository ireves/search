# X (Twitter) through Composio: optional

The Composio `twitter` toolkit gives clean, compact search results for X, but it needs setting up and costs money per post. Use it only if the user has connected it. Otherwise use Parallel limited to `x.com` (see `parallel.md`).

**Not yet tested** (not connected when this was written). Details come from Composio's tool descriptions and documentation.

## What it needs

- Since February 2026 Composio no longer provides its own X app. The user needs an X developer account, their own X app, and a Composio auth config with that app's Client ID, Client Secret and Bearer token ([Composio's setup guide](https://composio.dev/auth/twitter)).
- Search uses the app's Bearer token, so X charges the user's X developer account: about $0.005 per post returned and $0.01 per user profile (X pay-per-use pricing, 2026).

## `TWITTER_RECENT_SEARCH`

| Option | Notes |
|---|---|
| `query` | X search syntax: keywords, `"exact phrase"`, `from:username`, `-is:retweet`, `lang:en`. `site:`, `since:` and `until:` are removed automatically |
| `max_results` | 10 (the minimum) to 20. Each post returned is charged |
| `start_time` / `end_time` | `YYYY-MM-DDTHH:mm:ssZ`. **Only the last 7 days can be searched.** Composio's description mentions a separate full-archive search for older posts; it wasn't found when this was written |
| `sort_order` | `relevancy` or `recency` |
| `tweet_fields` | A list: `["created_at", "public_metrics", "author_id"]` (likes, reposts and replies). Don't ask for `id` or `text`; they come by default |
| `expansions` | `["author_id"]` to show who posted (username and name come by default). Each profile is charged |

Leave out media, place and poll fields to keep results small.

**Recipe: reaction to a release this week**
```json
{"tool_slug": "TWITTER_RECENT_SEARCH", "arguments": {
  "query": "\"blender 5.2\" -is:retweet lang:en",
  "max_results": 15, "sort_order": "relevancy",
  "tweet_fields": ["created_at", "public_metrics", "author_id"],
  "expansions": ["author_id"]}}
```

Link posts as `https://x.com/<username>/status/<id>`.

## When to use Parallel instead

- The posts are older than 7 days.
- The toolkit isn't connected.
- The user hasn't agreed to X's per-post charges.
