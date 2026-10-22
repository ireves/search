// Stage 1 of the daily run: check whether the roles already found are still
// open, and set each one's Advert status (Active, Almost Gone or Closed).
// Only Advert status is ever changed. Application rows (Watch or Applied) are
// checked too but never changed: a closed one is listed in the report so the
// Claude run can mention it.

import { ADVERT, CLOSED_PHRASES, COL, ENTRY, HIRING_SERVICES, NOTION, RECHECK, REVIEW_ADDED, TAG_NOT_FOR_ME, WATCHED_STATUSES } from "./config.js";
import { dateStart, notion, select, selectValue, text, url, type NotionPage } from "./notion.js";

export interface Role {
  id: string;
  name: string;
  role: string;
  link: string | null;
  deadline: string | null;
  advertStatus: string | null;
}

export type LinkState = "open" | "closed" | "unknown";

export interface LinkCheck {
  state: LinkState;
  how: string;
}

export interface RecheckItem {
  name: string;
  role: string;
  link: string | null;
  from: string | null;
  to: string | null;
  how: string;
}

export interface RecheckResult {
  counts: { roles: number; checked: number; open: number; closed: number; unknown: number; changed: number; watched: number; watched_closed: number; skipped_for_time: number };
  changes: RecheckItem[];
  unknown: RecheckItem[];
  watchedClosed: RecheckItem[];
  failures: { where: string; error: string }[];
}

export function toRole(page: NotionPage): Role {
  const p = page.properties;
  return {
    id: page.id,
    name: text(p[COL.name]),
    role: text(p[COL.role]),
    link: url(p[COL.links]),
    deadline: dateStart(p[COL.deadline]),
    advertStatus: select(p[COL.advertStatus]),
  };
}

// Today's date in the UK, as YYYY-MM-DD.
export function ukToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: RECHECK.timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to.slice(0, 10)}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

// The Advert status a role should have, or null to leave it as it is.
export function decide(check: LinkCheck, deadline: string | null, today: string): { status: string | null; how: string } {
  if (check.state === "closed") return { status: ADVERT.closed, how: check.how };
  if (deadline) {
    const left = daysBetween(today, deadline);
    if (left < 0) return { status: ADVERT.closed, how: `closing date ${deadline.slice(0, 10)} has passed` };
    if (left <= RECHECK.almostGoneDays) return { status: ADVERT.almostGone, how: `closes ${deadline.slice(0, 10)}` };
  }
  if (check.state === "open") return { status: ADVERT.active, how: check.how };
  return { status: null, how: check.how };
}

