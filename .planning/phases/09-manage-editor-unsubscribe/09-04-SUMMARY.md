---
phase: 09-manage-editor-unsubscribe
plan: "04"
subsystem: pages/manage
tags:
  - manage
  - editor
  - banner
  - save-selection
  - compat-01
  - manage-01
dependency_graph:
  requires:
    - 09-01 (TTL_BY_PURPOSE — token library coherence at deploy time)
    - 09-02 (sendManageLink URL change — producer-side counterpart)
    - 09-03 (schedule.astro 301 — wave-2 sibling; must land together)
  provides:
    - /manage dual-mode page (signed-out + signed-in editor)
    - /api/save-selection slug parse + /manage redirect target
  affects:
    - src/pages/manage.astro
    - src/pages/api/save-selection.ts
tech_stack:
  added: []
  patterns:
    - dual-mode Astro SSR page (session-or-token auth gate)
    - STATUS_COPY server-rendered flash (frontmatter reads ?status=)
    - optgroup team <select> with pre-selected value from DB
    - unsubscribed defensive branch (prevents silent setSelection no-op)
key_files:
  created: []
  modified:
    - src/pages/manage.astro
    - src/pages/api/save-selection.ts
decisions:
  - "Task 1 (legacy redirect removal) committed as part of the same commit as Task 2 (editor branch addition) — never shipped manage.astro in a degraded single-branch state"
  - "astro check exits non-zero due to pre-existing missing @types/node / better-sqlite3 types; these are not introduced by this plan; npm run build succeeds"
  - "'crypto' occurrences in dist/ are from node:crypto built-in module (token.ts, Astro internals) — not cryptocurrency content; LAND-02 source and user-facing HTML are clean"
  - "team_ids[] fallback retained in save-selection.ts until 2026-05-26 (1 week post ship); remove via follow-up commit"
metrics:
  duration: "222s"
  completed: "2026-05-15T02:15:55Z"
  tasks_completed: 3
  files_modified: 2
---

# Phase 09 Plan 04: manage.astro Dual-Mode Editor + save-selection Update — Summary

**One-liner:** Dual-mode /manage page with session-or-token editor (team <select>, tz row, matches list, unsubscribed guard) + save-selection redirect retargeted to /manage with VALID_TEAMS slug parse.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1+2 | Remove legacy redirect + rewrite manage.astro as dual-mode editor | `451530a` | src/pages/manage.astro |
| 3 | Update save-selection: slug parse, /manage redirect, bad-team | `e66e5f1` | src/pages/api/save-selection.ts |

**Note on Task 1 ordering:** Tasks 1 and 2 were committed together in a single commit (`451530a`) per the plan's explicit instruction — "Do NOT ship Task 1 alone; commit Tasks 1+2 together so manage.astro is never in a degraded state on main." The legacy `if (session) return Astro.redirect('/schedule')` at manage.astro:5-7 was the first diff in the file, before any editor branch code was added. This prevents the infinite redirect loop: without removal, a signed-in user would hit manage→(09-03 schedule 301)→manage→schedule→... indefinitely.

## Diff Sketches

### src/pages/manage.astro (full rewrite)

**Removed:**
- Lines 3-7: `import { readSessionFromCookie }` + `const session = readSessionFromCookie(...)` + `if (session) return Astro.redirect('/schedule')` — the loop-creating redirect
- Leaner `<style is:global>` block (lacked `--ok`, `--err`, `.flash`, `.picker`, `.tz-row`, `.match-list`)

