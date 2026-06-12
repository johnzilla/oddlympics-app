#!/usr/bin/env node
// Phase 3 — NOTIFY-01, NOTIFY-03, NOTIFY-04.
// Send a kickoff notification email ~60 minutes before each match a user
// is subscribed to. Run by oddlympics-notify.timer every 5 minutes.
//
// SAFETY: the script runs in dry-run mode unless KICKOFF_NOTIFICATIONS_ENABLED=true
// is set in the environment. Dry-run logs what WOULD be sent without calling Resend.
// This lets you install the timer safely and verify it's firing before flipping
// the switch on real sends.
//
// Window: matches whose kickoff is between 55 and 65 minutes from now.
// With a 5-minute cron cadence, every match will fall in the window for 2-3
// consecutive ticks. The unique constraint on (user_email, match_id, channel)
// ensures only the first tick succeeds in sending — later ticks see the
// existing row and skip.
//
// Idempotency model: claim-before-send.
// 1. INSERT OR IGNORE into match_notifications. If we got the row, we own
//    the slot — proceed to send.
// 2. If the Resend call fails, DELETE the claim so a subsequent tick can retry.
// 3. If the Resend call succeeds, leave the claim — done.

import Database from 'better-sqlite3';
import { resolve } from 'node:path';
import { createHmac } from 'node:crypto';
import { Resend } from 'resend';

const DB_PATH = resolve(process.env.DATABASE_PATH ?? './data/oddlympics.db');
const SECRET = process.env.MAGIC_LINK_SECRET;
const API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM ?? 'oddlympics <onboarding@resend.dev>';
const SITE_URL = process.env.PUBLIC_SITE_URL ?? 'http://localhost:4321';
const ENABLED = process.env.KICKOFF_NOTIFICATIONS_ENABLED === 'true';
const TTL_SECONDS = 60 * 60 * 24;

