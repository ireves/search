# Your search skills: a guide

This explains what the search skills do and how to use them. This is version 2. Version 1 (web-search and deep-search) is kept as a backup in the [`v1`](../v1) folder.

Both skills use your Search connector, which combines two search engines:

- **Exa** finds pages by meaning. It's best for articles, research papers, people, companies, job listings and official pages.
- **Parallel** reaches places Exa can't, such as Reddit, X, Glassdoor and Trustpilot, and is used as a backup reader.
- **Firecrawl** (optional) reads web pages first when its key is added, so Exa and Parallel are used less.

The connector decides which engine to use, removes duplicates and trims results, so Claude only sees what's relevant.

## What's new in version 2

**Workers do the searching.** A worker is a smaller, cheaper Claude model (Haiku) that Claude hands simple jobs to.

1. The main Claude plans what to look for.
2. It sends workers a short list of searches and page reads.
   - Several workers run at the same time when a question has more than one angle.
3. Each worker runs its searches and sends back a short list of facts, each with its link and date.
   - The long search results stay with the worker, so the main Claude's memory isn't filled with them.
4. The main Claude decides what's true, fills gaps and writes the answer.

**Where workers run:** in the Claude app wherever Cowork features are available, and in Claude Code. If workers aren't available (for example in a plain chat where Cowork features haven't reached your account yet), Claude does the searches itself, the same way version 1 did. The answer is the same; it just uses more of the main Claude's memory.

**New names:** `/uni-search` (replaces deep-search) and `/better-search` (replaces web-search). In the Claude app they may show as `/search:uni-search` and `/search:better-search`.

## uni-search: sourced research

**When it's used:** only when you type `/uni-search` followed by your question.

**Rules for both options:**

- Every fact has a source link.
- Claude never states something it can't back up. If it draws its own conclusion, it says so and builds it on cited facts.
- If your question assumes something that turns out to be false, Claude says so first.

