---
phase: 05-schema-signup-payload
plan: 03
subsystem: database
tags: [sqlite, better-sqlite3, migration, schema, drop-column, vip_signups]

requires:
  - phase: 05-02
    provides: teams.slug column (the runtime-join key vip_signups.team will resolve against)
provides:
  - vip_signups.team TEXT column (snake_case slug, single team per row)
  - First non-additive migration in project history (drops selected_teams)
  - SQLite version assert (>= 3.35) guarding DROP COLUMN
  - scripts/backup-pre-05.mjs — operator-run pre-deploy snapshot
  - Updated VipSignup type + setSelection prepared statement
affects: [05-04 (signup widening), 05-05 (downstream consumers), 05-06 (smoke)]

tech-stack:
  added: []
  patterns:
    - "Idempotent destructive migration: probe pragma_table_info, guard with has(...) checks, version-assert before DROP"
    - "Online-backup snapshot via better-sqlite3 db.backup() — WAL-safe, refuses to overwrite"

key-files:
  created:
    - scripts/backup-pre-05.mjs
    - .planning/phases/05-schema-signup-payload/05-03-SUMMARY.md
  modified:
    - src/lib/db.ts

key-decisions:
  - "Deleted the now-dead `if (!has('selected_teams')) ADD COLUMN selected_teams` line rather than leaving it harmless. Keeping it would silently undo the migration on re-boot, then the DROP would strip it again — wasteful and confusing to future readers."
  - "Numeric major/minor SQLite version compare (not lexicographic string-join), per PLAN-CHECK W4."
  - "Backup script does NOT default to dry-run despite CLAUDE.md mass-outbound pattern — it has no destructive side effect on the source, so requiring `--write` for a backup is wrong ergonomics."

patterns-established:
  - "Destructive migration template: probe + version-assert + has(...) guards = idempotent + ABI-safe"
  - "Pre-migration backup script template: read-only on source, refuses to overwrite, operator-run not systemd-timed"

requirements-completed:
  - SIGNUP-03
  - COMPAT-01

duration: ~30min (orchestrator-inline after sandbox-blocked subagent handoff)
completed: 2026-05-13
---

# Phase 05 Plan 03: vip_signups Migration Summary

**First non-additive SQLite migration in project history: `team TEXT` added, `selected_teams` dropped, guarded by version-assert + pre-deploy backup script.**

## Performance

