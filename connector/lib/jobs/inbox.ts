// What every stage that finds roles shares: the duplicate check against Job
// Applications, the advert text for each new role, and writing the new rows
// to the Inbox (Entry type Role, Review status New).

import { COL, COMPANIES, ENTRY, HIRING_SERVICES, NOTION, RECHECK, REVIEW } from "./config.js";
import { composio, type ComposioError } from "./composio.js";
import { dateValue, select, selectValue, text, textValue, titleValue, toggleBlock, url, urlValue, type Notion } from "./notion.js";
import { linkKey, roleKey } from "./prefs.js";

export interface Job {
  title: string;
  link: string;
  location: string;
  pay: string;
  advert: string;
}

export type Service = "Greenhouse" | "Lever" | "Ashby" | "Workable" | "Own site";

// A role about to go to the Inbox.
export interface Pending {
  company: string;
  // Where it came from: a hiring service, or "Job site" / "LinkedIn post".
  service: string;
  board: string;
  // The Source choice in Notion.
  source: string;
  job: Job;
  // Advert text from the source that is trusted at any length.
  trusted?: boolean;
}

export const plain = (html: string) =>
  html
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|li|h\d|br)>|<br\s*\/?>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*/g, "\n\n")
    .trim();

export const clip = (s: string) => (s.length > COMPANIES.advertChars ? `${s.slice(0, COMPANIES.advertChars).replace(/\s+\S*$/, "")} …` : s);

export async function getJson<T>(target: string): Promise<{ status: number; body: T | null }> {
  const response = await fetch(target, { headers: { accept: "application/json", "user-agent": RECHECK.userAgent }, signal: AbortSignal.timeout(RECHECK.pageTimeoutMs) });
  if (!response.ok) {
    await response.body?.cancel();
    return { status: response.status, body: null };
  }
  return { status: response.status, body: (await response.json()) as T };
}

// Advert text from Greenhouse's advert, or the advert page opened directly
// (free). Empty when the page won't open.
async function advertText(p: Pending): Promise<string> {
  try {
    if (p.service === "Greenhouse") {
      const id = /\/jobs\/(\d+)/.exec(p.job.link)?.[1] ?? /gh_jid=(\d+)/.exec(p.job.link)?.[1];
      if (!id) return "";
      const r = await getJson<{ content?: string }>(`${HIRING_SERVICES.greenhouse.list(p.board)}/${id}`);
      return r.body?.content ? plain(r.body.content) : "";
    }
    const response = await fetch(p.job.link, { headers: { "user-agent": RECHECK.userAgent, accept: "text/html" }, signal: AbortSignal.timeout(RECHECK.pageTimeoutMs) });
    if (!response.ok) {
      await response.body?.cancel();
      return "";
    }
    const html = await response.text();
    const main = /<main[\s\S]*?<\/main>/i.exec(html)?.[0] ?? /<body[\s\S]*<\/body>/i.exec(html)?.[0] ?? html;
    return plain(main);
  } catch {
    return "";
  }
}

export function namesRole(body: string, title: string): boolean {
  const words = title.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2).slice(0, 3);
  const low = body.toLowerCase();
  return words.every((w) => low.includes(w));
}

