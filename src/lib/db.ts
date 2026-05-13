import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const DEFAULT_PATH = './data/oddlympics.db';
const path = resolve(process.env.DATABASE_PATH ?? DEFAULT_PATH);

const dir = dirname(path);
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

export const db = new Database(path);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS vip_signups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    requested_sport TEXT NOT NULL DEFAULT 'world_cup',
    confirmed_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    ip TEXT,
    user_agent TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_vip_signups_confirmed ON vip_signups(confirmed_at);
`);

// SQLite does not support `ADD COLUMN IF NOT EXISTS` (that's a Postgres-ism).
// Probe pragma_table_info instead and run ALTER only when the column is absent.
{
  const cols = db
    .prepare("SELECT name FROM pragma_table_info('vip_signups')")
    .all() as { name: string }[];
  const has = (n: string) => cols.some((c) => c.name === n);
  if (!has('unsubscribed_at'))
    db.exec(`ALTER TABLE vip_signups ADD COLUMN unsubscribed_at INTEGER;`);
  if (!has('selected_teams'))
    db.exec(`ALTER TABLE vip_signups ADD COLUMN selected_teams TEXT;`);
  if (!has('timezone'))
    db.exec(`ALTER TABLE vip_signups ADD COLUMN timezone TEXT;`);
  if (!has('manage_blast_sent_at'))
    db.exec(`ALTER TABLE vip_signups ADD COLUMN manage_blast_sent_at INTEGER;`);
}

export type VipSignup = {
  id: number;
  email: string;
  requested_sport: string;
  confirmed_at: number | null;
  created_at: number;
  ip: string | null;
  user_agent: string | null;
  unsubscribed_at: number | null;
  selected_teams: string | null; // JSON array of team IDs, e.g. "[762,769]"
  timezone: string | null; // IANA TZ, e.g. "America/New_York"
  manage_blast_sent_at: number | null; // Phase 2.5: launch-blast tracking
};

export const upsertVipSignup = db.prepare<
  [string, string, string | null, string | null]
>(`
  INSERT INTO vip_signups (email, requested_sport, ip, user_agent)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(email) DO UPDATE SET
    requested_sport = excluded.requested_sport,
    ip = COALESCE(excluded.ip, vip_signups.ip),
    user_agent = COALESCE(excluded.user_agent, vip_signups.user_agent)
  RETURNING *
`);

export const markConfirmed = db.prepare<[string]>(`
  UPDATE vip_signups
  SET confirmed_at = strftime('%s','now')
  WHERE email = ? AND confirmed_at IS NULL
  RETURNING *
`);

export const getByEmail = db.prepare<[string]>(`
  SELECT * FROM vip_signups WHERE email = ?
`);

export const markUnsubscribed = db.prepare<[string]>(`
  UPDATE vip_signups
  SET unsubscribed_at = strftime('%s','now')
  WHERE email = ? AND unsubscribed_at IS NULL
  RETURNING *
`);

// World Cup schedule data (Phase 2 — DATA-01, DATA-02)
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

  CREATE TABLE IF NOT EXISTS match_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_email TEXT NOT NULL,
    match_id INTEGER NOT NULL,
    channel TEXT NOT NULL DEFAULT 'email',
    sent_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    UNIQUE (user_email, match_id, channel)
  );
  CREATE INDEX IF NOT EXISTS idx_notif_match ON match_notifications(match_id);
`);

// Phase 5 — Plan 02 (D-06 path b): teams.slug is the runtime-join key linking
// vip_signups.team (snake_case slug) → teams.id (football-data.org integer id)
// for the kickoff cron. Probe + ALTER pattern mirrors the vip_signups block
// above; SQLite lacks ADD COLUMN IF NOT EXISTS.
{
  const cols = db
    .prepare("SELECT name FROM pragma_table_info('teams')")
    .all() as { name: string }[];
  const has = (n: string) => cols.some((c) => c.name === n);
  if (!has('slug'))
    db.exec(`ALTER TABLE teams ADD COLUMN slug TEXT;`);
}

// Phase 2.5 — LAUNCH-01-SC4: optional "which championship next?" demand-capture
// field on /schedule. History-preserving (one row per submission), not a column
// on vip_signups, so a user can submit multiple requests over time and we can
// triage by `GROUP BY request_text` for v1.1.
db.exec(`
  CREATE TABLE IF NOT EXISTS feature_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    request_text TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );
  CREATE INDEX IF NOT EXISTS idx_feature_requests_email ON feature_requests(email);
`);

export type Team = {
  id: number;
  tla: string;
  name: string;
  crest_url: string | null;
  slug: string | null; // snake_case key for vip_signups.team JOIN; nullable until backfill
  last_updated: number;
};

export type Match = {
  id: number;
  utc_date: number;
  stage: string;
  group_name: string | null;
  home_team_id: number | null;
  away_team_id: number | null;
  status: string;
  last_updated: number;
};

// Phase 5 — Plan 02: slug is the 5th column. COALESCE preserves a previously-set
// slug when an ingest run passes NULL (e.g. football-data.org name didn't match
// any teams.json label) — otherwise re-ingest would clobber backfilled values.
export const upsertTeam = db.prepare<
  [number, string, string, string | null, string | null]
>(`
  INSERT INTO teams (id, tla, name, crest_url, slug)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    tla = excluded.tla,
    name = excluded.name,
    crest_url = excluded.crest_url,
    slug = COALESCE(excluded.slug, teams.slug),
    last_updated = strftime('%s','now')
`);

export const upsertMatch = db.prepare<
  [number, number, string, string | null, number | null, number | null, string]
>(`
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

export const getTeams = db.prepare(`
  SELECT * FROM teams ORDER BY name
`);

// Phase 2 — IDENT-03 / IDENT-05: persist team selection + timezone for a confirmed user.
export const setSelection = db.prepare<[string, string, string]>(`
  UPDATE vip_signups
  SET selected_teams = ?, timezone = ?
  WHERE email = ? AND confirmed_at IS NOT NULL AND unsubscribed_at IS NULL
  RETURNING *
`);

// Phase 2.5 — LAUNCH-01-SC4: demand-capture for v1.1 prioritization.
export type FeatureRequest = {
  id: number;
  email: string;
  request_text: string;
  created_at: number;
};

export const insertFeatureRequest = db.prepare<[string, string]>(`
  INSERT INTO feature_requests (email, request_text)
  VALUES (?, ?)
`);
