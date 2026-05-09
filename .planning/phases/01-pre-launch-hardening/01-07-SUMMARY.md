---
phase: 01-pre-launch-hardening
plan: "07"
subsystem: deploy/ops
tags:
  - backup
  - systemd
  - rclone
  - backblaze-b2
  - partial

requires: []
provides:
  - "Backup service unit (oneshot, hardened)"
  - "Daily systemd timer (03:00 UTC)"
  - "Backup script with SQLite online-backup + integrity check + rclone B2 upload"
  - "Env example with B2 credential template"
affects: []

tech-stack:
  added:
    - rclone (system package — not yet installed via bootstrap.sh; pending Task 2)
    - backblaze-b2 (off-droplet backup destination)
  patterns:
    - "Hardened oneshot systemd unit cloned from oddlympics.service"
    - "Persistent=true daily timer for backups"
    - "Online SQLite backup via .backup command (handles WAL safely)"
    - "Pre-upload integrity check via PRAGMA integrity_check"
    - "rclone credentials via RCLONE_CONFIG_<remote>_<key> env vars (no rclone.conf on disk)"

key-files:
  created:
    - deploy/oddlympics-backup.service
    - deploy/oddlympics-backup.timer
    - deploy/oddlympics-backup.sh
    - deploy/oddlympics-backup.env.example
  modified: []

key-decisions:
  - "D-10: Backblaze B2 (cross-vendor isolation from DO)"
  - "D-11: systemd timer (next to existing oddlympics.service)"
  - "D-12: rclone with bucket-scoped B2 application key"
  - "D-13: 30 days daily + 12 weeks weekly via B2 lifecycle (config in B2 dashboard, not in unit)"
  - "D-15: separate /etc/oddlympics-backup.env so the app cannot read backup credentials"

patterns-established:
  - "Hardening block clone shape from oddlympics.service for new units"
  - "Service-script split: .service holds policy + env; .sh holds logic"

requirements-completed: []

requirements-partial:
  - HARDEN-05 (Task 1 only — service/timer/script/env-example landed; Tasks 2-3 + checkpoints 4-5 pending)

duration: 1min
completed: 2026-05-09
status: PARTIAL — Task 1 landed; Tasks 2, 3, 4, 5 still pending
---

# Phase 01 Plan 07: Backup Infrastructure (PARTIAL)

**HARDEN-05 Task 1 complete: deploy/oddlympics-backup.{service,timer,sh,env.example} now exist in repo. Tasks 2-5 still pending.**

## Performance

- **Duration:** ~1 min (file creation only — no commits during agent run)
- **Tasks executed:** 1 of 5
- **Files modified:** 0
- **Files created:** 4

## Accomplishments

- `deploy/oddlympics-backup.service` — Type=oneshot, EnvironmentFile=/etc/oddlympics-backup.env, hardening flags cloned from oddlympics.service, ReadWritePaths scoped to /var/lib/oddlympics + /var/cache/oddlympics-backup.
- `deploy/oddlympics-backup.timer` — OnCalendar=*-*-* 03:00:00 UTC, Persistent=true, WantedBy=timers.target.
- `deploy/oddlympics-backup.sh` — `set -euo pipefail`, SQLite `.backup` snapshot, `PRAGMA integrity_check` gate, rclone copyto to B2, local 7-snapshot cache.
- `deploy/oddlympics-backup.env.example` — B2_ACCOUNT_ID / B2_APPLICATION_KEY / B2_BUCKET / RCLONE_REMOTE template.

## Task Commits

1. `786ecaf` feat(01-07): add backup service + timer + script + env example (HARDEN-05 task 1)

## Pending Work — Required Before HARDEN-05 Closes

- **Task 2:** Extend `deploy/bootstrap.sh` to install `rclone`, copy/enable the new unit files, and create `/etc/oddlympics-backup.env` with mode 640 root:oddlympics. The bootstrap script currently does NOT know about the new units.
- **Task 3:** Add a "Backups and restore" section to `DEPLOY.md` documenting the day-to-day ops (timer status, log tail, restore procedure).
- **Task 4 (checkpoint):** B2 setup — create the B2 bucket, scoped application key, configure 30d/12w lifecycle rules, copy `oddlympics-backup.env.example` to `/etc/oddlympics-backup.env` with real credentials, run the first backup manually, confirm an upload succeeds.
- **Task 5 (checkpoint):** Restore drill — pull a snapshot back, run `sqlite3 .restore` against a scratch DB, verify row counts match the live DB. Record the procedure in DEPLOY.md.

## Decisions Made

- D-10..D-15 applied (see frontmatter `key-decisions`).

## Deviations from Plan

- Tasks 2 and 3 (auto, in-repo edits) were NOT done by the original executor agent. They are mechanical edits with concrete `<action>` blocks in `01-07-PLAN.md` and can be re-run via a fresh executor or completed manually.

## Recovery Note

The original executor agent created the four deploy files in its worktree but hit a session-level Bash permission wall before any commit (no `chmod +x` on the script, no `git add`, no commit). The orchestrator copied the four files from the worktree to main, set the script executable bit, and committed as `786ecaf`. Tasks 2-5 were not attempted by the agent and remain pending.

## Threat Surface

- Backup script runs as `oddlympics` (not root); ReadWritePaths confines write access.
- B2 application key is bucket-scoped (limits blast radius if leaked).
- `/etc/oddlympics-backup.env` is separate from `/etc/oddlympics.env` so the running app cannot read backup credentials (D-15).
- rclone credentials passed via env, not stored in `rclone.conf` on disk.

---

*Phase: 01-pre-launch-hardening*
*Status: PARTIAL — Tasks 2-5 of plan 01-07 pending re-execution*
*Updated: 2026-05-09*
