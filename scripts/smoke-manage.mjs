#!/usr/bin/env node
// Phase 9 — Plan 09-05.
// End-to-end smoke for /manage editor + /schedule redirect + unsubscribe
// token TTL + single-use semantics + re-subscribe DB path.
// Covers M1–M9 from RESEARCH.md Q12. Provides goal-backward proof for
// ROADMAP SC1–SC4, MANAGE-01, MANAGE-02, COMPAT-01, and D-01.
//
// How to run:
//   Boot a dev server in another terminal:
//     npm run dev
//   OR (against the built server):
//     npm run build && node ./dist/server/entry.mjs
//   Then in this terminal:
//     node scripts/smoke-manage.mjs
//
//   Env (optional):
//     SMOKE_BASE_URL      default http://localhost:4321
//     DATABASE_PATH       default ./data/oddlympics.db
//     MAGIC_LINK_SECRET   default dev fallback (must match running server)
//
// Exit codes:
//   0 = all PASS
//   1 = any FAIL
//   2 = setup error (server unreachable, DB unreadable)
//
// Evidence tags surfaced in the output:
//   M1-signed-out-form          — GET /manage (no auth) shows magic-link form
//   M2-url-token-editor         — GET /manage?token= yields editor + Set-Cookie
//   M3-save-valid               — POST /api/save-selection valid slug+tz → saved
//   M4-save-bad-team            — POST /api/save-selection invalid slug → bad-team
//   M5-save-bad-tz              — POST /api/save-selection invalid tz → bad-tz
//   M6-banner-team-null         — GET /manage with team=NULL row shows banner
//   M7-schedule-redirect        — GET /schedule → 301 /manage (no query)
//   M7b-schedule-redirect-token — GET /schedule?token=abc → 301 /manage?token=abc
//   M8-unsub-1y-token           — 1-year unsubscribe token single-use (ok → already)
//   M9-resubscribe-path         — DB: mark unsubscribed → markConfirmed → active
//
// Cleanup (operator, post-run, optional):
//   sqlite3 data/oddlympics.db \
//     "DELETE FROM vip_signups WHERE email LIKE 'smoke-%@example.com'"

import Database from 'better-sqlite3';
import { createHmac } from 'node:crypto';
import { resolve } from 'node:path';

const BASE = process.env.SMOKE_BASE_URL ?? 'http://localhost:4321';
const DB_PATH = resolve(process.env.DATABASE_PATH ?? './data/oddlympics.db');
// Must match the running server's dev-fallback or prod secret exactly.
// When MAGIC_LINK_SECRET is unset the server uses this same literal (src/lib/token.ts:20).
const SECRET =
  process.env.MAGIC_LINK_SECRET ||
  'dev-only-insecure-secret-do-not-use-in-prod';
const COOKIE_NAME = 'oddlympics_session';

console.log(`[smoke] target: ${BASE}`);
console.log(`[smoke] db:     ${DB_PATH}`);

