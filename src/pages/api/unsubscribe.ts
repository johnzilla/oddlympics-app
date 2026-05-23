import type { APIRoute } from 'astro';
import { verifyToken } from '../../lib/token';
import { markUnsubscribed, getByEmail, deleteUserTeams } from '../../lib/db';

export const prerender = false;

// Core unsubscription logic — used by both GET (user-facing browser flow) and
// POST (RFC 8058 one-click). Returns a status string the handler uses to shape
// its response.
function unsubscribeByToken(token: string | null): 'ok' | 'already' | 'unknown' | 'bad-token' {
  if (!token) return 'bad-token';
  const result = verifyToken(token, 'unsubscribe');
  if (!result) return 'bad-token';

  const updated = markUnsubscribed.get(result.email);
  // CR-02: unconditional — DELETE on zero matching rows is a no-op, so this is idempotent
  // on the already-unsubscribed branch. Makes unsubscribe authoritative over user_teams so
  // a later /api/confirm → markConfirmed (which clears unsubscribed_at = NULL) cannot
  // silently re-activate stale team subscriptions for the cron without user action on /manage.
  deleteUserTeams.run(result.email);
  if (updated) return 'ok';

  // Either already unsubscribed or no such row. Idempotent.
  const existing = getByEmail.get(result.email);
  return existing ? 'already' : 'unknown';
}

export const GET: APIRoute = async ({ url }) => {
  const status = unsubscribeByToken(url.searchParams.get('token'));
  return new Response(null, {
    status: 303,
    headers: { Location: `/unsubscribed?status=${status}` },
  });
};

// RFC 8058 one-click unsubscribe — Gmail / Apple Mail / Outlook POST to the
// List-Unsubscribe URL (emitted by buildUnsubscribeHeaders in src/lib/email.ts
// and the kickoff-alert script) when the user clicks the inbox's unsubscribe
// affordance. The body is application/x-www-form-urlencoded with
// "List-Unsubscribe=One-Click"; the token rides as a ?token= query param on
// the URL the MTA was given. MTAs do not follow redirects, so we return 200
// regardless of token validity — leaking whether a token was real would let a
// scanner enumerate live recipients.
export const POST: APIRoute = async ({ url }) => {
  unsubscribeByToken(url.searchParams.get('token'));
  return new Response(null, { status: 200 });
};
