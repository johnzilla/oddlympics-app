#!/usr/bin/env node
// Phase 6 — Plan 03.
// End-to-end smoke verification for the v2.0 consumer landing — asserts
// LAND-01, LAND-02, FORM-01, FORM-02, FORM-03, META-01, and ANLTC-01
// against a running dev/prod server. Mirrors the Phase 5 scripts/smoke-signup.mjs
// harness shape (shebang, header comment, runCase wrapper, env override,
// server reachability probe, exit codes) but replaces DB reads with
// HTML-string grep + a pair of POST /api/signup checks. Exits 0 only when
// all cases PASS.
//
// How to run:
//   Boot a server in another terminal:
//     npm run dev
//   OR (against the built server):
//     npm run build && npm run serve
//   Then in this terminal:
//     node scripts/smoke-landing.mjs
//
//   Env (optional):
//     SMOKE_BASE_URL   default http://localhost:4321
//
// Exit codes:
//   0 = all PASS
//   1 = any FAIL
//   2 = setup error (server unreachable)
//
// Evidence tags surfaced in the output:
//   LAND-01-headline, LAND-01-banner-pill, LAND-01-footer-disclaimer
//   LAND-02-prohibited-terms
//   FORM-02-optgroup-count, FORM-02-option-count,
//   FORM-02-confederation-order, FORM-02-slug-presence
//   META-01-title, META-01-og-tags, META-01-twitter-tags
//   ANLTC-01-firing-call, ANLTC-01-plausible-init
//   FORM-03-signup-form-id, FORM-03-method-action
//   FORM-01-hidden-fields, FORM-01-post-303, FORM-01-bad-team-303-error
//
// Cleanup (operator, post-run, optional — the two POST cases write rows
// with @example.com addresses; matches the smoke-%@example.com pattern
// used by scripts/smoke-signup.mjs so one cleanup command covers both
// harnesses):
//   sqlite3 data/oddlympics.db \
//     "DELETE FROM vip_signups WHERE email LIKE 'smoke-landing-%@example.com'"

const BASE = process.env.SMOKE_BASE_URL ?? 'http://localhost:4321';
// RFC 5737 TEST-NET-1; never a real client IP. Distinct from
// scripts/smoke-signup.mjs (which uses 192.0.2.42) so the two harnesses do
// not share a rate-limit bucket when run against the same dev server
// within an hour (the rate-limit state is in-memory and only resets on
// restart). Future smokes should default to a fresh address in the
// 192.0.2.0/24 range.
const SMOKE_IP = '192.0.2.43';

console.log(`[smoke] target: ${BASE}`);

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

// Fetch the landing page once; all HTML-grep cases read from this body.
const landingRes = await fetch(`${BASE}/`);
if (landingRes.status !== 200) {
  console.error(`[smoke] FAIL: GET / returned ${landingRes.status}`);
  process.exit(2);
}
const html = await landingRes.text();

// LAND-01 — headline + banner + footer
await runCase('LAND-01-headline', () =>
  html.includes("Your team's matches. In your time zone. One ping before kickoff."));

await runCase('LAND-01-banner-pill', () =>
  html.includes('WORLD CUP 2026 · JUNE 11 – JULY 19'));

await runCase('LAND-01-footer-disclaimer', () =>
  html.includes('Independent project · Not affiliated with FIFA'));

// LAND-02 — prohibited-term scrub. Bracket char-classes in the pattern keep
// the literal prohibited substrings out of this source file (so the file
// itself passes the same grep that runs against dist/client/index.html).
await runCase('LAND-02-prohibited-terms', () =>
  !/([b]itcoin|[l]ightning|[c]rypto|[w]orld domination|[p]ersonal olympics)/i.test(html));

// FORM-02 — confederation-grouped 48-team select
await runCase('FORM-02-optgroup-count', () =>
  (html.match(/<optgroup /g) || []).length === 6);

await runCase('FORM-02-option-count', () =>
  (html.match(/<option value="/g) || []).length >= 49);

await runCase('FORM-02-confederation-order', () => {
  const order = ['UEFA', 'CONMEBOL', 'CONCACAF', 'CAF', 'AFC', 'OFC'];
  const positions = order.map((c) => html.indexOf(c));
  if (positions.some((p) => p === -1)) return false;
  for (let i = 1; i < positions.length; i++) {
    if (positions[i] <= positions[i - 1]) return false;
  }
  return true;
});

await runCase('FORM-02-slug-presence', () =>
  ['united_states', 'south_korea', 'ivory_coast', 'bosnia', 'new_zealand']
    .every((s) => html.includes(`value="${s}"`)));

// META-01 — title + 9 OG tags + 4 Twitter tags
await runCase('META-01-title', () =>
  html.includes('<title>Oddlympics — World Cup 2026 alerts in your time zone</title>'));

await runCase('META-01-og-tags', () =>
  ['og:title',
   'og:description',
   'og:type" content="website"',
   'og:url" content="https://oddlympics.app"',
   'og:site_name" content="Oddlympics"',
   'og:image" content="https://oddlympics.app/og-image.png"',
   'og:image:width" content="1200"',
   'og:image:height" content="630"',
   'og:image:alt']
    .every((t) => html.includes(t)));

await runCase('META-01-twitter-tags', () =>
  ['twitter:card" content="summary_large_image"',
   'twitter:title',
   'twitter:description',
   'twitter:image" content="https://oddlympics.app/og-image.png"']
    .every((t) => html.includes(t)));

// ANLTC-01 — Plausible firing call + init both survive the build
await runCase('ANLTC-01-firing-call', () =>
  html.includes('Signup Submit') && html.includes('getElementById'));

await runCase('ANLTC-01-plausible-init', () =>
  html.includes('plausible.io/js/pa-') && html.includes('plausible.init()'));

// FORM-03 — form id + method + action attributes
await runCase('FORM-03-signup-form-id', () =>
  html.includes('id="signup-form"'));

await runCase('FORM-03-method-action', () =>
  html.includes('method="post"') && html.includes('action="/api/signup"'));

// FORM-01 — hidden fields (timezone, requested_sport=world_cup, website honeypot)
await runCase('FORM-01-hidden-fields', () =>
  html.includes('name="timezone"') &&
  html.includes('name="requested_sport"') && html.includes('value="world_cup"') &&
  html.includes('name="website"') && html.includes('class="hp"'));

// FORM-01 — POST happy path: 303 redirect to /pending
await runCase('FORM-01-post-303', async () => {
  const { status, location } = await post({
    team: 'england',
    email: `smoke-landing-${Date.now()}@example.com`,
    timezone: 'America/Detroit',
    requested_sport: 'world_cup',
    website: '',
  });
  return status === 303 && (location || '').includes('/pending');
});

// FORM-01 — POST bad team: 303 redirect to /?error=bad-form (AC9 retained)
await runCase('FORM-01-bad-team-303-error', async () => {
  const { status, location } = await post({
    team: 'not_a_real_team',
    email: `smoke-landing-${Date.now()}@example.com`,
    timezone: 'America/Detroit',
    requested_sport: 'world_cup',
    website: '',
  });
  return status === 303 && (location || '') === '/?error=bad-form';
});

console.log(`[smoke] result: pass=${pass} fail=${fail}`);

if (fail > 0) {
  console.log(
    "[smoke] cleanup hint: sqlite3 data/oddlympics.db \"DELETE FROM vip_signups WHERE email LIKE 'smoke-landing-%@example.com'\"",
  );
}

process.exit(fail === 0 ? 0 : 1);
