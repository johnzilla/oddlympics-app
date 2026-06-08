import type { APIRoute } from 'astro';
import { insertFeatureRequest, lookupByReferralCode } from '../../lib/db';
import { checkRateLimit, hashIp } from '../../lib/rate-limit';

export const prerender = false;

// The "vote on what comes next" capture from /confirmed — the bridge that turns
// a World Cup signup into a signal for the wider oddlympics community. Records
// into the existing feature_requests table (no schema change); rows are prefixed
// `next-sport:` so they triage cleanly apart from the legacy /manage free-text
// requests: SELECT request_text, COUNT(*) FROM feature_requests
//   WHERE request_text LIKE 'next-sport:%' GROUP BY request_text ORDER BY 2 DESC.
const VOTE_OPTIONS = new Set([
  'curling',
  'esports',
  'battlebots',
  'speedcubing',
  'excel',
  'drone-racing',
]);

const OTHER_MAX = 200;
const REF_RE = /^[a-z0-9]{8}$/;

// Mirror of signup.ts:15-37 — same Origin allow-list (localhost + configured
// site host) and same x-forwarded-for IP extraction so the rate limiter keys on
// the real client behind Caddy, not 127.0.0.1.
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

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request, site }) => {
  if (!originOk(request, site?.toString())) return json({ ok: false, error: 'bad-origin' }, 403);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: 'bad-form' }, 400);
  }

  if (!checkRateLimit(`vote:${hashIp(clientIp(request))}`)) {
    return json({ ok: false, error: 'rate-limited' }, 429);
  }

  const sport = ((form.get('sport') as string | null) ?? '').trim().toLowerCase();
  let requestText: string;
  if (sport === 'other') {
    const text = ((form.get('text') as string | null) ?? '').trim();
    if (!text) return json({ ok: false, error: 'empty' }, 400);
    requestText = `next-sport: other: ${text.slice(0, OTHER_MAX)}`;
  } else if (VOTE_OPTIONS.has(sport)) {
    requestText = `next-sport: ${sport}`;
  } else {
    return json({ ok: false, error: 'bad-sport' }, 400);
  }

  // Attribute via the public referral code already present in the /confirmed URL
  // (?rc=). No email ever rides the URL. Unknown/absent rc → anonymous, so the
  // aggregate vote still counts even if attribution can't be resolved.
  const rc = ((form.get('rc') as string | null) ?? '').trim().toLowerCase();
  let email = 'anonymous';
  if (REF_RE.test(rc)) {
    const row = lookupByReferralCode.get(rc) as { email: string; referral_code: string } | undefined;
    if (row) email = row.email;
  }

  try {
    insertFeatureRequest.run(email, requestText);
  } catch (err) {
    console.error('[vote] insert failed', err);
    return json({ ok: false, error: 'server' }, 500);
  }

  return json({ ok: true }, 200);
};
