import { exaAgentGet, exaAgentStart, type AgentRun, type ExaEffort } from "../engines/exa.js";
import { EngineError } from "../engines/http.js";
import { addCost } from "../cost.js";
import { PARALLEL_PRICES, parallelTaskResult, parallelTaskStart, type TaskResult } from "../engines/parallel.js";
import { cleanText, truncate } from "../text.js";

export const EFFORTS = ["quick", "standard", "deep"] as const;
export type Effort = (typeof EFFORTS)[number];

export interface ResearchInput {
  task?: string;
  effort?: Effort;
  run_id?: string;
}

// How long one call waits before handing back a run_id. Claude allows 240
// seconds per tool call; this leaves a margin.
const WAIT_MS = Number(process.env.RESEARCH_WAIT_MS ?? 170_000);
const REPORT_CHARS = 7000;
const MAX_SOURCES = 15;

const EXA_SYSTEM =
  "Prefer primary and official sources (the organisation, the paper, the filing, the official docs) over commentary. " +
  "Give exact figures with their dates and units. Where sources disagree, say so and give both. " +
  "State clearly what you could not verify. Be concise: no filler, no repetition.";

const PARALLEL_SPEC =
  "A concise markdown report (under 900 words) that answers the task directly. Use inline citations. " +
  "Give exact figures with dates. Add a short 'Conflicting evidence' section and an 'Unverified' section when relevant.";

const PARALLEL_PROCESSOR = "pro";

const PLANS: Record<Effort, { exa: ExaEffort; parallel?: typeof PARALLEL_PROCESSOR }> = {
  quick: { exa: "low" },
  standard: { exa: "medium" },
  deep: { exa: "auto", parallel: PARALLEL_PROCESSOR },
};

interface Ids {
  exa?: string;
  par?: string;
}

function encodeIds(ids: Ids): string {
  return [ids.exa ? `exa:${ids.exa}` : "", ids.par ? `par:${ids.par}` : ""].filter(Boolean).join(",");
}

