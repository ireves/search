Fact Check spec. For large jobs: every checkable claim in a document is tested against the source it cites, and claims with no source get one found. Accuracy first, then cost; speed last. Output always goes in a Claude Doc.

COSTS (guide for choosing jobs; cheapest first)
- check (fetch one url with a question): about $0.001 per url. Many claims sharing a url cost one fetch.
- verify: about $0.008 per claim (one Exa and one Parallel search, short excerpts).
- search + read best 1: about $0.01-0.02.
- research: $0.25 or more per run. Never used in Fact Check.
Always take the cheapest job that can settle a claim. Move up only for claims it left unsettled.

F1 DOC FIRST
- Claude Doc skeleton now, before reading the document or searching, per the Claude Docs connector's instructions (load its docs skill if listed): title "Fact check: <document's title or topic>"; byline = today's date + "Checked with Exa and Parallel"; one pending block per DOC section below, each with a one-line intent.
- Claude Docs unavailable -> say in one line that Fact Check needs the Claude Docs connector (add it at claude.ai/customize/connectors); stop before any search.
- Read references/harvard.md too if Harvard.

F2 GET THE DOCUMENT
- Pasted text, attached file or Claude Doc link -> read it yourself (docs tools for a Claude Doc).
- Only a public link to the document -> fetch it yourself, no question, max_chars 60000; reply says "Read on with start: N" -> fetch again with that start until done. This is the one connector call you make yourself: you need the exact wording, which a digest would lose.
- Links the user gave separately (a reading list, a source pack) count as cited sources for every claim they bear on.
- No document in the message -> ask for it in one line; no search before it arrives.

F3 CLAIM LIST (yours)
- Go through the whole document in order. One entry per checkable claim: a figure, date, name, quote, event, finding, or anything attributed to a source. Split sentences that carry several facts. Skip the author's own opinions, arguments and recommendations (listed once in the doc as "not checked: opinion or argument", with a count, not one by one).
- Each entry: ID (C1, C2...), location (section heading, page or paragraph number), the claim as written (short quote), cited source (url, reference-list entry, or "none"), and a group:
  A. Cited with a link (inline, footnote, or a reference-list entry with a url or DOI).
  B. Cited without a link (author and year, a title, "a 2023 study").
  C. No source.
- Scope from STEP 1: "Cited claims only" -> A and B; "Find sources only" -> C; "Both" -> all. Out-of-scope claims are left out of the doc and counted in the scope note.
- More than 200 claims in scope -> before any search, ask once (multiple-choice): "Check all <n> claims (about $<estimate>)" or "Key claims first (figures, quotes, dates and anything cited)". Estimate: $0.002 per A claim, $0.02 per B or C claim, rounded up to the next dollar.
- Write the claim count and scope into the doc's scope note now, so the user sees progress.

F4 ROUND 1 (all helpers in one message, in the background)
- Each helper takes at most 20 claims (so its digest fits LIMIT), and its jobs stay within the WORKERS helper budget. More claims -> more helpers.
- A claims: group by url. One check job per url; question lists every claim citing it, with its ID as [n] (e.g. [C14]). Harvard -> add REFS.
- B claims: find the cited work first. One search per distinct cited work (type papers + openalex:true for studies; else no type), query = authors, year and title or words given; then "after: check the best match, question = every claim citing that work, with IDs". Up to 6 cited works per helper (about 39k).
- C claims: verify, 8 claims per call, each claim reworded to stand alone (who, what, figure, date). Up to 20 claims per helper (3 calls, about 40k).
- FACTS line for every helper: "for each [ID]: does the page state it, exactly as the claim words it? quote the words." LIMIT 40 words per claim, max 900.
- More than 60 claims: run F4-F6 one document section (or 60 claims) at a time, each section's helpers in one message, and fill that section's rows in the doc as soon as its claims are judged. Never hold every digest at once.

F5 ROUND 2 (only claims round 1 left unsettled; one message)
- A or B: "link failed" -> one read job on the next best copy (archive, publisher page, DOI link, PDF) found by one search for its title. "not stated" on a long page or PDF -> one read job with a narrower question naming the exact figure or words; still not stated -> the claim is "not in the cited source".
- B, no match found -> treat as C as well, and record "cited work not found".
- C with promising verify excerpts -> check job on the 1-2 best urls (primary first), question = the claim. C with nothing -> one search (type papers + openalex:true if scholarly) + read best 1, question = the claim.
- Up to 2 rounds after round 1. Then stop; what is left goes in "Could not check" with the pages tried.

F6 JUDGE EACH CLAIM (yours)
Use exactly one verdict per claim:
- Supported: the cited (or found) source states it, as worded.
- Partly supported: the source states something close, but a figure, date, scope or wording differs. Give the source's exact words and a corrected wording.
- Not in cited source: the page loads but does not state it.
- Contradicted: a source states the opposite or a different value. Quote it.
- Outdated: true once, since changed. Give the newer value, its source and date.
- Source found: (C claims) a source states it. Give the source and its exact words.
- No source found: nothing states it; name the searches and pages tried.
- Could not check: paywall, login, dead link with no copy, scanned PDF without text.
STEP 5 CONFIDENCE rules apply: for "Source found", prefer primary or peer-reviewed sources; a single secondary source makes it "Source found (weak)". Never judge from memory. The verdict quotes come from a check or read that saw the page, never from search or verify excerpts alone.

F7 DOC (fill each pending block; replace it with "## <heading>" + body)
1. Summary: count per verdict; the 3-8 most serious problems in one line each (ID, location, problem); one sentence on overall reliability. Plain words.
2. Problems to fix: every Partly supported, Not in cited source, Contradicted and Outdated claim, in document order. Table if it helps: ID | location | claim as written | what the source says ("quote") | suggested fix | source link.
3. Sources found for unsourced claims: every Source found claim: ID | location | claim | source | "quote". Harvard -> the in-text citation to add, with the full entry in the reference list.
4. No source found: ID | location | claim | searched (sites or queries) | note (e.g. "consider removing or rewording").
5. Confirmed: every Supported claim, compact: ID | location | short claim | source link.
6. Could not check: ID | location | claim | reason.
7. Scope note: what was checked (whole document or which sections, which groups), claims counted, opinions skipped, as-of date.
8. Sources: numbered list of every page used, primary first (Harvard: "Reference list" per references/harvard.md).
Skip sections that would be empty. No length cap; keep each row short. Don't mention tools, engines or workers except in the byline.
Chat reply at the end: one line with the counts, the doc link, and the cost line (STEP 7).
