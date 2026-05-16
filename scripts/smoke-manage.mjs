#!/usr/bin/env node
// Phase 9 — Plan 09-05.
// Extended in Phase 12 — Plan 12-04 with M10–M14 (multi-team save, reload
// pre-check, too-many, empty-bad-team, cron-visibility through user_teams).
// End-to-end smoke for /manage editor + /schedule redirect + unsubscribe
// token TTL + single-use semantics + re-subscribe DB path + multi-team save.
// Covers M1–M14 from RESEARCH.md Q12. Provides goal-backward proof for
// ROADMAP SC1–SC4, MANAGE-01, MANAGE-02, COMPAT-01, D-01 (DB), D-04/D-05
// (checkbox editor), D-06 (cron join visibility), NOTIFY-04, IDENT-02/03/04.
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
//   M2-url-token-editor         — GET /manage?token= yields editor + Set-Cookie (checkboxes post-12-02)
//   M3-save-valid               — POST /api/save-selection valid slug+tz → saved → user_teams row written
//   M4-save-bad-team            — POST /api/save-selection invalid slug → bad-team
//   M5-save-bad-tz              — POST /api/save-selection invalid tz → bad-tz
//   M6-banner-team-null         — GET /manage with no user_teams rows shows banner
//   M7-schedule-redirect        — GET /schedule → 301 /manage (no query)
//   M7b-schedule-redirect-token — GET /schedule?token=abc → 301 /manage?token=abc
//   M8-unsub-1y-token           — 1-year unsubscribe token single-use (ok → already)
//   M9-resubscribe-path         — DB: mark unsubscribed → markConfirmed → active
//   M10-multi-save-n            — POST 3 valid slugs → 303 status=saved; user_teams rows match
//   M11-pre-check               — GET /manage with 3 saved slugs; HTML has checked checkboxes for each
//   M12-too-many                — POST 6 valid slugs → 303 status=too-many; user_teams unchanged
//   M13-empty-save              — POST 0 slugs → 303 status=bad-team; user_teams unchanged
//   M14-cron-visibility         — DB: usersQuery-equivalent JOIN confirms user appears for match team
//
// Cleanup (operator, post-run, optional):
//   sqlite3 data/oddlympics.db \
//     "DELETE FROM vip_signups WHERE email LIKE 'smoke-%@example.com'; \
//      DELETE FROM user_teams WHERE email LIKE 'smoke-%@example.com'"

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

// Phase 12 — M10–M14 helpers for user_teams seed + assertion.
// Mirrors dbInsertSmokeRow's style: delete-all-then-insert per slug.
function dbInsertUserTeams(email, slugs = []) {
  dbWrite.prepare('DELETE FROM user_teams WHERE email = ?').run(email);
  const ins = dbWrite.prepare(
    'INSERT OR IGNORE INTO user_teams (email, team_slug) VALUES (?, ?)',
  );
  for (const slug of slugs) ins.run(email, slug);
}

// Returns sorted team_slug list for an email — used in assertions.
function dbUserTeamSlugs(email) {
  const rows = dbRead
    .prepare('SELECT team_slug FROM user_teams WHERE email = ? ORDER BY team_slug')
    .all(email);
  return rows.map((r) => r.team_slug);
}

