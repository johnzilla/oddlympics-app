#!/usr/bin/env node
// Phase 5 — Plan 03.
// Pre-Phase-5 migration backup. Snapshots the live SQLite file to a sibling
// `.pre-05.bak` immediately before the destructive vip_signups migration
// (ADD COLUMN team / DROP COLUMN selected_teams) lands on the droplet. The
// migration is the first non-additive change in the project's history —
// every prior migration only added columns. This script is the operator's
// safety net before that one-row, one-shot drop.
//
// When to run: BEFORE any deploy containing the Phase 5 vip_signups
// migration. Operator runs once on the droplet:
//
//   ssh oddlympics 'cd /opt/oddlympics &&
//     node --env-file=/etc/oddlympics.env scripts/backup-pre-05.mjs'
//
// SAFETY: this script is READ-ONLY on the source DB (uses better-sqlite3's
// online-backup API, WAL-safe, won't tear). It does NOT default to dry-run
// the way mass-outbound scripts do (launch-blast, send-kickoff-notifications)
// because there is no destructive side effect on the source — it only writes
// a new file alongside it. Defaulting to dry-run would force the operator to
// pass `--write` for a backup, which is the wrong ergonomics.
//
// Idempotency: refuses to overwrite an existing `.pre-05.bak` file. If a
// backup already exists, the operator must move/rename/delete it explicitly
// before re-running. Prevents an accidental second run from clobbering the
// "good" pre-migration snapshot with a post-migration one.
//
// Env: DATABASE_PATH (default ./data/oddlympics.db).
//
// Removal: once Phase 5 is verified stable in production (~one week after
// deploy), the operator may delete the `.pre-05.bak` file. DigitalOcean
// Backups remain as the secondary DR floor (HARDEN-05 replacement, enabled
// 2026-05-10).
//
// Exit code: 0 on success; 1 if the backup file already exists or any
// runtime error occurred.

import Database from 'better-sqlite3';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = resolve(process.env.DATABASE_PATH ?? './data/oddlympics.db');
const DST = SRC + '.pre-05.bak';

if (existsSync(DST)) {
  console.error(
    `[backup] refusing to overwrite existing ${DST} — remove or rename it first`,
  );
  process.exit(1);
}

console.log(`[backup] copying ${SRC} -> ${DST}`);

const db = new Database(SRC, { readonly: true });
try {
  await db.backup(DST);
  const { size } = statSync(DST);
  console.log(`[backup] done size=${size}`);
} catch (err) {
  console.error(`[backup] FAILED ${err.message ?? err}`);
  db.close();
  process.exit(1);
}
db.close();
