# Phase 2: Identity & Personal Schedule — SHIPPED (no GSD artifact)

This phase was shipped on `main` without going through the GSD discuss → plan → execute → verify workflow. No PLAN.md, no SUMMARY.md, no verification trail.

**Goal achieved:** A signed-up user can request a magic-link, pick the teams they follow, and see their personal schedule with all kickoffs in their browser's local time zone.

**Requirements delivered:** IDENT-01, IDENT-02, IDENT-03, IDENT-04, IDENT-05, DATA-01, DATA-02, DATA-04

**Implementation commits (most recent first):**

| Commit | Subject |
|--------|---------|
| `911b445` | feat(deploy): nightly schedule-refresh timer (DATA-02) |
| `381dfbb` | feat(phase-2): timezone manual override on /schedule (IDENT-05 polish) |
| `b361288` | feat(phase-2): cookie-based sessions, 30-day sliding window |
| `384a834` | feat(phase-2): add /schedule page + /api/save-selection (IDENT-02..05, DATA-04) |
| `756bef5` | feat(phase-2): add /manage flow (IDENT-01) |
| `2e4799c` | feat(phase-2): add 'manage' purpose claim + sendManageLink helper |
| `60631cb` | feat(phase-2): add selected_teams + timezone columns to vip_signups |
| `911abf8` | chore: rsync scripts/ to droplet so the ingestor is reachable in prod |
| `c010531` | feat(phase-2): add World Cup schedule ingestor (DATA-01, DATA-02) |
| `fa70514` | feat(phase-2): add teams + matches tables for World Cup schedule |
| `01c6269` | chore: document FOOTBALL_DATA_API_KEY env var (Phase 2 prep) |

**Why no GSD artifact:** Phase 1 had full planning artifacts (CONTEXT, DISCUSSION-LOG, per-plan PLAN/SUMMARY). Phases 2-3 prioritized shipping speed against the hard 2026-06-11 World Cup deadline; the planning overhead was traded for raw execution velocity. The roadmap's success criteria are the contract; the commits above are the proof.

**Verification:** Behavior is verified by the running production service at `oddlympics.app`. There is no formal test suite. Smoke testing is done by booting `npm run serve` locally and curling the endpoints.

This file exists to keep the `.planning/` tree internally consistent (the SDK's `/gsd-health` check emits W006 when a phase header in ROADMAP.md has no on-disk directory). It is not a substitute for a real SUMMARY.md.
