---
gsd_state_version: 1.0
milestone: v2.1
milestone_name: Referral & Social Sharing
status: planning
stopped_at: Phase 13 context gathered
last_updated: "2026-05-22T20:24:47.093Z"
last_activity: 2026-05-22 — v2.1 roadmap written (Phases 13–15, coarse granularity, 9/9 requirements mapped)
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-22, started milestone v2.1)

**Core value:** A user picks their team and gets a kickoff notification in their local time, on time, before group stage 2026-06-11.
**Current focus:** v2.1 Referral & Social Sharing — add a referral/share loop on top of the v2.0 consumer landing. Hard target 2026-06-11, runway shared with four pre-launch operator actions.

## Current Position

Phase: 13 — Referral Code & Attribution
Plan: — (not yet planned)
Status: Roadmap created — ready to plan Phase 13
Last activity: 2026-05-22 — v2.1 roadmap written (Phases 13–15, coarse granularity, 9/9 requirements mapped)

Next: `/gsd:plan-phase 13`

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
- 2026-05-22: v2.1 roadmap written. Phases 13–15 (3 phases, coarse granularity), continuing numbering from v2.0's Phase 12. All 9 v2.1 REQ-IDs (REF-01..03, SHARE-01..04, OG-02..03) mapped to exactly one phase. v1/v2.0 phases preserved in ROADMAP.md `<details>` blocks. Phase 13 = referral code + attribution plumbing (foundation); Phase 14 = share UI + email (depends on code existing); Phase 15 = per-team OG images + server-rendered referral route (long pole, first scope-trim candidate — fallback is personalized text over the generic `/og-image.png`).

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- v2.0 consumer pivot — strip BTC/Lightning/"world domination"/"personal Olympics" from public surfaces, rewrite landing for casual soccer fans (2026-05-12). Backend, ESP, infra untouched except additive `team`/`timezone` columns on signup payload.
- Single-team selection at intake (multi-team retained on `/manage` for returning users) — one decision per field for cold-traffic conversion.
- No CAPTCHA in v2.0 — rely on existing honeypot + Origin check + rate limit; revisit only if real attack pattern emerges.
- Phase numbering continues from v2.0 (last phase = 12) — v2.1 runs Phases 13–15.
- v2.1: a referral code is a public short identifier, NOT a signed HMAC token — do not over-engineer it onto the existing `purpose`-claimed token system.
- v2.1: attribution stays lightweight — a `referred_by` column + `?ref=` param, no rewards/leaderboard. A full referral program is explicitly out of scope.
- v2.1 OG (Phase 15) reuses the resvg render toolchain + fonts vendored in v2.0 Phase 8; per-team images pre-render at build time. Phase 15 is the milestone's long pole and first scope-trim candidate.

### Pending Todos

None yet.

### Blockers/Concerns

- Hard milestone deadline: **2026-06-11** (20 days from 2026-05-22 start). v2.1 shares this runway with four pre-launch operator actions (see Operator Next Steps).
- Architecture crux for OG-03: landing page `/` is `prerender = true` (static, CDN-cached) — a per-referrer OG image needs a server-rendered share/referral route (e.g. `/r/CODE`). Resolved as Phase 15 work; called out in the Phase 15 goal so it is not a silent surprise.
- Phase 15 (per-team OG images, ~48 variants) is the long pole — if the runway tightens, trim to personalized text over the existing generic `/og-image.png`; the referral loop (Phases 13–14) still ships.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260511-ccx | Phase 2.5 SC4: demand-capture textarea on /schedule + feature_requests table | 2026-05-11 | 6129910 | [260511-ccx-implement-phase-2-5-success-criterion-4-](./quick/260511-ccx-implement-phase-2-5-success-criterion-4-/) |
| 260516-q33 | manage discoverability content and entry pass (sketches 001-B/002-B/003-B) | 2026-05-16 | eb67661 | [260516-q33-manage-discoverability-content-and-entry](./quick/260516-q33-manage-discoverability-content-and-entry/) |
| 260517-px5 | Harden football-data.org team-name→slug mapping; shared resolver + offline smoke + launch-gate NULL-slug AC | 2026-05-17 | 4684248 | [260517-px5-harden-football-data-org-team-name-to-sl](./quick/260517-px5-harden-football-data-org-team-name-to-sl/) |

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Security | Astro 6 / @astrojs/node 10 major upgrade (clears 2 moderate audit advisories: Server-Islands DoS/cache-poisoning, `define:vars` XSS) | Deferred to post-launch — **not exploitable here** (0 `server:defer`, 0 `define:vars` in `src/`); major migration vs. "no rewrites mid-deadline" 26 days from hard launch. See `.planning/notes/astro6-security-deferral.md` | 2026-05-16 |

## Session Continuity

Last session: 2026-05-22T20:24:47.082Z
Stopped at: Phase 13 context gathered
Resume file:
.planning/phases/13-referral-code-attribution/13-CONTEXT.md

## Operator Next Steps

Pre-launch operator actions before 2026-06-11 (launch blockers, not a milestone — share the v2.1 runway):

- Fire `scripts/launch-blast.mjs --send` (currently dry-run)
- Flip `KICKOFF_NOTIFICATIONS_ENABLED=true` + restart `oddlympics-notify.timer`
- End-to-end smoke one real kickoff notification
- Verify football-data.org name→slug mapping (kickoff-cron silent-loss risk)
