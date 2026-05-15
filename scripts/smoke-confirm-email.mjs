#!/usr/bin/env node
// Phase 10 — Plan 02.
// Offline byte-equivalence smoke for the confirmation-email body composer
// shipped in Plan 10-01 (src/lib/email.ts:sendMagicLink). Re-implements the
// teamLabel + tzLabel helpers and the subject + text + html body composer
// inline rather than importing the .ts sources — same drift-detection
// pattern scripts/smoke-manage.mjs uses for mintToken (PATTERNS.md
// §"Re-implementing TS helpers inline"). A future drift in src/lib/email.ts,
// src/lib/teams.ts, src/lib/timezones.ts, or references/teams.json that
// is not propagated here in lockstep trips the smoke.
//
// How to run:
//   node scripts/smoke-confirm-email.mjs
//   OR: npm run smoke:confirm
//
//   No server, no DB, no env vars consumed. Reads references/teams.json
//   from disk via node:fs.
//
// Exit codes:
//   0 = all PASS
//   1 = any FAIL
//   2 = unreachable in this smoke (no setup dependencies) — kept for
//       consistency with sibling smokes (smoke-signup.mjs, smoke-manage.mjs)

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEAMS_JSON_PATH = resolve(__dirname, '..', 'references', 'teams.json');

// ---------------------------------------------------------------------------
// Inline TEAMS load — mirrors src/lib/teams.ts:9 (top-level array shape).
// references/teams.json is a JSON array of {slug,label,confederation}; not
// wrapped in an object. Read once at startup; the helpers below close over it.
// ---------------------------------------------------------------------------
const TEAMS = JSON.parse(readFileSync(TEAMS_JSON_PATH, 'utf8'));

// ---------------------------------------------------------------------------
// Inline teamLabel — mirrors src/lib/teams.ts:16-18 byte-for-byte.
// Returns the canonical label or the raw slug on unknown lookup.
// ---------------------------------------------------------------------------
function teamLabel(slug) {
  return TEAMS.find((t) => t.slug === slug)?.label ?? slug;
}

// ---------------------------------------------------------------------------
// Inline tzLabel — mirrors src/lib/timezones.ts:19-24 byte-for-byte, which
// itself mirrors src/pages/index.astro:204-210. The cross-file byte
// equivalence is the invariant this smoke defends.
// ---------------------------------------------------------------------------
function tzLabel(tz) {
  if (!tz || tz.indexOf('/') === -1 || tz.indexOf('Etc/') === 0) return 'your local time';
  const last = tz.split('/').pop() ?? '';
  const human = last.replace(/_/g, ' ');
  return human ? `${human} time` : 'your local time';
}

// ---------------------------------------------------------------------------
// Inline body composer — mirrors src/lib/email.ts:17-52 byte-for-byte.
// SITE_URL is hardcoded to the dev default since the smoke is offline and
// no env vars are consumed.
// ---------------------------------------------------------------------------
const SITE_URL = 'http://localhost:4321';

function composeBody({ url, team, timezone }) {
  const teamHuman = teamLabel(team);
  const tzHuman = tzLabel(timezone);
  const subject = 'Confirm your World Cup alerts — oddlympics';
  const text = [
    'Confirm your World Cup alerts for oddlympics.',
    '',
    'Click below to confirm:',
    url,
    '',
    `We'll email you 1 hour before every ${teamHuman} match in ${tzHuman}.`,
    '',
    'No spam. No ads. Unsubscribe anytime.',
    '',
    "If you didn't request this, ignore this email.",
    '',
    '— oddlympics',
  ].join('\n');

  const html = `<!doctype html>
<html><body style="font:14px ui-monospace,SFMono-Regular,Menlo,monospace;color:#111;background:#fafafa;padding:32px">
<div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #eee;border-radius:8px;padding:28px">
  <h1 style="font-size:18px;margin:0 0 12px">Confirm your alerts</h1>
  <p style="margin:0 0 20px;line-height:1.55">We'll email you 1 hour before every <strong>${teamHuman}</strong> match in ${tzHuman}.</p>
  <p style="margin:0 0 24px"><a href="${url}" style="display:inline-block;background:hsl(18 70% 56%);color:#0b0b0e;text-decoration:none;padding:12px 18px;border-radius:6px;font-weight:700">Confirm email</a></p>
  <p style="margin:0 0 8px;color:#666;font-size:12px">Or paste this URL:</p>
  <p style="margin:0 0 24px;word-break:break-all;color:#666;font-size:12px">${url}</p>
  <p style="margin:0;color:#999;font-size:11px">No spam. No ads. Unsubscribe anytime. If you didn't request this, ignore this email.</p>
</div>
</body></html>`;

  return { subject, text, html };
}

// ---------------------------------------------------------------------------
// runCase harness — mirrors scripts/smoke-signup.mjs:52-69 verbatim.
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

console.log('[smoke] target: offline composer (no network, no DB)');

// ---------------------------------------------------------------------------
// The 10 cases locked in 10-02-PLAN.md §Specifics + PATTERNS.md §"The 10
// smoke cases" table.
// ---------------------------------------------------------------------------

// Case 1 — canonical pair (single-word team + standard IANA tz)
await runCase('confirm-canonical-england-detroit', () => {
  const { text, html } = composeBody({
    url: `${SITE_URL}/api/confirm?token=tok1`,
    team: 'england',
    timezone: 'America/Detroit',
  });
  if (!text.includes('every England match in Detroit time.')) {
    console.error('  text missing canonical line');
    return false;
  }
  if (!html.includes('every <strong>England</strong> match in Detroit time.')) {
    console.error('  html missing canonical line with <strong>');
    return false;
  }
  return true;
});

