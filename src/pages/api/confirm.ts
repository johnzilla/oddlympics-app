import type { APIRoute } from 'astro';
import { verifyToken } from '../../lib/token';
import { markConfirmed, getByEmail, type VipSignup } from '../../lib/db';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const token = url.searchParams.get('token');
  if (!token) return redirect('/confirmed?status=bad-token');

  const result = verifyToken(token);
  if (!result) return redirect('/confirmed?status=bad-token');

  // D-02: status=ok carries &rc= so /confirmed's inline script can populate the share UI.
  // VipSignup.referral_code is typed `string | null` (db.ts:125); the Phase 13 backfill +
  // per-insert generation makes it non-null in practice, but we null-guard rather than
  // crash if the invariant ever breaks.
  const updated = markConfirmed.get(result.email) as VipSignup | undefined;
  if (updated) {
    return updated.referral_code
      ? redirect(`/confirmed?status=ok&rc=${encodeURIComponent(updated.referral_code)}`)
      : redirect('/confirmed?status=ok');
  }

  // Already confirmed (or never signed up). Idempotent: still send to confirmed.
  // D-02: a re-clicker is still a signed-up user — also append &rc= when available.
  const existing = getByEmail.get(result.email) as VipSignup | undefined;
  if (existing) {
    return existing.referral_code
      ? redirect(`/confirmed?status=already&rc=${encodeURIComponent(existing.referral_code)}`)
      : redirect('/confirmed?status=already');
  }
  // D-02: unknown / bad-token deliberately skip &rc= — nothing meaningful to share.
  return redirect('/confirmed?status=unknown');
};

function redirect(to: string): Response {
  return new Response(null, { status: 303, headers: { Location: to } });
}
