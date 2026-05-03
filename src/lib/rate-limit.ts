const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_PER_WINDOW = 5;

const hits = new Map<string, number[]>();

export function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const recent = (hits.get(key) ?? []).filter((t) => t > cutoff);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}

// Periodic cleanup so the map doesn't grow forever in a long-running process.
setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [k, arr] of hits) {
    const kept = arr.filter((t) => t > cutoff);
    if (kept.length === 0) hits.delete(k);
    else hits.set(k, kept);
  }
}, WINDOW_MS).unref?.();
