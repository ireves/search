// Stage 2 of the daily run: read the job lists of the companies and job sites
// checked longest ago, keep the roles that could suit, and add each new one
// to Job Applications as a Role row for Claude to review (Review status New).
//   - On a hiring service (Greenhouse, Lever, Ashby, Workable): its free job
//     list, with each advert's text where the list gives it.
//   - Own site: the careers page through Firecrawl (Composio), keeping links
//     whose text names a wanted role. A hiring-service link found on the page
//     is saved so the free list is used next time.
//   - Nothing worked: a Role row with Review status "Needs Claude".
// Each company's Last checked, Last result, Hiring service and Board ID are
// updated. Nothing here applies for a job or signs in anywhere.

import { COL, COMPANIES, COMPOSIO, ENTRY, HIRING_SERVICES, RESULT, REVIEW, SEARCHES, SOURCE_CAREERS } from "./config.js";
import { composio, ComposioError, type PageResult } from "./composio.js";
import { claim, createRow, fillAdverts, getJson, loadExisting, plain, writeRoles, type Job, type Pending, type Service } from "./inbox.js";
import { dateValue, notion, selectValue, textValue, titleValue, urlValue } from "./notion.js";
import { excludedBy, linkKey, locationWanted, readPreferences, roleWords, titleWanted, type Preference } from "./prefs.js";
import { ukToday } from "./recheck.js";


export interface CompanyReport {
  name: string;
  how: string;
  result: string;
  listed: number;
  kept: number;
  added: string[];
  dropped: { title: string; why: string }[];
  // Characters of advert text saved for each added role.
  adverts?: Record<string, number>;
  error?: string;
}

export interface CompaniesResult {
  counts: {
    companies: number;
    listed: number;
    kept: number;
    added: number;
    duplicates: number;
    needs_claude: number;
    firecrawl_pages: number;
    advert_from_list: number;
    advert_from_page: number;
    advert_from_firecrawl: number;
    advert_missing: number;
  };
  companies: CompanyReport[];
  failures: { where: string; error: string }[];
  charge: number;
}

// Which hiring service a careers link belongs to, and the board name.
export function serviceOf(link: string | null): { service: Service; board: string } | null {
  if (!link) return null;
  for (const key of ["greenhouse", "lever", "ashby", "workable"] as const) {
    const m = HIRING_SERVICES[key].board.exec(link);
    if (m && !["embed", "v1", "jobs"].includes(m[1].toLowerCase())) return { service: HIRING_SERVICES[key].name as Service, board: m[1] };
  }
  return null;
}

// A hiring service's free job list. null means it couldn't be read.
export async function serviceJobs(service: Service, board: string): Promise<{ jobs: Job[]; error?: string } | null> {
  try {
    if (service === "Greenhouse") {
      const r = await getJson<{ jobs?: any[] }>(HIRING_SERVICES.greenhouse.list(board));
      if (!r.body || !Array.isArray(r.body.jobs)) return { jobs: [], error: `Greenhouse answered ${r.status}` };
      return { jobs: r.body.jobs.map((j) => ({ title: j.title ?? "", link: j.absolute_url ?? "", location: j.location?.name ?? "", pay: "", advert: "" })) };
    }
    if (service === "Lever") {
      const r = await getJson<any[]>(HIRING_SERVICES.lever.list(board));
      if (!Array.isArray(r.body)) return { jobs: [], error: `Lever answered ${r.status}` };
      return {
        jobs: r.body.map((j) => ({
          title: j.text ?? "",
          link: j.hostedUrl ?? "",
          location: [j.categories?.location, ...(j.categories?.allLocations ?? [])].filter(Boolean).join("; "),
          pay: j.salaryRange ? `${j.salaryRange.min ?? ""}-${j.salaryRange.max ?? ""} ${j.salaryRange.currency ?? ""} ${j.salaryRange.interval ?? ""}`.trim() : "",
          advert: [j.descriptionPlain, ...(j.lists ?? []).map((l: any) => `${l.text}\n${plain(l.content ?? "")}`), j.additionalPlain].filter(Boolean).join("\n\n"),
        })),
      };
    }
    if (service === "Ashby") {
      const r = await getJson<{ jobs?: any[] }>(HIRING_SERVICES.ashby.list(board));
      if (!r.body || !Array.isArray(r.body.jobs)) return { jobs: [], error: `Ashby answered ${r.status}` };
      return {
        jobs: r.body.jobs
          .filter((j) => j.isListed !== false)
          .map((j) => ({
            title: j.title ?? "",
            link: j.jobUrl ?? "",
            location: [j.location, ...(j.secondaryLocations ?? []).map((l: any) => l.location)].filter(Boolean).join("; ") + (j.isRemote ? "; Remote" : ""),
            pay: j.compensation?.compensationTierSummary ?? "",
            advert: j.descriptionPlain ?? "",
          })),
      };
    }
    if (service === "Workable") {
      const r = await getJson<{ jobs?: any[] }>(HIRING_SERVICES.workable.list(board));
      if (!r.body || !Array.isArray(r.body.jobs)) return null;
      return {
        jobs: r.body.jobs.map((j) => ({
          title: j.title ?? "",
          link: j.url ?? j.shortlink ?? "",
          location: [j.city, j.state, j.country, j.telecommuting ? "Remote" : ""].filter(Boolean).join(", "),
          pay: "",
          advert: "",
        })),
      };
    }
  } catch (error) {
    return { jobs: [], error: (error as Error).name === "TimeoutError" ? `${service} took too long` : `${service} couldn't be reached` };
  }
  return null;
}

