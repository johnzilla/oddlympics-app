import type { APIRoute } from 'astro';
import { upsertVipSignup } from '../../lib/db';
import { mintToken } from '../../lib/token';
import { sendMagicLink } from '../../lib/email';
import { checkRateLimit } from '../../lib/rate-limit';

export const prerender = false;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_SPORTS = new Set(['world_cup', 'olympics', 'strongman', 'cubing', 'other']);

function clientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

function originOk(request: Request, siteUrl: string | undefined): boolean {
  // Block obvious cross-site POSTs. Same-origin browser submits include the
  // matching Origin header.
  const origin = request.headers.get('origin');
  if (!origin) return true; // some same-origin form posts omit Origin; fall back to allow
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
    headers: { Location: `/?error=${encodeURIComponent(message)}` },
  });
}

export const POST: APIRoute = async ({ request, site }) => {
  if (!originOk(request, site?.toString())) {
    return back('bad-origin');
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return back('bad-form');
  }

  // Honeypot: bots fill this; humans don't see it.
  if (((form.get('website') as string) ?? '').trim() !== '') {
    // Pretend success to keep bots silent.
    return new Response(null, { status: 303, headers: { Location: '/pending' } });
  }

  const rawEmail = ((form.get('email') as string) ?? '').trim().toLowerCase();
  const sport = ((form.get('requested_sport') as string) ?? 'world_cup').trim();

  if (!EMAIL_RE.test(rawEmail) || rawEmail.length > 254) {
    return back('bad-email');
  }
  const requestedSport = VALID_SPORTS.has(sport) ? sport : 'other';

  const ip = clientIp(request);
  if (!checkRateLimit(`ip:${ip}`)) return back('rate-limited');
  if (!checkRateLimit(`email:${rawEmail}`)) return back('rate-limited');

  try {
    upsertVipSignup.get(
      rawEmail,
      requestedSport,
      ip === 'unknown' ? null : ip,
      request.headers.get('user-agent'),
    );
  } catch (err) {
    console.error('[signup] db error', err);
    return back('server');
  }

  const token = mintToken(rawEmail);

  try {
    await sendMagicLink(rawEmail, token);
  } catch (err) {
    console.error('[signup] email error', err);
    return back('email');
  }

  return new Response(null, {
    status: 303,
    headers: { Location: `/pending?email=${encodeURIComponent(rawEmail)}` },
  });
};
