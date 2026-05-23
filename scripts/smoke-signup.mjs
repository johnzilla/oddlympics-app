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
//   (Requires Node 22.6+ for the in-script TS import of mintToken; on 22.0-22.5
//   add the --experimental-strip-types flag: node --experimental-strip-types ...)
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
//     "DELETE FROM vip_signups WHERE email LIKE 'smoke-%@example.com' \
//        OR email LIKE 'share-confirm-redirect-%@example.com'"

import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
// NB: requires Node 22.6+ (or --experimental-strip-types flag) for the TS import below.
// Phase 14 SHARE-confirm-redirect-location case needs to mint a real confirm token; we
// import the project's own mintToken so the smoke + server agree on token format.
import { mintToken } from '../src/lib/token.ts';

const BASE = process.env.SMOKE_BASE_URL ?? 'http://localhost:4321';
const DB_PATH = resolve(process.env.DATABASE_PATH ?? './data/oddlympics.db');
const SMOKE_IP = '192.0.2.42'; // RFC 5737 TEST-NET-1; never a real client IP
const REF_IP = '192.0.2.43'; // RFC 5737 TEST-NET-1 (distinct address); used for referral
// POST cases so they do NOT consume SMOKE_IP rate-limit slots that case-7 depends on.
// REF_IP accommodates 5 valid POSTs (A, B, direct, unknown, malformed) before its own
// rate-limit is reached. The self-ref case uses SELF_REF_IP to avoid consuming that 6th slot.
const SELF_REF_IP = '192.0.2.44'; // RFC 5737 TEST-NET-1; used only for REF-self-ref re-signup
const SHARE_IP = '192.0.2.45'; // RFC 5737 TEST-NET-1; reserved for Phase 14 share-card smoke cases

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
      'SELECT email, team, timezone, requested_sport, referral_code, referred_by FROM vip_signups WHERE email = ?',
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

// Phase 13 referral cases — all valid POSTs use REF_IP (192.0.2.43), NOT SMOKE_IP,
// so the SMOKE_IP slot count case-7 depends on is unchanged at ~3 of 5 slots used.

// REF-valid-ref: signup A gets a code; signup B with ref=A's code -> B.referred_by === A's code
await runCase('REF-valid-ref', async () => {
  const emailA = `smoke-ref-a-${Date.now()}@example.com`;
  const { status: sA, location: lA } = await post(
    { email: emailA, team: 'england', timezone: 'Europe/London' },
    { 'X-Forwarded-For': REF_IP },
  );
  if (sA !== 303 || !lA?.startsWith('/pending?email=')) {
    console.error(`  [A] expected 303 /pending?email=..., got ${sA} ${lA}`);
    return false;
  }
  const rowA = dbRowFor(emailA);
  if (!rowA?.referral_code) {
    console.error(`  [A] expected referral_code on row, got ${JSON.stringify(rowA)}`);
    return false;
  }
  const codeA = rowA.referral_code;
  if (!/^[a-z0-9]{8}$/.test(codeA)) {
    console.error(`  [A] referral_code "${codeA}" does not match /^[a-z0-9]{8}$/`);
    return false;
  }
  // Signup B with ref=codeA
  const emailB = `smoke-ref-b-${Date.now()}@example.com`;
  const { status: sB, location: lB } = await post(
    { email: emailB, team: 'france', timezone: 'Europe/Paris', ref: codeA },
    { 'X-Forwarded-For': REF_IP },
  );
  if (sB !== 303 || !lB?.startsWith('/pending?email=')) {
    console.error(`  [B] expected 303 /pending?email=..., got ${sB} ${lB}`);
    return false;
  }
  const rowB = dbRowFor(emailB);
  if (rowB?.referred_by !== codeA) {
    console.error(`  [B] expected referred_by=${codeA}, got ${JSON.stringify(rowB?.referred_by)}`);
    return false;
  }
  return true;
});

// REF-direct-no-ref: signup with no ref param -> referred_by IS NULL
await runCase('REF-direct-no-ref', async () => {
  const email = `smoke-ref-direct-${Date.now()}@example.com`;
  const { status, location } = await post(
    { email, team: 'germany', timezone: 'Europe/Berlin' },
    { 'X-Forwarded-For': REF_IP },
  );
  if (status !== 303 || !location?.startsWith('/pending?email=')) {
    console.error(`  expected 303 /pending?email=..., got ${status} ${location}`);
    return false;
  }
  const row = dbRowFor(email);
  if (row?.referred_by !== null) {
    console.error(`  expected referred_by=null, got ${JSON.stringify(row?.referred_by)}`);
    return false;
  }
  return true;
});

