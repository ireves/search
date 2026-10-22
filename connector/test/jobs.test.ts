import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { after, beforeEach, test } from "node:test";
import { calls, freshStore, mockNetwork, req, restoreNetwork } from "./helpers.js";
import jobs from "../api/jobs.js";
import oauth from "../api/oauth.js";
import settings from "../api/settings.js";
import { classify, pageScript, parseWorkbench, useComposio, type Composio, type PageResult } from "../lib/jobs/composio.js";
import { jobsFromPage, runCompanies, serviceOf } from "../lib/jobs/companies.js";
import { checkLink, closedPhrase, decide, ukToday } from "../lib/jobs/recheck.js";
import { notion, useNotion, type Notion, type NotionPage } from "../lib/jobs/notion.js";
import { excludedBy, linkKey, locationWanted, titleWanted, type Preferences } from "../lib/jobs/prefs.js";
import { runJobs } from "../lib/jobs/run.js";
import { useRunLog } from "../lib/jobs/runlog.js";
import { setSecret } from "../lib/store.js";

const fixture = (name: string) => readFileSync(join(process.cwd(), "test/fixtures/jobs", name), "utf8");

const sel = (name: string | null | undefined) => ({ select: name ? { name } : null });
const txt = (value: string | undefined) => ({ rich_text: value ? [{ plain_text: value }] : [] });

interface Fields {
  name: string;
  role?: string;
  link?: string;
  deadline?: string;
  entry: string;
  review?: string;
  advert?: string;
  tag?: string;
  status?: string;
  type?: string;
  priority?: string;
  notes?: string;
  active?: boolean;
  checked?: string;
  service?: string;
  board?: string;
}

function row(id: string, f: Fields): NotionPage {
  return {
    id,
    properties: {
      Name: { title: [{ plain_text: f.name }] },
      Role: txt(f.role),
      Links: { url: f.link ?? null },
      Deadline: { date: f.deadline ? { start: f.deadline } : null },
      "Entry type": sel(f.entry),
      "Review status": sel(f.review),
      "Advert status": sel(f.advert),
      Tag: sel(f.tag),
      Status: sel(f.status),
      "Preference type": sel(f.type),
      Priority: sel(f.priority),
      Notes: txt(f.notes),
      Active: { checkbox: f.active ?? f.entry === "Preference" },
      "Last checked": { date: f.checked ? { start: f.checked } : null },
      "Hiring service": sel(f.service),
      "Board ID": txt(f.board),
    },
  };
}

// A fake Notion that answers queries by Entry type, and records writes.
function fakeNotion(pages: NotionPage[]) {
  const updates: { id: string; properties: any }[] = [];
  const created: { properties: any; children?: any[] }[] = [];
  const client: Notion = {
    async query(_ds, filter: any) {
      const entry = filter?.and?.[0]?.select?.equals ?? filter?.select?.equals;
      return pages.filter((p) => p.properties["Entry type"].select?.name === entry);
    },
    async update(id, properties) {
      updates.push({ id, properties });
    },
    async create(_ds, properties, children) {
      created.push({ properties, children });
      return `new-${created.length}`;
    },
  };
  return Object.assign(client, { updates, created });
}

function fakeComposio(pages: Record<string, Partial<PageResult>>) {
  const asked: string[] = [];
  const client: Composio = {
    async readPages(list) {
      return list.map((p) => {
        asked.push(p.url);
        const page = pages[p.url];
        return page
          ? { id: p.id, ok: true, status: 200, chars: 5000, head: "", matches: [], services: [], charge: 0.0008, ...page }
          : { id: p.id, ok: false, error: "not mocked", chars: 0, head: "", matches: [], services: [], charge: 0 };
      });
    },
    async toolSettings() {
      return ["url", "formats", "waitFor", "timeout", "onlyMainContent", "location"];
    },
  };
  return Object.assign(client, { asked });
}

