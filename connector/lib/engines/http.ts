import { readSecret } from "../store.js";

export class EngineError extends Error {
  constructor(
    public engine: string,
    public status: number,
    message: string,
  ) {
    super(message);
  }

  // Plain-language reason, safe to show to Claude and the user.
  get friendly(): string {
    if (this.status === 0 && /no API key/.test(this.message)) return this.message;
    if (this.status === 401 || this.status === 403) return `${this.engine} rejected the API key. Check it on the connector's settings page.`;
    if (this.status === 402) return `${this.engine} is out of credit.`;
    if (this.status === 429) return `${this.engine} rate limit reached. Try again shortly.`;
    if (this.status === 408 || this.status === 504 || this.status === -1) return `${this.engine} took too long to respond.`;
    if (this.status >= 500) return `${this.engine} had a server error (${this.status}).`;
    return `${this.engine} error ${this.status}: ${this.message.slice(0, 200)}`;
  }
}

export async function apiKey(engine: "Exa" | "Parallel"): Promise<string> {
  const name = engine === "Exa" ? "EXA_API_KEY" : "PARALLEL_API_KEY";
  const key = await readSecret(name);
  if (!key) throw new EngineError(engine, 0, `${engine} has no API key. Add ${name} on the connector's settings page.`);
  return key;
}

export async function callJson<T>(
  engine: string,
  url: string,
  init: { method?: string; headers: Record<string, string>; body?: unknown; timeoutMs?: number },
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? 30_000);
  let response: Response;
  try {
    response = await fetch(url, {
      method: init.method ?? (init.body === undefined ? "GET" : "POST"),
      headers: { "content-type": "application/json", accept: "application/json", ...init.headers },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: controller.signal,
    });
  } catch (error) {
    const aborted = (error as Error).name === "AbortError";
    throw new EngineError(engine, aborted ? -1 : 0, aborted ? "timeout" : `network error: ${(error as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
  const text = await response.text();
  if (!response.ok) {
    let message = text;
    try {
      const parsed = JSON.parse(text);
      message = parsed?.error?.message ?? parsed?.error ?? parsed?.message ?? parsed?.detail ?? text;
      if (typeof message !== "string") message = JSON.stringify(message);
    } catch {
      // keep raw text
    }
    throw new EngineError(engine, response.status, message);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new EngineError(engine, 502, "unreadable response");
  }
}