// Firecrawl's Markdown as plain reading text: images dropped, links kept as
// their words.
export function markdownText(md: string): string {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*|__/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export interface Existing {
  links: Set<string>;
  roles: Set<string>;
  // Companies with a Needs Claude row still waiting.
  needsClaude: Set<string>;
}

// Every Role and Application row, rejected ones included, so a role is never
// added twice.
export async function loadExisting(client: Notion): Promise<Existing> {
  const rows = [
    ...(await client.query(NOTION.applications, { property: COL.entryType, select: { equals: ENTRY.role } })),
    ...(await client.query(NOTION.applications, { property: COL.entryType, select: { equals: ENTRY.application } })),
  ];
  const existing: Existing = { links: new Set(), roles: new Set(), needsClaude: new Set() };
  for (const page of rows) {
    const p = page.properties;
    const name = text(p[COL.name]);
    const link = linkKey(url(p[COL.links]));
    if (link) existing.links.add(link);
    if (text(p[COL.role])) existing.roles.add(roleKey(name, text(p[COL.role])));
    if (select(p[COL.reviewStatus]) === REVIEW.needsClaude) existing.needsClaude.add(name.toLowerCase());
  }
  return existing;
}

// true when the role is new; it is then counted as seen.
// Other links for the same advert (its job-site copy) count too.
export function claim(existing: Existing, company: string, job: Job, otherLinks: string[] = []): boolean {
  const links = [job.link, ...otherLinks].map(linkKey).filter(Boolean);
  const role = roleKey(company, job.title);
  if (links.some((l) => existing.links.has(l)) || existing.roles.has(role)) return false;
  links.forEach((l) => existing.links.add(l));
  existing.roles.add(role);
  return true;
}

export interface AdvertCounts {
  advert_from_list: number;
  advert_from_page: number;
  advert_from_firecrawl: number;
  advert_missing: number;
  firecrawl_pages: number;
}

// Advert text for each new role, in order: the source's own text, the advert
// page opened directly, the advert page through Firecrawl (for pages that
// block the server or only load in a browser).
export async function fillAdverts(pending: Pending[], deadlineAt: number): Promise<{ counts: AdvertCounts; charge: number; failures: { where: string; error: string }[] }> {
  const counts: AdvertCounts = { advert_from_list: 0, advert_from_page: 0, advert_from_firecrawl: 0, advert_missing: 0, firecrawl_pages: 0 };
  const failures: { where: string; error: string }[] = [];
  let charge = 0;
  const minChars = COMPANIES.minAdvertChars;
  await Promise.all(
    pending.map(async (p) => {
      if (p.job.advert) {
        const given = clip(/<[a-z][^>]*>/i.test(p.job.advert) ? plain(p.job.advert) : p.job.advert.trim());
        if (p.trusted || given.length >= minChars) {
          p.job.advert = given;
          counts.advert_from_list++;
          return;
        }
        p.job.advert = "";
      }
      if (Date.now() > deadlineAt) return;
      const body = clip(await advertText(p));
      // A page that doesn't name the role is a shell or a cookie notice.
      if ((p.service === "Greenhouse" && body.length > 0) || (body.length >= minChars && namesRole(body, p.job.title))) {
        p.job.advert = body;
        counts.advert_from_page++;
      }
    }),
  );
  const unread = pending.filter((p) => !p.job.advert && /^https?:/i.test(p.job.link)).slice(0, COMPANIES.maxFirecrawlAdverts);
  if (unread.length && Date.now() < deadlineAt) {
    try {
      const pages = await (await composio()).readPages(
        unread.map((p, i) => ({ id: String(i), url: p.job.link })),
        { keywords: [], headChars: COMPANIES.advertChars * 2, mainOnly: true },
      );
      for (const page of pages) {
        charge += page.charge ?? 0;
        counts.firecrawl_pages++;
        const body = page.ok ? clip(markdownText(page.head)) : "";
        if (body.length >= minChars) {
          unread[Number(page.id)].job.advert = body;
          counts.advert_from_firecrawl++;
        }
      }
    } catch (error) {
      failures.push({ where: "Firecrawl through Composio (advert text)", error: (error as ComposioError).friendly ?? (error as Error).message });
    }
  }
  counts.advert_missing = pending.filter((p) => !p.job.advert).length;
  return { counts, charge, failures };
}

export async function createRow(client: Notion, properties: Record<string, unknown>, children: unknown[] | undefined, what: string): Promise<{ where: string; error: string } | null> {
  try {
    await client.create(NOTION.applications, properties, children);
    return null;
  } catch (error) {
    return { where: `add ${what}`, error: (error as any).friendly ?? (error as Error).message };
  }
}

// Writes the new roles to the Inbox, with the advert text in a folded
// "Advert" section of each page.
export async function writeRoles(client: Notion, pending: Pending[], today: string, deadlineAt: number): Promise<{ where: string; error: string }[]> {
  const failures: { where: string; error: string }[] = [];
  for (const p of pending) {
    if (Date.now() > deadlineAt) {
      failures.push({ where: "time limit", error: `${pending.length - pending.indexOf(p)} roles not written; they'll be found again next run` });
      break;
    }
    const failed = await createRow(
      client,
      {
        [COL.name]: titleValue(p.company),
        [COL.role]: textValue(p.job.title),
        [COL.entryType]: selectValue(ENTRY.role),
        [COL.reviewStatus]: selectValue(REVIEW.new),
        [COL.source]: selectValue(p.source),
        [COL.links]: urlValue(p.job.link),
        [COL.roleLocation]: textValue(p.job.location),
        [COL.pay]: textValue(p.job.pay),
        [COL.dateFound]: dateValue(today),
      },
      p.job.advert ? [toggleBlock("Advert", p.job.advert)] : undefined,
      `${p.company} ${p.job.title}`,
    );
    if (failed) failures.push(failed);
  }
  return failures;
}
