// The MCP side: a stateless Streamable HTTP server that answers JSON-RPC with
// plain JSON. Tool descriptions are kept short because Claude reads them in
// every conversation where the connector is switched on.

import { SERVER_NAME, SERVER_TITLE, SERVER_VERSION } from "./config.js";
import { runFetch } from "./tools/fetch.js";
import { EFFORTS, runResearch } from "./tools/research.js";
import { DEPTHS, runSearch, SEARCH_TYPES } from "./tools/search.js";
import { runVerify } from "./tools/verify.js";

const PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

export const INSTRUCTIONS = `Web search through Exa and Parallel. Use instead of built-in web search and web fetch.
- search: ranked, de-duplicated results with dates, links and the matching passages. Set type for news, discussions (Reddit, forums), x, reviews, papers, people, companies, code, jobs or financial.
- fetch: read links (pages, PDFs, YouTube transcripts, Reddit threads with comments). Always reads the live page. Add a question to get only the passages that answer it.
- verify: evidence from independent sites for up to 8 claims; you judge each one.
- research: an agent searches and reads for you and returns a cited answer. quick ~$0.01, standard ~$0.05, deep (two agents) ~$0.20.
Cite the links you rely on. If a result says an engine is unavailable, tell the user.`;

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };

export const TOOLS = [
  {
    name: "search",
    title: "Search the web",
    description:
      "Search the web with Exa and Parallel together. Returns up to 10 ranked results: title, date, link and the passages that match. Describe the ideal page in plain words, not keywords.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The ideal page described in plain words, or the question itself. Include names, versions, places and years.",
        },
        type: {
          type: "string",
          enum: [...SEARCH_TYPES],
          description:
            "web (default) | news | discussions (Reddit and forums: experiences, advice, fixes) | x (posts on X) | reviews (Trustpilot, Glassdoor, user reviews) | papers | people (professional profiles) | companies (profiles; for one named company add its website, e.g. \"Monzo monzo.com\") | code (docs, GitHub, Stack Overflow) | jobs (live postings) | financial (filings, earnings).",
        },
        goal: {
          type: "string",
          description: "Goal for this search: which sources should rank first or be excluded, and which facts or figures to pull from them.",
        },
        after: { type: "string", description: "Only pages published on or after this date: YYYY-MM-DD, or relative such as 7d, 3m, 1y." },
        before: { type: "string", description: "Only pages published on or before this date (YYYY-MM-DD)." },
        sites: { type: "array", items: { type: "string" }, description: "Only these sites or site sections, e.g. [\"forum.figma.com\", \"reddit.com/r/blender\"]." },
        exclude_sites: { type: "array", items: { type: "string" }, description: "Leave out these sites." },
        country: { type: "string", description: "Two-letter country code to localise results, e.g. GB." },
        max_results: { type: "integer", minimum: 1, maximum: 15, description: "Default 10." },
        depth: {
          type: "string",
          enum: [...DEPTHS],
          description: "standard (default, both engines) | thorough (deeper search; slower, for hard or obscure questions) | fast (one engine, cheapest).",
        },
        fresh: { type: "boolean", description: "Re-download the result pages (live prices, stock, status). Slower." },
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
      "Read up to 5 links: web pages, PDFs, YouTube videos (transcript), Reddit threads (with comments), X posts. Always reads the live page. With a question, returns only the relevant passages from anywhere in the document; without one, the page from the top.",
    inputSchema: {
      type: "object",
      properties: {
        urls: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 5, description: "Full web addresses." },
        question: { type: "string", description: "What you need from the page(s). Use it for long pages and PDFs." },
        max_chars: { type: "integer", minimum: 500, maximum: 20000, description: "Per page. Default 4000 with a question, 6000 without." },
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
      "A research agent runs its own searches and reading and returns a cited answer. quick (~$0.01, 10-20 s): one question needing several sources. standard (~$0.05, ~1 min): comparisons and multi-part questions. deep (~$0.20, 2-10 min): two independent agents' reports, for cross-checking. If it's still running, call again with the run_id it gives you.",
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
