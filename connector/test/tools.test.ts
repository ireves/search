import { strict as assert } from "node:assert";
import { after, beforeEach, test } from "node:test";
import { calls, exaResult, freshStore, mockNetwork, parallelResult, restoreNetwork } from "./helpers.js";
import { runSearch } from "../lib/tools/search.js";
import { runFetch, formatRedditJson } from "../lib/tools/fetch.js";
import { runVerify } from "../lib/tools/verify.js";
import { runResearch } from "../lib/tools/research.js";

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
  assert.equal(exaCall.body.contents.highlights.maxCharacters, 800);
  assert.equal(exaCall.body.numResults, 10);
  const parCall = calls.find((c) => c.url.includes("parallel.ai"))!;
  assert.equal(parCall.body.mode, "advanced");
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

test("quick research returns Parallel's cited answer with its numbered sources", async () => {
  mockNetwork((c) =>
    c.url === "https://api.parallel.ai/v1/responses"
      ? {
          body: {
            output: [
              { type: "web_search_call", action: { type: "search", queries: ["q"] } },
              { type: "web_search_call", action: { type: "open_page", url: "https://gov.uk/a" } },
              {
                type: "message",
                content: [
                  {
                    text: JSON.stringify({
                      answer: "The grant is £7,500 [2]. See [the guide](https://gov.uk/a).",
                      sources: [
                        { n: 1, url: "https://blog.example/x", title: "Blog" },
                        { n: 2, url: "https://gov.uk/a", title: "GOV.UK" },
                      ],
                    }),
                  },
                ],
              },
            ],
          },
        }
      : undefined,
  );
  const { text, isError } = await runResearch({ task: "How much is the heat pump grant?", effort: "quick" });
  assert.equal(isError, false);
  assert.equal(calls[0].body.reasoning.effort, "low");
  assert.equal(calls[0].body.text.format.type, "json_schema");
  assert.match(text, /1 searches, 1 pages read/);
  assert.match(text, /The grant is £7,500 \[2\]\. See the guide \(https:\/\/gov\.uk\/a\)\./);
  assert.match(text, /\[2\] GOV\.UK https:\/\/gov\.uk\/a/);
});

