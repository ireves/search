// A record of every engine request made during one tool call: which engine,
// what for, the settings sent (never keys), how long it took, how many
// results came back and any error. Saved with the call for the problem log
// (see logstore.ts), so a skill only has to pass the call's ref when
// something goes wrong instead of restating its parameters.

import { AsyncLocalStorage } from "node:async_hooks";

export interface Step {
  engine: string;
  purpose: string;
  endpoint: string;
  settings?: unknown;
  status: number;
  ms: number;
  results?: number;
  error?: string;
}

const MAX_STEPS = 40;
const current = new AsyncLocalStorage<Step[]>();

export async function traced<T>(fn: () => Promise<T>): Promise<{ value: T; steps: Step[] }> {
  const steps: Step[] = [];
  const value = await current.run(steps, fn);
  return { value, steps };
}

export function recordStep(step: Step): void {
  const steps = current.getStore();
  if (steps && steps.length < MAX_STEPS) steps.push(step);
}

// Matched against host and path, e.g. api.exa.ai/contents.
const PURPOSES: [RegExp, string][] = [
  [/^api\.search\./, "search"],
  [/^api\.fetch\./, "read pages"],
  [/\/agent\/runs|\/tasks\/runs/, "research agent"],
  [/\/contents$|\/extract$|\/scrape$/, "read pages"],
  [/\/search$/, "search"],
  [/\/acts\//, "job adverts"],
  [/\/works\/[^/]+\.(pdf|grobid-xml)$/, "paper full text"],
  [/\/works$/, "paper search"],
  [/\/works\//, "paper lookup"],
];

export function purposeOf(url: string): string {
  const u = new URL(url);
  const where = `${u.host}${u.pathname.replace(/\/+$/, "")}`;
  return PURPOSES.find(([pattern]) => pattern.test(where))?.[1] ?? "other";
}

// Names such as apiKey, api_key, token or authorization; not max_tokens_per_page.
const SECRET = /(^|[_-])(api_?key|key|token|secret|password)$|apikey$|authori[sz]ation/i;

// The address without its host or anything that looks like a credential.
export function endpointOf(url: string): string {
  const u = new URL(url);
  for (const name of [...u.searchParams.keys()]) if (SECRET.test(name)) u.searchParams.delete(name);
  const query = u.searchParams.toString();
  return `${u.pathname}${query ? `?${query}` : ""}`.slice(0, 300);
}

// A small copy of a request body: long text and lists cut down, keys left out.
export function compact(value: unknown, max = 300, depth = 0): unknown {
  if (typeof value === "string") return value.length > max ? `${value.slice(0, max)}…` : value;
  if (value === null || typeof value !== "object") return value;
  if (depth >= 4) return "…";
  if (Array.isArray(value)) {
    const items = value.slice(0, 10).map((v) => compact(v, max, depth + 1));
    return value.length > 10 ? [...items, `…${value.length - 10} more`] : items;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) if (!SECRET.test(k)) out[k] = compact(v, max, depth + 1);
  return out;
}

export function resultCount(data: unknown): number | undefined {
  if (Array.isArray(data)) return data.length;
  if (!data || typeof data !== "object") return undefined;
  const d = data as Record<string, any>;
  for (const list of [d.results, d.data, d.data?.web, d.items]) if (Array.isArray(list)) return list.length;
  return undefined;
}