// Own-site links that look like job adverts: on the same site (or a hiring
// service), not the careers page itself, and named after a wanted role.
export function jobsFromPage(page: PageResult, careersPage: string): Job[] {
  let host = "";
  try {
    host = new URL(careersPage).hostname.replace(/^www\./, "");
  } catch {
    return [];
  }
  const self = linkKey(careersPage);
  const jobs: Job[] = [];
  for (const [title, link] of page.matches) {
    let target: URL;
    try {
      target = new URL(link);
    } catch {
      continue;
    }
    const sameSite = target.hostname.replace(/^www\./, "").endsWith(host.split(".").slice(-2).join("."));
    if (!sameSite && !serviceOf(link)) continue;
    if (linkKey(link) === self || target.pathname.replace(/\/+$/, "") === "") continue;
    jobs.push({ title, link, location: "", pay: "", advert: "" });
  }
  return jobs;
}

export async function runCompanies(options: { dry: boolean; now?: Date; budgetMs?: number }): Promise<CompaniesResult> {
  const today = ukToday(options.now);
  const deadlineAt = Date.now() + (options.budgetMs ?? COMPANIES.budgetMs);
  const client = await notion();
  const prefs = await readPreferences(client);
  const result: CompaniesResult = {
    counts: { companies: 0, listed: 0, kept: 0, added: 0, duplicates: 0, needs_claude: 0, firecrawl_pages: 0, advert_from_list: 0, advert_from_page: 0, advert_from_firecrawl: 0, advert_missing: 0 },
    companies: [],
    failures: [],
    charge: 0,
  };

  const chosen = prefs.sources
    .filter((s) => !(s.link && COMPANIES.skipSites.some((re) => re.test(hostOf(s.link!)))))
    .sort((a, b) => (a.lastChecked ?? "").localeCompare(b.lastChecked ?? ""))
    .slice(0, COMPANIES.perRun);
  result.counts.companies = chosen.length;

  // What's already in Job Applications, to leave out duplicates.
  const existing = await loadExisting(client);

  // Own-site pages go to Firecrawl together, in one workbench call.
  const plan = chosen.map((company) => {
    const known = company.hiringService && company.hiringService !== "Own site" && company.boardId ? { service: company.hiringService as Service, board: company.boardId } : null;
    return { company, found: known ?? serviceOf(company.link) };
  });
  const listed = new Map<string, { jobs: Job[]; service: Service; board: string; how: string; result: string; error?: string }>();
  const toScrape: { company: Preference; page: string }[] = [];
  await Promise.all(
    plan.map(async ({ company, found }) => {
      if (!company.link) return;
      if (found) {
        const read = await serviceJobs(found.service, found.board);
        if (read && !read.error) {
          listed.set(company.id, { jobs: read.jobs, service: found.service, board: found.board, how: `${found.service} job list`, result: RESULT.ok });
          return;
        }
        if (found.service !== "Workable") {
          listed.set(company.id, { jobs: [], service: found.service, board: found.board, how: `${found.service} job list`, result: RESULT.needsClaude, error: read?.error ?? "unreadable" });
          return;
        }
        toScrape.push({ company, page: HIRING_SERVICES.workable.page(found.board) });
        return;
      }
      toScrape.push({ company, page: company.link });
    }),
  );

  if (toScrape.length) {
    let pages: PageResult[] = [];
    try {
      const fc = await composio();
      pages = await fc.readPages(
        toScrape.map((s) => ({ id: s.company.id, url: s.page })),
        { keywords: roleWords(prefs).length ? roleWords(prefs) : ["design"], headChars: 0, mainOnly: false },
      );
    } catch (error) {
      const message = (error as ComposioError).friendly ?? (error as Error).message;
      result.failures.push({ where: "Firecrawl through Composio", error: message });
    }
    result.counts.firecrawl_pages += pages.length;
    for (const s of toScrape) {
      const page = pages.find((p) => p.id === s.company.id);
      result.charge += page?.charge ?? 0;
      if (!page || !page.ok || page.chars < COMPANIES.minPageChars) {
        listed.set(s.company.id, {
          jobs: [],
          service: "Own site",
          board: "",
          how: "careers page through Firecrawl",
          result: RESULT.needsClaude,
          error: page?.error?.slice(0, 200) ?? (page ? "the page came back nearly empty" : "Firecrawl didn't run"),
        });
        continue;
      }
      // A hiring-service board linked from the page is used straight away.
      const boards = [...new Set(page.services.map((l) => serviceOf(l)).filter(Boolean).map((b) => `${b!.service}|${b!.board}`))];
      if (boards.length === 1) {
        const [service, board] = boards[0].split("|") as [Service, string];
        const read = await serviceJobs(service, board);
        if (read && !read.error) {
          listed.set(s.company.id, { jobs: read.jobs, service, board, how: `${service} job list (found on the careers page)`, result: RESULT.ok });
          continue;
        }
      }
      listed.set(s.company.id, { jobs: jobsFromPage(page, s.page), service: "Own site", board: "", how: "careers page through Firecrawl", result: RESULT.firecrawl });
    }
  }

  const pending: Pending[] = [];
  for (const { company } of plan) {
    const entry = listed.get(company.id);
    const report: CompanyReport = { name: company.name, how: entry?.how ?? "no careers page link", result: entry?.result ?? RESULT.needsClaude, listed: 0, kept: 0, added: [], dropped: [] };
    result.companies.push(report);

    if (!entry || entry.result === RESULT.needsClaude) {
      report.error = entry?.error ?? "no careers page link";
      if (!existing.needsClaude.has(company.name.toLowerCase())) {
        result.counts.needs_claude++;
        if (!options.dry) {
          const failed = await createRow(client, {
            [COL.name]: titleValue(company.name),
            [COL.entryType]: selectValue(ENTRY.role),
            [COL.reviewStatus]: selectValue(REVIEW.needsClaude),
            [COL.source]: selectValue(SOURCE_CAREERS),
            [COL.links]: urlValue(company.link),
            [COL.dateFound]: dateValue(today),
            [COL.reason]: textValue(company.link ? `The server couldn't read the careers page (${report.error}). Check it for open roles.` : "No careers page link. Find their jobs page and check it for open roles."),
          }, undefined, company.name);
          if (failed) result.failures.push(failed);
        }
      }
    } else {
      report.listed = entry.jobs.length;
      result.counts.listed += entry.jobs.length;
      for (const job of entry.jobs) {
        if (!job.title || !job.link) continue;
        const excluded = excludedBy({ title: job.title, company: company.name }, prefs);
        if (!titleWanted(job.title, prefs)) continue;
        if (excluded) {
          report.dropped.push({ title: job.title, why: `excluded: ${excluded}` });
          continue;
        }
        if (!locationWanted(job.location, prefs, company.notes)) {
          report.dropped.push({ title: job.title, why: `location: ${job.location}` });
          continue;
        }
        report.kept++;
        result.counts.kept++;
        if (!claim(existing, company.name, job)) {
          result.counts.duplicates++;
          continue;
        }
        report.added.push(job.title);
        result.counts.added++;
        pending.push({ company: company.name, service: entry.service, board: entry.board, source: SOURCE_CAREERS, job, trusted: entry.service === "Lever" || entry.service === "Ashby" });
      }
    }

    if (!options.dry) {
      const props: Record<string, unknown> = { [COL.lastChecked]: dateValue(today), [COL.lastResult]: selectValue(report.result) };
      if (entry && entry.service && !company.hiringService) props[COL.hiringService] = selectValue(entry.service);
      if (entry?.board && !company.boardId) props[COL.boardId] = textValue(entry.board);
      try {
        await client.update(company.id, props);
      } catch (error) {
        result.failures.push({ where: `update ${company.name}`, error: (error as any).friendly ?? (error as Error).message });
      }
    }
  }
  const counts = await fillAdverts(pending, deadlineAt);
  Object.assign(result.counts, counts.counts);
  result.charge += counts.charge;
  result.failures.push(...counts.failures);
  for (const report of result.companies) {
    report.adverts = Object.fromEntries(pending.filter((p) => p.company === report.name).map((p) => [p.job.title, p.job.advert.length]));
  }
  if (!options.dry) result.failures.push(...(await writeRoles(client, pending, today, deadlineAt)));
  return result;
}

function hostOf(link: string): string {
  try {
    return new URL(/^https?:/i.test(link) ? link : `https://${link}`).hostname;
  } catch {
    return link;
  }
}

// Weekly: do Composio's tools still exist and take the settings we send?
export async function checkComposioTools(): Promise<{ ok: boolean; missing: string[]; error?: string }> {
  const tools: [string, string[]][] = [
    [COMPOSIO.scrape.tool, COMPOSIO.scrape.expects],
    [SEARCHES.jobs.tool, SEARCHES.jobs.expects],
    [SEARCHES.linkedin.tool, SEARCHES.linkedin.expects],
    [SEARCHES.posts.tool, SEARCHES.posts.expects],
  ];
  try {
    const client = await composio();
    const missing: string[] = [];
    for (const [tool, expects] of tools) {
      try {
        const settings = await client.toolSettings(tool);
        missing.push(...expects.filter((s) => !settings.includes(s)).map((s) => `${tool}.${s}`));
      } catch (error) {
        missing.push(`${tool} (${(error as ComposioError).friendly ?? (error as Error).message})`);
      }
    }
    return { ok: missing.length === 0, missing };
  } catch (error) {
    return { ok: false, missing: [], error: (error as ComposioError).friendly ?? (error as Error).message };
  }
}
