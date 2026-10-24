import { strict as assert } from "node:assert";
import { beforeEach, test } from "node:test";
import { freshStore, req } from "./helpers.js";
import preferences from "../api/preferences.js";
import settings from "../api/settings.js";
import { callTool } from "../lib/mcp.js";
import { loadNotes } from "../lib/jobs/notes.js";
import { useNotion, type Notion, type NotionPage } from "../lib/jobs/notion.js";
import { readPreferences } from "../lib/jobs/prefs.js";

beforeEach(async () => {
  await freshStore(false);
  useNotion(null);
});

async function login(next?: string): Promise<{ cookie: string; location: string }> {
  const res = await settings.fetch(req("/settings", { method: "POST", form: { action: "login", password: "correct horse battery staple", ...(next ? { next } : {}) } }));
  assert.equal(res.status, 303);
  return { cookie: res.headers.get("set-cookie")!.split(";")[0], location: res.headers.get("location")! };
}

async function open(cookie: string): Promise<{ html: string; csrf: string }> {
  const html = await (await preferences.fetch(req("/preferences", { headers: { cookie } }))).text();
  return { html, csrf: /name="csrf" value="([^"]+)"/.exec(html)![1] };
}

const post = (cookie: string, form: Record<string, string>) => preferences.fetch(req("/preferences", { method: "POST", headers: { cookie }, form }));

const notionRow = (id: string, props: Record<string, any>): NotionPage => ({
  id,
  properties: {
    Name: { title: [{ plain_text: props.name }] },
    "Entry type": { select: { name: props.entry } },
    "Preference type": { select: props.type ? { name: props.type } : null },
    Priority: { select: props.priority ? { name: props.priority } : null },
    Active: { checkbox: props.active ?? true },
    Notes: { rich_text: [] },
    Links: { url: props.link ?? null },
    "Memory source": { select: props.source ? { name: props.source } : null },
    "Source role": { relation: props.role ? [{ id: props.role }] : [] },
    "Date added": { created_time: "2026-10-20T09:00:00.000Z" },
  },
});

function fakeNotion(pages: NotionPage[]): Notion {
  return {
    async query(_ds, filter: any) {
      return pages.filter((p) => p.properties["Entry type"].select?.name === filter?.select?.equals);
    },
    async update() {},
    async create() {
      return "x";
    },
  };
}

test("the page needs the passkey sign-in, and sign-in comes back to it", async () => {
  const anonymous = await preferences.fetch(req("/preferences"));
  assert.equal(anonymous.status, 401);
  assert.match(await anonymous.text(), /settings\?next=\/preferences/);
  const form = await (await settings.fetch(req("/settings?next=/preferences"))).text();
  assert.match(form, /name="next" value="\/preferences"/);
  const { location } = await login("/preferences");
  assert.equal(location, "https://search.example.com/preferences");
  assert.equal((await login("https://evil.example")).location, "https://search.example.com/settings", "only known pages");
});

test("preferences are added, edited and deleted on the page, and the server reads them", async () => {
  const { cookie } = await login();
  const { csrf, html } = await open(cookie);
  assert.match(html, /Import from Notion/);
  const forged = await post(cookie, { csrf: "forged", action: "pref-save", type: "Role", name: "Product Designer" });
  assert.match(forged.headers.get("location")!, /m=expired/);
  await post(cookie, { csrf, action: "pref-save", type: "Role", name: "Product Designer", priority: "High", active: "on" });
  await post(cookie, { csrf, action: "pref-save", type: "Level", name: "Senior", priority: "Exclude", active: "on" });
  await post(cookie, { csrf, action: "pref-save", type: "Location", name: "Leeds", priority: "Low" });
  let prefs = await readPreferences();
  assert.deepEqual(prefs.roles.map((p) => p.name), ["Product Designer"]);
  assert.deepEqual(prefs.excludes.map((p) => p.name), ["Senior"]);
  assert.equal(prefs.locations.length, 0, "an unticked preference is paused");

  const leeds = (await loadNotes()).preferences.find((p) => p.name === "Leeds")!;
  await post(cookie, { csrf, action: "pref-save", id: leeds.id, type: "Location", name: "London, UK", priority: "High", active: "on" });
  prefs = await readPreferences();
  assert.deepEqual(prefs.locations.map((p) => p.name), ["London, UK"]);
  await post(cookie, { csrf, action: "pref-delete", id: leeds.id });
  assert.equal((await loadNotes()).preferences.length, 2);
  const page = (await open(cookie)).html;
  assert.match(page, /value="Product Designer"/);
  assert.match(page, /<span class="tag red">|<option selected>High<\/option>/);
});