// Multi-value form POST helper — builds URLSearchParams with repeated team= entries.
// postForm()'s URLSearchParams(object) only serializes one value per key; this
// correctly sends N team= values for the checkbox form.
async function postMultiTeam(slugs, tz, cookieHeader) {
  const body = new URLSearchParams();
  for (const slug of slugs) body.append('team', slug);
  body.append('timezone', tz);
  const res = await fetch(`${BASE}/api/save-selection`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Origin: BASE,
      Cookie: cookieHeader,
    },
    body,
    redirect: 'manual',
  });
  return {
    status: res.status,
    location: res.headers.get('location'),
  };
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
// Phase 12 (12-04 Rule 1 fix): /manage now renders confederation-grouped
// checkboxes (not <select>) post-12-02; assertions updated accordingly.
// england seeded via user_teams so the checkbox is pre-checked.
// ---------------------------------------------------------------------------
await runCase('M2-url-token-editor', async () => {
  const ts = Date.now();
  const email = `smoke-m2-${ts}@example.com`;
  dbInsertSmokeRow(email, { team: 'england' });
  dbInsertUserTeams(email, ['england']);

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
  // Post-12-02: /manage uses confederation-grouped checkboxes, not <select name="team">.
  if (body.includes('<select name="team"')) {
    console.error('  unexpected <select name="team"> in editor body (should be checkboxes post-12-02)');
    return false;
  }
  if (!body.includes('type="checkbox"') || !body.includes('name="team"')) {
    console.error('  expected type="checkbox" name="team" checkboxes in editor body');
    return false;
  }
  // The user's saved team slug should appear as a value attribute.
  if (!body.includes('value="england"')) {
    console.error('  expected value="england" in checkbox inputs');
    return false;
  }
  // The england checkbox should be pre-checked (user_teams row exists).
  if (!body.includes('checked')) {
    console.error('  expected at least one checked checkbox in body');
    return false;
  }
  return true;
});

