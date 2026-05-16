---
phase: 260511-ccx
plan: 01
status: complete
subsystem: schedule-page
tags: [phase-2.5, demand-capture, feature-requests, schedule, sqlite, astro]
requires:
  - existing schedule.astro team-picker form
  - existing /api/save-selection POST handler
  - existing session-cookie auth (src/lib/session.ts)
provides:
  - feature_requests SQLite table (history-preserving, indexed on email)
  - insertFeatureRequest prepared statement + FeatureRequest type
  - optional <textarea name="feature_request"> on /schedule
  - server-side trim + 1000-char cap + non-blocking insert path
affects:
  - src/lib/db.ts
  - src/pages/schedule.astro
  - src/pages/api/save-selection.ts
  - CLAUDE.md (v1 MVP status bullet for Phase 2.5)
tech_stack:
  added: []
  patterns:
    - history-preserving table for demand signals (separate table, not column)
    - non-gating side-effect write (own try/catch, never alters redirect path)
    - server-enforced length cap as defense-in-depth behind client maxlength
key_files:
  created: []
  modified:
    - src/lib/db.ts
    - src/pages/schedule.astro
    - src/pages/api/save-selection.ts
    - CLAUDE.md
decisions:
  - Separate feature_requests table (not column on vip_signups) — preserves history, isolates demand-signal data from user-account state, easier v1.1 triage
  - email is plain TEXT NOT NULL (not a FK) — request rows survive unsubscribe; v1.1 triage may still want them
  - No prefill of the textarea — each save is a fresh write; prefilling would imply "edit your last request" which contradicts the history-style data model
  - Whitespace-only input treated as empty (no insert) — keeps the table clean
  - Length cap enforced server-side (1000 chars) after trim, with maxlength="1000" as client-side defense-in-depth
  - Failed insert does NOT propagate to the redirect — team-selection save is the conversion event; the textarea is a side car
  - No new ?status= code — both empty and non-empty submissions still redirect to ?status=saved
metrics:
  duration: 2m51s
  completed_date: "2026-05-11"
  task_count: 2
  files_modified: 4
---

# 260511-ccx-01: Phase 2.5 Demand-Capture Field on /schedule Summary

Adds an optional "Which other championship do you want us to cover next?" textarea below the team picker on `/schedule`, persisting submissions into a new history-preserving `feature_requests` SQLite table; the team-picker save flow is unchanged whether the field is empty or filled.

## What's in code now (vs. the contract)

Every contract item from `<must_haves.truths>` and `<success_criteria>` is satisfied:

- [x] Signed-in user on `/schedule` sees a textarea labeled "Which other championship do you want us to cover next?" below the team picker.
- [x] Empty submission saves team selection + timezone exactly as before; no behavioral regression.
- [x] Non-empty submission persists to `feature_requests` tagged to the user's email with a non-null `created_at` (`strftime('%s','now')`).
- [x] Repeated submissions produce additional rows (history, not overwrite) — confirmed by runtime smoke test.
- [x] Text >1000 chars is truncated to exactly 1000 server-side; whitespace-only is treated as empty (no insert).
- [x] Textarea is keyboard-accessible, has a visible `<label for="feature-request">`, has a visible focus outline (`outline: 2px solid var(--accent)`), and renders in the same mono / near-black / accent-orange visual language (mirrors the `.picker` card treatment).
- [x] No framework JS introduced; no `<script>` was added for this textarea.
- [x] `vip_signups` schema untouched.
- [x] `CLAUDE.md` "v1 MVP status" bullet for Phase 2.5 now mentions the demand-capture field and the `feature_requests` table.

## Schema decision: separate table, not column

Picked a new `feature_requests` table over a column on `vip_signups`. Rationale recorded in the plan and re-stated here:

1. **History, not overwrite.** A user who asks for strongman in May and cubing in August deserves both rows kept. A column would have to either overwrite (lose May) or concatenate (lose structure).
2. **Separation of concerns.** `vip_signups` is user/account state (email, confirmation, selected teams, timezone, unsubscribe). Demand-signal data is a different aspect — keeping it in a sibling table matches the existing convention (`teams`, `matches`, `match_notifications` are all separate from `vip_signups`).
3. **v1.1 triage ergonomics.** `SELECT request_text, count(*) FROM feature_requests GROUP BY lower(trim(request_text)) ORDER BY count(*) DESC` is one straightforward query against a sibling table; the same operation across a CSV/concatenated column would need string-splitting in SQL.
4. **email is plain TEXT, not a FK.** If a user later unsubscribes from `vip_signups`, the demand signal they left should still be available for v1.1 prioritization. No `ON DELETE CASCADE` linkage.

