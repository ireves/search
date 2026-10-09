# Test results: ScrapeCreators through Composio (9 October 2026)

ScrapeCreators reads social media sites directly: Reddit, X, YouTube, Instagram, TikTok and others. It was tested through Composio's ScrapeCreators toolkit (Composio's shared "instant" account), with 11 calls. Each costs about 1 ScrapeCreators credit; cached results are free.

## 1. Reddit

| Test | Result |
|---|---|
| Search "blender boolean shading artifacts", relevance order | 7 results, all from r/blender or r/blenderhelp, but 6 of 7 from the last few months and only 3 about shading artifacts; none about Boolean cuts. Relevance order seems to favour new posts |
| Same, ordered by comment count, past year | Useless: Nvidia drivers, ChatGPT, makeup, GTA VI. The words matched anywhere on Reddit |
| Ordered by top votes, past year | Same problem: 2 of 7 about Blender shading at all |
| `subreddit:blenderhelp boolean shading`, relevance | 6 of 7 on topic, from 2020 to September 2026, including the thread used in earlier tests |
| Same, ordered by comment count | 7 of 7 from r/blenderhelp and about Booleans, from 27 to 69 comments, though only some about shading |
| Read one post | Title, author, exact date, score (10) and comment count (8) |
| Read a thread's comments | All 8 comments, nested as on Reddit, each with author, votes and exact time. TinyFish's reader showed 7 and no votes |

Every search result carries the exact date, score and comment count, which no other tool tested gives. Searches took 5 to 10 seconds.

**Lesson:** limit Reddit searches to a subreddit (`subreddit:name` in the query). Without it, the comment-count and top orders return popular posts from anywhere that happen to share a word.

## 2. Other sites

| Test | Result |
|---|---|
| YouTube transcript ("What's New in Blender 5.2 LTS") | Complete: 1,026 timed lines to 36:54, about 44,000 characters. Same quality as Exa's transcript, with timestamps added. 8.6 seconds |
| X profile (@Blender) | Followers (383,283), bio and join date (June 2016) |
| X posts by @Blender | 100 posts with exact dates, likes, replies and views. But they are the account's most popular posts, from 2018 to now; only 1 was from September 2026 onwards. About 274,000 characters for one call, so too large to pass to Claude without trimming |
| Instagram profile (blender.official) | Followers (552,304, matching TinyFish's reading), bio and links. No posts |

There is no X search by keyword in this toolkit, only an account's posts or a single post by link.

## 3. Verdict

ScrapeCreators is the only tool tested that gives Reddit comment counts and dates in search results, and it reads threads exactly. That makes it the right tool for "rank Reddit threads by relevance, comments and recency", as long as the search is limited to a subreddit.

Worth adding for:

1. **Reddit search inside a subreddit**, ordered by relevance or comment count, with a time window. Then read the best threads with its comment reader.
2. **YouTube transcripts with timestamps**, as a backup to Exa.

Not worth it for X (no keyword search, and popular-not-recent posts) or for general web search (it has none).

Not tested: TikTok, Instagram posts, Facebook, the cross-platform creator lookup (10 credits a call), and what the credits cost on a ScrapeCreators account of your own.
