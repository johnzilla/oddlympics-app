import type { APIRoute } from 'astro';
import { verifyToken } from '../../lib/token';
import { markUnsubscribed, getByEmail } from '../../lib/db';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const token = url.searchParams.get('token');
  if (!token) return redirect('/unsubscribed?status=bad-token');

  const result = verifyToken(token, 'unsubscribe');
  if (!result) return redirect('/unsubscribed?status=bad-token');

  const updated = markUnsubscribed.get(result.email);
  if (updated) return redirect('/unsubscribed?status=ok');

  // Either already unsubscribed or no such row. Idempotent: still send to /unsubscribed.
  const existing = getByEmail.get(result.email);
  if (existing) return redirect('/unsubscribed?status=already');
  return redirect('/unsubscribed?status=unknown');
};

function redirect(to: string): Response {
  return new Response(null, { status: 303, headers: { Location: to } });
}
