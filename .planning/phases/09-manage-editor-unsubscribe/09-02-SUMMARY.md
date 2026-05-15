---
phase: 09-manage-editor-unsubscribe
plan: "02"
subsystem: db-email
tags:
  - db
  - email
  - re-subscribe
  - manage-02
dependency_graph:
  requires:
    - 09-01  # TTL_BY_PURPOSE in token.ts (wave peer)
  provides:
    - markConfirmed re-subscribe semantics (D-07)
    - sendManageLink URL at /manage (D-01)
  affects:
    - src/pages/api/confirm.ts (caller — behaviour widened, no code change)
    - src/pages/api/manage.ts (caller — now emits /manage?token= URLs)
tech_stack:
  added: []
  patterns:
    - DB-layer idempotency via widened WHERE clause (OR branch on unsubscribed_at IS NOT NULL)
key_files:
  created: []
  modified:
    - src/lib/db.ts
    - src/lib/email.ts
decisions:
  - D-07: markConfirmed WHERE widened to match unsubscribed_at IS NOT NULL; SET clears unsubscribed_at to restore fully-active state (re-subscribe SC4)
  - D-01: sendManageLink URL changed from /schedule?token= to /manage?token=
  - markUnsubscribed left unchanged — its WHERE email = ? AND unsubscribed_at IS NULL is the D-06 single-use contract
metrics:
  duration: "1m 24s"
  completed: "2026-05-15T02:06:19Z"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
  files_created: 0
---

# Phase 09 Plan 02: DB + Email Library Edits Summary

Two surgical library edits completing the back-end half of Phase 9 Wave 1:
widened `markConfirmed` re-subscribe semantics (D-07) + `sendManageLink` URL
consolidated to `/manage` (D-01).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Widen markConfirmed WHERE + clear unsubscribed_at (D-07) | 256299b | src/lib/db.ts |
| 2 | sendManageLink URL /schedule→/manage (D-01) | 3e91669 | src/lib/email.ts |

## Diffs

### Task 1: markConfirmed (src/lib/db.ts)

**Before (lines 95-100):**
```sql
export const markConfirmed = db.prepare<[string]>(`
  UPDATE vip_signups
  SET confirmed_at = strftime('%s','now')
  WHERE email = ? AND confirmed_at IS NULL
  RETURNING *
`);
```

**After:**
```sql
// D-07 (re-subscribe SC4): WHERE is widened to also match rows where
// unsubscribed_at IS NOT NULL, so a previously-unsubscribed user who
// re-confirms via magic link gets their row restored to fully active.
// SET clears unsubscribed_at to NULL alongside updating confirmed_at.
// Already-confirmed-and-active rows produce 0 rows (idempotent): their
// confirmed_at IS NOT NULL and unsubscribed_at IS NULL, so neither
// branch of the OR matches.
export const markConfirmed = db.prepare<[string]>(`
  UPDATE vip_signups
  SET confirmed_at = strftime('%s','now'),
      unsubscribed_at = NULL
  WHERE email = ? AND (confirmed_at IS NULL OR unsubscribed_at IS NOT NULL)
  RETURNING *
`);
```

**Behaviour matrix (from RESEARCH Q4):**

| Row state | WHERE matches? | Result |
|-----------|---------------|--------|
| fresh, unconfirmed (`confirmed_at IS NULL`, `unsubscribed_at IS NULL`) | YES (branch 1) | Row returned, `confirmed_at` set |
| previously unsubscribed (`confirmed_at` set, `unsubscribed_at IS NOT NULL`) | YES (branch 2) | Row returned, `unsubscribed_at` cleared → fully active |
| already confirmed and active (`confirmed_at` set, `unsubscribed_at IS NULL`) | NO | undefined → `getByEmail` fallback → `status=already` |

### Task 2: sendManageLink URL (src/lib/email.ts:68)

**Before:**
```typescript
const url = `${SITE_URL}/schedule?token=${encodeURIComponent(token)}`;
```

**After:**
```typescript
const url = `${SITE_URL}/manage?token=${encodeURIComponent(token)}`;
```

One-character path segment change (`/schedule` → `/manage`). The `url`
variable is interpolated into `text` and `html` bodies; no other strings
in the function reference the path literally.

### markUnsubscribed — NOT touched (D-06 contract preserved)

src/lib/db.ts lines 106-110 remain exactly as shipped:
```sql
export const markUnsubscribed = db.prepare<[string]>(`
  UPDATE vip_signups
  SET unsubscribed_at = strftime('%s','now')
  WHERE email = ? AND unsubscribed_at IS NULL
  RETURNING *
`);
```
The `WHERE unsubscribed_at IS NULL` clause is the D-06 single-use
contract: first click fires, second click is a no-op returning undefined
(`status=already`). This was verified by grep but not modified.

## In-flight /schedule?token= Links

Any manage-purpose magic links already in user inboxes (emitted before this
deploy) point at `/schedule?token=...`. These remain valid because:
1. Their HMAC signatures are checked against purpose=manage — unaffected.
2. Plan 09-03 ships a thin 301 redirect: `GET /schedule?token=X` →
   `GET /manage?token=X`, preserving the query string.
3. `manage`-purpose token TTL is 24h (set by 09-01's TTL_BY_PURPOSE). All
   pre-deploy in-flight links expire within a day of the 09-03 deploy,
   closing the transition window cleanly.

## Verification Results

All checks from the plan passed:

- `grep -E "WHERE email = \? AND \(confirmed_at IS NULL OR unsubscribed_at IS NOT NULL\)"` — PASS (1 match)
- `grep -c "unsubscribed_at = NULL" src/lib/db.ts` — PASS (returns 1)
- `markUnsubscribed WHERE unsubscribed_at IS NULL` — PASS (unchanged)
- `grep -c "/manage?token=" src/lib/email.ts` — PASS (returns 1)
- `/schedule?token=` absent from email.ts — PASS
- `npm run build` — PASS (exits 0; db.ts prepared statements compile at module load)
- `npx astro check` — 19 pre-existing type errors (missing @types/node, @types/better-sqlite3 devDeps); same count before and after this plan's changes. Build gate (npm run build) is the correctness signal for this project.

## Deviations from Plan

None — plan executed exactly as written. Two surgical edits, both verifications passed.

## Known Stubs

None introduced by this plan.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes.

## Self-Check: PASSED

- src/lib/db.ts: exists and contains widened WHERE clause
- src/lib/email.ts: exists and contains /manage?token= URL
- Commit 256299b: exists (Task 1 — db.ts)
- Commit 3e91669: exists (Task 2 — email.ts)
