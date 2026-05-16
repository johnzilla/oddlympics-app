# Phase 12: Restore multi-team selection - Context

**Gathered:** 2026-05-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Restore the ability to follow **more than one** World Cup team — the model the
founder originally approved ("single at signup, multi post-signup") that was
silently removed by the Phase 5 schema collapse + Phase 9 `/schedule`→`/manage`
consolidation. This phase unblocks the Phase 11 launch gate.

In scope:
- A `user_teams(email, team_slug)` join table (additive `CREATE TABLE IF NOT EXISTS`).
- `/manage` signed-in editor: pick **1–5** teams via confederation-grouped
  checkboxes (current teams pre-checked); body copy reflects "follow up to 5 teams".
- `/api/save-selection`: persist N team slugs (delete-all-then-insert per email
  in a transaction); enforce ≥1 and ≤5 server-side; reuse the `?error=` redirect
  convention (revive the Phase-9 `too-many`/`bad-team` code path).
- Kickoff cron (`scripts/send-kickoff-notifications.mjs`): swap the subscription
  join from `vip_signups.team = teams.slug` to `user_teams → teams.slug` with
  `DISTINCT email`. **No new dedupe logic.**
- Email copy that names teams (Phase-10 `sendMagicLink` value-prop line, any
  team-naming body copy) handles N teams gracefully.

Out of scope (locked / deferred):
- **Signup is UNTOUCHED** — cold signup stays single-team (`src/pages/index.astro`,
  `src/pages/api/signup.ts`, the landing `<select name="team">`). Do NOT modify
  the landing form or signup payload.
- 'Primary team' concept, per-team ordering/reorder, reviving the old
  `/schedule` page (stays a 301→`/manage`), multi-team analytics — all deferred.
- Re-running the Phase 11 launch gate / cutting the tag — that is Phase 11's job
  AFTER this phase ships.

</domain>

<decisions>
## Implementation Decisions

### Data model & migration

- **D-01:** Multi-team store = a **join table `user_teams (email TEXT NOT NULL,
  team_slug TEXT NOT NULL, UNIQUE(email, team_slug))`** in `src/lib/db.ts`,
  created with `CREATE TABLE IF NOT EXISTS` (purely additive — no `ALTER`, no
  `DROP`). Cron + `/manage` join `user_teams.team_slug → teams.slug`.
  `/manage` save = within a transaction, `DELETE FROM user_teams WHERE
  email=?` then insert the selected slugs. Slugs validated against
  `VALID_TEAMS` (`src/lib/teams.ts`).
- **D-02 (LOCKED constraint — supersedes prior mandate for THIS phase):** There
  are **no real signups / no legacy subscriber data to preserve**; solo
  dev/builder. This explicitly **overrides** PROJECT.md's "existing email list /
  migrations must be additive / cannot invalidate captured emails" constraint
  *for Phase 12 only*. Do NOT add backfill/migration ceremony, version asserts,
  or `backup-pre` snapshots to protect legacy rows. (The Phase-5 destructive-
  migration safety pattern is therefore **not required here** — the chosen
  approach is additive anyway.) `vip_signups.team` may be left as-is (harmless)
  or seeded into `user_teams`; planner's call — no data-preservation obligation.
- **D-03:** Signup stays single-team. Phase 12 does not touch
  `src/pages/index.astro`, `src/pages/api/signup.ts`, or the landing form. The
  single `vip_signups.team` write on signup is fine to keep; `user_teams` is the
  authoritative subscription source post-signup.

### /manage editor

- **D-04:** Multi-select UX = **confederation-grouped checkboxes**, reusing the
  exact 48-team confederation grouping from `references/teams.json` /
  `src/lib/teams.ts` (the same grouping the signup `<select>` uses). Plain
  server-rendered Astro, **no framework JS** (project convention). The user's
  currently-followed teams are pre-checked. One Save button. `/manage` body
  copy + microcopy updated to state the rule, e.g. **"Follow up to 5 teams"**.
- **D-05:** Selection rules: **minimum 1, maximum 5** teams. Enforced
  **server-side** in `/api/save-selection` on save; on violation, 303-redirect
  back with the existing `?error=` param convention — **revive the Phase-9
  `too-many` → `bad-team` code path** (no new error codes; server log
  distinguishes too-many vs bad-team vs empty). An optional tiny
  `<script is:inline>` that disables further checkboxes once 5 are checked is a
  **nicety at planner discretion** (must degrade gracefully JS-off; server
  validation is the source of truth). Stopping all notifications = the existing
  unsubscribe flow, NOT an empty selection.

### Kickoff notifications

