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
