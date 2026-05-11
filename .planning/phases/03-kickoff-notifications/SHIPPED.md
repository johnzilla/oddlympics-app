# Phase 3: Kickoff Notifications — SHIPPED (no GSD artifact, dry-run)

This phase was shipped on `main` without going through the GSD discuss → plan → execute → verify workflow. No PLAN.md, no SUMMARY.md, no verification trail.

**Goal achieved (code):** `scripts/send-kickoff-notifications.mjs` is in place, driven by `oddlympics-notify.timer` running every 5 minutes on the droplet. Idempotent — re-running won't double-send. The no-login schedule link in the email resolves to the user's full schedule without re-authenticating.

**Goal not yet achieved (operational):** The cron is currently in **dry-run mode**. It logs what it would send but does not actually email users. Flipping the env var `KICKOFF_NOTIFICATIONS_ENABLED=true` on the droplet (`/etc/oddlympics.env`) and restarting `oddlympics-notify.timer` activates real sends. That env-var flip is an outstanding operator action.

**Requirements delivered (code):** NOTIFY-01, NOTIFY-03, NOTIFY-04

**Implementation commit:**

| Commit | Subject |
|--------|---------|
| `f276c59` | feat(phase-3): kickoff notification cron (NOTIFY-01, 03, 04) |

**Why no GSD artifact:** Phase 1 had full planning artifacts (CONTEXT, DISCUSSION-LOG, per-plan PLAN/SUMMARY). Phases 2-3 prioritized shipping speed against the hard 2026-06-11 World Cup deadline; the planning overhead was traded for raw execution velocity. The roadmap's success criteria are the contract; the commit above is the proof.

**Verification:** Dry-run logs go to journald (`journalctl -u oddlympics-notify -f`) and show the prepared notifications without sending. Real verification is the explicit goal of Phase 4 (Launch Week Observation) — that's the first weekend of group stage and the first time these notifications fire for real users.

This file exists to keep the `.planning/` tree internally consistent (the SDK's `/gsd-health` check emits W006 when a phase header in ROADMAP.md has no on-disk directory). It is not a substitute for a real SUMMARY.md.