The new block is purely additive: `CREATE TABLE IF NOT EXISTS feature_requests (...)` + `CREATE INDEX IF NOT EXISTS idx_feature_requests_email`, both placed after the Phase 2 `match_notifications` block and before the type/prepared-statement exports. Running on a fresh DB creates the table; running on a migrated DB is a no-op (verified by re-importing the module).

## Architectural shape

- **Data model.** One row per submission, AUTOINCREMENT id, `email TEXT NOT NULL`, `request_text TEXT NOT NULL`, `created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))`. Index on `email` for the eventual per-user lookup.
- **Form contract.** The textarea is a sibling of `team_ids` and `timezone` inside the existing `<form method="post" action="/api/save-selection">`. It submits with the existing form naturally; no extra round-trip, no JS.
- **Server-side handling.** `src/pages/api/save-selection.ts` reads `form.get('feature_request')`, trims, checks `length > 0`, and only then `slice(0, 1000)` + `insertFeatureRequest.run(result.email, capped)`. The insert is wrapped in its own try/catch and is positioned *after* the `setSelection.get(...)` success path, so any insert failure logs to `console.error` but does not alter the redirect — `?status=saved` is emitted regardless.
- **No new `?status=` code.** The team-selection save is the conversion event; the textarea is a side car. Users see the same "Saved. Your schedule is updated below." flash whether the textarea was empty, whitespace, normal text, or 2000-char paste.
- **Aesthetic.** New `.feature-request` fieldset reuses `.picker`'s border/radius/padding/surface treatment; the `<label>` is a plain block label (13px, `--fg`) and the `<textarea>` is full-width mono with a 70px min-height, vertical resize, and an accent-orange focus outline for keyboard a11y. Rules placed at the END of the existing `<style is:global>` block, above the `@media` breakpoint — no existing rule touched.

## Deviations from Plan

None of consequence. The plan was followed task-for-task, copy-for-copy:

- The textarea fieldset wraps the label + textarea + hint exactly as specified, with the exact placeholder text from the plan.
- The endpoint snippet was inserted exactly where the plan specified — inside the existing `try { ... }` block, after the `if (!updated)` check — so a `setSelection` failure path still redirects with `?status=server` without ever touching the feature_request code path.
- CLAUDE.md edit is the single-line replacement specified; no other CLAUDE.md changes.

## Out-of-scope / Deferred

- **Pre-existing `npx astro check` errors.** 19 TypeScript errors exist on `main` (missing `@types/node`, `better-sqlite3` type declarations). These pre-date this task — baseline measured by `git stash && npx astro check` returned the same count. Documented for awareness; out-of-scope per the executor scope-boundary rule. The build (`npm run build`) succeeds end-to-end and runtime is unaffected.
- **No formal test suite.** Smoke-tested via direct Node module import that exercises the insert path (empty, whitespace, normal, repeat, 2000-char cap) — all five cases produced the expected row counts and stored lengths. No regression test infrastructure added (out-of-scope; no test framework in this repo per CLAUDE.md).

## v1.1 follow-up

Triage query post-launch:

```sql
SELECT request_text, count(*) AS n
FROM feature_requests
GROUP BY lower(trim(request_text))
ORDER BY n DESC;
```

To message a specific demand cohort (e.g. notify everyone who asked for strongman when v1.1 ships that feature):

```sql
SELECT DISTINCT email FROM feature_requests
WHERE lower(request_text) LIKE '%strongman%'
   OR lower(request_text) LIKE '%strongest man%';
```

## Commits

- `ed77383` — feat(260511-ccx-01): add feature_requests table + insertFeatureRequest
- `6129910` — feat(260511-ccx-01): demand-capture textarea on /schedule (Phase 2.5 SC4)

## Self-Check: PASSED

- src/lib/db.ts: FOUND (modified)
- src/pages/schedule.astro: FOUND (modified)
- src/pages/api/save-selection.ts: FOUND (modified)
- CLAUDE.md: FOUND (modified)
- Commit ed77383: FOUND in git log
- Commit 6129910: FOUND in git log
- feature_requests table exists in dev DB (verified via sqlite3 .schema)
- Module imports cleanly (verified via Node module load)
- Runtime smoke test: 5 contract paths verified (empty, whitespace, normal, repeat, length-cap)
- `npm run build` succeeded with no new errors
- `npx astro check` baseline 19 errors unchanged (all pre-existing missing-@types/node, not introduced by this task)
