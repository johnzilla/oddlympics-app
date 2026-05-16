---
phase: 12-restore-multi-team-selection
plan: 06
subsystem: smoke
tags: [smoke, consent, unsubscribe, user_teams, cr-01, cr-02, wr-04]

requires:
  - phase: 12-restore-multi-team-selection/12-05
    provides: CR-01 state-gate (updateTimezoneActive + not-active throw), CR-02 deleteUserTeams on unsubscribe
  - phase: 12-restore-multi-team-selection/12-04
    provides: M10–M14 harness + helpers (dbInsertUserTeams, dbUserTeamSlugs, postMultiTeam)

provides:
  - WR-04 closed: M15 (unsubscribed-POST → status=unknown + zero writes + tz preserved) and M16 (real /api/unsubscribe clears user_teams → reconfirm → cron JOIN zero rows) added to scripts/smoke-manage.mjs
  - Goal-backward behavioral proof that FAILED truth #10 from 12-VERIFICATION.md is now satisfied
  - Full M1–M16 suite green (pass=17 fail=0, exit 0) against the 12-05-fixed built server on a scratch DB

affects: [12-restore-multi-team-selection/12-VERIFICATION, 11-end-to-end-launch-gate]

tech-stack:
  added: []
  patterns:
    - "M15: seed CONFIRMED-but-UNSUBSCRIBED row via dbInsertSmokeRow(unsubscribedAt:) + pre-seed user_teams + POST different slugs via postMultiTeam → assert status=unknown + UNCHANGED user_teams + UNCHANGED tz"
    - "M16: seed active row → real GET /api/unsubscribe route → assert user_teams empty (CR-02 fix) → dbMarkConfirmed → assert usersQuery-equivalent JOIN yields zero rows (no stale fan-out)"

key-files:
  created: []
  modified:
    - scripts/smoke-manage.mjs

key-decisions:
  - "M16 seeded teams use ids 9900003/9900004 in the existing id>=9900000 smoke namespace (no new cleanup category — footer DELETE FROM user_teams WHERE email LIKE 'smoke-%@example.com' and the teams rows are intentionally not cleaned up since they are namespace-isolated)"
  - "M16 usersQuery-equivalent JOIN omits the t.id IN (...) clause — empty user_teams short-circuits to zero rows regardless, simplifying the assertion while still proving the cron excludes the user"
  - "Server DB initialization requires at least one DB-touching request before the smoke opens the file in readonly mode — the run recipe triggers a /manage GET before the smoke client opens the DB"

requirements-completed: [IDENT-02, IDENT-03, IDENT-04, NOTIFY-04, SIGNUP-04, LAND-02]

duration: 4min
completed: 2026-05-16
---

# Phase 12 Plan 06: WR-04 Gap-Closure — M15/M16 Negative-Path Smoke Cases Summary

**Behavioral proof that CR-01 and CR-02 fixes are enforced end-to-end: M15 (unsubscribed-POST rejected, zero writes, tz preserved) and M16 (unsubscribe clears user_teams → reconfirm → cron yields zero rows) added to scripts/smoke-manage.mjs; full M1–M16 suite green**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-16T12:11:40Z
- **Completed:** 2026-05-16T12:15:40Z
- **Tasks:** 2
- **Files modified:** 1 (scripts/smoke-manage.mjs)

## Accomplishments

- **Task 1:** M15-unsub-save-rejected and M16-unsub-reconfirm-no-stale appended after M14-cron-visibility in scripts/smoke-manage.mjs. Header evidence-tag block updated. M1–M14 intact. No new deps.
- **Task 2:** Full M1–M16 smoke ran green against the freshly built 12-05-fixed server on a scratch DB. Result: **pass=17 fail=0, exit 0**. Scratch DB confirmed not the production DB (production `/data/oddlympics.db` last modified May 15 — untouched). No real email sent.

## Gap-Closure Goal-Backward Evidence (WR-04)

