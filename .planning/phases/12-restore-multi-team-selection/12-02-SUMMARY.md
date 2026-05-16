---
phase: 12-restore-multi-team-selection
plan: "02"
subsystem: ui-api
tags: [manage, save-selection, multi-team, checkboxes, transaction, sqlite]

# Dependency graph
requires:
  - phase: 12-restore-multi-team-selection
    plan: "01"
    provides: "user_teams DDL, deleteUserTeams/insertUserTeam/getUserTeams/updateTimezone prepared statements, db export"
provides:
  - "/manage signed-in branch renders confederation-grouped pre-checked checkboxes (no <select>)"
  - "/api/save-selection validates all slugs vs VALID_TEAMS, enforces >=1/<=5, persists atomically in db.transaction"
  - "too-many flash revived; bad-team copy updated; checkbox-cap JS nicety ships"
affects:
  - 12-03-kickoff-cron-join-swap
  - 12-04-smoke-verify

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "db.transaction for atomic team-set + timezone write (first transaction in codebase)"
    - "Parameterized IN clause for multi-id matches query (placeholder count matches selected count)"
    - "JS-off-safe checkbox cap via <script is:inline> (no framework, degrades gracefully)"

key-files:
  created: []
  modified:
    - src/pages/api/save-selection.ts
    - src/pages/manage.astro

key-decisions:
  - "Legend text 'Your teams — Follow up to 5' satisfies the grep -F 'Follow up to 5' AC and the CSS text-transform:uppercase renders it visually uppercase"
  - "bad-team copy updated to 'Pick 1–5 teams from the list and save again.' (no dropdown reference)"
  - "Matches query generalized to N teams via parameterized IN clause; placeholder count derived from selectedIds.length (no string interpolation of user data)"
  - "userTeamSlugs declared as let at outer frontmatter scope (before the if block) so it is accessible in template without Astro.locals hack"
  - "Optional checkbox-cap nicety shipped: disables unchecked boxes once 5 checked; exception-wrapped; degrades gracefully JS-off"

# Metrics
duration: ~6min
completed: 2026-05-16
---

# Phase 12 Plan 02: Manage Editor + Save-Selection Multi-Team Summary

**Confederation-grouped checkbox editor on /manage with getUserTeams pre-checking and single db.transaction writer in /api/save-selection that atomically persists team set + timezone via imported updateTimezone (no inline db.prepare)**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-16T10:55:57Z
- **Completed:** 2026-05-16T11:01:42Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

### Task 1: /api/save-selection.ts — multi-slug bounded transaction writer

- Removed `setSelection`, `TEAM_ID_RE`, and `team_ids[]` fallback (Phase-9 transition scaffold fully gone per D-08)
- Added `deleteUserTeams`, `insertUserTeam`, `updateTimezone` imports from `../../lib/db`
- Multi-slug parser: `form.getAll('team')` → trim/lowercase/filter-empty → `VALID_TEAMS` allow-list filter
- Validation order: bad/empty slugs → `bad-team` BEFORE `>5` → `too-many` (unknown slug reported as bad-team not too-many)
- Single `db.transaction(callback)` commits team DELETE+INSERT loop AND `updateTimezone.run(tz, email)` atomically — first transaction in codebase; why-comment explains atomic intent
- tz IANA validation early-return kept BEFORE transaction (bad tz never opens txn)
- `feature_request` block, session-slide success return, and `server` catch all preserved verbatim

### Task 2: manage.astro — confederation-grouped checkboxes

- `getUserTeams` added to `../lib/db` import; `userTeamSlugs: Set<string>` declared at outer scope, populated inside `if (valid && result)` block
- `<fieldset class="picker">` `<select name="team">` replaced with confederation-grouped `<label><input type="checkbox" name="team" ...>` blocks using `groupedTeams` (no re-derivation)
- `checked={userTeamSlugs.has(t.slug)}` pre-checks the user's followed teams on load
- STATUS_COPY: added `'too-many'`; updated `'bad-team'` text to remove "Use the dropdown." reference
- Banner/subhead predicate changed from `!user?.team` to `userTeamSlugs.size === 0`
- Legend: `"Your teams — Follow up to 5"` (satisfies "Follow up to 5" microcopy AC)
- Matches query generalized: resolves each slug in `userTeamSlugs` to a team id via parameterized `SELECT id FROM teams WHERE slug = ?`, then builds a `WHERE IN (?, ...)` with one `?` per id (no string interpolation of slug/id values)
- JS-off-safe checkbox cap: `<script is:inline>` adds `change` listener, counts checked boxes, disables unchecked beyond MAX=5; exception-wrapped; degrades gracefully JS-off
- `<style is:global>` block preserved byte-for-byte (deferred tech-debt)
- A/B/C branches, tz script, match-time script all untouched

