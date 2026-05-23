---
quick_id: 260523-r1x
slug: redirect-url-data-leakage
date: 2026-05-23
status: complete
phase: execute
description: |
  Tightened the /manage magic-link token surface against data leakage via redirect URLs.
  Three atomic tactics: history.replaceState() URL scrub (Tactic 1), route-specific
  Referrer-Policy: no-referrer header (Tactic 2), and single-use enforcement via a
  new consumed_tokens SQLite table (Tactic 3). M1–M17 PASS. Zero new dependencies.
tags: [security, token, manage, history, referrer-policy, consumed_tokens]
commits:
  - tactic: 1
    hash: aa2a19a
    message: "fix(quick-260523-r1x-01): scrub ?token= from /manage URL via history.replaceState (Tactic 1)"
  - tactic: 2
    hash: 1cde23f
    message: "fix(quick-260523-r1x-02): set Referrer-Policy: no-referrer on /manage responses (Tactic 2)"
  - tactic: 3
    hash: ff152dc
    message: "fix(quick-260523-r1x-03): single-use enforcement on manage tokens via consumed_tokens (Tactic 3)"
files_modified:
  tactic_1: [src/pages/manage.astro]
  tactic_2: [src/pages/manage.astro]
  tactic_3: [src/lib/token.ts, src/lib/db.ts, src/pages/manage.astro, scripts/smoke-manage.mjs]
---

# 260523-r1x: Redirect-URL Data Leakage — Execution Summary

**One-liner:** Three independently-revertable commits close the /manage magic-link token leak surface: history scrub via replaceState, no-referrer header, and single-use enforcement via consumed_tokens PK constraint.

## Tasks Completed

| Task | Commit | Files Changed |
|------|--------|---------------|
| Tactic 1 — history.replaceState scrub | `aa2a19a` | src/pages/manage.astro |
| Tactic 2 — Referrer-Policy: no-referrer | `1cde23f` | src/pages/manage.astro |
| Tactic 3 — consumed_tokens single-use | `ff152dc` | token.ts, db.ts, manage.astro, smoke-manage.mjs |

## Smoke Results

### smoke-manage.mjs (M1–M17)

All 17 cases PASS, exit 0.

```
[smoke] PASS M1-signed-out-form
[smoke] PASS M2-url-token-editor
[smoke] PASS M3-save-valid
[smoke] PASS M4-save-bad-team
[smoke] PASS M5-save-bad-tz
[smoke] PASS M6-banner-team-null
[smoke] PASS M7-schedule-redirect
[smoke] PASS M7b-schedule-redirect-with-token
[smoke] PASS M8-unsub-1y-token-and-single-use
[smoke] PASS M9-resubscribe-path
[smoke] PASS M10-multi-save-n
[smoke] PASS M11-pre-check
[smoke] PASS M12-too-many
[smoke] PASS M13-empty-save
[smoke] PASS M14-cron-visibility
[smoke] PASS M15-unsub-save-rejected
[smoke] PASS M16-unsub-reconfirm-no-stale
[smoke] PASS M17-manage-single-use
[smoke] result: pass=18 fail=0
```

### smoke-signup.mjs (Phase 5 regression gate)

