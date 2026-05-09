import { createHmac, timingSafeEqual } from 'node:crypto';

const SECRET = process.env.MAGIC_LINK_SECRET ?? '';
const TTL_SECONDS = 60 * 60 * 24; // 24 hours

if (!SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('MAGIC_LINK_SECRET is required in production');
}

const effectiveSecret = SECRET || 'dev-only-insecure-secret-do-not-use-in-prod';

type Payload = {
  email: string;
  exp: number;
  purpose?: 'confirm' | 'unsubscribe';
};

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function sign(data: string): string {
  return b64url(createHmac('sha256', effectiveSecret).update(data).digest());
}

export function mintToken(
  email: string,
  opts?: { purpose?: 'confirm' | 'unsubscribe' },
): string {
  const payload: Payload = { email, exp: Math.floor(Date.now() / 1000) + TTL_SECONDS };
  if (opts?.purpose) payload.purpose = opts.purpose;
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  return `${body}.${sign(body)}`;
}

export function verifyToken(
  token: string,
  expectedPurpose?: 'confirm' | 'unsubscribe',
): { email: string } | null {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;

  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let payload: Payload;
  try {
    payload = JSON.parse(fromB64url(body).toString('utf8'));
  } catch {
    return null;
  }
  if (typeof payload.email !== 'string' || typeof payload.exp !== 'number') return null;
  if (Math.floor(Date.now() / 1000) > payload.exp) return null;

  if (expectedPurpose) {
    // Legacy tokens (minted before D-06) have no purpose field; treat them as 'confirm'
    // for backward compatibility per D-04 (no proactive invalidation of in-flight tokens).
    const tokenPurpose = payload.purpose ?? 'confirm';
    if (tokenPurpose !== expectedPurpose) return null;
  }

  return { email: payload.email };
}
