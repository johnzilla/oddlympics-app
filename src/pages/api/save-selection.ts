import type { APIRoute } from 'astro';
import { db, setSelection, insertFeatureRequest } from '../../lib/db';
import { verifyToken } from '../../lib/token';
import { buildSessionCookie, readSessionFromCookie } from '../../lib/session';

export const prerender = false;

const TEAM_ID_RE = /^\d{1,8}$/;
// IANA timezones are like "America/New_York" or "UTC" — tolerate +/-, _, /, and word chars.
const TZ_RE = /^[A-Za-z][A-Za-z0-9_+\-/]{0,63}$/;

function isValidIanaTz(tz: string): boolean {
  if (!TZ_RE.test(tz)) return false;
  // Real IANA validation: Node's Intl throws RangeError on unknown zones.
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function redirectTo(token: string, status: string, setCookie?: string): Response {
  const params = new URLSearchParams({ status });
  if (token) params.set('token', token);
  const headers: Record<string, string> = { Location: `/schedule?${params}` };
  if (setCookie) headers['Set-Cookie'] = setCookie;
  return new Response(null, { status: 303, headers });
}

export const POST: APIRoute = async ({ request }) => {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return new Response('bad form', { status: 400 });
  }

  // Auth: form token (manage purpose, came from the rendered URL) OR session cookie.
  const formToken = ((form.get('token') as string) ?? '').trim();
  let result = formToken ? verifyToken(formToken, 'manage') : null;
  if (!result) result = readSessionFromCookie(request.headers.get('cookie'));
  if (!result) {
    return new Response(null, {
      status: 303,
      headers: { Location: '/manage?error=bad-token' },
    });
  }

  // Phase 5 — D-01: single-team semantics. Form still POSTs team_ids[] as integer
  // football-data IDs (Phase 9 will redesign /manage as a dedicated single-team editor).
  // Take the FIRST checked ID, resolve to the matching teams.slug, persist that.
  const rawIds = form.getAll('team_ids') as string[];
  let teamSlug: string | null = null;
  for (const raw of rawIds) {
    const s = (raw ?? '').trim();
    if (!TEAM_ID_RE.test(s)) continue;
    const n = Number(s);
    if (n <= 0) continue;
    const row = db.prepare('SELECT slug FROM teams WHERE id = ?').get(n) as { slug: string | null } | undefined;
    if (row?.slug) {
      teamSlug = row.slug;
      break;
    }
  }
  if (!teamSlug) {
    return redirectTo(formToken, 'too-many');
  }

  const tz = ((form.get('timezone') as string) ?? '').trim();
  if (!isValidIanaTz(tz)) return redirectTo(formToken, 'bad-tz');

  try {
    const updated = setSelection.get(teamSlug, tz, result.email);
    if (!updated) return redirectTo(formToken, 'unknown');

    // Phase 2.5 — LAUNCH-01-SC4: optional demand-capture textarea.
    // Whitespace-only is treated as empty (no insert). Length-cap server-side
    // (the textarea has maxlength="1000" client-side as defense-in-depth).
    // A failing insert here must NEVER gate the team-selection conversion —
    // the user clicked "Save selection", not "Submit feature request".
    const rawFeatureRequest = ((form.get('feature_request') as string | null) ?? '').trim();
    if (rawFeatureRequest.length > 0) {
      const capped = rawFeatureRequest.slice(0, 1000);
      try {
        insertFeatureRequest.run(result.email, capped);
      } catch (err) {
        console.error('[save-selection] feature_request insert failed', err);
      }
    }
  } catch (err) {
    console.error('[save-selection] db error', err);
    return redirectTo(formToken, 'server');
  }

  // Refresh the 30-day session cookie on each successful save (sliding window).
  return redirectTo(formToken, 'saved', buildSessionCookie(result.email));
};
