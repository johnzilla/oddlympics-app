---
phase: 12-restore-multi-team-selection
plan: "03"
subsystem: notifications/cron
tags: [sqlite, kickoff-cron, user_teams, multi-team, notify-04, d-06]

# Dependency graph
requires:
  - phase: 12-restore-multi-team-selection
    plan: "01"
    provides: "user_teams join table (email, team_slug, UNIQUE) + idx_user_teams_email"
provides:
  - "Kickoff cron usersQuery rewritten to join vip_signups -> user_teams -> teams.slug (D-06)"
  - "Defensive DDL in cron self-creates user_teams (cron self-contained against fresh DB)"
  - "Multi-team fan-out proven via dry-run: 2 user_teams rows -> exactly 1 email (NOTIFY-04)"
affects:
  - 12-04-smoke-verify

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "JOIN user_teams ut ON ut.email = v.email JOIN teams t ON t.slug = ut.team_slug (D-06 subscription join)"
    - "SELECT DISTINCT v.email collapses multi-team fan-out before claim-before-send (belt-and-suspenders on top of UNIQUE constraint)"
    - "Defensive DDL block extended with user_teams DDL mirrored from src/lib/db.ts"

key-files:
  created: []
  modified:
    - scripts/send-kickoff-notifications.mjs

key-decisions:
  - "NOTIFY-04 inherited free from match_notifications UNIQUE(user_email, match_id, channel) + claim-before-send INSERT OR IGNORE; no team-keyed dedupe added (D-06 explicit)"
  - "v.team IS NOT NULL dropped — user_teams rows are now the authoritative subscription source; vip_signups.team is legacy-harmless"
  - "Defensive DDL extended (not replaced) to also self-create user_teams, making the cron safe against a fresh DB not yet booted through the web server"
  - "Task 2 verification ran with KICKOFF_NOTIFICATIONS_ENABLED unset (dry-run default) — safety pattern honored, no real email sent"

requirements-completed: [IDENT-02, IDENT-03, IDENT-04, NOTIFY-04]

# Metrics
duration: 110s
completed: 2026-05-16
---

# Phase 12 Plan 03: Kickoff Cron Join Swap Summary

**Kickoff cron usersQuery rewritten from vip_signups.team = teams.slug to vip_signups -> user_teams -> teams.slug (D-06), with defensive user_teams DDL added; dry-run confirms multi-team user gets exactly one would-send**

## Performance

- **Duration:** ~1m 50s
- **Started:** 2026-05-16T11:04:50Z
- **Completed:** 2026-05-16T11:06:40Z
- **Tasks:** 2 (1 code change + 1 verification-only dry-run)
- **Files modified:** 1

## Accomplishments

- Rewrote `usersQuery` prepared statement in `scripts/send-kickoff-notifications.mjs` from the old `JOIN teams t ON v.team = t.slug` form to the D-06 form: `JOIN user_teams ut ON ut.email = v.email JOIN teams t ON t.slug = ut.team_slug`
- Dropped `AND v.team IS NOT NULL` clause — `user_teams` rows are now the subscription source; `vip_signups.team` is a legacy-harmless denormalized hint
- Preserved `SELECT DISTINCT v.email`, `confirmed_at IS NOT NULL AND unsubscribed_at IS NULL` filter, `NOT EXISTS match_notifications` guard, and three-param argv shape `(home_id, away_id, match.id)` — call site line 180 unchanged
- Extended defensive DDL block to also `CREATE TABLE IF NOT EXISTS user_teams` (+ index), mirroring `src/lib/db.ts` byte-for-byte — cron is now self-contained against a fresh DB
- Added why-comment above `usersQuery` explaining the D-06 join, SELECT DISTINCT collapse rationale, NOTIFY-04 inheritance, and no-new-dedupe decision
- Verified (Task 2): seeded scratch DB with one confirmed user following both teams in an upcoming match → cron dry-run outputs exactly `1 subscriber(s)` and `dry-run=1` (NOTIFY-04 + D-06 fan-out proof); no real email sent

## Task Commits

1. **Task 1: Rewrite usersQuery to join through user_teams + extend defensive DDL** — `3272a69` (feat)
2. **Task 2: Dry-run cron against seeded scratch DB** — verification only, no commit (plan specifies no deliverable)

## Files Created/Modified

- `scripts/send-kickoff-notifications.mjs` — replaced `usersQuery` prepared statement (D-06 join), updated why-comment, extended defensive DDL block with `user_teams` DDL

## Decisions Made

