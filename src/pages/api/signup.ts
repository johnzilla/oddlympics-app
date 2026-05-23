import type { APIRoute } from 'astro';
import { upsertVipSignup, lookupByReferralCode, type VipSignup } from '../../lib/db';
import { mintToken } from '../../lib/token';
import { sendMagicLink } from '../../lib/email';
import { checkRateLimit } from '../../lib/rate-limit';
import { VALID_TEAMS } from '../../lib/teams';
import { VALID_TZ, FALLBACK_TZ } from '../../lib/timezones';
import { generateReferralCode } from '../../lib/referral';

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
  if (!origin) return false; // modern browsers attach Origin to cross-origin form POSTs; treat absence as suspicious
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

  // Phase 5 — SIGNUP-01 / COMPAT-02: team must be a known slug from references/teams.json.
  const rawTeam = ((form.get('team') as string | null) ?? '').trim().toLowerCase();
  if (!VALID_TEAMS.has(rawTeam)) {
    console.log(`[signup] bad-team rejected email=${rawEmail} input=${JSON.stringify(rawTeam)}`);
    return back('bad-form');
  }

  // Phase 5 — SIGNUP-02: timezone fallback (does NOT reject).
  const rawTz = ((form.get('timezone') as string | null) ?? '').trim();
  let tz: string;
  if (rawTz && VALID_TZ.has(rawTz)) {
    tz = rawTz;
  } else {
    tz = FALLBACK_TZ;
    console.log(`[signup] tz-fallback email=${rawEmail} input=${JSON.stringify(rawTz)}`);
  }

  // Phase 13 — REF-03: ref resolution (D-09 insertion point — post-validation, pre-upsert).
  // Mirrors the tz-fallback "never rejects, silent fallback" model (D-08/SC4):
  // an unknown, malformed, or self-referencing ref stays NULL — signup always 303s normally.
  // MUST NOT call back() or throw on a bad ref.
  const rawRef = ((form.get('ref') as string | null) ?? '').trim().toLowerCase();
  let referredBy: string | null = null;
  if (rawRef) {
    const refRow = lookupByReferralCode.get(rawRef) as { email: string; referral_code: string } | undefined;
    if (refRow && refRow.email !== rawEmail) {
      // Valid ref, different owner — set attribution
      referredBy = refRow.referral_code;
    } else if (refRow && refRow.email === rawEmail) {
      // Self-referral: silently ignore (T-13-04)
      console.log(`[signup] ref-self-referral email=${rawEmail} ref=${JSON.stringify(rawRef)}`);
    } else {
      // Unknown/malformed ref: silently ignore (D-08)
      console.log(`[signup] ref-unknown email=${rawEmail} ref=${JSON.stringify(rawRef)}`);
    }
  }

  // Generate a fresh referral_code for this new row (D-04).
  // COALESCE in upsertVipSignup preserves the existing code on re-signup — breaks are avoided.
  // The referral_code UNIQUE index can raise SQLITE_CONSTRAINT_UNIQUE on the INSERT
  // branch; regenerate + retry on collision so a code clash never drops a legitimate
  // signup (mirrors the backfill retry loop in db.ts — both paths must stay consistent).
  let referralCode = generateReferralCode();
  let upserted = false;
  let row: VipSignup | undefined;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      row = upsertVipSignup.get(
        rawEmail,
        requestedSport,
        ip === 'unknown' ? null : ip,
        request.headers.get('user-agent'),
        rawTeam,
        tz,
        referralCode,
        referredBy,
      ) as VipSignup | undefined;
      upserted = true;
      break;
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        'code' in err &&
        (err as { code: string }).code === 'SQLITE_CONSTRAINT_UNIQUE'
      ) {
        // referral_code collision (astronomically rare at ~3.6e-13 per attempt); regenerate
        referralCode = generateReferralCode();
        continue;
      }
      // Not a collision — a real DB fault.
      console.error('[signup] db error', err);
      return back('server');
    }
  }
  if (!upserted) {
    console.error('[signup] db error: referral_code collision retries exhausted');
    return back('server');
  }
  // Defensive: RETURNING * should always populate row.referral_code post-Phase-13,
  // but the VipSignup type declares it `string | null` (db.ts:125) — narrow here so
  // the Location header below can assume non-null without a `!`.
  if (!row || !row.referral_code) {
    console.error('[signup] db error: upsert returned no row');
    return back('server');
  }

  const token = mintToken(rawEmail);

  try {
    await sendMagicLink(rawEmail, token, rawTeam, tz, row.referral_code ?? '');
  } catch (err) {
    console.error('[signup] email error', err);
    return back('email');
  }

  return new Response(null, {
    status: 303,
    headers: {
      Location: `/pending?email=${encodeURIComponent(rawEmail)}&rc=${encodeURIComponent(row.referral_code)}&team=${encodeURIComponent(rawTeam)}`,
    },
  });
};