// REF-unknown-ref: well-formed 8-char code not in DB -> 303 /pending?email=, referred_by NULL
await runCase('REF-unknown-ref', async () => {
  const email = `smoke-ref-unk-${Date.now()}@example.com`;
  const { status, location } = await post(
    { email, team: 'brazil', timezone: 'America/Sao_Paulo', ref: 'zzzzzzzz' },
    { 'X-Forwarded-For': REF_IP },
  );
  if (status !== 303) {
    console.error(`  expected status 303, got ${status}`);
    return false;
  }
  if (!location?.startsWith('/pending?email=')) {
    console.error(`  expected /pending?email=..., got ${location}`);
    return false;
  }
  const row = dbRowFor(email);
  if (row?.referred_by !== null) {
    console.error(`  expected referred_by=null, got ${JSON.stringify(row?.referred_by)}`);
    return false;
  }
  return true;
});

// REF-malformed-ref: wrong charset -> 303 /pending?email=, referred_by NULL (SC4: never blocks)
await runCase('REF-malformed-ref', async () => {
  const email = `smoke-ref-mal-${Date.now()}@example.com`;
  const { status, location } = await post(
    { email, team: 'argentina', timezone: 'America/Buenos_Aires', ref: '!!bad!!' },
    { 'X-Forwarded-For': REF_IP },
  );
  if (status !== 303) {
    console.error(`  expected status 303, got ${status}`);
    return false;
  }
  if (!location?.startsWith('/pending?email=')) {
    console.error(`  expected /pending?email=..., got ${location}`);
    return false;
  }
  const row = dbRowFor(email);
  if (row?.referred_by !== null) {
    console.error(`  expected referred_by=null, got ${JSON.stringify(row?.referred_by)}`);
    return false;
  }
  return true;
});

// REF-self-ref: re-signup email A with A's own referral_code as ref -> referred_by stays NULL
// Uses SELF_REF_IP (192.0.2.44) — REF_IP is exhausted after 5 valid POSTs (A, B, direct,
// unknown, malformed); a 6th would be rate-limited. SELF_REF_IP keeps slot accounting clean.
await runCase('REF-self-ref', async () => {
  // Fetch emailA's code from the DB directly (it was created in REF-valid-ref above)
  const allRows = db
    .prepare("SELECT email, referral_code FROM vip_signups WHERE email LIKE 'smoke-ref-a-%@example.com'")
    .all();
  if (!allRows.length) {
    console.error('  could not find smoke-ref-a-* row from REF-valid-ref; ensure cases run in order');
    return false;
  }
  const refRow = allRows[0];
  const selfEmail = refRow.email;
  const selfCode = refRow.referral_code;
  const { status, location } = await post(
    { email: selfEmail, team: 'england', timezone: 'Europe/London', ref: selfCode },
    { 'X-Forwarded-For': SELF_REF_IP },
  );
  if (status !== 303 || !location?.startsWith('/pending?email=')) {
    console.error(`  expected 303 /pending?email=..., got ${status} ${location}`);
    return false;
  }
  const row = dbRowFor(selfEmail);
  if (row?.referred_by !== null) {
    console.error(`  expected referred_by=null (self-ref ignored), got ${JSON.stringify(row?.referred_by)}`);
    return false;
  }
  return true;
});

// REF-code-uniqueness: every row in vip_signups has a non-null, distinct referral_code (SC1)
await runCase('REF-code-uniqueness', () => {
  const rows = db.prepare('SELECT referral_code FROM vip_signups').all();
  const codes = rows.map((r) => r.referral_code);
  const nullCount = codes.filter((c) => c === null || c === undefined).length;
  if (nullCount > 0) {
    console.error(`  ${nullCount} rows have a null referral_code (SC1 violated)`);
    return false;
  }
  const unique = new Set(codes);
  if (unique.size !== codes.length) {
    console.error(`  duplicate referral_code found: ${codes.length} rows, ${unique.size} distinct`);
    return false;
  }
  return true;
});

// Phase 14 SHARE-* cases. Cases 1-2 prove prerendered-page MARKUP shipped (D-18/D-19
// page-render side): GET /pending and /confirmed with the rc + (for /pending) team
// query params, then grep the response body for share-card markers and the team label.
// Case 3 proves /api/confirm's 303 Location carries &rc=<real-code> (D-19 redirect
// side — closes the gap a synthetic-rc check leaves open). All three cases use
// SHARE_IP (192.0.2.45) so they do NOT consume SMOKE_IP rate-limit slots that case-7
// depends on. Browser-API behavior (navigator.share / navigator.clipboard) is
// operator-UAT'd per D-20 — not covered here.