18 PASS, 1 pre-existing FAIL (`REF-code-uniqueness`). The failure is unrelated to this task — it reflects leftover smoke-artifact rows in the dev DB (smoke-m*@example.com rows without referral_code, inserted by dbInsertSmokeRow which doesn't set referral_code). This failure existed before this task's changes, verified by running smoke-signup.mjs against the state at commit `1cde23f` (Task 2 commit, no Task 3 changes yet). The Phase 5 signup flow and all security paths are unaffected.

## Storage Decision Recap

**Investigated Phase 9 per-purpose token TTL machinery first.** `CLAUDE.md` described Phase 9 as shipping "per-purpose token TTL table (1-year single-use unsubscribe)". Investigation found this refers to:

1. The in-memory `TTL_BY_PURPOSE` constant in `src/lib/token.ts:9-14` (not a table).
2. Idempotent behavior for unsubscribe via the `WHERE unsubscribed_at IS NULL` clause in `markUnsubscribed` — a second click of the same unsubscribe link is a no-op because `unsubscribed_at` is already set. The token signature itself is never persisted.

**Decision: new `consumed_tokens` table.** There was nothing to generalize. The table is purpose-keyed (col: `purpose TEXT NOT NULL`) so future expansion to other token types is a parameter change, not a schema change.

## Files Modified Per Tactic

### Tactic 1 — src/pages/manage.astro

Added a `{hadUrlToken && (<script is:inline>...)}` block unconditionally outside the `{valid && !isUnsubscribed && ...}` guard. Scrubs on all branches (success, bad-token, expired) using `URL` constructor + `searchParams.delete('token')` + `history.replaceState({}, '', pathname + search + hash)`. Wrapped in try/catch matching existing inline script pattern.

### Tactic 2 — src/pages/manage.astro

Added `Astro.response.headers.set('Referrer-Policy', 'no-referrer')` in frontmatter before the auth block (runs on every render). Scope: `/manage` GET only — `/api/manage` POST is a redirect endpoint with no rendered output and was deliberately left untouched.

### Tactic 3

**src/lib/token.ts:** Added `extractTokenSig(token: string): string | null` — extracts the raw sig portion after the first `.` without verifying the HMAC. Used by `consumeManageToken` to key `consumed_tokens.sig`.

**src/lib/db.ts:**
- Added `import { verifyToken, extractTokenSig } from './token';`
- Added `CREATE TABLE IF NOT EXISTS consumed_tokens (sig TEXT PRIMARY KEY, purpose TEXT NOT NULL, consumed_at INTEGER NOT NULL)` with `idx_consumed_tokens_consumed_at` index
- Boot-time prune: `DELETE FROM consumed_tokens WHERE consumed_at < strftime('%s','now') - 86400`
- Exported `consumeManageToken(token): { email: string } | null` — calls `extractTokenSig` → `verifyToken('manage')` → `INSERT INTO consumed_tokens`; catches `SQLITE_CONSTRAINT_PRIMARYKEY` as the "already consumed" signal; all other errors re-thrown

**src/pages/manage.astro:**
- Removed `import { verifyToken } from '../lib/token'`
- Added `consumeManageToken` to the db import
- Swapped line 41: `verifyToken(urlToken, 'manage')` → `consumeManageToken(urlToken)`

**scripts/smoke-manage.mjs:**
- Added M17-manage-single-use case (lines after M16): mints one manage token, hits /manage twice, asserts first click → editor + Set-Cookie, second click → bad-token UI + no editor
- Updated header docstring: `Covers M1–M17`, added M17 evidence-tag comment, added `quick-260523-r1x` extended-in note

## Follow-up Note

Generalizing single-use enforcement to the `confirm` purpose is a one-parameter change: rename `consumeManageToken` → `consumeToken(token, purpose)` (the `'manage'` literal in `insertConsumedToken.run(sig, 'manage', now)` becomes the parameter). The `confirm` flow already has de-facto idempotency via `WHERE confirmed_at IS NULL`, so this is low-priority — document for a future hardening pass if confirm token replay becomes a concern.

## Verification

### Referrer-Policy: no-referrer on the wire

```
HTTP/1.1 200 OK
Vary: Origin
content-type: text/html
referrer-policy: no-referrer
Date: Sat, 23 May 2026 23:46:48 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Transfer-Encoding: chunked
```

Confirmed on both branch B (bad-token, `?token=bad`) and branch A (no token, bare `/manage`).

### history.replaceState in emitted HTML

```
# With ?token= — count 1 (scrub script emitted):
curl -sS 'http://localhost:4321/manage?token=invalid.sig' | grep -c "history.replaceState"
1

# Without ?token= — count 0 (script suppressed):
curl -sS 'http://localhost:4321/manage' | grep -c "history.replaceState"
0
```

### Referrer-Policy absent on /api/manage POST

```
curl -sS -D - -o /dev/null -X POST -H 'Content-Type: application/x-www-form-urlencoded' \
  -H 'Origin: http://localhost:4321' -d 'email=nobody@example.com' \
  'http://localhost:4321/api/manage' | grep -ic 'referrer-policy'
0
```

### consumed_tokens schema

```
cols found: ["consumed_at","purpose","sig"]
PASS: consumed_tokens schema OK
```

## Deviations from Plan

None. Plan executed exactly as written. The `astro check` type-error in manage.astro (`process` not found at line 74) is pre-existing — it was present before this task and exists in unmodified context (the share URL composition from Phase 14).
