// The MCP side: a stateless Streamable HTTP server that answers JSON-RPC with
// plain JSON. Tool descriptions are kept short because Claude reads them in
// every conversation where the connector is switched on.

import { SERVER_NAME, SERVER_TITLE, SERVER_VERSION } from "./config.js";
import { costLine, metered } from "./cost.js";
import { runFetch } from "./tools/fetch.js";
import { EFFORTS, runResearch } from "./tools/research.js";
import { DEPTHS, runSearch, SEARCH_TYPES } from "./tools/search.js";
import { runVerify } from "./tools/verify.js";

const PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

export const INSTRUCTIONS = `Web search through Exa and Parallel. Use these tools only when the user explicitly asks for this connector or runs one of its search skills (/uni-search, /better-search, /web-search, /deep-search), including as a worker those skills started; otherwise leave them alone.
- search: find pages. Results are ranked, de-duplicated and trimmed to the relevant passages, with dates and links. Pick a type for papers, people, companies, news, jobs, code, Reddit-style discussions, X posts, reviews or shopping.
- fetch: read known links (pages, PDFs, YouTube transcripts, Reddit threads with comments). Pass a question to get only the passages that answer it.
- verify: check several factual claims at once against independent sources before stating them.
- research: hand a multi-step question to research agents that search and read on their own (slow; costs more).
Cite the links you rely on. If a result says an engine is unavailable, tell the user.
Each result ends with its search cost. End every reply that used these tools with one line: "Search cost: $X (Exa $Y, Parallel $Z)", adding up every call made since your last reply, plus ", Apify $W" and ", Firecrawl N credits" inside the brackets when any result used them.`;

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };

export const TOOLS = [
  {
    name: "search",
    title: "Search the web",
    description:
      "Search the web with Exa and Parallel together (plus Firecrawl, when set up, for a second opinion or when they find little). Returns ranked results with title, date, link and the passages that match. Describe the page you want in plain words rather than keywords.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "What to find, as a natural description of the ideal page or the question itself. Include names, versions, places and years.",
        },
        type: {
          type: "string",
          enum: [...SEARCH_TYPES],
          description:
            "web (default) | news | discussions (Reddit and forums: experiences, advice, fixes) | x (posts on X) | reviews (Trustpilot, Glassdoor, user reviews) | shopping (product listings with prices; add country) | papers | people (professional profiles) | companies | code (docs, GitHub, Stack Overflow) | jobs (live postings; also LinkedIn, Indeed, Glassdoor and Totaljobs when set up, which adds up to a minute) | financial (filings, earnings).",
        },
        goal: {
          type: "string",
          description: "Goal for this search: which sources should rank first or be left out, and which facts or figures to pull from them.",
        },
        after: { type: "string", description: "Only pages published on or after this date: YYYY-MM-DD, or relative such as 7d, 3m, 1y." },
        before: { type: "string", description: "Only pages published on or before this date (YYYY-MM-DD)." },
        sites: { type: "array", items: { type: "string" }, description: "Only these sites or site sections, e.g. [\"forum.figma.com\", \"reddit.com/r/blender\"]." },
        exclude_sites: { type: "array", items: { type: "string" }, description: "Leave out these sites." },
        country: { type: "string", description: "Two-letter country code to localise results, e.g. GB." },
        location: { type: "string", description: "jobs only: town, city or region, e.g. Manchester. Keep the role alone in query." },
        max_results: { type: "integer", minimum: 1, maximum: 15, description: "Default 8." },
        depth: {
          type: "string",
          enum: [...DEPTHS],
          description: "fast (quickest, one engine) | standard (default) | thorough (engines search iteratively; slower, for hard or obscure questions).",
        },
        fresh: { type: "boolean", description: "Re-download pages instead of using stored copies. For prices, stock, live status. Slower." },
      },
      required: ["query"],
      additionalProperties: false,
    },
    annotations: { title: "Search the web", ...READ_ONLY },
  },
  {
    name: "fetch",
    title: "Read web pages",
    description:
      "Read up to 5 links: web pages, PDFs, YouTube videos (transcript), Reddit threads (with comments), X posts. With a question, returns only the relevant passages from anywhere in the document; without one, returns the page from the top.",
    inputSchema: {
      type: "object",
      properties: {
        urls: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 5, description: "Full web addresses." },
        question: { type: "string", description: "What you need from the page(s). Strongly recommended for long pages and PDFs." },
        max_chars: { type: "integer", minimum: 500, maximum: 20000, description: "Per page. Default 4000 with a question, 6000 without. All pages in one call share 30000 at most." },
        fresh: { type: "boolean", description: "Re-download instead of using a stored copy." },
      },
      required: ["urls"],
      additionalProperties: false,
    },
    annotations: { title: "Read web pages", ...READ_ONLY },
  },
  {
    name: "verify",
    title: "Check facts",
    description:
      "Find evidence for or against up to 8 specific claims in one call. Each claim gets excerpts from different websites found by both engines. Use before stating numbers, dates, versions, prices or other facts you need to be sure of.",
    inputSchema: {
      type: "object",
      properties: {
        claims: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          maxItems: 8,
          description: "Self-contained statements with names, figures and dates, e.g. \"Blender 5.2 LTS was released in July 2026\".",
        },
      },
      required: ["claims"],
      additionalProperties: false,
    },
    annotations: { title: "Check facts", ...READ_ONLY },
  },
  {
    name: "research",
    title: "Deep research",
    description:
      "Hand a multi-step research question to research agents that run many searches and readings themselves and return a cited report. quick (~1 min, ~$0.03), standard (~1-3 min, ~$0.10), deep (two independent agents, 3-10 min, up to ~$1.10). If it's still running, call again with the run_id it gives you.",
    inputSchema: {
      type: "object",
      properties: {
        task: {
          type: "string",
          description: "The full research brief: the question, scope, time window, what a complete answer contains and which sources count.",
        },
        effort: { type: "string", enum: [...EFFORTS], description: "Default standard." },
        run_id: { type: "string", description: "To collect a run that was still in progress. Leave task empty." },
      },
      additionalProperties: false,
    },
    annotations: { title: "Deep research", readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
];

type Json = Record<string, any>;

interface RpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Json;
}

