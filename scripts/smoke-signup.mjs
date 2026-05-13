#!/usr/bin/env node
// Phase 5 — Plan 06.
// End-to-end smoke verification for POST /api/signup. Drives the 7 cases from
// MILESTONE-consumer-landing.md Phase 1 + an AC2 static assertion against
// references/teams.json. Exits 0 only when all 8 PASS.
//
// How to run:
//   Boot a dev server in another terminal:
//     npm run dev
//   OR (against the built server):
//     npm run build && node ./dist/server/entry.mjs
//   Then in this terminal:
//     node scripts/smoke-signup.mjs
//
//   Env (optional):
//     SMOKE_BASE_URL   default http://localhost:4321
//     DATABASE_PATH    default ./data/oddlympics.db
//
// Exit codes:
//   0 = all PASS
//   1 = any FAIL
//   2 = setup error (server unreachable, DB unreadable)
//
// Evidence tags surfaced in the output:
//   [smoke] PASS AC2-teams-json    -- 48 entries + FORM-02 explicit slugs
//   [smoke] PASS AC9-invalid-team  -- bad team rejects with /?error=bad-form, no row
//   [smoke] PASS AC12-honeypot     -- honeypot redirects to /pending, no row
//
// Cleanup (operator, post-run, optional):
//   sqlite3 data/oddlympics.db \
//     "DELETE FROM vip_signups WHERE email LIKE 'smoke-%@example.com'"

import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.env.SMOKE_BASE_URL ?? 'http://localhost:4321';
const DB_PATH = resolve(process.env.DATABASE_PATH ?? './data/oddlympics.db');
const SMOKE_IP = '192.0.2.42'; // RFC 5737 TEST-NET-1; never a real client IP

console.log(`[smoke] target: ${BASE}`);
console.log(`[smoke] db:     ${DB_PATH}`);

let db;
try {
  db = new Database(DB_PATH, { readonly: true });
} catch (err) {
  console.error(`[smoke] FAIL: cannot open DB at ${DB_PATH} — ${err.message}`);
  process.exit(2);
}

let pass = 0;
let fail = 0;

async function runCase(name, fn) {
  try {
    const ok = await fn();
    if (ok) {
      console.log(`[smoke] PASS ${name}`);
      pass++;
    } else {
      console.error(`[smoke] FAIL ${name}`);
      fail++;
    }
  } catch (err) {
    console.error(`[smoke] FAIL ${name} (exception) ${err.message}`);
    fail++;
  }
}

