import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { after, beforeEach, test } from "node:test";
import { calls, freshStore, mockNetwork, req, restoreNetwork } from "./helpers.js";
import jobs from "../api/jobs.js";
import settings from "../api/settings.js";
import { checkLink, closedPhrase, decide, ukToday } from "../lib/jobs/recheck.js";
import { notion, useNotion, type Notion, type NotionPage } from "../lib/jobs/notion.js";
import { runJobs } from "../lib/jobs/run.js";
import { useRunLog } from "../lib/jobs/runlog.js";
import { setSecret } from "../lib/store.js";

const fixture = (name: string) => readFileSync(join(process.cwd(), "test/fixtures/jobs", name), "utf8");

const sel = (name: string | null) => ({ select: name ? { name } : null });
const txt = (value: string) => ({ rich_text: value ? [{ plain_text: value }] : [] });

function row(id: string, fields: { name: string; role?: string; link?: string; deadline?: string; entry: string; review?: string; advert?: string; tag?: string; status?: string }): NotionPage {
  return {
    id,
    properties: {
      Name: { title: [{ plain_text: fields.name }] },
      Role: txt(fields.role ?? ""),
      Links: { url: fields.link ?? null },
      Deadline: { date: fields.deadline ? { start: fields.deadline } : null },
      "Entry type": sel(fields.entry),
      "Review status": sel(fields.review ?? null),
      "Advert status": sel(fields.advert ?? null),
      Tag: sel(fields.tag ?? null),
      Status: sel(fields.status ?? null),
    },
  };
}

// A fake Notion that answers queries by applying the Entry type filter, and
// records updates.
function fakeNotion(pages: NotionPage[]): Notion & { updates: { id: string; properties: any }[] } {
  const updates: { id: string; properties: any }[] = [];
  return {
    updates,
    async query(_ds, filter: any) {
      const entry = filter?.and?.[0]?.select?.equals ?? filter?.select?.equals;
      return pages.filter((p) => p.properties["Entry type"].select?.name === entry);
    },
    async update(id, properties) {
      updates.push({ id, properties });
    },
  };
}

let logged: { table: string; row: any }[] = [];
beforeEach(async () => {
  await freshStore(false);
  logged = [];
  useRunLog(async (table, r) => {
    logged.push({ table, row: r });
  });
  useNotion(null);
});
after(() => {
  restoreNetwork();
  useRunLog(undefined);
  useNotion(null);
});

const page = (html: string, status = 200) => ({ status, raw: html, headers: { "content-type": "text/html" } });

test("closed wording is found in the visible page only", () => {
  assert.equal(closedPhrase(fixture("closed-advert.html")), "no longer accepting applications");
  assert.equal(closedPhrase(fixture("open-advert.html")), null, "text inside scripts is ignored");
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
    if (c.url === "https://api.ashbyhq.com/posting-api/job-board/healf") return { raw: fixture("ashby-board.json"), headers: { "content-type": "application/json" } };
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
    if (c.url === "https://example.com/jobs/closed") return page(fixture("closed-advert.html"));
    if (c.url === "https://example.com/jobs/open") return page(fixture("open-advert.html"));
    if (c.url === "https://example.com/jobs/gone") return page("Not found", 404);
    if (c.url === "https://example.com/jobs/blocked") return page("Just a moment", 403);
    return undefined;
  });
  assert.deepEqual(await checkLink("https://example.com/jobs/closed"), { state: "closed", how: 'page says "no longer accepting applications"' });
  assert.equal((await checkLink("https://example.com/jobs/open")).state, "open");
  assert.equal((await checkLink("https://example.com/jobs/gone")).state, "closed");
  assert.equal((await checkLink("https://example.com/jobs/blocked")).state, "unknown");
  assert.equal((await checkLink(null)).state, "unknown");
});

