import { adminPassword, baseUrl } from "../lib/config.js";
import { getKeys, nowSeconds, signToken, verifyToken, type TokenPayload } from "../lib/crypto.js";
import { esc, json, nav, page } from "../lib/html.js";
import { STAGES, type StageName } from "../lib/jobs/config.js";
import { runJobs, type RunReport, type StageReport } from "../lib/jobs/run.js";
import { signedInOwner } from "../lib/settings.js";

// The job search's pages (docs/job-search/plan.md). Claude starts runs through
// the Search connector's run_job_search tool (lib/jobs/mcp.ts).
//   GET  /jobs?stage=<stage>  Signed-in owner: a dry run of one stage, shown
//                             as a page, with a button to run it for real.
//   POST /jobs                Signed-in owner: the real run, from that button.

const CSRF_TTL = 3600;
const STAGE_TITLES: Record<StageName, string> = { recheck: "Recheck found roles", companies: "Company job lists", job_sites: "Job sites", linkedin_posts: "LinkedIn posts" };

function signingKey(): Promise<CryptoKey> | null {
  const password = adminPassword();
  return password ? getKeys(password).then((k) => k.signing) : null;
}

function itemList(items: any[], withChange: boolean): string {
  if (!items?.length) return `<p class="muted">None.</p>`;
  return `<ul>${items
    .map((i) => {
      const label = esc([i.role, i.name].filter(Boolean).join(" at ") || "Untitled row");
      const link = i.link ? `<a href="${esc(i.link)}" rel="noreferrer">${label}</a>` : label;
      const change = withChange ? ` ${esc(i.from ?? "empty")} → <strong>${esc(i.to)}</strong>` : "";
      return `<li>${link}:${change} <span class="muted">(${esc(i.how)})</span></li>`;
    })
    .join("")}</ul>`;
}

function recheckSection(s: StageReport, dry: boolean): string {
  const d = (s.details ?? {}) as any;
  const c = s.counts ?? {};
  return `<div class="card"><p>${c.roles ?? 0} roles to check, ${c.checked ?? 0} checked: ${c.open ?? 0} open, ${c.closed ?? 0} closed, ${c.unknown ?? 0} couldn't tell.${c.skipped_for_time ? ` ${c.skipped_for_time} skipped for time.` : ""} ${c.watched ?? 0} watched or applied roles checked. ${c.firecrawl ?? 0} read through Firecrawl.</p></div>
<h3>${dry ? "Would change" : "Changed"} (${(d.changes ?? []).length})</h3>${itemList(d.changes, true)}
<h3>Couldn't tell, left as they are (${(d.could_not_tell ?? []).length})</h3>${itemList(d.could_not_tell, false)}
<h3>Watched or applied roles that have closed (${(d.watched_closed ?? []).length})</h3>${itemList(d.watched_closed, false)}`;
}

function companiesSection(s: StageReport, dry: boolean): string {
  const d = (s.details ?? {}) as any;
  const c = s.counts ?? {};
  const rows = (d.companies ?? [])
    .map((co: any) => {
      const added = co.added?.length ? `<br>${dry ? "Would add" : "Added"}: ${co.added.map((t: string) => esc(t)).join("; ")}` : "";
      const dropped = co.dropped?.length ? `<br><span class="muted">Left out: ${co.dropped.slice(0, 6).map((x: any) => `${esc(x.title)} (${esc(x.why)})`).join("; ")}${co.dropped.length > 6 ? ` and ${co.dropped.length - 6} more` : ""}</span>` : "";
      const error = co.error ? `<br><span class="bad">${esc(co.error)}</span>` : "";
      return `<li><strong>${esc(co.name)}</strong>: ${esc(co.result)}, ${esc(co.how)}. ${co.listed} jobs listed, ${co.kept} could suit.${added}${dropped}${error}</li>`;
    })
    .join("");
  return `<div class="card"><p>${c.companies ?? 0} companies checked: ${c.listed ?? 0} jobs listed, ${c.kept ?? 0} could suit, ${c.duplicates ?? 0} already in Notion, ${c.added ?? 0} ${dry ? "would be added" : "added"} to the Inbox. ${c.needs_claude ?? 0} ${dry ? "would be" : ""} passed to Claude. ${c.firecrawl_pages ?? 0} pages read through Firecrawl.</p></div><ul>${rows}</ul>`;
}

