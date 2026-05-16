---
phase: 12-restore-multi-team-selection
plan: "01"
subsystem: database
tags: [sqlite, better-sqlite3, schema-migration, prepared-statements]

# Dependency graph
requires:
  - phase: 05-schema-signup-payload
    provides: "user_teams-adjacent vip_signups.team slug + additive CREATE TABLE IF NOT EXISTS pattern"
  - phase: 09-manage-editor-unsubscribe
    provides: "setSelection prepared statement pattern; save-selection transaction scaffold"
provides:
  - "user_teams join table (email, team_slug, UNIQUE) created additively in src/lib/db.ts"
  - "deleteUserTeams, insertUserTeam, getUserTeams prepared statements with typed generics"
  - "updateTimezone module-level prepared statement for 12-02 in-transaction use"
  - "UserTeam type export"
affects:
  - 12-02-manage-editor-save-selection
  - 12-03-kickoff-cron-join-swap
  - 12-04-smoke-verify

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Purely additive CREATE TABLE IF NOT EXISTS with no probe/ALTER/DROP (D-02 waives legacy-safety ceremony)"
    - "Module-level prepared statements exported for transaction composition by downstream plans"

key-files:
  created: []
  modified:
    - src/lib/db.ts

key-decisions:
  - "vip_signups.team left as-is (no seed into user_teams, no drop) per D-02 — simplest correct option, zero migration risk, signup path (D-03) continues writing vip_signups.team untouched"
  - "updateTimezone exported module-level (not inline per-request) so 12-02 can use it inside db.transaction() for atomic team+tz commit"

patterns-established:
  - "Additive join table pattern: CREATE TABLE IF NOT EXISTS + UNIQUE constraint + index in a single db.exec block, appended after feature_requests block at EOF of db.ts"
  - "Module-level export of updateTimezone for downstream transaction composition without duplicate prepare()"

requirements-completed: [IDENT-02, IDENT-03, IDENT-04]

# Metrics
duration: 3min
completed: 2026-05-16
---

# Phase 12 Plan 01: Schema Foundation Summary

**user_teams join table (additive CREATE TABLE IF NOT EXISTS), three typed prepared statements, module-level updateTimezone, and UserTeam type added to src/lib/db.ts as the Wave-1 contract for multi-team subscriptions**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-16T10:50:30Z
- **Completed:** 2026-05-16T10:52:51Z
- **Tasks:** 2 (1 code change + 1 verification-only)
- **Files modified:** 1

## Accomplishments

- Added `user_teams (id, email, team_slug, UNIQUE(email, team_slug))` join table to `src/lib/db.ts` via `CREATE TABLE IF NOT EXISTS` — purely additive, no probe, no ALTER, no DROP, no legacy ceremony (D-02)
- Added `CREATE INDEX IF NOT EXISTS idx_user_teams_email` for efficient email-keyed reads by `/manage` and the cron
- Exported `UserTeam` type, `deleteUserTeams`, `insertUserTeam`, `getUserTeams` prepared statements with typed generics matching project idiom
- Exported module-level `updateTimezone` prepared statement so 12-02 can compose it inside `db.transaction()` for atomic team picks + timezone commit
- Boot-verified: table materializes on first boot, second boot against same DB is a no-op (`CREATE TABLE IF NOT EXISTS` idempotency confirmed)

## Task Commits

1. **Task 1: Add user_teams DDL + prepared statements + updateTimezone + UserTeam type** - `0443f60` (feat)
2. **Task 2: Boot-verify table materializes and re-boot is a no-op** - verification only, no commit (plan specifies no deliverable)

## Files Created/Modified

- `src/lib/db.ts` — appended `user_teams` `db.exec` DDL block, `UserTeam` type, `deleteUserTeams`/`insertUserTeam`/`getUserTeams`/`updateTimezone` prepared statement exports

## Decisions Made

- **vip_signups.team left as-is**: no seed into `user_teams`, no drop — harmless, zero migration risk, and the signup path (D-03) continues writing `vip_signups.team` as before. `user_teams` is the authoritative multi-team source post-signup.
- **updateTimezone exported module-level**: CLAUDE.md mandates all prepared statements be module-level constants from `src/lib/db.ts`. 12-02 must import it rather than inline a per-request `db.prepare`, ensuring the team picks and timezone write are atomic within the same `db.transaction()`.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- Task 2 verification initially hit the `/` prerendered static page, which does not trigger db.ts module load (lazy-imported only by API routes). Resolved by curling a server-rendered API route (`/api/signup`) to force db module initialization before inspecting the schema. No code change needed — this is expected Astro hybrid static+server behavior documented in CLAUDE.md.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Wave-1 schema contract is complete. 12-02 (manage editor + save-selection writer) and 12-03 (cron join swap) can proceed in Wave 2.
- Imports for 12-02: `import { deleteUserTeams, insertUserTeam, getUserTeams, updateTimezone, db } from '../../lib/db'`
- Param order for `updateTimezone`: `(timezone, email)` — positional `?` placeholders, must be passed in that order.
- `deleteUserTeams.run(email)` + `insertUserTeam.run(email, slug)` are the delete-all-then-insert contract (D-01).

## Self-Check

- [x] `src/lib/db.ts` modified (35 lines added)
- [x] Commit `0443f60` exists
- [x] `grep -c 'CREATE TABLE IF NOT EXISTS user_teams' src/lib/db.ts` == 1
- [x] `grep -c 'UNIQUE(email, team_slug)' src/lib/db.ts` == 1
- [x] `grep -c 'export const updateTimezone = db.prepare' src/lib/db.ts` == 1
- [x] `grep -c 'export type UserTeam' src/lib/db.ts` == 1
- [x] No ALTER/DROP/backup ceremony on user_teams
- [x] astro check: 19 errors before and after — no new type errors introduced
- [x] Boot idempotency verified against scratch DB (temp DB removed)

---
*Phase: 12-restore-multi-team-selection*
*Completed: 2026-05-16*
