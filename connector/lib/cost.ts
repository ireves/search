// Adds up what Exa and Parallel charge during one tool call, so each reply
// can end with its cost. Exa reports its own cost; Parallel's is worked out
// from its price list (see PARALLEL_PRICES in engines/parallel.ts). Firecrawl
// is counted in credits, since its plans are a monthly credit allowance.
// Apify's job-board scrapers are estimated from their price per advert.

import { AsyncLocalStorage } from "node:async_hooks";

export interface Meter {
  exa: number;
  parallel: number;
  apify: number;
  firecrawlCredits: number;
}

const current = new AsyncLocalStorage<Meter>();

export function addCost(engine: "exa" | "parallel" | "apify", dollars: number | null | undefined): void {
  const meter = current.getStore();
  if (meter && typeof dollars === "number" && Number.isFinite(dollars) && dollars > 0) meter[engine] += dollars;
}

export function addCredits(engine: "firecrawl", credits: number): void {
  const meter = current.getStore();
  if (meter && Number.isFinite(credits) && credits > 0) meter.firecrawlCredits += credits;
}

export async function metered<T>(fn: () => Promise<T>): Promise<{ value: T; meter: Meter }> {
  const meter: Meter = { exa: 0, parallel: 0, apify: 0, firecrawlCredits: 0 };
  const value = await current.run(meter, fn);
  return { value, meter };
}

export function dollars(n: number): string {
  return `$${n.toFixed(n > 0 && n < 0.01 ? 4 : 3)}`;
}

export function costLine(meter: Meter): string {
  const total = meter.exa + meter.parallel + meter.apify;
  const apify = meter.apify ? `, Apify ${dollars(meter.apify)}` : "";
  const credits = meter.firecrawlCredits ? `, Firecrawl ${meter.firecrawlCredits} credit${meter.firecrawlCredits === 1 ? "" : "s"}` : "";
  return `Search cost of this call: ${dollars(total)} (Exa ${dollars(meter.exa)}, Parallel ${dollars(meter.parallel)}${apify}${credits})`;
}
