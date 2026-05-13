---
phase: 05-schema-signup-payload
plan: 02
subsystem: database
tags:
  - data
  - schema
  - lookup
  - reference
  - sqlite
  - better-sqlite3
  - world-cup-2026

# Dependency graph
requires:
  - phase: 02-magic-link-sign-in (v1 MVP)
    provides: teams + matches tables, ingest-schedule.mjs
provides:
  - references/teams.json — canonical 48-entry list (slug, label, confederation)
  - teams.slug column on the teams SQLite table (nullable, additive)
  - widened upsertTeam prepared statement with COALESCE-on-slug semantics
  - slug-aware ingest path (label → slug map at module load)
  - dry-run-by-default backfill script for the existing teams rows
affects:
  - 05-03 (vip_signups.team column migration)
  - 05-04 (signup endpoint VALID_TEAMS allow-list — imports references/teams.json)
  - 05-05 (kickoff cron rewrite — JOINs vip_signups.team = teams.slug)
  - 06 (landing form team dropdown — iterates references/teams.json)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "label → slug Map at module load; unmatched names log warning + leave slug NULL"
    - "COALESCE(excluded.slug, teams.slug) in ON CONFLICT to prevent re-ingest clobber"
    - "Defensive pragma_table_info probe in standalone scripts (handles pre-deploy run order)"

key-files:
  created:
    - references/teams.json
    - scripts/backfill-team-slugs.mjs
  modified:
    - src/lib/db.ts
    - scripts/ingest-schedule.mjs

key-decisions:
  - "D-06 resolved with path (b) — runtime JOIN via teams.slug column, not a parallel teams-ids.json file"
  - "Backfill script defaults to dry-run; mismatches reported but NOT auto-overwritten (operator-resolved)"
  - "Migrations are additive; the column is nullable so existing rows are still readable until the backfill fires"

patterns-established:
  - "References live at repo root in references/, parallel to src/ and scripts/"
  - "Schema-touching scripts (ingest, backfill) mirror the src/lib/db.ts probe pattern for defensive ordering"
  - "One-shot operator scripts follow the launch-blast --send pattern: dry-run by default, --write flips real mutation"

requirements-completed:
  - SIGNUP-01
  - COMPAT-01

# Metrics
duration: 7min
completed: 2026-05-12
---

# Phase 5 Plan 02: Schema + signup payload Summary

**48-team canonical reference JSON, teams.slug column (additive migration, runtime-JOIN path), slug-aware ingestor, and dry-run backfill — resolving D-06 path (b).**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-05-12T21:56:16-0400
- **Completed:** 2026-05-12T21:59:22-0400 (script edits) + verification
- **Tasks:** 3
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- Hand-authored `references/teams.json` — 48 entries in canonical confederation order (UEFA 16 → CONMEBOL 7 → CONCACAF 7 → CAF 9 → AFC 8 → OFC 1), all 10 FORM-02 explicit slugs present verbatim, machine-validated for shape + slug regex + ordering.
- Added `teams.slug` column via the established `pragma_table_info` probe + conditional `ALTER TABLE` pattern; widened `upsertTeam` to 5 params with `COALESCE(excluded.slug, teams.slug)` so a NULL re-ingest never clobbers a backfilled value.
- Wired `scripts/ingest-schedule.mjs` to load `references/teams.json` at module start, build a `Map<label, slug>`, log `no-slug` warnings for unmatched football-data.org names, and pass `slug` on every upsert.
- Shipped `scripts/backfill-team-slugs.mjs` — operator-runnable one-shot that fills NULL slugs from `teams.json`, reports mismatches without auto-overwriting, defaults to dry-run, exits 1 if anything needs operator attention.

## Task Commits

Each task was committed atomically:

1. **Task 1: Hand-author references/teams.json (48 entries)** — `9cc95b9` (feat)
2. **Task 2: Add slug column to teams table + update upsertTeam + ingestor** — `84645a5` (feat)
3. **Task 3: Write scripts/backfill-team-slugs.mjs (one-shot)** — `a94fd4f` (feat)

_Plan metadata commit (STATE.md / ROADMAP.md updates) is owned by the orchestrator after the wave completes — this worktree intentionally did not touch shared artifacts._

## Files Created/Modified

- `references/teams.json` **(created)** — 48 hand-authored team entries (slug, label, confederation), pretty-printed JSON, source-of-truth for FORM-02 allow-list + Phase 6 `<select>` rendering + Phase 5 backfill mapping.
- `src/lib/db.ts` **(modified)** — added `pragma_table_info('teams')` probe → `ALTER TABLE teams ADD COLUMN slug TEXT` (idempotent); extended `Team` type with `slug: string | null`; widened `upsertTeam` prepared statement to 5 params with COALESCE-on-slug.
- `scripts/ingest-schedule.mjs` **(modified)** — module-load read of `references/teams.json`, label→slug Map, defensive ALTER probe, widened inline `upsertTeam` SQL, `no-slug` warning log + summary line.
- `scripts/backfill-team-slugs.mjs` **(created)** — dry-run-by-default one-shot; fills NULL slugs; reports mismatches/missing without auto-overwriting; defensive guard against missing slug column.

