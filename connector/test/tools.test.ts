import { strict as assert } from "node:assert";
import { after, beforeEach, test } from "node:test";
import { calls, exaResult, freshStore, mockNetwork, parallelResult, restoreNetwork } from "./helpers.js";
import { entityFacts } from "../lib/engines/exa.js";
import { leadingDate } from "../lib/engines/firecrawl.js";
import { doiOf, openalexWorkId, rebuildAbstract, teiToText } from "../lib/engines/openalex.js";
import { useIssueWriter } from "../lib/issues.js";
import { useRowWriter } from "../lib/logstore.js";
import { jobQuery, runSearch } from "../lib/tools/search.js";
import { salary } from "../lib/engines/apify.js";
import { runFetch, formatRedditJson } from "../lib/tools/fetch.js";
import { runVerify } from "../lib/tools/verify.js";
import { runResearch } from "../lib/tools/research.js";
import { callTool } from "../lib/mcp.js";
import { setSecret } from "../lib/store.js";

beforeEach(async () => {
  await freshStore();
});
after(restoreNetwork);

const exaSearchReply = (results: unknown[]) => (c: { url: string }) => (c.url === "https://api.exa.ai/search" ? { body: { results } } : undefined);
const parallelSearchReply = (results: unknown[]) => (c: { url: string }) =>
  c.url === "https://api.parallel.ai/v1/search" ? { body: { results } } : undefined;

test("web search merges both engines, removes duplicates and mirrors", async () => {
  mockNetwork(
    exaSearchReply([
      exaResult("https://example.com/guide?utm_source=x", "A complete guide to the thing", "The thing works like this.", "2026-09-01"),
      exaResult("https://arxiv.org/abs/2401.01234v2", "Measuring dark patterns in cancellation flows at scale", "We found 4.9 clicks."),
    ]),
    parallelSearchReply([
      parallelResult("https://www.example.com/guide", "A complete guide to the thing", "Section Title: Guide\nContent:\nThe thing works like this, in detail."),
      parallelResult("https://researchgate.net/p/123", "Measuring dark patterns in cancellation flows at scale", "Mirror copy."),
      parallelResult("https://news.example.org/new", "Fresh news", "Brand new fact [link](https://x.y/z)."),
    ]),
  );
  const { text, isError } = await runSearch({ query: "how the thing works" });
  assert.equal(isError, false);
  assert.equal((text.match(/^\[\d+\]/gm) ?? []).length, 3, text);
  assert.match(text, /Same document also on: researchgate\.net/);
  assert.doesNotMatch(text, /Section Title|https:\/\/x\.y\/z/);
  const exaCall = calls.find((c) => c.url.includes("exa.ai"))!;
  assert.equal(exaCall.headers["x-api-key"], "exa-test-key-123");
  assert.equal(exaCall.body.contents.highlights.maxCharacters, 900);
  const parCall = calls.find((c) => c.url.includes("parallel.ai"))!;
  assert.equal(parCall.body.mode, "fast");
});

test("X searches go only to Parallel, limited to X", async () => {
  mockNetwork(parallelSearchReply([parallelResult("https://x.com/someone/status/1", "Post", "Loving the new release")]));
  const { text } = await runSearch({ query: "reactions to Blender 5.2", type: "x" });
  assert.ok(calls.every((c) => c.url.includes("parallel.ai")));
  assert.deepEqual(calls[0].body.advanced_settings.source_policy.include_domains, ["x.com", "twitter.com"]);
  assert.match(text, /Loving the new release/);
});

test("people searches drop date filters Exa rejects for that category", async () => {
  mockNetwork(
    exaSearchReply([
      {
        url: "https://linkedin.com/in/someone",
        title: "Someone",
        highlights: ["Engineer"],
        entities: [{ type: "person", properties: { location: "London", workHistory: [{ title: "Engineer", company: "Acme", dates: "2020-", location: null }], educationHistory: [] } }],
      },
    ]),
  );
  const { text } = await runSearch({ query: "senior engineers at Acme", type: "people", after: "1y" });
  const body = calls[0].body;
  assert.equal(body.category, "people");
  assert.equal(body.startPublishedDate, undefined);
  assert.match(text, /Work: Engineer at Acme/);
});

test("one engine failing still returns results, with a note", async () => {
  mockNetwork(
    exaSearchReply([exaResult("https://a.com/x", "Title A", "Fact A")]),
    (c) => (c.url.includes("parallel.ai") ? { status: 429, body: { error: { message: "slow down" } } } : undefined),
  );
  const { text, isError } = await runSearch({ query: "anything" });
  assert.equal(isError, false);
  assert.match(text, /Parallel unavailable: Parallel rate limit/);
});

test("missing API key is reported plainly", async () => {
  await freshStore(false);
  mockNetwork();
  const { text, isError } = await runSearch({ query: "anything", type: "papers" });
  assert.equal(isError, true);
  assert.match(text, /Exa has no API key/);
});

test("fetch reads with Exa and falls back to Parallel for thin pages", async () => {
  mockNetwork(
    (c) =>
      c.url === "https://api.exa.ai/contents"
        ? {
            body: {
              results: [
                { url: "https://good.com/a", title: "Good", highlights: ["A long relevant passage. ".repeat(20)] },
                { url: "https://thin.com/b", title: "Thin", highlights: ["…"] },
              ],
              statuses: [
                { id: "https://good.com/a", status: "success" },
                { id: "https://thin.com/b", status: "success" },
              ],
            },
          }
        : undefined,
    (c) =>
      c.url === "https://api.parallel.ai/v1/extract"
        ? { body: { results: [{ url: "https://thin.com/b", title: "Thin", excerpts: ["Parallel read the whole answer here."] }], errors: [] } }
        : undefined,
  );
  const { text, isError } = await runFetch({ urls: ["https://good.com/a", "thin.com/b"], question: "what is the answer" });
  assert.equal(isError, false);
  assert.match(text, /A long relevant passage/);
  assert.match(text, /Parallel read the whole answer here/);
});

const firecrawlReply = (pages: Record<string, { status?: number; markdown?: string; title?: string; credits?: number }>) => (c: { url: string; body: any }) => {
  if (c.url !== "https://api.firecrawl.dev/v2/scrape") return undefined;
  const page = pages[c.body.url];
  if (!page) return { status: 403, body: { success: false, error: "We do not support this site." } };
  return {
    body: {
      success: true,
      data: { markdown: page.markdown ?? "", metadata: { title: page.title, statusCode: page.status ?? 200, creditsUsed: page.credits ?? 1 } },
    },
  };
};

test("with a Firecrawl key, Firecrawl reads first and the others take what it can't", async () => {
  await setSecret("FIRECRAWL_API_KEY", "fc-test-key");
  mockNetwork(
    firecrawlReply({
      "https://good.com/a": { title: "Good", markdown: "Firecrawl read this page in full. ".repeat(20) },
      "https://gone.com/b": { status: 404, markdown: "Not found" },
      "https://checked.com/d": { markdown: `Checking your browser before accessing checked.com ... reCAPTCHA ${"Please wait. ".repeat(30)}` },
    }),
    (c) =>
      c.url === "https://api.exa.ai/contents"
        ? { body: { results: c.body.urls.map((u: string) => ({ url: u, title: "Exa", text: `Exa read ${u}. `.repeat(20) })), costDollars: { total: 0.002 } } }
        : undefined,
  );
  const result = await callTool("fetch", {
    urls: ["https://good.com/a", "https://gone.com/b", "https://unsupported.com/c", "https://www.youtube.com/watch?v=1", "https://example.com/paper.pdf"],
  });
  assert.equal(result.isError, false);
  assert.match(result.text, /Firecrawl read this page in full/);
  assert.match(result.text, /Exa read https:\/\/gone\.com\/b/);
  assert.match(result.text, /Exa read https:\/\/unsupported\.com\/c/);
  const scraped = calls.filter((c) => c.url.includes("firecrawl")).map((c) => c.body.url);
  assert.deepEqual(scraped.sort(), ["https://gone.com/b", "https://good.com/a", "https://unsupported.com/c"]);
  const exaUrls = calls.find((c) => c.url === "https://api.exa.ai/contents")?.body.urls;
  assert.deepEqual(exaUrls.sort(), ["https://example.com/paper.pdf", "https://gone.com/b", "https://unsupported.com/c", "https://www.youtube.com/watch?v=1"]);
  assert.match(result.text, /Firecrawl 2 credits\)$/);
  // A bot-check page counts as not read.
  const blocked = await runFetch({ urls: ["https://checked.com/d"] });
  assert.match(blocked.text, /Exa read https:\/\/checked\.com\/d/);
});