let logged: { table: string; row: any }[] = [];
beforeEach(async () => {
  await freshStore(false);
  logged = [];
  useRunLog(async (table, r) => {
    logged.push({ table, row: r });
  });
  useNotion(null);
  useComposio(fakeComposio({}));
});
after(() => {
  restoreNetwork();
  useRunLog(undefined);
  useNotion(null);
  useComposio(null);
});

const html = (body: string, status = 200) => ({ status, raw: body, headers: { "content-type": "text/html" } });

// Relative to today, so the tests keep working on any date.
const inDays = (n: number) => new Date(Date.parse(`${ukToday()}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

// ---- Recheck ----

test("closed wording is found in the visible page only", () => {
  assert.equal(closedPhrase(fixture("closed-advert.html")), "no longer accepting applications");
  assert.equal(closedPhrase(fixture("open-advert.html")), null, "text inside scripts is ignored");
  assert.equal(closedPhrase("Search\n\n### This job has expired on Indeed\n\nReasons could include"), "job has expired", "works on Firecrawl's Markdown too");
});

test("Advert status follows the check and the closing date", () => {
  const today = "2026-10-22";
  const open = { state: "open" as const, how: "advert page is up" };
  const unknown = { state: "unknown" as const, how: "site blocked the check (403)" };
  assert.equal(decide({ state: "closed", how: "x" }, null, today).status, "Closed");
  assert.equal(decide(open, null, today).status, "Active");
  assert.equal(decide(open, "2026-10-25", today).status, "Almost Gone");
  assert.equal(decide(open, "2026-10-26", today).status, "Active");
  assert.equal(decide(open, "2026-10-21", today).status, "Closed");
  assert.equal(decide(unknown, null, today).status, null, "can't tell: left alone");
  assert.equal(decide(unknown, "2026-10-23", today).status, "Almost Gone", "a near closing date still counts");
  assert.equal(ukToday(new Date("2026-10-22T23:30:00Z")), "2026-10-23", "UK time, not UTC");
});

test("hiring-service links are checked against the service, not the page", async () => {
  mockNetwork((c) => {
    if (c.url === "https://boards-api.greenhouse.io/v1/boards/figma/jobs/6193686004") return { body: { id: 6193686004 } };
    if (c.url === "https://boards-api.greenhouse.io/v1/boards/figma/jobs/1") return { status: 404, body: { status: 404 } };
    if (c.url === "https://api.lever.co/v0/postings/acme/0f6e1c1e-1111-4222-8333-944455556666") return { status: 404, body: {} };
    if (c.url.startsWith("https://api.ashbyhq.com/posting-api/job-board/healf")) return { raw: fixture("ashby-board.json"), headers: { "content-type": "application/json" } };
    return undefined;
  });
  assert.equal((await checkLink("https://job-boards.greenhouse.io/figma/jobs/6193686004")).state, "open");
  assert.equal((await checkLink("https://boards.greenhouse.io/figma/jobs/1?gh_src=x")).state, "closed");
  assert.equal((await checkLink("https://jobs.lever.co/acme/0f6e1c1e-1111-4222-8333-944455556666")).state, "closed");
  assert.equal((await checkLink("https://jobs.ashbyhq.com/healf/309a3526-3349-4cb9-afaf-4ee99e69772d")).state, "open");
  assert.equal((await checkLink("https://jobs.ashbyhq.com/healf/00000000-3349-4cb9-afaf-4ee99e69772d")).state, "closed");
});

test("EU Greenhouse links use the EU service", async () => {
  mockNetwork((c) => (c.url === "https://boards-api.eu.greenhouse.io/v1/boards/financialtimes33/jobs/4900290101" ? { body: { id: 1 } } : undefined));
  assert.equal((await checkLink("https://job-boards.eu.greenhouse.io/financialtimes33/jobs/4900290101")).state, "open");
  assert.ok(!calls.some((c) => c.url.startsWith("https://boards-api.greenhouse.io")), "never asks the US service for an EU job");
});

test("other links are judged from the advert page", async () => {
  mockNetwork((c) => {
    if (c.url === "https://example.com/jobs/closed") return html(fixture("closed-advert.html"));
    if (c.url === "https://example.com/jobs/open") return html(fixture("open-advert.html"));
    if (c.url === "https://example.com/jobs/gone") return html("Not found", 404);
    if (c.url === "https://example.com/jobs/blocked") return html("Just a moment", 403);
    return undefined;
  });
  assert.deepEqual(await checkLink("https://example.com/jobs/closed"), { state: "closed", how: 'page says "no longer accepting applications"' });
  assert.equal((await checkLink("https://example.com/jobs/open")).state, "open");
  assert.equal((await checkLink("https://example.com/jobs/gone")).state, "closed");
  assert.equal((await checkLink("https://example.com/jobs/blocked")).state, "unknown");
  assert.equal((await checkLink(null)).state, "unknown");
});

const rolePages = () => [
  row("r1", { name: "Figma", role: "Product Designer", link: "https://example.com/jobs/open", entry: "Role", review: "Added", advert: "Active" }),
  row("r2", { name: "Granola", role: "Product Designer", link: "https://example.com/jobs/closed", entry: "Role", review: "Added", advert: "Active" }),
  row("r3", { name: "Healf", role: "Product Designer", link: "https://example.com/jobs/open", deadline: inDays(2), entry: "Role", review: "Added", advert: "Active" }),
  row("r4", { name: "Indeed co", role: "UX Designer", link: "https://example.com/jobs/blocked", entry: "Role", review: "Added", advert: "Active" }),
  row("r8", { name: "Lendable", role: "Product Designer", link: "https://example.com/jobs/indeed-expired", entry: "Role", review: "Added", advert: "Active" }),
  row("r5", { name: "Old", role: "Designer", link: "https://example.com/jobs/closed", entry: "Role", review: "Added", advert: "Closed" }),
  row("r6", { name: "Skip", role: "Designer", link: "https://example.com/jobs/closed", entry: "Role", review: "Added", advert: "Active", tag: "Not for me" }),
  row("r7", { name: "Inbox", role: "Designer", link: "https://example.com/jobs/closed", entry: "Role", review: "New" }),
  row("a1", { name: "Monzo", role: "Product Designer", link: "https://example.com/jobs/closed", entry: "Application", status: "Watch", advert: "Active" }),
  row("a2", { name: "Wise", link: "https://example.com/jobs/closed", entry: "Application", status: "Unsuccessful" }),
];

function advertSite() {
  mockNetwork((c) => {
    if (c.url === "https://example.com/jobs/closed") return html(fixture("closed-advert.html"));
    if (c.url === "https://example.com/jobs/open") return html(fixture("open-advert.html"));
    if (c.url.startsWith("https://example.com/jobs/blocked") || c.url.startsWith("https://example.com/jobs/indeed")) return html("Just a moment", 403);
    return undefined;
  });
}

const blockedPages = () =>
  fakeComposio({
    "https://example.com/jobs/indeed-expired": { head: "Search\n\n### This job has expired on Indeed\n\nReasons could include: the employer is not accepting applications" },
    "https://example.com/jobs/blocked": { ok: false, error: "timeout" },
  });

test("a dry run reports changes but writes nothing to Notion", async () => {
  advertSite();
  const fake = fakeNotion(rolePages());
  useNotion(fake);
  const fc = blockedPages();
  useComposio(fc);
  const report = await runJobs({ dry: true, trigger: "manual", stages: ["recheck"] });
  const recheck = report.stages[0];
  assert.equal(recheck.ok, true);
  assert.equal(fake.updates.length, 0);
  const details = recheck.details as any;
  assert.deepEqual(details.changes.map((c: any) => [c.name, c.to]).sort(), [["Granola", "Closed"], ["Healf", "Almost Gone"], ["Lendable", "Closed"]]);
  assert.deepEqual(details.could_not_tell.map((c: any) => c.name), ["Indeed co"]);
  assert.deepEqual(details.watched_closed.map((c: any) => c.name), ["Monzo"], "watched roles are reported, unsuccessful ones ignored");
  assert.deepEqual(fc.asked.sort(), ["https://example.com/jobs/blocked", "https://example.com/jobs/indeed-expired"], "only blocked adverts go to Firecrawl");
  assert.equal(recheck.counts!.roles, 5, "closed, Not for me and inbox rows are left out");
  assert.deepEqual(logged.map((l) => l.table), ["job_search_stages", "job_search_runs"]);
  assert.equal(logged[1].row.dry_run, true);
});

test("a real recheck changes only Advert status, and never on Application rows", async () => {
  advertSite();
  const fake = fakeNotion(rolePages());
  useNotion(fake);
  useComposio(blockedPages());
  await runJobs({ dry: false, trigger: "claude", stages: ["recheck"] });
  assert.deepEqual(
    fake.updates.map((u) => [u.id, u.properties]).sort(),
    [
      ["r2", { "Advert status": { select: { name: "Closed" } } }],
      ["r3", { "Advert status": { select: { name: "Almost Gone" } } }],
      ["r8", { "Advert status": { select: { name: "Closed" } } }],
    ],
  );
});

test("without a Composio key, blocked adverts stay as they are and the report says why", async () => {
  advertSite();
  useNotion(fakeNotion(rolePages()));
  useComposio(null);
  const report = await runJobs({ dry: true, trigger: "manual", stages: ["recheck"] });
  const recheck = report.stages[0];
  assert.match(recheck.failures![0].error, /Add COMPOSIO_CONSUMER_KEY/);
  assert.deepEqual((recheck.details as any).could_not_tell.map((c: any) => c.name).sort(), ["Indeed co", "Lendable"]);
});

test("a missing Notion token is reported in plain words", async () => {
  const report = await runJobs({ dry: true, trigger: "manual", stages: ["recheck"] });
  assert.equal(report.ok, false);
  assert.match(report.stages[0].error!, /Add NOTION_TOKEN on the connector's settings page/);
});

test("the Notion client queries data sources and pages through results", async () => {
  await setSecret("NOTION_TOKEN", "ntn_test_token_123");
  let n = 0;
  mockNetwork((c) => {
    if (c.url !== "https://api.notion.com/v1/data_sources/ds1/query") return undefined;
    n++;
    assert.equal(c.headers["notion-version"], "2025-09-03");
    assert.equal(c.headers.authorization, "Bearer ntn_test_token_123");
    return n === 1 ? { body: { results: [{ id: "p1", properties: {} }], has_more: true, next_cursor: "c2" } } : { body: { results: [{ id: "p2", properties: {} }], has_more: false, next_cursor: null } };
  });
  const client = await notion();
  const results = await client.query("ds1", { property: "Entry type", select: { equals: "Role" } });
  assert.deepEqual(results.map((p) => p.id), ["p1", "p2"]);
  assert.equal(calls[1].body.start_cursor, "c2");
});

// ---- Filters ----

const prefs = (): Preferences => {
  const p = (name: string, type: string, priority = "High") => ({ id: name, name, type, priority, notes: "", link: null, lastChecked: null, hiringService: null, boardId: "" });
  const roles = ["UX Designer", "Interaction Designer", "Product Designer", "Visual Designer", "UI Designer"].map((r) => p(r, "Role"));
  const locations = [p("London, UK", "Location"), p("Remote", "Location", "Low")];
  const excludes = [p("Senior", "Level", "Exclude"), p("Lead", "Level", "Exclude"), p("Manager", "Level", "Exclude"), p("Revolut", "Company", "Exclude")];
  return { all: [...roles, ...locations, ...excludes], roles, locations, excludes, sources: [] };
};

test("job titles are kept loosely, and Exclude preferences drop roles", () => {
  const pr = prefs();
  assert.ok(titleWanted("Product Designer, Apple Weather", pr));
  assert.ok(titleWanted("Brand Designer", pr), "any Designer gets through for Claude to judge");
  assert.ok(titleWanted("UI/UX Designer", pr));
  assert.ok(!titleWanted("Software Engineer", pr));
  assert.equal(excludedBy({ title: "Senior Product Designer", company: "Apple" }, pr), "Senior");
  assert.equal(excludedBy({ title: "Sr. Product Designer", company: "Apple" }, pr), "Senior");
  assert.equal(excludedBy({ title: "Product Designer", company: "Revolut" }, pr), "Revolut");
  assert.equal(excludedBy({ title: "Product Designer", company: "Apple" }, pr), null);
});

test("locations are kept unless clearly elsewhere", () => {
  const pr = prefs();
  assert.ok(locationWanted("", pr));
  assert.ok(locationWanted("London, England, United Kingdom", pr));
  assert.ok(locationWanted("Manchester, United Kingdom", pr), "the UK counts when a UK location is wanted");
  assert.ok(locationWanted("Remote - Europe", pr));
  assert.ok(!locationWanted("San Francisco, CA", pr));
  assert.ok(locationWanted("Cupertino, California", pr, "London and Cupertino Only"), "the company's notes add places");
  assert.ok(locationWanted("New York", pr, "Any Location"));
});

test("duplicate links match without tracking parts", () => {
  assert.equal(linkKey("https://www.Example.com/jobs/1/?utm_source=x&gh_src=y#apply"), linkKey("https://example.com/jobs/1"));
  assert.notEqual(linkKey("https://example.com/jobs/1"), linkKey("https://example.com/jobs/2"));
});

// ---- Composio ----

test("the workbench script and its reply round-trip", () => {
  const script = pageScript([{ id: "a", url: "https://x.com/careers" }], { keywords: ["Designer"], headChars: 100, mainOnly: true });
  assert.match(script, /run_composio_tool\(job\["tool"\], args\)/);
  assert.ok(!/https:\/\/x\.com/.test(script), "addresses travel encoded, so they can't break the script");
  const reply = JSON.stringify({ successful: true, data: { stdout: '[INFO] noise\n@@JOBS_RESULT@@[{"id":"a","ok":true}]\n', error: "" } });
  assert.deepEqual(parseWorkbench(reply), [{ id: "a", ok: true }]);
  assert.throws(() => parseWorkbench(JSON.stringify({ successful: true, data: { stdout: "nothing", error: "NameError" } })), /NameError/);
});

test("Composio errors get their own messages", () => {
  assert.equal(classify("HTTP 401 Unauthorized").kind, "key");
  assert.equal(classify("402 Metering_WalletBalanceExhausted").kind, "balance");
  assert.equal(classify("Tool FIRECRAWL_SCRAPE not found").kind, "tool");
  assert.equal(classify("cell exceeded 180 seconds: timed out").kind, "time");
  assert.match(classify("402 Metering_WalletBalanceExhausted").friendly, /balance is empty/);
});

// ---- Company job lists ----

test("careers links are matched to hiring services", () => {
  assert.deepEqual(serviceOf("https://boards-api.greenhouse.io/v1/boards/monzo/jobs"), { service: "Greenhouse", board: "monzo" });
  assert.deepEqual(serviceOf("https://job-boards.eu.greenhouse.io/financialtimes33"), { service: "Greenhouse", board: "financialtimes33" });
  assert.deepEqual(serviceOf("https://jobs.ashbyhq.com/notion"), { service: "Ashby", board: "notion" });
  assert.deepEqual(serviceOf("https://jobs.lever.co/acme/"), { service: "Lever", board: "acme" });
  assert.deepEqual(serviceOf("https://apply.workable.com/rivecareers/"), { service: "Workable", board: "rivecareers" });
  assert.equal(serviceOf("https://www.framer.com/careers/"), null);
});

test("own-site job links are the ones on the same site, named after a role", () => {
  const page: PageResult = {
    id: "x",
    ok: true,
    chars: 9000,
    head: "",
    services: [],
    charge: 0,
    matches: [
      ["Product Designer", "https://www.framer.com/careers/product-designer"],
      ["Designers", "https://www.framer.com/careers/"],
      ["Visual Designer", "https://twitter.com/framer"],
    ],
  };
  assert.deepEqual(jobsFromPage(page, "https://www.framer.com/careers/#positions").map((j) => j.link), ["https://www.framer.com/careers/product-designer"]);
});

function companyRows() {
  return [
    row("p-role", { name: "Product Designer", entry: "Preference", type: "Role", priority: "High" }),
    row("p-ux", { name: "UX Designer", entry: "Preference", type: "Role", priority: "High" }),
    row("p-loc", { name: "London, UK", entry: "Preference", type: "Location", priority: "High" }),
    row("p-senior", { name: "Senior", entry: "Preference", type: "Level", priority: "Exclude" }),
    row("c-monzo", { name: "Monzo", entry: "Preference", type: "Company", priority: "High", link: "https://boards-api.greenhouse.io/v1/boards/monzo/jobs", checked: "2026-10-01" }),
    row("c-healf", { name: "Healf", entry: "Preference", type: "Company", priority: "Medium", link: "https://jobs.ashbyhq.com/healf", checked: "2026-10-02" }),
    row("c-framer", { name: "Framer", entry: "Preference", type: "Company", priority: "Medium", link: "https://www.framer.com/careers/#positions" }),
    row("c-craft", { name: "Craft Docs", entry: "Preference", type: "Company", priority: "High", link: "https://www.craft.do/careers", checked: "2026-10-03" }),
    row("c-fabric", { name: "Fabric (fabric.so)", entry: "Preference", type: "Company", priority: "Medium", checked: "2026-10-04" }),
    row("c-meta", { name: "Meta", entry: "Preference", type: "Company", priority: "Exclude" }),
    row("c-indeed", { name: "indeed.com", entry: "Preference", type: "Job Listing Websites", link: "indeed.com" }),
    row("c-off", { name: "Paused Co", entry: "Preference", type: "Company", priority: "High", link: "https://paused.example/jobs", active: false }),
    row("old", { name: "Healf", role: "Product Designer", link: "https://jobs.ashbyhq.com/healf/309a3526-3349-4cb9-afaf-4ee99e69772d", entry: "Role", review: "Added" }),
  ];
}

function companySites() {
  mockNetwork((c) => {
    if (c.url === "https://boards-api.greenhouse.io/v1/boards/monzo/jobs")
      return {
        body: {
          jobs: [
            { id: 11, title: "Product Designer, Borrowing", absolute_url: "https://job-boards.greenhouse.io/monzo/jobs/11", location: { name: "London" } },
            { id: 12, title: "Senior Product Designer", absolute_url: "https://job-boards.greenhouse.io/monzo/jobs/12", location: { name: "London" } },
            { id: 13, title: "Product Designer", absolute_url: "https://job-boards.greenhouse.io/monzo/jobs/13", location: { name: "San Francisco, CA" } },
            { id: 14, title: "Backend Engineer", absolute_url: "https://job-boards.greenhouse.io/monzo/jobs/14", location: { name: "London" } },
          ],
        },
      };
    if (c.url === "https://boards-api.greenhouse.io/v1/boards/monzo/jobs/11") return { body: { content: "&lt;p&gt;Design lending journeys.&lt;/p&gt;" } };
    if (c.url.startsWith("https://api.ashbyhq.com/posting-api/job-board/healf")) return { raw: fixture("ashby-board.json"), headers: { "content-type": "application/json" } };
    if (c.url === "https://www.framer.com/careers/product-designer") return html("<main><h1>Product Designer</h1><p>Shape Framer.</p></main>");
    return undefined;
  });
  return fakeComposio({
    "https://www.framer.com/careers/#positions": { matches: [["Product Designer", "https://www.framer.com/careers/product-designer"]] },
    "https://www.craft.do/careers": { chars: 20 },
  });
}

test("a dry run of the company lists finds new roles and writes nothing", async () => {
  const fake = fakeNotion(companyRows());
  useNotion(fake);
  const fc = companySites();
  useComposio(fc);
  const report = await runJobs({ dry: true, trigger: "manual", stages: ["companies"] });
  const stage = report.stages[0];
  const companies = (stage.details as any).companies as any[];
  const by = (n: string) => companies.find((c) => c.name === n);
  assert.deepEqual(companies.map((c) => c.name).sort(), ["Craft Docs", "Fabric (fabric.so)", "Framer", "Healf", "Monzo"], "inactive, Exclude and Indeed rows are skipped");
  assert.equal(companies[0].name, "Framer", "never-checked companies come first");
  assert.deepEqual(by("Monzo").added, ["Product Designer, Borrowing"]);
  assert.deepEqual(by("Monzo").dropped.map((d: any) => d.why), ["excluded: Senior", "location: San Francisco, CA"]);
  assert.deepEqual(by("Healf").added, [], "already in Notion");
  assert.deepEqual(by("Framer").added, ["Product Designer"]);
  assert.equal(by("Framer").result, "Used Firecrawl");
  assert.equal(by("Craft Docs").result, "Needs Claude", "a page that came back empty");
  assert.equal(by("Fabric (fabric.so)").result, "Needs Claude", "no careers page link");
  assert.deepEqual(fc.asked.sort(), ["https://www.craft.do/careers", "https://www.framer.com/careers/#positions"]);
  assert.equal(fake.created.length + fake.updates.length, 0);
  assert.equal(stage.counts!.duplicates, 1);
});

test("a real run adds Inbox rows with advert text and updates each company", async () => {
  const fake = fakeNotion(companyRows());
  useNotion(fake);
  useComposio(companySites());
  await runJobs({ dry: false, trigger: "claude", stages: ["companies"] });
  const titles = fake.created.map((c) => c.properties.Role?.rich_text?.[0]?.text.content ?? `(${c.properties["Review status"].select.name}) ${c.properties.Name.title[0].text.content}`).sort();
  assert.deepEqual(titles, ["(Needs Claude) Craft Docs", "(Needs Claude) Fabric (fabric.so)", "Product Designer", "Product Designer, Borrowing"]);
  const monzo = fake.created.find((c) => c.properties.Name.title[0].text.content === "Monzo")!;
  assert.equal(monzo.properties["Review status"].select.name, "New");
  assert.equal(monzo.properties["Entry type"].select.name, "Role");
  assert.equal(monzo.properties.Source.select.name, "Careers page");
  assert.match(monzo.children![0].toggle.children[0].paragraph.rich_text[0].text.content, /Design lending journeys/);
  const framer = fake.created.find((c) => c.properties.Name.title[0].text.content === "Framer")!;
  const framerText = framer.children![0].toggle.children.map((b: any) => b.paragraph.rich_text[0].text.content).join("\n");
  assert.match(framerText, /Shape Framer/, "own-site advert text is read directly");
  const monzoUpdate = fake.updates.find((u) => u.id === "c-monzo")!.properties;
  assert.equal(monzoUpdate["Last result"].select.name, "Read OK");
  assert.equal(monzoUpdate["Hiring service"].select.name, "Greenhouse");
  assert.equal(monzoUpdate["Board ID"].rich_text[0].text.content, "monzo");
  assert.equal(fake.updates.find((u) => u.id === "c-craft")!.properties["Last result"].select.name, "Needs Claude");
  assert.equal(fake.updates.length, 5, "only the companies checked");
});

// ---- Endpoints ----

test("the run page is for the signed-in owner and starts with a dry run", async () => {
  advertSite();
  const fake = fakeNotion(rolePages());
  useNotion(fake);
  useComposio(blockedPages());
  const anonymous = await jobs.fetch(req("/jobs"));
  assert.equal(anonymous.status, 401);
  const login = await settings.fetch(req("/settings", { method: "POST", form: { action: "login", password: "correct horse battery staple" } }));
  const cookie = login.headers.get("set-cookie")!.split(";")[0];
  const page = await (await jobs.fetch(req("/jobs?stage=recheck", { headers: { cookie } }))).text();
  assert.match(page, /Job search dry run/);
  assert.match(page, /Granola/);
  assert.equal(fake.updates.length, 0);
  const csrf = /name="csrf" value="([^"]+)"/.exec(page)![1];
  const forged = await jobs.fetch(req("/jobs", { method: "POST", headers: { cookie }, form: { csrf: "forged", stage: "recheck" } }));
  assert.equal(forged.status, 403);
  const otherStage = await jobs.fetch(req("/jobs", { method: "POST", headers: { cookie }, form: { csrf, stage: "companies" } }));
  assert.equal(otherStage.status, 403, "the button runs only the stage it was shown for");
  assert.equal(fake.updates.length, 0);
  const real = await jobs.fetch(req("/jobs", { method: "POST", headers: { cookie }, form: { csrf, stage: "recheck" } }));
  assert.match(await real.text(), /Changed \(3\)/);
  assert.equal(fake.updates.length, 3);
});

async function jobsToken(): Promise<string> {
  const redirect = "https://claude.ai/api/mcp/auth_callback";
  const reg = (await (await oauth.fetch(req("/register", { method: "POST", json: { redirect_uris: [redirect], client_name: "Claude" } }))).json()) as any;
  const verifier = "v".repeat(50);
  const challenge = Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))).toString("base64url");
  const form = {
    client_id: reg.client_id,
    redirect_uri: redirect,
    response_type: "code",
    code_challenge: challenge,
    code_challenge_method: "S256",
    state: "s",
    scope: "search",
    resource: "https://search.example.com/jobs/mcp",
    password: "correct horse battery staple",
    decision: "allow",
  };
  const page = await (await oauth.fetch(req(`/authorize?${new URLSearchParams(form)}`))).text();
  assert.match(page, /Connect Job search to Claude/);
  const done = await oauth.fetch(req("/authorize", { method: "POST", form }));
  const code = new URL(done.headers.get("location")!).searchParams.get("code")!;
  const tokens = (await (await oauth.fetch(req("/token", { method: "POST", form: { grant_type: "authorization_code", code, client_id: reg.client_id, redirect_uri: redirect, code_verifier: verifier } }))).json()) as any;
  return tokens.access_token;
}

test("the Job search connector has its own sign-in and its one tool", async () => {
  advertSite();
  useNotion(fakeNotion(rolePages()));
  useComposio(blockedPages());
  const rpc = (body: unknown, token?: string) =>
    jobs.fetch(req("/jobs/mcp", { method: "POST", headers: token ? { authorization: `Bearer ${token}` } : {}, json: body }));

  const anonymous = await rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" });
  assert.equal(anonymous.status, 401);
  assert.match(anonymous.headers.get("www-authenticate")!, /oauth-protected-resource\/jobs\/mcp/);
  const meta = (await (await oauth.fetch(req("/.well-known/oauth-protected-resource/jobs/mcp"))).json()) as any;
  assert.equal(meta.resource, "https://search.example.com/jobs/mcp");

  const token = await jobsToken();
  const list = (await (await rpc({ jsonrpc: "2.0", id: 2, method: "tools/list" }, token)).json()) as any;
  assert.deepEqual(list.result.tools.map((t: any) => t.name), ["run_job_search"]);
  const run = (await (await rpc({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "run_job_search", arguments: { stage: "recheck", dry_run: true } } }, token)).json()) as any;
  const report = JSON.parse(run.result.content[0].text);
  assert.equal(report.dry_run, true);
  assert.equal(report.trigger, "claude");
  assert.equal(report.stages[0].stage, "recheck");

  const searchMcp = (await import("../api/mcp.js")).default;
  const crossed = await searchMcp.fetch(req("/mcp", { method: "POST", headers: { authorization: `Bearer ${token}` }, json: { jsonrpc: "2.0", id: 4, method: "tools/list" } }));
  assert.equal(crossed.status, 401, "a Job search token doesn't open the Search connector");
});
