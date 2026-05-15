---
phase: 09-manage-editor-unsubscribe
plan: "01"
subsystem: auth
tags: [hmac, token, ttl, unsubscribe, manage-02]

requires:
  - phase: 01-hardening
    provides: mintToken/verifyToken HMAC token system with purpose field

provides:
  - TTL_BY_PURPOSE const table in src/lib/token.ts (confirm/manage=24h, unsubscribe=1y, session=30d)
  - mintToken() purpose-aware TTL resolution via opts?.ttlSeconds ?? TTL_BY_PURPOSE[opts?.purpose ?? 'confirm']
  - buildUnsubscribeHeaders() automatically yields 1-year tokens (MANAGE-02 satisfied, no call-site change)

affects:
  - 09-02 (db + email library edits depend on this wave landing first)
  - 09-03 (schedule.astro redirect)
  - 09-04 (manage.astro rewrite, save-selection endpoint)
  - 09-05 (smoke-manage.mjs M8 tests 1-year token expiry)

tech-stack:
  added: ["@astrojs/check (dev verification)", "typescript (dev verification)"]
  patterns: ["Per-purpose TTL table pattern: keyed object with as const, purpose-aware fallback in mintToken"]

key-files:
  created: []
  modified:
    - src/lib/token.ts

key-decisions:
  - "D-05 (MANAGE-02): TTL_BY_PURPOSE table replaces scalar — unsubscribe=1y, others unchanged"
  - "opts.ttlSeconds takes precedence over TTL_BY_PURPOSE lookup — buildSessionCookie 30d path unaffected"
  - "session entry in TTL_BY_PURPOSE is documentation-only — buildSessionCookie always passes ttlSeconds explicitly"

patterns-established:
  - "Per-purpose TTL table: const TTL_BY_PURPOSE = { ... } as const; opts?.ttlSeconds ?? TTL_BY_PURPOSE[opts?.purpose ?? 'confirm']"

requirements-completed:
  - MANAGE-02
---

# Phase 09 Plan 01: TTL_BY_PURPOSE Token Table Summary

**Per-purpose TTL table in token.ts — unsubscribe tokens now HMAC-signed with 1-year expiry via TTL_BY_PURPOSE lookup, satisfying MANAGE-02 with zero call-site changes**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-05-15T02:01:17Z
- **Completed:** 2026-05-15T02:02:49Z
- **Tasks:** 1
- **Files modified:** 1 (src/lib/token.ts) + 2 (package.json, package-lock.json for @astrojs/check install)

## Accomplishments

- Replaced `TTL_SECONDS = 60 * 60 * 24` scalar with `TTL_BY_PURPOSE` const table (all four purposes: confirm/manage=24h, unsubscribe=1y, session=30d)
- Updated `mintToken()` TTL resolution to `opts?.ttlSeconds ?? TTL_BY_PURPOSE[opts?.purpose ?? 'confirm']`
- `buildUnsubscribeHeaders()` in `src/lib/email.ts` now automatically produces 1-year unsubscribe tokens — no call-site change required
- `buildSessionCookie()` in `src/lib/session.ts` continues to produce 30-day session tokens — it passes `ttlSeconds: SESSION_TTL_SECONDS` explicitly, which takes precedence via the `??` operator

## Diff Applied

**Lines changed in `src/lib/token.ts`:**

Before (line 4):
```typescript
const TTL_SECONDS = 60 * 60 * 24; // 24 hours
```

After (lines 4-14):
```typescript
// Per-purpose TTLs: unsubscribe links are 1-year credentials so a user's
// inbox copy remains actionable without requiring a re-login flow (MANAGE-02).
// The session entry mirrors src/lib/session.ts SESSION_TTL_SECONDS for documentation
// completeness — buildSessionCookie always passes ttlSeconds explicitly so this
// entry is never reached at runtime.
const TTL_BY_PURPOSE = {
  confirm:     60 * 60 * 24,         // 24h — magic-link confirm window
  manage:      60 * 60 * 24,         // 24h — magic-link manage window
  unsubscribe: 60 * 60 * 24 * 365,   // 1y — MANAGE-02: long-lived unsubscribe credential
  session:     60 * 60 * 24 * 30,    // 30d — mirrors src/lib/session.ts SESSION_TTL_SECONDS
} as const;
```

Before (line 38):
```typescript
const ttl = opts?.ttlSeconds ?? TTL_SECONDS;
```