test("Firecrawl answers a question with the matching paragraphs of a long page", async () => {
  await setSecret("FIRECRAWL_API_KEY", "fc-test-key");
  const filler = Array.from({ length: 40 }, (_, i) => `Paragraph ${i} talks about gardening, weather and nothing in particular at all.`);
  filler.splice(30, 0, "The cancellation fee is £25 and refunds take 14 days to arrive in your account.");
  mockNetwork(firecrawlReply({ "https://shop.com/terms": { title: "Terms", markdown: filler.join("\n\n") } }));
  const { text } = await runFetch({ urls: ["https://shop.com/terms"], question: "What is the cancellation fee?", max_chars: 500 });
  assert.match(text, /cancellation fee is £25/);
  assert.ok(text.length < 900);
  assert.equal(calls.filter((c) => !c.url.includes("firecrawl")).length, 0);
});

test("a rejected Firecrawl key is reported and the others read instead", async () => {
  await setSecret("FIRECRAWL_API_KEY", "fc-bad-key");
  mockNetwork(
    (c) => (c.url === "https://api.firecrawl.dev/v2/scrape" ? { status: 401, body: { success: false, error: "Unauthorized" } } : undefined),
    (c) =>
      c.url === "https://api.exa.ai/contents"
        ? { body: { results: c.body.urls.map((u: string) => ({ url: u, title: "Exa", text: "Exa read the page. ".repeat(20) })) } }
        : undefined,
  );
  const { text, isError } = await runFetch({ urls: ["https://a.com/1", "https://b.com/2", "https://c.com/3", "https://d.com/4"] });
  assert.equal(isError, false);
  assert.match(text, /Firecrawl rejected the API key/);
  // Two pages are read at a time; once the key is rejected the rest skip Firecrawl.
  assert.equal(calls.filter((c) => c.url.includes("firecrawl")).length, 2);
  assert.equal(calls.find((c) => c.url === "https://api.exa.ai/contents")?.body.urls.length, 4);
});

test("a page Firecrawl times out on gets one quick try with Parallel, not every reader in turn", async () => {
  await setSecret("FIRECRAWL_API_KEY", "fc-test-key");
  process.env.FETCH_BUDGET_MS = "600";
  mockNetwork(
    (c) =>
      c.url === "https://api.parallel.ai/v1/extract"
        ? { body: { results: [{ url: "https://slow.com/a", title: "Slow", excerpts: ["Parallel got the slow page in the end."] }], errors: [] } }
        : undefined,
  );
  const mocked = globalThis.fetch;
  // Firecrawl never answers; the request only ends when it is cut off.
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
    String(input).includes("firecrawl")
      ? (calls.push({ url: String(input), method: "POST", body: JSON.parse(String(init?.body)), headers: {} }),
        new Promise((_, reject) => init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })))))
      : mocked(input, init)) as typeof fetch;
  try {
    const began = Date.now();
    const { text, isError } = await runFetch({ urls: ["https://slow.com/a"], question: "what is on the page" });
    assert.equal(isError, false, text);
    assert.match(text, /Parallel got the slow page/);
    assert.equal(calls.filter((c) => c.url === "https://api.exa.ai/contents").length, 0);
    assert.ok(Date.now() - began < 1500);
  } finally {
    delete process.env.FETCH_BUDGET_MS;
    globalThis.fetch = mocked;
  }
});

test("all pages in one fetch share a size limit", async () => {
  mockNetwork((c) =>
    c.url === "https://api.exa.ai/contents"
      ? { body: { results: c.body.urls.map((u: string) => ({ url: u, title: "Long", text: "A long page with many words. ".repeat(2000) })) } }
      : undefined,
  );
  const urls = ["https://a.com/1", "https://b.com/2", "https://c.com/3", "https://d.com/4", "https://e.com/5"];
  const { text } = await runFetch({ urls, max_chars: 60_000 });
  // 80,000 shared by 5 pages: 16,000 each, plus a little extra asked for to tell whether more follows.
  assert.equal(calls.find((c) => c.url === "https://api.exa.ai/contents")?.body.text.maxCharacters, 17_000);
  assert.ok(text.length < 83_000);
});

test("a long document is read whole up to 60,000 characters, then in parts with start", async () => {
  const paper = Array.from({ length: 2000 }, (_, i) => `Sentence ${i} of the paper says something useful.`).join(" ");
  mockNetwork((c) =>
    c.url === "https://api.exa.ai/contents"
      ? { body: { results: c.body.urls.map((u: string) => ({ url: u, title: "Paper", text: paper.slice(0, c.body.text.maxCharacters) })) } }
      : undefined,
  );
  const first = await runFetch({ urls: ["https://journal.example/paper.pdf"], max_chars: 60_000 });
  assert.match(first.text, /Sentence 0 of the paper/);
  const next = Number(first.text.match(/Read on with start: (\d+)/)?.[1]);
  assert.ok(next > 55_000 && next <= 60_000);
  const second = await runFetch({ urls: ["https://journal.example/paper.pdf"], max_chars: 60_000, start: next });
  assert.doesNotMatch(second.text, /Sentence 0 of/);
  assert.match(second.text, /Sentence 1999 of the paper/);
  assert.doesNotMatch(second.text, /Read on with start/);
  // Nothing is skipped or repeated between the parts.
  // Each reply is: title, link line, the text, then any note.
  const body = (t: string) => t.split("\n")[2];
  assert.equal(body(first.text).replace(/ …$/, "") + body(second.text), paper);
});

test("a question ignores start and searches the whole document", async () => {
  mockNetwork((c) =>
    c.url === "https://api.exa.ai/contents"
      ? { body: { results: [{ url: c.body.urls[0], title: "Paper", highlights: ["The sample size was 412 participants. ".repeat(10)] }] } }
      : undefined,
  );
  const { text } = await runFetch({ urls: ["https://journal.example/p.pdf"], question: "What was the sample size?", start: 50_000 });
  assert.match(text, /412 participants/);
  assert.equal(calls[0].body.highlights.maxCharacters, 4000);
});

const firecrawlSearchReply = (items: { url: string; title: string; description?: string; date?: string }[], news = false, credits = 2) => (c: {
  url: string;
}) => (c.url === "https://api.firecrawl.dev/v2/search" ? { body: { success: true, data: { [news ? "news" : "web"]: items }, creditsUsed: credits } } : undefined);

