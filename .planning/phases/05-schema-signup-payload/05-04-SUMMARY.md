---
phase: 05-schema-signup-payload
plan: 04
subsystem: api
tags: [signup, validation, allow-list, intl, json-import, prepared-statement]

requires:
  - phase: 05-02
    provides: references/teams.json (the 48-entry allow-list)
  - phase: 05-03
    provides: vip_signups.team TEXT column (the destination)
provides:
  - VALID_TEAMS / isValidTeamSlug helper (src/lib/teams.ts) — reusable by /manage
  - VALID_TZ / FALLBACK_TZ / isValidTimezone helper (src/lib/timezones.ts) — reusable by /manage
  - Widened POST /api/signup that validates + persists team + timezone with separate bad-team / tz-fallback log lines
  - Widened upsertVipSignup prepared statement (6 args, COALESCE-protected team, always-overwrite tz)
affects: [05-05 (downstream consumers — independent), 05-06 (smoke), 06 (landing form), 09 (/manage editor)]

tech-stack:
  added: []
  patterns:
    - "JSON-as-allow-list: import references/teams.json with import-attributes, build a frozen Set at module load for O(1) membership"
    - "Runtime IANA tz allow-list: Intl.supportedValuesOf('timeZone') at module load; defensive try/catch only at the buildTzSet boundary"
    - "Pre-flight chain insertion rule: new validation steps go AFTER honeypot+rate-limit so bots short-circuit before paying validation cost"
    - "Log-line tampering defense: JSON.stringify on raw user input prevents CRLF log splitting"

key-files:
  created:
    - src/lib/teams.ts
    - src/lib/timezones.ts
    - .planning/phases/05-schema-signup-payload/05-04-SUMMARY.md
  modified:
    - src/lib/db.ts
    - src/pages/api/signup.ts

key-decisions:
  - "Used `import teams from '../../references/teams.json' with { type: 'json' }` (current import-attributes syntax). Astro 5 + Node 22 accept it. Did NOT need the `assert` fallback or readFileSync."
  - "Lowercased rawTeam before VALID_TEAMS.has() lookup so a stray `England` from a misbehaving client maps to slug `england`. Slugs are lowercase by Plan 02 contract."
  - "Did NOT change requested_sport handling. The teaser still defaults to world_cup; the consumer landing form will hardcode it. The VALID_SPORTS allow-list stays."

patterns-established:
  - "Two-file allow-list helpers: one for the static JSON-sourced list (teams), one for the runtime-sourced list (timezones). Both live under src/lib/ and are imported by name (no barrel index.ts)."
  - "ON CONFLICT COALESCE protects irreversible fields (team), pure-overwrite for sensor-style fields (timezone)"

requirements-completed:
  - SIGNUP-01
  - SIGNUP-02
  - SIGNUP-03
  - COMPAT-02

duration: ~20min (orchestrator-inline)
completed: 2026-05-13
---

# Phase 05 Plan 04: Widen /api/signup Summary

**POST /api/signup now validates team against the 48-slug allow-list, falls back invalid tz to America/New_York, and persists both via a 6-arg upsertVipSignup. Pre-flight chain (Origin → form → honeypot → email → rate-limit) is byte-identical.**

## Performance

- **Duration:** ~20min (orchestrator-inline; followed 05-03's sandbox-avoidance pattern)
- **Started:** 2026-05-13T03:00Z (after 05-03 merge)
- **Completed:** 2026-05-13T09:08Z
- **Tasks:** 3
- **Files modified:** 4 (2 new, 2 modified)

## Accomplishments

- Two new lib helpers (`teams.ts`, `timezones.ts`) — slim, single-purpose, reusable by plan 09's /manage editor
- Widened `upsertVipSignup` from 4 to 6 prepared-statement params; team COALESCE-protected, tz always-overwritten
- Widened POST handler with two new validation steps inserted exactly after rate-limit (so bot traffic short-circuits at honeypot/rate-limit before paying validation cost)
- Bad-team rejects with `/?error=bad-form` + distinct log line; bad-tz falls back silently to `America/New_York` + distinct log line (COMPAT-02)
- Build clean, no new astro-check errors in any plan-04 file
- T-05-09 CRLF log-splitting mitigated via JSON.stringify on raw user input

## Task Commits

1. **Task 1: teams.ts + timezones.ts** — `5f0db1c` (feat) — lib helpers
2. **Task 2: widen upsertVipSignup** — `7074f19` (feat) — 6-arg prepared statement
3. **Task 3: widen signup.ts** — `551231a` (feat) — validation + persistence

(SHAs available via `git log --oneline --grep='05-04'`.)

## Files Created/Modified

- `src/lib/teams.ts` (new, 13 lines) — TEAMS, VALID_TEAMS, isValidTeamSlug, TeamEntry
- `src/lib/timezones.ts` (new, 16 lines) — VALID_TZ (~418 zones), FALLBACK_TZ='America/New_York', isValidTimezone, buildTzSet
- `src/lib/db.ts` (modified, +10/−4) — upsertVipSignup widened to 6 params
- `src/pages/api/signup.ts` (modified, +21/−0) — two new imports + two new validation blocks + 6-arg call

## Decisions Made

- **JSON import syntax:** went with `with { type: 'json' }` (the current standard import-attributes syntax). Astro 5 + Node 22 accept it without complaint. The plan's documented fallback paths (`assert` syntax, readFileSync) were not needed.
- **Lowercase before lookup:** `rawTeam` is `.trim().toLowerCase()` before `VALID_TEAMS.has(...)`. Slugs are canonically lowercase per Plan 02 contract. Defensive against a client that submits `England`.
- **Log lines wrap raw input in JSON.stringify:** `[signup] bad-team rejected email=foo@bar.com input="\\r\\nCRLF"` — control chars are escaped, log splitting is impossible.
- **6-arg upsertVipSignup call order:** `(email, requestedSport, ip, ua, rawTeam, tz)` — matches the INSERT column order, easy to verify by eye against the SQL.

## Deviations from Plan

None on substance. Same orchestrator-inline execution pattern as 05-03 (sandbox-avoidance after the worktree-isolation drift bug + sequential-subagent Bash sandbox lockout on 05-03). Substance of the work is verbatim what the plan called for.

## Issues Encountered

None. astro-check still reports the 4 pre-existing baseline errors in `db.ts` (missing `@types/node`) and the 17 downstream-consumer `selected_teams` references in schedule.astro / save-selection.ts / send-kickoff-notifications.mjs — all expected, the latter resolved by plan 05-05 in this same wave.

## Next Phase Readiness

- **Plan 05-05** is the critical-path peer in this wave. It must update `scripts/send-kickoff-notifications.mjs`, `src/pages/schedule.astro`, `src/pages/api/save-selection.ts` to read the new `team` column. Both 05-04 and 05-05 MUST land in the same deploy or the live droplet 500s on `/schedule`.
- **Plan 05-06** (smoke script) will exercise the 7 cases end-to-end against the built server.

---
*Phase: 05-schema-signup-payload*
*Completed: 2026-05-13*
