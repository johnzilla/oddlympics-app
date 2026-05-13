---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Consumer Landing & Signup Flow
status: executing
stopped_at: Phase 06 Plan 01 complete; ready to execute Plan 02 (inline JS — tz-label swap + ?error= swap + Plausible Signup Submit listener)
last_updated: "2026-05-13T23:43:33.668Z"
last_activity: 2026-05-13
progress:
  total_phases: 7
  completed_phases: 1
  total_plans: 9
  completed_plans: 7
  percent: 78
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-12)

**Core value:** A user picks their team and gets a kickoff notification in their local time, on time, before group stage 2026-06-11.
**Current focus:** Phase 06 — landing-page-form-meta-analytics

## Current Position

Phase: 06 (landing-page-form-meta-analytics) — EXECUTING
Plan: 2 of 3
Status: Ready to execute
Last activity: 2026-05-13

Progress: [████████░░] 78%

## Performance Metrics

**Velocity:**

- Total plans completed: 6
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 05 | 6 | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 06 P01 | 5min | 1 tasks | 1 files |

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

### Pending Todos

None yet.

### Blockers/Concerns

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

Last session: 2026-05-13T23:43:33.663Z
Stopped at: Phase 06 Plan 01 complete; ready to execute Plan 02 (inline JS — tz-label swap + ?error= swap + Plausible Signup Submit listener)
Resume file: .planning/phases/06-landing-page-form-meta-analytics/06-02-PLAN.md
