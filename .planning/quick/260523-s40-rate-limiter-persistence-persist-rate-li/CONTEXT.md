---
quick_id: 260523-s40
slug: rate-limiter-persistence-persist-rate-li
date: 2026-05-24
phase: discussion
description: |
  Persist rate-limit hits to SQLite so the 5-per-hour limit on /api/signup and
  /api/manage isn't reset by process restarts or deploys. Today the limiter is
  an in-memory `Map<key, number[]>` in `src/lib/rate-limit.ts` (28 lines); a
  GitHub Actions deploy (~40s cadence on push to main) wipes it and grants
  attackers a fresh budget. Three design decisions locked: row-per-hit table
  shape, HMAC-hashed IP keys (raw IPs never persisted), fail-open on DB error.
---

# Context — rate-limiter persistence

## Current state (verified before discussion)

`src/lib/rate-limit.ts` — 28 lines.

```
const WINDOW_MS = 60 * 60 * 1000;   // 1 hour
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();
// setInterval cleanup every WINDOW_MS, .unref()'d
```

Call sites (both POST endpoints that mint magic links):

| File | Lines | Keys checked |
|------|-------|--------------|
| `src/pages/api/signup.ts` | 73–74 | `ip:${ip}`, `email:${rawEmail}` |
| `src/pages/api/manage.ts` | 60–61 | `ip:${ip}`, `email:${rawEmail}` |

Failure mode: `back('rate-limited')` → 303 → user-facing message "Too many tries. Wait an hour and try again." (index.astro:197, manage.astro:200).

## The actual leak this closes

GitHub Actions auto-deploys on every push to `main` in ~40s. A deploy restarts `oddlympics.service` → the Node process restarts → `new Map()` → all rate-limit counters are zero. An attacker who burns their 5/hour budget can:
1. Wait for the next deploy (cron-like — every commit, currently several per day during pre-launch).
2. Burst 5 more.

