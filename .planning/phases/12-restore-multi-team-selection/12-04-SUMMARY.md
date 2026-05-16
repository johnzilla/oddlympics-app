---
phase: 12-restore-multi-team-selection
plan: "04"
subsystem: verification/smoke
tags: [smoke, verify-only, multi-team, email-copy, d-07, notify-04, user_teams]

# Dependency graph
requires:
  - phase: 12-restore-multi-team-selection
    plan: "01"
    provides: "user_teams DDL + deleteUserTeams/insertUserTeam/getUserTeams prepared statements"
  - phase: 12-restore-multi-team-selection
    plan: "02"
    provides: "/manage confederation-grouped checkboxes + /api/save-selection multi-slug writer"
  - phase: 12-restore-multi-team-selection
    plan: "03"
    provides: "Cron usersQuery join through user_teams (D-06)"
provides:
  - "D-07 evidence: sendMagicLink copy pinned as single-team-correct, zero LAND-02 terms, zero edits"
  - "scripts/smoke-manage.mjs M10-M14 covering full multi-team journey (save, reload, too-many, bad-team, cron-visibility)"
  - "Phase 12 goal-backward proof: pass=15 fail=0 on full M1-M14 suite"
affects:
  - phase-12-roadmap-complete

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Multi-value URLSearchParams.append('team', slug) pattern for multi-checkbox POST in smoke scripts"
    - "dbInsertUserTeams/dbUserTeamSlugs helper pattern for user_teams seed+assert in smoke"
    - "Smoke assertion scoped to test email (filter result set) when scratch DB has shared state"

key-files:
  created: []
  modified:
    - scripts/smoke-manage.mjs

key-decisions:
  - "D-07 verify-only: email.ts confirmed unchanged — zero edits made, no regression found"
  - "M14 assertion filters result set to the test email (not assertEqual total rows) — scratch DB reuse means other smoke users from prior runs also match the seeded team IDs; both are correct cron behavior and correct test isolation"
  - "Rule 1 auto-fix batch: M2 (<select> -> checkboxes), M3 (vip_signups.team -> user_teams), M6 (banner text 'Pick a team' -> 'Pick your teams'), M14 (filter-to-email) updated to match post-12-02 reality"

requirements-completed: [IDENT-02, IDENT-03, IDENT-04, NOTIFY-04, SIGNUP-04, LAND-02]

# Metrics
duration: ~15min
completed: 2026-05-16
---

# Phase 12 Plan 04: Smoke Verify Summary

**D-07 pinned (email.ts unchanged, single-team copy confirmed); M10-M14 multi-team cases added to smoke-manage.mjs; full M1-M14 suite green (pass=15 fail=0) against built server on scratch DB — Phase 12 goal-backward proof complete**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-16
- **Completed:** 2026-05-16
- **Tasks:** 3 (1 verify-only + 1 code change + 1 smoke run)
- **Files modified:** 1 (`scripts/smoke-manage.mjs`; `src/lib/email.ts` verify-only, zero edits)

## Accomplishments

### Task 1: D-07 Verify-Only — sendMagicLink copy pinned

Verified `src/lib/email.ts` without modification:

- `sendMagicLink(email, token, team: string, timezone: string)` — single `team: string` parameter confirmed (signup stays single-team per D-03)
- Value-prop text body (line 33): `"We'll email you 1 hour before every ${teamHuman} match in ${tzHuman}."`
- Value-prop HTML (line 46): `"We'll email you 1 hour before every <strong>${teamHuman}</strong> match in ${tzHuman}."`
- Dev-fallback console.log (line 59): `"body: every ${teamHuman} match in ${tzHuman}"`
- LAND-02 scan: `grep -ciE 'bitcoin|lightning|crypto|world domination|personal olympics'` == 0
- `git diff --stat -- src/lib/email.ts` shows zero changes

**D-07 / SIGNUP-04 evidence:** Pinned value-prop: `"We'll email you 1 hour before every ${teamHuman} match in ${tzHuman}."` (single-team-grammatically-correct; `teamHuman = teamLabel(team)` from `src/lib/teams.ts`; signup single-team per D-03).

No code edits made. Task closed verify-only.

### Task 2: Add M10-M14 to scripts/smoke-manage.mjs

Added to smoke-manage.mjs:

