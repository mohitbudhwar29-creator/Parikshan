// Fixed-window rate limiter kept in memory. It is per server process: a multi-instance deployment
// needs a shared store (for example Redis) to enforce the same limit across instances.

interface Bucket {
  windowStart: number;
  count: number;
}

const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;

export interface RateDecision {
  ok: boolean;
  retryAfterSeconds: number;
}

export function consumeRateLimit(key: string, limitPerWindow: number, now: number = Date.now()): RateDecision {
  if (buckets.size > 5_000) {
    for (const [name, bucket] of buckets) if (now - bucket.windowStart >= WINDOW_MS) buckets.delete(name);
  }
  const current = buckets.get(key);
  if (!current || now - current.windowStart >= WINDOW_MS) {
    buckets.set(key, { windowStart: now, count: 1 });
    return { ok: true, retryAfterSeconds: 0 };
  }
  if (current.count >= limitPerWindow) {
    return { ok: false, retryAfterSeconds: Math.ceil((WINDOW_MS - (now - current.windowStart)) / 1000) };
  }
  current.count += 1;
  return { ok: true, retryAfterSeconds: 0 };
}

/** Test helper: clears all counters. */
export function resetRateLimits(): void {
  buckets.clear();
}
