# Search for Claude

Web research for Claude using Exa and Parallel (with optional TinyFish, Firecrawl, Apify and OpenAlex), through one custom connector you host on Vercel ([`connector/`](connector/)).

- **Skills (version 2):** [`skills/better-search`](skills/better-search) (everyday, `/better-search`) and [`skills/uni-search`](skills/uni-search) (sourced research and large fact checks, `/uni-search`). Both run only when you type the command.
- **Diagnostics:** [`skills/search-report`](skills/search-report) (`/search-report`) writes a step-by-step record of a search run, including every tool call and worker output, lists likely problems, and saves the report to the problem log.
- **Problem log review:** [`skills/search-log`](skills/search-log) (`/search-log`, or ask Claude to review the search problem log) reads the log from Supabase, groups the problems, explains likely causes and suggests fixes, then waits for your go-ahead before changing anything.
- **Worker:** [`agents/search-worker.md`](agents/search-worker.md), a Haiku worker that runs the searches and returns short fact lists, so the main Claude's memory stays clear.
- **Version 1 backup:** [`v1/`](v1) (web-search and deep-search, no workers), installable as the `search-v1` plugin.
- **Problem log:** the search skills save errors and failures, and search-report saves its whole report, to the connector's problem log, for later troubleshooting. With Supabase set up, the connector also records every search call (engines, settings, timings, errors), and Claude can read the whole log back through the Supabase connector. Without it, entries go to the private Vercel Blob store (`search-connector/issues/`).
- **API keys:** added on the connector's own settings page; write-only.
- **Setup guide:** [`docs/connector-setup.md`](docs/connector-setup.md).

The connector does the engine-specific work itself (choosing the engine, trimming results, removing duplicates, reading Reddit threads with comments), so the skills only describe what Claude should find, not how each engine works. Details: [`connector/README.md`](connector/README.md).

What the skills do, in plain English: [`docs/skills-guide.md`](docs/skills-guide.md).

Research behind the connector and skills: [`docs/research-findings.md`](docs/research-findings.md).
