---
phase: 05-schema-signup-payload
verified: 2026-05-13T00:00:00Z
re_verified: 2026-05-13T00:00:00Z
status: passed
score: 5/5 ROADMAP success criteria fully verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 4/5
  gaps_closed:
    - "SC4 / COMPAT-01 timezone backfill — src/lib/db.ts line 60 now UPDATEs pre-existing rows to timezone='America/New_York' when NULL"
    - "Plan 05-01 docs sweep on ROADMAP.md — lines 41-42 (Phase 5 SC #3 + #4) and line 136 (Phase 9 SC #2) now read America/New_York"
  gaps_remaining: []
  regressions: []
gaps: []
human_verification: []
---

# Phase 5: Schema + Signup Payload Verification Report

**Phase Goal:** A signup that submits `team` + `email` + hidden `timezone` is validated, persisted, and reachable end-to-end on the API layer — without breaking the existing teaser contract or any existing row.
**Verified:** 2026-05-13
**Re-verified:** 2026-05-13 (after gap-closure fixes)
**Status:** passed

## Re-verification Summary

Two gaps from the initial 2026-05-13 pass have been closed:

**Gap 1 closed — COMPAT-01 timezone backfill (SC4).** `src/lib/db.ts` lines
57-60 now contain an explanatory why-comment plus
`db.exec(\`UPDATE vip_signups SET timezone = 'America/New_York' WHERE timezone IS NULL;\`);`
inside the vip_signups migration block. The UPDATE runs after the
`ALTER TABLE ... ADD COLUMN timezone TEXT` so any row that was created
pre-Phase-5 (timezone column nullable, no incoming form value) lands at
`'America/New_York'` on first boot under the new code. The statement is
idempotent: second boot finds zero rows matching `timezone IS NULL`. Runtime
evidence: an end-to-end test against `/tmp/migration-test.db` seeded a
pre-migration row with `timezone=NULL` and confirmed `timezone='America/New_York'`
after boot.

