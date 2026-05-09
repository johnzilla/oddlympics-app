import { mintToken, verifyToken } from './token';

const COOKIE_NAME = 'oddlympics_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

const isProd = process.env.NODE_ENV === 'production';

export function buildSessionCookie(email: string): string {
  const token = mintToken(email, {
    purpose: 'session',
    ttlSeconds: SESSION_TTL_SECONDS,
  });
  const parts = [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ];
  if (isProd) parts.push('Secure');
  return parts.join('; ');
}

export function clearSessionCookie(): string {
  const parts = [
    `${COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ];
  if (isProd) parts.push('Secure');
  return parts.join('; ');
}

export function readSessionFromCookie(
  cookieHeader: string | null | undefined,
): { email: string } | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const name = trimmed.slice(0, eq);
    if (name !== COOKIE_NAME) continue;
    const value = trimmed.slice(eq + 1);
    return verifyToken(value, 'session');
  }
  return null;
}
