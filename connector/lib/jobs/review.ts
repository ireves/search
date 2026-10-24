// Claude's review of the Inbox (the job_search_inbox tool, lib/jobs/mcp.ts).
// A kept role becomes a Role row in Notion's Open Roles (Review status
// Added). Its page holds a one-sentence description of the company and of
// the role, then Positives, Negatives and the advert text; a
// rejected one stays in the Inbox with the reason. Roles Claude found itself
// (careers pages the server couldn't read) are checked for duplicates first
// and recorded in the Inbox too, so they're never added twice.

import { ADVERT, COL, ENTRY, INBOX, NOTION, REVIEW, SOURCE_CAREERS } from "./config.js";
import { claim, inboxRow, loadExisting } from "./inbox.js";
import { inbox, type InboxRow } from "./inboxstore.js";
import { dateValue, notion, selectValue, textValue, titleValue, toggleBlock, urlValue } from "./notion.js";
import { ukToday } from "./recheck.js";

export interface Keep {
  id?: string;
  company?: string;
  title?: string;
  link?: string;
  source?: string;
  location?: string;
  level?: string;
  pay?: string;
  deadline?: string;
  advert_status?: string;
  summary?: string;
  company_description?: string;
  role_description?: string;
  candidate_potential?: string;
  why_it_matches?: string;
  positives?: string[];
  negatives?: string[];
}

const pick = (list: string[], value: unknown, fallback: string | null) => (list.includes(value as string) ? (value as string) : fallback);
const lines = (list: unknown) => (Array.isArray(list) ? list.map((x) => String(x).trim()).filter(Boolean).slice(0, 3) : []);

// A paragraph in bold, used as a label ("Positives"), or a bold label
// followed by plain text on the same line.
function bold(label: string, rest = ""): unknown {
  const rich_text: unknown[] = [{ type: "text", text: { content: label }, annotations: { bold: true } }];
  if (rest) rich_text.push({ type: "text", text: { content: ` ${rest.slice(0, 1900)}` } });
  return { object: "block", type: "paragraph", paragraph: { rich_text } };
}

function bullet(content: string): unknown {
  return { object: "block", type: "bulleted_list_item", bulleted_list_item: { rich_text: [{ type: "text", text: { content: content.slice(0, 2000) } }] } };
}

const pageLink = (id: string) => `https://app.notion.com/p/${id.replace(/-/g, "")}`;

export class ReviewError extends Error {}

// Writes a kept role to Open Roles and marks its Inbox row added.
export async function keepRole(input: Keep, now?: Date): Promise<{ id: string; notion_url: string }> {
  const companyText = input.company_description?.trim() ?? "";
  const roleText = input.role_description?.trim() ?? "";
  if (!companyText || !roleText) throw new ReviewError("Give company_description and role_description, one sentence each.");
  const store = await inbox();
  const today = ukToday(now);
  let row: InboxRow | undefined;
  if (input.id) {
    row = (await store.byIds([input.id]))[0];
    if (!row) throw new ReviewError(`No Inbox row with id ${input.id}. Call list for the ids.`);
    if (row.status !== "new") throw new ReviewError(`That row was already ${row.status}${row.notion_url ? ` (${row.notion_url})` : ""}.`);
    if (row.kind !== "role") throw new ReviewError("That row is a company to check, not a role. Add the roles you find there without an id, then reject the company row.");
  } else {
    if (!input.company?.trim() || !input.title?.trim() || !input.link?.trim()) throw new ReviewError("Without an id, give company, title and link.");
    const existing = await loadExisting(await notion());
    if (!claim(existing, input.company, { title: input.title, link: input.link, location: "", pay: "", advert: "" })) {
      throw new ReviewError(`${input.title} at ${input.company} is already in Job Applications or the Inbox.`);
    }
    row = inboxRow({ company: input.company, title: input.title, link: input.link, location: input.location, pay: input.pay, source: input.source ?? SOURCE_CAREERS }, today);
  }

  const company = input.company?.trim() || row.company;
  const title = input.title?.trim() || row.title || "";
  const deadline = /^\d{4}-\d{2}-\d{2}$/.test(input.deadline ?? "") ? input.deadline! : null;
  const properties: Record<string, unknown> = {
    [COL.name]: titleValue(company),
    [COL.role]: textValue(title),
    [COL.entryType]: selectValue(ENTRY.role),
    [COL.reviewStatus]: selectValue(REVIEW.added),
    [COL.advertStatus]: selectValue(pick(INBOX.advertStatuses, input.advert_status, ADVERT.active)!),
    [COL.tag]: selectValue("New"),
    [COL.links]: urlValue(input.link?.trim() || row.link),
    [COL.roleLocation]: textValue(input.location ?? row.location ?? ""),
    [COL.level]: selectValue(pick(INBOX.levels, input.level, "Unknown")!),
    [COL.pay]: textValue(input.pay ?? row.pay ?? "Not listed"),
    [COL.dateFound]: dateValue(row.found),
    [COL.summary]: textValue(input.summary ?? ""),
    [COL.why]: textValue(input.why_it_matches ?? ""),
    [COL.deadline]: dateValue(deadline),
  };
  const potential = pick(INBOX.potentials, input.candidate_potential, null);
  if (potential) properties[COL.potential] = selectValue(potential);
  const source = input.source ?? row.source;
  if (source) properties[COL.source] = selectValue(source);
  const positives = lines(input.positives);
  const negatives = lines(input.negatives);
  const children = [
    bold("Company:", companyText),
    bold("Role:", roleText),
    ...(positives.length ? [bold("Positives"), ...positives.map(bullet)] : []),
    ...(negatives.length ? [bold("Negatives"), ...negatives.map(bullet)] : []),
    ...(row.advert ? [toggleBlock("Advert", row.advert)] : []),
  ];

  const pageId = await (await notion()).create(NOTION.applications, properties, children);
  const notion_url = pageLink(pageId);
  const reviewed = { status: "added" as const, notion_url, reviewed_at: new Date().toISOString() };
  if (input.id) await store.update(row.id, reviewed);
  else await store.insert([{ ...row, ...reviewed }]);
  return { id: row.id, notion_url };
}

export async function rejectRow(id: string, reason: string): Promise<void> {
  const store = await inbox();
  const row = (await store.byIds([id]))[0];
  if (!row) throw new ReviewError(`No Inbox row with id ${id}. Call list for the ids.`);
  if (row.status !== "new") throw new ReviewError(`That row was already ${row.status}.`);
  await store.update(id, { status: "rejected", reason: reason.trim().slice(0, 1000) || "Rejected by Claude", reviewed_at: new Date().toISOString() });
}
