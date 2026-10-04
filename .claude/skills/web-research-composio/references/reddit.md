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
| `search_query` | Short keywords (2 to 4 after the subreddit). **Start with `subreddit:<name>`** to search one subreddit. Reddit matches words, not meaning, so use the words people would write in a post title. A 5-keyword query returned 0 posts: shorten it. Most apps have a help subreddit (for example `<app>help`) as well as a general one |
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

Comment text is in `body` with its vote `score`. Skip comments whose body is `[deleted]` or `[removed]`. The result also repeats the whole original post, which can be long. At depth 1, replies show only as `kind: "more"` stubs. The `permalink` here is a relative `/r/...` path: add `https://www.reddit.com` to link it.

## Recipes

**Software troubleshooting (one subreddit, then the best thread)**

Batch the search with the Exa search in one execute call:
```json
{"tool_slug": "REDDIT_SEARCH_ACROSS_SUBREDDITS", "arguments": {
  "search_query": "subreddit:<app>help <2 to 4 keywords>", "limit": 5, "sort": "relevance", "time_filter": "all"}}
```
Then read the most-commented relevant post:
```json
{"tool_slug": "REDDIT_RETRIEVE_POST_COMMENTS", "arguments": {
  "article": "1vpzx2k", "limit": 8, "depth": 1, "sort": "top"}}
```
(`depth: 2` if replies matter, for example "did that fix work?".)

**Unknown subreddit**
```json
{"tool_slug": "REDDIT_GET_SUBREDDITS_SEARCH", "arguments": {"q": "drawing tablet", "limit": 5}}
```
Pick the most relevant one or two by subscriber count and description, then search inside them. Two subreddit searches can be batched in one call.

**Reaction to a release**
```json
{"tool_slug": "REDDIT_SEARCH_ACROSS_SUBREDDITS", "arguments": {
  "search_query": "subreddit:<app> <version>", "limit": 5, "sort": "top", "time_filter": "month"}}
```
Confirm the version number with Exa first; don't take it from this example. Release discussion threads collect most of the reaction; read their comments with `sort: "top"`. `sort: "top"` with `time_filter: "month"` returned popular but unrelated posts in testing: try `sort: "new"` or a title-style query ("<app> <version> released"), and if no release thread appears, say Reddit had none and skip it.

## Quirks found in testing

- **Searching all of Reddit gives poor matches.** "blender boolean shading artifacts fix" with no subreddit returned a Murder Drones face rig and a Unity article. The same idea inside `subreddit:blenderhelp` returned 5 on-topic posts. Niche questions are weaker even inside a subreddit (a niche software question, a release search and an employer search returned mostly off-topic or thin results).
- **Comments come back every time,** with scores and nesting. Parallel often returned only the original post.
- **Results are large.** 5 search results came to about 10,000 tokens when posts were long, and Composio moved the result to a remote file once. In the second round of testing, searches came to 5,000 to 10,000 characters and comment reads to 5,000 to 8,000, all inline. Keep `limit` at 5; if it moves, use `COMPOSIO_REMOTE_BASH_TOOL` with `jq` to pull `title`, `permalink`, `num_comments` and a short slice of `selftext`.
- Image and video posts have little `selftext`; the answer is in the comments.
- Reddit allows about 1 to 2 requests a second. On HTTP 429, wait and retry once.
- Uses the user's own Reddit sign-in. Counts as a normal Composio tool call (not a "premium" one).
