# Search connector

A remote MCP server that gives Claude one set of web tools backed by both [Exa](https://exa.ai/docs) and [Parallel](https://docs.parallel.ai). It runs as three Vercel Functions with no framework and one runtime dependency (`@vercel/blob`). Setup steps for people: [`docs/connector-setup.md`](../docs/connector-setup.md).

## Tools

| Tool | What Claude gets | Behind it |
|---|---|---|
| `search` | Up to 15 ranked results: title, date, link, the matching passages (and profile facts for people, companies, papers) | Exa `/search` and Parallel `/v1/search`, run together and merged |
| `fetch` | Up to 5 pages as clean text, or only the passages answering a question | Exa `/contents`; Parallel `/v1/extract` as the backup and for sites Exa can't read |
| `verify` | Evidence for up to 8 claims, each from different websites | One Exa and one Parallel search per claim |
| `research` | A cited report from one or two research agents | Exa Agent (`/agent/runs`); for `deep`, also Parallel Task API (`pro`) |

The server also sends a short `instructions` text when Claude connects, so Claude knows the tools without a skill.

## How the engines are translated

The aim is that Claude never needs to know how Exa or Parallel work. The rules below come from the official docs (October 2026) and the tests in [`docs/research-findings.md`](../docs/research-findings.md).

**Exa** finds pages by meaning, from its own index. It works best with a description of the ideal page, accepts a separate `objective`, and returns "highlights": the passages of each page that match a query, sized by a character limit. It can't reach Reddit or X at all.

- Every search asks for highlights only (never full text), capped at 600 / 900 / 1,400 characters per result for `fast` / `standard` / `thorough`, and steered by `query + goal`.
- `goal` is passed as Exa's `objective`, using the wording Exa recommends for agent tools.
- `type` maps to Exa's `category` (`news`, `publication`, `people`, `company`, `financial report`) or to a short description prefix (for discussions, reviews, code, jobs), because Exa ranks by the kind of page described.
- `people` and `company` searches reject date and exclude filters, so those are dropped for those types.
- `depth` maps to Exa's search modes: `fast`, `auto`, `deep` (iterative search).
- `fresh` sets `maxAgeHours: 0` (re-download). Jobs are always fresh and default to the last 30 days.
- Structured `entities` (work history, funding, authors, DOI) are condensed to two or three lines. Exa library links are replaced by the paper's DOI.

**Parallel** combines an `objective` with short keyword queries (3 to 6 words), crawls live, and is the only one of the two that reaches Reddit, X, Glassdoor and Trustpilot well.

- Queries are built from the query's keywords; the full question goes in `objective`.
- Excerpts are capped per result and in total (`max_chars_total`), which the hosted Parallel connector couldn't do.
- `discussions`, `x` and `reviews` limit Parallel to the right sites with `source_policy.include_domains`, so it never repeats what Exa found.
- Modes: `turbo` for fast lookups, `fast` when merged with Exa, `basic` (longer snippets) when Parallel is the main source, `advanced` for `thorough`.
- Reddit threads are read through their `/.json` address with full content, then rebuilt as a list of comments sorted by votes. Plain thread reads often miss the comments.

**Merging.** Results from both engines are combined with reciprocal rank fusion (Exa weighted slightly higher for general searches). The same page found twice, tracking parameters, arXiv abs/pdf/html copies and old/new Reddit addresses fold into one entry; the same title on another site is shown once with "Same document also on: ...". Results dated outside the requested window are dropped; undated ones are kept.

**Clean-up.** Markdown links and images, Parallel's "Section Title" labels, cookie and navigation lines, and Reddit's "Related Answers" and "People also ask" filler are removed before Claude sees anything.

**Reading.** With a question, Exa returns only the relevant passages from anywhere in the document (better than cutting from the top). If Exa refuses a page or returns something thin or full of gaps, Parallel reads it instead. Pages cut at the limit say so.

**Research.** Calls wait up to 170 seconds (Claude allows 240 per tool call) and otherwise return a `run_id` to collect later. `deep` runs Exa Agent (`auto`, $1 cap) and Parallel (`pro`) side by side, so Claude gets two independent reports to cross-check.

## Security

- **One secret.** Everything is derived from `ADMIN_PASSWORD` (PBKDF2, 210,000 rounds, then HKDF): the key that encrypts stored API keys and the key that signs tokens.
- **Write-only secrets.** API keys are encrypted with AES-256-GCM (bound to their name) and stored in a private Vercel Blob store. No page, response or tool returns a stored value. The settings page shows only "saved", "set in Vercel", "not set" or "needs re-entering".
- **Sign-in.** OAuth 2.1 with dynamic client registration and PKCE (S256), as Claude requires. Codes go only to `https://claude.ai/api/mcp/auth_callback` or a local address (Claude Code); extra exact addresses can be allowed with `ALLOWED_REDIRECT_URIS`. Access tokens last 1 hour, refresh tokens 90 days.
- **Sign out everything.** The settings page can invalidate every token and session at once.
- **Pages.** No JavaScript; strict content security policy; no framing; CSRF tokens and `SameSite=Strict` cookies; wrong passwords are slowed and limited per address.
- **Stateless.** No database beyond the one encrypted Blob file, so nothing else to secure or pay for.

Known limits: codes and refresh tokens aren't single-use (that would need a database); PKCE, short code lifetimes and the sign-out-all switch cover the realistic risks for a one-person server.

## Settings

| Variable | Required | Purpose |
|---|---|---|
| `ADMIN_PASSWORD` | Yes | At least 12 characters |
| `BLOB_STORE_ID` | Added by Vercel | Set when a Blob store is connected |
| `EXA_API_KEY`, `PARALLEL_API_KEY` | No | Fallbacks if you prefer Vercel variables; keys saved on the settings page take priority |
| `PUBLIC_URL` | No | Fixes the public address if you use several domains |
| `ALLOWED_REDIRECT_URIS` | No | Extra OAuth callback addresses, comma-separated |

## Files

```
api/mcp.ts        /mcp: the MCP endpoint (needs a token)
api/oauth.ts      /.well-known/*, /register, /authorize, /token
api/settings.ts   / and /settings
lib/engines/      Exa and Parallel API calls
lib/tools/        search, fetch, verify, research, and result merging
lib/mcp.ts        JSON-RPC handling, tool definitions, server instructions
lib/oauth.ts      authorisation server
lib/settings.ts   settings page
lib/store.ts      encrypted secret storage
lib/crypto.ts     key derivation, encryption, signed tokens
lib/text.ts       text clean-up, address matching, dates
```

## Development

```
npm install
npm test          # compiles and runs the tests (no network; engines are simulated)
npm run typecheck
```
