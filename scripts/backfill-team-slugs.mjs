#!/usr/bin/env node
// Phase 5 — Plan 02.
// One-shot backfill that maps every existing row in the `teams` SQLite table
// to its canonical snake_case slug from references/teams.json. Operator runs
// this once on the droplet during Plan 05's deploy, after Plan 02's
// ALTER TABLE landed in production but before the kickoff cron starts
// JOINing on vip_signups.team = teams.slug.
//
// SAFETY: defaults to dry-run per CLAUDE.md's "dry-run-by-default" pattern.
// --write is required to actually UPDATE rows. Mismatches (existing slug
// disagrees with teams.json) are reported but NOT auto-overwritten — the
// operator resolves by editing references/teams.json and re-running.
//
//   node --env-file=.env scripts/backfill-team-slugs.mjs           # dry-run
//   node --env-file=.env scripts/backfill-team-slugs.mjs --write   # fill NULLs
//
// Idempotent: re-runs are a no-op once every row has a slug. Safe to invoke
// from a deploy script or by hand.
//
// Env: DATABASE_PATH (default ./data/oddlympics.db),
//      TEAMS_JSON_PATH (default ./references/teams.json).
//
// Exit code: 0 on clean run (no missing + no mismatches); 1 if anything in
// the DB couldn't be mapped or contradicted teams.json. Operator-friendly so
// `set -e` deploy scripts halt on a surprise.

import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DB_PATH = resolve(process.env.DATABASE_PATH ?? './data/oddlympics.db');
const TEAMS_JSON_PATH = resolve(
  process.env.TEAMS_JSON_PATH ?? './references/teams.json',
);

const args = process.argv.slice(2);
const WRITE = args.includes('--write');

const teamsCatalog = JSON.parse(readFileSync(TEAMS_JSON_PATH, 'utf-8'));
const labelToSlug = new Map(teamsCatalog.map((t) => [t.label, t.slug]));

console.log(`[backfill] DB: ${DB_PATH}`);
console.log(`[backfill] teams.json: ${TEAMS_JSON_PATH} (${labelToSlug.size} entries)`);
console.log(`[backfill] mode: ${WRITE ? 'WRITE' : 'dry-run'} (use --write to apply)`);

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Defensive — if Plan 02's src/lib/db.ts probe hasn't run yet (e.g. the
// operator runs this BEFORE deploying the new server build), surface a clear
// error instead of a confusing "no such column: slug".
const cols = db
  .prepare("SELECT name FROM pragma_table_info('teams')")
  .all();
if (!cols.some((c) => c.name === 'slug')) {
  console.error(
    '[backfill] FATAL: teams.slug column missing. Deploy the new server build first (it runs the ALTER on boot), or run the migration block from src/lib/db.ts.',
  );
  db.close();
  process.exit(1);
}

const rows = db
  .prepare('SELECT id, name, slug FROM teams ORDER BY name')
  .all();

const update = db.prepare('UPDATE teams SET slug = ? WHERE id = ?');

let ok = 0;
let fill = 0;
let mismatch = 0;
let missing = 0;

const apply = db.transaction(() => {
  for (const row of rows) {
    const expected = labelToSlug.get(row.name);
    if (row.slug !== null) {
      if (expected === undefined) {
        // Row has a slug but our catalog doesn't know this label. Operator-managed.
        console.log(`  ok-extra ${row.name} db=${row.slug} (label not in teams.json)`);
        ok++;
      } else if (row.slug === expected) {
        console.log(`  ok ${row.name} → ${row.slug}`);
        ok++;
      } else {
        console.log(`  mismatch ${row.name} db=${row.slug} expected=${expected}`);
        mismatch++;
        // Do NOT auto-overwrite — operator must resolve.
      }
    } else {
      if (expected !== undefined) {
        console.log(`  fill ${row.name} → ${expected}${WRITE ? '' : ' (dry-run)'}`);
        if (WRITE) update.run(expected, row.id);
        fill++;
      } else {
        console.log(`  WARN no-mapping ${row.name} id=${row.id}`);
        missing++;
      }
    }
  }
});
apply();

db.close();

console.log(
  `[backfill] mode=${WRITE ? 'WRITE' : 'dry-run'} ok=${ok} fill=${fill} mismatch=${mismatch} missing=${missing}`,
);

if (mismatch > 0) {
  console.error(
    '[backfill] mismatches found — edit references/teams.json so labels align with the DB, or update the DB row manually, then re-run.',
  );
}
if (missing > 0) {
  console.error(
    '[backfill] missing mappings — teams.name values not present in references/teams.json. Edit teams.json to cover those labels.',
  );
}

process.exit(mismatch === 0 && missing === 0 ? 0 : 1);
