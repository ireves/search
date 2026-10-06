import { strict as assert } from "node:assert";
import { after, beforeEach, test } from "node:test";
import { calls, exaResult, freshStore, mockNetwork, parallelResult, restoreNetwork } from "./helpers.js";
import { runSearch } from "../lib/tools/search.js";
import { runFetch, formatRedditJson } from "../lib/tools/fetch.js";
import { runVerify } from "../lib/tools/verify.js";
import { runResearch } from "../lib/tools/research.js";
import { callTool } from "../lib/mcp.js";

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
