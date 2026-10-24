import { strict as assert } from "node:assert";
import { beforeEach, test } from "node:test";
import { freshStore, memoryInbox } from "./helpers.js";
import { callTool } from "../lib/mcp.js";
import { inboxRow } from "../lib/jobs/inbox.js";
import { useInbox } from "../lib/jobs/inboxstore.js";
import { useNotion, type Notion, type NotionPage } from "../lib/jobs/notion.js";

let box = memoryInbox();
let created: { properties: any; children?: any[] }[] = [];
const notionRows: NotionPage[] = [];

beforeEach(async () => {
  await freshStore(false);
  box = memoryInbox();
  useInbox(box);
  created = [];
  notionRows.length = 0;
  const client: Notion = {
    async query(_ds, filter: any) {
      return notionRows.filter((p) => p.properties["Entry type"].select?.name === filter?.select?.equals);
    },
    async update() {},
    async create(_ds, properties, children) {
      created.push({ properties, children });
      return `1234abcd-0000-0000-0000-00000000000${created.length}`;
    },
  };
  useNotion(client);
});

const tool = async (args: Record<string, unknown>) => {
  const r = await callTool("job_search_inbox", args);
  return { ...r, body: r.isError ? null : JSON.parse(r.text) };
};

async function seed() {
  await box.insert([
    { ...inboxRow({ company: "Monzo", title: "Product Designer", link: "https://monzo.com/careers/1", location: "London", pay: "£50k", source: "Indeed", advert: "Design money tools. ".repeat(30) }, "2026-10-24"), id: "r1" },
    { ...inboxRow({ company: "Bigblue", title: "Graphic Designer", link: "https://linkedin.com/posts/b", source: "LinkedIn post", advert: "Hiring a graphic designer" }, "2026-10-24"), id: "r2" },
    { ...inboxRow({ company: "Craft Docs", link: "https://craft.do/careers", source: "Careers page", reason: "The server couldn't read the careers page." }, "2026-10-24", "needs_claude"), id: "c1" },
  ]);
}