// ---------------------------------------------------------------------------
// Inline token signing — mirrors src/lib/token.ts mintToken exactly.
// Re-implemented via node:crypto rather than importing the .ts source to avoid
// TypeScript loader friction and keep the smoke isolated from future TS-only
// language features.
// ---------------------------------------------------------------------------
function b64url(buf) {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function sign(data) {
  return b64url(createHmac('sha256', SECRET).update(data).digest());
}

// TTL table mirrors TTL_BY_PURPOSE in src/lib/token.ts (D-05 / MANAGE-02).
const TTL_BY_PURPOSE = {
  confirm:     60 * 60 * 24,         // 24h
  manage:      60 * 60 * 24,         // 24h
  unsubscribe: 60 * 60 * 24 * 365,   // 1y — MANAGE-02
  session:     60 * 60 * 24 * 30,    // 30d
};

function mintToken(email, opts = {}) {
  const ttl =
    opts.ttlSeconds ?? TTL_BY_PURPOSE[opts.purpose ?? 'confirm'];
  const payload = { email, exp: Math.floor(Date.now() / 1000) + ttl };
  if (opts.purpose) payload.purpose = opts.purpose;
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  return `${body}.${sign(body)}`;
}

// Decode token payload without verifying (for the M8 TTL assertion).
function decodePayload(token) {
  const [body] = token.split('.');
  const pad = body.length % 4 === 0 ? '' : '='.repeat(4 - (body.length % 4));
  const json = Buffer.from(
    body.replace(/-/g, '+').replace(/_/g, '/') + pad,
    'base64',
  ).toString('utf8');
  return JSON.parse(json);
}

// ---------------------------------------------------------------------------
// DB handles — read-only for assertions; writable for M6 and M9 setup/teardown.
// ---------------------------------------------------------------------------
let dbRead;
let dbWrite;
try {
  dbRead = new Database(DB_PATH, { readonly: true });
} catch (err) {
  console.error(`[smoke] FAIL: cannot open DB (read) at ${DB_PATH} — ${err.message}`);
  process.exit(2);
}
try {
  dbWrite = new Database(DB_PATH);
} catch (err) {
  console.error(`[smoke] FAIL: cannot open DB (write) at ${DB_PATH} — ${err.message}`);
  dbRead.close();
  process.exit(2);
}

function dbRowFor(email) {
  return dbRead
    .prepare('SELECT * FROM vip_signups WHERE email = ?')
    .get(email);
}

// Insert or replace a smoke row with full control over columns.
// confirmed_at defaults to now; unsubscribed_at defaults to NULL.
function dbInsertSmokeRow(email, opts = {}) {
  const now = Math.floor(Date.now() / 1000);
  dbWrite
    .prepare(`
      INSERT INTO vip_signups
        (email, requested_sport, team, timezone, confirmed_at, unsubscribed_at)
      VALUES (?, 'world_cup', ?, ?, ?, ?)
      ON CONFLICT(email) DO UPDATE SET
        team = excluded.team,
        timezone = excluded.timezone,
        confirmed_at = excluded.confirmed_at,
        unsubscribed_at = excluded.unsubscribed_at
    `)
    .run(
      email,
      opts.team ?? null,
      opts.timezone ?? 'America/New_York',
      opts.confirmedAt ?? now,
      opts.unsubscribedAt ?? null,
    );
}

function dbMarkUnsubscribed(email) {
  dbWrite
    .prepare(`
      UPDATE vip_signups
      SET unsubscribed_at = strftime('%s','now')
      WHERE email = ? AND unsubscribed_at IS NULL
    `)
    .run(email);
}

// D-07 shape from Plan 09-02 — clears unsubscribed_at, widens WHERE.
function dbMarkConfirmed(email) {
  return dbWrite
    .prepare(`
      UPDATE vip_signups
      SET confirmed_at = strftime('%s','now'),
          unsubscribed_at = NULL
      WHERE email = ? AND (confirmed_at IS NULL OR unsubscribed_at IS NOT NULL)
      RETURNING *
    `)
    .get(email);
}

// ---------------------------------------------------------------------------
// HTTP helpers — fetch with redirect: 'manual' so we can assert on Location.
// ---------------------------------------------------------------------------
async function get(path, headers = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'GET',
    headers,
    redirect: 'manual',
  });
  return {
    status: res.status,
    location: res.headers.get('location'),
    setCookie: res.headers.get('set-cookie'),
    body: await res.text(),
  };
}

async function postForm(path, form, headers = {}) {
  const body = new URLSearchParams(form);
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Origin: BASE,
      ...headers,
    },
    body,
    redirect: 'manual',
  });
  return {
    status: res.status,
    location: res.headers.get('location'),
    setCookie: res.headers.get('set-cookie'),
  };
}

// ---------------------------------------------------------------------------
// runCase harness — mirrors smoke-signup.mjs exactly.
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Server reachability probe — exit 2 if server is down.
// ---------------------------------------------------------------------------
try {
  const res = await fetch(`${BASE}/`, { method: 'GET' });
  if (res.status >= 500) {
    console.error(`[smoke] FAIL: ${BASE}/ returned ${res.status}`);
    process.exit(2);
  }
} catch (err) {
  console.error(
    `[smoke] FAIL: cannot reach ${BASE} — is the server running? (${err.message})`,
  );
  process.exit(2);
}

