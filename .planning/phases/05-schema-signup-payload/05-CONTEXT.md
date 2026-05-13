# Phase 5: Schema + signup payload - Context

**Gathered:** 2026-05-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Widen `vip_signups` + `/api/signup` additively so a signup with `team` (snake_case slug from the 48-team allow-list) + `email` + hidden `timezone` (IANA, browser-populated) validates, persists, and is reachable end-to-end on the API layer.

Existing teaser contract is preserved: honeypot, Origin check, rate limit, email-format validation, and the `?error=...` slug vocabulary are unchanged; `bad-team` and `bad-tz` both surface as `bad-form` with a server-side log distinction (COMPAT-02).

Phase 5 also retires v1's `selected_teams` (JSON array of football-data.org integer IDs) — see D-01 — and updates the two existing call sites (`scripts/send-kickoff-notifications.mjs`, `src/pages/schedule.astro`) so they read from the new `team` slug column.

</domain>

<decisions>
## Implementation Decisions

### Schema shape

- **D-01: Drop `selected_teams`, replace with `team TEXT`.** v2.0 signups write a single snake_case slug (e.g., `'united_states'`). The v1 `selected_teams` column (JSON array of football-data.org integer IDs from MVP Phase 2) is removed in this phase's migration — no real legacy data to preserve (one row: the operator's). The migration:
  1. `ALTER TABLE vip_signups ADD COLUMN team TEXT;` (only if absent — `pragma_table_info` probe per the established pattern in `src/lib/db.ts:30-43`).
  2. Hand-migrate the single existing row's `team` value before deploy (or in the migration block, idempotent).
  3. `ALTER TABLE vip_signups DROP COLUMN selected_teams;` (SQLite ≥ 3.35 supports `DROP COLUMN`; verify the runtime version in the plan).
  4. Update the `VipSignup` type, `setSelection` prepared statement, and `getByEmail`/related queries to use `team`.
  5. Update `scripts/send-kickoff-notifications.mjs` and `src/pages/schedule.astro` to read `team` and resolve slug → football-data.org ID via the lookup map (see D-04 / `references/teams.json`).

- **D-02: No `timezone_inferred` flag column.** SIGNUP-02 says "flag for later IP-based correction." Given effectively zero legacy rows and JS-populated tz in 100% of real browsers, fallback rows will be vanishingly rare. Skip the column. On fallback, log a `[signup] tz-fallback email=<addr> input=<raw>` line. "Later IP-based correction" moves to deferred ideas — implement only if real fallback rows show up in production logs.

- **D-03: Fallback default timezone is `America/New_York`** (not `America/Detroit`). Applied to the column default AND the signup-handler fallback. Triggers a docs sweep — see "Pre-plan docs sweep" below.

### Timezone validation

- **D-04: Runtime `Intl.supportedValuesOf('timeZone')` at module load.** Build `const VALID_TZ = new Set(Intl.supportedValuesOf('timeZone'))` once in `src/pages/api/signup.ts` (or a small `src/lib/timezones.ts` helper) and validate every request against it. Node 22 is pinned in CI (`.github/workflows/deploy.yml`) and the systemd unit per R-5, so ICU tzdata is stable. Zero new committed files for the tz allow-list.

### Teams data file

- **D-05: `references/teams.json` is a flat array of 48 objects.** Shape: `[{slug: string, label: string, confederation: 'UEFA'|'CONMEBOL'|'CONCACAF'|'CAF'|'AFC'|'OFC'}, ...]`. Used in two places:
  1. `src/pages/api/signup.ts` imports it and builds `const VALID_TEAMS = new Set(teams.map(t => t.slug))` for allow-list validation.
  2. Phase 6's landing form iterates it at render time (groups by confederation in display order UEFA → CONMEBOL → CONCACAF → CAF → AFC → OFC per FORM-02).
- Provenance: hand-authored at plan time from the 2026 FIFA World Cup Wikipedia entry (per MILESTONE-consumer-landing.md "Files and references"). Slugs explicitly match the FORM-02 examples: `united_states`, `south_korea`, `ivory_coast`, `dr_congo`, `cape_verde`, `bosnia`, `czech_republic`, `new_zealand`, `saudi_arabia`, `south_africa`. Labels use natural English with diacritics ("Curaçao", "Côte d'Ivoire" or "Ivory Coast" — pin at plan time).
- The football-data.org integer ID is NOT in this file. The slug → ID map for the kickoff cron lives separately (plan-time decision: either a `references/teams-ids.json` next to `teams.json`, or a small lookup table joined from the live `teams` SQLite table at cron run time).

### Slug ↔ football-data.org ID lookup