After (lines 48-50):
```typescript
// opts.ttlSeconds takes precedence (buildSessionCookie passes it explicitly);
// otherwise resolve via purpose table; fall back to confirm (24h) if purpose absent.
const ttl = opts?.ttlSeconds ?? TTL_BY_PURPOSE[opts?.purpose ?? 'confirm'];
```

No other lines modified. `verifyToken()`, `Payload` type, `SECRET`, `effectiveSecret`, and all sign helpers are untouched.

## Grep Gate Results

All verification checks from the plan PASS:

| Check | Result |
|-------|--------|
| `grep -c "TTL_BY_PURPOSE" src/lib/token.ts` ≥ 2 | 2 (PASS) |
| Legacy `TTL_SECONDS` scalar declaration removed | NOT FOUND (PASS) |
| `unsubscribe: 60 * 60 * 24 * 365` present | MATCH (PASS) |
| `confirm: 60 * 60 * 24` present | MATCH (PASS) |
| `session: 60 * 60 * 24 * 30` present | MATCH (PASS) |
| `manage: 60 * 60 * 24` present | MATCH (PASS) |
| `TTL_BY_PURPOSE[opts?.purpose ?? 'confirm']` in mintToken | MATCH (PASS) |

Note: `grep -c "TTL_SECONDS"` returns 2 — both occurrences are in why-comments referencing `SESSION_TTL_SECONDS` (the session.ts constant name), not the removed `TTL_SECONDS` scalar. The scalar declaration `const TTL_SECONDS` is fully absent.

## Astro Check Status

`npx astro check` exits with 19 pre-existing errors (all `@types/node` / `@types/better-sqlite3` missing type declarations). These errors existed before this plan — confirmed by stash-and-check comparison. Zero new errors introduced by this change.

## Call-Site Impact

| Call site | File | Behavior before | Behavior after | Change required? |
|-----------|------|-----------------|----------------|-----------------|
| `mintToken(email, { purpose: 'unsubscribe' })` | `src/lib/email.ts:59` | 24h TTL | 1y TTL (MANAGE-02) | None |
| `mintToken(email, { purpose: 'confirm' })` | `src/pages/api/signup.ts` | 24h TTL | 24h TTL (unchanged) | None |
| `mintToken(email, { purpose: 'manage' })` | `src/pages/api/manage.ts` | 24h TTL | 24h TTL (unchanged) | None |
| `mintToken(email, { purpose: 'session', ttlSeconds: SESSION_TTL_SECONDS })` | `src/lib/session.ts:9-11` | 30d TTL | 30d TTL (unchanged — ttlSeconds takes precedence) | None |

## Task Commits

1. **Task 1: Replace TTL_SECONDS scalar with TTL_BY_PURPOSE table and update mintToken TTL resolution** - `99f3331` (feat)

**Plan metadata:** (pending)

## Files Created/Modified

- `/Users/john/Desktop/vault/projects/github.com/oddlympics-app/src/lib/token.ts` — Two surgical edits: `TTL_BY_PURPOSE` table replaces `TTL_SECONDS` scalar; `mintToken()` TTL lookup updated to purpose-aware form

## Decisions Made

D-05 (locked from CONTEXT.md) implemented exactly as specified: `TTL_BY_PURPOSE` with four entries at the precise values, `as const` for narrow inference, `opts?.ttlSeconds ?? TTL_BY_PURPOSE[opts?.purpose ?? 'confirm']` resolution, why-comments citing MANAGE-02 and session.ts.

## Deviations from Plan

None — plan executed exactly as written. The two edits are surgical and precise. No other lines in `token.ts` modified. No new exports. No new files created.

## Issues Encountered

`npx astro check` reported 19 errors — all pre-existing type declaration issues (`@types/node`, `@types/better-sqlite3` missing from devDependencies). Verified by stash comparison: identical 19 errors before any changes. Not caused by this plan's edits, not in scope to fix (Rule: only fix issues directly caused by current task changes).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 09-01 complete. Wave 1 library foundation is in place.
- Plan 09-02 can now proceed: `markConfirmed` WHERE widening + `sendManageLink()` URL change.
- `buildUnsubscribeHeaders()` will automatically use the 1-year TTL from the next email that fires — no further token.ts changes needed in Phase 9.

---
*Phase: 09-manage-editor-unsubscribe*
*Completed: 2026-05-15*
