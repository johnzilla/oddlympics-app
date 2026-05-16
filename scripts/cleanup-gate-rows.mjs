#!/usr/bin/env node
// Phase 11 — cleanup-gate-rows.mjs
// Deletes gate-test rows (D-04 +tag addresses) from vip_signups on the prod DB.
//
// SAFETY: defaults to dry-run. --confirm is required to actually delete.
//
//   node scripts/cleanup-gate-rows.mjs                    # dry-run, shows rows WOULD be deleted
//   node scripts/cleanup-gate-rows.mjs --confirm           # really delete
//
// Run AFTER the v1.0-consumer-landing tag is pushed (D-05 / D-07) so the
// verified rows still exist on the tagged state through any re-verify.
// Operator runs on the droplet:
//   ssh oddlympics 'cd /opt/oddlympics && node scripts/cleanup-gate-rows.mjs --confirm'
//
// Env: DATABASE_PATH (default ./data/oddlympics.db)
//
// The LIKE pattern below scopes the delete to D-04 +tag gate rows only
// (e.g. johnturner+ac4@gmail.com, johnturner+ac9@gmail.com, johnturner+ac12@gmail.com).
// The '+ac' infix is the safety lock — it CANNOT match real subscribers even if they
// use Gmail, because no real signup path generates '+ac' in the local part.

import Database from 'better-sqlite3';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const CONFIRM = args.includes('--confirm');

const DB_PATH = resolve(process.env.DATABASE_PATH ?? './data/oddlympics.db');

// Open writable — this script issues a DELETE.
const db = new Database(DB_PATH);

// D-04 LIKE pattern: matches every johnturner+acN@gmail.com gate row.
// The '+ac' infix scopes the delete to gate rows only — a bare domain-only
// pattern would over-match real John's-Gmail subscribers and is intentionally absent.
const PATTERN = '%+ac%@gmail.com';

const rows = db
  .prepare('SELECT email, confirmed_at, created_at FROM vip_signups WHERE email LIKE ?')
  .all(PATTERN);

console.log(`[cleanup] mode=${CONFIRM ? 'DELETE' : 'dry-run'} rows=${rows.length}`);

if (rows.length === 0) {
  console.log('[cleanup] nothing to do (idempotent — re-run is a no-op).');
  db.close();
  process.exit(0);
}

if (!CONFIRM) {
  console.log('[cleanup] would delete:');
  for (const row of rows) console.log(`  - ${row.email}`);
  console.log('\n[cleanup] dry-run complete. Re-run with --confirm to actually delete.');
  db.close();
  process.exit(0);
}

// Execute the prepared delete with a single bound parameter — no string interpolation.
const del = db.prepare('DELETE FROM vip_signups WHERE email LIKE ?');
const result = del.run(PATTERN);
console.log(`[cleanup] done. deleted=${result.changes}`);
db.close();
