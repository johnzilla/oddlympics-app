---
phase: 12-restore-multi-team-selection
plan: 05
subsystem: api
tags: [sqlite, better-sqlite3, save-selection, unsubscribe, consent, lifecycle]

requires:
  - phase: 12-restore-multi-team-selection/12-02
    provides: user_teams join table, save-selection multi-slug transaction, updateTimezone statement

provides:
  - updateTimezoneActive scoped prepared statement (confirmed_at IS NOT NULL AND unsubscribed_at IS NULL predicate)
  - CR-01: save-selection transaction state-gated — unsubscribed/unconfirmed users rejected with zero user_teams writes, redirected to /manage?status=unknown
  - CR-01 UI: 'unknown' STATUS_COPY entry restored in manage.astro
  - CR-02: unsubscribe.ts clears user_teams so re-confirmation cannot silently re-activate stale subscriptions

affects: [12-restore-multi-team-selection/12-06, 11-end-to-end-launch-gate]

tech-stack:
  added: []
  patterns:
    - "updateTimezoneActive as a scoped variant of updateTimezone with SQL-level state predicate — throw inside db.transaction on res.changes === 0 for transactional rollback of all user_teams writes"
    - "Discriminated catch arm in save-selection.ts: err.message === 'not-active' maps to 'unknown' status, all other errors map to 'server'"
    - "deleteUserTeams.run unconditionally on verified-token unsubscribe path — idempotent (zero-row DELETE is a no-op)"

key-files:
  created: []
  modified:
    - src/lib/db.ts
    - src/pages/api/save-selection.ts
    - src/pages/manage.astro
    - src/pages/api/unsubscribe.ts

key-decisions:
  - "updateTimezoneActive placed first inside the existing db.transaction callback — ensures an inactive user throws BEFORE deleteUserTeams.run or insertUserTeam.run, so better-sqlite3 rolls back zero user_teams writes on the inactive path"
  - "deleteUserTeams.run called unconditionally in unsubscribe.ts (not conditionally on `updated` truthy) — idempotent on already-unsubscribed and no-such-row branches; ensures every verified-token unsubscribe is authoritative over user_teams regardless of prior state"
  - "updateTimezone (stateless) left as exported — not removed; updateTimezoneActive is purely additive"
  - "STATUS_COPY 'unknown' entry copy uses 'not an active subscription' framing matching Phase-9 intent without LAND-02 prohibited terms"

patterns-established:
  - "SQL-level state gate pattern: use a scoped prepared statement with WHERE predicate instead of application-level SELECT; check res.changes === 0 to throw inside the transaction for automatic rollback"

requirements-completed: [IDENT-02, IDENT-03, IDENT-04, NOTIFY-04, SIGNUP-04, LAND-02]

duration: 18min
completed: 2026-05-16
---

# Phase 12 Plan 05: Gap-Closure CR-01 and CR-02 — Consent/Privacy Regressions Summary

**SQL-level state gate restores unsubscribed/unconfirmed write protection in save-selection, plus deleteUserTeams on unsubscribe prevents silent re-subscription via re-confirmation**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-05-16T12:10:00Z
- **Completed:** 2026-05-16T12:28:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- CR-01 closed: `updateTimezoneActive` (scoped statement with `confirmed_at IS NOT NULL AND unsubscribed_at IS NULL`) runs first inside the existing `db.transaction`; `res.changes === 0` throws `'not-active'` which rolls back all `user_teams` writes; discriminated catch arm maps the throw to `redirectTo(formToken, 'unknown')` while real DB faults still map to `'server'`
- CR-01 UI closed: restored `'unknown': { kind: 'err', text: '...' }` entry to `STATUS_COPY` in `manage.astro` so the `status=unknown` 303 renders a visible not-active message
- CR-02 closed: `deleteUserTeams.run(result.email)` added unconditionally after `markUnsubscribed.get` on the verified-token path in `unsubscribe.ts` — after unsubscribe + re-confirmation, the cron's `user_teams` JOIN returns no rows until the user re-picks teams on `/manage`

## Task Commits

Each task was committed atomically:

1. **Task 1: CR-01 — state-gate save-selection transaction** - `b36825c` (fix)
2. **Task 2: CR-01 UI — restore 'unknown' STATUS_COPY** - `287ebbe` (fix)
3. **Task 3: CR-02 — clear user_teams on unsubscribe** - `b3482b2` (fix)

## Files Created/Modified

