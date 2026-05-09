import type { APIRoute } from 'astro';
import { getByEmail } from '../../lib/db';
import { mintToken } from '../../lib/token';
import { sendManageLink } from '../../lib/email';
import { checkRateLimit } from '../../lib/rate-limit';

export const prerender = false;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

function originOk(request: Request, siteUrl: string | undefined): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    const o = new URL(origin);
    if (o.hostname === 'localhost' || o.hostname === '127.0.0.1') return true;
    if (siteUrl) {
      const s = new URL(siteUrl);
      return o.host === s.host;
    }
    return false;
  } catch {
    return false;
  }
}

function back(message: string): Response {
  return new Response(null, {
    status: 303,
    headers: { Location: `/manage?error=${encodeURIComponent(message)}` },
  });
}

export const POST: APIRoute = async ({ request, site }) => {
  if (!originOk(request, site?.toString())) return back('bad-origin');

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return back('bad-form');
  }

  // Honeypot: bots fill this; humans don't see it.
  if (((form.get('website') as string) ?? '').trim() !== '') {
    // Pretend success to keep bots silent and to avoid leaking which emails are on the list.
    return new Response(null, { status: 303, headers: { Location: '/pending?action=manage' } });
  }

  const rawEmail = ((form.get('email') as string) ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(rawEmail) || rawEmail.length > 254) return back('bad-email');

  const ip = clientIp(request);
  if (!checkRateLimit(`ip:${ip}`)) return back('rate-limited');
  if (!checkRateLimit(`email:${rawEmail}`)) return back('rate-limited');

  // Look up the row, but always 303 to /pending regardless of result.
  // We must not leak whether the email is on the list.
  let row: unknown;
  try {
    row = getByEmail.get(rawEmail);
  } catch (err) {
    console.error('[manage] db error', err);
    return back('server');
  }

  // Only send if confirmed and not unsubscribed. Silent no-op otherwise.
  const r = row as
    | { confirmed_at: number | null; unsubscribed_at: number | null }
    | undefined;
  const eligible = r && r.confirmed_at !== null && r.unsubscribed_at === null;

  if (eligible) {
    const token = mintToken(rawEmail, { purpose: 'manage' });
    try {
      await sendManageLink(rawEmail, token);
    } catch (err) {
      console.error('[manage] email error', err);
      return back('email');
    }
  }

  // Same response for eligible + ineligible: enumeration-safe.
  return new Response(null, {
    status: 303,
    headers: { Location: `/pending?action=manage&email=${encodeURIComponent(rawEmail)}` },
  });
};
