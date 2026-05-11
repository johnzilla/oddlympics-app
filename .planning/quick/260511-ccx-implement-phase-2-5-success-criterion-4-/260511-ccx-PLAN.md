---
phase: 260511-ccx
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/db.ts
  - src/pages/schedule.astro
  - src/pages/api/save-selection.ts
  - CLAUDE.md
autonomous: true
requirements:
  - LAUNCH-01-SC4
must_haves:
  truths:
    - "A signed-in user on /schedule sees a textarea labeled 'Which other championship do you want us to cover next?' below the team picker"
    - "Submitting the form with the textarea empty saves team selection + timezone exactly as it did before (no behavioral regression)"
    - "Submitting the form with non-empty text persists that text to the database, tagged to the user's email, with a created_at timestamp"
    - "A user can submit the form again with a different request — both rows are kept (history, not overwrite)"
    - "Text >1000 chars is truncated to 1000 before storage; text that is all whitespace is treated as empty"
    - "The textarea is keyboard-accessible, has a visible <label>, and renders in the same mono / near-black / accent-orange visual language as the rest of /schedule"
  artifacts:
    - path: "src/lib/db.ts"
      provides: "feature_requests table + insertFeatureRequest prepared statement"
      contains: "CREATE TABLE IF NOT EXISTS feature_requests"
    - path: "src/pages/schedule.astro"
      provides: "Textarea inside the existing <form method='post' action='/api/save-selection'>"
      contains: "name=\"feature_request\""
    - path: "src/pages/api/save-selection.ts"
      provides: "Reads form.get('feature_request'), trims + length-caps, conditionally inserts into feature_requests"
      contains: "feature_request"
    - path: "CLAUDE.md"
      provides: "v1 MVP status bullet for Phase 2.5 mentions the demand-capture field"
      contains: "demand-capture"
  key_links:
    - from: "src/pages/schedule.astro"
      to: "src/pages/api/save-selection.ts"
      via: "Same form POST — textarea is a sibling of team_ids/timezone inside the existing <form>"
      pattern: "name=\"feature_request\""
    - from: "src/pages/api/save-selection.ts"
      to: "src/lib/db.ts (feature_requests)"
      via: "insertFeatureRequest.run(email, trimmed_text) called AFTER setSelection succeeds, only when text is non-empty"
      pattern: "insertFeatureRequest"
    - from: "src/pages/api/save-selection.ts"
      to: "redirect /schedule?status=saved"
      via: "Existing redirect path — empty OR non-empty feature_request both produce status=saved"
      pattern: "status=saved"
---

<objective>
Implement Phase 2.5 success criterion 4: a demand-capture textarea on `/schedule` (the team-picker page) that lets signed-in users tell us what other championship they want us to cover next. Field is optional, must not gate the existing team-picker save flow, and submissions persist for v1.1 prioritization.

Purpose: capture the demand signal that justifies v1.1 niche-sport buildouts (strongman, cubing, etc.) without speculation. The current state has us guessing what's next; this gives us real user voice tagged to a real email we can follow up with.

Output: working textarea on /schedule, persistent storage in a new `feature_requests` table, no regression of the team-picker save flow.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md

@src/lib/db.ts
@src/lib/session.ts
@src/pages/schedule.astro
@src/pages/api/save-selection.ts

<interfaces>
<!-- Key contracts already in the codebase that the executor will touch. -->
<!-- Extracted from the files above. Use these directly — no codebase exploration needed. -->

From src/lib/db.ts:
- `export const db: Database` — the singleton better-sqlite3 instance
- `db.exec(...)` for DDL; `db.prepare<[...]>(sql)` for parameterized statements; `.run(...)` to execute writes; `.get(...)` for single-row reads
- The established inline-migration pattern for adding columns:
  ```
  const cols = db.prepare("SELECT name FROM pragma_table_info('vip_signups')").all() as { name: string }[];
  const has = (n: string) => cols.some((c) => c.name === n);
  if (!has('foo')) db.exec(`ALTER TABLE vip_signups ADD COLUMN foo INTEGER;`);
  ```
  For NEW tables, use `CREATE TABLE IF NOT EXISTS` (already used for `teams`, `matches`, `match_notifications`)
- `created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))` is the established timestamp convention