- **D-06:** In `scripts/send-kickoff-notifications.mjs`, replace the
  `usersQuery` subscription join (`JOIN teams t ON v.team = t.slug ... t.id IN
  (?,?)`) with a join through `user_teams` (`v.email = user_teams.email JOIN
  teams t ON t.slug = user_teams.team_slug ... t.id IN (home_id, away_id)`),
  keeping `SELECT DISTINCT v.email`. **NOTIFY-04 (one email per match per
  channel) is already structurally guaranteed** by
  `match_notifications UNIQUE(user_email, match_id, channel)` + the
  claim-before-send `INSERT OR IGNORE` — a user following BOTH teams in a match
  still gets exactly one email. Do **not** add team-keyed dedupe. Preserve the
  `confirmed_at IS NOT NULL AND unsubscribed_at IS NULL` filter and the
  `NOT EXISTS match_notifications` guard.

### Email copy

- **D-07:** Any team-naming email copy must handle N teams without breaking.
  Primary surface: the Phase-10 `sendMagicLink` value-prop line in
  `src/lib/email.ts` (currently "every {Team} match in {tz}"). With multi-team
  at signup still single, the **confirmation email is still single-team** (one
  team chosen at signup) — so SIGNUP-04 copy may be unaffected; verify. Any copy
  that lists a user's followed set (if introduced) phrases gracefully (e.g.
  "your teams' matches"). No LAND-02 prohibited terms; no SIGNUP-04 regression.
  Planner pins exact phrasing; do not over-scope new emails.

### Scope & sequencing

- **D-08:** MVP fence = D-01 store + D-04/D-05 `/manage` + D-06 cron join +
  D-07 copy check. Deferred (own future work, NOT this phase): 'primary team'
  concept, per-team reorder, `/schedule` page revival, multi-team analytics,
  subject-line personalization.
- **D-09:** Sequencing: Phase 12 **depends on Phases 5–10** (current code).
  **Phase 11 (launch gate) re-runs AFTER Phase 12**, and only then cuts the
  deliberately-withheld `v1.0-consumer-landing` tag. The auto-generated ROADMAP
  Phase-12 stub says "Depends on: Phase 11" — that is **inverted**; this CONTEXT
  is authoritative. Re-running the Phase-11 gate must include re-verifying
  AC2/AC3-class behavior plus new multi-team behavior.

### Claude's Discretion

- Whether `vip_signups.team` is dropped, kept as a denormalized "first/primary"
  hint, or seeded into `user_teams` on migration — no legacy-preservation
  obligation (D-02); pick the simplest correct option.
- Exact `user_teams` DDL details, index, and prepared-statement names in
  `src/lib/db.ts` (match existing idiom).
- The optional inline checkbox-cap nicety (D-05) — include only if it stays
  framework-free and JS-off-safe.
- Exact `/manage` copy wording and where the "up to 5" message sits.
- Whether `/api/save-selection` keeps or removes the legacy `team_ids[]`
  fallback (Phase-9 transition scaffold) — likely remove, but planner decides.
- Exact N-team email phrasing if any multi-team-aware copy is needed.
- Plan/wave split (schema → /manage+api → cron → copy/verify).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project source-of-truth (reconciled 2026-05-16)
- `.planning/PROJECT.md` §"Key Decisions" — the single-team blocker row (now
  truthful); single-at-signup is locked; the no-legacy override (D-02) does NOT
  appear there — it is locked HERE in this CONTEXT.
- `.planning/REQUIREMENTS.md` §"Out of Scope" (reconciled multi-team row) +
  §"v1 Requirements" IDENT-02/03/04 (v1 had multi-team on `/schedule` — prior
  art for the model being restored) + NOTIFY-04.
- `.planning/ROADMAP.md` §"Phase 12" (stub — "Depends on: Phase 11" is INVERTED;
  see D-09) and §"Phase 11" (BLOCKED; re-gates after 12).
- `.planning/STATE.md` §Blockers — multi-team blocker, Phase 11 tag withheld.

### Prior-phase decisions (read before planning)
- `.planning/phases/05-schema-signup-payload/05-CONTEXT.md` — D-01 single
  `vip_signups.team` slug + `teams.slug` join; the destructive-migration safety
  pattern. **Phase 12 deliberately reverses the single-team direction; D-02
  waives the legacy-safety ceremony (no real data).**
- `.planning/phases/09-manage-editor-unsubscribe/09-CONTEXT.md` — `manage.astro`
  dual-mode editor (signed-in branch already exists), `/api/save-selection`
  `team=<slug>` + `team_ids[]` fallback, the **`too-many`→`bad-team`** error
  precedent (D-05 revives it), `/schedule`→`/manage` 301 (stays), TTL_BY_PURPOSE.
- `.planning/phases/10-confirmation-email-update/10-CONTEXT.md` — `sendMagicLink`
  value-prop line (SIGNUP-04), `teamLabel`/`tzLabel`, LAND-02 binds email body.
- `.planning/phases/11-end-to-end-launch-gate/11-CONTEXT.md` +
  `.planning/phases/11-end-to-end-launch-gate/11-SUMMARY.md` — launch gate,
  D-01 bounded fix model, tag withheld, re-gate after Phase 12, `smoke:gate`.

