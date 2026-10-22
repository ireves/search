// Composio Connect, reached with the official MCP client. Only two Connect
// tools are used: the remote workbench, which runs a short Python script that
// calls Firecrawl for several pages at once and prints compact JSON after a
// marker, and the tool-schema lookup for the weekly check. Direct
// multi-execute replies are cut to a preview when large, so they aren't used.

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { readSecret } from "../store.js";
import { COMPOSIO } from "./config.js";

export class ComposioError extends Error {
  constructor(
    public kind: "no_key" | "key" | "balance" | "tool" | "time" | "other",
    message: string,
  ) {
    super(message);
  }

  get friendly(): string {
    switch (this.kind) {
      case "no_key":
        return `Composio has no key. Add ${COMPOSIO.keySecret} on the connector's settings page.`;
      case "key":
        return `Composio rejected the key. Check ${COMPOSIO.keySecret} on the connector's settings page.`;
      case "balance":
        return "Composio's balance is empty. Top it up on composio.dev.";
      case "tool":
        return `A Composio tool is missing or has changed: ${this.message.slice(0, 200)}`;
      case "time":
        return "Composio's workbench hit its time limit.";
      default:
        return `Composio error: ${this.message.slice(0, 200)}`;
    }
  }
}

export function classify(message: string): ComposioError {
  if (/\b401\b|unauthori[sz]ed|invalid (api |consumer )?key/i.test(message)) return new ComposioError("key", message);
  if (/\b402\b|WalletBalanceExhausted|insufficient (balance|credit)/i.test(message)) return new ComposioError("balance", message);
  if (/tool[^.]{0,40}(not found|does not exist|unknown)|unknown tool|no tool named/i.test(message)) return new ComposioError("tool", message);
  if (/time ?limit|timed out|timeout|exceeded 180/i.test(message)) return new ComposioError("time", message);
  return new ComposioError("other", message);
}

export interface PageRequest {
  id: string;
  url: string;
}

export interface PageResult {
  id: string;
  ok: boolean;
  error?: string;
  status?: number | null;
  final?: string | null;
  title?: string | null;
  chars: number;
  // The start of the page, as Markdown.
  head: string;
  // Links whose text matches one of the keywords: [text, url].
  matches: [string, string][];
  // Links to hiring services found anywhere on the page.
  services: string[];
  charge: number;
}

export interface PageOptions {
  // Link texts to keep (lower case match).
  keywords: string[];
  headChars: number;
  // true: the page's main content only (adverts); false: the whole page,
  // menus included (careers pages, whose job links can sit anywhere).
  mainOnly: boolean;
}

export interface Composio {
  readPages(pages: PageRequest[], options: PageOptions): Promise<PageResult[]>;
  toolSettings(tool: string): Promise<string[]>;
}

// The Python run in the workbench. Calls arrive base64-encoded so no value
// can break the script.
export function pageScript(pages: PageRequest[], options: PageOptions): string {
  const payload = Buffer.from(
    JSON.stringify({ pages, keywords: options.keywords.map((k) => k.toLowerCase()), head: options.headChars, tool: COMPOSIO.scrape.tool, args: { ...COMPOSIO.scrape.args, onlyMainContent: options.mainOnly } }),
  ).toString("base64");
  return `import json, base64, re
from concurrent.futures import ThreadPoolExecutor
job = json.loads(base64.b64decode("${payload}").decode())
SERVICE = re.compile(r"greenhouse\\.io|lever\\.co|ashbyhq\\.com|workable\\.com", re.I)
LINK = re.compile(r"\\[([^\\]]{2,300})\\]\\((https?://[^)\\s]+)\\)")
def one(p):
    args = dict(job["args"]); args["url"] = p["url"]
    r, e = run_composio_tool(job["tool"], args)
    if e:
        return {"id": p["id"], "ok": False, "error": str(e)[:500], "chars": 0, "head": "", "matches": [], "services": [], "charge": 0}
    d = (r or {}).get("data") or {}
    inner = d.get("data") if isinstance(d.get("data"), dict) else d
    md = inner.get("markdown") or ""
    meta = inner.get("metadata") or {}
    matches, seen = [], set()
    for text, url in LINK.findall(md):
        first = re.sub(r"\\s+", " ", re.sub(r"[\\\\*#_]+", " ", text.split("\\n")[0])).strip()
        low = first.lower()
        if url not in seen and any(k in low for k in job["keywords"]):
            seen.add(url); matches.append([first[:200], url])
    services = sorted({l for l in (inner.get("links") or []) if SERVICE.search(l)})[:20]
    charge = float(((r or {}).get("instant_charge") or {}).get("amount") or 0)
    return {"id": p["id"], "ok": True, "status": meta.get("statusCode"), "final": meta.get("url") or meta.get("sourceURL"), "title": meta.get("title"), "chars": len(md), "head": md[: job["head"]], "matches": matches[:80], "services": services, "charge": charge}
with ThreadPoolExecutor(8) as ex:
    out = list(ex.map(one, job["pages"]))
print("${COMPOSIO.marker}" + json.dumps(out))
`;
}

