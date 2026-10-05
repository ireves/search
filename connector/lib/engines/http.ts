import { readSecret } from "../store.js";

export class EngineError extends Error {
  retryAfterMs?: number;

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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// One retry after a rate limit (429), and after a gateway error when the call
// is safe to repeat. Claude often runs several searches at once, which can hit
// a per-second limit.
export async function callJson<T>(
  engine: string,
  url: string,
  init: { method?: string; headers: Record<string, string>; body?: unknown; timeoutMs?: number; idempotent?: boolean },
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await callOnce<T>(engine, url, init);
    } catch (error) {
      const status = error instanceof EngineError ? error.status : 0;
      const retryable = status === 429 || (init.idempotent !== false && (status === 502 || status === 503 || status === 504));
      if (attempt >= 2 || !retryable) throw error;
      const wait = error instanceof EngineError && error.retryAfterMs !== undefined ? error.retryAfterMs : 1500;
      await sleep(Math.min(Math.max(wait, 500), 4000) + Math.floor(Math.random() * 400));
    }
  }
}

async function callOnce<T>(
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
    const err = new EngineError(engine, response.status, message);
    const retryAfter = Number(response.headers.get("retry-after"));
    if (Number.isFinite(retryAfter) && retryAfter > 0) err.retryAfterMs = retryAfter * 1000;
    throw err;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new EngineError(engine, 502, "unreadable response");
  }
}