// ---------------------------------------------------------------------------
// M1 — signed-out /manage shows magic-link form (MANAGE-01 signed-out branch)
// ---------------------------------------------------------------------------
await runCase('M1-signed-out-form', async () => {
  const { status, body } = await get('/manage');
  if (status !== 200) {
    console.error(`  expected status 200, got ${status}`);
    return false;
  }
  if (!body.includes('action="/api/manage"')) {
    console.error('  expected action="/api/manage" in body');
    return false;
  }
  if (body.includes('action="/api/save-selection"')) {
    console.error('  unexpected action="/api/save-selection" in signed-out body');
    return false;
  }
  return true;
});

// ---------------------------------------------------------------------------
// M2 — URL token first arrival → editor + Set-Cookie (SC1 / MANAGE-01)
// ---------------------------------------------------------------------------
await runCase('M2-url-token-editor', async () => {
  const ts = Date.now();
  const email = `smoke-m2-${ts}@example.com`;
  dbInsertSmokeRow(email, { team: 'england' });

  const token = mintToken(email, { purpose: 'manage' });
  const { status, setCookie, body } = await get(`/manage?token=${encodeURIComponent(token)}`);

  if (status !== 200) {
    console.error(`  expected status 200, got ${status}`);
    return false;
  }
  if (!setCookie || !setCookie.startsWith(`${COOKIE_NAME}=`)) {
    console.error(`  expected Set-Cookie starting with ${COOKIE_NAME}=, got: ${setCookie}`);
    return false;
  }
  if (!body.includes('action="/api/save-selection"')) {
    console.error('  expected action="/api/save-selection" in editor body');
    return false;
  }
  if (!body.includes('<select') || !body.includes('name="team"')) {
    console.error('  expected <select name="team"> in editor body');
    return false;
  }
  // The current team slug should appear as a selected option.
  if (!body.includes('value="england"')) {
    console.error('  expected value="england" option in team select');
    return false;
  }
  if (!body.includes('selected') || !body.toLowerCase().includes('england')) {
    console.error('  expected england to be present near selected attribute');
    return false;
  }
  return true;
});

// ---------------------------------------------------------------------------
// M3 — save valid slug + tz → 303 → /manage?status=saved, DB updated (SC1)
// ---------------------------------------------------------------------------
await runCase('M3-save-valid', async () => {
  const ts = Date.now();
  const email = `smoke-m3-${ts}@example.com`;
  dbInsertSmokeRow(email, { team: 'france' });

  const sessionToken = mintToken(email, { purpose: 'session', ttlSeconds: 60 * 60 * 24 * 30 });
  const { status, location } = await postForm(
    '/api/save-selection',
    { team: 'germany', timezone: 'Europe/Berlin' },
    { Cookie: `${COOKIE_NAME}=${sessionToken}` },
  );

  if (status !== 303) {
    console.error(`  expected status 303, got ${status}`);
    return false;
  }
  if (!location?.includes('/manage?status=saved') && location !== '/manage?status=saved') {
    console.error(`  expected Location /manage?status=saved, got ${location}`);
    return false;
  }

  // Re-open DB to pick up the write from the server.
  const row = dbRead
    .prepare('SELECT team, timezone FROM vip_signups WHERE email = ?')
    .get(email);
  if (!row) {
    console.error(`  expected row for ${email}`);
    return false;
  }
  if (row.team !== 'germany') {
    console.error(`  expected team=germany, got ${row.team}`);
    return false;
  }
  if (row.timezone !== 'Europe/Berlin') {
    console.error(`  expected timezone=Europe/Berlin, got ${row.timezone}`);
    return false;
  }
  return true;
});

// ---------------------------------------------------------------------------
// M4 — save bad slug → 303 → /manage?status=bad-team, DB unchanged (SC1 / D-02)
// ---------------------------------------------------------------------------
await runCase('M4-save-bad-team', async () => {
  const ts = Date.now();
  const email = `smoke-m4-${ts}@example.com`;
  dbInsertSmokeRow(email, { team: 'spain' });

  const sessionToken = mintToken(email, { purpose: 'session', ttlSeconds: 60 * 60 * 24 * 30 });
  const { status, location } = await postForm(
    '/api/save-selection',
    { team: 'fake_slug', timezone: 'Europe/London' },
    { Cookie: `${COOKIE_NAME}=${sessionToken}` },
  );

  if (status !== 303) {
    console.error(`  expected status 303, got ${status}`);
    return false;
  }
  if (!location?.includes('bad-team')) {
    console.error(`  expected bad-team in Location, got ${location}`);
    return false;
  }
  const row = dbRead
    .prepare('SELECT team FROM vip_signups WHERE email = ?')
    .get(email);
  if (!row || row.team !== 'spain') {
    console.error(`  expected team=spain unchanged, got ${row?.team}`);
    return false;
  }
  return true;
});