// Relative to today, so the test keeps working on any date.
const inDays = (n: number) => new Date(Date.parse(`${ukToday()}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

const pages = () => [
  row("r1", { name: "Figma", role: "Product Designer", link: "https://example.com/jobs/open", entry: "Role", review: "Added", advert: "Active" }),
  row("r2", { name: "Granola", role: "Product Designer", link: "https://example.com/jobs/closed", entry: "Role", review: "Added", advert: "Active" }),
  row("r3", { name: "Healf", role: "Product Designer", link: "https://example.com/jobs/open", deadline: inDays(2), entry: "Role", review: "Added", advert: "Active" }),
  row("r4", { name: "Indeed co", role: "UX Designer", link: "https://example.com/jobs/blocked", entry: "Role", review: "Added", advert: "Active" }),
  row("r5", { name: "Old", role: "Designer", link: "https://example.com/jobs/closed", entry: "Role", review: "Added", advert: "Closed" }),
  row("r6", { name: "Skip", role: "Designer", link: "https://example.com/jobs/closed", entry: "Role", review: "Added", advert: "Active", tag: "Not for me" }),
  row("r7", { name: "Inbox", role: "Designer", link: "https://example.com/jobs/closed", entry: "Role", review: "New" }),
  row("a1", { name: "Monzo", role: "Product Designer", link: "https://example.com/jobs/closed", entry: "Application", status: "Watch", advert: "Active" }),
  row("a2", { name: "Wise", link: "https://example.com/jobs/closed", entry: "Application", status: "Unsuccessful" }),
];

function advertSite() {
  mockNetwork((c) => {
    if (c.url === "https://example.com/jobs/closed") return page(fixture("closed-advert.html"));
    if (c.url === "https://example.com/jobs/open") return page(fixture("open-advert.html"));
    if (c.url === "https://example.com/jobs/blocked") return page("Just a moment", 403);
    return undefined;
  });
}

test("a dry run reports changes but writes nothing to Notion", async () => {
  advertSite();
  const fake = fakeNotion(pages());
  useNotion(fake);
  const report = await runJobs({ dry: true, trigger: "manual" });
  const recheck = report.stages[0];
  assert.equal(recheck.ok, true);
  assert.equal(fake.updates.length, 0);
  const details = recheck.details as any;
  assert.deepEqual(details.changes.map((c: any) => [c.name, c.to]).sort(), [["Granola", "Closed"], ["Healf", "Almost Gone"]]);
  assert.deepEqual(details.could_not_tell.map((c: any) => c.name), ["Indeed co"]);
  assert.deepEqual(details.watched_closed.map((c: any) => c.name), ["Monzo"], "watched roles are reported, unsuccessful ones ignored");
  assert.equal(recheck.counts!.roles, 4, "closed, Not for me and inbox rows are left out");
  assert.deepEqual(logged.map((l) => l.table), ["job_search_stages", "job_search_runs"]);
  assert.equal(logged[1].row.dry_run, true);
});

test("a real run changes only Advert status, and never on Application rows", async () => {
  advertSite();
  const fake = fakeNotion(pages());
  useNotion(fake);
  await runJobs({ dry: false, trigger: "cron" });
  assert.deepEqual(
    fake.updates.map((u) => [u.id, u.properties]).sort(),
    [
      ["r2", { "Advert status": { select: { name: "Closed" } } }],
      ["r3", { "Advert status": { select: { name: "Almost Gone" } } }],
    ],
  );
});

test("a missing Notion token is reported in plain words", async () => {
  const report = await runJobs({ dry: true, trigger: "manual" });
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

test("the scheduled run needs the cron secret", async () => {
  process.env.CRON_SECRET = "cron-secret-for-tests-0123456789";
  useNotion(fakeNotion([]));
  mockNetwork();
  const denied = await jobs.fetch(req("/jobs/run"));
  assert.equal(denied.status, 401);
  const wrong = await jobs.fetch(req("/jobs/run", { headers: { authorization: "Bearer nope" } }));
  assert.equal(wrong.status, 401);
  const ok = await jobs.fetch(req("/jobs/run?dry=1", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }));
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).dry_run, true);
  delete process.env.CRON_SECRET;
});

test("the run page is for the signed-in owner and starts with a dry run", async () => {
  advertSite();
  const fake = fakeNotion(pages());
  useNotion(fake);
  const anonymous = await jobs.fetch(req("/jobs"));
  assert.equal(anonymous.status, 401);
  const login = await settings.fetch(req("/settings", { method: "POST", form: { action: "login", password: "correct horse battery staple" } }));
  const cookie = login.headers.get("set-cookie")!.split(";")[0];
  const html = await (await jobs.fetch(req("/jobs", { headers: { cookie } }))).text();
  assert.match(html, /Job search dry run/);
  assert.match(html, /Granola/);
  assert.equal(fake.updates.length, 0);
  const csrf = /name="csrf" value="([^"]+)"/.exec(html)![1];
  const forged = await jobs.fetch(req("/jobs", { method: "POST", headers: { cookie }, form: { csrf: "forged" } }));
  assert.equal(forged.status, 403);
  assert.equal(fake.updates.length, 0);
  const real = await jobs.fetch(req("/jobs", { method: "POST", headers: { cookie }, form: { csrf } }));
  assert.match(await real.text(), /Changed \(2\)/);
  assert.equal(fake.updates.length, 2);
});