function decodeIds(text: string): Ids {
  const ids: Ids = {};
  for (const part of text.split(",")) {
    const [kind, ...rest] = part.trim().split(":");
    const id = rest.join(":");
    if (kind === "exa" && id) ids.exa = id;
    if (kind === "par" && id) ids.par = id;
  }
  return ids;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function runResearch(input: ResearchInput): Promise<{ text: string; isError: boolean }> {
  const started = Date.now();
  let ids: Ids;
  const startNotes: string[] = [];

  if (input.run_id) {
    ids = decodeIds(input.run_id);
    if (!ids.exa && !ids.par) return { text: "That run_id isn't recognised.", isError: true };
  } else {
    const task = input.task?.trim();
    if (!task) return { text: "Give a task (the full research question) or a run_id.", isError: true };
    const effort: Effort = EFFORTS.includes(input.effort as Effort) ? (input.effort as Effort) : "standard";
    const plan = PLANS[effort];
    ids = {};
    const [exa, par] = await Promise.allSettled([
      exaAgentStart(task, plan.exa, EXA_SYSTEM, 1),
      plan.parallel ? parallelTaskStart(task, plan.parallel, PARALLEL_SPEC) : Promise.resolve(null),
    ]);
    if (exa.status === "fulfilled") ids.exa = exa.value.id;
    else startNotes.push(`Exa Agent didn't start: ${friendly(exa.reason)}`);
    if (par.status === "fulfilled" && par.value) ids.par = par.value.run_id;
    else if (par.status === "rejected") startNotes.push(`Parallel research didn't start: ${friendly(par.reason)}`);
    if (!ids.exa && !ids.par) return { text: startNotes.join("\n"), isError: true };
  }

  const deadline = started + WAIT_MS;
  const [exaOut, parOut] = await Promise.all([
    ids.exa ? waitExa(ids.exa, deadline) : Promise.resolve(null),
    ids.par ? waitParallel(ids.par, deadline) : Promise.resolve(null),
  ]);

  const sections: string[] = [];
  const pending: Ids = {};
  if (exaOut) {
    if (exaOut.kind === "done") sections.push(exaOut.text);
    else if (exaOut.kind === "pending") pending.exa = ids.exa;
    else sections.push(`Exa Agent failed: ${exaOut.text}`);
  }
  if (parOut) {
    if (parOut.kind === "done") sections.push(parOut.text);
    else if (parOut.kind === "pending") pending.par = ids.par;
    else sections.push(`Parallel research failed: ${parOut.text}`);
  }
  if (pending.exa || pending.par) {
    const who = [pending.exa ? "Exa Agent" : "", pending.par ? "Parallel" : ""].filter(Boolean).join(" and ");
    sections.push(
      `Still running: ${who}. Call research again with run_id="${encodeIds(pending)}" to collect it` +
        `${sections.length ? "" : " (runs usually take 1 to 10 minutes)"}. Don't start a new run.`,
    );
  }
  if (sections.length > 1 && exaOut?.kind === "done" && parOut?.kind === "done") {
    sections.unshift("Two independent research agents answered. Treat points both agree on as better supported, and check any disagreement.");
  }
  return { text: [...startNotes, ...sections].join("\n\n---\n\n"), isError: false };
}

function friendly(reason: unknown): string {
  return reason instanceof EngineError ? reason.friendly : (reason as Error)?.message ?? String(reason);
}

type Outcome = { kind: "done" | "pending" | "failed"; text: string };

async function waitExa(id: string, deadline: number): Promise<Outcome> {
  try {
    for (;;) {
      const run = await exaAgentGet(id);
      // Charged once, when the run finishes, so a run collected later is counted then.
      if (run.status === "completed" || run.status === "failed" || run.status === "cancelled") addCost("exa", run.costDollars?.total);
      if (run.status === "completed") return { kind: "done", text: formatExa(run) };
      if (run.status === "failed" || run.status === "cancelled") {
        return { kind: "failed", text: run.error?.message ?? run.status };
      }
      const remaining = deadline - Date.now();
      if (remaining <= 0) return { kind: "pending", text: "" };
      await sleep(Math.min(5000, remaining));
    }
  } catch (e) {
    return { kind: "failed", text: friendly(e) };
  }
}

async function waitParallel(id: string, deadline: number): Promise<Outcome> {
  try {
    const seconds = Math.floor((deadline - Date.now()) / 1000);
    if (seconds < 5) return { kind: "pending", text: "" };
    const result = await parallelTaskResult(id, seconds);
    if (!result) return { kind: "pending", text: "" };
    if (result.run.status === "failed") return { kind: "failed", text: result.run.error?.message ?? "failed" };
    if (!result.output) return { kind: "pending", text: "" };
    addCost("parallel", PARALLEL_PRICES.task[PARALLEL_PROCESSOR]);
    return { kind: "done", text: formatParallel(result) };
  } catch (e) {
    return { kind: "failed", text: friendly(e) };
  }
}

export function formatExa(run: AgentRun): string {
  const cost = run.costDollars?.total;
  const stop =
    run.stopReason === "budget_reached"
      ? " · stopped at its cost cap, so may be incomplete"
      : run.stopReason === "time_limit_reached"
        ? " · stopped at its time limit, so may be incomplete"
        : "";
  const head = `## Exa Agent report${cost !== undefined ? ` (cost $${cost.toFixed(3)})` : ""}${stop}`;
  const body = truncate(cleanText(run.output?.text ?? "(no text returned)"), REPORT_CHARS);
  const seen = new Map<string, { title?: string; confidence?: string }>();
  for (const g of run.output?.grounding ?? []) {
    for (const c of g.citations ?? []) {
      if (!c.url || seen.has(c.url)) continue;
      seen.set(c.url, { title: c.title, confidence: g.confidence ?? undefined });
    }
  }
  const sources = [...seen.entries()]
    .slice(0, MAX_SOURCES)
    .map(([url, s], i) => `[${i + 1}] ${s.title ? `${cleanText(s.title)} ` : ""}${url}${s.confidence ? ` (confidence: ${s.confidence})` : ""}`);
  return [head, body, sources.length ? `Sources:\n${sources.join("\n")}` : "No sources were returned."].join("\n\n");
}

export function formatParallel(result: TaskResult): string {
  const content = result.output?.content;
  const text = typeof content === "string" ? content : JSON.stringify(content, null, 1);
  const basis = result.output?.basis ?? [];
  const confidence = basis.find((b) => b.confidence)?.confidence;
  const seen = new Set<string>();
  const sources: string[] = [];
  for (const b of basis) {
    for (const c of b.citations ?? []) {
      if (!c.url || seen.has(c.url) || sources.length >= MAX_SOURCES) continue;
      seen.add(c.url);
      sources.push(`[${sources.length + 1}] ${c.title ? `${cleanText(c.title)} ` : ""}${c.url}`);
    }
  }
  const head = `## Parallel research report${confidence ? ` (overall confidence: ${confidence})` : ""}`;
  return [head, truncate(cleanText(text), REPORT_CHARS), sources.length ? `Sources:\n${sources.join("\n")}` : ""].filter(Boolean).join("\n\n");
}
