# Phase 5: Schema + signup payload - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-12
**Phase:** 5-schema-signup-payload
**Areas discussed:** team slug vs selected_teams IDs, 'Flag for IP correction' representation, Timezone allow-list source, references/teams.json shape & provenance

---

## team slug vs selected_teams IDs

Re-framed mid-discussion after the user clarified: "there are no signups but me. solo builder. no need to preserve legacy setup."

### Round 1 (pre-clarification)

| Option | Description | Selected |
|--------|-------------|----------|
| Two columns, both live | Add new `team TEXT` alongside existing `selected_teams TEXT`. v2.0 signup writes `team`. /schedule keeps writing `selected_teams`. Phase 9 /manage edits `team`. Phase 10 confirmation reads `team`. Kickoff cron resolves both via slug↔ID lookup. | (user clarified context instead of answering) |
| Repurpose selected_teams to hold one slug | Drop the JSON array semantics; `selected_teams` stores one slug. Requires migrating every existing v1 row's JSON IDs → slug. Lossy if user picked multiple. | |
| team is canonical, selected_teams derived | Write `team` slug on signup. On migration + every update, derive `selected_teams = '[<id>]'` via slug→ID lookup so existing kickoff cron untouched. | |

**User's clarification:** "context: there are no signups but me. solo builder. no need to preserve legacy setup."

### Round 2 (post-clarification)

| Option | Description | Selected |
|--------|-------------|----------|
| Add team, leave selected_teams alone | Add `team TEXT`. Stop writing to `selected_teams` from v2.0 signups. Backfill the one existing row by hand. Kickoff cron picks ONE source of truth later. | |
| Drop selected_teams, replace with team | Migration drops `selected_teams` column entirely. `team TEXT` becomes the only team field. Cleanest end state. Requires updating kickoff cron + /schedule references in this phase. | ✓ |
| Add team and auto-derive selected_teams on write | Maintain a slug↔ID map just to feed an old column. Now mostly redundant. | |

**User's choice:** Drop selected_teams, replace with team.
**Notes:** Solo + zero legacy data context made the cleanest path safe. Updating `scripts/send-kickoff-notifications.mjs` and `src/pages/schedule.astro` to read `team` is in scope for Phase 5.

---

## 'Flag for IP correction' representation

| Option | Description | Selected |
|--------|-------------|----------|
| Skip the flag entirely | No extra column. Bad/missing tz → fall back and log `[signup] tz-fallback`. Rationale: with effectively zero legacy rows and JS-populated tz in 100% of real browsers, fallback rows will be vanishingly rare. SIGNUP-02 "flagged for later IP-based correction" becomes a deferred idea. | ✓ (with fallback-default modification — see below) |
| Boolean `timezone_inferred INTEGER` | Add a 0/1 column. Set to 1 on fallback path. Lets a future job query `WHERE timezone_inferred = 1`. Costs one ALTER + write logic. | |
| Nullable timestamp `timezone_inferred_at` | Stores `strftime('%s','now')` on fallback, NULL otherwise. Slightly more info at same cost. Matches existing `confirmed_at`/`unsubscribed_at` pattern. | |

**User's choice:** "#1, but use either America/New York or America/Washington DC".

### Follow-up: fallback default tz

Claude flagged that `America/Washington_DC` is not a valid IANA name (DC uses `America/New_York`), and that switching from `America/Detroit` requires updating already-locked docs.

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, switch to America/New_York | Fallback + column default becomes `America/New_York`. Triggers a one-line edit in ROADMAP Phase 5 SC4, REQUIREMENTS SIGNUP-02 + COMPAT-01, MILESTONE-consumer-landing.md Phase 1. | ✓ |
| Keep America/Detroit as locked | Stick with the existing locked default. Detroit is also ET — only the sub-headline label changes. | |
| Something else | (free-text) | |

**User's choice:** Yes, switch to America/New_York.
**Notes:** Pre-plan docs sweep needed before `/gsd-plan-phase 5` (or fold into plan as task 1).

---

## Timezone allow-list source

| Option | Description | Selected |
|--------|-------------|----------|
| Runtime Intl.supportedValuesOf | Build `const VALID_TZ = new Set(Intl.supportedValuesOf('timeZone'))` at module load. Validate per request. Single source of truth, tracks runtime ICU. Node 22 pinned per R-5. Zero new files. | ✓ |
| Vendored static list at build time | Generate `references/tz-allowlist.json` once, commit, import at request time. Decouples from runtime ICU. Stale when tzdata updates (~2x/year). | |
| Skip strict validation — just sanity-check the shape | Accept any non-empty string matching `^[A-Za-z]+/[A-Za-z_]+(?:/[A-Za-z_]+)?$`. Trust browser-populated value. Fall back on empty/shape-mismatch. Cheapest, but allows bots to persist `Foo/Bar`. | |

**User's choice:** Runtime Intl.supportedValuesOf.
**Notes:** None.

---

## references/teams.json shape & provenance

| Option | Description | Selected |
|--------|-------------|----------|
| Flat array with confederation field | `[{slug, label, confederation}, ...]` — 48 entries. Easy as allow-list (`new Set(teams.map(t => t.slug))`). Phase 6 form groups via Object.groupBy. Hand-authored from 2026 FIFA Wikipedia. Confederation order UEFA → CONMEBOL → CONCACAF → CAF → AFC → OFC. Slugs match FORM-02 examples. Labels use natural English with diacritics. | ✓ |
| Nested by confederation | `{UEFA: [{slug, label}, ...], CONMEBOL: [...], ...}`. Closer to rendered HTML shape, harder as a flat allow-list. | |
| Generate from the existing `teams` table | Read v1 `teams` table + hand-curated slug map, write JSON. Captures football-data.org ID. 2026 qualifying not fully finalized in football-data.org. | |

**User's choice:** Flat array with confederation field.
**Notes:** Slug ↔ football-data.org ID lookup is a separate concern (see D-06 in CONTEXT.md) — planner picks between a sibling `references/teams-ids.json` or a runtime join against the `teams` SQLite table.

---

## Claude's Discretion

- Log format strings for bad-team rejection vs tz-fallback (just pick a consistent shape).
- Whether the slug allow-list import lives at the top of `signup.ts` or in a `src/lib/teams.ts` helper.
- Whether to introduce a small `src/lib/timezones.ts` for `VALID_TZ` or inline in `signup.ts`.
- Verification mechanism for Phase 5 unit-test coverage (vitest vs `scripts/smoke-signup.mjs` style) — no formal test framework exists yet; path of least resistance is the existing smoke-script pattern.

## Deferred Ideas

- **IP-based tz correction job** (SIGNUP-02 punted) — revisit if real prod logs show non-trivial `[signup] tz-fallback` volume.
- **Slug ↔ football-data.org ID auto-sync** — small reconciliation script for v1.1 if FIFA reshuffles qualifying.
- **Formal test framework** — adopt vitest/jest in v1.1; Phase 5 uses smoke scripts.
- **`/schedule` redesign** — Phase 5 only updates the data reads; the multi-pick UX is now a single-pick concept, full redesign out of scope for v2.0.