- **NOTIFY-04 inherited, not re-implemented**: `match_notifications UNIQUE(user_email, match_id, channel)` + `INSERT OR IGNORE` claim-before-send already guarantees exactly one email per match per user regardless of how many teams they follow. `SELECT DISTINCT v.email` is belt-and-suspenders but not the primary guarantee. No team-keyed dedupe added per D-06 explicit instruction.
- **v.team IS NOT NULL dropped**: With `user_teams` as the subscription source, `vip_signups.team` is no longer used by the cron. A user with no `user_teams` rows simply produces zero rows from the JOIN — correct behavior, no filter needed.
- **Defensive DDL extended, not replaced**: The existing `match_notifications` DDL block was extended in-place. Replacing it would have been needlessly risky; appending `user_teams` DDL to the same `db.exec()` call is the minimal surgical change.

## Deviations from Plan

None — plan executed exactly as written.

## Task 2 Dry-Run Evidence (D-06 + NOTIFY-04 proof)

Scratch DB: one confirmed user (`cron-smoke@example.com`, `Europe/London`) following two teams (`aaateam`, `bbbteam`) both appearing in match 99001 (kickoff in 60 min window).

```
[notify] mode=dry-run matches-in-window=1
  match 99001 AAA vs BBB: 1 subscriber(s)
    (dry-run) cron-smoke@example.com
[notify] done. sent=0 errors=0 dry-run=1
```

- `1 subscriber(s)` — two `user_teams` rows collapsed to one email by `SELECT DISTINCT v.email` (D-06 fan-out + NOTIFY-04 proof)
- `(dry-run) cron-smoke@example.com` — resolved via `user_teams` join, not `vip_signups.team`
- `dry-run=1` — exactly one would-send, not two
- No real email sent (ENABLED unset; dry-run-by-default safety pattern honored)
- Temp DB and output file cleaned after verification

## Exact New usersQuery SQL

```sql
SELECT DISTINCT v.email AS email, v.timezone AS timezone
FROM vip_signups v
JOIN user_teams ut ON ut.email = v.email
JOIN teams t ON t.slug = ut.team_slug
WHERE v.confirmed_at IS NOT NULL
  AND v.unsubscribed_at IS NULL
  AND t.id IN (?, ?)
  AND NOT EXISTS (
    SELECT 1 FROM match_notifications n
    WHERE n.user_email = v.email
      AND n.match_id = ?
      AND n.channel = 'email'
  )
```

Call site (unchanged): `usersQuery.all(match.home_id, match.away_id, match.id)`

## Threat Coverage

All STRIDE threats from plan covered:
- **T-12-09 (SQLi)**: Query remains a static prepared statement; only integer `home_id`, `away_id`, `match_id` bound positionally. No string interpolation.
- **T-12-10 (Info Disclosure)**: `user_teams` is the subscription source; removed teams have no row, excluded by the JOIN. Confirmed/unsubscribed filter preserved.
- **T-12-11 (Duplicate sends)**: `match_notifications UNIQUE` + `INSERT OR IGNORE` + `SELECT DISTINCT v.email`. Belt-and-suspenders; UNIQUE is the primary guarantee.
- **T-12-12 (Accidental mass send)**: Task 2 ran with `KICKOFF_NOTIFICATIONS_ENABLED` unset (dry-run). Safety pattern preserved verbatim.

## Self-Check

- [x] `scripts/send-kickoff-notifications.mjs` modified
- [x] Commit `3272a69` exists
- [x] `grep -c 'JOIN user_teams' scripts/send-kickoff-notifications.mjs` == 1
- [x] `grep -c 'JOIN teams t ON t.slug = ut.team_slug' scripts/send-kickoff-notifications.mjs` == 1
- [x] `grep -c 'CREATE TABLE IF NOT EXISTS user_teams' scripts/send-kickoff-notifications.mjs` == 1
- [x] `grep -c 'SELECT DISTINCT v.email' scripts/send-kickoff-notifications.mjs` == 1
- [x] `grep -c 'v.team IS NOT NULL' scripts/send-kickoff-notifications.mjs` == 0
- [x] `grep -c 'usersQuery.all(match.home_id, match.away_id, match.id)' scripts/send-kickoff-notifications.mjs` == 1
- [x] `node --check scripts/send-kickoff-notifications.mjs` exits 0
- [x] Task 2 dry-run: `1 subscriber(s)` + `(dry-run) cron-smoke@example.com` + `dry-run=1` confirmed
- [x] Production DB (`./data/oddlympics.db`) not touched
- [x] `KICKOFF_NOTIFICATIONS_ENABLED` never set during verification

---
*Phase: 12-restore-multi-team-selection*
*Completed: 2026-05-16*