function result(id: RpcRequest["id"], value: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, result: value };
}

function rpcError(id: RpcRequest["id"], code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

export async function callTool(name: string, args: Json): Promise<{ text: string; isError: boolean }> {
  const { value, meter } = await metered(() => runTool(name, args));
  if (!TOOLS.some((t) => t.name === name)) return value;
  return { ...value, text: `${value.text}\n\n${costLine(meter)}` };
}

async function runTool(name: string, args: Json): Promise<{ text: string; isError: boolean }> {
  try {
    switch (name) {
      case "search":
        return await runSearch(args as any);
      case "fetch":
        return await runFetch(args as any);
      case "verify":
        return await runVerify(args as any);
      case "research":
        return await runResearch(args as any);
      default:
        return { text: `Unknown tool: ${name}`, isError: true };
    }
  } catch (error) {
    return { text: `The ${name} tool failed: ${(error as Error).message}`, isError: true };
  }
}

// Returns null for notifications, which get no reply.
export async function handleRpc(message: RpcRequest): Promise<Json | null> {
  if (!message || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    return rpcError(message?.id, -32600, "Invalid request");
  }
  const isNotification = message.id === undefined;
  switch (message.method) {
    case "initialize": {
      const requested = message.params?.protocolVersion;
      const protocolVersion = PROTOCOL_VERSIONS.includes(requested) ? requested : PROTOCOL_VERSIONS[0];
      return result(message.id, {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: SERVER_NAME, title: SERVER_TITLE, version: SERVER_VERSION },
        instructions: INSTRUCTIONS,
      });
    }
    case "ping":
      return result(message.id, {});
    case "tools/list":
      return result(message.id, { tools: TOOLS });
    case "tools/call": {
      const name = message.params?.name;
      const args = (message.params?.arguments ?? {}) as Json;
      if (!TOOLS.some((t) => t.name === name)) return rpcError(message.id, -32602, `Unknown tool: ${name}`);
      const { text, isError } = await callTool(name, args);
      return result(message.id, { content: [{ type: "text", text }], isError });
    }
    case "resources/list":
      return result(message.id, { resources: [] });
    case "prompts/list":
      return result(message.id, { prompts: [] });
    default:
      if (isNotification) return null;
      return rpcError(message.id, -32601, `Method not found: ${message.method}`);
  }
}

export async function handleMcpPost(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(rpcError(null, -32700, "Parse error"), { status: 400 });
  }
  const headers = { "content-type": "application/json", "cache-control": "no-store" };
  if (Array.isArray(body)) {
    const replies = (await Promise.all(body.map((m) => handleRpc(m as RpcRequest)))).filter(Boolean);
    return replies.length ? new Response(JSON.stringify(replies), { headers }) : new Response(null, { status: 202 });
  }
  const reply = await handleRpc(body as RpcRequest);
  if (!reply) return new Response(null, { status: 202 });
  return new Response(JSON.stringify(reply), { headers });
}