test("with a Firecrawl key, web searches add Firecrawl as a second opinion", async () => {
  await setSecret("FIRECRAWL_API_KEY", "fc-test-key");
  mockNetwork(
    exaSearchReply([exaResult("https://docs.example.com/answer", "Official answer", "The documented rule.")]),
    parallelSearchReply([parallelResult("https://docs.example.com/answer", "Official answer", "The documented rule, again.")]),
    firecrawlSearchReply([
      { url: "https://www.reddit.com/r/thing/comments/1/how", title: "How I fixed it : r/thing", description: "18 Jan 2026 · It worked once I changed the setting." },
      { url: "https://docs.example.com/answer", title: "Official answer", description: "The documented rule." },
    ]),
  );
  const { text, isError } = await callTool("search", { query: "how do I fix the thing", country: "gb" });
  assert.equal(isError, false);
  const fc = calls.find((c) => c.url === "https://api.firecrawl.dev/v2/search")!;
  assert.equal(fc.headers.authorization, "Bearer fc-test-key");
  assert.deepEqual(fc.body.sources, ["web"]);
  assert.equal(fc.body.country, "GB");
  assert.equal((text.match(/^\[\d+\]/gm) ?? []).length, 2, text);
  assert.match(text, /How I fixed it : r\/thing \(2026-01-18\)/);
  assert.match(text, /\nIt worked once I changed the setting\./);
  assert.match(text, /Firecrawl 2 credits\)$/);
  assert.doesNotMatch(text, /Firecrawl searched as well/);
});

test("fast searches with enough results, and searches without a Firecrawl key, leave Firecrawl out", async () => {
  mockNetwork(exaSearchReply([exaResult("https://a.com/x", "Title A", "Fact A")]), parallelSearchReply([]), firecrawlSearchReply([]));
  await runSearch({ query: "anything at all" });
  assert.equal(calls.filter((c) => c.url.includes("firecrawl")).length, 0);
  await setSecret("FIRECRAWL_API_KEY", "fc-test-key");
  mockNetwork(exaSearchReply([1, 2, 3].map((i) => exaResult(`https://a${i}.com/`, `Title ${i}`, "Fact."))), parallelSearchReply([]), firecrawlSearchReply([]));
  await runSearch({ query: "anything at all", depth: "fast" });
  assert.equal(calls.filter((c) => c.url.includes("firecrawl")).length, 0);
});

test("when Exa and Parallel find little, Firecrawl searches as a fallback", async () => {
  await setSecret("FIRECRAWL_API_KEY", "fc-test-key");
  mockNetwork(
    exaSearchReply([exaResult("https://news.example.com/1", "Only story", "One fact.", "2026-10-01")]),
    parallelSearchReply([]),
    firecrawlSearchReply([{ url: "https://paper.example.co.uk/2", title: "Second story", snippet: "Another view.", date: "2026-10-02" } as never], true),
  );
  const { text } = await runSearch({ query: "council decision on the bridge", type: "news", after: "2026-09-01" });
  const fc = calls.find((c) => c.url === "https://api.firecrawl.dev/v2/search")!;
  assert.deepEqual(fc.body.sources, ["news"]);
  assert.equal(fc.body.tbs, "cdr:1,cd_min:9/1/2026");
  assert.match(text, /Firecrawl searched as well/);
  assert.match(text, /Second story \(2026-10-02\)/);
});

test("enough results from Exa and Parallel means no fallback", async () => {
  await setSecret("FIRECRAWL_API_KEY", "fc-test-key");
  mockNetwork(
    exaSearchReply([1, 2, 3].map((i) => exaResult(`https://n${i}.com/`, `Story ${i}`, "Fact.", "2026-10-01"))),
    parallelSearchReply([]),
    firecrawlSearchReply([], true),
  );
  await runSearch({ query: "council decision on the bridge", type: "news" });
  assert.equal(calls.filter((c) => c.url.includes("firecrawl")).length, 0);
});

test("a Firecrawl failure leaves the other results and adds a note", async () => {
  await setSecret("FIRECRAWL_API_KEY", "fc-test-key");
  mockNetwork(
    exaSearchReply([exaResult("https://a.com/x", "Title A", "Fact A")]),
    parallelSearchReply([]),
    (c) => (c.url === "https://api.firecrawl.dev/v2/search" ? { status: 402, body: { error: "Insufficient credits" } } : undefined),
  );
  const { text, isError } = await runSearch({ query: "anything at all" });
  assert.equal(isError, false);
  assert.match(text, /Title A/);
  assert.match(text, /Firecrawl unavailable: Firecrawl is out of credit\./);
});

test("discussion searches ask Firecrawl for Reddit, and site filters are passed on", async () => {
  await setSecret("FIRECRAWL_API_KEY", "fc-test-key");
  mockNetwork(exaSearchReply([]), parallelSearchReply([]), firecrawlSearchReply([]));
  await runSearch({ query: "simpler alternative to Notion", type: "discussions" });
  assert.equal(calls.find((c) => c.url.includes("firecrawl"))!.body.query, "simpler alternative to Notion reddit");
  mockNetwork(exaSearchReply([]), parallelSearchReply([]), firecrawlSearchReply([]));
  await runSearch({ query: "voice memo shortcut", sites: ["apple.com", "reddit.com"], exclude_sites: ["pinterest.com"] });
  const body = calls.find((c) => c.url.includes("firecrawl"))!.body;
  assert.equal(body.query, "voice memo shortcut");
  assert.deepEqual(body.includeDomains, ["apple.com", "reddit.com"]);
  assert.equal(body.excludeDomains, undefined);
});

test("each engine's top result keeps a place in the merged list", async () => {
  await setSecret("FIRECRAWL_API_KEY", "fc-test-key");
  const shared = [1, 2, 3].map((i) => `https://agree${i}.com/`);
  mockNetwork(
    exaSearchReply(shared.map((u, i) => exaResult(u, `Agreed page ${i}`, "Fact."))),
    parallelSearchReply(shared.map((u, i) => parallelResult(u, `Agreed page ${i}`, "Fact."))),
    firecrawlSearchReply([{ url: "https://www.reddit.com/r/x/comments/9/best", title: "Best one : r/x", description: "People recommend this." }]),
  );
  const { text } = await runSearch({ query: "best simple notes app", max_results: 3 });
  assert.equal((text.match(/^\[\d+\]/gm) ?? []).length, 3);
  assert.match(text, /Best one : r\/x/);
});

test("differing copies of one page: the newer passage leads and the other is shown", async () => {
  mockNetwork(
    exaSearchReply([exaResult("https://shop.example.com/pricing", "Pricing", "Old table: $5 per 1k requests for search, valid for 1 to 25 results in every plan we offer.", "2025-01-10")]),
    parallelSearchReply([parallelResult("https://shop.example.com/pricing", "Pricing", "Current table: $7 per 1k requests for search, covering up to 10 results per request.", "2026-09-25")]),
  );
  const { text } = await runSearch({ query: "search API price" });
  assert.match(text, /\(2026-09-25\)\nhttps:\/\/shop\.example\.com\/pricing\nCurrent table: \$7/);
  assert.match(text, /Another copy of this page says: Old table: \$5/);
});

test("shopping searches weight Firecrawl highest", async () => {
  await setSecret("FIRECRAWL_API_KEY", "fc-test-key");
  mockNetwork(
    exaSearchReply([exaResult("https://us-shop.com/cable", "US cable", "In stock.")]),
    parallelSearchReply([parallelResult("https://ae-shop.com/cable", "UAE cable", "In stock.")]),
    firecrawlSearchReply([{ url: "https://www.amazon.co.uk/cable", title: "UK cable", description: "£9.99" }]),
  );
  const { text } = await runSearch({ query: "0.2m right angle usb-c cable", type: "shopping", country: "GB" });
  assert.match(text, /^\[1\] UK cable/m);
});

test("a busy Firecrawl search is tried once more", async () => {
  await setSecret("FIRECRAWL_API_KEY", "fc-test-key");
  let tries = 0;
  mockNetwork(exaSearchReply([exaResult("https://a.com/x", "Title A", "Fact A")]), parallelSearchReply([]), (c) => {
    if (c.url !== "https://api.firecrawl.dev/v2/search") return undefined;
    tries++;
    return tries === 1
      ? { status: 429, body: { error: "Rate limit exceeded" } }
      : { body: { success: true, data: { web: [{ url: "https://b.com/y", title: "Title B", description: "Fact B" }] }, creditsUsed: 2 } };
  });
  const { text } = await runSearch({ query: "anything at all" });
  assert.equal(tries, 2);
  assert.match(text, /Title B/);
  assert.doesNotMatch(text, /Firecrawl unavailable/);
});