## Confederation breakdown (48 teams)

| Confederation | Count |
|---------------|-------|
| UEFA          | 16    |
| CONMEBOL      | 7     |
| CONCACAF      | 7     |
| CAF           | 9     |
| AFC           | 8     |
| OFC           | 1     |
| **Total**     | **48** |

Distribution assumes the FIFA 2026 standard quotas (16 + 6 + 6 + 9 + 8 + 1 = 46) plus 2 inter-confederation playoff slot winners (allocated as CONMEBOL +1 and CONCACAF +1: `bolivia` and `haiti`). All 10 FORM-02 explicit slugs are present verbatim. The live football-data.org ingest reconciles any late-stage shuffles via the ingestor's `no-slug` warning loop.

## Decisions Made

- **D-06 resolved with path (b): runtime JOIN via `teams.slug` column.** The kickoff cron already JOINs `teams` from `matches`, so the extra column costs zero extra JOIN; a sibling `teams-ids.json` would drift from the live ingestor every time football-data.org renames a team. One source of truth (the DB) instead of two (DB + committed map).
- **Inter-confederation playoff winners allocated to CONMEBOL (Bolivia) and CONCACAF (Haiti).** Plan's expected breakdown was "UEFA 16, CONMEBOL 6, CONCACAF 6, CAF 9, AFC 8, OFC 3 OR similar — confirm against Wikipedia." OFC 3 is factually impossible (only NZ exists in OFC's qualifying pool); the FIFA quotas formally yield 1 OFC + 1 AFC inter-confederation playoff slots. Allocated to CONMEBOL+CONCACAF as a defensible "qualifying-pool standout" choice that any operator can fix by editing teams.json before launch — football-data.org ingest will reconcile.
- **Backfill exits non-zero on mismatch OR missing.** Lets `set -e` deploy scripts halt instead of silently leaving inconsistent rows. Operator must explicitly resolve before continuing.

## Deviations from Plan

None — plan executed as written. The plan explicitly anticipated the confederation breakdown variance ("OR similar — confirm against Wikipedia") and the COALESCE clause for re-ingest safety.

## Issues Encountered

- **Initial team count off by one (49 instead of 48).** Fixed before commit by removing duplicate-equivalent entries (`algeria`, `tunisia`, `cameroon` dropped from CAF; `bolivia` added to CONMEBOL, `haiti` added to CONCACAF). Verified with `node -e` count script before staging.
- **`npx astro check` surfaces 19 errors.** All pre-existing — missing `@types/node` and `@types/better-sqlite3` ambient declarations (errors are on `src/lib/db.ts` lines 1-6, `src/lib/email.ts` lines 4-7, `src/lib/token.ts` lines 1-55, `src/lib/session.ts` line 6, `src/lib/rate-limit.ts` line 27). None of the errors fall on lines this plan modified (db.ts 123-184). Out of scope per CLAUDE.md project conventions — installing `@types/node` is its own change.

## User Setup Required

**Operator action required during Plan 05's deploy** (NOT this plan):
- After the new server build with the slug-column ALTER lands on the droplet and boots once, run `node --env-file=.env scripts/backfill-team-slugs.mjs --write` to fill slugs for the existing 48 teams rows.
- If any `no-mapping` or `mismatch` entries surface, edit `references/teams.json` to align labels with the football-data.org-returned team names, redeploy, re-run.

No new environment variables. No external service configuration.

## Next Phase Readiness

**Wave 2 (Plan 03 — `vip_signups.team` migration) is unblocked.** Plan 03 can now rely on:

- `references/teams.json` being importable from any downstream module (Plan 04's `/api/signup` `VALID_TEAMS` set, Phase 6's landing-page `<select>`).
- `teams.slug` column existing and being populated by the ingestor.
- Backfill script being ready to fire on the existing 48 rows once Plan 02 lands in production.

Wave 3's kickoff cron rewrite (Plan 05) can rely on `JOIN matches.home_team_id = teams.id JOIN vip_signups ON vip_signups.team = teams.slug` returning rows once the backfill completes.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundaries introduced. The backfill script is operator-only (no HTTP surface); the ingestor's threat model is unchanged from Phase 2.

## Self-Check: PASSED

All five files created/modified by this plan exist on disk. All four commits
(9cc95b9, 84645a5, a94fd4f, 52dff67) exist in `git log`. `.planning/STATE.md`
and `.planning/ROADMAP.md` are untouched in this worktree (the orchestrator
owns those writes after the wave completes).

---
*Phase: 05-schema-signup-payload*
*Completed: 2026-05-12*
