export const FALLBACK_TZ = 'America/New_York' as const;

function buildTzSet(): ReadonlySet<string> {
  try {
    return new Set(Intl.supportedValuesOf('timeZone'));
  } catch {
    return new Set([FALLBACK_TZ]);
  }
}

export const VALID_TZ: ReadonlySet<string> = buildTzSet();

export function isValidTimezone(tz: string): boolean {
  return VALID_TZ.has(tz);
}

// Mirrors src/pages/index.astro:204-210 byte-for-byte — the email-side label
// and the landing-side label must agree on every input the user could see.
export function tzLabel(tz: string): string {
  if (!tz || tz.indexOf('/') === -1 || tz.indexOf('Etc/') === 0) return 'your local time';
  const last = tz.split('/').pop() ?? '';
  const human = last.replace(/_/g, ' ');
  return human ? `${human} time` : 'your local time';
}