- **D-06: Lookup-map placement is a plan-time decision.** Two viable paths the planner picks between:
  1. Static map file `references/teams-ids.json` — committed, simple, must be kept in sync if football-data.org IDs change (they shouldn't for an existing tournament).
  2. Runtime join — kickoff cron joins `vip_signups.team` (slug) ↔ a slug column added to the `teams` SQLite table at ingest time. No new files; one extra `JOIN` per cron tick.

### Verification

- **D-07: AC2, AC9, AC12 verify in Phase 5; AC3, AC11 defer to Phase 6/11.** Phase 5 deliverables that can be smoke-tested at the API layer: `team=fake_team` → 303 to `/?error=bad-form` with no row (AC9); honeypot still works (AC12); the 48 slugs in `references/teams.json` match FORM-02's explicit list (AC2 backend portion — frontend `<option>` count verified in Phase 6). Per MILESTONE doc Phase 1, also write unit-test-style coverage for: valid submission, missing team, invalid team, missing tz (falls back), invalid tz (falls back), honeypot triggered, rate limit triggered. Test mechanism (vitest vs curl scripts) is a plan-time call; the codebase currently has no formal test framework, so `scripts/smoke-signup.mjs`-style scripts are the path of least resistance.

### Pre-plan docs sweep (one tiny commit before `/gsd-plan-phase 5`)

Replace `America/Detroit` → `America/New_York` in three places:
- `.planning/ROADMAP.md` Phase 5 Success Criteria #3 + #4
- `.planning/REQUIREMENTS.md` SIGNUP-02 + COMPAT-01
- `MILESTONE-consumer-landing.md` "Phase 1 — Schema + payload" bullet

Either land it as `docs(05): switch fallback tz default to America/New_York` before planning, or fold into the Phase 5 plan as task 1. CONTEXT.md (this file) already uses `America/New_York` as the locked value.

### Claude's Discretion

- Log format for the bad-team / bad-tz distinction (just pick a consistent `[signup] bad-team rejected …` / `[signup] tz-fallback …` shape).
- Where the slug allow-list import lives — top of `signup.ts` vs a `src/lib/teams.ts` helper.
- Whether to introduce a small `src/lib/timezones.ts` for the `VALID_TZ` set or inline it in `signup.ts`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & scope (read first)
- `.planning/REQUIREMENTS.md` §"`/api/signup` payload" — SIGNUP-01, SIGNUP-02, SIGNUP-03
- `.planning/REQUIREMENTS.md` §"Backward compatibility" — COMPAT-01, COMPAT-02
- `.planning/REQUIREMENTS.md` §"Signup form" — FORM-01, FORM-02 (explicit slug list, confederation order)
- `.planning/REQUIREMENTS.md` §"Acceptance criteria" — AC2, AC9, AC11, AC12 (Phase 5 contributes to all four)
- `.planning/ROADMAP.md` §"Phase 5" — goal, depends-on, success criteria 1–5, R-2 risk note (count rows at plan time)
- `MILESTONE-consumer-landing.md` §"Phase 1 — Schema + payload" — unit-test list, R-5 (pin Node version), references file layout

### Project context
- `.planning/PROJECT.md` §"Current Milestone" — scope of v2.0; the LAND-02 prohibited-terms guardrail
- `CLAUDE.md` §"What this is" and §"Architecture worth understanding" — schema migration pattern, dry-run safety, dev email fallback

### Codebase patterns (downstream MUST match these)
- `.planning/codebase/CONVENTIONS.md` §TypeScript — strict mode, `type` over `interface`, `node:` prefix, prepared-statement generics
- `.planning/codebase/CONVENTIONS.md` §"Error handling — three patterns" — 303 redirect with `?error=<slug>`, lib-returns-null, module-load throw on missing prod env
- `.planning/codebase/CONVENTIONS.md` §Naming — `camelCase` / `SCREAMING_SNAKE_CASE` / `PascalCase` / `kebab-case`
- `src/lib/db.ts:30-43` — `pragma_table_info` probe + conditional `ALTER TABLE ADD COLUMN` pattern (must reuse for `team`)
- `src/lib/db.ts:188-193` — `setSelection` prepared statement (must update to read/write `team` instead of `selected_teams`)
- `src/pages/api/signup.ts:43-98` — existing handler shape (Origin check → formData → honeypot → email regex → rate limit → upsert → mintToken → sendMagicLink → 303)
- `src/pages/api/signup.ts:10` — `VALID_SPORTS` allow-list as `Set<string>` (mirror this pattern for `VALID_TEAMS` and `VALID_TZ`)

### Sibling artifacts to update in this phase
- `scripts/send-kickoff-notifications.mjs` — currently reads `selected_teams`; must read `team` after D-01
- `src/pages/schedule.astro` — currently reads `selected_teams`; must read `team` after D-01

### Phase 1 context (precedent for the migration pattern)
- `.planning/phases/01-pre-launch-hardening/01-CONTEXT.md` §Decisions — "Migrations must be additive", `pragma_table_info` probe rationale

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`VALID_SPORTS` pattern** (`src/pages/api/signup.ts:10`) — `new Set([...])` allow-list checked in the handler. Same shape for `VALID_TEAMS` (from `references/teams.json`) and `VALID_TZ` (from `Intl.supportedValuesOf('timeZone')`).
- **`back(message)` helper** (`src/pages/api/signup.ts:36-41`) — 303 redirect with `?error=<slug>`. Both bad-team and bad-tz paths reuse `back('bad-form')` per COMPAT-02; only the log line above the `return` differs.
- **`pragma_table_info` migration probe** (`src/lib/db.ts:30-43`) — idempotent additive migration. Use for `ADD COLUMN team`. SQLite's `DROP COLUMN` (≥ 3.35) does NOT have an `IF EXISTS` form, so wrap the drop in the same probe (skip if `selected_teams` is already gone).
- **Prepared statement with typed param tuple** (`src/lib/db.ts:59-69`, `:188-193`) — `db.prepare<[…]>(…)`. New prepared statement for the v2.0 signup will write `(email, requested_sport, team, ip, user_agent)`.

### Established Patterns
- **Additive-only migrations** (`.planning/phases/01-pre-launch-hardening/01-CONTEXT.md` D-decisions) — `selected_teams` drop is the first non-additive change. Mitigated by no-real-data context; flag explicitly in the plan and verify the drop on a copy of the prod DB before deploy.
- **Dev fallback, prod throw** (`src/lib/email.ts:3`, `src/lib/token.ts:3`) — same module-load discipline applies if any new required env var is introduced (none expected for Phase 5).
- **Honeypot success masking** (`src/pages/api/signup.ts:55-59`) — bots that fill `website` get a 303 to `/pending` with no row written. Must keep this behavior; the new validation logic runs AFTER the honeypot check.

### Integration Points
- `vip_signups.team` (new) ← written by `/api/signup` (Phase 5) ← read by `/manage` editor (Phase 9), confirmation email template (Phase 10), and `send-kickoff-notifications.mjs` (updated here, dry-run still gated by `KICKOFF_NOTIFICATIONS_ENABLED`).
- `references/teams.json` (new) ← imported by `/api/signup` for allow-list ← imported by `src/pages/index.astro` for `<select>` rendering (Phase 6) ← read by AC2 verification script (Phase 11).
- `VALID_TZ` set ← built from `Intl.supportedValuesOf('timeZone')` at module load ← consumed by `/api/signup` validation only. No other call sites in Phase 5; `/manage` tz update reuses or duplicates per Phase 9 decision.

</code_context>

<specifics>
## Specific Ideas

- Operator context (matters for risk sizing): **one real subscriber row exists** — the operator's own — so the typical "preserve email list at all costs" constraint is loosened for Phase 5. Migration that drops `selected_teams` is acceptable; the COMPAT-01 backfill text in REQUIREMENTS.md still holds for the general case but has no users to protect this milestone.
- Slug examples that must work end-to-end: `united_states`, `south_korea`, `ivory_coast`, `dr_congo`, `cape_verde`, `bosnia`, `czech_republic`, `new_zealand`, `saudi_arabia`, `south_africa` (verbatim from FORM-02).
- TZ inputs that must round-trip: `America/Detroit`, `Europe/London`, `Africa/Lagos` (AC3's Playwright locales — Phase 6 verifies, but Phase 5's persistence must already work).

</specifics>

<deferred>
## Deferred Ideas

- **IP-based tz correction job.** D-02 punts the SIGNUP-02 "flag for later IP-based correction" mechanism. Revisit if real prod logs show non-trivial `[signup] tz-fallback` volume. Implementation when needed: backfill column + a small cron reading the existing `ip` column through a geo lookup.
- **Slug ↔ football-data.org ID auto-sync.** If FIFA reshuffles qualifying after teams.json is committed, the slug map could drift from the live `teams` table. A small reconciliation script (compare `teams.json` slugs against the `teams` table on ingest) is a v1.1 chore, not Phase 5 scope.
- **Formal test framework.** Phase 5 ships verification via `scripts/smoke-*.mjs` per existing conventions. Adopting vitest/jest is a v1.1 platform decision.
- **`/schedule` redesign.** Phase 5 only updates `schedule.astro`'s data reads (selected_teams → team). The page's multi-pick UX is now a single-pick concept; full redesign is out of scope for v2.0 (Phase 9 `/manage` is the v2.0 single-team editor).

</deferred>

---

*Phase: 5-Schema + signup payload*
*Context gathered: 2026-05-12*
