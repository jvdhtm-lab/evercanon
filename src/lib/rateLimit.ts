/**
 * Minimal in-process fixed-window rate limiter. It is deliberately simple and
 * per-process; it is not a substitute for an edge/global limiter, but it bounds
 * abusive request bursts from one identity. Keys are opaque (for example a
 * visitor id), never an IP address.
 */

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): boolean {
  const existing = windows.get(key);
  if (!existing || now >= existing.resetAt) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (existing.count >= limit) return false;
  existing.count += 1;
  return true;
}

/** Test helper: clears all windows. */
export function resetRateLimits(): void {
  windows.clear();
}
