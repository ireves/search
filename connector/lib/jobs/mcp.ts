// The Search connector's run_job_search tool (lib/mcp.ts lists it). The daily
// job search skill (/job-search) calls it to run the server's stages; the
// connector's instructions and the description keep Claude from using it
// anywhere else.

import { STAGES, type StageName } from "./config.js";
import { runJobs, type RunReport } from "./run.js";

export const JOB_SEARCH_TOOL = {
  name: "run_job_search",
  title: "Run a job search stage",
  description:
    "Only for the /job-search skill: never call it unless that skill is running. Runs one stage of the daily job search and returns its report as JSON. recheck: checks found roles' adverts and sets Advert status in Job Applications (never changes Application rows; lists watched roles that closed). companies: reads the job lists of the 12 companies checked longest ago and adds new roles to the Inbox (Review status New), or a Needs Claude row when a page couldn't be read. job_sites: searches LinkedIn, Indeed and Glassdoor for each Role and Location preference and adds new roles to the Inbox. linkedin_posts: finds recent public LinkedIn hiring posts for each Role preference and adds them to the Inbox for Claude to judge. dry_run reports without writing to Notion.",
  inputSchema: {
    type: "object",
    properties: {
      stage: { type: "string", enum: [...STAGES], description: "recheck, companies, job_sites, then linkedin_posts." },
      dry_run: { type: "boolean", description: "Report what would change without writing to Notion. Default false." },
    },
    required: ["stage"],
    additionalProperties: false,
  },
  annotations: { title: "Run a job search stage", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
};

type Json = Record<string, any>;

// Keeps the reply readable: long dropped-role lists are cut down.
export function compactReport(report: RunReport): Json {
  return {
    ...report,
    stages: report.stages.map((s) => {
      const details = s.details as Json | undefined;
      if (!details?.companies && !details?.searches) return s;
      return {
        ...s,
        details: {
          ...details,
          ...(details.companies ? { companies: details.companies.map((c: Json) => ({ ...c, dropped: c.dropped?.slice(0, 8), dropped_total: c.dropped?.length ?? 0 })) } : {}),
          ...(details.searches ? { searches: details.searches.map((c: Json) => ({ ...c, dropped: c.dropped?.slice(0, 8), dropped_total: c.dropped?.length ?? 0 })) } : {}),
        },
      };
    }),
  };
}

export async function runJobSearchTool(args: Json): Promise<{ text: string; isError: boolean }> {
  if (!STAGES.includes(args.stage)) return { text: `stage must be one of: ${STAGES.join(", ")}`, isError: true };
  try {
    const report = await runJobs({ dry: args.dry_run === true, trigger: "claude", stages: [args.stage as StageName] });
    return { text: JSON.stringify(compactReport(report)), isError: false };
  } catch (error) {
    return { text: `The job search run failed: ${(error as Error).message}`, isError: true };
  }
}