test("leading dates in search snippets become the page date", () => {
  assert.deepEqual(leadingDate("18 Jan 2026 · Text"), { date: "2026-01-18", text: "Text" });
  assert.deepEqual(leadingDate("Sept 3, 2025 — Text"), { date: "2025-09-03", text: "Text" });
  assert.deepEqual(leadingDate("No date here"), { text: "No date here" });
});

test("Reddit threads are rebuilt from the .json address with comments", async () => {
  const thread = [
    { data: { children: [{ data: { title: "Boolean shading fix?", selftext: "Weird edges", author: "op", score: 12, subreddit: "blenderhelp", num_comments: 2, created_utc: 1780000000 } }] } },
    {
      data: {
        children: [
          { kind: "t1", data: { author: "helper", score: 40, body: "Add a Weighted Normal modifier.", replies: "" } },
          { kind: "t1", data: { author: "other", score: 3, body: "Try auto smooth.", replies: "" } },
        ],
      },
    },
  ];
  mockNetwork((c) =>
    c.url === "https://api.parallel.ai/v1/extract"
      ? { body: { results: [{ url: c.body.urls[0], title: "", excerpts: [], full_content: JSON.stringify(thread) }], errors: [] } }
      : undefined,
  );
  const { text } = await runFetch({ urls: ["https://old.reddit.com/r/blenderhelp/comments/abc/boolean_shading/?utm=1"] });
  assert.equal(calls[0].body.urls[0], "https://www.reddit.com/r/blenderhelp/comments/abc/boolean_shading/.json");
  assert.match(text, /\[40\] helper: Add a Weighted Normal modifier\./);
  assert.ok(text.indexOf("helper") < text.indexOf("other"));
  assert.ok(formatRedditJson("not json", 1000) === null);
});

test("verify gathers evidence per claim from different websites", async () => {
  mockNetwork(
    exaSearchReply([exaResult("https://blender.org/download", "Download", "Blender 5.2.2 LTS", "2026-09-15"), exaResult("https://blender.org/news", "News", "5.2 released")]),
    parallelSearchReply([parallelResult("https://www.blendernation.com/x", "BlenderNation", "Blender 5.2 is out")]),
  );
  const { text } = await runVerify({ claims: ["Blender 5.2.2 is the latest LTS release"] });
  assert.match(text, /Claim 1: Blender 5\.2\.2/);
  assert.match(text, /\[1\.1\]/);
  assert.match(text, /Separate websites: 2/);
});

test("research returns a run_id while running, then the cited report", async () => {
  let polls = 0;
  mockNetwork((c) => {
    if (c.url === "https://api.exa.ai/agent/runs" && c.method === "POST") return { body: { id: "agent_run_1", status: "queued" } };
    if (c.url === "https://api.exa.ai/agent/runs/agent_run_1") {
      polls++;
      return {
        body:
          polls < 3
            ? { id: "agent_run_1", status: "running" }
            : {
                id: "agent_run_1",
                status: "completed",
                stopReason: "schema_satisfied",
                output: { text: "The answer is 42.", grounding: [{ field: "output", citations: [{ url: "https://src.com/a", title: "Source A" }], confidence: "high" }] },
                costDollars: { total: 0.1 },
              },
      };
    }
    return undefined;
  });
  const first = await runResearch({ task: "What is the answer?", effort: "quick" });
  assert.match(first.text, /run_id="exa:agent_run_1"/);
  assert.equal(calls[0].body.effort, "low");
  const second = await runResearch({ run_id: "exa:agent_run_1" });
  assert.match(second.text, /The answer is 42\./);
  assert.match(second.text, /\[1\] Source A https:\/\/src\.com\/a \(confidence: high\)/);
});

test("every tool reply ends with the Exa and Parallel cost of that call", async () => {
  mockNetwork(
    (c) =>
      c.url === "https://api.exa.ai/search"
        ? { body: { results: [exaResult("https://a.com/1", "Page one", "Fact one.")], costDollars: { total: 0.007 } } }
        : undefined,
    parallelSearchReply(Array.from({ length: 12 }, (_, i) => parallelResult(`https://p${i}.com/`, `Result ${i}`, "Text."))),
  );
  const { text, isError } = await callTool("search", { query: "how the thing works", depth: "thorough" });
  assert.equal(isError, false);
  const mode = calls.find((c) => c.url.includes("parallel.ai"))!.body.mode;
  const parallel = (mode === "basic" || mode === "advanced" ? 0.005 : 0.001) + 2 * 0.001;
  const total = 0.007 + parallel;
  assert.match(text, new RegExp(`Search cost of this call: \\$${total.toFixed(total < 0.01 ? 4 : 3)} \\(Exa \\$0\\.0070, Parallel \\$${parallel.toFixed(parallel < 0.01 ? 4 : 3)}\\)$`));
});

test("a failed call still reports its cost line", async () => {
  await freshStore(false);
  mockNetwork();
  const { text } = await callTool("search", { query: "anything" });
  assert.match(text, /Search cost of this call: \$0\.000 \(Exa \$0\.000, Parallel \$0\.000\)$/);
});

test("search and fetch show the author when the engine gives one", async () => {
  mockNetwork(
    exaSearchReply([
      { ...exaResult("https://journal.example/a", "Four-day week trial results", "Productivity held steady.", "2025-03-01"), author: "Smith, Jane; Patel, Ravi" },
      { ...exaResult("https://site.example/b", "No byline here", "Some text."), author: "https://site.example/staff" },
    ]),
    parallelSearchReply([]),
  );
  const { text } = await runSearch({ query: "four-day week trial" });
  assert.match(text, /Four-day week trial results \(2025-03-01\) · by Smith, Jane; Patel, Ravi/);
  assert.doesNotMatch(text, /by https:/);

  mockNetwork((c) =>
    c.url === "https://api.exa.ai/contents"
      ? {
          body: {
            results: [{ url: "https://news.example/c", title: "Trial ends", author: "By Alex Brown", publishedDate: "2025-04-02T00:00:00.000Z", highlights: ["A long relevant passage. ".repeat(20)] }],
            statuses: [{ id: "https://news.example/c", status: "success" }],
          },
        }
      : undefined,
  );
  const read = await runFetch({ urls: ["https://news.example/c"], question: "what happened" });
  assert.match(read.text, /https:\/\/news\.example\/c · published 2025-04-02 · by Alex Brown/);
});

test("paper results list every author, and very large author lists say where the rest are", async () => {
  const names = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `Author ${i + 1}` }));
  assert.equal(
    entityFacts({ type: "publication", properties: { authors: names(7), year: 2025, doi: "10.1/x" } }),
    "Authors: Author 1, Author 2, Author 3, Author 4, Author 5, Author 6, Author 7 · Year: 2025 · DOI: 10.1/x",
  );
  assert.match(entityFacts({ type: "publication", properties: { authors: names(53) } })!, /Author 50 and 3 more \(full list on the paper's page\)$/);
});

const apifyReply = (byActor: Record<string, unknown[]>) => (c: { url: string }) => {
  const m = /api\.apify\.com\/v2\/acts\/([^/]+)\/run-sync-get-dataset-items/.exec(c.url);
  return m ? { body: byActor[decodeURIComponent(m[1])] ?? [] } : undefined;
};