From src/pages/api/save-selection.ts:
- Auth pattern: form token (`manage` purpose) OR session cookie via `readSessionFromCookie(request.headers.get('cookie'))`
- `result.email` is the trusted user email after auth succeeds
- Validation runs BEFORE the DB write; on validation failure, redirect with `?status=<code>` (codes: `bad-token`, `bad-tz`, `too-many`, `unknown`, `server`, `saved`)
- `redirectTo(token, status, setCookie?)` helper at top of file builds the 303 response
- Form data is read once via `await request.formData()` — `form.get('feature_request')` returns `FormDataEntryValue | null` (cast `as string` then trim, following existing pattern for `token`/`timezone`)

From src/pages/schedule.astro:
- Form structure: `<form method="post" action="/api/save-selection" class="picker-form">` containing hidden token + tz-row + fieldset.picker + submit button
- `.picker` class provides the bordered-card aesthetic (`border: 1px solid var(--line); border-radius: 8px; padding: 16px; background: var(--surface);`)
- `.legend` class (uppercase, letter-spaced, dimmed) is the section-label style
- Accent color: `var(--accent)` = `hsl(18 70% 56%)`
- Mono font: `var(--mono)`
- Existing `STATUS_COPY` table maps `?status=` values to flash messages
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add feature_requests table + prepared insert to db.ts</name>
  <files>src/lib/db.ts</files>
  <action>
    Add a new SQLite table `feature_requests` and a prepared insert statement, following the existing patterns in this file.

    Schema decision (locked in this plan): use a SEPARATE `feature_requests` table, not a column on `vip_signups`. Rationale: (a) lets a user submit multiple requests over time (history, not overwrite — user asks for strongman in May, cubing in August, both are kept); (b) keeps `vip_signups` focused on user-account state vs. demand-signal data; (c) easier to query for v1.1 triage (GROUP BY request_text, count); (d) matches the existing convention where distinct concerns get distinct tables (teams, matches, match_notifications are all separate from vip_signups).

    Add the table DDL inside a new `db.exec(\`...\`)` block AFTER the existing `match_notifications` block (so it groups with other Phase 2-era tables, not interleaved with the vip_signups migration). Use `CREATE TABLE IF NOT EXISTS` (the established pattern for new tables in this file — see `teams`, `matches`, `match_notifications`). Schema:

    - id INTEGER PRIMARY KEY AUTOINCREMENT
    - email TEXT NOT NULL  (NOT a foreign key — we don't want a request to be lost if the user later unsubscribes; v1.1 triage may still want it)
    - request_text TEXT NOT NULL  (the user's free-text answer)
    - created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))  (match the convention used everywhere else in this file)

    Add an index on `email` for the eventual "show me everything user X asked for" query: `CREATE INDEX IF NOT EXISTS idx_feature_requests_email ON feature_requests(email);`

    Add an exported `FeatureRequest` type (matching the `Team` / `Match` / `VipSignup` style — plain `type` alias, no interfaces, see the CLAUDE.md TypeScript conventions section).

    Add and export a prepared statement `insertFeatureRequest` (matching the style of `upsertTeam` / `upsertMatch`):
    ```
    export const insertFeatureRequest = db.prepare<[string, string]>(`
      INSERT INTO feature_requests (email, request_text)
      VALUES (?, ?)
    `);
    ```

    Do NOT touch the `vip_signups` table, its types, or any existing prepared statements. The new code is purely additive.
  </action>
  <verify>
    <automated>npx astro check 2>&1 | grep -E "(error|Error)" | grep -v "^$" || echo "no type errors"; node --input-type=module -e "import('./src/lib/db.ts').catch(e => { console.error(e); process.exit(1); })" 2>&1 || true; sqlite3 ./data/oddlympics.db ".schema feature_requests" 2>/dev/null | grep -q "CREATE TABLE" && echo "table exists" || echo "MISSING — must run npm run dev or build to trigger migration"</automated>
  </verify>
  <done>
    `src/lib/db.ts` exports `insertFeatureRequest` and `FeatureRequest` type; running `npm run dev` (or any code path that imports db.ts) creates the `feature_requests` table on a fresh DB; running on an already-migrated DB is a no-op; `npx astro check` reports no new type errors; no changes to vip_signups schema or existing exports.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add textarea to /schedule + persist via /api/save-selection + update CLAUDE.md</name>
  <files>src/pages/schedule.astro, src/pages/api/save-selection.ts, CLAUDE.md</files>
  <action>
    Three coordinated, small edits — all in service of the same vertical slice (UI → endpoint → docs). Doing them together keeps the form contract atomic.

    **A) src/pages/schedule.astro — add the textarea to the existing form.**

    Inside the existing `<form method="post" action="/api/save-selection" class="picker-form">`, AFTER the closing `</fieldset>` of `.picker` and BEFORE the `<button type="submit">Save selection</button>`, add a new block visually styled like `.picker` (so it sits as a sibling card below the team grid, not a different aesthetic):

    - Wrap in `<fieldset class="feature-request">` with `<legend class="legend">v1.1 wishlist · optional</legend>` to match the existing legend treatment.
    - A visible `<label for="feature-request">` with the exact text "Which other championship do you want us to cover next?"
    - A `<textarea>` with: `id="feature-request"`, `name="feature_request"`, `rows="3"`, `maxlength="1000"`, `placeholder="e.g. World's Strongest Man, Rubik's Cube World Championship, drone racing..."` (the placeholder explicitly evokes the niche-sport long tail from PROJECT.md / ROADMAP.md Out-of-Scope — anchors the demand signal).
    - A small helper `<p class="hint">Optional. We use this to decide what to cover after the World Cup.</p>` below the textarea.

    Add scoped CSS rules at the END of the existing `<style is:global>` block (do NOT touch existing rules):
    - `.feature-request` — same `border / border-radius / padding / margin / background` treatment as `.picker` (visually a sibling card).
    - `.feature-request label` — display:block; font-size:13px; color:var(--fg); margin: 6px 0 8px; (a normal labeled control, not a `.legend` style).
    - `.feature-request textarea` — full-width, mono font, padding 10px, font-size 13px, background var(--surface), color var(--fg), border 1px solid var(--line), border-radius 4px, resize:vertical, min-height 70px, line-height 1.5. Add `:focus { outline: 2px solid var(--accent); outline-offset: 2px; }` so keyboard focus is visible (a11y).
    - `.feature-request .hint` — font-size:12px; color:var(--fg-dim); margin: 8px 0 0;

    DO NOT pre-fill the textarea with the user's previous request. Each save is a fresh write (history-style); pre-filling would imply "edit your last request" which is the wrong semantic for the data model we chose.

    DO NOT add any JS for this textarea — it submits with the existing form naturally.

    **B) src/pages/api/save-selection.ts — read, validate, persist.**

    Add `insertFeatureRequest` to the existing import from `'../../lib/db'` alongside `setSelection`.

    AFTER the existing `setSelection.get(...)` call succeeds (i.e. inside the `try` block, AFTER the `if (!updated) return redirectTo(...)` check), do the optional insert:

    ```
    const rawFeatureRequest = ((form.get('feature_request') as string | null) ?? '').trim();
    if (rawFeatureRequest.length > 0) {
      const capped = rawFeatureRequest.slice(0, 1000);
      try {
        insertFeatureRequest.run(result.email, capped);
      } catch (err) {
        console.error('[save-selection] feature_request insert failed', err);
        // Intentionally do NOT bubble — the team selection already succeeded and the
        // user clicked "Save selection", not "Submit feature request". A failed
        // demand-capture write must never gate conversion (success criterion 4 contract).
      }
    }
    ```

    Three contract points to be explicit about, because they encode the success criterion:

    1. `.trim()` then check `length > 0` — whitespace-only submissions are treated as empty (no insert).
    2. `.slice(0, 1000)` AFTER trim — bound the stored size to 1000 chars; the textarea has `maxlength="1000"` as defense-in-depth client-side, but the server enforces it for real.
    3. The insert is wrapped in its own try/catch and does NOT alter the redirect path. Whether the insert succeeds, fails, or is skipped (empty input), the user sees `?status=saved`. Never gate team-selection conversion on demand-capture state.

    Do NOT add a new `?status=` code for the textarea. The team-selection save IS the conversion event; the textarea is a side car.

    Do NOT change the auth flow, the team_ids validation, the timezone validation, the redirect logic, or the session cookie refresh. The diff to this file is purely the import addition + the new block AFTER the existing setSelection success path.

    **C) CLAUDE.md — update the v1 MVP status bullet for Phase 2.5.**

    Find the existing line in the "What this is" section of CLAUDE.md (root of repo, the project-instructions file):

    `- Phase 2.5: \`scripts/launch-blast.mjs\` ready (manual \`--send\` to fire the
  "pick your teams" email to existing teaser list)`

    Replace with (keep the original wrapping/formatting):

    `- Phase 2.5: \`scripts/launch-blast.mjs\` ready (manual \`--send\` to fire the
  "pick your teams" email to existing teaser list); \`/schedule\` page also
  captures an optional "which other championship next?" free-text demand signal
  into the \`feature_requests\` table (v1.1 triage input)`

    One line edit, no other CLAUDE.md changes.
  </action>
  <verify>
    <automated>npx astro check 2>&1 | grep -E "(error|Error)" | grep -v "^$" || echo "no type errors"; npm run build 2>&1 | tail -20; grep -q 'name="feature_request"' src/pages/schedule.astro && echo "textarea present" || echo "MISSING textarea"; grep -q "insertFeatureRequest" src/pages/api/save-selection.ts && echo "endpoint wired" || echo "MISSING endpoint wiring"; grep -q "demand-capture\|demand signal" CLAUDE.md && echo "claude.md updated" || echo "MISSING claude.md update"; grep -c "feature_request" src/pages/schedule.astro src/pages/api/save-selection.ts</automated>
  </verify>
  <done>
    Visiting `/schedule` while signed-in shows the new textarea below the team picker with the matching aesthetic and the wishlist legend; submitting the form with the textarea empty saves selection + tz and redirects to `?status=saved` (unchanged behavior); submitting with text writes a row to `feature_requests` keyed by the session email with a non-null timestamp and the text capped at 1000 chars; submitting with whitespace-only text inserts nothing; submitting twice with different text inserts two rows (no overwrite); `npx astro check` is clean; `npm run build` succeeds; CLAUDE.md "v1 MVP status" bullet for Phase 2.5 now mentions the demand-capture field.
  </done>
