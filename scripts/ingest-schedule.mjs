#!/usr/bin/env node
// Pull the World Cup 2026 teams + matches from football-data.org into the
// local SQLite DB. Idempotent — safe to re-run; upserts on (id) conflict.
//
// Local:      node --env-file=.env scripts/ingest-schedule.mjs
// Production: invoked by a systemd timer reading /etc/oddlympics.env
//
// Required env: FOOTBALL_DATA_API_KEY
// Optional env: DATABASE_PATH (default ./data/oddlympics.db)
//               WC_COMPETITION (default WC; football-data competition code)

import Database from 'better-sqlite3';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const API_KEY = process.env.FOOTBALL_DATA_API_KEY;
if (!API_KEY) {
  console.error('[ingest] FOOTBALL_DATA_API_KEY required');
  process.exit(1);
}

const DB_PATH = resolve(process.env.DATABASE_PATH ?? './data/oddlympics.db');
const COMP = process.env.WC_COMPETITION ?? 'WC';
const API_BASE = `https://api.football-data.org/v4/competitions/${COMP}`;

const dir = dirname(DB_PATH);
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

// Phase 5 — Plan 02: label → slug map for the teams.slug column. teams.json is
// hand-authored (48 entries) and lives at repo root; mismatched football-data.org
// names log a warning and leave slug NULL (the backfill script will surface them).
const TEAMS_JSON_PATH = resolve(
  process.env.TEAMS_JSON_PATH ?? './references/teams.json',
);
const teamsCatalog = JSON.parse(readFileSync(TEAMS_JSON_PATH, 'utf-8'));
const labelToSlug = new Map(teamsCatalog.map((t) => [t.label, t.slug]));

async function api(path) {
  const r = await fetch(`${API_BASE}${path}`, {
    headers: { 'X-Auth-Token': API_KEY },
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`${path}: HTTP ${r.status} ${body.slice(0, 200)}`);
  }
  return r.json();
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Defensive — ensure tables exist if the ingestor runs before the app has
// ever booted. Mirrors the schema in src/lib/db.ts.
db.exec(`
  CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY,
    tla TEXT NOT NULL,
    name TEXT NOT NULL,
    crest_url TEXT,
    last_updated INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );
  CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY,
    utc_date INTEGER NOT NULL,
    stage TEXT NOT NULL,
    group_name TEXT,
    home_team_id INTEGER,
    away_team_id INTEGER,
    status TEXT NOT NULL,
    last_updated INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );
  CREATE INDEX IF NOT EXISTS idx_matches_home_team ON matches(home_team_id);
  CREATE INDEX IF NOT EXISTS idx_matches_away_team ON matches(away_team_id);
  CREATE INDEX IF NOT EXISTS idx_matches_utc_date ON matches(utc_date);
`);

// Phase 5 — Plan 02: mirror the src/lib/db.ts slug-column probe so a standalone
// ingest run (e.g. via systemd before the web server boots) doesn't blow up on
// the new column. Idempotent: skip if slug already present.
{
  const cols = db
    .prepare("SELECT name FROM pragma_table_info('teams')")
    .all();
  if (!cols.some((c) => c.name === 'slug')) {
    db.exec(`ALTER TABLE teams ADD COLUMN slug TEXT;`);
  }
}

const upsertTeam = db.prepare(`
  INSERT INTO teams (id, tla, name, crest_url, slug)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    tla = excluded.tla,
    name = excluded.name,
    crest_url = excluded.crest_url,
    slug = COALESCE(excluded.slug, teams.slug),
    last_updated = strftime('%s','now')
`);

const upsertMatch = db.prepare(`
  INSERT INTO matches (id, utc_date, stage, group_name, home_team_id, away_team_id, status)
  VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    utc_date = excluded.utc_date,
    stage = excluded.stage,
    group_name = excluded.group_name,
    home_team_id = excluded.home_team_id,
    away_team_id = excluded.away_team_id,
    status = excluded.status,
    last_updated = strftime('%s','now')
`);

console.log(`[ingest] DB: ${DB_PATH}`);
console.log(`[ingest] competition: ${COMP}`);

console.log('[ingest] fetching teams...');
const teamsResp = await api('/teams');
const teams = teamsResp.teams ?? [];
console.log(`[ingest] got ${teams.length} teams from API`);

let noSlugCount = 0;
const ingestTeams = db.transaction(() => {
  for (const t of teams) {
    const slug = labelToSlug.get(t.name) ?? null;
    if (slug === null) {
      console.log(`[ingest] no-slug team-name=${t.name} id=${t.id}`);
      noSlugCount++;
    }
    upsertTeam.run(t.id, t.tla, t.name, t.crest ?? null, slug);
  }
});
ingestTeams();
if (noSlugCount > 0) {
  console.log(
    `[ingest] WARN ${noSlugCount} team(s) had no slug match in references/teams.json — edit that file to align labels with the football-data.org name`,
  );
}

console.log('[ingest] fetching matches...');
const matchesResp = await api('/matches');
const matches = matchesResp.matches ?? [];
console.log(`[ingest] got ${matches.length} matches from API`);

let skipped = 0;
const ingestMatches = db.transaction(() => {
  for (const m of matches) {
    if (!m.utcDate) {
      skipped++;
      continue;
    }
    upsertMatch.run(
      m.id,
      Math.floor(new Date(m.utcDate).getTime() / 1000),
      m.stage,
      m.group ?? null,
      m.homeTeam?.id ?? null,
      m.awayTeam?.id ?? null,
      m.status,
    );
  }
});
ingestMatches();

const teamCount = db.prepare('SELECT COUNT(*) AS n FROM teams').get();
const matchCount = db.prepare('SELECT COUNT(*) AS n FROM matches').get();
const tbdCount = db
  .prepare(
    'SELECT COUNT(*) AS n FROM matches WHERE home_team_id IS NULL OR away_team_id IS NULL',
  )
  .get();

console.log(
  `[ingest] DB now has ${teamCount.n} teams, ${matchCount.n} matches (${tbdCount.n} with TBD teams)${
    skipped ? `, skipped ${skipped} matches missing utcDate` : ''
  }`,
);

db.close();
