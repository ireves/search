# composio_finance (COMPOSIO_SEARCH_FINANCE)

Settings: query only (default window, which returned a 1D intraday graph; default hl). Google Finance via SerpAPI.

## The 20 questions (plain text)
- Success rate: 20/20 calls returned OK, but 0/20 returned data. Every one came back with `composio_execution_message`: "No financial data returned: Google Finance hasn't returned any results for this query", with `results: {}`.
- Latency: mean 6.12 s, median 4.94 s (range 1.1 to 21.2 s). Quite slow for an empty answer.
- Mean score: 0 / 3. Response size ~218 chars.
- This is expected: the tool only accepts exact ticker formats. Note that it reports success, so a caller must check the message or `results` to spot the empty answer.

## Fair test with tickers (extra)
| Query | Latency | Result |
|---|---|---|
| AAPL:NASDAQ | 1.81 s | Apple Inc USD336.64 at close on 9 Oct (-1.11%), after-hours 336.08; 559-point intraday graph; 3 quarterly financials blocks; 5 news items (Benzinga, Yahoo Finance; minutes to hours old) |
| RKT:LON | 1.63 s | Reckitt Benckiser Group Plc GBX5116 (+0.87%), 9 Oct; 484-point graph; financials; news of mixed quality (Traders Union, AD HOC NEWS "Goldman upgrades to Buy") |
| GBP-USD | 1.22 s | Pound sterling / US Dollar 1.3227 at 05:51 UTC on 10 Oct; 297-point graph; FX news (Action Forex, FOREX.com) |

On tickers it scores well: fast (1.2 to 1.8 s), current to the minute, and correct currency units (GBX for LSE). Stock responses are large (~200 KB, mostly the graph and financials), while FX is ~23 KB. One minor inconsistency: the RKT summary price of 5116 does not match the last graph point of 5135.

## Strengths
- Real-time quotes, intraday or historical series, financials and recent news in one call. It handles LSE tickers and FX pairs.

## Limitations and quirks
- Useless as a search engine: natural language never resolves, not even to the obvious company. You need to know the exact SYMBOL:EXCHANGE format.
- Empty results still report "success", so check `composio_execution_message`.
- News sources are mixed and include low-quality aggregators.
- Payloads are heavy unless trimmed.

## Cost
No cost fields in responses. It runs on the Composio Search toolkit (no auth, not the shared wallet).

## Best suited for
Market data lookups (price, chart, financials, ticker news) once the ticker is known. Not relevant to any of the 20 benchmark questions.