// Visible text of a page, in lower case, without scripts and styles.
function visibleText(html: string): string {
  return html
    .replace(/<(script|style|noscript|template)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function closedPhrase(html: string): string | null {
  const body = visibleText(html);
  return CLOSED_PHRASES.find((phrase) => body.includes(phrase)) ?? null;
}

async function get(target: string, accept = "application/json"): Promise<Response> {
  return fetch(target, {
    headers: { "user-agent": RECHECK.userAgent, accept, "accept-language": "en-GB,en;q=0.9" },
    redirect: "follow",
    signal: AbortSignal.timeout(RECHECK.pageTimeoutMs),
  });
}

const failed = (error: unknown): LinkCheck => ({
  state: "unknown",
  how: (error as Error).name === "TimeoutError" || (error as Error).name === "AbortError" ? "took too long to load" : "couldn't be reached",
});

// Answers from a hiring service's own job list, without opening the page.
async function checkHiringService(link: string): Promise<LinkCheck | null> {
  const gh = HIRING_SERVICES.greenhouse.link.exec(link);
  const lever = HIRING_SERVICES.lever.link.exec(link);
  if (gh || lever) {
    const [service, job] = gh ? ["Greenhouse", HIRING_SERVICES.greenhouse.job(!!gh[1], gh[2], gh[3])] : ["Lever", HIRING_SERVICES.lever.job(!!lever![1], lever![2], lever![3])];
    try {
      const response = await get(job);
      await response.body?.cancel();
      if (response.status === 200) return { state: "open", how: `listed on ${service}` };
      if (response.status === 404) return { state: "closed", how: `no longer listed on ${service}` };
      return { state: "unknown", how: `${service} answered ${response.status}` };
    } catch (error) {
      return failed(error);
    }
  }
  const ashby = HIRING_SERVICES.ashby.link.exec(link);
  if (ashby) {
    try {
      const response = await get(HIRING_SERVICES.ashby.list(ashby[1]));
      if (response.status !== 200) {
        await response.body?.cancel();
        return { state: "unknown", how: `Ashby answered ${response.status}` };
      }
      const board = (await response.json()) as { jobs?: { id?: string; jobUrl?: string }[] };
      if (!Array.isArray(board.jobs)) return { state: "unknown", how: "Ashby's list was unreadable" };
      const id = ashby[2].toLowerCase();
      const listed = board.jobs.some((j) => j.id?.toLowerCase() === id || j.jobUrl?.toLowerCase().includes(id));
      return listed ? { state: "open", how: "listed on Ashby" } : { state: "closed", how: "no longer listed on Ashby" };
    } catch (error) {
      return failed(error);
    }
  }
  return null;
}

const pathOf = (link: string) => {
  try {
    return new URL(link).pathname.replace(/\/+$/, "").toLowerCase();
  } catch {
    return "";
  }
};

export async function checkLink(link: string | null): Promise<LinkCheck> {
  if (!link || !/^https?:\/\//i.test(link)) return { state: "unknown", how: "no advert link" };
  const fromService = await checkHiringService(link);
  if (fromService) return fromService;
  let response: Response;
  try {
    response = await get(link, "text/html,application/xhtml+xml");
  } catch (error) {
    return failed(error);
  }
  if (response.status === 404 || response.status === 410) {
    await response.body?.cancel();
    return { state: "closed", how: `advert page is gone (${response.status})` };
  }
  if (response.status !== 200) {
    await response.body?.cancel();
    const blocked = response.status === 401 || response.status === 403 || response.status === 429;
    return { state: "unknown", how: blocked ? `site blocked the check (${response.status})` : `site answered ${response.status}` };
  }
  const html = (await response.text()).slice(0, 2_000_000);
  const phrase = closedPhrase(html);
  if (phrase) return { state: "closed", how: `page says "${phrase}"` };
  // A closed advert often sends visitors on to a list of jobs instead.
  if (response.url && response.redirected && pathOf(response.url) !== pathOf(link)) return { state: "unknown", how: "advert link now leads to another page" };
  return { state: "open", how: "advert page is up" };
}

async function inBatches<T>(items: T[], size: number, deadlineAt: number, work: (item: T) => Promise<void>): Promise<number> {
  let next = 0;
  let skipped = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++];
      if (Date.now() > deadlineAt) {
        skipped++;
        continue;
      }
      await work(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
  return skipped;
}

export async function runRecheck(options: { dry: boolean; now?: Date; budgetMs?: number }): Promise<RecheckResult> {
  const today = ukToday(options.now);
  const deadlineAt = Date.now() + (options.budgetMs ?? RECHECK.budgetMs);
  const client = await notion();
  const result: RecheckResult = {
    counts: { roles: 0, checked: 0, open: 0, closed: 0, unknown: 0, changed: 0, watched: 0, watched_closed: 0, skipped_for_time: 0 },
    changes: [],
    unknown: [],
    watchedClosed: [],
    failures: [],
  };

  const rolePages = await client.query(NOTION.applications, {
    and: [
      { property: COL.entryType, select: { equals: ENTRY.role } },
      { property: COL.reviewStatus, select: { equals: REVIEW_ADDED } },
    ],
  });
  // Filtered here too, so a change in how Notion treats empty values can't
  // let other rows through.
  const roles = rolePages
    .filter((p) => select(p.properties[COL.entryType]) === ENTRY.role && select(p.properties[COL.reviewStatus]) === REVIEW_ADDED)
    .filter((p) => select(p.properties[COL.advertStatus]) !== ADVERT.closed && select(p.properties[COL.tag]) !== TAG_NOT_FOR_ME)
    .map(toRole);
  const watchedPages = await client.query(NOTION.applications, { property: COL.entryType, select: { equals: ENTRY.application } });
  const watched = watchedPages.filter((p) => WATCHED_STATUSES.includes(select(p.properties[COL.status]) ?? "")).map(toRole);
  result.counts.roles = roles.length;
  result.counts.watched = watched.length;

  const updates: { role: Role; status: string; how: string }[] = [];
  result.counts.skipped_for_time += await inBatches(roles, RECHECK.concurrency, deadlineAt, async (role) => {
    const check = await checkLink(role.link);
    result.counts.checked++;
    result.counts[check.state]++;
    const { status, how } = decide(check, role.deadline, today);
    const item = { name: role.name, role: role.role, link: role.link, from: role.advertStatus, to: status, how };
    if (status === null) result.unknown.push(item);
    else if (status !== role.advertStatus) updates.push({ role, status, how });
  });

  // Application rows: report only. Only those with an advert link are checked.
  result.counts.skipped_for_time += await inBatches(
    watched.filter((w) => w.link),
    RECHECK.concurrency,
    deadlineAt,
    async (row) => {
      const check = await checkLink(row.link);
      const { status, how } = decide(check, row.deadline, today);
      if (status === ADVERT.closed) {
        result.counts.watched_closed++;
        result.watchedClosed.push({ name: row.name, role: row.role, link: row.link, from: null, to: null, how });
      }
    },
  );

  for (const { role, status, how } of updates) {
    const item = { name: role.name, role: role.role, link: role.link, from: role.advertStatus, to: status, how };
    if (!options.dry) {
      try {
        await client.update(role.id, { [COL.advertStatus]: selectValue(status) });
      } catch (error) {
        result.failures.push({ where: `update ${role.name} ${role.role}`.trim(), error: (error as any).friendly ?? (error as Error).message });
        continue;
      }
    }
    result.counts.changed++;
    result.changes.push(item);
  }
  return result;
}
