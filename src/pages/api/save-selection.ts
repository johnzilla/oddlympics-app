import type { APIRoute } from 'astro';
import { setSelection } from '../../lib/db';
import { verifyToken } from '../../lib/token';

export const prerender = false;

const TEAM_ID_RE = /^\d{1,8}$/;
// IANA timezones are like "America/New_York" or "UTC" — tolerate +/-, _, /, and word chars.
const TZ_RE = /^[A-Za-z][A-Za-z0-9_+\-/]{0,63}$/;

function back(token: string, status: string): Response {
  return new Response(null, {
    status: 303,
    headers: {
      Location: `/schedule?token=${encodeURIComponent(token)}&status=${encodeURIComponent(status)}`,
    },
  });
}

export const POST: APIRoute = async ({ request }) => {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return new Response('bad form', { status: 400 });
  }

  const token = ((form.get('token') as string) ?? '').trim();
  if (!token) return new Response('missing token', { status: 400 });

  const result = verifyToken(token, 'manage');
  if (!result) return back(token, 'bad-token');

  // team_ids comes as repeated form fields: team_ids=762, team_ids=769, ...
  const rawIds = form.getAll('team_ids') as string[];
  const teamIds: number[] = [];
  for (const raw of rawIds) {
    const s = (raw ?? '').trim();
    if (TEAM_ID_RE.test(s)) {
      const n = Number(s);
      if (n > 0) teamIds.push(n);
    }
  }
  // Cap at 48 (the entire field) just to bound the JSON size we store.
  if (teamIds.length > 48) {
    return back(token, 'too-many');
  }

  const tz = ((form.get('timezone') as string) ?? '').trim();
  if (!TZ_RE.test(tz)) return back(token, 'bad-tz');

  // Dedupe + sort for stable storage.
  const unique = Array.from(new Set(teamIds)).sort((a, b) => a - b);

  try {
    const updated = setSelection.get(JSON.stringify(unique), tz, result.email);
    if (!updated) return back(token, 'unknown');
  } catch (err) {
    console.error('[save-selection] db error', err);
    return back(token, 'server');
  }

  return back(token, 'saved');
};
