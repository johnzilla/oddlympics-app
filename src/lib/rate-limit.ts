import { createHmac } from 'node:crypto';
import { countRecentHits, insertRateLimitHit, pruneRateLimitKey } from './db';

const WINDOW_SEC = 60 * 60; // 1 hour, in seconds (matches the boot-prune TTL in db.ts)
const MAX_PER_WINDOW = 5;

// Re-read process.env directly rather than importing from token.ts — keeps the two modules
// independent and matches token.ts's own pattern. The dev fallback string is intentionally
// distinct from token.ts's fallback ('dev-only-insecure-secret-do-not-use-in-prod') to
// prevent accidental cross-purpose HMAC equality if a caller ever compares outputs from
// both modules.
const SECRET = process.env.MAGIC_LINK_SECRET ?? '';
if (!SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('MAGIC_LINK_SECRET is required in production');
}
const effectiveSecret = SECRET || 'dev-only-rate-limit-key-do-not-use-in-prod';

// D-02: HMAC-hash IPs so raw dotted-quads never land in the DB.
// 16 chars of base64url = 96 bits of HMAC-SHA256 prefix — sufficient for keying.
export function hashIp(ip: string): string {
  return createHmac('sha256', effectiveSecret).update(ip).digest('base64url').slice(0, 16);
}

// D-01: SQLite-backed sliding-window rate limiter. Returns true (allow) or false (block).
// D-03: Fail-open on any DB error — logs and returns true so callers always get a result.
export function checkRateLimit(key: string): boolean {
  try {
    const now = Math.floor(Date.now() / 1000);
    const cutoff = now - WINDOW_SEC;
    // Opportunistic per-key prune: bounds row growth between boot-time prunes.
    pruneRateLimitKey.run(key, cutoff);
    const row = countRecentHits.get(key, cutoff) as { count: number };
    if (row.count >= MAX_PER_WINDOW) return false;
    insertRateLimitHit.run(key, now);
    return true;
  } catch (err) {
    console.error('[rate-limit] DB error, failing open:', err);
    return true;
  }
}