async function post(form, extraHeaders = {}) {
  const body = new URLSearchParams(form);
  const res = await fetch(`${BASE}/api/signup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Origin: BASE,
      'X-Forwarded-For': SMOKE_IP,
      ...extraHeaders,
    },
    body,
    redirect: 'manual',
  });
  return { status: res.status, location: res.headers.get('location') };
}

function dbHasEmail(email) {
  return !!db
    .prepare('SELECT 1 FROM vip_signups WHERE email = ? LIMIT 1')
    .get(email);
}

function dbRowFor(email) {
  return db
    .prepare(
      'SELECT email, team, timezone, requested_sport FROM vip_signups WHERE email = ?',
    )
    .get(email);
}

// Probe server reachability before running cases so we can return exit code 2.
try {
  const res = await fetch(`${BASE}/`, { method: 'GET' });
  if (res.status >= 500) {
    console.error(`[smoke] FAIL: ${BASE}/ returned ${res.status}`);
    process.exit(2);
  }
} catch (err) {
  console.error(
    `[smoke] FAIL: cannot reach ${BASE} — is the dev server running? (${err.message})`,
  );
  process.exit(2);
}

// AC2 — static assertion on references/teams.json
await runCase('AC2-teams-json (48 entries, FORM-02 slugs verified)', () => {
  const teams = JSON.parse(
    readFileSync(resolve('./references/teams.json'), 'utf8'),
  );
  if (!Array.isArray(teams) || teams.length !== 48) {
    console.error(`  expected 48 entries, got ${teams?.length}`);
    return false;
  }
  const slugs = new Set(teams.map((t) => t.slug));
  const required = [
    'united_states',
    'south_korea',
    'ivory_coast',
    'dr_congo',
    'cape_verde',
    'bosnia',
    'czech_republic',
    'new_zealand',
    'saudi_arabia',
    'south_africa',
  ];
  for (const s of required) {
    if (!slugs.has(s)) {
      console.error(`  missing required slug: ${s}`);
      return false;
    }
  }
  return true;
});

// Case 1 — valid submission
await runCase('case-1-valid (team=england, tz=Europe/London)', async () => {
  const email = `smoke-valid-${Date.now()}@example.com`;
  const { status, location } = await post({
    email,
    team: 'england',
    timezone: 'Europe/London',
  });
  if (status !== 303) {
    console.error(`  expected status 303, got ${status}`);
    return false;
  }
  if (!location?.startsWith('/pending?email=')) {
    console.error(`  expected /pending?email=..., got ${location}`);
    return false;
  }
  const row = dbRowFor(email);
  if (!row) {
    console.error(`  expected row for ${email}, got nothing`);
    return false;
  }
  if (
    row.team !== 'england' ||
    row.timezone !== 'Europe/London' ||
    row.requested_sport !== 'world_cup'
  ) {
    console.error(`  unexpected row: ${JSON.stringify(row)}`);
    return false;
  }
  return true;
});

// Case 2 — missing team
await runCase('case-2-missing-team (team="")', async () => {
  const email = `smoke-miss-team-${Date.now()}@example.com`;
  const { status, location } = await post({
    email,
    team: '',
    timezone: 'Europe/London',
  });
  if (status !== 303 || location !== '/?error=bad-form') {
    console.error(`  expected 303 /?error=bad-form, got ${status} ${location}`);
    return false;
  }
  if (dbHasEmail(email)) {
    console.error(`  unexpected row written for ${email}`);
    return false;
  }
  return true;
});

// Case 3 — invalid team (AC9)
await runCase('AC9-invalid-team (team=fake_team)', async () => {
  const email = `smoke-bad-team-${Date.now()}@example.com`;
  const { status, location } = await post({
    email,
    team: 'fake_team',
    timezone: 'Europe/London',
  });
  if (status !== 303 || location !== '/?error=bad-form') {
    console.error(`  expected 303 /?error=bad-form, got ${status} ${location}`);
    return false;
  }
  if (dbHasEmail(email)) {
    console.error(`  unexpected row written for ${email}`);
    return false;
  }
  return true;
});

// Case 4 — missing tz (falls back)
await runCase('case-4-missing-tz (tz="")', async () => {
  const email = `smoke-miss-tz-${Date.now()}@example.com`;
  const { status, location } = await post({
    email,
    team: 'brazil',
    timezone: '',
  });
  if (status !== 303 || !location?.startsWith('/pending?email=')) {
    console.error(
      `  expected 303 /pending?email=..., got ${status} ${location}`,
    );
    return false;
  }
  const row = dbRowFor(email);
  if (!row || row.team !== 'brazil' || row.timezone !== 'America/New_York') {
    console.error(`  expected tz fallback, got ${JSON.stringify(row)}`);
    return false;
  }
  return true;
});

// Case 5 — invalid tz (falls back)
await runCase('case-5-invalid-tz (tz=Foo/Bar)', async () => {
  const email = `smoke-bad-tz-${Date.now()}@example.com`;
  const { status, location } = await post({
    email,
    team: 'france',
    timezone: 'Foo/Bar',
  });
  if (status !== 303 || !location?.startsWith('/pending?email=')) {
    console.error(
      `  expected 303 /pending?email=..., got ${status} ${location}`,
    );
    return false;
  }
  const row = dbRowFor(email);
  if (!row || row.team !== 'france' || row.timezone !== 'America/New_York') {
    console.error(`  expected tz fallback, got ${JSON.stringify(row)}`);
    return false;
  }
  return true;
});

// Case 6 — honeypot (AC12)
await runCase('AC12-honeypot (website=evil-bot)', async () => {
  const email = `smoke-honeypot-${Date.now()}@example.com`;
  const { status, location } = await post({
    email,
    team: 'germany',
    timezone: 'Europe/Berlin',
    website: 'evil-bot',
  });
  if (status !== 303 || location !== '/pending') {
    console.error(`  expected 303 /pending (no email param), got ${status} ${location}`);
    return false;
  }
  if (dbHasEmail(email)) {
    console.error(`  unexpected row written for ${email}`);
    return false;
  }
  return true;
});

// Case 7 — rate limit
// rate-limit.ts: MAX_PER_WINDOW = 5 per WINDOW_MS = 1h, keyed by 'ip:<ip>' AND 'email:<email>'.
// Pre-condition: prior cases (1, 4, 5) all came from SMOKE_IP and succeeded — that's 3 IP slots used.
// Plus case 6 (honeypot) short-circuits before reaching the rate limiter, so it doesn't count.
// Cases 2 and 3 hit bad-form which is BEFORE the rate limiter, also not counted.
// So at this point, SMOKE_IP has used ~3 of its 5 hourly slots. Firing 4 more valid POSTs
// from the same IP brings the total to 7 ≥ MAX_PER_WINDOW — the LAST should rate-limit.
// Note: the limiter state is in-memory per server process; restart of the dev server resets it.
await runCase('case-7-rate-limit (>5 from same IP)', async () => {
  let last = null;
  for (let i = 0; i < 4; i++) {
    const email = `smoke-rl-${Date.now()}-${i}@example.com`;
    last = await post({ email, team: 'spain', timezone: 'Europe/Madrid' });
  }
  if (!last) {
    console.error('  no response captured');
    return false;
  }
  if (last.status !== 303) {
    console.error(`  expected status 303 on last attempt, got ${last.status}`);
    return false;
  }
  if (last.location !== '/?error=rate-limited') {
    console.error(
      `  expected /?error=rate-limited on last attempt, got ${last.location}`,
    );
    return false;
  }
  return true;
});

console.log(`[smoke] result: pass=${pass} fail=${fail}`);
db.close();

if (fail > 0) {
  console.log(
    "[smoke] cleanup: sqlite3 data/oddlympics.db \"DELETE FROM vip_signups WHERE email LIKE 'smoke-%@example.com'\"",
  );
}

process.exit(fail === 0 ? 0 : 1);
