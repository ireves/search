// The Job search connector (https://<deployment>/jobs/mcp): one tool that the
// daily Claude scheduled task calls to run the server's stages. A separate
// connector from Search, sharing its sign-in, so this tool never appears
// beside search, fetch, verify and research.

import { SERVER_VERSION } from "../config.js";
import { STAGES, type StageName } from "./config.js";
import { runJobs, type RunReport } from "./run.js";

const PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

export const INSTRUCTIONS = `Runs the server side of the user's daily job search. Use it only from the job search scheduled task (docs/job-search/scheduled-task.md) or when the user asks for a job search run. Call run_job_search once per stage, in order: recheck, then companies. Each call can take up to about four minutes.`;

export const TOOLS = [
  {
    name: "run_job_search",
    title: "Run a job search stage",
    description:
      "Runs one stage of the daily job search and returns its report as JSON. recheck: checks found roles' adverts and sets Advert status in Job Applications (never changes Application rows; lists watched roles that closed). companies: reads the job lists of the 12 companies checked longest ago and adds new roles to the Inbox (Review status New), or a Needs Claude row when a page couldn't be read. dry_run reports without writing to Notion.",
    inputSchema: {
      type: "object",
      properties: {
        stage: { type: "string", enum: [...STAGES], description: "recheck, then companies." },
        dry_run: { type: "boolean", description: "Report what would change without writing to Notion. Default false." },
      },
      required: ["stage"],
      additionalProperties: false,
    },
    annotations: { title: "Run a job search stage", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
];

type Json = Record<string, any>;

// Keeps the reply readable: long dropped-role lists are cut down.
export function compactReport(report: RunReport): Json {
  return {
    ...report,
    stages: report.stages.map((s) => {
      const details = s.details as Json | undefined;
      if (!details?.companies) return s;
      return {
        ...s,
        details: {
          ...details,
          companies: details.companies.map((c: Json) => ({ ...c, dropped: c.dropped?.slice(0, 8), dropped_total: c.dropped?.length ?? 0 })),
        },
      };
    }),
  };
}

const result = (id: unknown, value: unknown) => ({ jsonrpc: "2.0", id: id ?? null, result: value });
const rpcError = (id: unknown, code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

export async function handleJobsRpc(message: Json): Promise<Json | null> {
  if (!message || message.jsonrpc !== "2.0" || typeof message.method !== "string") return rpcError(message?.id, -32600, "Invalid request");
  switch (message.method) {
    case "initialize": {
      const requested = message.params?.protocolVersion;
      return result(message.id, {
        protocolVersion: PROTOCOL_VERSIONS.includes(requested) ? requested : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "job-search", title: "Job search", version: SERVER_VERSION },
        instructions: INSTRUCTIONS,
      });
    }
    case "ping":
      return result(message.id, {});
    case "tools/list":
      return result(message.id, { tools: TOOLS });
    case "tools/call": {
      if (message.params?.name !== "run_job_search") return rpcError(message.id, -32602, `Unknown tool: ${message.params?.name}`);
      const args = (message.params?.arguments ?? {}) as Json;
      if (!STAGES.includes(args.stage)) return result(message.id, { content: [{ type: "text", text: `stage must be one of: ${STAGES.join(", ")}` }], isError: true });
      try {
        const report = await runJobs({ dry: args.dry_run === true, trigger: "claude", stages: [args.stage as StageName] });
        return result(message.id, { content: [{ type: "text", text: JSON.stringify(compactReport(report)) }], isError: false });
      } catch (error) {
        return result(message.id, { content: [{ type: "text", text: `The job search run failed: ${(error as Error).message}` }], isError: true });
      }
    }
    case "resources/list":
      return result(message.id, { resources: [] });
    case "prompts/list":
      return result(message.id, { prompts: [] });
    default:
      if (message.id === undefined) return null;
      return rpcError(message.id, -32601, `Method not found: ${message.method}`);
  }
}

export async function handleJobsMcpPost(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(rpcError(null, -32700, "Parse error"), { status: 400 });
  }
  const headers = { "content-type": "application/json", "cache-control": "no-store" };
  if (Array.isArray(body)) {
    const replies = (await Promise.all(body.map((m) => handleJobsRpc(m as Json)))).filter(Boolean);
    return replies.length ? new Response(JSON.stringify(replies), { headers }) : new Response(null, { status: 202 });
  }
  const reply = await handleJobsRpc(body as Json);
  if (!reply) return new Response(null, { status: 202 });
  return new Response(JSON.stringify(reply), { headers });
}