function searchesSection(s: StageReport, dry: boolean): string {
  const d = (s.details ?? {}) as any;
  const c = s.counts ?? {};
  const rows = (d.searches ?? [])
    .map((se: any) => {
      const added = se.added?.length ? `<br>${dry ? "Would add" : "Added"}: ${se.added.map((t: string) => esc(t)).join("; ")}` : "";
      const dropped = se.dropped?.length ? `<br><span class="muted">Left out: ${se.dropped.slice(0, 5).map((x: any) => `${esc(x.title)} (${esc(x.why)})`).join("; ")}${se.dropped.length > 5 ? ` and ${se.dropped.length - 5} more` : ""}</span>` : "";
      const error = se.error ? `<br><span class="bad">${esc(se.error)}</span>` : "";
      return `<li><strong>${esc(se.search)}</strong>: ${se.raw} results, ${se.matched} could suit.${added}${dropped}${error}</li>`;
    })
    .join("");
  return `<div class="card"><p>${c.searches ?? 0} searches: ${c.raw ?? 0} results, ${c.matched ?? 0} could suit, ${c.duplicates ?? 0} already in Notion or found twice, ${c.added ?? 0} ${dry ? "would be added" : "added"} to the Inbox. Advert text: ${c.advert_from_list ?? 0} from the search, ${c.advert_from_page ?? 0} from the page, ${c.advert_from_firecrawl ?? 0} through Firecrawl, ${c.advert_missing ?? 0} without.</p></div><ul>${rows}</ul>`;
}

function reportPage(report: RunReport, base: string, csrf: string | null): Response {
  const stages = report.stages
    .map((s) => {
      const head = `<h2>${esc(STAGE_TITLES[s.stage])} ${s.ok ? "" : '<span class="tag bad">problem</span>'}</h2>`;
      if (s.error) return `${head}<div class="card bad">${esc(s.error)}</div>`;
      const body = s.stage === "recheck" ? recheckSection(s, report.dry_run) : s.stage === "companies" ? companiesSection(s, report.dry_run) : searchesSection(s, report.dry_run);
      const failures = s.failures?.length ? `<h3>Failures</h3><ul>${s.failures.map((f) => `<li>${esc(f.where)}: ${esc(f.error)}</li>`).join("")}</ul>` : "";
      const cost = s.charge_usd ? `<p class="muted">Composio charges: $${s.charge_usd.toFixed(4)}.</p>` : "";
      return `${head}${body}${failures}${cost}`;
    })
    .join("");
  const stage = report.stages[0]?.stage ?? "recheck";
  const runButton = csrf
    ? `<form method="post" action="${esc(base)}/jobs"><input type="hidden" name="csrf" value="${esc(csrf)}"><input type="hidden" name="stage" value="${esc(stage)}"><button type="submit">Run for real</button> <span class="muted">Writes the changes above to Notion.</span></form>`
    : "";
  return page({
    title: "Job search run",
    wide: true,
    body: `${nav(base, "jobs")}<h1>Job search ${report.dry_run ? "dry run" : "run"}</h1>
<p class="muted">Run ${esc(report.id)}, ${esc(report.at.slice(0, 16).replace("T", " "))} UTC, ${Math.round(report.ms / 1000)} seconds.${report.dry_run ? " Nothing was written to Notion." : ""}${report.log_error ? ` Run log not saved: ${esc(report.log_error)}` : ""}</p>
${stages}${report.dry_run ? runButton : ""}
<p>${STAGES.map((st) => `<a href="${esc(base)}/jobs?stage=${st}">Dry run: ${esc(STAGE_TITLES[st].toLowerCase())}</a>`).join(" · ")}</p>`,
  });
}

const stageOf = (value: string | null): StageName => (STAGES.includes(value as StageName) ? (value as StageName) : "recheck");

export default {
  async fetch(request: Request): Promise<Response> {
    const base = baseUrl(request);
    const sid = await signedInOwner(request);
    const key = signingKey();
    if (!sid || !key) {
      return page({
        title: "Job search run",
        status: 401,
        body: `<h1>Job search run</h1><p><a href="${esc(base)}/settings?next=/jobs">Sign in</a> first.</p>`,
      });
    }
    const signing = await key;

    if (request.method === "POST") {
      const form = new URLSearchParams(await request.text());
      const csrf = await verifyToken<TokenPayload & { sid: string; stage: string }>(signing, form.get("csrf"), "jobs-run");
      if (!csrf || csrf.sid !== sid || csrf.stage !== form.get("stage")) {
        return page({ title: "Job search run", status: 403, body: `<h1>Job search run</h1><p>The page had expired. <a href="${esc(base)}/jobs">Start again</a>.</p>` });
      }
      return reportPage(await runJobs({ dry: false, trigger: "manual", stages: [stageOf(csrf.stage)] }), base, null);
    }
    if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
    const stage = stageOf(new URL(request.url).searchParams.get("stage"));
    const csrf = await signToken(signing, { typ: "jobs-run", exp: nowSeconds() + CSRF_TTL, sid, stage });
    return reportPage(await runJobs({ dry: true, trigger: "manual", stages: [stage] }), base, csrf);
  },
};
