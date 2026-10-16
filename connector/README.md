# Search connector

A remote MCP server that gives Claude one set of web tools backed by both [Exa](https://exa.ai/docs) and [Parallel](https://docs.parallel.ai), with [TinyFish](https://docs.tinyfish.ai) (free daily allowance) and [Firecrawl](https://docs.firecrawl.dev) as optional first page readers and Google-style search. It runs as three Vercel Functions with no framework and three runtime dependencies (`@vercel/blob`, `@simplewebauthn/server`, and [`unpdf`](https://github.com/unjs/unpdf) for OpenAlex's PDF copies). Setup steps for people: [`docs/connector-setup.md`](../docs/connector-setup.md).

## Tools

| Tool | What Claude gets | Behind it |
|---|---|---|
| `search` | Up to 15 ranked results: title, date, author (when given), link, the matching passages (and profile facts for people, companies, papers) | Exa `/search` and Parallel `/v1/search`, run together and merged; TinyFish search (or Firecrawl `/v2/search` when TinyFish has no key or fails) added as a second opinion or fallback when a key is set; Apify job-board scrapers added to `jobs` searches when its token is set; OpenAlex added to `papers` searches that ask for it (uni-search) when its key is set, and ranked first |
| `fetch` | Up to 5 pages as clean text (with title, date and author when given), or only the passages answering a question | TinyFish Fetch first when its key is set, then Firecrawl `/v2/scrape` when its key is set; then Exa `/contents`; Parallel `/v1/extract` as the backup and for sites Exa can't read; OpenAlex's own full-text copy for OpenAlex paper links, and for DOI links when asked |
| `verify` | Evidence for up to 8 claims, each from different websites | One Exa and one Parallel search per claim |
| `research` | A cited report from one or two research agents | Exa Agent (`/agent/runs`); for `deep`, also Parallel Task API (`pro`) |
| `log_issue` | Saves a skill run's errors and failures, or a search-report report, to the problem log | A row in Supabase's `search_issues` table, or one JSON file in the private Vercel Blob store |

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

**TinyFish (optional).** When `TINYFISH_API_KEY` is set, TinyFish reads pages before anyone else and gives the Google-style search results described under Firecrawl below. Both are free within a daily allowance: 1,000 pages and 12,000 searches a day ([search](https://docs.tinyfish.ai/search-api/reference), [fetch](https://docs.tinyfish.ai/fetch-api/reference)).

- **Reading.** One request reads all the pages at once, rendering JavaScript where needed, and reads PDFs (which Firecrawl skips, as it charges per PDF page). Reddit (read through its own `.json` route), X (Parallel) and YouTube (Exa's transcripts) are skipped. TinyFish gets the first half of the fetch time; Firecrawl then tries what TinyFish couldn't read in whatever is left of that half, and Exa and Parallel take the rest as usual. Pages TinyFish timed out on go straight to Parallel. A question picks the matching paragraphs the same way as for Firecrawl (TinyFish's own question feature is a beta that must be switched on per account).
- **Search.** Takes Firecrawl's place as the second opinion and fallback, with the same rules, weights and query suffixes. Site filters, dates, `country` (as `location`), news and the search `goal` (as TinyFish's `purpose`) are passed on. If TinyFish fails, or finds nothing, Firecrawl searches instead when its key is set.
- **Limits.** A used-up allowance comes back as 402 ("out of credit") and resets at midnight UTC; a busy reply is 429. Either is reported once and the other engines carry on.
- **Cost line.** Shows "TinyFish free (2 pages, 1 search)". The settings page checks the key with TinyFish's free wallet lookup.

**Firecrawl (optional).** When `FIRECRAWL_API_KEY` is set, Firecrawl reads pages first (after TinyFish, when that is set up), to save Exa and Parallel usage (its free plan gives 1,000 pages a month). Pages it refuses, returns with an error status or returns thin go on to the usual Exa / Parallel route.

- Skipped for Reddit, NYT, LinkedIn, Yelp, Instagram, Facebook, TikTok, Threads, Pinterest and Craigslist (it refuses them), X (about 30 credits a page), PDFs (a credit per PDF page) and YouTube (Exa returns the transcript).
- Reads the whole page. With a question, the connector picks the paragraphs that share the most uncommon words with the question, in page order, instead of paying Firecrawl's extra 4 credits a page for its own question format. This matches words, not meaning, so it is a little less precise than Exa.
- Two pages at a time (the free plan's limit). The free plan also allows only about 10 pages a minute; pages turned away for that go to Exa and Parallel. A rejected key or empty credit is reported once and the remaining pages skip Firecrawl.
- Results show credits used: "Firecrawl 2 credits" in the cost line.

**Firecrawl in search (optional, same key; TinyFish does this instead when its key is set).** Firecrawl ranks results like Google, so it finds forum threads, mainstream recommendations and pages that only partly answer a question, which Exa's meaning-based search tends to pass over (see [`docs/search-toolkit-comparison.md`](../docs/search-toolkit-comparison.md)).

- **Second opinion:** for `web`, `discussions` (adds "reddit" to the query), `reviews`, `shopping` (where Firecrawl's ranking counts most, as it finds shops in the right country) and `code` searches at standard or thorough depth, Firecrawl runs alongside Exa and Parallel and its results are merged in.
- **Fallback:** for `fast` searches and for `news`, `jobs` and `x`, Firecrawl runs only when Exa and Parallel return fewer than 3 results. The reply then says so. Never used for `papers`, `people`, `companies` or `financial`, where Exa's structured index is better.
- Search results only (title, link, Google's short snippet, and the date when the snippet starts with one); no pages are read, so a search costs 2 credits per 10 results. Site filters are passed on, dates become Google's custom date range, and `country` is passed on.
- The free plan allows only a few searches a minute, so a busy reply (429) is retried once after 2.5 seconds.
- A rejected key or empty credit adds a note; the other engines' results still come back.

**Job boards through Apify (optional).** When `APIFY_API_TOKEN` is set, `jobs` searches at standard or thorough depth also run four [Apify](https://apify.com) scrapers side by side, and their adverts are merged in with Exa's:

| Board | Apify scraper | Free-plan price | Notes |
|---|---|---|---|
| LinkedIn | [`curious_coder/linkedin-jobs-scraper`](https://apify.com/curious_coder/linkedin-jobs-scraper) | $2 per 1,000 adverts ($1 on paid plans) | Company pages skipped to save time |
| Indeed | [`valig/indeed-jobs-scraper`](https://apify.com/valig/indeed-jobs-scraper) | $0.10 per 1,000 + $0.001 a run | `GB` is sent as Indeed's `uk` |
| Glassdoor | [`valig/glassdoor-jobs-scraper`](https://apify.com/valig/glassdoor-jobs-scraper) | $0.40 per 1,000 + $0.001 a run | |
| Totaljobs | [`blackfalcondata/totaljobs-scraper`](https://apify.com/blackfalcondata/totaljobs-scraper) | $1.39 per 1,000 + $0.01 a run | UK searches only; search-page snippets, not full adverts, to keep it fast |

- **Role and place.** Job boards search by role and place, not by sentence. The place comes from the `location` parameter, or from a trailing "in Manchester" / "near Leeds" in the query; words like "jobs", "roles" and "vacancies" are dropped. With no place, the whole country is searched. `country` defaults to `GB`.
- **Dates.** The jobs default of the last 30 days (or `after`) becomes each board's "posted within" filter. Indeed only offers 1, 3, 7 or 14 days, so longer windows there mean no limit.
- **Limits.** Each board returns at most `max_results` adverts. Every run also carries a charge ceiling (`maxTotalChargeUsd`) and a 60-second time limit, so a stuck scraper can't run up a bill or hold the search for long.
- **Sites.** A `sites` list naming a board (such as `linkedin.com`) runs only that board; `exclude_sites` skips it.
- **Results.** Each advert shows the board, place, salary when listed, and other details such as applicant numbers or company rating, then the start of the description.
- **Cost.** Apify doesn't report a run's cost in the reply, so the cost line shows an estimate from the free-plan prices above (an upper bound). A typical search with 8 adverts per board costs about 4 cents.
- A board that fails or runs out of credit adds a note; the other boards and Exa still answer. These are unofficial scrapers, so a change to a board's site can break one until its maker fixes it.

**Research papers through OpenAlex (optional).** `papers` searches that set `openalex: true` also ask [OpenAlex](https://developers.openalex.org), a free, open index of about 300 million scholarly works, when `OPENALEX_API_KEY` is set. Only uni-search's briefs set it; better-search and searches without the flag use Exa alone.

- **Why.** OpenAlex covers journals and conference papers Exa's index can miss, and gives each paper its venue, citation count and a link to a free copy when one exists (so `fetch` can read the full text). In the toolkit comparison a fair research question scored 3 out of 3, but everyday questions scored near zero, so it is used for `papers` only.
- **Ranked first.** OpenAlex's results count for 1.3 in the merge and Exa's for 0.7, so OpenAlex's papers lead and Exa's add pages OpenAlex lacks. Exa's top result always keeps a place. The reply's header says "OpenAlex (scholarly index) ranked first, Exa second."
- **How.** Semantic search (`search.semantic`, by meaning, like Exa) on the query. If OpenAlex turns that down, one keyword search on the query's main words instead. Retracted works are left out, and `after` / `before` become publication-date filters. A `sites` list leaves OpenAlex out, as it can't filter by site.
- **Results.** Title, date, link (the DOI when there is one), then authors (up to 50), venue, citation count and DOI, a "Free full text" link, and the abstract, cut to the usual passage length. The same paper found by Exa on arxiv.org and by OpenAlex as an arXiv DOI is shown once.
- **Key.** Required. OpenAlex lets requests without a key share one small daily budget per network address, which a Vercel server soon uses up. A free key at [openalex.org/settings/api](https://openalex.org/settings/api) gives $1 of use a day, resetting at midnight UTC. Asked for without a key, the reply says so and Exa searches alone.
- **Cost.** $0.001 a search (OpenAlex reports it in each reply), shown as "OpenAlex $0.0010" in the cost line. A used-up daily budget shows as "OpenAlex rate limit reached", and Exa's papers still come back.

**Full text through OpenAlex (optional, same key).** OpenAlex keeps its own copies of about 60 million papers, paywalled ones included: the PDF, and for most of them a version already split into title, abstract, sections and paragraphs by [Grobid](https://github.com/kermitt2/grobid) (TEI XML). See [OpenAlex's full-text guide](https://help.openalex.org/download/full-text-pdfs).

- **In search.** A `papers` result OpenAlex holds a copy of gets a line "Full text from OpenAlex (fetch reads it, $0.01): https://openalex.org/W…".
- **In fetch.** An `openalex.org/W…` link is always read from OpenAlex's copy. A `doi.org` link is read from it only when the call sets `openalex: true` (uni-search's briefs do); a DOI OpenAlex has no copy of goes to the usual readers, and OpenAlex gets only half the time limit for those so they still have time.
- **How.** One free lookup of the work shows which copies exist. The TEI XML is preferred: it becomes plain text (abstract, then each section under its heading, without the reference list). Without it, the PDF is turned into text with `unpdf`. Then the usual question or `start` rules apply. The reply says "Full text from OpenAlex's TEI XML copy" (or PDF copy).
- **Cost.** $0.01 a download, shown in the cost line under OpenAlex. Reading a long paper in parts with `start` downloads it again for each part. The free key's $1 a day covers about 100 downloads.

**Which services did the work.** Every `search` and `verify` result has a line such as "Engines: Exa 5 results, Parallel 3, TinyFish 4 (before merging)." Every `fetch` result ends with "Read by: TinyFish 2 pages, Exa 1. Not read: 1.", and each page's address line says which service read it ("read by TinyFish"). Workers copy this into a WORK line in their digest, and the skills turn it into progress lines in the chat.

**Problem log.** With Supabase set up (`SUPABASE_URL` and `SUPABASE_LOG_KEY`; tables from [`supabase/problem-log.sql`](supabase/problem-log.sql)), every `search`, `fetch`, `verify` and `research` call is saved as a row in `search_calls`: the parameters Claude passed, each engine request (engine, purpose such as "search" or "read pages", the settings sent, status, time taken, number of results, error text), the cost and the start of the reply. The reply's cost line ends with the row's ref (`· ref 1a2b3c4d`). The write happens after the reply is sent, so calls aren't slowed. The search skills call `log_issue` once at the end of any run where something failed (tool errors, engines unavailable, unreadable pages, workers that stopped early), giving the run's context (app, question, whether it's a follow-up and the earlier questions, outcome) and, per problem, the tool, the exact error and the failing call's ref, so they don't spend tokens restating parameters the connector already holds. The connector adds its own version, commit, region and which engines have keys. Entries go to `search_issues`; `/search-report` passes its whole report too (up to 200,000 characters). Claude reads the log with the Supabase connector, e.g. `select * from search_issue_details order by at desc limit 5`, which joins each entry to the calls it names. The connector's key can only add rows, never read or change them. Call rows are deleted after 30 days unless an entry names them. Without Supabase, or if Supabase refuses the row, entries go to the private Blob store as `search-connector/issues/<date>/<time>-<id>.json` (reports as `.md` beside them), and calls aren't recorded. Nothing is shown to the user and the call is free.

**Merging.** Results from all engines are combined by rank (reciprocal rank fusion), with duplicates and mirrored copies folded together. Each engine's top result always keeps a place, so one engine's best find isn't crowded out by pages the other two agree on. When two engines return different passages from the same page, the newer copy's passage leads and the other is shown underneath ("Another copy of this page says"), because one engine's stored copy can be out of date.

**Research.** Calls wait up to 170 seconds (Claude allows 240 per tool call) and otherwise return a `run_id` to collect later. `deep` runs Exa Agent (`auto`, $1 cap) and Parallel (`pro`) side by side, so Claude gets two independent reports to cross-check.

## Security

- **One secret.** Everything is derived from `ADMIN_PASSWORD` (PBKDF2, 210,000 rounds, then HKDF): the key that encrypts stored API keys and the key that signs tokens.
- **Write-only secrets.** API keys are encrypted with AES-256-GCM (bound to their name) and stored in a private Vercel Blob store. No page, response or tool returns a stored value. The settings page shows only "saved", "set in Vercel", "not set" or "needs re-entering".
- **Passkeys.** Sign-in uses a passkey (Face ID, Touch ID, Windows Hello or a security key), as in icloud-mcp. Only the public key is stored; each sign-in signs a fresh challenge that travels in a signed five-minute token and works once. User verification is required, and a passkey works only on the hostname it was made for (`PUBLIC_URL`). The first passkey is added from the settings page after signing in with the admin password, which plays the role of icloud-mcp's setup code. Once one exists, the password no longer signs in (it still derives the server-side keys); `ALLOW_PASSWORD_SIGN_IN=true` turns it back on for recovery, and removing the last passkey does the same. Up to 5 passkeys. Verification uses [SimpleWebAuthn](https://simplewebauthn.dev); the browser half is `/passkey.js`, served by this server.
- **Sign-in.** OAuth 2.1 with dynamic client registration and PKCE (S256), as Claude requires. Codes go only to `https://claude.ai/api/mcp/auth_callback` or a local address (Claude Code); extra exact addresses can be allowed with `ALLOWED_REDIRECT_URIS`. Access tokens last 1 hour, refresh tokens 90 days.
- **Sign out everything.** The settings page can invalidate every token and session at once.
- **Pages.** One script (`/passkey.js`, same origin, no inline code); strict content security policy; no framing; CSRF tokens and `SameSite=Strict` cookies; wrong passwords are slowed and limited per address.
- **Stateless.** No database beyond the one encrypted Blob file, so nothing else to secure or pay for. The optional Supabase problem log is write-only from the connector's side.

Known limits: codes and refresh tokens aren't single-use (that would need a database); PKCE, short code lifetimes and the sign-out-all switch cover the realistic risks for a one-person server.

## Settings

| Variable | Required | Purpose |
|---|---|---|
| `ADMIN_PASSWORD` | Yes | At least 12 characters |
| `BLOB_STORE_ID` | Added by Vercel | Set when a Blob store is connected |
| `EXA_API_KEY`, `PARALLEL_API_KEY`, `FIRECRAWL_API_KEY`, `TINYFISH_API_KEY`, `APIFY_API_TOKEN`, `OPENALEX_API_KEY` | No | Fallbacks if you prefer Vercel variables; keys saved on the settings page take priority. TinyFish, Firecrawl, Apify and OpenAlex are optional |
| `SUPABASE_URL`, `SUPABASE_LOG_KEY` | No | The problem log in Supabase: project address and publishable (or legacy anon) key. Can also be saved on the settings page |
| `PUBLIC_URL` | Recommended | The final address, e.g. `https://search-connector.vercel.app`. Passkeys are tied to its hostname, so set it before adding one |
| `ALLOW_PASSWORD_SIGN_IN` | No | `true` lets the admin password sign in even when passkeys exist. For recovering from a lost passkey; remove afterwards |
| `ALLOWED_REDIRECT_URIS` | No | Extra OAuth callback addresses, comma-separated |

## Files

```
api/mcp.ts        /mcp: the MCP endpoint (needs a token)
api/oauth.ts      /.well-known/*, /register, /authorize, /token
api/settings.ts   / and /settings
lib/engines/      Exa, Parallel, TinyFish, Firecrawl, Apify and OpenAlex API calls (OpenAlex search and full text)
lib/tools/        search, fetch, verify, research, and result merging
lib/mcp.ts        JSON-RPC handling, tool definitions, server instructions
lib/oauth.ts      authorisation server
lib/passkeys.ts   passkey registration and sign-in, and the browser script
lib/settings.ts   settings page
lib/store.ts      encrypted secret storage
lib/issues.ts     the problem log (log_issue)
lib/trace.ts      records each engine request during a tool call
lib/logstore.ts   writes call records and log entries to Supabase
supabase/         the problem log's tables, to run once in Supabase
lib/crypto.ts     key derivation, encryption, signed tokens
lib/text.ts       text clean-up, address matching, dates
```

## Development

```
npm install
npm test          # compiles and runs the tests (no network; engines are simulated)
npm run typecheck
```
