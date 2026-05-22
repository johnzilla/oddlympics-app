import { randomInt } from 'node:crypto';

const CHARSET = 'abcdefghijklmnopqrstuvwxyz0123456789'; // 36 chars, [a-z0-9]

// randomInt(N) uses rejection sampling internally — no modulo bias (unlike randomBytes % N).
export function generateReferralCode(): string {
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += CHARSET[randomInt(CHARSET.length)];
  }
  return code;
}
