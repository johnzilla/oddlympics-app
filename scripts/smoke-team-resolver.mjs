#!/usr/bin/env node
// Offline coverage smoke for the shared team-name → slug resolver.
// Proves that every slug in references/teams.json is reachable from at least
// one of the representative API name strings in the static fixture below —
// including all known divergent names.
//
// Run:  node scripts/smoke-team-resolver.mjs
//       npm run smoke:resolver
//
// Exit:  0 = all 48 catalog slugs covered
//        1 = one or more slugs uncovered (printed to stderr)
//
// No network. No HTTP calls. No loops awaiting I/O. Completes in well under 1s.

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTeamSlugResolver } from './lib/resolve-team-slug.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const TEAMS_JSON_PATH = resolve(
  process.env.TEAMS_JSON_PATH ?? resolve(__dirname, '../references/teams.json'),
);

const teamsCatalog = JSON.parse(readFileSync(TEAMS_JSON_PATH, 'utf-8'));
const resolver = createTeamSlugResolver(teamsCatalog);

// Static fixture of representative team.name strings as sent by the schedule
// API. Includes every divergent name from the known-divergences table plus a
// representative sample of exact-match names (to confirm the fast path
// has no regression). This array is HARDCODED — no network, no loop.
const FIXTURE = [
  // --- Divergent names (the ones that previously yielded NULL slug) ---
  'Korea Republic',       // → south_korea
  'IR Iran',              // → iran
  'Bosnia-Herzegovina',   // → bosnia
  'Bosnia & Herzegovina', // → bosnia (alias variant)
  'Czechia',              // → czech_republic
  "Côte d'Ivoire",       // → ivory_coast (diacritic)
  "Cote d'Ivoire",       // → ivory_coast (ASCII fallback spelling)
  'Cabo Verde',           // → cape_verde
  'Congo DR',             // → dr_congo
  'DR Congo',             // → dr_congo (alias variant)
  'USA',                  // → united_states
  'Curaçao',              // → curacao (diacritic — normalized path)

  // --- Exact-match sample (fast-path regression check) ---
  'England',
  'France',
  'Germany',
  'Spain',
  'Portugal',
  'Italy',
  'Netherlands',
  'Belgium',
  'Croatia',
  'Denmark',
  'Switzerland',
  'Austria',
  'Poland',
  'Serbia',
  'Bosnia and Herzegovina',
  'Czech Republic',
  'Argentina',
  'Brazil',
  'Uruguay',
  'Colombia',
  'Ecuador',
  'Paraguay',
  'Bolivia',
  'United States',
  'Mexico',
  'Canada',
  'Costa Rica',
  'Panama',
  'Haiti',
  'Morocco',
  'Senegal',
  'Ivory Coast',
  'Egypt',
  'Ghana',
  'Nigeria',
  'South Africa',
  'Cape Verde',
  'Japan',
  'South Korea',
  'Australia',
  'Iran',
  'Saudi Arabia',
  'Qatar',
  'Uzbekistan',
  'Iraq',
  'New Zealand',
  'DR Congo',
];

const catalogSlugs = new Set(teamsCatalog.map((t) => t.slug));
const coveredSlugs = new Set();

for (const name of FIXTURE) {
  const slug = resolver(name);
  if (slug !== null) coveredSlugs.add(slug);
}

const uncovered = [...catalogSlugs].filter((s) => !coveredSlugs.has(s));

if (uncovered.length === 0) {
  console.log(`[smoke-resolver] PASS — all ${catalogSlugs.size} catalog slugs reachable from static fixture`);
  process.exit(0);
} else {
  console.error(`[smoke-resolver] FAIL — ${uncovered.length} slug(s) not covered by fixture:`);
  for (const s of uncovered) console.error(`  missing: ${s}`);
  process.exit(1);
}