// Pulls the workbench's reply apart: Connect wraps the script's printed
// output in JSON, and the result follows the marker.
export function parseWorkbench(text: string): unknown {
  let stdout = text;
  try {
    const outer = JSON.parse(text);
    if (outer?.successful === false || outer?.error) {
      const message = typeof outer.error === "string" ? outer.error : JSON.stringify(outer.error ?? outer);
      if (message && message !== "null") throw classify(message);
    }
    stdout = outer?.data?.stdout ?? outer?.stdout ?? text;
    const scriptError = outer?.data?.error;
    if (scriptError && !String(stdout).includes(COMPOSIO.marker)) throw classify(String(scriptError));
  } catch (error) {
    if (error instanceof ComposioError) throw error;
    // Not JSON: look for the marker in the raw text.
  }
  const at = String(stdout).lastIndexOf(COMPOSIO.marker);
  if (at < 0) throw new ComposioError("other", `the workbench printed no result: ${String(stdout).slice(0, 300)}`);
  const line = String(stdout).slice(at + COMPOSIO.marker.length).split("\n")[0];
  return JSON.parse(line);
}

function textOf(result: any): string {
  if (result?.isError) throw classify((result.content ?? []).map((c: any) => c.text ?? "").join(" ") || "tool call failed");
  return (result?.content ?? []).map((c: any) => (c.type === "text" ? c.text : "")).join("");
}

let override: Composio | null = null;

// Used by tests.
export function useComposio(client: Composio | null): void {
  override = client;
}

export async function composio(): Promise<Composio> {
  if (override) return override;
  const key = await readSecret(COMPOSIO.keySecret);
  if (!key) throw new ComposioError("no_key", "no key");

  async function withClient<T>(work: (client: Client) => Promise<T>): Promise<T> {
    const client = new Client({ name: "job-search", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(COMPOSIO.url), { requestInit: { headers: { [COMPOSIO.keyHeader]: key! } } });
    try {
      await client.connect(transport);
      return await work(client);
    } catch (error) {
      if (error instanceof ComposioError) throw error;
      throw classify((error as Error).message ?? String(error));
    } finally {
      await client.close().catch(() => {});
    }
  }

  async function runScript(client: Client, code: string): Promise<unknown> {
    const result = await client.callTool(
      { name: COMPOSIO.workbench, arguments: { code_to_execute: code, thought: "Read job pages for the daily job search.", current_step: "READING_JOB_PAGES" } },
      undefined,
      { timeout: COMPOSIO.callTimeoutMs },
    );
    return parseWorkbench(textOf(result));
  }

  return {
    async readPages(pages, options) {
      if (!pages.length) return [];
      return withClient(async (client) => {
        const out: PageResult[] = [];
        for (let i = 0; i < pages.length; i += COMPOSIO.batchSize) {
          const batch = pages.slice(i, i + COMPOSIO.batchSize);
          const code = pageScript(batch, options);
          // One retry, except when retrying can't help.
          const results = (await runScript(client, code).catch((error) => {
            if (error instanceof ComposioError && ["key", "balance", "tool"].includes(error.kind)) throw error;
            return runScript(client, code);
          })) as PageResult[];
          out.push(...results);
        }
        return out;
      });
    },
    async toolSettings(tool) {
      return withClient(async (client) => {
        const result = await client.callTool({ name: COMPOSIO.schemas, arguments: { tool_slugs: [tool] } }, undefined, { timeout: 60_000 });
        const reply = JSON.parse(textOf(result));
        const schema = reply?.data?.tool_schemas?.[tool]?.input_schema;
        if (!schema) throw new ComposioError("tool", `${tool} was not found`);
        return Object.keys(schema.properties ?? {});
      });
    },
  };
}