- `src/lib/db.ts` — added `updateTimezoneActive` (exported, adjacent to `updateTimezone`); `updateTimezone` and `setSelection` unchanged
- `src/pages/api/save-selection.ts` — imports `updateTimezoneActive`; replaces `updateTimezone.run` with `updateTimezoneActive.run` as first statement in `db.transaction`; adds `res.changes === 0` throw and discriminated catch arm for `'unknown'`
- `src/pages/manage.astro` — restored `'unknown'` entry in `STATUS_COPY` (one line added)
- `src/pages/api/unsubscribe.ts` — imports `deleteUserTeams`; calls `deleteUserTeams.run(result.email)` after `markUnsubscribed.get` on verified-token path

## Decisions Made

- `updateTimezoneActive` placed as first statement inside the existing `db.transaction` callback (before `deleteUserTeams.run` / `insertUserTeam` loop) so the state gate fires before any join-table mutation — better-sqlite3 rollback then guarantees zero `user_teams` writes for inactive users
- `deleteUserTeams.run` called unconditionally in `unsubscribe.ts` (not gated on `updated` being truthy) — DELETE on zero rows is a no-op, making the call idempotent on all branches that pass the verified-token guard
- Removed `updateTimezone` from the `save-selection.ts` import after it was no longer used in the transaction (it was replaced by `updateTimezoneActive`); kept exported from `db.ts` for any future callers

## Deviations from Plan

**1. [Rule 1 - Bug] Removed `updateTimezone` from save-selection.ts import**
- **Found during:** Task 1 (after replacing `updateTimezone.run` with `updateTimezoneActive.run`)
- **Issue:** `updateTimezone` became an unused import causing a TS warning (`ts(6133)`) that triggered additional type-checking and surfaced 19 pre-existing `@types/node` environment errors in `astro check`
- **Fix:** Removed `updateTimezone` from the import line in `save-selection.ts`; `updateTimezone` remains exported from `db.ts` (not removed)
- **Files modified:** `src/pages/api/save-selection.ts` (import line only)
- **Verification:** `npx astro check` returned 0 errors, 0 warnings after removal
- **Committed in:** `b36825c` (part of Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — unused import causing warning + environment noise)
**Impact on plan:** No scope change. The plan spec said "keep updateTimezone imported too if still referenced elsewhere" — since we replaced the call with `updateTimezoneActive`, keeping it imported would have been incorrect. The removal is the correct outcome of the plan's own instruction.

## Issues Encountered

- `npx astro check` shows 19 pre-existing errors (`@types/node` / `better-sqlite3` declaration files missing) when an unused import triggered broader type resolution. These errors exist in the baseline (pre-plan) and are not caused by this plan's changes. Removing the unused `updateTimezone` import brought `astro check` back to 0 errors, 0 warnings (matching baseline).

## Scope Fence Verification

- `src/pages/index.astro` — NOT modified (D-03 fence intact)
- `src/pages/api/signup.ts` — NOT modified (D-03 fence intact)
- Zero `CREATE`, `ALTER`, `DROP`, `pragma_table_info` added — no schema/migration change (D-01/D-02 fence intact)
- `updateTimezoneActive` body verbatim: `UPDATE vip_signups SET timezone = ? WHERE email = ? AND confirmed_at IS NOT NULL AND unsubscribed_at IS NULL`
- No new error codes introduced — `'unknown'` was a pre-existing code (Phase-9 `setSelection` emitted it)

## Known Stubs

None — all changes are behavioral (state gate and lifecycle cleanup). No placeholder data flows to UI rendering.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The changes close existing trust-boundary gaps identified in T-12-09 and T-12-10 of the plan threat register.

## Next Phase Readiness

- CR-01 and CR-02 are closed; behavioral proof (negative-path smoke cases) is delivered by 12-06 (depends on this plan)
- Phase 12 re-verification can proceed after 12-06 ships the unsubscribed-POST rejection + unsubscribe→reconfirm→cron-excludes smoke cases

## Self-Check

**Files exist:**
- `src/lib/db.ts` — contains `updateTimezoneActive` with `confirmed_at IS NOT NULL AND unsubscribed_at IS NULL` predicate
- `src/pages/api/save-selection.ts` — contains `updateTimezoneActive`, `res.changes === 0`, `'not-active'`, `redirectTo(formToken, 'unknown')`
- `src/pages/manage.astro` — contains `'unknown':` entry in STATUS_COPY
- `src/pages/api/unsubscribe.ts` — contains `deleteUserTeams` and `deleteUserTeams.run(result.email)`

**Commits exist:** b36825c, 287ebbe, b3482b2

## Self-Check: PASSED

---
*Phase: 12-restore-multi-team-selection*
*Completed: 2026-05-16*
