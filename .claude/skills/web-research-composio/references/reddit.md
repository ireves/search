# Reddit through Composio: settings, recipes and quirks

The Composio `reddit` toolkit uses Reddit's own search and reads threads directly. It replaces Parallel for Reddit. Tested on 4 October 2026.

## Tools

| Tool | Use for |
|---|---|
| `REDDIT_SEARCH_ACROSS_SUBREDDITS` | Finding posts. Best inside one subreddit |
| `REDDIT_GET_SUBREDDITS_SEARCH` | Finding the right subreddit when you don't know it (`q`, `limit`) |
| `REDDIT_RETRIEVE_POST_COMMENTS` | Reading a thread's comments |
| `REDDIT_EXPAND_MORE_COMMENTS` | Rarely needed. Expands collapsed replies; one call at a time only |

## `REDDIT_SEARCH_ACROSS_SUBREDDITS`

| Option | Notes |
|---|---|
| `search_query` | Short keywords. **Start with `subreddit:<name>`** to search one subreddit. Reddit matches words, not meaning, so use the words people would write in a post title |
| `limit` | **5.** Each result includes the whole post text, which can't be trimmed |
| `sort` | `relevance` (default), `top`, `new`, `comments` |
| `time_filter` | `day`, `week`, `month`, `year`, `all`. The only date control |

Each result gives `title`, `selftext` (the post), `score` (upvotes), `num_comments`, `created_datetime`, `permalink` and `id`. Prefer posts with more comments: that's where answers are.

## `REDDIT_RETRIEVE_POST_COMMENTS`

| Option | Notes |
|---|---|
| `article` | The post `id` from search, or the part after `/comments/` in a thread link (for example `1vpzx2k`) |
| `sort` | `top` for the best answers, `new` for the latest reactions |
| `limit` | 8 to 10 |
| `depth` | 1 (top-level comments only). Use 2 when replies matter, for example "did that fix work?" |

Comment text is in `body` with its vote `score`. Skip comments whose body is `[deleted]` or `[removed]`. The result also repeats the whole original post, which can be long.

## Recipes

**Software troubleshooting (one subreddit, then the best thread)**

Batch the search with the Exa search in one execute call:
```json
{"tool_slug": "REDDIT_SEARCH_ACROSS_SUBREDDITS", "arguments": {
  "search_query": "subreddit:blenderhelp boolean modifier shading", "limit": 5, "sort": "relevance", "time_filter": "all"}}
```
Then read the most-commented relevant post:
```json
{"tool_slug": "REDDIT_RETRIEVE_POST_COMMENTS", "arguments": {
  "article": "1vpzx2k", "limit": 8, "depth": 2, "sort": "top"}}
```

**Unknown subreddit**
```json
{"tool_slug": "REDDIT_GET_SUBREDDITS_SEARCH", "arguments": {"q": "drawing tablet", "limit": 5}}
```
Pick the most relevant one or two by subscriber count and description, then search inside them. Two subreddit searches can be batched in one call.

**Reaction to a release**
```json
{"tool_slug": "REDDIT_SEARCH_ACROSS_SUBREDDITS", "arguments": {
  "search_query": "subreddit:blender 5.2", "limit": 5, "sort": "top", "time_filter": "month"}}
```
Confirm the version number with Exa first; don't take it from this example. Release discussion threads collect most of the reaction; read their comments with `sort: "top"`.

## Quirks found in testing

- **Searching all of Reddit gives poor matches.** "blender boolean shading artifacts fix" with no subreddit returned a Murder Drones face rig and a Unity article. The same idea inside `subreddit:blenderhelp` returned 5 on-topic posts.
- **Comments come back every time,** with scores and nesting. Parallel often returned only the original post.
- **Results are large.** 5 search results came to about 10,000 tokens when posts were long, and Composio moved the result to a remote file. Keep `limit` at 5; if it moves anyway, use `COMPOSIO_REMOTE_BASH_TOOL` with `jq` to pull `title`, `permalink`, `num_comments` and a short slice of `selftext`.
- Image and video posts have little `selftext`; the answer is in the comments.
- Reddit allows about 1 to 2 requests a second. On HTTP 429, wait and retry once.
- Uses the user's own Reddit sign-in. Counts as a normal Composio tool call (not a "premium" one).
