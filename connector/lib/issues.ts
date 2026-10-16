// Problem log for troubleshooting. The search skills call the log_issue tool
// when a run hits errors (engine failures, unreadable pages, workers that
// stopped early). Claude gives the run's context (question, follow-up and
// earlier questions, app, outcome) and, for each problem, the ref of the call
// it happened in; the connector already saved that call's parameters and
// engine requests (see trace.ts), so Claude doesn't restate them. The
// search-report skill also passes its whole report.
//
// With Supabase set up (logstore.ts) each entry is a row in search_issues,
// which Claude can read back with the Supabase connector. Otherwise it is one
// small JSON file in the private Vercel Blob store, under
// search-connector/issues/, one folder per day, and the report a Markdown
// file beside it.

import { KNOWN_SECRETS, SERVER_VERSION } from "./config.js";
import { rowWriter } from "./logstore.js";
import { readSecret } from "./store.js";

export const ISSUES_PREFIX = "search-connector/issues/";
const MAX_ISSUES = 20;
// A search-report report: a long conversation's timeline fits easily.
const MAX_REPORT = 200_000;
export const APPS = ["chat", "cowork", "code", "other"] as const;
export const OUTCOMES = ["answered", "partial", "not answered"] as const;

export interface IssueInput {
  skill?: string;
  skill_version?: string;
  mode?: string;
  app?: string;
  model?: string;
  question?: string;
  summary?: string; // older skills' name for question
  follow_up?: boolean;
  earlier_questions?: string[];
  outcome?: string;
  issues?: { tool?: string; problem?: string; ref?: string; detail?: string; recovered?: boolean }[];
  report?: string;
}

export type IssueWriter = (path: string, body: string) => Promise<void>;

let writerOverride: IssueWriter | null = null;

// Used by tests and local development.
export function useIssueWriter(writer: IssueWriter | null): void {
  writerOverride = writer;
}

function writer(): IssueWriter | null {
  if (writerOverride) return writerOverride;
  if (!process.env.BLOB_STORE_ID && !process.env.BLOB_READ_WRITE_TOKEN) return null;
  return async (path, body) => {
    const { put } = await import("@vercel/blob");
    const contentType = path.endsWith(".md") ? "text/markdown; charset=utf-8" : "application/json";
    await put(path, body, { access: "private", addRandomSuffix: false, contentType });
  };
}

const clip = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const oneOf = <T extends string>(value: unknown, list: readonly T[]) => (list.includes(value as T) ? (value as T) : undefined);

// The connector's own side of the picture, so Claude doesn't have to say it.
async function setup() {
  const engines = await Promise.all(
    Object.entries(KNOWN_SECRETS).map(async ([name, info]) => {
      const engine = info.label.match(/^(\w+) API (key|token)/)?.[1];
      return engine && (await readSecret(name).catch(() => null)) ? engine : null;
    }),
  );
  return {
    connector: SERVER_VERSION,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7),
    region: process.env.VERCEL_REGION,
    engines_set: engines.filter(Boolean),
  };
}

export async function runLogIssue(input: IssueInput): Promise<{ text: string; isError: boolean }> {
  const skill = clip(input.skill, 60);
  const issues = (Array.isArray(input.issues) ? input.issues : [])
    .map((i) => ({
      tool: clip(i?.tool, 40) || undefined,
      problem: clip(i?.problem, 1000),
      ref: clip(i?.ref, 16) || undefined,
      detail: clip(i?.detail, 2000) || undefined,
      recovered: typeof i?.recovered === "boolean" ? i.recovered : undefined,
    }))
    .filter((i) => i.problem)
    .slice(0, MAX_ISSUES);
  const report = typeof input.report === "string" ? input.report.trim() : "";
  if (report.length > MAX_REPORT) return { text: `Not logged: the report is longer than ${MAX_REPORT.toLocaleString("en-GB")} characters.`, isError: true };
  if (!skill || (!issues.length && !report)) return { text: "Give skill and at least one issue with a problem, or a report.", isError: true };
  const followUp = typeof input.follow_up === "boolean" ? input.follow_up : undefined;
  const earlier = followUp && Array.isArray(input.earlier_questions) ? input.earlier_questions.map((q) => clip(q, 300)).filter(Boolean).slice(-5) : [];
  const at = new Date();
  const stamp = at.toISOString();
  const id = `${stamp.replace(/[:.]/g, "-")}-${crypto.randomUUID().slice(0, 8)}`;
  const record = {
    id,
    at: stamp,
    skill,
    skill_version: clip(input.skill_version, 30) || undefined,
    mode: clip(input.mode, 60) || undefined,
    app: oneOf(input.app, APPS),
    model: clip(input.model, 60) || undefined,
    question: clip(input.question, 1000) || clip(input.summary, 1000) || undefined,
    follow_up: followUp,
    earlier_questions: earlier.length ? earlier : undefined,
    outcome: oneOf(input.outcome, OUTCOMES),
    issues,
    refs: [...new Set(issues.map((i) => i.ref).filter((r): r is string => !!r))],
    setup: await setup(),
  };
  const counted = `${issues.length} issue${issues.length === 1 ? "" : "s"}`;

  const row = await rowWriter().catch(() => null);
  if (row) {
    try {
      await row("search_issues", { ...record, report: report || undefined });
      return { text: `Logged ${counted}${report ? " and the report" : ""} as ${id}.`, isError: false };
    } catch (e) {
      // Falls back to the Blob store below.
      console.error(`problem log: ${(e as Error).message}`);
    }
  }

  const save = writer();
  if (!save) return { text: "Not logged: no Supabase log or Vercel Blob store is connected to the connector.", isError: true };
  const folder = `${ISSUES_PREFIX}${stamp.slice(0, 10)}/`;
  const reportPath = report ? `${folder}${id}.md` : undefined;
  try {
    if (reportPath) await save(reportPath, report);
    await save(`${folder}${id}.json`, JSON.stringify({ ...record, report: reportPath }, null, 2));
  } catch (e) {
    return { text: `Not logged: the Blob store refused the write (${(e as Error).message.slice(0, 200)}).`, isError: true };
  }
  return { text: `Logged ${counted}${report ? " and the report" : ""} as ${id}${reportPath ? ` (report: ${reportPath})` : ""}.`, isError: false };
}