if (!SECRET) {
  console.error('[notify] MAGIC_LINK_SECRET required');
  process.exit(1);
}
if (ENABLED && !API_KEY) {
  console.error('[notify] RESEND_API_KEY required when KICKOFF_NOTIFICATIONS_ENABLED=true');
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

// Mirror of src/lib/email.ts:buildUnsubscribeHeaders. Inlined here because the
// script is self-contained (it duplicates src/lib/token.ts to avoid a TS build
// step on the droplet). Same purpose claim (`unsubscribe`) — the resulting
// token verifies against the same MAGIC_LINK_SECRET the web app uses.
function mintUnsubscribeToken(email) {
  const payload = {
    email,
    exp: Math.floor(Date.now() / 1000) + TTL_SECONDS,
    purpose: 'unsubscribe',
  };
  const body = b64u(Buffer.from(JSON.stringify(payload)));
  return `${body}.${sign(body)}`;
}

function buildUnsubscribeHeaders(email) {
  const token = mintUnsubscribeToken(email);
  const url = `${SITE_URL}/api/unsubscribe?token=${encodeURIComponent(token)}`;
  return {
    'List-Unsubscribe': `<${url}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}

const db = new Database(DB_PATH);

// Defensive: ensure match_notifications and user_teams exist. Mirrors src/lib/db.ts.
// user_teams is needed here so the cron is self-contained if run against a DB
// that hasn't been booted through the web server yet.
db.exec(`
  CREATE TABLE IF NOT EXISTS match_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_email TEXT NOT NULL,
    match_id INTEGER NOT NULL,
    channel TEXT NOT NULL DEFAULT 'email',
    sent_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    UNIQUE (user_email, match_id, channel)
  );
  CREATE INDEX IF NOT EXISTS idx_notif_match ON match_notifications(match_id);
  CREATE TABLE IF NOT EXISTS user_teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    team_slug TEXT NOT NULL,
    UNIQUE(email, team_slug)
  );
  CREATE INDEX IF NOT EXISTS idx_user_teams_email ON user_teams(email);
`);

const matchesQuery = db.prepare(`
  SELECT m.id, m.utc_date, m.stage, m.group_name,
         h.id AS home_id, h.name AS home_name, h.tla AS home_tla,
         a.id AS away_id, a.name AS away_name, a.tla AS away_tla
  FROM matches m
  JOIN teams h ON m.home_team_id = h.id
  JOIN teams a ON m.away_team_id = a.id
  WHERE m.utc_date BETWEEN strftime('%s','now') + 55*60
                       AND strftime('%s','now') + 65*60
  ORDER BY m.utc_date
`);

// Find users subscribed to a match's home/away team.
//
// A confirmed user's followed teams are: their user_teams rows (the /manage
// multi-team editor, Phase 12) if they have any, OTHERWISE their single
// vip_signups.team pick set at signup. The LEFT JOIN + COALESCE expresses
// exactly that fallback:
//   - multi-team /manage user: ut.team_slug is non-null on every joined row,
//     so COALESCE picks it and fans out per followed team. A team they
//     deselected in /manage is NOT resurrected (v.team is never consulted
//     while any user_teams row exists for them).
//   - landing-page signup who never opened /manage (the primary funnel) OR a
//     re-subscribed user whose user_teams was cleared on unsubscribe (CR-02):
//     no user_teams rows, so the LEFT JOIN yields one row with ut.team_slug
//     NULL and COALESCE falls back to v.team — they get notified for their
//     original pick. (Pre-Phase-12 behavior; the Phase-12 INNER JOIN silently
//     dropped this entire path — #core-promise regression.)
// SELECT DISTINCT collapses a user following both teams in one match to a
// single row. NOTIFY-04 one-email-per-match is also structurally guaranteed by
// match_notifications UNIQUE(user_email, match_id, channel) + claim-before-send.
// Call site argv shape (home_id, away_id, match.id) is unchanged.
const usersQuery = db.prepare(`
  SELECT DISTINCT v.email AS email, v.timezone AS timezone, v.referral_code AS referral_code
  FROM vip_signups v
  LEFT JOIN user_teams ut ON ut.email = v.email
  JOIN teams t ON t.slug = COALESCE(ut.team_slug, v.team)
  WHERE v.confirmed_at IS NOT NULL
    AND v.unsubscribed_at IS NULL
    AND t.id IN (?, ?)
    AND NOT EXISTS (
      SELECT 1 FROM match_notifications n
      WHERE n.user_email = v.email
        AND n.match_id = ?
        AND n.channel = 'email'
    )
`);

const claimNotification = db.prepare(`
  INSERT OR IGNORE INTO match_notifications (user_email, match_id, channel)
  VALUES (?, ?, 'email')
`);

const releaseNotification = db.prepare(`
  DELETE FROM match_notifications
  WHERE user_email = ? AND match_id = ? AND channel = 'email'
`);

function formatKickoff(utcSeconds, timezone) {
  const tz = timezone || 'UTC';
  try {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: tz,
      timeZoneName: 'short',
    }).format(new Date(utcSeconds * 1000));
  } catch {
    return new Date(utcSeconds * 1000).toISOString() + ' UTC';
  }
}

function buildEmail(match, user, url) {
  const stage =
    match.group_name ?? match.stage.replace(/_/g, ' ').toLowerCase();
  const kickoff = formatKickoff(match.utc_date, user.timezone);
  // Viral loop: the kickoff email is peak excitement — give the fan their
  // personalized referral link (/r/CODE unfurls with their team image and
  // attributes the signup). referral_code is non-null in practice (Phase 13
  // backfill + per-insert); guard anyway so a null never renders a broken link.
  const shareUrl = user.referral_code ? `${SITE_URL}/r/${user.referral_code}` : null;
  const shareBlock = shareUrl
    ? `<p style="margin:0 0 24px;font-size:13px;color:#555">Know a fan who'd want their team's alerts? <a href="${shareUrl}" style="color:hsl(18 70% 56%);font-weight:700">Send them your link →</a></p>`
    : '';
  const subject = `${match.home_name} vs ${match.away_name} — kicks off in an hour`;
  const text = [
    `${match.home_name} vs ${match.away_name}`,
    `${stage} · kickoff at ${kickoff}`,
    '',
    'Your full schedule:',
    url,
    '',
    ...(shareUrl
      ? ["Know a fan who'd want their team's alerts? Send them your link:", shareUrl, '']
      : []),
    'Manage your teams or unsubscribe at oddlympics.app/manage',
    '',
    '— oddlympics',
  ].join('\n');
  const html = `<!doctype html>
<html><body style="font:14px ui-monospace,SFMono-Regular,Menlo,monospace;color:#111;background:#fafafa;padding:32px">
<div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #eee;border-radius:8px;padding:28px">
  <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:hsl(18 70% 56%)">${stage}</p>
  <h1 style="font-size:22px;margin:0 0 6px;line-height:1.2">${match.home_name} <span style="color:#999;font-weight:400">vs</span> ${match.away_name}</h1>
  <p style="margin:0 0 24px;font-size:14px;color:#555">Kickoff at <strong>${kickoff}</strong></p>
  <p style="margin:0 0 24px"><a href="${url}" style="display:inline-block;background:hsl(18 70% 56%);color:#0b0b0e;text-decoration:none;padding:12px 18px;border-radius:6px;font-weight:700">Open my schedule</a></p>
  ${shareBlock}
  <p style="margin:0;color:#999;font-size:11px">Manage your teams or unsubscribe at <a href="${SITE_URL}/manage" style="color:hsl(18 70% 56%)">oddlympics.app/manage</a>.</p>
</div>
</body></html>`;
  return { subject, text, html };
}

const matches = matchesQuery.all();
console.log(
  `[notify] mode=${ENABLED ? 'SEND' : 'dry-run'} matches-in-window=${matches.length}`,
);

if (matches.length === 0) {
  db.close();
  process.exit(0);
}

const resend = ENABLED ? new Resend(API_KEY) : null;

let totalSent = 0;
let totalErrors = 0;
let totalDryRun = 0;

for (const match of matches) {
  const users = usersQuery.all(match.home_id, match.away_id, match.id);
  if (users.length === 0) {
    console.log(
      `  match ${match.id} ${match.home_tla} vs ${match.away_tla}: 0 subscribers`,
    );
    continue;
  }

  console.log(
    `  match ${match.id} ${match.home_tla} vs ${match.away_tla}: ${users.length} subscriber(s)`,
  );

  for (const user of users) {
    const claim = claimNotification.run(user.email, match.id);
    if (claim.changes === 0) continue; // raced — another tick beat us; skip silently

    if (!ENABLED) {
      console.log(`    (dry-run) ${user.email}`);
      // Don't keep the claim in dry-run; release so future runs can retry.
      releaseNotification.run(user.email, match.id);
      totalDryRun++;
      continue;
    }

    const token = mintManageToken(user.email);
    const url = `${SITE_URL}/schedule?token=${encodeURIComponent(token)}`;
    const { subject, text, html } = buildEmail(match, user, url);

    try {
      const { error } = await resend.emails.send({
        from: FROM,
        to: user.email,
        subject,
        text,
        html,
        headers: buildUnsubscribeHeaders(user.email),
      });
      if (error) {
        console.error(`    ERROR ${user.email}: ${error.message ?? error}`);
        releaseNotification.run(user.email, match.id);
        totalErrors++;
      } else {
        console.log(`    sent ${user.email}`);
        totalSent++;
      }
    } catch (err) {
      console.error(`    EXCEPTION ${user.email}: ${err.message ?? err}`);
      releaseNotification.run(user.email, match.id);
      totalErrors++;
    }
  }
}

console.log(
  `[notify] done. sent=${totalSent} errors=${totalErrors} dry-run=${totalDryRun}`,
);
db.close();