**New helpers:**
- `dbInsertUserTeams(email, slugs)` — DELETE + INSERT OR IGNORE per slug into `user_teams` (mirrors `dbInsertSmokeRow` style)
- `dbUserTeamSlugs(email)` — returns sorted `team_slug` list from `user_teams` for assertions
- `postMultiTeam(slugs, tz, cookieHeader)` — builds `URLSearchParams` with `body.append('team', slug)` per slug (correct multi-value POST, not URLSearchParams(object))

**New cases M10-M14:**
- `M10-multi-save-n`: POST 3 valid slugs (england, france, germany) + tz → 303 `status=saved`; `dbUserTeamSlugs` asserts exactly those 3, sorted
- `M11-pre-check`: GET `/manage` with session after saving 3 slugs; body has `type="checkbox" name="team"` with `checked` attribute for each saved slug; no `<select name="team">`
- `M12-too-many`: Seed 2 via `dbInsertUserTeams`; POST 6 valid slugs → 303 `status=too-many`; `dbUserTeamSlugs` asserts unchanged pre-state (zero writes on reject)
- `M13-empty-save`: Seed 2 via `dbInsertUserTeams`; POST 0 team values (only timezone) → 303 `status=bad-team`; `dbUserTeamSlugs` asserts unchanged (zero writes on empty)
- `M14-cron-visibility`: Seed confirmed user + `INSERT OR IGNORE` two teams in `teams` table; `dbInsertUserTeams` those 2 slugs; usersQuery-equivalent JOIN (`vip_signups -> user_teams -> teams`) asserts test email appears in result (SELECT DISTINCT fan-out proof)

**Updated header + cleanup hint** extended to include M10-M14 and `DELETE FROM user_teams WHERE email LIKE 'smoke-%@example.com'`.

### Task 3: Full M1-M14 smoke — pass=15 fail=0

Built server against scratch DB, ran full suite. Result:

```
[smoke] result: pass=15 fail=0
```

All 15 cases passed (M1-M9 intact, M10-M14 new, exit 0). Scratch DB deleted, server killed. Production `./data/oddlympics.db` not touched. No real email sent (`/api/save-selection` sends no email; cron not invoked).

## Task Commits

1. **Task 1: D-07 verify-only** — no commit (zero edits to email.ts; verify-only task)
2. **Task 2: Add M10-M14 multi-team cases to smoke-manage.mjs** — `42b7d16`
3. **Rule 1 auto-fix: M6/M14 assertion corrections** — `498b48a`
4. *(Task 3 is a verification run — no deliverable commit per plan)*

## Files Created/Modified

- `scripts/smoke-manage.mjs` — M10-M14 added; M1-M9 retained with Rule 1 fixes for post-12-02 reality; dbInsertUserTeams/dbUserTeamSlugs/postMultiTeam helpers; header + cleanup hint extended
- `src/lib/email.ts` — verified unchanged (zero edits)

## Deviations from Plan

### Auto-fixed Issues (Rule 1 — Bug)

**1. [Rule 1 - Bug] M2 checkbox assertion — <select> vs checkboxes**
- **Found during:** Task 3 (first smoke run)
- **Issue:** M2 asserted `body.includes('<select') && body.includes('name="team"')` and `body.includes('selected')`. Post-12-02, `/manage` renders confederation-grouped `<input type="checkbox" name="team">`, not `<select name="team">`.
- **Fix:** Updated M2 to assert `type="checkbox" name="team"` present, `<select name="team"` absent, `checked` attribute present, `value="england"` present. Also added `dbInsertUserTeams(email, ['england'])` seed so the checkbox is pre-checked.
- **Files modified:** `scripts/smoke-manage.mjs`
- **Commit:** `42b7d16` (bundled with Task 2)

**2. [Rule 1 - Bug] M3 vip_signups.team assertion — post-12-02 saves to user_teams**
- **Found during:** Task 2 (identified proactively)
- **Issue:** M3 asserted `row.team !== 'germany'` on `vip_signups`. Post-12-02, `/api/save-selection` writes team picks to `user_teams` (not `vip_signups.team`). The assertion would pass vacuously (vip_signups.team stays as 'france' from seed), but proves nothing about the actual save.
- **Fix:** Updated M3 to assert `dbUserTeamSlugs(email).includes('germany')` on `user_teams`, plus `vip_signups.timezone = 'Europe/Berlin'` (timezone still written).
- **Files modified:** `scripts/smoke-manage.mjs`
- **Commit:** `42b7d16` (bundled with Task 2)