### Existing code (READ before editing)
- `src/lib/db.ts` — schema + prepared-statement idiom; add `user_teams` table +
  statements here. `CREATE TABLE IF NOT EXISTS` convention.
- `src/pages/manage.astro` — signed-in editor branch (Phase 9); the single
  `<select name="team">` becomes confederation-grouped checkboxes. Also carries
  the duplicated `<style is:global>` (old accent — tracked tech-debt, NOT this
  phase's job to refactor).
- `src/pages/api/save-selection.ts` — single-slug write + `team_ids[]` fallback
  + `bad-team` redirect; becomes the multi-slug writer with ≥1/≤5 enforcement.
- `scripts/send-kickoff-notifications.mjs` — `usersQuery` join swap (D-06);
  `match_notifications` UNIQUE already provides NOTIFY-04 dedupe.
- `src/lib/teams.ts` + `references/teams.json` — `TEAMS`/`VALID_TEAMS`,
  48-team confederation grouping (reuse for D-04 checkboxes), `teamLabel`.
- `src/lib/email.ts` — `sendMagicLink` value-prop copy (D-07 check).
- `src/pages/index.astro`, `src/pages/api/signup.ts` — **DO NOT MODIFY** (D-03).
- `scripts/smoke-manage.mjs` — verification pattern for `/manage` + save.

### Codebase conventions
- `.planning/codebase/CONVENTIONS.md` — ESM, `node:` prefix, strict TS,
  why-only comments, no framework JS, `?error=` redirect pattern, prepared
  statements, dry-run scripts.
- `.planning/codebase/ARCHITECTURE.md` / `STACK.md` / `TESTING.md` — hybrid
  static+server Astro, better-sqlite3, smoke-via-built-server testing.

### Out-of-repo context (informational — not files to read)
- Memory `multi-team-required`, `surface-decision-conflicts` — why this phase
  exists; the locked-decision-conflict lesson.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **48-team confederation grouping** (`references/teams.json` + `src/lib/teams.ts`)
  — already powers the signup `<select>`; reuse verbatim for the D-04 `/manage`
  checkbox groups.
- **`match_notifications` UNIQUE + claim-before-send** — already makes
  one-email-per-match-per-user true regardless of team count. D-06 inherits it
  free; no new dedupe.
- **`/api/save-selection` scaffolding** — already has a `team_ids[]` multi-input
  fallback path and a `bad-team` error redirect; multi-team write is an
  extension of existing shape, not greenfield.
- **`manage.astro` signed-in branch** (Phase 9) — the editor surface exists;
  swap the single select for grouped checkboxes within it.
- **`smoke-manage.mjs`** — existing end-to-end /manage smoke; extend for
  multi-team (select N, save, reload, ≥1/≤5 enforcement, cron-visibility).

### Established Patterns
- `CREATE TABLE IF NOT EXISTS` additive schema in `db.ts` (no migration tool).
- `?error=` 303-redirect + client param render for form errors (revive `too-many`).
- No framework JS — plain Astro + optional tiny `<script is:inline>`.
- Prepared statements w/ typed generics; transactions via better-sqlite3.
- Dry-run-by-default for any destructive script (not triggered here — no destructive op).

### Integration Points
- `user_teams` ← written by `/api/save-selection`; read by cron + `/manage`.
- Cron `usersQuery` → `user_teams` join (D-06) is the one behavior-critical wiring.
- Phase 11 `smoke:gate` re-runs against the multi-team build (D-09).

</code_context>

<specifics>
## Specific Ideas

- Join table: `user_teams(email, team_slug, UNIQUE(email, team_slug))`.
- Cap: **min 1, max 5**, server-enforced; `/manage` copy literally "Follow up
  to 5 teams" (or close).
- Cron: `SELECT DISTINCT v.email … JOIN user_teams ut ON ut.email=v.email JOIN
  teams t ON t.slug=ut.team_slug WHERE t.id IN (home_id, away_id) AND
  v.confirmed_at IS NOT NULL AND v.unsubscribed_at IS NULL AND NOT EXISTS(…match_notifications…)`.
- Revive Phase-9 `too-many`→`bad-team` error path for >5 / <1.
- Phase 11 re-gate after; tag `v1.0-consumer-landing` still withheld until then.

</specifics>

<deferred>
## Deferred Ideas

- 'Primary team' concept (subject-line personalization, ordering) — future.
- Per-team reorder / drag on `/manage` — future.
- Reviving the old multi-select `/schedule` page — stays a 301→`/manage`.
- Multi-team analytics (Plausible prop with N teams) — future.
- `/manage` + `/privacy` + `/terms` duplicated-`<style>` accent tech-debt
  (the deferred Layout.astro refactor) — explicitly NOT this phase.

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 12-restore-multi-team-selection*
*Context gathered: 2026-05-16*
