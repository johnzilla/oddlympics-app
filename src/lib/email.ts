import { Resend } from 'resend';
import { mintToken } from './token';
import { teamLabel } from './teams';
import { tzLabel } from './timezones';
import { NO_ACCOUNT_TITLE, NO_ACCOUNT_BODY, REENTRY_CTA } from './copy';

const API_KEY = process.env.RESEND_API_KEY ?? '';
const FROM = process.env.EMAIL_FROM ?? 'oddlympics <onboarding@resend.dev>';
const SITE_URL = process.env.PUBLIC_SITE_URL ?? 'http://localhost:4321';
const isProd = process.env.NODE_ENV === 'production';

if (!API_KEY && isProd) {
  throw new Error('RESEND_API_KEY is required in production');
}

const resend = API_KEY ? new Resend(API_KEY) : null;

export async function sendMagicLink(
  email: string,
  token: string,
  team: string,
  timezone: string,
): Promise<void> {
  const url = `${SITE_URL}/api/confirm?token=${encodeURIComponent(token)}`;
  const manageUrl = `${SITE_URL}/manage`;
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
    'Add teams, change your time zone, or follow new sports anytime — no',
    `account, no password: ${manageUrl}`,
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
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fbe9e0;border:1px solid #b8350d;border-radius:8px;margin:0 0 24px">
    <tr><td style="padding:18px 22px">
      <p style="margin:0 0 6px;font-size:15px;font-weight:bold;color:#b8350d">${NO_ACCOUNT_TITLE} Keep this email.</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#14151a">${NO_ACCOUNT_BODY}</p>
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="background:#b8350d;border-radius:6px">
          <a href="${manageUrl}" style="display:inline-block;padding:13px 26px;font-family:'Courier New',monospace;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none">${REENTRY_CTA} →</a>
        </td>
      </tr></table>
    </td></tr>
  </table>
  <p style="margin:0 0 24px"><a href="${url}" style="display:inline-block;background:hsl(18 70% 56%);color:#0b0b0e;text-decoration:none;padding:12px 18px;border-radius:6px;font-weight:700">Confirm email</a></p>
  <p style="margin:0 0 8px;color:#666;font-size:12px">Or paste this URL:</p>
  <p style="margin:0 0 24px;word-break:break-all;color:#666;font-size:12px">${url}</p>
  <p style="margin:0;color:#999;font-size:11px">No spam. No ads. Unsubscribe anytime. If you didn't request this, ignore this email.</p>
</div>
</body></html>`;

  if (!resend) {
    // Dev fallback: print the magic link to the console so you can test the flow
    // without configuring Resend.
    console.log('\n[email-dev-fallback] Magic link for', email);
    console.log('  ', url, '\n');
    console.log('   body:', `every ${teamHuman} match in ${tzHuman}`, '\n');
    return;
  }

  const { error } = await resend.emails.send({
    from: FROM,
    to: email,
    subject,
    text,
    html,
    replyTo: 'hello@oddlympics.app',
    headers: buildUnsubscribeHeaders(email),
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
}

export function buildUnsubscribeHeaders(email: string): {
  'List-Unsubscribe': string;
  'List-Unsubscribe-Post': string;
} {
  const token = mintToken(email, { purpose: 'unsubscribe' });
  const url = `${SITE_URL}/api/unsubscribe?token=${encodeURIComponent(token)}`;
  return {
    'List-Unsubscribe': `<${url}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}

export async function sendManageLink(email: string, token: string): Promise<void> {
  const url = `${SITE_URL}/manage?token=${encodeURIComponent(token)}`;
  const subject = 'Pick your World Cup teams — oddlympics';
  const text = [
    'Pick the teams you want kickoff notifications for.',
    '',
    url,
    '',
    "This link is good for 24 hours. Request a new one anytime.",
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
  <p style="margin:0;color:#999;font-size:11px">This link is good for 24 hours. If you didn't request this, ignore this email.</p>
</div>
</body></html>`;

  if (!resend) {
    console.log('\n[email-dev-fallback] Manage link for', email);
    console.log('  ', url, '\n');
    return;
  }

  const { error } = await resend.emails.send({ from: FROM, to: email, subject, text, html });
  if (error) throw new Error(`Resend error: ${error.message}`);
}
