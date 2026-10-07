# Search for Claude

Web research for Claude using Exa and Parallel, through one custom connector you host on Vercel ([`connector/`](connector/)).

- **Skills:** [`skills/web-search`](skills/web-search) (everyday, `/web-search`) and [`skills/deep-search`](skills/deep-search) (verified research, `/deep-search`). Both run only when you type the command.
- **API keys:** added on the connector's own settings page; write-only.
- **Setup guide:** [`docs/connector-setup.md`](docs/connector-setup.md).

The connector does the engine-specific work itself (choosing the engine, trimming results, removing duplicates, reading Reddit threads with comments), so the skills only describe what Claude should find, not how each engine works. Details: [`connector/README.md`](connector/README.md).

What the skills do, in plain English: [`docs/skills-guide.md`](docs/skills-guide.md).

Research behind the connector and skills: [`docs/research-findings.md`](docs/research-findings.md).