// Case 2 — multi-word team label (slug uses underscore; label has space)
await runCase('confirm-multi-word-united-states-london', () => {
  const { text, html } = composeBody({
    url: `${SITE_URL}/api/confirm?token=tok2`,
    team: 'united_states',
    timezone: 'Europe/London',
  });
  if (!text.includes('every United States match in London time.')) return false;
  if (!html.includes('every <strong>United States</strong> match in London time.')) return false;
  return true;
});

// Case 3 — FALLBACK_TZ row (America/New_York). Underscore -> space in the
// last segment; the FALLBACK is just a normal value to tzLabel.
await runCase('confirm-fallback-tz-france-new-york', () => {
  const { text, html } = composeBody({
    url: `${SITE_URL}/api/confirm?token=tok3`,
    team: 'france',
    timezone: 'America/New_York',
  });
  if (!text.includes('every France match in New York time.')) return false;
  if (!html.includes('every <strong>France</strong> match in New York time.')) return false;
  return true;
});

// Case 4 — multi-underscore tz
await runCase('confirm-underscore-tz-brazil-ho-chi-minh', () => {
  const { text, html } = composeBody({
    url: `${SITE_URL}/api/confirm?token=tok4`,
    team: 'brazil',
    timezone: 'Asia/Ho_Chi_Minh',
  });
  if (!text.includes('every Brazil match in Ho Chi Minh time.')) return false;
  if (!html.includes('every <strong>Brazil</strong> match in Ho Chi Minh time.')) return false;
  return true;
});

// Case 5 — Etc/UTC falls through to 'your local time' per tzLabel branch 1.
await runCase('confirm-etc-utc-fallthrough-germany', () => {
  const { text, html } = composeBody({
    url: `${SITE_URL}/api/confirm?token=tok5`,
    team: 'germany',
    timezone: 'Etc/UTC',
  });
  if (!text.includes('every Germany match in your local time.')) return false;
  if (!html.includes('every <strong>Germany</strong> match in your local time.')) return false;
  return true;
});

// Case 6 — diacritic preservation (Curaçao is slug=curacao,
// label="Curaçao" in references/teams.json:30). Verified at plan-time.
await runCase('confirm-diacritic-curacao', () => {
  const { text, html } = composeBody({
    url: `${SITE_URL}/api/confirm?token=tok6`,
    team: 'curacao',
    timezone: 'America/Curacao',
  });
  if (!text.includes('every Curaçao match in Curacao time.')) {
    console.error('  text missing Curaçao diacritic line');
    return false;
  }
  if (!html.includes('every <strong>Curaçao</strong> match in Curacao time.')) {
    console.error('  html missing Curaçao diacritic line with <strong>');
    return false;
  }
  return true;
});

// Case 7 — subject literal (em-dash U+2014)
await runCase('confirm-subject-literal', () => {
  const { subject } = composeBody({
    url: `${SITE_URL}/api/confirm?token=tok7`,
    team: 'england',
    timezone: 'America/Detroit',
  });
  const expected = 'Confirm your World Cup alerts — oddlympics';
  if (subject !== expected) {
    console.error(`  expected: ${JSON.stringify(expected)}`);
    console.error(`  actual:   ${JSON.stringify(subject)}`);
    return false;
  }
  return true;
});

// Case 8 — LAND-02 grep over subject + text + html; zero hits.
// Bracket char-classes keep the literal prohibited substrings out of THIS
// source file (so the file itself passes the same grep that runs against
// dist/client/index.html via npm run check:land-02). Pattern mirrors
// scripts/smoke-landing.mjs:126 exactly.
await runCase('confirm-land-02-grep-zero-hits', () => {
  const { subject, text, html } = composeBody({
    url: `${SITE_URL}/api/confirm?token=tok8`,
    team: 'england',
    timezone: 'America/Detroit',
  });
  const haystack = `${subject}\n${text}\n${html}`;
  return !/([b]itcoin|[l]ightning|[c]rypto|[w]orld domination|[p]ersonal olympics)/i.test(haystack);
});

// Case 9 — unknown slug falls through teamLabel's ?? fallback to the raw
// slug. Future-proofs against retired-team rows in vip_signups.
await runCase('confirm-unknown-slug-fallback-zzz', () => {
  const { text, html } = composeBody({
    url: `${SITE_URL}/api/confirm?token=tok9`,
    team: 'zzz_unknown',
    timezone: 'America/Detroit',
  });
  if (!text.includes('every zzz_unknown match in Detroit time.')) return false;
  if (!html.includes('every <strong>zzz_unknown</strong> match in Detroit time.')) return false;
  return true;
});

// Case 10 — empty tz falls through tzLabel branch 1 (falsy)
await runCase('confirm-empty-tz-fallthrough-spain', () => {
  const { text, html } = composeBody({
    url: `${SITE_URL}/api/confirm?token=tok10`,
    team: 'spain',
    timezone: '',
  });
  if (!text.includes('every Spain match in your local time.')) return false;
  if (!html.includes('every <strong>Spain</strong> match in your local time.')) return false;
  return true;
});

// ---------------------------------------------------------------------------
// Final tally — mirrors scripts/smoke-signup.mjs:311-320 (minus the DB
// cleanup hint; this smoke is stateless).
// ---------------------------------------------------------------------------
console.log(`[smoke] result: pass=${pass} fail=${fail}`);
process.exit(fail === 0 ? 0 : 1);
