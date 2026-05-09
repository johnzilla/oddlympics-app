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

duration: ~10min
completed: 2026-05-09
status: PARTIAL — Tasks 1-3 (in-repo work) complete; Tasks 4-5 (B2 setup + restore drill) still pending operator action
---

# Phase 01 Plan 07: Backup Infrastructure (PARTIAL — in-repo work complete)

**HARDEN-05 Tasks 1-3 complete: backup units, bootstrap.sh extension, DEPLOY.md restore runbook all landed. Tasks 4-5 are operator-action: B2 bucket + scoped key + first run + restore drill on a scratch host.**

## Performance

- **Duration:** ~10 min total (Task 1: file creation; Tasks 2-3: bootstrap.sh + DEPLOY.md edits)
- **Tasks executed:** 3 of 5 (1, 2, 3 done; 4, 5 are operator-action checkpoints)
- **Files modified:** 2 (`deploy/bootstrap.sh`, `DEPLOY.md`)
- **Files created:** 4 (backup .service, .timer, .sh, .env.example)

## Accomplishments

### Task 1 — Four new deploy files
- `deploy/oddlympics-backup.service` — Type=oneshot, EnvironmentFile=/etc/oddlympics-backup.env, hardening flags cloned from oddlympics.service, ReadWritePaths scoped to /var/lib/oddlympics + /var/cache/oddlympics-backup.
- `deploy/oddlympics-backup.timer` — OnCalendar=*-*-* 03:00:00 UTC, Persistent=true, WantedBy=timers.target.
- `deploy/oddlympics-backup.sh` — `set -euo pipefail`, SQLite `.backup` snapshot, `PRAGMA integrity_check` gate, rclone copyto to B2, local 7-snapshot cache.
- `deploy/oddlympics-backup.env.example` — B2_ACCOUNT_ID / B2_APPLICATION_KEY / B2_BUCKET / RCLONE_REMOTE template.

### Task 2 — bootstrap.sh extension
- apt installs `rclone` and `sqlite3` alongside existing base packages.
- Creates `/var/cache/oddlympics-backup` (mode 750, oddlympics:oddlympics).
- Installs the three new systemd files into `/etc/systemd/system/` and copies `oddlympics-backup.sh` into `/opt/oddlympics/deploy/`.
- Idempotently creates `/etc/oddlympics-backup.env` from the example (mode 640, root:oddlympics) — preserves existing credentials on re-run.
- `systemctl enable oddlympics caddy oddlympics-backup.timer` and `systemctl start oddlympics-backup.timer`.
- Closing message updated to mention the new env file and verify-backup command.

### Task 3 — DEPLOY.md restore runbook
- New "Backups and restore" section between the existing Day 2 table and the v1 status section.
- Documents the timer schedule, retention policy (30d daily / 12w weekly), credential location + ownership model.
- Day 2 backup ops table (journal tail, manual trigger, list snapshots).
- Step-by-step "Restore from B2" with the sudo + env-load pattern, integrity check before swap, and ~2s downtime estimate.
- D-14 "Restore drill" section with the scratch-host verification procedure.
- Removed the deferred "DB backups to off-droplet storage" bullet from the v1-deferred list (HARDEN-05 ships in this plan).

## Task Commits

1. `786ecaf` feat(01-07): add backup service + timer + script + env example (HARDEN-05 task 1)
2. `7054e76` chore(01-07): extend bootstrap.sh for backup install (HARDEN-05 task 2)
3. `f26cbbc` docs(01-07): add Backups and restore runbook to DEPLOY.md (HARDEN-05 task 3)

## Pending Work — Required Before HARDEN-05 Closes

- **Task 4 (checkpoint):** B2 setup — create the B2 bucket, scoped application key, configure 30d/12w lifecycle rules, copy `oddlympics-backup.env.example` to `/etc/oddlympics-backup.env` with real credentials, run the first backup manually, confirm an upload succeeds. See DEPLOY.md "Backups and restore" + 01-07-PLAN.md Task 4 for exact commands.
- **Task 5 (checkpoint):** Restore drill — pull a snapshot back, run `sqlite3 .restore` against a scratch DB, verify row counts match prod. Procedure now documented in DEPLOY.md.

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
