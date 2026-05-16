---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Consumer Landing & Signup Flow
status: shipped
stopped_at: "SHIPPED 2026-05-16. v1.0-consumer-landing tag (annotated, on deployed commit 4be057e) cut + pushed to origin. App live at https://oddlympics.app (HTTP 200). Core automated launch gate run directly against live prod: AC1/AC2/AC5/AC7/AC9/AC12 all PASS (6/6); multi-team /manage covered by Phase 12 (11/11). Deferred as non-blocking for a free signup app: AC4 real-inbox email timing, AC11 Plausible event, AC8 Lighthouse, AC3 tz-spoof, opengraph.xyz preview, and the +ac gate-row prod cleanup (optional one-liner: node scripts/cleanup-gate-rows.mjs --confirm on the droplet). The elaborate Phase-11 operator re-gate ceremony was dropped by explicit owner decision — product was already live and Phase 12 had verified multi-team."
last_updated: "2026-05-16T14:30:00.000Z"
last_activity: 2026-05-16 -- v1.0-consumer-landing tagged + pushed; SHIPPED
progress:
  total_phases: 8
  completed_phases: 7
  total_plans: 32
  completed_plans: 30
  percent: 88
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-12)

**Core value:** A user picks their team and gets a kickoff notification in their local time, on time, before group stage 2026-06-11.
**Current focus:** Phase 11 — end-to-end-launch-gate

## Current Position

Phase: 11 (end-to-end-launch-gate) — EXECUTING
Plan: 1 of 6
Status: Executing Phase 11
Last activity: 2026-05-16 -- Phase 11 execution started

Progress: [██████████] 97%

## Performance Metrics

**Velocity:**

- Total plans completed: 20
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 05 | 6 | - | - |
| 06 | 3 | - | - |
| 07 | 2 | - | - |
| 10 | 3 | - | - |
| 12 | 6 | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 06 P01 | 5min | 1 tasks | 1 files |
| Phase 06 P02 | 2min | 1 tasks | 1 files |
| Phase 06 P06-03 | ~25min | 3 tasks | 8 files |
| Phase 07 P07-01 | 6min | 2 tasks | 1 files |
| Phase 07 P02 | ~2 min | 1 tasks | 1 files |
| Phase 08-open-graph-image P01 | 198 | 4 tasks | 8 files |
| Phase 09-manage-editor-unsubscribe P01 | 120 | 1 tasks | 1 files |
| Phase 09 P02 | 1m 24s | 2 tasks | 2 files |
| Phase 09 P03 | 63s | 1 tasks | 1 files |
| Phase 10 P01 | 6min | 3 tasks | 4 files |
| Phase 10 P10-02 | 12 minutes | 2 tasks | 2 files |
| Phase 11 P01 | 5min | 1 tasks | 1 files |
| Phase 12-restore-multi-team-selection P02 | 345 | 2 tasks | 2 files |
| Phase 12-restore-multi-team-selection P04 | 15min | 3 tasks | 1 files |
| Phase 12-restore-multi-team-selection P05 | 18min | 3 tasks | 4 files |
| Phase 12 P06 | 4min | 2 tasks | 1 files |

## Accumulated Context

### Roadmap Evolution

