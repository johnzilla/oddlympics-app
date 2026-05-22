import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { generateReferralCode } from './referral';

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
// Phase 5 — Plan 03 (D-01): also DROPS selected_teams. SQLite needs >= 3.35 for
// DROP COLUMN; assert before mutating so an old runtime fails with a clear
// message instead of a half-applied migration.
{
  const cols = db
    .prepare("SELECT name FROM pragma_table_info('vip_signups')")
    .all() as { name: string }[];
  const has = (n: string) => cols.some((c) => c.name === n);
  if (!has('unsubscribed_at'))
    db.exec(`ALTER TABLE vip_signups ADD COLUMN unsubscribed_at INTEGER;`);
  if (!has('timezone'))
    db.exec(`ALTER TABLE vip_signups ADD COLUMN timezone TEXT;`);
  if (!has('manage_blast_sent_at'))
    db.exec(`ALTER TABLE vip_signups ADD COLUMN manage_blast_sent_at INTEGER;`);
  const sqliteVersion = db
    .prepare('SELECT sqlite_version() AS v')
    .get() as { v: string };
  const [vMajor, vMinor] = sqliteVersion.v.split('.').slice(0, 2).map(Number);
  if (vMajor < 3 || (vMajor === 3 && vMinor < 35)) {
    throw new Error(
      `SQLite ${sqliteVersion.v} too old; need >= 3.35 for DROP COLUMN`,
    );
  }
  if (!has('team'))
    db.exec(`ALTER TABLE vip_signups ADD COLUMN team TEXT;`);
  if (has('selected_teams'))
    db.exec(`ALTER TABLE vip_signups DROP COLUMN selected_teams;`);
  // COMPAT-01: pre-milestone rows must end up with timezone='America/New_York',
  // not NULL. The ADD COLUMN above creates the column nullable; this UPDATE
  // backfills it once. Idempotent — second boot finds zero rows with NULL.
  db.exec(`UPDATE vip_signups SET timezone = 'America/New_York' WHERE timezone IS NULL;`);
}