**First, it asks how thorough to be** (unless you've already said, for example `/uni-search research: ...`):

- **Auto:** Claude picks the right amount of work for the question.
  - A single fact: one worker searches, reads the official page and checks the fact.
  - A few facts on one topic: two workers search from different angles, then the key facts are checked.
  - A comparison or long list: a research agent, plus workers reading each item's official pages, then gaps are filled and facts checked.
  - The answer appears in the chat with source links and confidence labels.
- **Research:** in-depth research, up to 3 pages.
  1. Claude asks one more question: **Claude Doc** or **Chat**.
     - It asks straight away, before searching, so you're not kept waiting at the end.
     - Skip the question by saying it upfront, for example `/uni-search research, in chat: ...`.
  2. Two independent research agents (one from Exa, one from Parallel) investigate the question.
  3. At the same time, workers search from different angles: official sources, recent news, studies, people's experiences and critics.
  4. Claude compares everything, settles disagreements by reading the original source, and checks every key fact.
  5. **Source check (new):** before writing, a worker opens every page Claude plans to cite and confirms it says what Claude claims. Anything that doesn't match is fixed or removed.
  6. The report has these sections:
     - **Bottom line:** the direct answer.
     - **Key findings:** one fact per point, each with its source.
     - **Analysis** (only when you ask why or how): Claude's reasoning, clearly marked, built on the findings.
     - **Where sources disagree** (only if they do).
     - **Not confirmed** (only if something couldn't be checked).
     - **Sources:** a numbered list.

**Harvard references (optional):**

- Choose **Harvard** instead of **Links** when Claude asks how to reference sources. The question is part of a menu Claude already shows, so it doesn't add an extra step.
- Or say it upfront, for example `/uni-search auto, Harvard: ...`. Once chosen, Claude keeps it for the rest of the conversation.
- You get citations in the text, like (Smith, 2024), and a reference list in the Cite Them Right Harvard style, which most UK universities use.
- Before writing, a worker opens every cited page and collects the author, date, title, journal details and DOI. Claude never guesses a missing detail: no author becomes the organisation's name, and no date becomes "n.d."
- The reference list names every author. "et al." is only used in the text, for sources with four or more authors, for example (Smith et al., 2024).

**Confidence labels you'll see:**

- **Confirmed:** from the official source, or two or more independent sources agree.
- **Likely:** one reliable source says so.
- **Unconfirmed:** only hinted at, or sources conflict. Claude says what conflicts.

## better-search: everyday searching

**When it's used:** only when you type `/better-search` followed by your question.

**What's different from uni-search:** the answer should still be accurate and useful, but Claude doesn't need to cite every point. It can combine sources, read between the lines, give its own view and make recommendations. Links are added where they help, such as the official page or a useful thread. Specific facts like prices, dates and versions still come from the search, never from memory.

**First, it asks how hard to search** (unless you've already said, for example `/better-search deep: ...`, or you've only given a link to read):

- **Auto:** sized to the question. A simple lookup takes one or two searches.
- **Deep:** always searches thoroughly, from several angles at once (official pages, people's experiences, reviews, news). The answer is still only as long as the question needs.

## search-report: finding problems

**When it's used:** only when you type `/search-report`, in the same conversation as the search you want to look into. In the Claude app it may show as `/search:search-report`.

**What it does:** it writes a report of everything that happened during the search, without searching again.

1. Claude gathers the record.
   - In Claude Code (and in the Claude app when it can run code), it reads the conversation's saved log. This includes each worker's own searches.
   - Otherwise it works from what it can see in the conversation. It can see what it asked each worker and what each worker sent back, but not each worker's individual searches. The report says so.
2. It checks the run against the search skill's own rules, for example whether the right model was used for workers and whether the cost line adds up.
3. The report has these sections:
   - **Summary:** the question, the option used, how many searches, time taken and cost.
   - **Timeline:** every step in order, with who did it, what tool was used and what came back.
   - **Workers:** what each worker was asked, word for word, what it searched and what it sent back, word for word.
   - **Rule check:** each rule, whether it was followed, and the evidence.
   - **Problems:** what went wrong, the evidence, the likely cause and a suggested fix. Each is marked "seen" or "guess".
   - **Final answer** you were given, and anything Claude **couldn't see**.
4. It's saved as a file when Claude can save files, with a short summary in the chat. Otherwise the whole report goes in the chat.

**Tips:**

- Add `last` to report only the most recent search, for example `/search-report last`.
- API keys and passwords are removed from the report.

## Costs

Every answer ends with a line like "Search cost: $0.031 (Exa $0.021, Parallel $0.010)". It adds up every search made for that answer, including the workers' searches. It doesn't include Claude's own usage, which comes out of your Claude plan as usual. Workers use Haiku, Anthropic's smallest and cheapest model.

Each search costs a little under one US cent. A uni-search Research report costs up to about $1.40, mostly for the two research agents. Auto usually costs a few cents.

## If something goes wrong

- **"has no API key" or "rejected the API key":** open your connector's settings page at [search-connector.vercel.app/settings](https://search-connector.vercel.app/settings) and add or replace the key.
- **One engine is unavailable:** Claude carries on with the other and tells you.
- **A page needs a login** (such as LinkedIn): Claude can't read it and will say so.
- **Version 2 misbehaves:** switch back to version 1. Steps are in [`v1/README.md`](../v1/README.md).

## Installing and updating the skills

The skills install as one plugin straight from this GitHub repository. If you already installed the **search** plugin with **Sync automatically** turned on, version 2 arrives on its own. To get it straight away, open **Customize**, then **Plugins**, and select **Check for updates** on the **ireves-search** marketplace.

First-time setup is in [connector-setup.md](connector-setup.md).

## For whoever edits the skills

- The worker's instructions are in [`agents/search-worker.md`](../agents/search-worker.md).
- A copy sits in each skill's `references/worker.md`, for when Claude has to brief a general worker instead.
- After changing the worker's instructions, run `sh scripts/check-worker-copies.sh --write` to update the copies.

## Where things are

- Your connector: [search-connector.vercel.app](https://search-connector.vercel.app)
- Settings page for API keys: [search-connector.vercel.app/settings](https://search-connector.vercel.app/settings)
- Address to give Claude as a connector: `https://search-connector.vercel.app/mcp`
- Full setup steps: [connector-setup.md](connector-setup.md)
