import { adminPassword, baseUrl, routeOf } from "../lib/config.js";
import { getKeys, nowSeconds, safeEqual, signToken, verifyToken, type TokenPayload } from "../lib/crypto.js";
import { esc, json, page } from "../lib/html.js";
import { runJobs, type RunReport } from "../lib/jobs/run.js";
import { signedInOwner } from "../lib/settings.js";

// The job search's daily run (docs/job-search/plan.md). Not an MCP endpoint.
//   GET  /jobs/run   Vercel's scheduled run, with "Authorization: Bearer
//                    <CRON_SECRET>". Add ?dry=1 for a dry run.
//   GET  /jobs       Signed-in owner: a dry run, shown as a page, with a
//                    button to run it for real.
//   POST /jobs       Signed-in owner: the real run, from that button.

const CSRF_TTL = 3600;

async function cronAllowed(request: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  return safeEqual(request.headers.get("authorization") ?? "", `Bearer ${secret}`);
}

function signingKey(): Promise<CryptoKey> | null {
  const password = adminPassword();
  return password ? getKeys(password).then((k) => k.signing) : null;
}

const STATUS_WORDS: Record<string, string> = { Active: "Active", "Almost Gone": "Almost Gone", Closed: "Closed" };

function itemList(items: any[], withChange: boolean): string {
  if (!items?.length) return `<p class="muted">None.</p>`;
  return `<ul>${items
    .map((i) => {
      const label = esc([i.role, i.name].filter(Boolean).join(" at ") || "Untitled row");
      const link = i.link ? `<a href="${esc(i.link)}" rel="noreferrer">${label}</a>` : label;
      const change = withChange ? ` ${esc(i.from ?? "empty")} → <strong>${esc(STATUS_WORDS[i.to] ?? i.to)}</strong>` : "";
      return `<li>${link}:${change} <span class="muted">(${esc(i.how)})</span></li>`;
    })
    .join("")}</ul>`;
}

function reportPage(report: RunReport, base: string, csrf: string | null): Response {
  const stages = report.stages
    .map((s) => {
      const d = (s.details ?? {}) as any;
      const c = s.counts ?? {};
      const head = `<h2>Recheck found roles ${s.ok ? "" : '<span class="tag bad">problem</span>'}</h2>`;
      if (s.error) return `${head}<div class="card bad">${esc(s.error)}</div>`;
      return `${head}<div class="card"><p>${c.roles ?? 0} roles to check, ${c.checked ?? 0} checked: ${c.open ?? 0} open, ${c.closed ?? 0} closed, ${c.unknown ?? 0} couldn't tell.${c.skipped_for_time ? ` ${c.skipped_for_time} skipped for time.` : ""} ${c.watched ?? 0} watched or applied roles checked.</p></div>
<h2>${report.dry_run ? "Would change" : "Changed"} (${(d.changes ?? []).length})</h2>${itemList(d.changes, true)}
<h2>Couldn't tell, left as they are (${(d.could_not_tell ?? []).length})</h2>${itemList(d.could_not_tell, false)}
<h2>Watched or applied roles that have closed (${(d.watched_closed ?? []).length})</h2>${itemList(d.watched_closed, false)}
${s.failures?.length ? `<h2>Failures</h2><ul>${s.failures.map((f) => `<li>${esc(f.where)}: ${esc(f.error)}</li>`).join("")}</ul>` : ""}`;
    })
    .join("");
  const runButton = csrf
    ? `<form method="post" action="${esc(base)}/jobs"><input type="hidden" name="csrf" value="${esc(csrf)}"><button type="submit">Run for real</button> <span class="muted">Writes the changes above to Notion.</span></form>`
    : "";
  return page({
    title: "Job search run",
    body: `<h1>Job search ${report.dry_run ? "dry run" : "run"}</h1>
<p class="muted">Run ${esc(report.id)}, ${esc(report.at.slice(0, 16).replace("T", " "))} UTC, ${Math.round(report.ms / 1000)} seconds.${report.dry_run ? " Nothing was written to Notion." : ""}${report.log_error ? ` Run log not saved: ${esc(report.log_error)}` : ""}</p>
${stages}${report.dry_run ? runButton : ""}
<p><a href="${esc(base)}/settings">Settings</a></p>`,
  });
}

export default {
  async fetch(request: Request): Promise<Response> {
    const route = routeOf(request, (p) => (p.replace(/\/+$/, "") === "/jobs/run" ? "run" : "page"));
    const url = new URL(request.url);

    if (route === "run") {
      if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
      if (!(await cronAllowed(request))) return json({ error: "unauthorized" }, 401);
      const report = await runJobs({ dry: url.searchParams.get("dry") === "1", trigger: "cron" });
      return json(report, report.ok ? 200 : 500);
    }

    const base = baseUrl(request);
    const sid = await signedInOwner(request);
    const key = signingKey();
    if (!sid || !key) {
      return page({
        title: "Job search run",
        status: 401,
        body: `<h1>Job search run</h1><p>Sign in on the <a href="${esc(base)}/settings">settings page</a> first, then open this page again.</p>`,
      });
    }
    const signing = await key;

    if (request.method === "POST") {
      const form = new URLSearchParams(await request.text());
      const csrf = await verifyToken<TokenPayload & { sid: string }>(signing, form.get("csrf"), "jobs-run");
      if (!csrf || csrf.sid !== sid) return page({ title: "Job search run", status: 403, body: `<h1>Job search run</h1><p>The page had expired. <a href="${esc(base)}/jobs">Start again</a>.</p>` });
      return reportPage(await runJobs({ dry: false, trigger: "manual" }), base, null);
    }
    if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
    const csrf = await signToken(signing, { typ: "jobs-run", exp: nowSeconds() + CSRF_TTL, sid });
    return reportPage(await runJobs({ dry: true, trigger: "manual" }), base, csrf);
  },
};
