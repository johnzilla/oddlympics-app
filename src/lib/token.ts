import { createHmac, timingSafeEqual } from 'node:crypto';

const SECRET = process.env.MAGIC_LINK_SECRET ?? '';
// Per-purpose TTLs: unsubscribe links are 1-year credentials so a user's
// inbox copy remains actionable without requiring a re-login flow (MANAGE-02).
// The session entry mirrors src/lib/session.ts SESSION_TTL_SECONDS for documentation
// completeness — buildSessionCookie always passes ttlSeconds explicitly so this
// entry is never reached at runtime.
const TTL_BY_PURPOSE = {
  confirm:     60 * 60 * 24,         // 24h — magic-link confirm window
  manage:      60 * 60 * 24,         // 24h — magic-link manage window
  unsubscribe: 60 * 60 * 24 * 365,   // 1y — MANAGE-02: long-lived unsubscribe credential
  session:     60 * 60 * 24 * 30,    // 30d — mirrors src/lib/session.ts SESSION_TTL_SECONDS
} as const;

if (!SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('MAGIC_LINK_SECRET is required in production');
}

const effectiveSecret = SECRET || 'dev-only-insecure-secret-do-not-use-in-prod';

type Payload = {
  email: string;
  exp: number;
  purpose?: 'confirm' | 'unsubscribe' | 'manage' | 'session';
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
  opts?: {
    purpose?: 'confirm' | 'unsubscribe' | 'manage' | 'session';
    ttlSeconds?: number;
  },
): string {
  // opts.ttlSeconds takes precedence (buildSessionCookie passes it explicitly);
  // otherwise resolve via purpose table; fall back to confirm (24h) if purpose absent.
  const ttl = opts?.ttlSeconds ?? TTL_BY_PURPOSE[opts?.purpose ?? 'confirm'];
  const payload: Payload = { email, exp: Math.floor(Date.now() / 1000) + ttl };
  if (opts?.purpose) payload.purpose = opts.purpose;
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  return `${body}.${sign(body)}`;
}

// Extract the raw HMAC signature from a token wire-format string (<body>.<sig>).
// Used by consumeManageToken in db.ts to key consumed_tokens without re-parsing.
// Does NOT verify the HMAC — verifyToken's responsibility. Returns null if malformed.
export function extractTokenSig(token: string): string | null {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const dot = token.indexOf('.');
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!body || !sig) return null;
  return sig;
}

export function verifyToken(
  token: string,
  expectedPurpose?: 'confirm' | 'unsubscribe' | 'manage' | 'session',
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