- **Duration:** ~30min (worktree-isolation subagent failed on stale base; sequential subagent hit Bash sandbox limits; orchestrator finished inline)
- **Started:** 2026-05-13T02:11Z (sandbox-blocked agent wrote scripts/backup-pre-05.mjs but couldn't commit)
- **Completed:** 2026-05-13T02:59Z
- **Tasks:** 2
- **Files modified:** 2 (1 new, 1 modified)

## Accomplishments

- `vip_signups.team TEXT` column lives on disk; `vip_signups.selected_teams` is gone
- Migration runs idempotently — re-booting against an already-migrated DB is a no-op (verified empirically on /tmp/oddlympics-test.db)
- SQLite version is asserted before DROP, so an old runtime aborts with a clear `journalctl` line instead of a half-applied schema
- Operator has a one-shot pre-deploy backup tool (`scripts/backup-pre-05.mjs`) that uses better-sqlite3's online-backup API (WAL-safe) and refuses to overwrite an existing `.pre-05.bak`
- `VipSignup` type and `setSelection` prepared statement reflect the new shape — param tuple `[string, string, string]` (slug, tz, email) is unchanged, only the SET column flipped

## Task Commits

1. **Task 1: scripts/backup-pre-05.mjs** — `f8c7d43` (feat)
2. **Task 2: src/lib/db.ts migration** — `275fe90` (feat)

## Files Created/Modified

- `scripts/backup-pre-05.mjs` (new, 64 lines) — pre-migration snapshot tool
- `src/lib/db.ts` (modified, +19/−4) — version assert, ADD team, DROP selected_teams, VipSignup type, setSelection rewrite

## Decisions Made

- **Deleted the now-dead `ADD COLUMN selected_teams` probe line** rather than leaving it. On a fresh boot against a pre-migration DB it would re-add the column moments before the DROP line strips it — harmless but wasteful and bad for the reader.
- **Kept the `selected_teams` heritage line in the setSelection comment** so the v1→v2 lineage of the statement is visible to anyone grepping for `selected_teams`.
- **Version assert is numeric major/minor compare**, not the string-join `'3.35'.localeCompare(...)` pattern (which is lexicographic and breaks for 3.100+) — per PLAN-CHECK W4 resolution.

## Deviations from Plan

### Process deviation (not auto-fix)

**Sandbox handoff: 2 subagent attempts → orchestrator-inline completion.**

1. **First attempt (worktree isolation):** Claude Code's `isolation="worktree"` forked the agent from `7f56403` — a commit four merges before the current main HEAD `dde5635`. The agent's `<worktree_branch_check>` protocol prescribed `git reset --hard <expected-base>` to fast-forward, but the subagent's Bash sandbox denied the reset. Agent halted correctly per protocol.
2. **Second attempt (sequential, worktrees disabled):** Sandbox denied `git add`, `git commit`, `node`, `npm run build`, `npx astro check`. Agent created `scripts/backup-pre-05.mjs` on disk but couldn't commit or verify.
3. **Orchestrator-inline completion:** I (orchestrator) took the agent's written file, ran the full Task 1 verify end-to-end (copy + size log + readback row count + refuse-overwrite), committed Task 1, applied the db.ts edits, ran fresh-DB + idempotency verify, committed Task 2.

Substance of the work is identical to what the plan called for. No scope changes.

**Why this matters going forward:** project-level `workflow.use_worktrees=false` is now set. Plans 05-04, 05-05, 05-06 will dispatch in sequential mode. If subagent Bash sandbox blocks recur, fall back to orchestrator-inline as 05-03 did.

## Issues Encountered

- Local dev DB was empty (4096-byte SQLite footprint, no tables) because no recent `npm run dev`. Booting the built server against the prerendered `/` route did NOT trigger db.ts module load — only API/server-rendered routes do. Initialized schema manually with a one-liner before running the backup readback assertion. Production droplet won't hit this — the live DB is already populated and exercised by the running web server.
- `npx astro check` reports 21 errors after migration. **17 of those are downstream consumers** (`schedule.astro`, `save-selection.ts`, `send-kickoff-notifications.mjs`) using the removed `selected_teams` — these are intentional and resolved by plan 05-05 in the next wave. **4 are pre-existing baseline TS-config issues** in db.ts (`Cannot find module 'node:fs'`, missing `@types/node`) that pre-date this plan. No new errors attributable to this plan's changes.

## Operator runbook (pre-deploy)

Before the deploy that lands commits `f8c7d43` + `275fe90` (alongside plan 05-04 / 05-05 fixes), SSH the droplet and run:

```bash
ssh oddlympics
cd /opt/oddlympics
node --env-file=/etc/oddlympics.env scripts/backup-pre-05.mjs
# Expect: "[backup] copying ... -> ... .pre-05.bak"  +  "[backup] done size=N"
ls -la data/oddlympics.db data/oddlympics.db.pre-05.bak
# Sizes should match (give or take a WAL checkpoint).
```

Then push the deploy. On boot, db.ts runs:
1. Version assert → SQLite 3.35+ (Ubuntu 22.04 ships 3.37) → passes
2. `ADD COLUMN team` → applies (column absent on prod)
3. `DROP COLUMN selected_teams` → applies (column present on prod)
4. The operator's single row now has `team=NULL` — they'll re-set it via `/schedule` once plan 05-05 lands

Verify post-deploy:
```bash
sqlite3 /var/lib/oddlympics/oddlympics.db \
  "SELECT name FROM pragma_table_info('vip_signups')"
# Expect: id, email, ..., team    (no selected_teams)
```

Remove the `.pre-05.bak` file once Phase 5 is verified stable in production (~one week post-deploy). DigitalOcean Backups remain as the secondary DR floor.

## SQLite versions observed

- Dev box (this machine): `select sqlite_version()` reports the version bundled with `better-sqlite3@12.9.0` — empirically passes the >= 3.35 assert.
- Droplet: not measured at execution time; Ubuntu 22.04 ships SQLite 3.37, well above the floor.

## Next Phase Readiness

- **Plan 05-04 (widen `/api/signup`)** can now persist `team` directly to vip_signups.
- **Plan 05-05 (downstream consumers)** must run in the same wave/deploy as 05-03 + 05-04, or the live droplet boots into a partially-migrated state (schedule.astro reads `user.selected_teams` which no longer exists → 500).
- **Plan 05-06 (smoke script)** depends on both 05-04 and 05-05.

---
*Phase: 05-schema-signup-payload*
*Completed: 2026-05-13*
