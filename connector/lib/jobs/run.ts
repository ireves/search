// Runs the job search stages in order and records them in the run log.
// A dry run reads everything and makes every check but writes nothing to
// Notion; its report shows what a real run would have changed.

import { RUN_LOG, STAGES, type StageName } from "./config.js";
import { checkComposioTools, runCompanies } from "./companies.js";
import { runRecheck } from "./recheck.js";
import { runLog } from "./runlog.js";

export interface StageReport {
  stage: StageName;
  ok: boolean;
  ms: number;
  error?: string;
  counts?: Record<string, number>;
  failures?: { where: string; error: string }[];
  // Composio charges, in US dollars (from later stages).
  charge_usd?: number;
  details?: Record<string, unknown>;
}

export interface RunReport {
  id: string;
  at: string;
  trigger: "claude" | "manual";
  dry_run: boolean;
  ok: boolean;
  ms: number;
  stages: StageReport[];
  log_error?: string;
}

const STAGE_RUNNERS: Record<StageName, (dry: boolean) => Promise<Omit<StageReport, "stage" | "ok" | "ms">>> = {
  async recheck(dry) {
    const r = await runRecheck({ dry });
    return { counts: r.counts, failures: r.failures, charge_usd: r.charge, details: { changes: r.changes, could_not_tell: r.unknown, watched_closed: r.watchedClosed } };
  },
  async companies(dry) {
    const r = await runCompanies({ dry });
    const details: Record<string, unknown> = { companies: r.companies };
    // Weekly (Mondays, UK time): check Composio's Firecrawl tool still takes
    // the settings sent to it.
    if (new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short" }).format(new Date()) === "Mon") {
      const check = await checkComposioTools();
      details.tool_check = check;
      if (!check.ok) r.failures.push({ where: "weekly Composio tool check", error: check.error ?? `FIRECRAWL_SCRAPE no longer takes: ${check.missing.join(", ")}` });
    }
    return { counts: r.counts, failures: r.failures, charge_usd: r.charge, details };
  },
};

export async function runJobs(options: { dry: boolean; trigger: "claude" | "manual"; stages?: StageName[] }): Promise<RunReport> {
  const started = Date.now();
  const report: RunReport = { id: crypto.randomUUID().replace(/-/g, "").slice(0, 10), at: new Date().toISOString(), trigger: options.trigger, dry_run: options.dry, ok: true, ms: 0, stages: [] };
  const writer = await runLog().catch(() => null);
  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);

  for (const stage of options.stages ?? STAGES) {
    const stageStarted = Date.now();
    let entry: StageReport;
    try {
      entry = { stage, ok: true, ms: 0, ...(await STAGE_RUNNERS[stage](options.dry)) };
      if (entry.failures?.length) entry.ok = false;
    } catch (error) {
      entry = { stage, ok: false, ms: 0, error: (error as any).friendly ?? (error as Error).message };
    }
    entry.ms = Date.now() - stageStarted;
    report.stages.push(entry);
    if (!entry.ok) report.ok = false;
    if (writer) {
      await writer(RUN_LOG.stages, {
        id: `${report.id}:${stage}`,
        run_id: report.id,
        stage,
        dry_run: options.dry,
        ok: entry.ok,
        ms: entry.ms,
        error: entry.error ?? null,
        counts: entry.counts ?? {},
        failures: entry.failures ?? [],
        charge_usd: entry.charge_usd ?? 0,
        details: entry.details ?? {},
      }).catch((e) => (report.log_error = (e as Error).message));
    }
  }

  report.ms = Date.now() - started;
  if (writer) {
    await writer(RUN_LOG.runs, {
      id: report.id,
      at: report.at,
      trigger: report.trigger,
      dry_run: report.dry_run,
      ok: report.ok,
      ms: report.ms,
      stages: report.stages.map((s) => s.stage),
      commit: commit ?? null,
    }).catch((e) => (report.log_error = (e as Error).message));
  }
  return report;
}
