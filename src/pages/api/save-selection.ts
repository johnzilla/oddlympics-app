import type { APIRoute } from 'astro';
import { db, deleteUserTeams, insertUserTeam, updateTimezone, insertFeatureRequest } from '../../lib/db';
import { verifyToken } from '../../lib/token';
import { buildSessionCookie, readSessionFromCookie } from '../../lib/session';
import { VALID_TEAMS } from '../../lib/teams';

export const prerender = false;

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
  const headers: Record<string, string> = { Location: `/manage?${params}` };
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

  // Parse all `team` values from the multi-checkbox form.
  const rawSlugs = (form.getAll('team') as string[])
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);

  // Validate all slugs against VALID_TEAMS allow-list.
  const validSlugs = rawSlugs.filter((s) => VALID_TEAMS.has(s));
  const hasBadSlug = rawSlugs.length !== validSlugs.length;

  if (hasBadSlug || validSlugs.length === 0) {
    console.error(`[save-selection] bad-team: raw=${rawSlugs.join(',')} valid=${validSlugs.join(',')}`);
    return redirectTo(formToken, 'bad-team');
  }
  if (validSlugs.length > 5) {
    console.error(`[save-selection] too-many: count=${validSlugs.length}`);
    return redirectTo(formToken, 'too-many');
  }

  const tz = ((form.get('timezone') as string) ?? '').trim();
  if (!isValidIanaTz(tz)) return redirectTo(formToken, 'bad-tz');

  try {
    // Team picks and timezone are one atomic unit — a rolled-back transaction
    // leaves both unchanged, preventing a state where team rows changed but tz did not.
    const saveSelection = db.transaction((email: string, slugs: string[], timezone: string) => {
      deleteUserTeams.run(email);
      for (const slug of slugs) insertUserTeam.run(email, slug);
      updateTimezone.run(timezone, email);
    });
    saveSelection(result.email, validSlugs, tz);

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
