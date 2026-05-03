import type { APIRoute } from 'astro';
import { verifyToken } from '../../lib/token';
import { markConfirmed, getByEmail } from '../../lib/db';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const token = url.searchParams.get('token');
  if (!token) return redirect('/confirmed?status=bad-token');

  const result = verifyToken(token);
  if (!result) return redirect('/confirmed?status=bad-token');

  const updated = markConfirmed.get(result.email);
  if (updated) return redirect('/confirmed?status=ok');

  // Already confirmed (or never signed up). Idempotent: still send to confirmed.
  const existing = getByEmail.get(result.email);
  if (existing) return redirect('/confirmed?status=already');
  return redirect('/confirmed?status=unknown');
};

function redirect(to: string): Response {
  return new Response(null, { status: 303, headers: { Location: to } });
}