test("jobs searches add the job boards when an Apify token is set", async () => {
  await setSecret("APIFY_API_TOKEN", "apify-test-token");
  mockNetwork(
    exaSearchReply([exaResult("https://careers.acme.com/designer", "Product Designer at Acme", "Join our team.")]),
    apifyReply({
      "curious_coder~linkedin-jobs-scraper": [
        {
          id: "123",
          link: "https://www.linkedin.com/jobs/view/designer-123?trk=x",
          title: "Junior Product Designer",
          companyName: "Beta Ltd",
          location: "London, England, United Kingdom",
          salaryInfo: ["£30,000", "£35,000"],
          postedAt: "2026-10-05",
          applicantsCount: "45",
          descriptionText: "Design things for people.",
        },
      ],
      "valig~indeed-jobs-scraper": [
        {
          url: "https://uk.indeed.com/viewjob?jk=abc",
          title: "Product Designer",
          employer: { name: "Gamma" },
          location: { city: "London", countryName: "United Kingdom" },
          baseSalary: { min: 40000, max: 45000, currencyCode: "GBP", unitOfWork: "YEAR" },
          datePublished: "2026-10-01T05:00:00.000Z",
          description: { text: "Indeed advert text." },
        },
      ],
      "valig~glassdoor-jobs-scraper": [
        {
          seoUrl: "https://www.glassdoor.co.uk/job-listing/x?jl=9",
          title: "UX Designer",
          employer: { name: "Delta" },
          location: { name: "London" },
          ageInDays: 2,
          rating: 4.1,
          description: "<p>Glassdoor <b>advert</b></p><p>Second paragraph.</p>",
        },
      ],
      "blackfalcondata~totaljobs-scraper": [
        {
          url: "https://www.totaljobs.com/job/designer/epsilon-job1",
          title: "Graduate Designer",
          company: "Epsilon",
          location: "London",
          datePosted: "2026-10-08",
          unifiedSalary: { min: 28000, max: 28000, currency: "GBP", period: "YEAR", salaryAvailable: true },
          description: "Totaljobs advert text.",
        },
      ],
    }),
  );
  const { text, isError } = await runSearch({ query: "junior product designer jobs in London", type: "jobs", max_results: 10 });
  assert.equal(isError, false, text);
  const apifyCalls = calls.filter((c) => c.url.includes("api.apify.com"));
  assert.equal(apifyCalls.length, 4);
  for (const c of apifyCalls) assert.equal(c.headers.authorization, "Bearer apify-test-token");
  const li = apifyCalls.find((c) => c.url.includes("linkedin"))!;
  assert.equal(li.body.keywords, "junior product designer");
  assert.equal(li.body.location, "London, United Kingdom");
  assert.equal(li.body.datePosted, "pastMonth");
  assert.match(li.url, /maxItems=10/);
  const indeed = apifyCalls.find((c) => c.url.includes("indeed"))!;
  assert.equal(indeed.body.country, "uk");
  assert.equal(indeed.body.location, "London");
  assert.equal(indeed.body.datePosted, "");
  assert.equal(apifyCalls.find((c) => c.url.includes("totaljobs"))!.body.query, "junior-product-designer");
  assert.match(text, /https:\/\/www\.linkedin\.com\/jobs\/view\/123\n/);
  assert.match(text, /LinkedIn · London, England, United Kingdom · £30,000–£35,000 · 45 applicants/);
  assert.match(text, /Indeed · London, United Kingdom · £40,000–£45,000 a year/);
  assert.match(text, /Glassdoor advert\nSecond paragraph\./);
  assert.match(text, /Totaljobs · London · £28,000 a year/);
  assert.match(text, /careers\.acme\.com/);
});

test("job boards are skipped without a token, at fast depth, and outside their country", async () => {
  mockNetwork(exaSearchReply([exaResult("https://careers.acme.com/designer", "Designer", "Join us.")]));
  await runSearch({ query: "designer", type: "jobs" });
  assert.ok(calls.every((c) => !c.url.includes("apify")));

  await setSecret("APIFY_API_TOKEN", "apify-test-token");
  mockNetwork(exaSearchReply([]), apifyReply({}));
  await runSearch({ query: "designer", type: "jobs", depth: "fast" });
  assert.ok(calls.every((c) => !c.url.includes("apify")));

  mockNetwork(exaSearchReply([]), apifyReply({}));
  await runSearch({ query: "designer", type: "jobs", country: "US" });
  const actors = calls.filter((c) => c.url.includes("apify")).map((c) => c.url);
  assert.equal(actors.length, 3);
  assert.ok(actors.every((u) => !u.includes("totaljobs")));

  mockNetwork(exaSearchReply([]), apifyReply({}));
  await runSearch({ query: "designer", type: "jobs", sites: ["linkedin.com"] });
  assert.deepEqual(
    calls.filter((c) => c.url.includes("apify")).map((c) => /acts\/([^/]+)/.exec(c.url)![1]),
    ["curious_coder~linkedin-jobs-scraper"],
  );
});

test("a failing job board adds a note and the others still answer", async () => {
  await setSecret("APIFY_API_TOKEN", "apify-test-token");
  mockNetwork(
    exaSearchReply([exaResult("https://careers.acme.com/designer", "Designer at Acme", "Join us.")]),
    (c) => (c.url.includes("glassdoor") ? { status: 402, body: { error: { message: "not enough credit" } } } : undefined),
    apifyReply({}),
  );
  const { text, isError } = await runSearch({ query: "designer", type: "jobs" });
  assert.equal(isError, false);
  assert.match(text, /Glassdoor jobs unavailable: Glassdoor via Apify is out of credit\./);
  assert.match(text, /Designer at Acme/);
});

test("job queries are split into role and place", () => {
  assert.deepEqual(jobQuery("junior product designer jobs in London"), { role: "junior product designer", location: "London" });
  assert.deepEqual(jobQuery("data analyst roles near Milton Keynes"), { role: "data analyst", location: "Milton Keynes" });
  assert.deepEqual(jobQuery("remote UX researcher"), { role: "remote UX researcher", location: undefined });
  assert.deepEqual(jobQuery("nurse vacancies in Leeds", "Bradford"), { role: "nurse Leeds", location: "Bradford" });
  assert.deepEqual(jobQuery("nurse vacancies in Leeds", "Leeds"), { role: "nurse", location: "Leeds" });
});

test("salaries read naturally", () => {
  assert.equal(salary(30000, 35000, "GBP", "YEAR"), "£30,000–£35,000 a year");
  assert.equal(salary(15.5, null, "GBP", "HOUR"), "£15.5 an hour");
  assert.equal(salary(null, null, "GBP", "YEAR"), undefined);
});

const openalexWork = (doi: string, title: string, extra: Record<string, unknown> = {}) => ({
  id: `https://openalex.org/W${doi.length}`,
  doi: `https://doi.org/${doi}`,
  title,
  publication_date: "2024-03-01",
  type: "article",
  cited_by_count: 412,
  authorships: [{ author: { display_name: "Ada Lovelace" } }, { author: { display_name: "Alan Turing" } }],
  primary_location: { source: { display_name: "Nature" } },
  open_access: { is_oa: true, oa_url: "https://europepmc.org/free.pdf" },
  abstract_inverted_index: { We: [0], study: [1], search: [2], agents: [3] },
  ...extra,
});
const openalexReply = (results: unknown[], cost = 0.001) => (c: { url: string }) =>
  c.url.startsWith("https://api.openalex.org/works?") ? { body: { meta: { count: results.length, cost_usd: cost }, results } } : undefined;

