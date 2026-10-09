# Test results: Reddit toolkit through Composio (9 October 2026)

Composio's Reddit toolkit calls Reddit's own API, signed in with your Reddit account. The tests repeat the ScrapeCreators Reddit tests in [`test-results-scrapecreators.md`](test-results-scrapecreators.md), so the two compare directly. Tools used: `REDDIT_SEARCH_ACROSS_SUBREDDITS` and `REDDIT_RETRIEVE_POST_COMMENTS`.

## 1. Availability

The first 8 calls all failed with Reddit's "too many requests" error (HTTP 429), starting with the very first call, so the limit had been used up before the test began, apparently by other use of the same connection. Reddit search, subreddit listings and thread reads were all refused. It cleared after a 10-minute wait; the next 5 calls worked, each about 1 second.

Composio reported the refused searches as **successful with no results**: the 429 error appears only inside the response. A search tool built on this toolkit must check for it, or a refusal will look like "Reddit had nothing".

## 2. Results

| Test | Reddit toolkit | ScrapeCreators |
|---|---|---|
| Search "blender boolean shading artifacts", relevance | 3 of 7 clearly on topic (Boolean shading threads from 2023 to 2025), plus a few loosely related (a game-asset pipeline, a Unity post). Mixed ages | 3 of 7 loosely on topic, 6 of 7 from the last few months |
| Same, ordered by comment count, past year | Nvidia drivers, ChatGPT, makeup, GTA VI | **Identical list**, so ScrapeCreators appears to use Reddit's own search |
| `subreddit:blenderhelp boolean shading`, relevance | **7 of 7 on topic**, from 2023 to September 2026 | 6 of 7 on topic |
| Same, ordered by comment count | 7 from r/blenderhelp with 17 to 29 comments; 2 about Booleans, the rest general modelling help | 7 from r/blenderhelp, mostly about Booleans |
| Read a thread (8 comments) | All 8, nested, with author, votes and exact time. 0.8 seconds | All 8, same detail. 4 seconds |
| Dates, scores and comment counts in search results | Yes, on every result | Yes |
| Speed | About 1 second a call | 5 to 10 seconds a search |
| Size | Search results include each post's full text: 7 results came to 54,000 characters, one post alone 29,700 | Trimmed by default: 9,000 characters for 7 results |
| Cost | Free (your Reddit account) | About 1 credit a call |

## 3. Verdict

On a good day the Reddit toolkit is the best Reddit source tested: free, fast, exact, and slightly more on topic than ScrapeCreators when limited to a subreddit. Its weakness is reliability: the rate limit was already used up when the test started and blocked everything for about 10 minutes, and the refusal is easy to miss.

Recommended set-up:

1. **Reddit toolkit first**, always limited to a subreddit, trimming each post's text before passing results to Claude.
2. **Check every response for a 429** and, when it appears, **fall back to ScrapeCreators**, which gave the same results more slowly.
3. In both, sort by relevance first and use comment count and date to rank within the results, since sorting the whole of Reddit by comments returns unrelated popular posts.

The earlier Composio tests (4 October, [`test-results-composio.md`](https://github.com/ireves/search/blob/claude/optimistic-noether-5k0yax/docs/test-results-composio.md) on an older branch) found the same: comments came back every time, short searches inside a subreddit worked best, and searches with 5 or more keywords often found nothing.