// Phase 13 — REF-01: additive referral_code + referred_by columns, unique index, backfill.
// No SQLite version assert, no DROP COLUMN — purely additive (D-03).
// Models the simpler teams probe at :159-166 (no Phase-5 version assertion ceremony).
{
  const cols = db
    .prepare("SELECT name FROM pragma_table_info('vip_signups')")
    .all() as { name: string }[];
  const has = (n: string) => cols.some((c) => c.name === n);
  if (!has('referral_code'))
    db.exec(`ALTER TABLE vip_signups ADD COLUMN referral_code TEXT;`);
  if (!has('referred_by'))
    db.exec(`ALTER TABLE vip_signups ADD COLUMN referred_by TEXT;`);
  // Uniqueness MUST be a separate CREATE UNIQUE INDEX — SQLite forbids UNIQUE
  // on ALTER TABLE ADD COLUMN (verified landmine). IF NOT EXISTS makes this idempotent.
  db.exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_vip_signups_referral_code ON vip_signups(referral_code);`,
  );
  // Backfill: assign a stable code to every existing row that has none (D-04).
  // Idempotent — a second boot finds zero NULL rows and skips the loop body entirely.
  const nullRows = db
    .prepare('SELECT id FROM vip_signups WHERE referral_code IS NULL')
    .all() as { id: number }[];
  const updateCode = db.prepare<[string, number]>(
    'UPDATE vip_signups SET referral_code = ? WHERE id = ?',
  );
  for (const row of nullRows) {
    let assigned = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateReferralCode();
      try {
        updateCode.run(code, row.id);
        assigned = true;
        break;
      } catch (e: unknown) {
        if (
          e instanceof Error &&
          'code' in e &&
          (e as { code: string }).code === 'SQLITE_CONSTRAINT_UNIQUE'
        ) {
          // Genuine collision (astronomically rare at ~3.6e-13 per attempt); regenerate
          continue;
        }
        throw e; // not a collision error — re-throw
      }
    }
    if (!assigned) throw new Error('referral_code backfill: too many collisions');
  }
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
  team: string | null; // Phase 5: snake_case slug from references/teams.json
  timezone: string | null; // IANA TZ, e.g. "America/New_York"
  manage_blast_sent_at: number | null; // Phase 2.5: launch-blast tracking
  referral_code: string | null; // Phase 13: stable public short code, unique per user
  referred_by: string | null; // Phase 13: first-touch attribution — code of the referrer
};

// Phase 5 — SIGNUP-01/02/03: writes team + timezone alongside the existing
// teaser columns. team is COALESCE-protected (a future re-signup without a
// team must not clobber a previously-set slug); timezone is always overwritten
// because validation+fallback guarantees the incoming value is good.
// Phase 13 — REF-01: extended to 8 params. referral_code is COALESCE-protected
// (D-04: once set, a re-signup must never regenerate the code — breaks shared links).
// referred_by is COALESCE-protected (D-06: first-touch attribution — once set, the
// original referrer is never overwritten by a later re-signup without a ref).
export const upsertVipSignup = db.prepare<
  [string, string, string | null, string | null, string | null, string, string, string | null]
>(`
  INSERT INTO vip_signups (email, requested_sport, ip, user_agent, team, timezone, referral_code, referred_by)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(email) DO UPDATE SET
    requested_sport = excluded.requested_sport,
    ip = COALESCE(excluded.ip, vip_signups.ip),
    user_agent = COALESCE(excluded.user_agent, vip_signups.user_agent),
    team = COALESCE(excluded.team, vip_signups.team),
    timezone = excluded.timezone,
    referral_code = COALESCE(excluded.referral_code, vip_signups.referral_code),
    referred_by = COALESCE(excluded.referred_by, vip_signups.referred_by)
  RETURNING *
`);

// D-07 (re-subscribe SC4): WHERE is widened to also match rows where
// unsubscribed_at IS NOT NULL, so a previously-unsubscribed user who
// re-confirms via magic link gets their row restored to fully active.
// SET clears unsubscribed_at to NULL alongside updating confirmed_at.
// Already-confirmed-and-active rows produce 0 rows (idempotent): their
// confirmed_at IS NOT NULL and unsubscribed_at IS NULL, so neither
// branch of the OR matches.
export const markConfirmed = db.prepare<[string]>(`
  UPDATE vip_signups
  SET confirmed_at = strftime('%s','now'),
      unsubscribed_at = NULL
  WHERE email = ? AND (confirmed_at IS NULL OR unsubscribed_at IS NOT NULL)
  RETURNING *
`);

export const getByEmail = db.prepare<[string]>(`
  SELECT * FROM vip_signups WHERE email = ?
`);

// Phase 13 — REF-01 (D-07): resolves a submitted ?ref= code to its owner for attribution.
// Narrowed SELECT (not SELECT *) — /api/signup only needs email and referral_code.
export const lookupByReferralCode = db.prepare<[string]>(`
  SELECT email, referral_code FROM vip_signups WHERE referral_code = ?
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
// triage by `GROUP BY request_text` later.
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
// Phase 5 — SIGNUP-03: writes single slug to vip_signups.team (replaces v1's selected_teams JSON-array column).
export const setSelection = db.prepare<[string, string, string]>(`
  UPDATE vip_signups
  SET team = ?, timezone = ?
  WHERE email = ? AND confirmed_at IS NOT NULL AND unsubscribed_at IS NULL
  RETURNING *
`);

// Phase 2.5 — LAUNCH-01-SC4: demand-capture for future prioritization.
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

// Phase 12 — D-01: join table for multi-team subscriptions (additive; no ALTER/DROP on existing tables).
// Purely additive — no probe, no version assert, no backup-pre (D-02 waives legacy-safety ceremony).
db.exec(`
  CREATE TABLE IF NOT EXISTS user_teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    team_slug TEXT NOT NULL,
    UNIQUE(email, team_slug)
  );
  CREATE INDEX IF NOT EXISTS idx_user_teams_email ON user_teams(email);
`);

export type UserTeam = { id: number; email: string; team_slug: string };

// Phase 12 — D-01: delete-all-then-insert save contract (called within a transaction by /api/save-selection).
export const deleteUserTeams = db.prepare<[string]>(`
  DELETE FROM user_teams WHERE email = ?
`);

// Phase 12 — D-01: INSERT OR IGNORE so concurrent/duplicate inserts are safe.
export const insertUserTeam = db.prepare<[string, string]>(`
  INSERT OR IGNORE INTO user_teams (email, team_slug) VALUES (?, ?)
`);

// Phase 12 — D-01: read all team slugs for a user (returns { team_slug: string }[]).
export const getUserTeams = db.prepare<[string]>(`
  SELECT team_slug FROM user_teams WHERE email = ?
`);

// Phase 12 — D-01: module-level timezone write consumed inside the /api/save-selection
// db.transaction() so team picks + timezone commit atomically. Param order: (timezone, email).
export const updateTimezone = db.prepare<[string, string]>(`
  UPDATE vip_signups SET timezone = ? WHERE email = ?
`);

// Phase 12 — CR-01: scoped variant of updateTimezone that restores the SQL-level state gate
// the replaced setSelection carried — only updates timezone for an active (confirmed + not
// unsubscribed) row. res.changes === 0 inside the transaction signals a not-active user.
// Param order: (timezone, email) — mirrors updateTimezone exactly.
export const updateTimezoneActive = db.prepare<[string, string]>(`
  UPDATE vip_signups SET timezone = ?
  WHERE email = ? AND confirmed_at IS NOT NULL AND unsubscribed_at IS NULL
`);