test("Preference and Memory rows are imported from Notion, replacing only when confirmed", async () => {
  useNotion(
    fakeNotion([
      notionRow("a", { name: "UX Designer", entry: "Preference", type: "Role", priority: "High" }),
      notionRow("b", { name: "Monzo", entry: "Preference", type: "Company", priority: "High", link: "https://monzo.com/careers" }),
      notionRow("c", { name: "Skip agency roles", entry: "Memory", source: "Comment", role: "1234-abcd" }),
      notionRow("d", { name: "A role", entry: "Role" }),
    ]),
  );
  const { cookie } = await login();
  const { csrf } = await open(cookie);
  await post(cookie, { csrf, action: "import" });
  let notes = await loadNotes();
  assert.deepEqual(notes.preferences.map((p) => p.name), ["UX Designer", "Monzo"]);
  assert.equal(notes.memories[0].note, "Skip agency roles");
  assert.equal(notes.memories[0].roleLink, "https://app.notion.com/p/1234abcd");
  assert.equal(notes.memories[0].addedAt, "2026-10-20T09:00:00.000Z");

  await post(cookie, { csrf, action: "pref-save", type: "Role", name: "Extra", active: "on" });
  const refused = await post(cookie, { csrf, action: "import" });
  assert.match(refused.headers.get("location")!, /m=confirm/);
  assert.equal((await loadNotes()).preferences.length, 3);
  await post(cookie, { csrf, action: "import", confirm: "yes" });
  notes = await loadNotes();
  assert.equal(notes.preferences.length, 2);
});

test("Claude reads preferences and saves memory notes through job_search_notes", async () => {
  const { cookie } = await login();
  const { csrf } = await open(cookie);
  await post(cookie, { csrf, action: "pref-save", type: "Role", name: "UI Designer", priority: "High", active: "on" });
  await post(cookie, { csrf, action: "pref-save", type: "Role", name: "Paused role", priority: "High" });

  const added = await callTool("job_search_notes", { action: "add_memory", note: "Skip roles needing 5+ years", source: "Comment", role_link: "https://app.notion.com/p/abc", role_name: "Product Designer at Wise" });
  assert.equal(added.isError, false);
  assert.doesNotMatch(added.text, /Search cost/);
  const id = JSON.parse(added.text).saved.id;
  await callTool("job_search_notes", { action: "add_memory", note: "Avoid agencies", source: "Pattern", active: false });

  const read = JSON.parse((await callTool("job_search_notes", { action: "read" })).text);
  assert.deepEqual(read.preferences.Role.map((p: any) => p.name), ["UI Designer"], "only active preferences");
  assert.deepEqual(read.memories.map((m: any) => [m.note, m.active, m.source]), [
    ["Avoid agencies", false, "Pattern"],
    ["Skip roles needing 5+ years", true, "Comment"],
  ]);

  await callTool("job_search_notes", { action: "update_memory", id, active: false });
  assert.equal((await loadNotes()).memories.find((m) => m.id === id)!.active, false);
  assert.equal((await loadNotes()).memories.find((m) => m.id === id)!.note, "Skip roles needing 5+ years", "unchanged wording is kept");
  const missing = await callTool("job_search_notes", { action: "update_memory", id: "nope", note: "x" });
  assert.equal(missing.isError, true);

  const page = (await open(cookie)).html;
  assert.match(page, /Skip roles needing 5\+ years/);
  assert.match(page, /Product Designer at Wise/);
});
