// Shared team-name → slug resolver for ingest-schedule.mjs and
// backfill-team-slugs.mjs. Centralised here so the exact resolution order
// is authoritative and cannot drift between the two consumers.
//
// Resolution order (first match wins):
//   (a) Exact label match   — byte-identical to the old labelToSlug.get(name)
//   (b) Normalized match    — NFD + strip combining marks + lowercase + & →
//                             and + strip -.'  + collapse whitespace + trim
//   (c) Alias map           — explicit BEST-EFFORT map for known football-data.org
//                             v4 national-team name divergences; matched via the
//                             same normalize() so spelling variants also hit
//   (d) null                — caller logs [ingest] no-slug or [backfill] WARN

// Normalize a raw string to a canonical comparison form.
// Applied to BOTH catalog labels AND resolver inputs so any matching is done
// in the same normalized space, avoiding case/diacritic/punctuation drift.
function normalize(s) {
  return s
    .normalize('NFD')
    // Strip combining diacritical marks (U+0300–U+036F)
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    // Normalize ampersand to "and" for "Bosnia & Herzegovina" variants
    .replace(/&/g, 'and')
    // Strip hyphens, dots, ASCII apostrophes (0x27), curly apostrophes (U+2019)
    .replace(/[-.''’]/g, '')
    // Collapse runs of whitespace to a single space, then trim
    .replace(/\s+/g, ' ')
    .trim();
}

// BEST-EFFORT alias map for known football-data.org v4 national-team name
// divergences that the normalized layer alone cannot bridge (e.g. "Korea
// Republic" vs "South Korea" — a political naming difference, not a
// diacritic/punctuation/case difference).
//
// Keys are run through normalize() at factory build time, so minor spelling
// variants of these keys (e.g. "IR  Iran" with extra space) also resolve.
//
// This list is a point-in-time snapshot of the KNOWN divergences observed
// before the 2026 World Cup draw. football-data.org may rename teams at any
// time. The DEFINITIVE empirical check is a one-off operator command:
//   curl -s "https://api.football-data.org/v4/competitions/WC/teams" \
//     -H "X-Auth-Token: $FOOTBALL_DATA_API_KEY" | \
//     jq -r '.teams[].name' | sort > /tmp/api-names.txt && \
//     jq -r '.[].label' references/teams.json | sort > /tmp/catalog-labels.txt && \
//     comm -23 /tmp/api-names.txt /tmp/catalog-labels.txt
// Do NOT automate or schedule this check — it burns free-tier quota.
const ALIASES = {
  'Korea Republic':           'south_korea',
  'IR Iran':                  'iran',
  'Czechia':                  'czech_republic',
  'Cabo Verde':               'cape_verde',
  "Côte d'Ivoire":           'ivory_coast',
  "Cote d'Ivoire":           'ivory_coast',
  'Congo DR':                 'dr_congo',
  'DR Congo':                 'dr_congo',
  'USA':                      'united_states',
  'United States':            'united_states',
  'Bosnia & Herzegovina':    'bosnia',
  'Bosnia-Herzegovina':      'bosnia',
};

/**
 * Build a (name: string) => string | null resolver from a teams catalog array.
 *
 * @param {Array<{slug: string, label: string}>} teamsCatalog
 * @returns {(name: string) => string | null}
 */
export function createTeamSlugResolver(teamsCatalog) {
  // (a) Exact label → slug
  const exact = new Map(teamsCatalog.map((t) => [t.label, t.slug]));

  // (b) Normalized catalog label → slug (built once, O(1) lookups)
  const normalized = new Map(teamsCatalog.map((t) => [normalize(t.label), t.slug]));

  // (c) Normalized alias key → slug
  const aliased = new Map(
    Object.entries(ALIASES).map(([key, slug]) => [normalize(key), slug]),
  );

  return function resolveTeamSlug(name) {
    // (a) exact
    const exactHit = exact.get(name);
    if (exactHit !== undefined) return exactHit;

    // (b) normalized
    const normKey = normalize(name);
    const normHit = normalized.get(normKey);
    if (normHit !== undefined) return normHit;

    // (c) alias (keys already normalized at factory build time)
    const aliasHit = aliased.get(normKey);
    if (aliasHit !== undefined) return aliasHit;

    // (d) unresolved — caller decides what to log
    return null;
  };
}
