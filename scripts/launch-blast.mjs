#!/usr/bin/env node
// Phase 2.5 — LAUNCH-01.
// Send a "pick your World Cup teams" magic-link email to everyone in
// vip_signups who is confirmed and not unsubscribed and hasn't already
// received the launch blast. Idempotent — reruns skip already-sent rows.
//
// SAFETY: defaults to dry-run. --send is required to actually fire emails.
//
//   node --env-file=.env scripts/launch-blast.mjs                 # dry-run, all eligible
//   node --env-file=.env scripts/launch-blast.mjs --only=foo@bar  # dry-run, single recipient
//   node --env-file=.env scripts/launch-blast.mjs --send          # really send
//   node --env-file=.env scripts/launch-blast.mjs --send --only=foo@bar
//
// Env: MAGIC_LINK_SECRET (required), RESEND_API_KEY (required for --send),
//      EMAIL_FROM, PUBLIC_SITE_URL, DATABASE_PATH.

import Database from 'better-sqlite3';
import { resolve } from 'node:path';
import { createHmac } from 'node:crypto';
import { Resend } from 'resend';

const DB_PATH = resolve(process.env.DATABASE_PATH ?? './data/oddlympics.db');
const SECRET = process.env.MAGIC_LINK_SECRET;
const API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM ?? 'oddlympics <onboarding@resend.dev>';
const SITE_URL = process.env.PUBLIC_SITE_URL ?? 'http://localhost:4321';
const TTL_SECONDS = 60 * 60 * 24; // matches src/lib/token.ts default
const THROTTLE_MS = 1500; // ~40 sends/min — well inside Resend's 10/sec, 100/day free tier

const args = process.argv.slice(2);
const SEND = args.includes('--send');
const onlyArg = args.find((a) => a.startsWith('--only='));
const ONLY = onlyArg ? onlyArg.slice('--only='.length).trim().toLowerCase() : null;

if (!SECRET) {
  console.error('[blast] MAGIC_LINK_SECRET required');
  process.exit(1);
}
if (SEND && !API_KEY) {
  console.error('[blast] RESEND_API_KEY required for --send (omit --send to dry-run)');
  process.exit(1);
}

// Token machinery — duplicates src/lib/token.ts so the script is self-contained.
function b64u(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function sign(data) {
  return b64u(createHmac('sha256', SECRET).update(data).digest());
}
function mintManageToken(email) {
  const payload = {
    email,
    exp: Math.floor(Date.now() / 1000) + TTL_SECONDS,
    purpose: 'manage',
  };
  const body = b64u(Buffer.from(JSON.stringify(payload)));
  return `${body}.${sign(body)}`;
}

const db = new Database(DB_PATH);

// Defensive: ensure the tracking column exists. Mirrors src/lib/db.ts.
{
  const cols = db
    .prepare("SELECT name FROM pragma_table_info('vip_signups')")
    .all();
  if (!cols.some((c) => c.name === 'manage_blast_sent_at')) {
    db.exec(`ALTER TABLE vip_signups ADD COLUMN manage_blast_sent_at INTEGER;`);
  }
}

const baseSql = `
  SELECT email FROM vip_signups
  WHERE confirmed_at IS NOT NULL
    AND unsubscribed_at IS NULL
    AND manage_blast_sent_at IS NULL
`;
const recipients = ONLY
  ? db.prepare(baseSql + ' AND email = ?').all(ONLY).map((r) => r.email)
  : db.prepare(baseSql + ' ORDER BY id').all().map((r) => r.email);

console.log(
  `[blast] mode=${SEND ? 'SEND' : 'dry-run'} eligible=${recipients.length}` +
    (ONLY ? ` filter=${ONLY}` : ''),
);

if (recipients.length === 0) {
  console.log('[blast] nothing to do.');
  db.close();
  process.exit(0);
}

if (!SEND) {
  console.log('[blast] would send to:');
  for (const email of recipients) console.log(`  - ${email}`);
  console.log('\n[blast] dry-run complete. Re-run with --send to actually send.');
  db.close();
  process.exit(0);
}

console.log(`[blast] throttle=${THROTTLE_MS}ms between sends. Starting…`);

const resend = new Resend(API_KEY);
const markSent = db.prepare(
  `UPDATE vip_signups SET manage_blast_sent_at = strftime('%s','now') WHERE email = ?`,
);

function buildEmail(email, url) {
  const subject = 'Pick your World Cup teams — oddlympics';
  const text = [
    'Pick the teams you want kickoff notifications for.',
    '',
    url,
    '',
    'This link is good for 24 hours. Request a new one anytime at oddlympics.app/manage.',
    '',
    '— oddlympics',
  ].join('\n');
  const html = `<!doctype html>
<html><body style="font:14px ui-monospace,SFMono-Regular,Menlo,monospace;color:#111;background:#fafafa;padding:32px">
<div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #eee;border-radius:8px;padding:28px">
  <h1 style="font-size:18px;margin:0 0 12px">Pick your teams</h1>
  <p style="margin:0 0 20px;line-height:1.55">Tap below to choose the World Cup teams you want kickoff notifications for. We'll send a single email about an hour before each match they play, in your local time.</p>
  <p style="margin:0 0 24px"><a href="${url}" style="display:inline-block;background:hsl(18 70% 56%);color:#0b0b0e;text-decoration:none;padding:12px 18px;border-radius:6px;font-weight:700">Open my schedule</a></p>
  <p style="margin:0 0 8px;color:#666;font-size:12px">Or paste this URL:</p>
  <p style="margin:0 0 24px;word-break:break-all;color:#666;font-size:12px">${url}</p>
  <p style="margin:0;color:#999;font-size:11px">This link is good for 24 hours. Request a new one anytime at oddlympics.app/manage.</p>
</div>
</body></html>`;
  return { subject, text, html };
}

let sent = 0;
let errors = 0;

for (let i = 0; i < recipients.length; i++) {
  const email = recipients[i];
  const idx = `[${i + 1}/${recipients.length}]`;
  const token = mintManageToken(email);
  const url = `${SITE_URL}/schedule?token=${encodeURIComponent(token)}`;
  const { subject, text, html } = buildEmail(email, url);

  try {
    const { error } = await resend.emails.send({ from: FROM, to: email, subject, text, html });
    if (error) {
      console.error(`  ${idx} ${email} ERROR: ${error.message ?? error}`);
      errors++;
    } else {
      markSent.run(email);
      console.log(`  ${idx} ${email} sent`);
      sent++;
    }
  } catch (err) {
    console.error(`  ${idx} ${email} EXCEPTION: ${err.message ?? err}`);
    errors++;
  }

  if (i < recipients.length - 1) {
    await new Promise((r) => setTimeout(r, THROTTLE_MS));
  }
}

console.log(`\n[blast] done. sent=${sent} errors=${errors}`);
db.close();