// SHARE-pending-card (D-18): /pending response body contains share-card markup +
// the team label injected via TEAM_LABEL_JSON.
await runCase('SHARE-pending-card (D-18 /pending markup + team label)', async () => {
  const url = BASE + '/pending?email=share-smoke%40example.com&rc=abc12345&team=brazil';
  const res = await fetch(url);
  if (res.status !== 200) {
    console.error(`  expected 200, got ${res.status}`);
    return false;
  }
  const body = await res.text();
  const needed = ['share-card', 'share-url', 'Brazil'];
  for (const s of needed) {
    if (!body.includes(s)) {
      console.error(`  body missing: ${s}`);
      return false;
    }
  }
  return true;
});

// SHARE-confirmed-card (D-19 page-render side): /confirmed response body contains
// share-card markup. NO team label assertion (D-16: /confirmed deliberately omits
// TEAM_LABEL_JSON because the confirm 303 carries no &team=).
await runCase('SHARE-confirmed-card (D-19 page-render side)', async () => {
  const url = BASE + '/confirmed?status=ok&rc=abc12345';
  const res = await fetch(url);
  if (res.status !== 200) {
    console.error(`  expected 200, got ${res.status}`);
    return false;
  }
  const body = await res.text();
  const needed = ['share-card', 'share-url'];
  for (const s of needed) {
    if (!body.includes(s)) {
      console.error(`  body missing: ${s}`);
      return false;
    }
  }
  return true;
});

// SHARE-confirm-redirect-location (D-19 redirect side): POST a fresh signup, read the
// real referral_code from the DB, mint a confirm-purpose token, GET /api/confirm with
// manual-redirect, assert the 303 Location matches /confirmed?status=ok&rc=<real-code>.
// Second GET with same token asserts &status=already&rc=... (re-click path — D-02).
// This is the only case that catches a regression dropping &rc= from /api/confirm's
// 303 — the synthetic-rc case 2 above does not.
await runCase('SHARE-confirm-redirect-location (D-19 redirect side, real rc)', async () => {
  // Per-run unique email — case 3 confirms the row, so a fixed email would hit the
  // status=already path on a 2nd run against the same DB. Matches the established
  // smoke-${name}-${Date.now()}@example.com pattern used by cases 1, 4, 5, etc.
  const email = `share-confirm-redirect-${Date.now()}@example.com`;
  // 1. POST a fresh signup with SHARE_IP so we don't consume SMOKE_IP slots.
  //    Team slug must match references/teams.json (e.g. 'united_states', not 'usa').
  const form = {
    email,
    team: 'united_states',
    timezone: 'America/New_York',
  };
  const signupRes = await post(form, { 'X-Forwarded-For': SHARE_IP });
  if (signupRes.status !== 303) {
    console.error(`  signup expected 303, got ${signupRes.status}`);
    return false;
  }
  if (!signupRes.location?.startsWith('/pending?email=')) {
    console.error(`  signup expected /pending?email=..., got ${signupRes.location}`);
    return false;
  }
  // 2. Read the real referral_code from the DB
  const row = dbRowFor(email);
  if (!row || !row.referral_code) {
    console.error(`  no row / no referral_code for ${email}`);
    return false;
  }
  // 3. Mint a confirm-purpose token (signature: mintToken(email, { purpose }))
  const token = mintToken(email, { purpose: 'confirm' });
  // 4. First click: GET /api/confirm, assert 303 Location = /confirmed?status=ok&rc=<code>
  const confirmRes = await fetch(
    BASE + '/api/confirm?token=' + encodeURIComponent(token),
    { redirect: 'manual' },
  );
  if (confirmRes.status !== 303) {
    console.error(`  confirm expected 303, got ${confirmRes.status}`);
    return false;
  }
  const loc = confirmRes.headers.get('location');
  const expected = '/confirmed?status=ok&rc=' + encodeURIComponent(row.referral_code);
  if (loc !== expected) {
    console.error(
      `  confirm Location mismatch:\n    expected: ${expected}\n    actual:   ${loc}`,
    );
    return false;
  }
  // 5. Re-click: GET same token again, assert 303 Location = /confirmed?status=already&rc=<code>
  const confirmRes2 = await fetch(
    BASE + '/api/confirm?token=' + encodeURIComponent(token),
    { redirect: 'manual' },
  );
  if (confirmRes2.status !== 303) {
    console.error(`  re-click expected 303, got ${confirmRes2.status}`);
    return false;
  }
  const loc2 = confirmRes2.headers.get('location');
  const expected2 = '/confirmed?status=already&rc=' + encodeURIComponent(row.referral_code);
  if (loc2 !== expected2) {
    console.error(
      `  re-click Location mismatch:\n    expected: ${expected2}\n    actual:   ${loc2}`,
    );
    return false;
  }
  return true;
});

