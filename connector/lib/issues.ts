// Problem log for troubleshooting. The search skills call the log_issue tool
// when a run hits errors (engine failures, unreadable pages, workers that
// stopped early). Each report is saved as one small JSON file in the same
// private Vercel Blob store as the settings, under search-connector/issues/,
// one folder per day. The search-report skill also saves its whole report
// here, as a Markdown file beside the entry. Nothing here is ever read back
// to Claude.

import { SERVER_VERSION } from "./config.js";

export const ISSUES_PREFIX = "search-connector/issues/";
const MAX_ISSUES = 20;
// A search-report report: a long conversation's timeline fits easily.
const MAX_REPORT = 200_000;

export interface IssueInput {
  skill?: string;
  mode?: string;
  summary?: string;
  issues?: { tool?: string; problem?: string; detail?: string }[];
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

export async function runLogIssue(input: IssueInput): Promise<{ text: string; isError: boolean }> {
  const skill = clip(input.skill, 60);
  const issues = (Array.isArray(input.issues) ? input.issues : [])
    .map((i) => ({ tool: clip(i?.tool, 40) || undefined, problem: clip(i?.problem, 1000), detail: clip(i?.detail, 2000) || undefined }))
    .filter((i) => i.problem)
    .slice(0, MAX_ISSUES);
  const report = typeof input.report === "string" ? input.report.trim() : "";
  if (report.length > MAX_REPORT) return { text: `Not logged: the report is longer than ${MAX_REPORT.toLocaleString("en-GB")} characters.`, isError: true };
  if (!skill || (!issues.length && !report)) return { text: "Give skill and at least one issue with a problem, or a report.", isError: true };
  const save = writer();
  if (!save) return { text: "Not logged: no Vercel Blob store is connected to the connector.", isError: true };
  const at = new Date();
  const stamp = at.toISOString();
  const id = `${stamp.replace(/[:.]/g, "-")}-${crypto.randomUUID().slice(0, 8)}`;
  const folder = `${ISSUES_PREFIX}${stamp.slice(0, 10)}/`;
  const path = `${folder}${id}.json`;
  const reportPath = report ? `${folder}${id}.md` : undefined;
  const record = {
    at: stamp,
    skill,
    mode: clip(input.mode, 40) || undefined,
    summary: clip(input.summary, 500) || undefined,
    issues,
    report: reportPath,
    connector: SERVER_VERSION,
  };
  try {
    if (reportPath) await save(reportPath, report);
    await save(path, JSON.stringify(record, null, 2));
  } catch (e) {
    return { text: `Not logged: the Blob store refused the write (${(e as Error).message.slice(0, 200)}).`, isError: true };
  }
  const counted = `${issues.length} issue${issues.length === 1 ? "" : "s"}`;
  return { text: `Logged ${counted}${report ? " and the report" : ""} as ${id}${reportPath ? ` (report: ${reportPath})` : ""}.`, isError: false };
}
