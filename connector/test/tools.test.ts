import { strict as assert } from "node:assert";
import { after, beforeEach, test } from "node:test";
import { calls, exaResult, freshStore, mockNetwork, parallelResult, restoreNetwork } from "./helpers.js";
import { entityFacts } from "../lib/engines/exa.js";
import { leadingDate } from "../lib/engines/firecrawl.js";
import { runSearch } from "../lib/tools/search.js";
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
