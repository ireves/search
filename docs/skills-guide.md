# Your search skills: a guide

This explains what the two search skills do and how to use them. The skill files themselves are written in a compressed style for Claude to read quickly, so you don't need to open them.

Both skills use your Search connector, which combines two search engines:

- **Exa** finds pages by meaning. It's best for articles, research papers, people, companies, job listings and official pages.
- **Parallel** reaches places Exa can't, such as Reddit, X, Glassdoor and Trustpilot, and is used as a backup reader.

The connector decides which engine to use, removes duplicates and trims results, so Claude only sees what's relevant.

## web-search: everyday searching

**When it's used:** only when you type `/web-search` followed by your question. Claude won't use it by itself.

**What it does:**

1. Runs one search, described the way you'd describe the ideal page.
2. Answers straight from the results if they're clear.
3. Otherwise reads the one or two best pages, looking only for the part that answers your question.
4. Stops there. Most questions take one or two steps, never more than about four.

**How it keeps answers accurate:**

- For anything "latest" or "current" (a version, price or who holds a job), it checks the official website rather than news articles.
- If an important number or date comes from only one source, it checks it against other websites first.
- Before answering, it makes sure every part of your question is covered. If one look at the official page would fill a gap, it does that.
- It says "as of" a date for things that change, and tells you when something couldn't be confirmed.

**Kinds of search it can do:** news, Reddit and forum discussions, posts on X, reviews, research papers, people's professional backgrounds, company facts, technical documentation, job listings and financial reports.

## deep-search: when you need to be sure

**When it's used:** only when you type `/deep-search` followed by your question. Claude won't use it by itself.

**First, it asks how thorough to be** (unless you've already said):

- **Auto:** Claude picks the right amount of work for the question.
  - A single fact: one search, checked against the official source.
  - A few facts on one topic: a handful of searches from different angles, then the key facts are cross-checked.
  - A comparison or long list: a research agent does the heavy lifting, Claude reads each product's official pages (such as pricing and documentation), then fills gaps and checks the facts.
  - The answer appears in the chat, usually under 250 words. Comparisons can be longer, so nothing you asked for is left out.
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

**Before answering, Claude checks for gaps.** It lists every fact your question needs (for a comparison, every cell of the table). For anything missing, only "likely", or taken from a research agent without checking, it goes to the official page to find it. It does this up to two times. Only then does it say something couldn't be found, and it names the page it checked.

Claude never fills a gap with a guess, and never says "I didn't check" when a check was possible.

## Installing and updating the skills

The skills install as one package (a "plugin") straight from this GitHub repository. Once set up, changes merged here reach Claude on their own, with no downloading or uploading.

**One-off setup**

1. Remove the old uploaded copies of web-search and deep-search, so you don't have two of each.
   - In the Claude app, open **Customize**, then **Skills**, and delete both.
2. Add this repository as a plugin source.
   - Open **Customize**, then **Plugins**.
   - Select **Add marketplace** and enter `ireves/search`.
   - Turn on **Sync automatically**.
3. Install the plugin.
   - Find **search** in the list and select **Install**.
   - It works in chat, Cowork and Claude Code.

**After that:** when a change is merged here, Claude picks it up the next time it syncs. To get it straight away, select **Check for updates** on the marketplace.

**Note:** plugin skills may show with the plugin's name in front, such as `/search:deep-search`.

## Costs

Each search costs a little under one US cent. A Deep research report costs up to about $1.10, mostly for the two research agents. Auto usually costs a few cents.

## If something goes wrong

- **"has no API key" or "rejected the API key":** open your connector's settings page at [search-connector.vercel.app/settings](https://search-connector.vercel.app/settings) and add or replace the key.
- **One engine is unavailable:** Claude carries on with the other and tells you.
- **A page needs a login** (such as LinkedIn or Quora): Claude can't read it and will say so. For someone's professional background, it searches professional profiles instead.

## Where things are

- Your connector: [search-connector.vercel.app](https://search-connector.vercel.app)
- Settings page for API keys: [search-connector.vercel.app/settings](https://search-connector.vercel.app/settings)
- Address to give Claude as a connector: `https://search-connector.vercel.app/mcp`
- Full setup steps: [connector-setup.md](connector-setup.md)