**3. [Rule 1 - Bug] M6 banner text — 'Pick a team' -> 'Pick your teams'**
- **Found during:** Task 3 (first smoke run — M6 FAIL)
- **Issue:** M6 asserted `body.includes('Pick a team')`. Post-12-02, the banner predicate is `userTeamSlugs.size === 0 ? 'Pick your teams' : 'Your schedule'`.
- **Fix:** Updated assertion to `body.includes('Pick your teams')`.
- **Files modified:** `scripts/smoke-manage.mjs`
- **Commit:** `498b48a`

**4. [Rule 1 - Bug] M14 assertion — filter to test email, not total rows**
- **Found during:** Task 3 (first smoke run — M14 FAIL: `got 2 rows`)
- **Issue:** M14 asserted `users.length === 1` on the full usersQuery-equivalent result. When the scratch DB has prior smoke runs' users who also followed the seeded team IDs (9900001/9900002), they appear in the result — which is CORRECT cron behavior (those users should get notifications). The test was asserting on total result count, not on whether the test email appears.
- **Fix:** Changed assertion to `users.filter(u => u.email === email).length === 1` — proves the specific test email appears exactly once (SELECT DISTINCT collapse confirmed) without coupling to DB state from other tests.
- **Files modified:** `scripts/smoke-manage.mjs`
- **Commit:** `498b48a`

## Phase 12 Goal-Backward Evidence

Full M1-M14 smoke pass (exit 0) proves the end-to-end chain:
- **D-01 store** (12-01): user_teams DDL materialized
- **D-04/D-05 /manage editor** (12-02): confederation-grouped checkboxes, pre-checked from user_teams, ≥1/≤5 server-enforced
- **D-06 cron join** (12-03): usersQuery through user_teams → teams.slug
- **NOTIFY-04**: SELECT DISTINCT v.email collapses multi-team fan-out to one email per match
- **D-03 fence**: signup unchanged (index.astro, api/signup.ts untouched across all plans)
- **D-07 copy**: sendMagicLink remains single-team-correct (confirmation email unaffected)

## Known Stubs

None — all behaviors are wired end-to-end and verified by the smoke suite.

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns introduced. `scripts/smoke-manage.mjs` is a test-only script with no production surface.

## Self-Check

- [x] `scripts/smoke-manage.mjs` modified and committed (`42b7d16`, `498b48a`)
- [x] `src/lib/email.ts` verified unchanged — `git diff --stat -- src/lib/email.ts` shows zero changes
- [x] `node --check scripts/smoke-manage.mjs` exits 0
- [x] `grep -c 'M10-multi-save-n' scripts/smoke-manage.mjs` == 2 (header + runCase)
- [x] `grep -c 'M11-pre-check' scripts/smoke-manage.mjs` == 2
- [x] `grep -c 'M12-too-many' scripts/smoke-manage.mjs` == 2
- [x] `grep -c 'M13-empty-save' scripts/smoke-manage.mjs` == 2
- [x] `grep -c 'M14-cron-visibility' scripts/smoke-manage.mjs` == 2
- [x] `grep -c 'dbInsertUserTeams' scripts/smoke-manage.mjs` >= 1
- [x] `grep -c "body.append('team'" scripts/smoke-manage.mjs` == 1
- [x] `grep -c 'DELETE FROM user_teams' scripts/smoke-manage.mjs` >= 1
- [x] M1-M9 case names all present
- [x] Full smoke: `pass=15 fail=0` (exit 0) against built server on scratch DB
- [x] D-03 fence: `index.astro` and `api/signup.ts` in `files_modified` == 0
- [x] `grep -ciE 'bitcoin|lightning|crypto|world domination|personal olympics' src/lib/email.ts` == 0 (LAND-02)
- [x] `grep -c 'team: string,' src/lib/email.ts` == 1 (single-team signature)

## Self-Check: PASSED

All commits verified, all files present, smoke green.

---
*Phase: 12-restore-multi-team-selection*
*Completed: 2026-05-16*
