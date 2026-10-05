# Search for Claude

Web research for Claude using Exa and Parallel. There are two versions.

| | Connector version (new) | Separate connectors version |
|---|---|---|
| How Claude reaches the engines | One custom connector you host on Vercel ([`connector/`](connector/)) | Exa's and Parallel's own hosted connectors |
| Skills | [`skills/web-search`](skills/web-search) (everyday) and [`skills/deep-search`](skills/deep-search) (verified research, `/deep-search`) | [`.claude/skills/web-research`](.claude/skills/web-research) |
| API keys | Added on the connector's own settings page; write-only | Signed in per connector |
| Setup guide | [`docs/connector-setup.md`](docs/connector-setup.md) | [`docs/setup.md`](docs/setup.md) |

The connector does the engine-specific work itself (choosing the engine, trimming results, removing duplicates, reading Reddit threads with comments), so the skills only describe what Claude should find, not how each engine works. Details: [`connector/README.md`](connector/README.md).

What the new skills do, in plain English: [`docs/skills-guide.md`](docs/skills-guide.md).

Research behind both versions: [`docs/research-findings.md`](docs/research-findings.md).
