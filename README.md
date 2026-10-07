# Search for Claude

Web research for Claude using Exa and Parallel, through one custom connector you host on Vercel ([`connector/`](connector/)).

- **Skills (version 2):** [`skills/better-search`](skills/better-search) (everyday, `/better-search`) and [`skills/uni-search`](skills/uni-search) (sourced research, `/uni-search`). Both run only when you type the command.
- **Worker:** [`agents/search-worker.md`](agents/search-worker.md), a Haiku worker that runs the searches and returns short fact lists, so the main Claude's memory stays clear.
- **Version 1 backup:** [`v1/`](v1) (web-search and deep-search, no workers), installable as the `search-v1` plugin.
- **API keys:** added on the connector's own settings page; write-only.
- **Setup guide:** [`docs/connector-setup.md`](docs/connector-setup.md).

The connector does the engine-specific work itself (choosing the engine, trimming results, removing duplicates, reading Reddit threads with comments), so the skills only describe what Claude should find, not how each engine works. Details: [`connector/README.md`](connector/README.md).

What the skills do, in plain English: [`docs/skills-guide.md`](docs/skills-guide.md).

Research behind the connector and skills: [`docs/research-findings.md`](docs/research-findings.md).