// Phase 15 SHARE-r-known (D-12b): GET /r/<real-code> proves the route emits
// personalized og:image (per-team if PNG exists, generic fallback per D-10)
// and og:title carrying "Following <Team>" (D-14). Status-agnostic per D-03 —
// any referral_code with a team works, confirmed or not.
await runCase('SHARE-r-known (D-12b: personalized og:image + og:title)', async () => {
  const row = db.prepare(
    'SELECT referral_code, team FROM vip_signups WHERE referral_code IS NOT NULL AND team IS NOT NULL LIMIT 1',
  ).get();
  if (!row) {
    console.error('  no vip_signups row with referral_code + team in DB; run a valid signup first');
    return false;
  }
  const res = await fetch(`${BASE}/r/${row.referral_code}`, { redirect: 'manual' });
  if (res.status !== 200) {
    console.error(`  expected 200, got ${res.status}`);
    return false;
  }
  const body = await res.text();
  // og:image MUST be the per-team PNG. Accepting the generic fallback would
  // mask CR-class regressions where the per-team probe silently misfires
  // (#CR-01 hardened: every VALID_TEAMS slug has a committed PNG, so a known
  // code with a valid team MUST resolve to its per-team image).
  if (!body.includes(`og:image" content="`) || !body.includes(`/og/${row.team}.png`)) {
    console.error(`  expected per-team og:image /og/${row.team}.png; got fallback or missing`);
    return false;
  }
  // og:title must carry "Following <Team> · oddlympics" (D-14)
  if (!body.match(/og:title" content="Following [^"]+ · oddlympics"/)) {
    console.error('  body missing personalized og:title');
    return false;
  }
  return true;
});

// Phase 15 SHARE-r-unknown (D-12b + D-02): GET /r/notarealcode proves the
// unresolved branch returns 200 (never 404), serves the generic og:image,
// and does NOT carry a "Following <Team>" title. Stale-link UX preserved.
await runCase('SHARE-r-unknown (D-12b + D-02: 200 + generic og:image + no team title)', async () => {
  const res = await fetch(`${BASE}/r/notarealcode`, { redirect: 'manual' });
  if (res.status !== 200) {
    console.error(`  expected 200, got ${res.status}`);
    return false;
  }
  const body = await res.text();
  // Generic og:image (absolute URL — accept both prod and localhost forms)
  const hasGenericOg =
    body.includes('og:image" content="https://oddlympics.app/og-image.png"') ||
    body.includes('og:image" content="http://localhost:4321/og-image.png"');
  if (!hasGenericOg) {
    console.error('  body missing generic og:image');
    return false;
  }
  // Must NOT have personalized "Following …" title — would mean the shape
  // gate or the unresolved-branch logic regressed.
  if (body.includes('og:title" content="Following ')) {
    console.error('  body has team-personalized og:title for unknown code (wrong)');
    return false;
  }
  return true;
});

// Case 7 — rate limit
// rate-limit.ts: MAX_PER_WINDOW = 5 per WINDOW_MS = 1h, keyed by 'ip:<ip>' AND 'email:<email>'.
// Pre-condition: prior cases (1, 4, 5) all came from SMOKE_IP and succeeded — that's 3 IP slots used.
// Plus case 6 (honeypot) short-circuits before reaching the rate limiter, so it doesn't count.
// Cases 2 and 3 hit bad-form which is BEFORE the rate limiter, also not counted.
// Phase 13 referral cases use REF_IP (192.0.2.43) or SELF_REF_IP (192.0.2.44) for valid POSTs —
// they do NOT consume SMOKE_IP slots.
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
    "[smoke] cleanup: sqlite3 data/oddlympics.db \"DELETE FROM vip_signups WHERE email LIKE 'smoke-%@example.com' OR email LIKE 'share-confirm-redirect-%@example.com'\"",
  );
}

process.exit(fail === 0 ? 0 : 1);