test("papers searches that ask for OpenAlex add it, with citations and free full text", async () => {
  await setSecret("OPENALEX_API_KEY", "oa-test-key");
  mockNetwork(
    exaSearchReply([exaResult("https://arxiv.org/abs/2401.00001", "Search agents that read the whole web at once", "Exa passage", "2024-01-02")]),
    openalexReply([
      openalexWork("10.48550/arxiv.2401.00001", "Search agents that read the whole web at once"),
      openalexWork("10.1038/s41586-024-1", "A Nature paper Exa missed about search agents"),
    ]),
  );
  const result = await callTool("search", { query: "how well do search agents work", type: "papers", after: "2023-01-01", openalex: true });
  assert.equal(result.isError, false);
  const oa = calls.find((c) => c.url.startsWith("https://api.openalex.org/"))!;
  const params = new URL(oa.url).searchParams;
  assert.equal(params.get("search.semantic"), "how well do search agents work");
  assert.equal(params.get("filter"), "is_retracted:false,from_publication_date:2023-01-01");
  assert.equal(oa.headers.authorization, "Bearer oa-test-key");
  // The arXiv paper both found is shown once.
  assert.equal(result.text.match(/Search agents that read the whole web/g)!.length, 1);
  assert.match(result.text, /2 results/);
  assert.match(result.text, /Authors: Ada Lovelace, Alan Turing · In: Nature · Cited by 412 · DOI: 10\.1038\/s41586-024-1\nFree full text: https:\/\/europepmc\.org\/free\.pdf\nWe study search agents/);
  assert.match(result.text, /, OpenAlex \$0\.0010\)$/);
});

test("OpenAlex falls back to keyword search when semantic search is turned down", async () => {
  await setSecret("OPENALEX_API_KEY", "oa-test-key");
  mockNetwork(
    exaSearchReply([]),
    (c) => (c.url.includes("search.semantic=") ? { status: 400, body: { error: "bad request" } } : undefined),
    openalexReply([openalexWork("10.1/x", "Keyword match on transformer attention heads")]),
  );
  const { text } = await runSearch({ query: "What do transformer attention heads actually learn?", type: "papers", openalex: true });
  const last = new URL(calls.filter((c) => c.url.includes("openalex"))[1].url).searchParams;
  assert.ok(last.get("search"));
  assert.match(text, /Keyword match on transformer attention heads/);
});

test("OpenAlex is left out unless asked for, without a key, for other types and with a site list", async () => {
  mockNetwork(exaSearchReply([exaResult("https://a.org/p", "Paper", "x")]));
  const noKey = await runSearch({ query: "q", type: "papers", openalex: true });
  assert.match(noKey.text, /OpenAlex has no API key, so only Exa searched/);
  await setSecret("OPENALEX_API_KEY", "oa-test-key");
  await runSearch({ query: "q", type: "papers" });
  await runSearch({ query: "q", type: "papers", openalex: true, sites: ["arxiv.org"] });
  mockNetwork(exaSearchReply([]), parallelSearchReply([]));
  await runSearch({ query: "q", type: "web", openalex: true });
  assert.equal(calls.filter((c) => c.url.includes("openalex")).length, 0);
});