- Phase 2.5 edited: added success criterion 4: optional 'which other championship' demand-capture field on team-picker page
- Phase 4 added: Launch Week Observation — post-launch checkpoint for first weekend of World Cup group stage (2026-06-11 through 2026-06-14)
- 2026-05-13: v2.0 roadmap written. Phases 5–11 (7 phases, coarse granularity). All 20 v2.0 REQ-IDs mapped to exactly one phase. v1 phases 1–4 preserved under `.planning/phases/` and summarized in ROADMAP.md "Previous milestones".

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- v2.0 consumer pivot — strip BTC/Lightning/"world domination"/"personal Olympics" from public surfaces, rewrite landing for casual soccer fans (2026-05-12). Backend, ESP, infra untouched except additive `team`/`timezone` columns on signup payload.
- Single-team selection at intake (multi-team retained on `/schedule` for returning users) — one decision per field for cold-traffic conversion.
- No CAPTCHA in v2.0 — rely on existing honeypot + Origin check + rate limit; revisit only if real attack pattern emerges.
- Phase numbering continues from v1 MVP (last phase = 4) — new milestone runs phases 5–11. v1 phase dirs preserved under `.planning/phases/` for traceability.
- [Phase ?]: Phase 6 Plan 1: Hardcoded https://oddlympics.app/* meta-tag URLs (not Astro.site) per CONTEXT D-08 — canonical-copy precedent outranks DRY when copy doc is URL source of truth.
- [Phase ?]: Phase 6 Plan 1: Empty-host-element cross-plan DOM contract pattern — Plan 01 ships <span id=tz-label>fallback</span> + <input id=timezone value=''> + <p id=error hidden> for Plan 02 inline JS targets. Page remains JS-off readable.
- [Phase ?]: Phase 6 Plan 1: ASCII apostrophe (0x27) throughout body copy — canonical sources + AC grep -F strings use ASCII; plan prose mention of curly U+2019 was inconsistent. Followed canonical sources (Rule 1 deviation).
- [Phase ?]: Phase 6 Plan 2: Three-concern try-isolated inline <script is:inline> block pattern — single block holding tz capture + URL-param swap + analytics event, each concern in its own try{}catch{} so one exception does not block the others. Adopt for any future page with >1 inline-script concern.
- [Phase ?]: Phase 6 Plan 2: ASCII apostrophe (0x27) in COPY map 'email' key matches v1 source bytes + AC grep -F search bytes + Plan 01 precedent — plan AC parenthetical mention of curly U+2019 was inconsistent with its own grep -F search string. Rule 1 deviation (same class as Plan 01 deviation 1).
- [Phase ?]: Phase 6 Plan 2: Fire-and-forget Plausible submit listener — no preventDefault, relies on pa-*.js sendBeacon path for unload-safe transmission (D-09). Phase 11 AC11 verifies dashboard side; if drop rate is unacceptable, swap to preventDefault + setTimeout(form.submit, 0) per RESEARCH §Pitfall 1.
- [Phase ?]: Phase 6 Plan 3: Automated all three plan Task-3 checkpoint:human-verify items (3-zone tz spoof + 3-viewport visual + ?error=bad-email render) using puppeteer-core driving chrome-headless-shell — the underlying behaviors are byte-exactly observable in headless Chrome with no human judgement, and committing the Lighthouse JSON + 3 viewport screenshots gives a richer audit trail than a yes/no checkpoint reply.
- [Phase ?]: Phase 6 Plan 3: Headless-Chrome-without-system-Chrome on macOS dev — `npx @puppeteer/browsers install chrome-headless-shell@stable` lands a self-contained 90MB binary into ./chrome-headless-shell/ (gitignored), pointed at via CHROME_PATH= for npx lighthouse and via executablePath for puppeteer-core. Eliminates the 'no system Chrome' blocker for Lighthouse + DOM verification entirely. Pattern applies to any future phase needing browser-driven verification.
- [Phase ?]: Phase 6 Plan 3: Lighthouse mobile Perf 1.00 / A11y 0.94 / BP 1.00 / SEO 1.00 (all >= 0.9 → LAND-03 soft gate PASS). Two color-contrast audit hits held a11y at 0.94: banner pill (3.6:1) and submit button (4.24:1) — both serious-impact WCAG AA. Documented as Phase 11 AC8 hard-gate follow-up; cheapest fix is deepening #d94a1f to #b8350d (banner) and #c43d15 (button) to push contrast to ≥ 4.5:1.
- [Phase ?]: Phase 7 Plan 1: Rendered '**Bold heading:**' as <h2> in privacy.astro (per PATTERNS 5e + CONTEXT discretion bullet 2 — more semantic). Plan 02 (terms.astro) MUST use the same <h2> choice for cross-page consistency.
- [Phase 07]: Phase 7 Plan 2: Rendered numbered terms clauses as <ol> with each <li> opening with <strong> (NOT <h2>) — the bold labels in references/terms.md are inline labels inside list items, not section breaks. Plan 01 <h2> precedent applies to section-style **Bold heading:** patterns; the terms doc structure differs (numbered clauses) and the plan action explicitly directed <strong>.
- [Phase ?]: WHERE clause now OR-matches unsubscribed_at IS NOT NULL; SET clears it to restore active row
- [Phase ?]: Consolidated manage link destination from /schedule to /manage; in-flight links handled via Plan 09-03 301 redirect within 24h TTL window
- [Phase 10]: 10-02: Smoke re-implements teamLabel + tzLabel + composeBody inline (drift-detection via byte-exact shadow), mirrors smoke-manage.mjs:58-74 pattern
- [Phase 10]: 10-02: Case 6 asserts Curaçao diacritic verbatim — slug=curacao, label=Curaçao in references/teams.json:30, no ASCII fallback at runtime
- [Phase 10]: 10-02: smoke:confirm inserted alphabetically before smoke:landing in package.json (smoke:confirm < smoke:landing < smoke:manage)
- [Phase ?]: D-02 executed: color-only commit to index.astro — banner #b8350d + button #c43d15, both clearing WCAG-AA >=4.5:1; direct background override on submit-button (no new CSS token) per Phase-6 minimal-surface structure-lock
- [Phase ?]: D-07 verify-only confirmed: email.ts unchanged, single-team copy correct
- [Phase ?]: Phase 12 smoke M1-M14 green pass=15 fail=0, multi-team restored end-to-end

### Pending Todos

None yet.

### Blockers/Concerns

- **v2.0 NOT shippable yet:** Phase 12 (multi-team) is done, but the Phase 11 launch gate must RE-RUN after Phase 12 per locked decision D-09 — it must re-verify AC2/AC3-class behavior PLUS the new multi-team behavior, then cut the deliberately-withheld `v1.0-consumer-landing` tag. The original multi-team blocker (founder rejected single-team v2.0) is RESOLVED; the live gate is now the Phase 11 re-run + tag.
- Hard milestone deadline: **2026-05-19** (7 days from 2026-05-12). Must complete before v1 MVP launch on 2026-06-11.
- Pending operator actions inherited from v1 MVP (must complete before launch but independent of v2.0 work): fire `scripts/launch-blast.mjs --send`, flip `KICKOFF_NOTIFICATIONS_ENABLED=true` on droplet.
- Reference assets called out in MILESTONE doc (`references/index.html`, `og-image.svg`, copy md) do not exist in repo yet — execution phases must create them.
- SVG → PNG rendering toolchain not present in CI; Phase 8 may need to install `rsvg-convert` or commit a pre-rendered PNG.
- Plausible custom goal `Signup Submit` must be configured server-side before form ships or events drop silently.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260511-ccx | Phase 2.5 SC4: demand-capture textarea on /schedule + feature_requests table | 2026-05-11 | 6129910 | [260511-ccx-implement-phase-2-5-success-criterion-4-](./quick/260511-ccx-implement-phase-2-5-success-criterion-4-/) |

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-05-16T14:00:00.000Z
Stopped at: 11-06 Task 1 DONE (4e74e54) — AC-MT added to launch-gate.mjs. Awaiting operator at Task 2 blocking-human checkpoint (deploy + gate run + operator evidence for AC4/AC10/AC11/AC-MT/OG).
Resume file: 
None
