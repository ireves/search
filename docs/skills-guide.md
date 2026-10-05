# Your search skills: a guide

This explains what the two search skills do and how to use them. The skill files themselves are written in a compressed style for Claude to read quickly, so you don't need to open them.

Both skills use your Search connector, which combines two search engines:

- **Exa** finds pages by meaning. It's best for articles, research papers, people, companies, job listings and official pages.
- **Parallel** reaches places Exa can't, such as Reddit, X, Glassdoor and Trustpilot. In general searches it adds official documentation and newer pages that Exa misses. It is also the backup page reader, and it runs the quick research agents.

The connector decides which engine to use, removes duplicates and trims results, so Claude only sees what's relevant.

## web-search: everyday searching

**When it's used:** automatically, whenever Claude needs anything from the web. You don't need to ask for it. It replaces Claude's built-in web search.

**What it does:**

1. Picks the kind of search that suits the question: a normal web search, news, Reddit and forum discussions, reviews, and so on.
2. Runs one search, described the way you'd describe the ideal page.
3. Answers straight from the results if they're clear.
4. Otherwise reads the one or two best pages, looking only for the part that answers your question. Pages are always read as they are today, not from a stored copy.
5. For questions with several parts (a comparison, a list, "the top 5"), it asks a research agent for a cited answer instead of running many searches, then double-checks the key numbers and dates.
6. Stops there. Most questions take one or two steps, never more than about four.

**How it keeps answers accurate:**

- For anything "latest" or "current" (a version, price or who holds a job), it reads the official website as it is today. News articles and stored copies of pages can be out of date: in testing, a stored copy of python.org still showed the previous release five days after a new one came out.
- If an important number or date comes from only one source, it checks it against other websites first.
- It says "as of" a date for things that change, and tells you when something couldn't be confirmed.

**Kinds of search it can do:** news, Reddit and forum discussions, posts on X, reviews, research papers, people's professional backgrounds, company facts, technical documentation, job listings and financial reports.

## deep-search: when you need to be sure

**When it's used:** when you type `/deep-search` followed by your question, or ask Claude to fact-check, verify or research something properly.

**First, it asks how thorough to be** (unless you've already said):

- **Auto:** Claude picks the right amount of work for the question.
  - A single fact: one search, checked against the official source.
  - A few facts on one topic: a quick research agent answers first (about one cent), Claude fills any gaps itself, then the key facts are cross-checked.
  - A big comparison or list: a more thorough research agent (about five cents) does the heavy lifting, then Claude fills gaps (including Reddit or X opinion) and checks the facts.
  - The answer appears in the chat, usually under 250 words.
- **Deep research:** a short, cited report.
  1. A Claude Doc opens straight away and fills in as the research goes on.
  2. Two independent research agents (one from Exa, one from Parallel) investigate the question in the background.
  3. At the same time, Claude runs its own searches from different angles: official sources, recent news, studies, people's experiences and critics.
  4. Claude compares all three, settles any disagreements by reading the original source, and checks every key fact.
  5. The report is 2 pages or less, with these sections:
     - **Bottom line:** the direct answer.
     - **Key findings:** one fact per point, each with its source.
     - **Where sources disagree** (only if they do).
     - **Not confirmed** (only if something couldn't be checked).
     - **Sources:** a numbered list.
  6. If you'd rather have the report in the chat or somewhere else, just say so.

**Confidence labels you'll see:**

- **Confirmed:** from the official source, or two or more independent sources agree.
- **Likely:** one reliable source says so.
- **Unconfirmed:** only hinted at, or sources conflict. Claude says what conflicts.

Claude never fills a gap with a guess. If something couldn't be found, the answer says so.

## Costs

Each search costs about one US cent. Reading a page costs a tenth of a cent. A quick research answer costs about one cent and a standard one about five cents. A Deep research report costs about 20 cents for the two research agents, plus a few cents of searches. Auto usually costs a few cents.

## If something goes wrong

- **"has no API key" or "rejected the API key":** open your connector's settings page at [search-connector.vercel.app/settings](https://search-connector.vercel.app/settings) and add or replace the key.
- **One engine is unavailable:** Claude carries on with the other and tells you.
- **A page needs a login** (such as LinkedIn or Quora): Claude can't read it and will say so. For someone's professional background, it searches professional profiles instead.

## Where things are

- Your connector: [search-connector.vercel.app](https://search-connector.vercel.app)
- Settings page for API keys: [search-connector.vercel.app/settings](https://search-connector.vercel.app/settings)
- Address to give Claude as a connector: `https://search-connector.vercel.app/mcp`
- Full setup steps: [connector-setup.md](connector-setup.md)