test("list shows waiting rows without advert text, and read gives the advert", async () => {
  await seed();
  const list = await tool({ action: "list" });
  assert.deepEqual(list.body.rows.map((r: any) => [r.id, r.kind]), [["r1", "role"], ["r2", "role"], ["c1", "needs_claude"]]);
  assert.equal(list.body.rows[0].advert, undefined);
  assert.ok(list.body.rows[0].advert_chars > 300);
  assert.match(list.body.rows[2].reason, /couldn't read/);
  const read = await tool({ action: "read", ids: ["r1"] });
  assert.match(read.body.rows[0].advert, /Design money tools/);
  assert.equal(read.body.rows[0].keys, undefined, "duplicate-check keys stay inside");
  assert.doesNotMatch(list.text, /Search cost/);
});

test("add writes a kept role to Open Roles with the review and advert, and marks it added", async () => {
  await seed();
  const added = await tool({
    action: "add",
    id: "r1",
    level: "Mid",
    summary: "Designs money tools.",
    company_description: "Monzo is a UK digital bank.",
    role_description: "A product designer for money tools.",
    candidate_potential: "Strong",
    why_it_matches: "London Product Designer.",
    positives: ["Good pay"],
    negatives: ["Office 3 days", "Short contract", "Vague duties", "a fourth is dropped"],
  });
  assert.equal(added.isError, false, added.text);
  assert.equal(added.body.added.notion_url, "https://app.notion.com/p/1234abcd000000000000000000000001");
  const page = created[0];
  const prop = (name: string) => page.properties[name];
  assert.equal(prop("Name").title[0].text.content, "Monzo");
  assert.equal(prop("Role").rich_text[0].text.content, "Product Designer");
  assert.equal(prop("Review status").select.name, "Added");
  assert.equal(prop("Advert status").select.name, "Active");
  assert.equal(prop("Tag").select.name, "New");
  assert.equal(prop("Level").select.name, "Mid");
  assert.equal(prop("Candidate potential").select.name, "Strong");
  assert.equal(prop("Source").select.name, "Indeed");
  assert.equal(prop("Date found").date.start, "2026-10-24");
  assert.equal(prop("Pay").rich_text[0].text.content, "£50k");
  const kinds = page.children!.map((b: any) => (b.type === "paragraph" ? b.paragraph.rich_text.map((t: any) => (t.annotations?.bold ? `**${t.text.content}**` : t.text.content)).join("") : b.type));
  assert.deepEqual(kinds, [
    "**Company:** Monzo is a UK digital bank.",
    "**Role:** A product designer for money tools.",
    "**Positives**",
    "bulleted_list_item",
    "**Negatives**",
    "bulleted_list_item",
    "bulleted_list_item",
    "bulleted_list_item",
    "toggle",
  ]);
  assert.ok(!page.children!.some((b: any) => b.type.startsWith("heading")), "no headings");
  const row = box.rows.find((r) => r.id === "r1")!;
  assert.equal(row.status, "added");
  assert.equal(row.notion_url, added.body.added.notion_url);
  const again = await tool({ action: "add", id: "r1", company_description: "x.", role_description: "y." });
  assert.match(again.text, /already added/);
});

test("reject records the reason; company rows can't be added as roles", async () => {
  await seed();
  await tool({ action: "reject", id: "r2", reason: "Not one of your Role preferences (Graphic Designer)." });
  const row = box.rows.find((r) => r.id === "r2")!;
  assert.equal(row.status, "rejected");
  assert.match(row.reason!, /Graphic Designer/);
  assert.ok(row.reviewed_at);
  assert.deepEqual((await tool({ action: "list" })).body.rows.map((r: any) => r.id), ["r1", "c1"]);
  const wrong = await tool({ action: "add", id: "c1", company_description: "x.", role_description: "y." });
  assert.match(wrong.text, /company to check/);
  assert.equal((await tool({ action: "reject", id: "nope" })).isError, true);
});

test("a role Claude found itself is checked for duplicates, then added and remembered", async () => {
  await seed();
  notionRows.push({ id: "n1", properties: { Name: { title: [{ plain_text: "Framer" }] }, Role: { rich_text: [{ plain_text: "UI Designer" }] }, Links: { url: "https://framer.com/careers/ui" }, "Entry type": { select: { name: "Role" } }, "Review status": { select: { name: "Added" } } } });
  const describe = { company_description: "A company.", role_description: "A role." };
  const dupNotion = await tool({ action: "add", company: "Framer", title: "UI Designer", link: "https://framer.com/careers/ui?utm_source=x", source: "Careers page", ...describe });
  assert.match(dupNotion.text, /already in Job Applications or the Inbox/);
  const dupInbox = await tool({ action: "add", company: "Monzo", title: "Product Designer", link: "https://monzo.com/careers/1", source: "Careers page", ...describe });
  assert.match(dupInbox.text, /already in/);
  assert.equal((await tool({ action: "add", company: "Craft Docs", ...describe })).isError, true, "needs a title and link");
  const undescribed = await tool({ action: "add", company: "Craft Docs", title: "Product Designer", link: "https://craft.do/careers/pd", source: "Careers page" });
  assert.match(undescribed.text, /company_description and role_description/, "both descriptions are required");

  const ok = await tool({ action: "add", company: "Craft Docs", title: "Product Designer", link: "https://craft.do/careers/pd", source: "Careers page", level: "Junior", candidate_potential: "Average", ...describe });
  assert.equal(ok.isError, false, ok.text);
  assert.equal(created.length, 1);
  assert.equal(created[0].properties.Source.select.name, "Careers page");
  const remembered = box.rows.find((r) => r.title === "Product Designer" && r.company === "Craft Docs")!;
  assert.equal(remembered.status, "added");
  assert.ok(remembered.keys.includes("craft.do/careers/pd"));
  const twice = await tool({ action: "add", company: "Craft Docs", title: "Product Designer", link: "https://craft.do/careers/pd", source: "Careers page", ...describe });
  assert.match(twice.text, /already in/);
});