**Smoke output (full M1–M16 pass):**

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
[smoke] result: pass=17 fail=0
```

**Exit code: 0**

## M15 and M16 Case Bodies (Assertion Lists)

### M15-unsub-save-rejected (CR-01 behavioral proof)

1. Seeds CONFIRMED-but-UNSUBSCRIBED row (`unsubscribedAt: Math.floor(Date.now()/1000)`) with team `argentina`, tz `America/New_York`
2. Pre-seeds `user_teams` with `['argentina', 'brazil']` (2 rows) and captures seeded tz
3. Mints a still-valid 30-day session token
4. POSTs `['england', 'france', 'germany']` + tz `Europe/London` via `postMultiTeam`
5. Asserts ALL THREE CR-01 facts:
   - **303 with `status=unknown`** in Location — state-gate fires, not saved
   - **`dbUserTeamSlugs(email)` deep-equals `['argentina', 'brazil']`** — UNCHANGED: england/france/germany were NOT inserted, originals NOT deleted (transaction rolled back before `deleteUserTeams.run`)
   - **`dbRowFor(email).timezone === 'America/New_York'`** — NOT overwritten to `Europe/London` (gated `updateTimezoneActive.run` matched 0 rows)

### M16-unsub-reconfirm-no-stale (CR-02 behavioral proof)

1. Seeds CONFIRMED, ACTIVE row with team `argentina`, tz `Europe/London`
2. Seeds smoke teams `smoke-team-gamma`/`smoke-team-delta` (ids 9900003/9900004, INSERT OR IGNORE) and follows both via `dbInsertUserTeams`; asserts pre-state length === 2
3. Mints 1-year unsubscribe token; calls real `GET /api/unsubscribe?token=...` route; asserts 303 `/unsubscribed?status=ok`; asserts `dbUserTeamSlugs(email).length === 0` — CR-02 fix (`deleteUserTeams.run` inside the route) cleared the join rows
4. Calls `dbMarkConfirmed(email)` (D-07 RETURNING * shape); asserts `unsubscribed_at` is NULL and `confirmed_at` is set — cron re-activation predicate satisfied
5. Runs usersQuery-equivalent JOIN (`SELECT DISTINCT v.email FROM vip_signups v JOIN user_teams ut ON ut.email=v.email JOIN teams t ON t.slug=ut.team_slug WHERE v.confirmed_at IS NOT NULL AND v.unsubscribed_at IS NULL`); filters to this email; asserts count === 0 — re-confirmed user has NO followed teams, cron produces zero stale fan-out

## CR-01 and CR-02 Closure Confirmed

| Regression | Proof | Result |
|-----------|-------|--------|
| CR-01: unsubscribed user could write user_teams + overwrite tz via valid session | M15 asserts 303 status=unknown + unchanged user_teams + preserved tz | CLOSED |
| CR-02: unsubscribe didn't clear user_teams → reconfirm silently re-activated stale subscriptions | M16 asserts user_teams empty post-unsubscribe → reconfirm → cron JOIN zero rows | CLOSED |

**FAILED truth #10 from 12-VERIFICATION.md is now satisfied behaviorally.**

## Task Commits

1. **Task 1: Add M15/M16 to smoke-manage.mjs** - `274fd8f` (feat)
2. **Task 2: Smoke run verification** — no separate commit (verification run only)

## Files Created/Modified

- `scripts/smoke-manage.mjs` — M15-unsub-save-rejected + M16-unsub-reconfirm-no-stale appended after M14; header evidence-tag block updated; M1–M14 intact; no new imports

## Decisions Made

- M16 smoke teams use ids 9900003/9900004 (ids 9900001/9900002 used by M14) — same namespace, no new cleanup category needed
- M16 usersQuery-equivalent omits the `t.id IN (...)` clause — empty user_teams short-circuits to zero rows regardless; the simpler form still proves the cron excludes the user
- Server DB initialization: the built server creates the SQLite file lazily on first DB-touching request; the run recipe must trigger at least one such request (e.g., `GET /manage`) before the smoke opens the DB in readonly mode

## Deviations from Plan

**1. [Rule 1 - Bug] Server DB lazy initialization — smoke DB must be created before readonly open**
- **Found during:** Task 2 (verification run)
- **Issue:** The built server doesn't create the SQLite file until the first DB-touching HTTP request. The smoke client opens the DB in readonly mode at startup and exits 2 if the file doesn't exist. Running the smoke immediately after booting the server (before any request) causes exit 2.
- **Fix:** Triggered a `GET /manage` request to the server before running the smoke, forcing DB file creation. This is consistent with the 12-04 Task 3 recipe which curl-waited for `/` (the static home page doesn't touch the DB) and then ran the smoke — M10–M14 worked because by the time those cases ran, earlier cases (M3, etc.) had already caused DB init. M15/M16 were the first DB cases if run standalone.
- **Files modified:** None — the fix is in the run recipe (documented above), not in code.
- **Impact:** Zero impact on plan output; smoke ran 17/17 PASS.

---

**Total deviations:** 1 auto-noted (informational; run-recipe documentation only)

## Scope Fence Verification

- `src/pages/index.astro` — NOT modified (D-03 fence intact)
- `src/pages/api/signup.ts` — NOT modified (D-03 fence intact)
- `files_modified` = ONLY `scripts/smoke-manage.mjs`
- No new imports, no new npm deps
- Production `./data/oddlympics.db` untouched (last modified May 15 09:09:36, pre-run)
- No real email sent (no cron enabled, no outbound path exercised)

## Known Stubs

None — both new cases exercise real routes and real DB state. No placeholder data.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes. The smoke exercises existing routes (`/api/save-selection`, `/api/unsubscribe`) over localhost HTTP with HMAC tokens matching the server's dev secret. T-12-16 (scratch DB isolation), T-12-17 (dev secret), T-12-18 (no real email), T-12-19 (regression detector — new cases fail against pre-12-05 code) all confirmed mitigated.

## Self-Check

**Files exist:**
- `scripts/smoke-manage.mjs` — contains `M15-unsub-save-rejected`, `M16-unsub-reconfirm-no-stale`, `status=unknown` assertion, `user_teams UNCHANGED`, `timezone UNCHANGED`, `afterUnsubSlugs.length !== 0`, `dbMarkConfirmed`, updated header block

**Commits exist:** 274fd8f

## Self-Check: PASSED

---
*Phase: 12-restore-multi-team-selection*
*Completed: 2026-05-16*