</task>

</tasks>

<verification>
End-to-end check after both tasks are complete:

1. Type + build pass: `npx astro check` reports no new errors; `npm run build` succeeds.
2. Migration: boot `npm run dev` once on the existing DB; confirm `sqlite3 ./data/oddlympics.db ".schema feature_requests"` shows the table. Re-boot to confirm idempotency (no errors, no duplicate-create).
3. UI render: with a session cookie (or fresh magic-link sign-in via `/manage`), visit `/schedule`. The textarea appears below the team picker, has the visible label "Which other championship do you want us to cover next?", placeholder is filled, and the visual treatment matches the rest of the page (mono, near-black card with accent-orange focus outline).
4. Conversion-not-gated path: pick teams, leave textarea empty, click Save selection. Page redirects to `?status=saved`, flash shows "Saved. Your schedule is updated below.", `SELECT count(*) FROM feature_requests` is unchanged.
5. Demand-capture path: pick teams, type "World's Strongest Man" into the textarea, click Save. Redirect + flash same as above. `SELECT * FROM feature_requests WHERE email = '<your email>'` returns the row with `request_text = 'World''s Strongest Man'` and a non-null `created_at`.
6. History path: submit again with "Cubing world champs". `SELECT count(*) FROM feature_requests WHERE email = '<your email>'` returns 2 (both kept).
7. Whitespace-only path: submit with `   \n  `. No new row.
8. Length-cap path: paste 2000 chars. Stored row is exactly 1000 chars; client-side textarea maxlength may also clip it.
9. CLAUDE.md updated: `grep "demand-capture\|demand signal" CLAUDE.md` matches.
</verification>