For an attacker with a target (e.g. enumerating which emails are signed up via `/api/manage`'s response timing or via the magic-link-sent confirmation), this means roughly **5 × deploys-per-hour** budget instead of **5/hour**.

The persistent table makes the limit hold across restarts.

## Decisions

### D-01: Schema is row-per-hit

```sql
CREATE TABLE IF NOT EXISTS rate_limit_hits (
  key TEXT NOT NULL,
  ts  INTEGER NOT NULL          -- unix seconds
);
CREATE INDEX IF NOT EXISTS idx_rlh_key_ts ON rate_limit_hits(key, ts);
```

**User choice:** Row-per-hit over JSON-per-key and fixed-bucket.

**Why:** MAX_PER_WINDOW=5 means 5 rows/key/hour max — pessimistic worst case across all active keys is well under 10k rows even with abuse. `SELECT COUNT(*) WHERE key=? AND ts>?` is a single index range scan — sub-millisecond. No JSON serialization round-trip per check. No fixed-bucket boundary effects (5 at :59 + 5 at :01 attack). `SELECT * FROM rate_limit_hits WHERE key='ip:abc'` shows exactly what's happening for any debugging.

**Rejected alternatives:**
- **JSON-per-key:** read + parse + filter + re-serialize + UPDATE per check is roughly 4× the work of two prepared statements, and atomic re-write requires a transaction. Pure overhead for our shape.
- **Fixed-bucket counter:** boundary effect doubles the effective limit at hour boundaries. Cheap, but the wrong shape for "in the last N seconds" semantics.

### D-02: IPs are HMAC-hashed with `MAGIC_LINK_SECRET`; emails are stored raw

```ts
import { createHmac } from 'node:crypto';

function hashIp(ip: string): string {
  return createHmac('sha256', MAGIC_LINK_SECRET)
    .update(ip)
    .digest('base64url')
    .slice(0, 16);   // 16 chars of base64url = 96 bits, plenty for keying
}

const ipKey = `ip:${hashIp(ip)}`;
const emailKey = `email:${rawEmail}`;   // raw — see rationale below
```

**User choice:** Hash IPs, leave emails as raw.

**Why hash IPs:** Today the codebase never persists client IPs anywhere — not in `vip_signups`, not in Caddy logs (disabled), not in journald (Node doesn't log request URLs). Adding raw IPs to a new table is a meaningful new privacy surface. Hashing with the existing `MAGIC_LINK_SECRET` (already root-owned in `/etc/oddlympics.env`, the most secret thing on the box) means a DB dump exposes opaque counters, not IP addresses. Same IP within the window hashes identically so counting still works. Cost: ~1µs per check, negligible.

**Why NOT hash emails:** emails are already stored plaintext in `vip_signups.email` and used as the primary key for that table. Hashing them in the rate-limit table adds no privacy gain (the plaintext exists 3cm away), while making debugging harder ("which user is being rate-limited?" requires hash-side lookup). Keep the existing `email:${rawEmail}` shape.

**Salt rotation:** N/A. The window is 1 hour; even if `MAGIC_LINK_SECRET` rotates, old hashes pruning out within 1h is acceptable. (If the secret were to rotate, in-flight rate-limit keys would just not match new ones — equivalent to a one-hour reset for IP-keyed entries. Acceptable.)

### D-03: Fail-open on DB error, log to `console.error`

```ts
export function checkRateLimit(key: string): boolean {
  try {
    const cutoff = Math.floor(Date.now() / 1000) - WINDOW_SEC;
    const { count } = countStmt.get(key, cutoff) as { count: number };
    if (count >= MAX_PER_WINDOW) return false;
    insertStmt.run(key, Math.floor(Date.now() / 1000));
    return true;
  } catch (err) {
    console.error('[rate-limit] DB error, failing open:', err);
    return true;   // allow the request
  }
}
```

**User choice:** Fail-open + log.

**Why:** The current Map can't throw — today's behavior is implicitly fail-open. Switching to fail-closed would be a regression that, on launch night under unexpected DB pressure, turns into a full DOS of `/api/signup` and `/api/manage`. The console.error lands in `journalctl -u oddlympics` so an operator notices. Trade-off accepted: during a DB outage the rate limiter is silently disabled — but during a DB outage the bigger problems are upstream (the same DB powers everything else).

**Rejected:** asymmetric (fail-closed on signup, fail-open on manage). Justified concern but adds branching in a 28-line file; the operational symmetry is more valuable than the marginal abuse-resistance gain.

## Bake-in implementation decisions (no user input needed)

- **Drop the in-memory Map entirely.** Source of truth is SQLite. No write-through cache (the whole point is durability — a cache reintroduces a lossy layer and a coherency footgun).
- **Drop the `setInterval` cleanup.** Replaced by (a) boot-time prune at module load in `src/lib/db.ts` (same pattern as Phase 5/9/12, and the `consumed_tokens` prune just shipped in quick-260523-r1x), and (b) opportunistic prune of stale rows for the current key on each check (cheap — one `DELETE WHERE key=? AND ts<?`).
- **Keep `WINDOW_MS` / `MAX_PER_WINDOW`.** Policy unchanged. Only the storage layer changes.
- **Migration:** standard `CREATE TABLE IF NOT EXISTS` inline in `src/lib/db.ts` schema block. Idempotent on re-boot. No data migration — the in-memory Map's contents are deliberately discarded (they would have been lost on the next restart anyway).
- **Constants:** add `WINDOW_SEC = WINDOW_MS / 1000` since SQLite is keyed on unix seconds; or compute inline. (Planner pick — both are fine, prefer the constant for readability.)
- **First-deploy reset:** the cutover commit deploys an empty table. The very first deploy still gives attackers a clean budget (one time). Acceptable — every persistent rate limiter has this property at install time.

## Smoke / regression strategy

- `scripts/smoke-signup.mjs` (Phase 5 canonical) MUST still exit 0 — has an existing pre-existing FAIL `REF-code-uniqueness` (dev-DB artifact, documented in 260523-r1x SUMMARY); ignore that one if still present.
- `scripts/smoke-manage.mjs` (M1–M17, includes our new M17) MUST still exit 0.
- New smoke case: programmatically POST `/api/signup` 6 times with the same email, assert the 6th returns `?error=rate-limited`. Restart the dev server. Assert the 7th ALSO returns rate-limited (proving persistence across restart). This is the literal regression the task closes.

## Open questions for PLAN

1. Add a new smoke script `scripts/smoke-rate-limit.mjs`, or extend `smoke-signup.mjs` with a `RL1` case? **Recommendation:** new script — `smoke-signup.mjs` is already long, and the rate-limit assertions need a server restart to prove persistence which is awkward to embed in the existing flow.
2. Where to hash IPs? In `rate-limit.ts` itself (the limiter exposes `checkRateLimit(rawKey, hashIp = false)` and the IP call sites opt in), or hash at the call site (`checkRateLimit(\`ip:\${hashIp(ip)}\`)`)? **Recommendation:** hash at the call site — keeps `rate-limit.ts` storage-agnostic and makes the privacy decision visible at every IP-rate-limit invocation.
3. Should the `hashIp` helper live in `rate-limit.ts`, `token.ts`, or a new tiny `crypto-keys.ts`? **Recommendation:** export from `rate-limit.ts` as `hashIp` — it's directly tied to the rate-limit use case; if a second use case appears later (referrer hashing, abuse analytics), move it then.

## Out of scope (defer)

- Changing the rate-limit policy itself (5/hour). The reviewer didn't ask; the existing values are reasonable; bumping them is a separate decision.
- Adding new keying dimensions (e.g. per-endpoint, per-user-agent fingerprint). Same reason.
- Migrating `consumed_tokens` (just shipped) to a shared pruning helper. The two tables have different TTLs and different rationales — premature abstraction.
- Persisting rate-limit decisions for auditability. Logging is enough.