test("research falls back to Exa Agent, returns a run_id while running, then the report", async () => {
  let polls = 0;
  mockNetwork((c) => {
    if (c.url === "https://api.parallel.ai/v1/responses") return { status: 500, body: { error: { message: "down" } } };
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
  assert.match(first.text, /Parallel research failed/);
  assert.match(first.text, /run_id="exa:agent_run_1"/);
  const start = calls.find((c) => c.url === "https://api.exa.ai/agent/runs")!;
  assert.equal(start.body.effort, "low");
  assert.match(start.body.systemPrompt, /language of the task/);
  const second = await runResearch({ run_id: "exa:agent_run_1" });
  assert.match(second.text, /The answer is 42\./);
  assert.match(second.text, /\[1\] Source A https:\/\/src\.com\/a \(confidence: high\)/);
});

test("deep research runs Exa Agent (medium) and a Parallel pro task side by side", async () => {
  mockNetwork((c) => {
    if (c.url === "https://api.exa.ai/agent/runs" && c.method === "POST") return { body: { id: "run_e", status: "queued" } };
    if (c.url.startsWith("https://api.exa.ai/agent/runs/run_e")) return { body: { id: "run_e", status: "running" } };
    if (c.url === "https://api.parallel.ai/v1/tasks/runs") return { body: { run_id: "run_p", status: "queued" } };
    if (c.url.startsWith("https://api.parallel.ai/v1/tasks/runs/run_p/result"))
      return {
        body: {
          run: { run_id: "run_p", status: "completed" },
          output: { type: "text", content: "Report body [1].\n\n## References\n\n1. [  Official page\n](https://official.example/a)", basis: [] },
        },
      };
    return undefined;
  });
  const { text } = await runResearch({ task: "Deep question", effort: "deep" });
  assert.equal(calls.find((c) => c.url === "https://api.exa.ai/agent/runs")!.body.effort, "medium");
  assert.equal(calls.find((c) => c.url === "https://api.parallel.ai/v1/tasks/runs")!.body.processor, "pro");
  assert.match(text, /## References\n\n1\. Official page \(https:\/\/official\.example\/a\)/);
  assert.match(text, /run_id="exa:run_e"/);
});

test("people results show current roles from Exa's structured history", async () => {
  mockNetwork(
    exaSearchReply([
      {
        url: "https://linkedin.com/in/fs",
        title: "Francesco Siddi",
        highlights: ["Producer"],
        entities: [
          {
            type: "person",
            properties: {
              location: "Amsterdam",
              workHistory: [
                { title: "Chief Operating Officer", dates: { from: "2020-03-01", to: "2026-01-01" }, company: { id: null, name: "Blender" } },
                { title: "CEO", dates: { from: "2026-01-01", to: null }, company: { id: "x", name: "Blender" } },
              ],
              educationHistory: [{ degree: "BA", dates: { from: "2009", to: "2009" }, institution: { id: null, name: "Bilgi University" } }],
            },
          },
        ],
      },
    ]),
  );
  const { text } = await runSearch({ query: "Francesco Siddi Blender", type: "people" });
  assert.match(text, /Work: CEO at Blender \(2026-01 to now\); Chief Operating Officer at Blender \(2020-03 to 2026-01\)/);
  assert.match(text, /Education: BA, Bilgi University \(2009\)/);
  assert.doesNotMatch(text, /object Object/);
});

test("fetch reads live first and falls back to the stored copy; papers go stored first", async () => {
  mockNetwork((c) => {
    if (c.url !== "https://api.exa.ai/contents") return undefined;
    const live = c.body.maxAgeHours === 0;
    const url = c.body.urls[0];
    if (live) return { body: { results: [], statuses: [{ id: url, status: "error", error: { tag: "CRAWL_LIVECRAWL_TIMEOUT" } }] } };
    return { body: { results: [{ id: url, url, title: "Stored", text: "The stored page text. ".repeat(30) }], statuses: [{ id: url, status: "success", source: "cached" }] } };
  });
  const site = await runFetch({ urls: ["https://site.org/report"] });
  const siteCalls = calls.filter((c) => c.url === "https://api.exa.ai/contents");
  assert.deepEqual(siteCalls.map((c) => c.body.maxAgeHours), [0, undefined]);
  assert.match(site.text, /The stored page text/);

  const before = calls.length;
  const paper = await runFetch({ urls: ["https://dl.acm.org/doi/10.1145/3359183"] });
  const paperCalls = calls.slice(before).filter((c) => c.url === "https://api.exa.ai/contents");
  assert.deepEqual(paperCalls.map((c) => c.body.maxAgeHours), [undefined]);
  assert.match(paper.text, /The stored page text/);
});

test("fetch says when a publisher caps the text at 1,000 characters", async () => {
  mockNetwork((c) =>
    c.url === "https://api.exa.ai/contents"
      ? { body: { results: [{ id: "https://news.example/a", url: "https://news.example/a", title: "Story", text: "x".repeat(999) + "." }], statuses: [{ id: "https://news.example/a", status: "success" }] } }
      : undefined,
  );
  const { text } = await runFetch({ urls: ["https://news.example/a"] });
  assert.match(text, /Only the first 1,000 characters are available/);
});

test("search folds copies of the same document and drops Parallel's partner-database entries", async () => {
  const passage = "We crawled 11K shopping websites and found 1,818 instances of dark patterns. These appeared on 1,254 websites, about 11.1% of the sample. Of these, 234 instances were deceptive and appeared on 183 websites.";
  mockNetwork(
    exaSearchReply([exaResult("https://dl.acm.org/doi/10.1145/3359183", "Dark Patterns at Scale", passage)]),
    parallelSearchReply([
      parallelResult("https://webtransparency.cs.princeton.edu/dark-patterns/assets/dark-patterns.pdf", "dark-patterns.pdf", passage),
      parallelResult("https://platform.tracxn.com/a/d/company/1/x?utm_source=parallel", "Company X", "Name: X | Short Description: database entry"),
    ]),
  );
  const { text } = await runSearch({ query: "dark patterns at scale findings" });
  assert.equal((text.match(/^\[\d+\]/gm) ?? []).length, 1, text);
  assert.match(text, /Same document also on: webtransparency\.cs\.princeton\.edu/);
  assert.doesNotMatch(text, /tracxn/);
});

test("quick research drops citation numbers it can't link and lists the pages the agent used", async () => {
  mockNetwork((c) =>
    c.url === "https://api.parallel.ai/v1/responses"
      ? {
          body: {
            output: [
              {
                type: "message",
                content: [
                  {
                    text: JSON.stringify({ answer: "The grant is £7,500 [0][3].", sources: [] }),
                    annotations: [
                      { type: "url_citation", url: "https://gov.uk/a", title: "GOV.UK" },
                      { type: "url_citation", url: "https://gov.uk/a", title: "GOV.UK" },
                      { type: "url_citation", url: "https://ofgem.gov.uk/b", title: "Ofgem" },
                    ],
                  },
                ],
              },
            ],
          },
        }
      : undefined,
  );
  const { text } = await runResearch({ task: "How much is the grant?", effort: "quick" });
  assert.match(text, /The grant is £7,500\./);
  assert.doesNotMatch(text, /\[0\]|\[3\]/);
  assert.match(text, /Sources the agent used \(not linked to specific sentences\):\n\[1\] GOV\.UK https:\/\/gov\.uk\/a\n\[2\] Ofgem https:\/\/ofgem\.gov\.uk\/b/);
});
