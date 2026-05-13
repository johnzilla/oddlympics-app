---
phase: 05-schema-signup-payload
plan: 05
subsystem: api
tags: [cron, schedule, save-selection, join, slug, downstream-consumers]

requires:
  - phase: 05-02
    provides: teams.slug column on the teams table
  - phase: 05-03
    provides: vip_signups.team column (and removed selected_teams)
provides:
  - Kickoff cron usersQuery joined on teams.slug (D-06 path b wired)
  - /schedule frontmatter reads user.team and resolves to teams.id
  - /api/save-selection writes a single slug via setSelection.get(slug, tz, email)
  - Backfill rows (team=NULL) render /schedule without crash
affects: [05-06 (smoke), 06 (consumer landing), 09 (/manage editor — owns single-team UX redesign)]

tech-stack:
  added: []
  patterns:
    - "Downstream consumer migration: minimum-touch — swap data layer, keep UX surface area; defer redesign to a dedicated phase (here Phase 9 will own /manage)"
    - "Slug<->id resolution at the request boundary: SELECT slug FROM teams WHERE id = ? (save-selection) and SELECT id FROM teams WHERE slug = ? (schedule)"

key-files:
  created:
    - .planning/phases/05-schema-signup-payload/05-05-SUMMARY.md
  modified:
    - scripts/send-kickoff-notifications.mjs
    - src/pages/schedule.astro
    - src/pages/api/save-selection.ts

key-decisions:
  - "On invalid/missing team_ids in save-selection, redirect with existing 'too-many' status rather than introduce 'bad-form' as a new status. STATUS_COPY in schedule.astro doesn't include 'bad-form' — adding it cleanly belongs to Phase 9's redesign. Functional; mildly off-message."
  - "Live-code `selected_teams` is gone, but src/lib/db.ts still references the literal in two places: the migration's idempotent DROP probe (`if (has('selected_teams')) ... DROP COLUMN`) and the setSelection comment (heritage). Both are by design per plan 05-03. The plan-05 acceptance criterion 'grep -rn selected_teams scripts/ src/ returns ZERO' was an over-broad spec — interpret as 'zero live-code reads/writes.' Comments and the migration's own DROP statement are exempt."

patterns-established:
  - "Minimum-touch downstream consumer rewrite: change only the data-layer block, leave HTML / styles / inline scripts byte-identical"
  - "Slug<->id resolution patterns at the request boundary — point queries against a 48-row teams table are sub-millisecond and don't need indexing"

requirements-completed:
  - SIGNUP-03
  - COMPAT-01

duration: ~15min (orchestrator-inline)
completed: 2026-05-13
---

# Phase 05 Plan 05: Downstream Consumers Summary

**Kickoff cron, /schedule, and /api/save-selection all read/write the new single-slug shape. NOTIFY-01 dry-run gate byte-identical. /schedule no longer crashes on team=NULL backfill rows.**

## Performance

- **Duration:** ~15min (orchestrator-inline)
- **Started:** 2026-05-13T09:08Z (after 05-04 merge)
- **Completed:** 2026-05-13T09:13Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- **Cron:** usersQuery now `JOIN teams t ON v.team = t.slug WHERE t.id IN (?, ?)`. argv shape (`home_id, away_id, match_id`) unchanged. Excludes `team IS NULL` rows so we don't notify users who haven't picked yet.
- **/schedule:** frontmatter resolves `user.team` slug → `teams.id` via point-query. `selectedIds: number[]` stays 0- or 1-length; rest of the page is byte-identical.
- **/api/save-selection:** first valid `team_ids[]` integer → `teams.id` → `teams.slug` lookup → `setSelection.get(slug, tz, email)`. Dedupe + JSON.stringify path is gone.
- All three files build clean. `npx astro check` reports only the pre-existing 19 baseline TS-config errors (`Cannot find module 'node:fs'`, missing `@types/node`); zero errors mention any plan-05 file.
- Cron dry-run smoke: `[notify] mode=dry-run matches-in-window=0`, exit 0. Proves the new JOIN parses + executes against a freshly-booted server's schema.

## Task Commits

1. **Task 1: kickoff cron usersQuery** — `git log --oneline --grep='feat(05-05): rewrite kickoff cron'`
2. **Task 2: /schedule.astro frontmatter** — `git log --oneline --grep='feat(05-05): read user.team'`
3. **Task 3: /api/save-selection** — `git log --oneline --grep='feat(05-05): write single team slug'`

## Files Created/Modified

- `scripts/send-kickoff-notifications.mjs` (+6/−5) — usersQuery rewritten, comment updated
- `src/pages/schedule.astro` (+6/−7) — frontmatter JSON-parse block replaced with slug→id point-query
- `src/pages/api/save-selection.ts` (+14/−12) — first-valid-id → slug, single-arg setSelection

## Decisions Made

- **No new STATUS_COPY key for the "no valid team id" branch.** Reused `too-many` since adding a new key requires updating `STATUS_COPY` in schedule.astro and Phase 9 will redesign /manage anyway. Mildly off-message ("That's a lot of teams. Pick fewer.") but the user gets a flash and can retry.
- **No index on teams.slug.** The teams table has 48 rows; even an unindexed `WHERE slug = ?` is a sub-millisecond linear scan. If the table grows to other tournaments, that's Phase 9+ territory.
- **Did NOT touch `feature_request` textarea / insert.** Phase 2.5's demand-capture lives untouched.

## Deviations from Plan

None on substance. Same orchestrator-inline pattern as 05-03 / 05-04 (sandbox-avoidance). The plan-spec'd grep "selected_teams returns zero" is over-strict — the two remaining hits in `src/lib/db.ts` are the idempotent DROP probe (`if (has('selected_teams'))`) and a heritage comment. Both are mandated by plan 05-03's idempotency contract. Noted in `key-decisions`.

## Issues Encountered

- Initial dry-run cron smoke against my hand-init'd vip_signups-only DB crashed on `matches` table missing — not a plan defect, just that I'd only manually initialized one table earlier for the backup-script test. Booted the built server against a temp DB to populate the full schema (teams, matches, match_notifications, vip_signups, feature_requests), then re-ran the cron — clean exit, dry-run output as expected.

## Next Phase Readiness

- **Plan 05-06 (smoke verification)** can now run. Wave 3 closes Plans 05-04 + 05-05 — the API surface is consistent with the new schema end-to-end.
- **Pre-deploy operator action (unchanged from 05-03):** run `scripts/backup-pre-05.mjs` on the droplet before pushing the deploy that contains the Phase 5 commits.

## NOTIFY-01 gate evidence

```
$ grep -n 'ENABLED' scripts/send-kickoff-notifications.mjs
6:// SAFETY: the script runs in dry-run mode unless KICKOFF_NOTIFICATIONS_ENABLED=true
33:const ENABLED = process.env.KICKOFF_NOTIFICATIONS_ENABLED === 'true';
40:if (ENABLED && !API_KEY) {
```

Same line numbers as pre-plan — gate logic byte-identical.

---
*Phase: 05-schema-signup-payload*
*Completed: 2026-05-13*