## Microcopy Choices (requested in plan output spec)

- **"Follow up to 5" placement:** `<legend class="legend">Your teams — Follow up to 5</legend>` inside the picker fieldset (CSS `text-transform: uppercase` renders it visually uppercase)
- **bad-team copy:** `"Team not recognized. Pick 1–5 teams from the list and save again."` (covers both unknown-slug and empty-selection cases)
- **Optional checkbox-cap nicety:** Shipped. Framework-free `<script is:inline>`, degrades gracefully JS-off.

## Task Commits

1. **Task 1: Rewrite /api/save-selection.ts as multi-slug bounded single-transaction writer** — `7f142d4`
2. **Task 2: Swap /manage single-select for confederation-grouped checkboxes** — `240932b`

## Files Created/Modified

- `src/pages/api/save-selection.ts` — multi-slug parser, VALID_TEAMS allow-list, >=1/<=5 enforcement, single db.transaction (deleteUserTeams + insertUserTeam loop + updateTimezone), feature_request + session-slide preserved, team_ids[]/TEAM_ID_RE/setSelection removed
- `src/pages/manage.astro` — getUserTeams import, userTeamSlugs Set, checkbox fieldset, too-many STATUS_COPY, banner/subhead predicate, parameterized multi-id matches query, JS-off-safe cap script

## Decisions Made

- `userTeamSlugs` declared as `let` at outer frontmatter scope (not inside the `if` block) so it flows to the template without `Astro.locals` indirection — simpler and type-safe
- Legend text uses mixed case so `grep -F 'Follow up to 5'` passes while CSS handles visual uppercase
- Matches query uses template-literal `${placeholders}` only for the SQL `?, ?, ...` placeholder string (not user data); actual IDs are passed as parameterized arguments via `.all(...selectedIds, ...selectedIds)`

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns introduced beyond what the plan's threat model covers. The parameterized IN clause (T-12-06) is confirmed — no slug or id interpolated into SQL strings.

## Self-Check

- [x] `src/pages/api/save-selection.ts` modified
- [x] `src/pages/manage.astro` modified
- [x] Commit `7f142d4` exists (Task 1)
- [x] Commit `240932b` exists (Task 2)
- [x] `grep -c 'db.transaction' src/pages/api/save-selection.ts` == 1
- [x] `grep -c "redirectTo(formToken, 'too-many')" src/pages/api/save-selection.ts` == 1
- [x] `grep -c 'team_ids\|TEAM_ID_RE\|setSelection' src/pages/api/save-selection.ts` == 0
- [x] `grep -c 'updateTimezone' src/pages/api/save-selection.ts` == 2
- [x] `grep -Ec "db\.prepare\(.*UPDATE vip_signups SET timezone" src/pages/api/save-selection.ts` == 0
- [x] `grep -c 'type="checkbox" name="team"' src/pages/manage.astro` == 1
- [x] `grep -c '<select name="team"' src/pages/manage.astro` == 0
- [x] `grep -c "'too-many':" src/pages/manage.astro` == 1
- [x] `grep -c 'getUserTeams' src/pages/manage.astro` >= 1
- [x] `grep -F 'Follow up to 5' src/pages/manage.astro` matches
- [x] `grep -ciE 'bitcoin|lightning|crypto|world domination|personal olympics' src/pages/manage.astro` == 0
- [x] D-03 fence: index.astro + api/signup.ts untouched (0 diff lines)
- [x] `npx astro check` 19 errors — same baseline, no new type errors

---
*Phase: 12-restore-multi-team-selection*
*Completed: 2026-05-16*
