// Best-effort limit on wrong passwords, per server instance.

const WINDOW_MS = 10 * 60_000;
const MAX_FAILURES = 5;

const failures = new Map<string, number[]>();

function recent(ip: string): number[] {
  const now = Date.now();
  const list = (failures.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  failures.set(ip, list);
  return list;
}

export function isLocked(ip: string): boolean {
  return recent(ip).length >= MAX_FAILURES;
}

export async function recordFailure(ip: string): Promise<void> {
  recent(ip).push(Date.now());
  if (failures.size > 5000) failures.clear();
  // Slows down guessing.
  await new Promise((resolve) => setTimeout(resolve, 600));
}

export function clearFailures(ip: string): void {
  failures.delete(ip);
}