**Added:**
- Full imports: `verifyToken`, `buildSessionCookie`, `readSessionFromCookie`, `db`, `getByEmail`, `VipSignup`, `Match`, `TEAMS`
- `CONFEDERATION_ORDER` / `CONFEDERATION_LABEL` / `groupedTeams` (ported from index.astro:17-39)
- Session-or-token dual auth block (ported from schedule.astro pre-09-03)
- `STATUS_COPY` with 6 entries (`saved`, `bad-token`, `bad-tz`, `bad-team`, `unknown`, `server`)
- `isUnsubscribed` defensive flag (RESEARCH Risk 3)
- Branch A: signed-out form (verbatim preservation of existing magic-link form + honeypot)
- Branch B: expired URL token (Link expired / That link didn't work / Request a new one)
- Branch C: unsubscribed defensive branch (You've unsubscribed / Sign up again)
- Branch D: signed-in editor (banner conditional, headline, conditional subhead, flash, tz-row, team <select> with optgroups, submit, matches list, footer + logout)
- Two `<script is:inline>` blocks (setupTz + match-time Intl render), only rendered in signed-in branch
- Richer `<style is:global>` from schedule.astro (pre-09-03): drops `.feature-request` and `.grid`/`.team` rules; adds `.cta-form`, `.error`, `.hp` from old manage.astro

### src/pages/api/save-selection.ts (3 surgical edits)

1. **Import added:** `import { VALID_TEAMS } from '../../lib/teams';` (after existing imports)
2. **redirectTo() Location string changed:** `` `/schedule?${params}` `` → `` `/manage?${params}` `` (line 26)
3. **Team-input parse block replaced** (lines 50-68):
   - Primary: `form.get('team')` trimmed + lowercased, validated via `VALID_TEAMS.has(slugInput)`
   - Fallback: `team_ids[]` integer→slug resolution (transition window, remove 2026-05-26)
   - `redirectTo(formToken, 'too-many')` → `redirectTo(formToken, 'bad-team')`

## Verification Results

### Static checks (all PASS)

| Check | Result |
|-------|--------|
| `! grep Astro.redirect('/schedule') manage.astro` | PASS |
| `action="/api/save-selection"` count = 1 | PASS (1) |
| `action="/api/manage"` count = 1 | PASS (1) |
| `name="team"` count = 1 | PASS (1) |
| `groupedTeams` count = 2 | PASS (2) |
| `'Pick a team'` count = 1 | PASS (1) |
| `'Your schedule'` count = 1 | PASS (1) |
| `bad-team` count ≥ 1 in manage.astro | PASS (1) |
| `! grep too-many manage.astro` | PASS |
| `! grep feature-request manage.astro` | PASS |
| LAND-02 grep manage.astro source | PASS |
| VALID_TEAMS count = 2 in save-selection.ts | PASS (2) |
| VALID_TEAMS.has count = 1 | PASS (1) |
| `/manage?` Location count = 1 | PASS (1) |
| `! grep '/schedule?'` in save-selection.ts | PASS |
| `'bad-team'` count = 1 in save-selection.ts | PASS (1) |
| `! grep 'too-many'` in save-selection.ts | PASS |
| `form.get('team')` count = 1 | PASS (1) |
| `form.getAll('team_ids')` count = 1 | PASS (1) |

### Build
- `npm run build` — PASS (Build Complete! 653ms)
- `npx astro check` — exits non-zero due to pre-existing type errors in `src/lib/token.ts`, `src/lib/db.ts`, `src/lib/email.ts`, `src/lib/session.ts` (missing `@types/node` and `better-sqlite3` type declarations). These errors were present before this plan and are not introduced by plan 09-04. The build toolchain (esbuild via Vite) succeeds.

### LAND-02 dist output
- `bitcoin`, `lightning`, `world domination`, `personal olympics` — zero occurrences in dist/
- `crypto` occurrences in `dist/server/chunks/token_*.mjs` and `dist/server/chunks/astro/server_*.mjs` are the `node:crypto` built-in module import and Astro's internal session crypto (Web Crypto API). These are framework internals, not cryptocurrency-related user-facing content. LAND-02 source check and user-facing HTML are clean.

## Deviations from Plan

None — plan executed exactly as written. Tasks 1 and 2 were committed together per explicit plan instruction.

## Coordination Notes

- **Plan 09-03 (wave-2 sibling):** schedule.astro is already the thin 301 redirect (09-03 landed first). The manage.astro line-7 removal in this plan completes the URL consolidation — manage→schedule→manage loop is fully mitigated.
- **team_ids[] fallback removal date:** The `team_ids[]` fallback in `save-selection.ts` should be removed after ~1 week of stable deploy. Suggested removal date: **2026-05-26** (if Phase 9 ships 2026-05-19). A simple follow-up commit that deletes the `else` branch and the `TEAM_ID_RE` regex if no other callers remain.
- **Full E2E smoke:** Plan 09-05 (`scripts/smoke-manage.mjs`) covers M1–M6 for this plan's surface. The static and build verifications here provide the pre-smoke gate.

## Self-Check

Verifying key artifacts exist:

- `src/pages/manage.astro` — exists (modified)
- `src/pages/api/save-selection.ts` — exists (modified)
- Commit `451530a` — manage.astro dual-mode rewrite
- Commit `e66e5f1` — save-selection.ts updates

## Self-Check: PASSED