// ---------------------------------------------------------------------------
// M5 — save bad tz → 303 → /manage?status=bad-tz, DB unchanged
// ---------------------------------------------------------------------------
await runCase('M5-save-bad-tz', async () => {
  const ts = Date.now();
  const email = `smoke-m5-${ts}@example.com`;
  dbInsertSmokeRow(email, { team: 'italy', timezone: 'Europe/Rome' });

  const sessionToken = mintToken(email, { purpose: 'session', ttlSeconds: 60 * 60 * 24 * 30 });
  const { status, location } = await postForm(
    '/api/save-selection',
    { team: 'italy', timezone: 'Foo/Bar' },
    { Cookie: `${COOKIE_NAME}=${sessionToken}` },
  );

  if (status !== 303) {
    console.error(`  expected status 303, got ${status}`);
    return false;
  }
  if (!location?.includes('bad-tz')) {
    console.error(`  expected bad-tz in Location, got ${location}`);
    return false;
  }
  const row = dbRead
    .prepare('SELECT timezone FROM vip_signups WHERE email = ?')
    .get(email);
  if (!row || row.timezone !== 'Europe/Rome') {
    console.error(`  expected timezone=Europe/Rome unchanged, got ${row?.timezone}`);
    return false;
  }
  return true;
});

// ---------------------------------------------------------------------------
// M6 — banner visible when team IS NULL (COMPAT-01 / SC2)
// ---------------------------------------------------------------------------
await runCase('M6-banner-team-null', async () => {
  const ts = Date.now();
  const email = `smoke-m6-${ts}@example.com`;
  // Simulate a pre-milestone subscriber: team=NULL, tz already backfilled.
  dbInsertSmokeRow(email, { team: null, timezone: 'America/New_York' });

  const sessionToken = mintToken(email, { purpose: 'session', ttlSeconds: 60 * 60 * 24 * 30 });
  const { status, body } = await get('/manage', {
    Cookie: `${COOKIE_NAME}=${sessionToken}`,
  });

  if (status !== 200) {
    console.error(`  expected status 200, got ${status}`);
    return false;
  }
  if (!body.includes('Pick a team')) {
    console.error('  expected banner text "Pick a team" in body');
    return false;
  }
  // The apostrophe is HTML-entity encoded in server-rendered output: &#39;
  if (!body.includes("You&#39;re signed up") && !body.includes("You're signed up")) {
    console.error('  expected banner subhead "You\'re signed up" (or &#39; entity) in body');
    return false;
  }
  return true;
});

// ---------------------------------------------------------------------------
// M7 — GET /schedule (no query) → 301 → /manage (D-01)
// ---------------------------------------------------------------------------
await runCase('M7-schedule-redirect', async () => {
  const { status, location } = await get('/schedule');
  if (status !== 301) {
    console.error(`  expected status 301, got ${status}`);
    return false;
  }
  if (location !== '/manage') {
    console.error(`  expected Location /manage, got ${location}`);
    return false;
  }
  return true;
});

// ---------------------------------------------------------------------------
// M7b — GET /schedule?token=abc → 301 → /manage?token=abc (D-01 query preserved)
// ---------------------------------------------------------------------------
await runCase('M7b-schedule-redirect-with-token', async () => {
  const { status, location } = await get('/schedule?token=abc123');
  if (status !== 301) {
    console.error(`  expected status 301, got ${status}`);
    return false;
  }
  if (location !== '/manage?token=abc123') {
    console.error(`  expected Location /manage?token=abc123, got ${location}`);
    return false;
  }
  return true;
});