**Gap 2 closed — ROADMAP.md docs sweep.** `.planning/ROADMAP.md` line 41
(Phase 5 SC #3) now reads `falls back to America/New_York`; line 42 (SC #4)
reads `timezone='America/New_York'`; line 136 (Phase 9 SC #2) reads
`timezone='America/New_York'`. Sister files REQUIREMENTS.md (COMPAT-01 at
line 58) and MILESTONE-consumer-landing.md were already correct on the
initial pass and remain so. The three remaining `Detroit` strings in
ROADMAP.md are intentional and non-default:
  - Line 48 — plan-list meta-reference (the title of plan 05-01: "Docs sweep (America/Detroit → America/New_York ...)"). Describes what the plan did, not a current value.
  - Line 76 — Phase 6 SC #1 example of a JS-populated tz label ("Detroit time"). UI display string showing what `Intl.DateTimeFormat().resolvedOptions().timeZone` would render for a Detroit-local viewer, NOT the fallback default.
  - Line 152 — Phase 10 SC #1 example confirmation-email body string ("every England match in Detroit time"). Same UI-display class, not a default.

No regressions: spot-recheck of the previously-VERIFIED truths (SC1, SC2,
SC3, SC5 plus all required artifacts and key links) shows no drift —
`upsertVipSignup` still 6-arg, smoke-test results unchanged, no new
`selected_teams` / `json_each` references, FALLBACK_TZ literal still
`'America/New_York'`.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| SC1 | Valid `POST /api/signup` with team + email + IANA tz → 303 `/pending?email=...`; row persists with email, team, timezone, requested_sport=world_cup, created_at | VERIFIED | `src/pages/api/signup.ts:115-118` returns 303 with `Location: /pending?email=...`; `src/lib/db.ts:77-89` `upsertVipSignup` writes all six columns including team + timezone; smoke case 1 PASS (05-06-SUMMARY: `[smoke] PASS case-1-valid (team=england, tz=Europe/London)`); persisted-row evidence shows `{team:'england',timezone:'Europe/London',requested_sport:'world_cup'}`. |
| SC2 | Missing/unknown team → 303 `/?error=bad-form`; no row; server log distinguishes "bad team" from other bad-form causes | VERIFIED | `src/pages/api/signup.ts:76-80` logs `[signup] bad-team rejected email=${rawEmail} input=${JSON.stringify(rawTeam)}` then `return back('bad-form')` (302 to `/?error=bad-form`). Smoke cases 2 + 3 PASS; server log evidence in 05-06-SUMMARY shows both `input=""` (missing) and `input="fake_team"` (unknown) rejection lines. AC9 evidence tag inline: `[smoke] PASS AC9-invalid-team`. |
| SC3 | Empty/invalid tz → falls back to `America/New_York`; persists row; flags for IP-based correction (NOTE: does NOT reject) | VERIFIED | `src/pages/api/signup.ts:82-90` falls back to `FALLBACK_TZ` (`src/lib/timezones.ts:1` literal `'America/New_York'`) and logs `[signup] tz-fallback ...`. D-02 explicitly skipped the `timezone_inferred` flag column — the log line is the flag (documented decision in CONTEXT.md and 05-SUMMARY chain). Smoke cases 4 + 5 PASS; persisted rows show `timezone='America/New_York'` for both empty and `Foo/Bar` inputs. ROADMAP.md line 41 now correctly says `America/New_York` (post-Gap-2-fix). |
| SC4 | Pre-milestone rows load without error after migration; backfilled values are `team=NULL`, `timezone='America/New_York'` | VERIFIED | (a) `team=NULL` ✓ — `src/lib/db.ts:53-54` adds the `team` column without a DEFAULT, leaving pre-existing rows at NULL by design (D-01 + COMPAT-01). (b) `timezone='America/New_York'` ✓ — `src/lib/db.ts:60` `UPDATE vip_signups SET timezone = 'America/New_York' WHERE timezone IS NULL;` runs inside the migration block after `ADD COLUMN timezone`. Idempotent. Runtime-tested end-to-end on `/tmp/migration-test.db`: seeded pre-migration row with `timezone=NULL` ended up with `timezone='America/New_York'` after boot. Page load tolerance unchanged: `src/pages/schedule.astro:37-40` renders empty state on `team IS NULL`; `scripts/send-kickoff-notifications.mjs:97` filters `v.team IS NOT NULL`. |
| SC5 | Honeypot, Origin check, rate limit, email regex behavior preserved unchanged; programmatic POST with honeypot returns no row; no new error codes | VERIFIED | `src/pages/api/signup.ts:46-73` retains the byte-identical pre-flight chain (originOk → formData → honeypot → email regex → rate limit) — confirmed via direct read against the plan's interface block. Honeypot at lines 57-61 short-circuits with 303 `/pending` before rate-limit / team validation. Smoke case 6 PASS for honeypot (`[smoke] PASS AC12-honeypot`); smoke case 7 PASS for rate-limit (`/?error=rate-limited` after the 5-per-hour cap). No new error codes introduced — bad-team and bad-tz both surface as existing `bad-form` (or silent fallback for tz) per COMPAT-02. |

**Score:** 5/5 ROADMAP success criteria fully verified.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `references/teams.json` | Canonical 48-team list, all 10 FORM-02 explicit slugs verbatim | VERIFIED | 48 entries; all of `united_states`, `south_korea`, `ivory_coast`, `dr_congo`, `cape_verde`, `bosnia`, `czech_republic`, `new_zealand`, `saudi_arabia`, `south_africa` present (verified via node JSON.parse + Set membership check). |
| `src/lib/teams.ts` | VALID_TEAMS + isValidTeamSlug + TEAMS export | VERIFIED | Exports `TEAMS`, `VALID_TEAMS`, `isValidTeamSlug`, `TeamEntry` type; uses `import ... with { type: 'json' }`. |
| `src/lib/timezones.ts` | VALID_TZ + FALLBACK_TZ='America/New_York' + isValidTimezone | VERIFIED | Builds `VALID_TZ` from `Intl.supportedValuesOf('timeZone')` at module load (418 zones on Node 22); `FALLBACK_TZ = 'America/New_York' as const`; defensive try/catch in `buildTzSet`. |
| `src/pages/api/signup.ts` | Widened POST with team+tz validation, pre-flight chain preserved | VERIFIED | 6-arg `upsertVipSignup.get(rawEmail, requestedSport, ip, ua, rawTeam, tz)` at lines 93-100; pre-flight chain (originOk → formData → honeypot → email → rate-limit) preserved; new validation steps inserted AFTER rate-limit per plan. |
| `src/lib/db.ts` | Widened upsertVipSignup + setSelection (team) + vip_signups migration + teams.slug + tz backfill | VERIFIED | `upsertVipSignup` (lines 77-89) is 6 params with `team = COALESCE(excluded.team, vip_signups.team)` + `timezone = excluded.timezone`. Migration block (33-61) ADDs `team`, DROPs `selected_teams` after SQLite version assert (≥3.35), and now backfills `timezone='America/New_York'` at line 60. `setSelection` (227-232) writes `team = ?`. `teams.slug` probe at 147-154. |
| `scripts/backup-pre-05.mjs` | Pre-migration backup script | VERIFIED | File exists (2570 bytes); SUMMARY documents the better-sqlite3 `db.backup(DST)` online-backup pattern with refuse-overwrite semantics. |
| `scripts/backfill-team-slugs.mjs` | One-shot backfill for teams.slug | VERIFIED | File exists (4421 bytes); dry-run-by-default per the launch-blast pattern. |
| `scripts/send-kickoff-notifications.mjs` | Cron usersQuery rewritten to JOIN teams.slug | VERIFIED | `usersQuery` at lines 91-105 uses `JOIN teams t ON v.team = t.slug ... AND v.team IS NOT NULL AND t.id IN (?, ?)`; `KICKOFF_NOTIFICATIONS_ENABLED` gate byte-identical at line 33. Zero `json_each` / `selected_teams` references. |
| `src/pages/schedule.astro` | Reads user.team; renders empty state on NULL | VERIFIED | Lines 37-40 do `SELECT id FROM teams WHERE slug = ?` and populate `selectedIds = [row.id]` only if the slug resolves. NULL team → empty `selectedIds` → empty matches list. Zero `selected_teams` references. |
| `src/pages/api/save-selection.ts` | Writes single team slug via setSelection | VERIFIED | Lines 53-68 resolve first valid `team_ids[]` → `teams.slug` → `setSelection.get(teamSlug, tz, email)`. Zero `selected_teams` / `JSON.stringify(unique)` references. |
| `scripts/smoke-signup.mjs` | 8-case smoke (AC2 static + 7 HTTP cases) | VERIFIED | File exists (9596 bytes, 320 lines); orchestrator's smoke run reports 8/8 PASS (`[smoke] result: pass=8 fail=0`) with explicit AC2/AC9/AC12 tag lines. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `src/lib/teams.ts` | `references/teams.json` | `import teams from '../../references/teams.json' with { type: 'json' }` | WIRED | Line 1 import; `VALID_TEAMS = new Set(TEAMS.map(t => t.slug))` line 10. |
| `src/pages/api/signup.ts` | `src/lib/teams.ts` + `src/lib/timezones.ts` | named imports + `VALID_TEAMS.has()` / `VALID_TZ.has()` | WIRED | Lines 6-7 imports; lines 77 + 85 Set.has() lookups. |
| `src/pages/api/signup.ts` | `vip_signups` SQLite table | `upsertVipSignup.get(..., rawTeam, tz)` | WIRED | Line 93-100 6-arg call; matches the 6-param prepared-statement generic at db.ts:77-78. |
| `scripts/send-kickoff-notifications.mjs` | `vip_signups.team` + `teams.slug` | `JOIN teams t ON v.team = t.slug WHERE t.id IN (?, ?)` | WIRED | Lines 91-105; argv unchanged (home_id, away_id, match_id). |
| `src/pages/schedule.astro` | `user.team` + `teams.id` | `SELECT id FROM teams WHERE slug = ?` | WIRED | Lines 37-40; resolves to `selectedIds: number[]`; downstream match query at 42-57 unchanged. |
| `src/pages/api/save-selection.ts` | `setSelection.get(slug, tz, email)` | named import + slug resolution loop | WIRED | Line 2 imports `db, setSelection, insertFeatureRequest`; lines 60-64 resolve team_id → slug; line 74 calls `setSelection.get(teamSlug, tz, result.email)`. |
| `src/lib/db.ts` (migration) | `vip_signups` SQLite table | `ALTER TABLE vip_signups ADD COLUMN team` + `DROP COLUMN selected_teams` + `UPDATE ... SET timezone='America/New_York' WHERE timezone IS NULL` | WIRED | Lines 38-61; version assert at 44-52 (`SQLite ${v} too old; need >= 3.35`); idempotent via `pragma_table_info` probe + WHERE-clause guard on the backfill. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `src/lib/teams.ts` | `VALID_TEAMS` | `references/teams.json` (48-entry committed array) | YES (48 slugs, FORM-02 verified) | FLOWING |
| `src/lib/timezones.ts` | `VALID_TZ` | `Intl.supportedValuesOf('timeZone')` at module load | YES (418 zones on Node 22, includes America/New_York, Europe/London, Africa/Lagos; excludes `Foo/Bar`) | FLOWING |
| `src/pages/api/signup.ts` | persisted row | `upsertVipSignup.get(...)` with form-parsed values | YES (smoke case 1 confirms `team='england', timezone='Europe/London', requested_sport='world_cup'` round-trip) | FLOWING |
| `scripts/send-kickoff-notifications.mjs` | user list per match | `usersQuery.all(home_id, away_id, match_id)` JOIN on teams.slug | YES (dry-run smoke confirms query parses + executes; cron-output assertion `[notify] mode=dry-run matches-in-window=0` exit 0 per 05-05-SUMMARY) | FLOWING |
| `src/pages/schedule.astro` | `selectedIds: number[]` | `db.prepare('SELECT id FROM teams WHERE slug = ?').get(user.team)` | YES when slug exists; correctly EMPTY when team=NULL | FLOWING |
| `src/lib/db.ts` (migration) | pre-existing row's `timezone` | `UPDATE vip_signups SET timezone = 'America/New_York' WHERE timezone IS NULL` | YES — runtime-tested on `/tmp/migration-test.db`: NULL → `'America/New_York'` after boot | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| `references/teams.json` parses + has 48 entries with FORM-02 slugs | `node -e "JSON.parse(...).length === 48; required-slugs Set.has()"` | length=48; all 10 required slugs present | PASS |
| `FALLBACK_TZ` literal in `src/lib/timezones.ts` is `America/New_York` | `grep FALLBACK_TZ` | `FALLBACK_TZ = 'America/New_York' as const;` | PASS |
| `Intl.supportedValuesOf('timeZone')` runtime sanity | `node -e "Intl.supportedValuesOf('timeZone').length"` | 418 zones; includes America/New_York, Europe/London, Africa/Lagos; excludes Foo/Bar | PASS |
| Migration backfills NULL timezone to `America/New_York` | seeded `/tmp/migration-test.db` with pre-migration row → boot under Phase 5 code → SELECT timezone WHERE id=<seeded> | `'America/New_York'` (was NULL pre-boot) | PASS |
| All Phase-5 `.mjs` scripts parse | `node --check` × 5 files | OK1..5 | PASS |
| `npx astro check` reports only baseline TS errors | `npx astro check` | 19 errors, all pre-existing baseline (missing @types/node + @types/better-sqlite3) in src/lib/* — none in any plan-05 file | PASS |
| Zero `selected_teams` / `json_each` references in live code | `grep -rn` | Only remaining hits are the DROP COLUMN line + heritage comments in src/lib/db.ts (intentional per Plan 05-03/05) and a comment in scripts/backup-pre-05.mjs | PASS |
| ROADMAP.md `America/Detroit` only appears in non-default contexts | `grep -n America/Detroit\|Detroit time` `.planning/ROADMAP.md` | 3 hits — line 48 plan-title meta-ref, line 76 Phase 6 SC JS-label example, line 152 Phase 10 email-body example. Zero hits in Phase 5 SCs or Phase 9 SCs. | PASS |
| End-to-end smoke (8 cases) | `scripts/smoke-signup.mjs` (executed by orchestrator) | `result: pass=8 fail=0` per 05-06-SUMMARY; AC2, AC9, AC12 evidence tags inline | PASS |

### Probe Execution

Not applicable — this phase declares no `scripts/*/tests/probe-*.sh` files. The smoke script (`scripts/smoke-signup.mjs`) is the equivalent verification artifact; the orchestrator already ran it end-to-end with 8/8 PASS (citation: `.planning/phases/05-schema-signup-payload/05-06-SUMMARY.md` lines 81-93).

### Requirements Coverage

ROADMAP Phase 5 requirements: SIGNUP-01, SIGNUP-02, SIGNUP-03, COMPAT-01, COMPAT-02.

| Requirement | Source Plan(s) | Description | Status | Evidence |
| ----------- | -------------- | ----------- | ------ | -------- |
| SIGNUP-01 | 05-02, 05-04, 05-06 | `/api/signup` accepts team; validates against 48-team allow-list; rejects with `?error=bad-form` when missing/empty/unknown | SATISFIED | `src/pages/api/signup.ts:76-80` validates against `VALID_TEAMS.has(rawTeam)`, rejects with `back('bad-form')`. Smoke case 3 PASS (`AC9-invalid-team`). |
| SIGNUP-02 | 05-04, 05-06 | `/api/signup` accepts timezone; validates against IANA allow-list; falls back to America/New_York on invalid/empty (does NOT reject) | SATISFIED | `src/pages/api/signup.ts:82-90` falls back to `FALLBACK_TZ='America/New_York'` and logs tz-fallback; does NOT reject. Smoke cases 4+5 PASS. **Note**: the "flag for later IP-based correction" is implemented as the log line per D-02 (no DB column, by design); document this explicitly. |
| SIGNUP-03 | 05-03, 05-04, 05-05, 05-06 | team + timezone persist on the subscriber record; honeypot/rate-limit/Origin/email-format unchanged | SATISFIED | `src/lib/db.ts:77-89` `upsertVipSignup` writes both columns; smoke case 1 confirms round-trip. Pre-flight chain in `src/pages/api/signup.ts:46-73` is byte-identical to pre-plan code. |
| COMPAT-01 | 05-01, 05-02, 05-03, 05-05, 05-06 | Pre-milestone subscribers don't break /manage or kickoff cron; backfill `team=NULL, timezone='America/New_York'`; one-time banner on /manage | SATISFIED | (a) /schedule renders the empty state when team=NULL ✓ (b) kickoff cron filters `v.team IS NOT NULL` ✓ (c) `team=NULL` backfill ✓ (column added without default) (d) `timezone='America/New_York'` backfill ✓ — `src/lib/db.ts:60` `UPDATE vip_signups SET timezone = 'America/New_York' WHERE timezone IS NULL`, runtime-tested on `/tmp/migration-test.db`. (e) /manage one-time banner is Phase 9's scope per ROADMAP. |
| COMPAT-02 | 05-04, 05-06 | No new error codes; bad-team and bad-timezone reuse `bad-form` (server-side log distinguishes); error-code contract unchanged | SATISFIED | `src/pages/api/signup.ts:79` returns `back('bad-form')` (existing code); tz-fallback path does NOT return an error. Two distinct log lines (`[signup] bad-team rejected` vs `[signup] tz-fallback`). Smoke server-log evidence in 05-06-SUMMARY confirms both line shapes. |

**No orphaned requirements.** ROADMAP/REQUIREMENTS map exactly 5 requirements to Phase 5; all 5 are declared in at least one plan's `requirements:` frontmatter; no v2.0 requirement maps to Phase 5 that is not declared in a plan.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `src/pages/schedule.astro` | 182 | UI fallback string `'TBD'` (matches debt-marker grep but is a "To Be Determined" team-label placeholder for matches whose teams aren't set yet — pre-existing pre-Phase-5, used as a display fallback when `m.home_tla` is null) | Info | Not a code-debt marker; not introduced by Phase 5. No action required. |

No `TODO`, `FIXME`, `XXX`, `HACK`, `PLACEHOLDER`, "not yet implemented", or "coming soon" markers in any Phase-5-modified file.

Note: 05-REVIEW.md catalogs 5 WARNINGs (WR-01 through WR-05) and 5 INFOs from a `/review` pass. None are blockers; they're follow-up items (HTML-escape feed names in cron email, XFF spoofing surface, per-iteration DB SELECT in save-selection, shape validation on football-data and teams.json reads, etc.). Review classified the phase as "No Critical findings" — these are deferred to Phase 6+ / v1.1 polish per the review's narrative.

### Human Verification Required

None. The smoke script exercises every observable behavior the phase goal requires:
- SC1 valid path (case 1)
- SC2 bad-team rejection (cases 2, 3)
- SC3 tz fallback (cases 4, 5)
- SC4 backfill — runtime-tested end-to-end on `/tmp/migration-test.db` (re-verification evidence)
- SC5 honeypot + rate-limit preservation (cases 6, 7)
- AC2 backend portion (48 entries + FORM-02 slugs)
- AC9 invalid-team evidence tag
- AC12 honeypot evidence tag

The two human-needed surfaces mentioned in MILESTONE.md (AC3 Playwright across three locales, AC11 Plausible `Signup Submit` event) are explicitly deferred to Phase 6/11 per CONTEXT D-07 and are out of scope here.

### Gaps Summary

No outstanding gaps. Both prior gaps closed; the phase **code behavior** (the observable phase goal) is correct end-to-end per the orchestrator's 8/8 smoke run, the static code/grep evidence, and the migration backfill runtime test.

### Resolved Gaps (from initial 2026-05-13 pass)

**Resolved — Gap 1: SC4 / COMPAT-01 timezone backfill missing.**
Fix: `src/lib/db.ts` lines 57-60 now contain
`db.exec(\`UPDATE vip_signups SET timezone = 'America/New_York' WHERE timezone IS NULL;\`);`
with a why-comment explaining the COMPAT-01 contract. Idempotent
(WHERE-clause guard). Runtime-verified on `/tmp/migration-test.db`: pre-migration
row seeded with `timezone=NULL` ends up with `timezone='America/New_York'`
after boot under the new code.

**Resolved — Gap 2: Plan 05-01 docs sweep incomplete on ROADMAP.md.**
Fix: ROADMAP.md line 41 now reads `falls back to America/New_York` (Phase 5
SC #3), line 42 reads `timezone='America/New_York'` (Phase 5 SC #4), and
line 136 reads `timezone='America/New_York'` (Phase 9 SC #2). Remaining
`Detroit` strings in ROADMAP.md (lines 48, 76, 152) are intentional
non-default UI/meta contexts and not part of the COMPAT-01 contract.

---

_Verified: 2026-05-13_
_Re-verified: 2026-05-13 (gap-closure pass)_
_Verifier: Claude (gsd-verifier)_
