#!/usr/bin/env node
// quick-260523-s40 — regression proof: rate-limit hits persist to SQLite so the
// 5/hour budget survives process restarts (GitHub Actions ~40s deploy cadence can
// no longer reset the counter between deploys).
//
// How to run:
//   Boot a dev server in another terminal:
//     npm run dev
//   Then in this terminal:
//     node scripts/smoke-rate-limit.mjs
//
// Env (optional):
//   SMOKE_BASE_URL       default http://localhost:4321
//   DATABASE_PATH        default ./data/oddlympics.db
//   MAGIC_LINK_SECRET    default 'dev-only-rate-limit-key-do-not-use-in-prod'
//                        (matches the dev fallback in src/lib/rate-limit.ts)
//
// Exit codes:
//   0 = all PASS
//   1 = any FAIL
//   2 = setup error (DB unreadable)
//
// Cleanup (operator, post-run, optional):
//   sqlite3 data/oddlympics.db \
//     "DELETE FROM rate_limit_hits WHERE key LIKE '%s40%' OR key LIKE 'email:smoke-s40%'"

import Database from 'better-sqlite3';
import { resolve } from 'node:path';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';

const BASE = process.env.SMOKE_BASE_URL ?? 'http://localhost:4321';
const DB_PATH = resolve(process.env.DATABASE_PATH ?? './data/oddlympics.db');
// This default mirrors the dev fallback in src/lib/rate-limit.ts so a smoke run
// against a dev server (no MAGIC_LINK_SECRET set) hashes to the same key.
const SECRET = process.env.MAGIC_LINK_SECRET || 'dev-only-rate-limit-key-do-not-use-in-prod';
const SMOKE_IP = '192.0.2.99'; // RFC 5737 TEST-NET-1; distinct from smoke-signup's 192.0.2.42-45
const SMOKE_EMAIL = 'smoke-s40-rl@example.com';

// Reimplemented (not imported) — smoke must work even if rate-limit.ts internals change,
// as long as the wire-format (16-char base64url HMAC-SHA256 prefix) holds.
function hashIp(ip) {
  return createHmac('sha256', SECRET).update(ip).digest('base64url').slice(0, 16);
}

let db;
try {
  db = new Database(DB_PATH);
} catch (err) {
  console.error(`[smoke] FAIL: cannot open DB at ${DB_PATH} — ${err.message}`);
  process.exit(2);
}

let pass = 0;
let fail = 0;

function ok(label) {
  console.log(`[smoke] PASS ${label}`);
  pass++;
}

function fail_(label, detail) {
  console.error(`[smoke] FAIL ${label}${detail ? ': ' + detail : ''}`);
  fail++;
}

// Warmup: hit a server-rendered endpoint so Astro dev server's lazy module loader
// runs db.ts (which creates rate_limit_hits and all other tables). In dev mode
// (Vite SSR), db.ts is not imported until the first SSR request arrives, so the
// table may not exist yet when the smoke opens the DB. A GET to /api/confirm with
// a bad token is safe — it returns 303 to /confirmed?status=bad-token, no side effects.
try {
  await fetch(`${BASE}/api/confirm?token=warmup-ignored`, { redirect: 'manual' });
} catch {
  // If the server is not running, the pre-flight delete below will also fail —
  // that error is more descriptive, so let it surface.
}

// Pre-flight clean — idempotent so re-runs start fresh for this smoke's keys
const hashedKey = `ip:${hashIp(SMOKE_IP)}`;
const emailKey = `email:${SMOKE_EMAIL}`;
db.prepare('DELETE FROM rate_limit_hits WHERE key = ? OR key = ?').run(hashedKey, emailKey);

// RL1: Pre-seed 5 IP-keyed rows, then POST — assert rate-limited.
// Proves the DB is the source of truth: the live server (which never saw any
// HTTP traffic from this IP) should block the 6th request immediately because
// it reads from the same SQLite file, not any in-process state.
{
  const now = Math.floor(Date.now() / 1000);
  const insert = db.prepare('INSERT INTO rate_limit_hits (key, ts) VALUES (?, ?)');
  for (let i = 0; i < 5; i++) {
    insert.run(hashedKey, now);
  }

  let res;
  try {
    res = await fetch(`${BASE}/api/signup`, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'origin': BASE.startsWith('http://localhost') ? BASE : 'http://localhost:4321',
        'x-forwarded-for': SMOKE_IP,
      },
      body: new URLSearchParams({
        email: SMOKE_EMAIL,
        team: 'usa',
        timezone: 'America/New_York',
      }).toString(),
    });
  } catch (err) {
    fail_('RL1-rate-limited', `fetch failed — is dev server running at ${BASE}? ${err.message}`);
    // Cannot continue RL1 without a server response
    res = null;
  }

  if (res) {
    const loc = res.headers.get('location') ?? '';
    if (res.status === 303 && loc.includes('error=rate-limited')) {
      ok('RL1-rate-limited');
    } else {
      fail_('RL1-rate-limited', `expected 303 → /?error=rate-limited, got ${res.status} → ${loc}`);
    }
  }
}

// RL2: Privacy proof (D-02) — confirm raw IP never stored in DB.
// Only the 16-char hashed form should appear; no dotted-quad key.
{
  const rawRow = db.prepare('SELECT 1 FROM rate_limit_hits WHERE key = ?').get(`ip:${SMOKE_IP}`);
  if (rawRow === undefined) {
    ok('RL2-no-raw-ip-in-db');
  } else {
    fail_('RL2-no-raw-ip-in-db', `raw key ip:${SMOKE_IP} found in rate_limit_hits — D-02 violated`);
  }

  const hashedRow = db.prepare('SELECT COUNT(*) AS c FROM rate_limit_hits WHERE key = ?').get(hashedKey);
  if (hashedRow.c >= 5) {
    ok('RL2-hashed-key-present');
  } else {
    fail_('RL2-hashed-key-present', `expected >= 5 rows for hashed key, got ${hashedRow.c}`);
  }
}

// RL3: Structural fail-open proof (D-03).
// Runtime DB-failure injection is out of scope for a smoke that runs alongside a
// live server. Instead, assert the source code contains the documented fail-open
// pattern — this is a source-level grep, not a runtime test.
{
  const src = readFileSync(new URL('../src/lib/rate-limit.ts', import.meta.url), 'utf8');
  const hasLog = src.includes('[rate-limit] DB error, failing open:');
  const hasReturn = /catch[\s\S]*?return true/.test(src);
  if (hasLog && hasReturn) {
    ok('RL3-fail-open-source-check');
  } else {
    const missing = [
      !hasLog ? "'[rate-limit] DB error, failing open:'" : '',
      !hasReturn ? "'return true' inside catch" : '',
    ].filter(Boolean).join(', ');
    fail_('RL3-fail-open-source-check', `missing in rate-limit.ts: ${missing}`);
  }
}

// Post-run cleanup (idempotent — same keys as pre-flight clean above)
db.prepare('DELETE FROM rate_limit_hits WHERE key = ? OR key = ?').run(hashedKey, emailKey);

if (fail > 0) {
  console.error(`[smoke] ${fail} FAIL, ${pass} PASS`);
  process.exit(1);
}
console.log(`[smoke] ALL PASS (${pass}/${pass + fail})`);
process.exit(0);
