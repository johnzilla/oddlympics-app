import { Resend } from 'resend';
import { mintToken } from './token';

const API_KEY = process.env.RESEND_API_KEY ?? '';
const FROM = process.env.EMAIL_FROM ?? 'oddlympics <onboarding@resend.dev>';
const SITE_URL = process.env.PUBLIC_SITE_URL ?? 'http://localhost:4321';
const isProd = process.env.NODE_ENV === 'production';

if (!API_KEY && isProd) {
  throw new Error('RESEND_API_KEY is required in production');
}

const resend = API_KEY ? new Resend(API_KEY) : null;

export async function sendMagicLink(email: string, token: string): Promise<void> {
  const url = `${SITE_URL}/api/confirm?token=${encodeURIComponent(token)}`;
  const subject = 'Confirm your spot — oddlympics';
  const text = [
    'Confirm your VIP spot for oddlympics.',
    '',
    'Click the link below to lock in your early access:',
    url,
    '',
    "We'll email you when it's time. No spam, no marketing — just the launch ping.",
    '',
    "If you didn't request this, ignore this email.",
    '',
    '— oddlympics',
  ].join('\n');

  const html = `<!doctype html>
<html><body style="font:14px ui-monospace,SFMono-Regular,Menlo,monospace;color:#111;background:#fafafa;padding:32px">
<div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #eee;border-radius:8px;padding:28px">
  <h1 style="font-size:18px;margin:0 0 12px">Confirm your spot</h1>
  <p style="margin:0 0 20px;line-height:1.55">Click below to lock in your early access for <strong>oddlympics</strong>.</p>
  <p style="margin:0 0 24px"><a href="${url}" style="display:inline-block;background:hsl(18 70% 56%);color:#0b0b0e;text-decoration:none;padding:12px 18px;border-radius:6px;font-weight:700">Confirm email</a></p>
  <p style="margin:0 0 8px;color:#666;font-size:12px">Or paste this URL:</p>
  <p style="margin:0 0 24px;word-break:break-all;color:#666;font-size:12px">${url}</p>
  <p style="margin:0;color:#999;font-size:11px">No spam, no marketing — just the launch ping. If you didn't request this, ignore this email.</p>
</div>
</body></html>`;

  if (!resend) {
    // Dev fallback: print the magic link to the console so you can test the flow
    // without configuring Resend.
    console.log('\n[email-dev-fallback] Magic link for', email);
    console.log('  ', url, '\n');
    return;
  }

  const { error } = await resend.emails.send({ from: FROM, to: email, subject, text, html });
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