test("OpenAlex ranks above Exa when asked for", async () => {
  await setSecret("OPENALEX_API_KEY", "oa-test-key");
  mockNetwork(
    exaSearchReply([exaResult("https://blog.example.com/a", "A blog post about a paper", "x"), exaResult("https://b.org/p", "Second Exa page", "y")]),
    openalexReply([openalexWork("10.1/one", "OpenAlex top paper"), openalexWork("10.1/two", "OpenAlex second paper")]),
  );
  const { text } = await runSearch({ query: "q", type: "papers", openalex: true });
  const order = [...text.matchAll(/^\[\d+\] (.+?)(?: \(|$)/gm)].map((m) => m[1]);
  assert.deepEqual(order.slice(0, 3), ["OpenAlex top paper", "OpenAlex second paper", "A blog post about a paper"]);
  assert.match(text, /OpenAlex \(scholarly index\) ranked first, Exa second\./);
});

test("an OpenAlex failure leaves Exa's papers and adds a note", async () => {
  await setSecret("OPENALEX_API_KEY", "oa-test-key");
  mockNetwork(
    exaSearchReply([exaResult("https://a.org/p", "Exa paper", "x")]),
    (c) => (c.url.includes("openalex") ? { status: 429, body: { error: "Rate limit exceeded" } } : undefined),
  );
  const { text, isError } = await runSearch({ query: "q", type: "papers", openalex: true });
  assert.equal(isError, false);
  assert.match(text, /Exa paper/);
  assert.match(text, /OpenAlex unavailable: OpenAlex rate limit reached/);
});

test("OpenAlex abstracts are put back in word order", () => {
  assert.equal(rebuildAbstract({ world: [1], Hello: [0], again: [3], hello: [2] }), "Hello world hello again");
  assert.equal(rebuildAbstract(null), "");
});

const TEI = `<?xml version="1.0"?><TEI><teiHeader><fileDesc><titleStmt><title level="a" type="main">Cancellation flows &amp; dark patterns</title></titleStmt></fileDesc>
<profileDesc><abstract><div><p>We measured 4.9 clicks on average.</p></div></abstract></profileDesc></teiHeader>
<text><body><div><head n="1">Introduction</head><p>Effects were small (p &lt; 0.05 and n &gt; 300 <ref type="bibr">[3]</ref>).</p></div>
<div><head n="2">Method</head><p>We used 812 sites.</p></div></body><back><listBibl><biblStruct>Reference list text</biblStruct></listBibl></back></text></TEI>`;

// A one-page PDF saying "Hello full text".
const PDF = new TextEncoder().encode(`%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 100]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length 44>>stream
BT /F1 12 Tf 10 50 Td (Hello full text) Tj ET
endstream endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
trailer<</Root 1 0 R>>`);

const oaWorkLookup = (has: { pdf?: boolean; grobid_xml?: boolean }) => (c: { url: string }) =>
  /^https:\/\/api\.openalex\.org\/works\/(W\d+|doi:)/.test(c.url)
    ? { body: { id: "https://openalex.org/W42", doi: "https://doi.org/10.1/x", title: "Cancellation flows", publication_date: "2024-05-01", authorships: [{ author: { display_name: "Ada Lovelace" } }], has_content: has } }
    : undefined;

test("Grobid TEI XML becomes plain text with headings, without the reference list", () => {
  const { title, text } = teiToText(TEI);
  assert.equal(title, "Cancellation flows & dark patterns");
  assert.equal(text, "Abstract\n\nWe measured 4.9 clicks on average.\n\nIntroduction\n\nEffects were small (p < 0.05 and n > 300 [3]).\n\nMethod\n\nWe used 812 sites.");
});

test("OpenAlex addresses and DOIs are recognised", () => {
  assert.equal(openalexWorkId("https://openalex.org/W2741809807"), "W2741809807");
  assert.equal(openalexWorkId("https://api.openalex.org/works/w123"), "W123");
  assert.equal(openalexWorkId("https://content.openalex.org/works/W123.pdf"), "W123");
  assert.equal(openalexWorkId("https://example.com/W123"), null);
  assert.equal(doiOf("https://doi.org/10.1038/s41586-024-1"), "10.1038/s41586-024-1");
  assert.equal(doiOf("https://example.com/10.1/x"), null);
});

test("papers OpenAlex holds a copy of get a full-text link in search results", async () => {
  await setSecret("OPENALEX_API_KEY", "oa-test-key");
  mockNetwork(exaSearchReply([]), openalexReply([openalexWork("10.1/held", "Held paper", { id: "https://openalex.org/W77", has_content: { pdf: true, grobid_xml: true } })]));
  const { text } = await runSearch({ query: "q", type: "papers", openalex: true });
  assert.match(text, /Full text from OpenAlex \(fetch reads it, \$0\.01\): https:\/\/openalex\.org\/W77/);
  assert.ok(new URL(calls.find((c) => c.url.includes("openalex"))!.url).searchParams.get("select")!.includes("has_content"));
});

test("fetch reads an OpenAlex work from its TEI XML copy and counts the download", async () => {
  await setSecret("OPENALEX_API_KEY", "oa-test-key");
  mockNetwork(oaWorkLookup({ pdf: true, grobid_xml: true }), (c) =>
    c.url === "https://content.openalex.org/works/W42.grobid-xml" ? { raw: TEI, headers: { "x-ratelimit-cost-usd": "0.01" } } : undefined,
  );
  const result = await callTool("fetch", { urls: ["https://openalex.org/W42"] });
  assert.equal(result.isError, false);
  assert.match(result.text, /## Cancellation flows\nhttps:\/\/openalex\.org\/W42 · published 2024-05-01 · by Ada Lovelace/);
  assert.match(result.text, /p < 0\.05 and n > 300/);
  assert.match(result.text, /\[Full text from OpenAlex's TEI XML copy\.\]/);
  assert.match(result.text, /OpenAlex \$0\.010\)$/);
  const download = calls.find((c) => c.url.startsWith("https://content.openalex.org/"))!;
  assert.equal(download.headers.authorization, "Bearer oa-test-key");
  // Nothing else was asked to read it.
  assert.equal(calls.filter((c) => /exa|parallel|firecrawl/.test(c.url)).length, 0);
});

test("fetch reads the PDF copy when OpenAlex has no TEI XML", async () => {
  await setSecret("OPENALEX_API_KEY", "oa-test-key");
  mockNetwork(oaWorkLookup({ pdf: true, grobid_xml: false }), (c) =>
    c.url === "https://content.openalex.org/works/W42.pdf" ? { raw: PDF, headers: { "content-type": "application/pdf" } } : undefined,
  );
  const { text, isError } = await runFetch({ urls: ["https://openalex.org/W42"] });
  assert.equal(isError, false);
  assert.match(text, /Hello full text/);
  assert.match(text, /OpenAlex's PDF copy/);
});

test("DOI links use OpenAlex's copy only when asked, and fall back to the usual readers", async () => {
  await setSecret("OPENALEX_API_KEY", "oa-test-key");
  const exaContents = (c: { url: string }) =>
    c.url === "https://api.exa.ai/contents"
      ? { body: { results: [{ url: "https://doi.org/10.1234/x", title: "Publisher page", highlights: ["The publisher's abstract page. ".repeat(20)] }], statuses: [{ id: "https://doi.org/10.1234/x", status: "success" }] } }
      : undefined;
  // Not asked: OpenAlex is never called.
  mockNetwork(exaContents);
  await runFetch({ urls: ["https://doi.org/10.1234/x"], question: "how many clicks" });
  assert.equal(calls.filter((c) => c.url.includes("openalex")).length, 0);
  // Asked, but OpenAlex has no copy: Exa reads it.
  mockNetwork(oaWorkLookup({ pdf: false, grobid_xml: false }), exaContents);
  const { text } = await runFetch({ urls: ["https://doi.org/10.1234/x"], question: "how many clicks", openalex: true });
  assert.ok(calls.some((c) => c.url.startsWith("https://api.openalex.org/works/doi:10.1234/x?")), calls.map((c) => c.url).join(" "));
  assert.match(text, /The publisher's abstract page/);
  assert.equal(calls.filter((c) => c.url.startsWith("https://content.openalex.org/")).length, 0);
});

test("an OpenAlex link without a key says why it can't be read", async () => {
  mockNetwork();
  const { text, isError } = await runFetch({ urls: ["https://openalex.org/W42"] });
  assert.equal(isError, true);
  assert.match(text, /OpenAlex has no API key, so its full-text copies can't be read/);
  assert.equal(calls.length, 0);
});

test("log_issue saves one JSON file per report under a dated folder, with no cost line", async () => {
  const saved: { path: string; body: string }[] = [];
  useIssueWriter(async (path, body) => {
    saved.push({ path, body });
  });
  try {
    const result = await callTool("log_issue", {
      skill: "uni-search",
      mode: "Research",
      summary: "Evidence on dark patterns",
      issues: [{ tool: "fetch", problem: "Exa rejected the API key.", detail: "urls: https://a.org" }, { problem: "" }],
    });
    assert.equal(result.isError, false);
    assert.match(result.text, /^Logged 1 issue as /);
    assert.doesNotMatch(result.text, /Search cost/);
    assert.equal(saved.length, 1);
    assert.match(saved[0].path, /^search-connector\/issues\/\d{4}-\d{2}-\d{2}\/\d{4}-\d{2}-\d{2}T[\d-]+Z-[0-9a-f]{8}\.json$/);
    const record = JSON.parse(saved[0].body);
    assert.equal(record.skill, "uni-search");
    assert.deepEqual(record.issues, [{ tool: "fetch", problem: "Exa rejected the API key.", detail: "urls: https://a.org" }]);
    const empty = await callTool("log_issue", { skill: "uni-search", issues: [] });
    assert.equal(empty.isError, true);
    // search-report saves its whole report as a Markdown file beside the entry.
    saved.length = 0;
    const withReport = await callTool("log_issue", { skill: "search-report", mode: "uni-search", issues: [], report: "# Search report\n\n1. Summary" });
    assert.equal(withReport.isError, false);
    assert.match(withReport.text, /^Logged 0 issues and the report as .+ \(report: search-connector\/issues\/.+\.md\)\.$/);
    assert.deepEqual(saved.map((f) => f.path.slice(-3)), [".md", "son"]);
    assert.equal(saved[0].body, "# Search report\n\n1. Summary");
    assert.equal(JSON.parse(saved[1].body).report, saved[0].path);
    const tooLong = await callTool("log_issue", { skill: "search-report", report: "x".repeat(200_001) });
    assert.match(tooLong.text, /longer than 200,000 characters/);
  } finally {
    useIssueWriter(null);
  }
  const noStore = await callTool("log_issue", { skill: "better-search", issues: [{ problem: "x" }] });
  assert.match(noStore.text, /no Supabase log or Vercel Blob store is connected/);
});

test("with a Supabase log, each call is recorded with its engine requests and the reply gives its ref", async () => {
  const rows: { table: string; row: any }[] = [];
  useRowWriter(async (table, row) => {
    rows.push({ table, row });
  });
  try {
    mockNetwork(
      exaSearchReply([exaResult("https://a.com/1", "Page one", "Fact one.")]),
      (c) => (c.url === "https://api.parallel.ai/v1/search" ? { status: 429, body: { error: { message: "Too many requests" } } } : undefined),
    );
    const { text } = await callTool("search", { query: "how the thing works", country: "GB" });
    const ref = text.match(/ · ref ([0-9a-f]{8})$/)?.[1];
    assert.ok(ref, text.slice(-200));
    assert.equal(rows.length, 1);
    const { table, row } = rows[0];
    assert.equal(table, "search_calls");
    assert.equal(row.ref, ref);
    assert.equal(row.tool, "search");
    assert.deepEqual(row.input, { query: "how the thing works", country: "GB" });
    const exa = row.steps.find((s: any) => s.engine === "Exa");
    const parallel = row.steps.find((s: any) => s.engine === "Parallel");
    assert.equal(exa.purpose, "search");
    assert.equal(exa.endpoint, "/search");
    assert.equal(exa.results, 1);
    assert.equal(typeof exa.settings.query, "string");
    assert.equal(parallel.status, 429);
    assert.match(parallel.error, /Too many requests/);
    // API keys never reach the log.
    assert.doesNotMatch(JSON.stringify(row), /test-key/);
    assert.equal(row.outcome.error, false);

    // log_issue goes to search_issues, with the run's context and the refs.
    rows.length = 0;
    const logged = await callTool("log_issue", {
      skill: "better-search",
      mode: "Auto",
      app: "chat",
      question: "Is the thing any good?",
      follow_up: true,
      earlier_questions: ["What is the thing?"],
      outcome: "partial",
      issues: [{ tool: "search", problem: "Parallel rate limit reached.", ref, recovered: true }],
    });
    assert.equal(logged.isError, false);
    assert.match(logged.text, /^Logged 1 issue as \S+\.$/);
    const issue = rows[0].row;
    assert.equal(rows[0].table, "search_issues");
    assert.deepEqual(issue.refs, [ref]);
    assert.deepEqual(issue.earlier_questions, ["What is the thing?"]);
    assert.equal(issue.outcome, "partial");
    assert.deepEqual(issue.setup.engines_set, ["Exa", "Parallel"]);
  } finally {
    useRowWriter(undefined);
  }
});

test("log_issue falls back to the Blob store when Supabase refuses the row", async () => {
  const saved: string[] = [];
  useRowWriter(async () => {
    throw new Error("Supabase 401: bad key");
  });
  useIssueWriter(async (path) => {
    saved.push(path);
  });
  try {
    const result = await callTool("log_issue", { skill: "uni-search", question: "q", issues: [{ problem: "x" }] });
    assert.equal(result.isError, false);
    assert.equal(saved.length, 1);
  } finally {
    useRowWriter(undefined);
    useIssueWriter(null);
  }
});

const tinyfishFetchReply = (pages: Record<string, { text?: string; title?: string; error?: string }>) => (c: { url: string; body: any }) => {
  if (c.url !== "https://api.fetch.tinyfish.ai") return undefined;
  const results: unknown[] = [];
  const errors: unknown[] = [];
  for (const u of c.body.urls as string[]) {
    const page = pages[u];
    if (!page || page.error) errors.push({ url: u, error: page?.error ?? "bot_blocked" });
    else results.push({ url: u, final_url: u, title: page.title ?? null, author: null, published_date: "2026-09-30T10:00:00Z", text: page.text ?? "" });
  }
  return { body: { results, errors } };
};

test("with a TinyFish key, TinyFish reads first (PDFs too), then Firecrawl, then Exa", async () => {
  await setSecret("TINYFISH_API_KEY", "tf-test-key");
  await setSecret("FIRECRAWL_API_KEY", "fc-test-key");
  mockNetwork(
    tinyfishFetchReply({
      "https://good.com/a": { title: "Good", text: "TinyFish read this page in full. ".repeat(20) },
      "https://example.com/paper.pdf": { title: "Paper", text: "TinyFish read the PDF. ".repeat(20) },
      "https://blocked.com/b": { error: "bot_blocked" },
      "https://gone.com/c": { error: "page_not_found" },
    }),
    firecrawlReply({ "https://blocked.com/b": { title: "Blocked", markdown: "Firecrawl got past the block. ".repeat(20) } }),
    (c) =>
      c.url === "https://api.exa.ai/contents"
        ? { body: { results: c.body.urls.map((u: string) => ({ url: u, title: "Exa", text: `Exa read ${u}. `.repeat(20) })) } }
        : undefined,
  );
  const result = await callTool("fetch", {
    urls: ["https://good.com/a", "https://example.com/paper.pdf", "https://blocked.com/b", "https://gone.com/c", "https://www.youtube.com/watch?v=1"],
    fresh: true,
  });
  assert.equal(result.isError, false);
  assert.match(result.text, /TinyFish read this page in full/);
  assert.match(result.text, /published 2026-09-30/);
  assert.match(result.text, /TinyFish read the PDF/);
  assert.match(result.text, /Firecrawl got past the block/);
  assert.match(result.text, /Exa read https:\/\/gone\.com\/c/);
  assert.match(result.text, /Exa read https:\/\/www\.youtube\.com/);
  const tf = calls.find((c) => c.url === "https://api.fetch.tinyfish.ai")!;
  assert.equal(tf.headers["x-api-key"], "tf-test-key");
  assert.equal(tf.body.ttl, 0);
  assert.deepEqual(tf.body.urls.sort(), ["https://blocked.com/b", "https://example.com/paper.pdf", "https://gone.com/c", "https://good.com/a"]);
  assert.deepEqual(calls.filter((c) => c.url.includes("firecrawl")).map((c) => c.body.url).sort(), ["https://blocked.com/b", "https://gone.com/c"]);
  assert.match(result.text, /TinyFish free \(2 pages\)\)$/);
});

test("a used-up TinyFish allowance is reported and the others read instead", async () => {
  await setSecret("TINYFISH_API_KEY", "tf-test-key");
  mockNetwork(
    (c) =>
      c.url === "https://api.fetch.tinyfish.ai"
        ? { status: 402, body: { error: { code: "FREE_ALLOWANCE_EXHAUSTED", message: "Daily free allowance used" } } }
        : undefined,
    (c) =>
      c.url === "https://api.exa.ai/contents"
        ? { body: { results: c.body.urls.map((u: string) => ({ url: u, title: "Exa", text: "Exa read the page. ".repeat(20) })) } }
        : undefined,
  );
  const { text, isError } = await runFetch({ urls: ["https://a.com/1", "https://b.com/2"] });
  assert.equal(isError, false);
  assert.match(text, /TinyFish is out of credit\. Exa and Parallel read the pages instead\./);
  assert.equal(calls.find((c) => c.url === "https://api.exa.ai/contents")?.body.urls.length, 2);
});

const tinyfishSearchReply = (items: { url: string; title: string; snippet?: string; date?: string }[]) => (c: { url: string }) =>
  c.url.startsWith("https://api.search.tinyfish.ai") ? { body: { query: "q", results: items, total_results: items.length, page: 0 } } : undefined;

test("with a TinyFish key, searches use TinyFish for the Google-style second opinion instead of Firecrawl", async () => {
  await setSecret("TINYFISH_API_KEY", "tf-test-key");
  await setSecret("FIRECRAWL_API_KEY", "fc-test-key");
  mockNetwork(
    exaSearchReply([exaResult("https://docs.example.com/answer", "Official answer", "The documented rule.")]),
    parallelSearchReply([]),
    tinyfishSearchReply([
      { url: "https://www.reddit.com/r/thing/comments/1/how", title: "How I fixed it : r/thing", snippet: "30 Sept 2026 — It worked once I changed the setting. Read more" },
    ]),
    firecrawlSearchReply([]),
  );
  const { text, isError } = await callTool("search", { query: "how do I fix the thing", country: "uk", sites: ["reddit.com"], after: "2026-01-01", goal: "First-hand fixes" });
  assert.equal(isError, false);
  const tf = new URL(calls.find((c) => c.url.startsWith("https://api.search.tinyfish.ai"))!.url);
  assert.equal(tf.searchParams.get("location"), "GB");
  assert.equal(tf.searchParams.get("include_domains"), "reddit.com");
  assert.equal(tf.searchParams.get("after_date"), "2026-01-01");
  assert.equal(tf.searchParams.get("purpose"), "First-hand fixes");
  assert.match(text, /How I fixed it : r\/thing \(2026-09-30\)/);
  assert.match(text, /\nIt worked once I changed the setting\.\n/);
  assert.equal(calls.filter((c) => c.url.includes("firecrawl")).length, 0);
  assert.match(text, /TinyFish free \(1 search\)\)$/);
});

test("a failed TinyFish search falls back to Firecrawl and says so", async () => {
  await setSecret("TINYFISH_API_KEY", "tf-test-key");
  await setSecret("FIRECRAWL_API_KEY", "fc-test-key");
  mockNetwork(
    exaSearchReply([exaResult("https://news.example.com/1", "Only story", "One fact.", "2026-10-01")]),
    parallelSearchReply([]),
    (c) => (c.url.startsWith("https://api.search.tinyfish.ai") ? { status: 429, body: { error: { code: "RATE_LIMIT_EXCEEDED", message: "Too many" } } } : undefined),
    firecrawlSearchReply([{ url: "https://paper.example.co.uk/2", title: "Second story", snippet: "Another view.", date: "2026-10-02" } as never], true),
  );
  const { text } = await runSearch({ query: "council decision on the bridge", type: "news" });
  const tf = new URL(calls.find((c) => c.url.startsWith("https://api.search.tinyfish.ai"))!.url);
  assert.equal(tf.searchParams.get("domain_type"), "news");
  assert.match(text, /TinyFish unavailable: TinyFish rate limit reached\. Try again shortly\. Firecrawl searched instead\./);
  assert.match(text, /Firecrawl searched as well/);
  assert.match(text, /Second story/);
});