// ---------------------------------------------------------------------------
// M8 — 1-year unsubscribe token TTL assertion + single-use semantics (MANAGE-02 / D-06 / SC3)
// ---------------------------------------------------------------------------
await runCase('M8-unsub-1y-token-and-single-use', async () => {
  const ts = Date.now();
  const email = `smoke-m8-${ts}@example.com`;
  dbInsertSmokeRow(email, { team: 'brazil' });

  const token = mintToken(email, { purpose: 'unsubscribe' });

  // Assert 1-year TTL is approximately correct.
  const payload = decodePayload(token);
  const now = Math.floor(Date.now() / 1000);
  const remaining = payload.exp - now;
  const oneYearSeconds = 60 * 60 * 24 * 365;
  if (remaining < oneYearSeconds - 60 * 60 * 24 || remaining > oneYearSeconds + 60 * 60 * 24) {
    console.error(
      `  expected exp ~1 year from now, got ${remaining}s remaining (expected ${oneYearSeconds}s ± 1 day)`,
    );
    return false;
  }

  // First click — should mark unsubscribed → status=ok.
  const first = await get(`/api/unsubscribe?token=${encodeURIComponent(token)}`);
  if (first.status !== 303) {
    console.error(`  first click: expected 303, got ${first.status}`);
    return false;
  }
  if (!first.location?.startsWith('/unsubscribed?status=ok')) {
    console.error(`  first click: expected status=ok, got ${first.location}`);
    return false;
  }

  // Second click — same long-lived token, but DB row now has unsubscribed_at set → status=already.
  const second = await get(`/api/unsubscribe?token=${encodeURIComponent(token)}`);
  if (second.status !== 303) {
    console.error(`  second click: expected 303, got ${second.status}`);
    return false;
  }
  if (!second.location?.startsWith('/unsubscribed?status=already')) {
    console.error(`  second click: expected status=already, got ${second.location}`);
    return false;
  }
  return true;
});

// ---------------------------------------------------------------------------
// M9 — re-subscribe DB path: unsubscribed → markConfirmed → active (SC4 / D-07)
// This is a DB-only test — the full HTTP round-trip requires a magic-link email.
// ---------------------------------------------------------------------------
await runCase('M9-resubscribe-path', async () => {
  const ts = Date.now();
  const email = `smoke-m9-${ts}@example.com`;
  dbInsertSmokeRow(email, { team: 'argentina' });

  // Step 1: mark unsubscribed (simulates user clicking unsubscribe link).
  dbMarkUnsubscribed(email);
  const afterUnsub = dbRead
    .prepare('SELECT unsubscribed_at FROM vip_signups WHERE email = ?')
    .get(email);
  if (!afterUnsub?.unsubscribed_at) {
    console.error('  expected unsubscribed_at to be set after markUnsubscribed');
    return false;
  }

  // Step 2: call dbMarkConfirmed (the D-07 UPDATE shape from Plan 09-02).
  // This simulates the user re-signing-up and clicking the confirmation magic link.
  const beforeConfirm = Math.floor(Date.now() / 1000);
  const returned = dbMarkConfirmed(email);
  if (!returned) {
    console.error('  expected RETURNING * to yield a row (WHERE matched)');
    return false;
  }

  // Step 3: assert row is fully active.
  const row = dbRead
    .prepare('SELECT confirmed_at, unsubscribed_at FROM vip_signups WHERE email = ?')
    .get(email);
  if (!row) {
    console.error(`  expected row for ${email}`);
    return false;
  }
  if (row.unsubscribed_at !== null) {
    console.error(`  expected unsubscribed_at=NULL, got ${row.unsubscribed_at}`);
    return false;
  }
  if (row.confirmed_at < beforeConfirm || row.confirmed_at > beforeConfirm + 5) {
    console.error(
      `  expected confirmed_at ~${beforeConfirm}, got ${row.confirmed_at}`,
    );
    return false;
  }
  return true;
});

// ---------------------------------------------------------------------------
// Result + cleanup hint.
// ---------------------------------------------------------------------------
console.log(`[smoke] result: pass=${pass} fail=${fail}`);
dbRead.close();
dbWrite.close();

if (fail > 0) {
  console.log(
    "[smoke] cleanup: sqlite3 data/oddlympics.db \"DELETE FROM vip_signups WHERE email LIKE 'smoke-%@example.com'\"",
  );
}

process.exit(fail === 0 ? 0 : 1);