<success_criteria>
Phase 2.5 success criterion 4 is fully satisfied:

- [x] `/schedule` exposes an optional free-text field labeled "Which other championship do you want us to cover next?"
- [x] Submissions persist to the database (`feature_requests` table, history-preserving)
- [x] Field is optional — empty submissions are valid and do not block team-selection save
- [x] The team-picker save flow continues to work unchanged whether the textarea is filled or empty
- [x] Stored text is bounded (1000 chars, server-enforced after client maxlength)
- [x] Visual + accessibility: matches existing aesthetic (mono, near-black, accent orange), has a visible `<label>`, keyboard-focusable with visible focus outline
- [x] No new framework JS introduced
- [x] `vip_signups` schema untouched; no regression to existing user-state fields
- [x] CLAUDE.md "v1 MVP status" bullet for Phase 2.5 now mentions the demand-capture field
</success_criteria>

<output>
After completion, create `.planning/quick/260511-ccx-implement-phase-2-5-success-criterion-4-/260511-ccx-01-SUMMARY.md` per the standard summary template, capturing:
- Schema decision (separate `feature_requests` table) and rationale
- What's in code now vs. what was in the contract
- Any deviations from the plan (size cap, label wording, etc.)
- One-line v1.1 follow-up note: "Query `SELECT request_text, count(*) FROM feature_requests GROUP BY lower(trim(request_text)) ORDER BY count(*) DESC` to triage demand signal post-launch."
</output>