// ---------------------------------------------------------------------------
// M3 — save valid slug + tz → 303 → /manage?status=saved, DB updated (SC1)
// Phase 12 (12-04 Rule 1 fix): save-selection now writes user_teams (not
// vip_signups.team) post-12-02; timezone still written to vip_signups.timezone.
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

  // Post-12-02: save-selection writes user_teams (not vip_signups.team).
  // Assert the user_teams row was created for germany.
  const slugs = dbUserTeamSlugs(email);
  if (!slugs.includes('germany')) {
    console.error(`  expected user_teams to include germany, got [${slugs.join(',')}]`);
    return false;
  }
  // Timezone is still written to vip_signups.timezone.
  const row = dbRead
    .prepare('SELECT timezone FROM vip_signups WHERE email = ?')
    .get(email);
  if (!row) {
    console.error(`  expected vip_signups row for ${email}`);
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
// M6 — banner visible when user has no user_teams rows (COMPAT-01 / SC2)
// Phase 12 (12-04 Rule 1 fix): banner predicate is now userTeamSlugs.size===0
// post-12-02 (not vip_signups.team IS NULL). Seed no user_teams rows.
// ---------------------------------------------------------------------------
await runCase('M6-banner-team-null', async () => {
  const ts = Date.now();
  const email = `smoke-m6-${ts}@example.com`;
  // Simulate a pre-milestone subscriber with no user_teams rows (no teams followed).
  dbInsertSmokeRow(email, { team: null, timezone: 'America/New_York' });
  // Ensure no leftover user_teams rows for this email.
  dbWrite.prepare('DELETE FROM user_teams WHERE email = ?').run(email);

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
// M10 — POST 3 valid slugs → 303 status=saved; user_teams rows match (D-05 / D-06)
// ---------------------------------------------------------------------------
await runCase('M10-multi-save-n', async () => {
  const ts = Date.now();
  const email = `smoke-m10-${ts}@example.com`;
  dbInsertSmokeRow(email, { team: 'england', timezone: 'Europe/London' });

  const sessionToken = mintToken(email, { purpose: 'session', ttlSeconds: 60 * 60 * 24 * 30 });
  const { status, location } = await postMultiTeam(
    ['england', 'france', 'germany'],
    'Europe/London',
    `${COOKIE_NAME}=${sessionToken}`,
  );

  if (status !== 303) {
    console.error(`  expected status 303, got ${status}`);
    return false;
  }
  if (!location?.includes('status=saved')) {
    console.error(`  expected status=saved in Location, got ${location}`);
    return false;
  }

  // Assert user_teams has exactly the 3 saved slugs (sorted).
  const slugs = dbUserTeamSlugs(email);
  const expected = ['england', 'france', 'germany'];
  if (slugs.length !== expected.length || !expected.every((s, i) => s === slugs[i])) {
    console.error(`  expected user_teams=[${expected.join(',')}], got [${slugs.join(',')}]`);
    return false;
  }
  return true;
});

// ---------------------------------------------------------------------------
// M11 — GET /manage with 3 saved slugs; HTML has checked checkboxes for each (D-04)
// ---------------------------------------------------------------------------
await runCase('M11-pre-check', async () => {
  const ts = Date.now();
  const email = `smoke-m11-${ts}@example.com`;
  const savedSlugs = ['england', 'france', 'germany'];
  dbInsertSmokeRow(email, { team: 'england', timezone: 'Europe/London' });
  dbInsertUserTeams(email, savedSlugs);

  const sessionToken = mintToken(email, { purpose: 'session', ttlSeconds: 60 * 60 * 24 * 30 });
  const { status, body } = await get('/manage', {
    Cookie: `${COOKIE_NAME}=${sessionToken}`,
  });

  if (status !== 200) {
    console.error(`  expected status 200, got ${status}`);
    return false;
  }
  // Must not have <select name="team"> — should be checkboxes.
  if (body.includes('<select name="team"')) {
    console.error('  unexpected <select name="team"> in body (should be checkboxes)');
    return false;
  }
  // Each saved slug must appear in a checked checkbox input.
  for (const slug of savedSlugs) {
    // Find all occurrences of this slug's value attribute in the body;
    // at least one must be near a 'checked' attribute (within a reasonable window).
    const pattern = new RegExp(`value="${slug}"[^>]*checked|checked[^>]*value="${slug}"`, 'i');
    if (!pattern.test(body)) {
      console.error(`  expected checked checkbox for slug="${slug}" in body`);
      return false;
    }
  }
  return true;
});

// ---------------------------------------------------------------------------
// M12 — POST 6 valid slugs → 303 status=too-many; user_teams unchanged (D-05)
// ---------------------------------------------------------------------------
await runCase('M12-too-many', async () => {
  const ts = Date.now();
  const email = `smoke-m12-${ts}@example.com`;
  dbInsertSmokeRow(email, { team: 'england', timezone: 'Europe/London' });
  // Seed 2 initial user_teams rows as the pre-state.
  const preSlugs = ['england', 'france'];
  dbInsertUserTeams(email, preSlugs);

  const sessionToken = mintToken(email, { purpose: 'session', ttlSeconds: 60 * 60 * 24 * 30 });
  const { status, location } = await postMultiTeam(
    ['england', 'france', 'germany', 'spain', 'brazil', 'argentina'],
    'Europe/London',
    `${COOKIE_NAME}=${sessionToken}`,
  );

  if (status !== 303) {
    console.error(`  expected status 303, got ${status}`);
    return false;
  }
  if (!location?.includes('too-many')) {
    console.error(`  expected too-many in Location, got ${location}`);
    return false;
  }
  // user_teams must be unchanged from the pre-state (zero writes on reject).
  const slugs = dbUserTeamSlugs(email);
  if (slugs.length !== preSlugs.length || !preSlugs.every((s, i) => s === slugs[i])) {
    console.error(`  expected user_teams unchanged=[${preSlugs.join(',')}], got [${slugs.join(',')}]`);
    return false;
  }
  return true;
});

// ---------------------------------------------------------------------------
// M13 — POST 0 team values → 303 status=bad-team; user_teams unchanged (D-05)
// ---------------------------------------------------------------------------
await runCase('M13-empty-save', async () => {
  const ts = Date.now();
  const email = `smoke-m13-${ts}@example.com`;
  dbInsertSmokeRow(email, { team: 'england', timezone: 'Europe/London' });
  // Seed 2 initial user_teams rows as the pre-state.
  const preSlugs = ['england', 'france'];
  dbInsertUserTeams(email, preSlugs);

  const sessionToken = mintToken(email, { purpose: 'session', ttlSeconds: 60 * 60 * 24 * 30 });
  // POST with no team= values (only timezone).
  const { status, location } = await postMultiTeam(
    [],
    'Europe/London',
    `${COOKIE_NAME}=${sessionToken}`,
  );

  if (status !== 303) {
    console.error(`  expected status 303, got ${status}`);
    return false;
  }
  if (!location?.includes('bad-team')) {
    console.error(`  expected bad-team in Location, got ${location}`);
    return false;
  }
  // user_teams must be unchanged from the pre-state (zero writes on empty).
  const slugs = dbUserTeamSlugs(email);
  if (slugs.length !== preSlugs.length || !preSlugs.every((s, i) => s === slugs[i])) {
    console.error(`  expected user_teams unchanged=[${preSlugs.join(',')}], got [${slugs.join(',')}]`);
    return false;
  }
  return true;
});

// ---------------------------------------------------------------------------
// M14 — DB: usersQuery-equivalent JOIN through user_teams finds user (D-06 / NOTIFY-04)
// ---------------------------------------------------------------------------
await runCase('M14-cron-visibility', async () => {
  const ts = Date.now();
  const email = `smoke-m14-${ts}@example.com`;
  dbInsertSmokeRow(email, { team: null, timezone: 'Europe/London' });

  // Seed two teams in the teams table (smoke may be running against a scratch DB
  // that hasn't been ingested; create them if absent).
  const teamASlug = 'smoke-team-alpha';
  const teamBSlug = 'smoke-team-beta';
  dbWrite.prepare(`
    INSERT OR IGNORE INTO teams (id, tla, name, crest_url, slug, last_updated)
    VALUES (?, ?, ?, NULL, ?, strftime('%s','now'))
  `).run(9900001, 'STA', 'Smoke Team Alpha', teamASlug);
  dbWrite.prepare(`
    INSERT OR IGNORE INTO teams (id, tla, name, crest_url, slug, last_updated)
    VALUES (?, ?, ?, NULL, ?, strftime('%s','now'))
  `).run(9900002, 'STB', 'Smoke Team Beta', teamBSlug);

  // Seed user_teams with both slugs (user follows both teams).
  dbInsertUserTeams(email, [teamASlug, teamBSlug]);

  // Retrieve the team IDs to feed the usersQuery-equivalent.
  const rowA = dbRead.prepare('SELECT id FROM teams WHERE slug = ?').get(teamASlug);
  const rowB = dbRead.prepare('SELECT id FROM teams WHERE slug = ?').get(teamBSlug);
  if (!rowA || !rowB) {
    console.error('  could not find seeded team rows — seed failed');
    return false;
  }

  // usersQuery-equivalent SQL (matches src/lib/db.ts send-kickoff-notifications join).
  // A real match would have home_id=rowA.id and away_id=rowB.id (or vice versa).
  // The NOT EXISTS guard is skipped here (no match_notifications row pre-seeded).
  const users = dbRead.prepare(`
    SELECT DISTINCT v.email AS email, v.timezone AS timezone
    FROM vip_signups v
    JOIN user_teams ut ON ut.email = v.email
    JOIN teams t ON t.slug = ut.team_slug
    WHERE v.confirmed_at IS NOT NULL
      AND v.unsubscribed_at IS NULL
      AND t.id IN (?, ?)
  `).all(rowA.id, rowB.id);

  if (users.length !== 1) {
    console.error(`  expected exactly 1 distinct user row, got ${users.length}`);
    return false;
  }
  if (users[0].email !== email) {
    console.error(`  expected email=${email}, got ${users[0].email}`);
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
    "[smoke] cleanup: sqlite3 data/oddlympics.db \"DELETE FROM vip_signups WHERE email LIKE 'smoke-%@example.com'; DELETE FROM user_teams WHERE email LIKE 'smoke-%@example.com'\"",
  );
}

process.exit(fail === 0 ? 0 : 1);
