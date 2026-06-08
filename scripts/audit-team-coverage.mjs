#!/usr/bin/env node
// One-off, READ-ONLY pre-launch audit: does the LIVE football-data.org WC feed
// map cleanly onto all 48 catalog slugs? This is the definitive empirical check
// the resolver's alias map only *guesses* at offline.
//
// Unlike the curl|comm one-liner in lib/resolve-team-slug.mjs, this runs every
// live API name through the ACTUAL resolver (exact → normalized → alias), so
// known divergences ("Korea Republic", "IR Iran", …) are NOT reported as
// failures. Only names that genuinely resolve to null — the ones whose matches
// would silently never link, so those fans silently never get alerted — show up.
//
// Read-only: one GET to /competitions/WC/teams. No DB. No writes. No mutation.
//
// Run (needs the key — lives in prod /etc/oddlympics.env, absent from local .env):
//   FOOTBALL_DATA_API_KEY=xxxx node scripts/audit-team-coverage.mjs
//   # or on the droplet:  sudo -u oddlympics --preserve-env node scripts/audit-team-coverage.mjs
//
// Exit 0 = every live team resolves AND all 48 catalog slugs are present in the feed.
// Exit 1 = at least one unmapped name OR missing/TBD catalog team (details printed).
// Exit 2 = could not run (missing key / HTTP error).

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTeamSlugResolver } from './lib/resolve-team-slug.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const API_KEY = process.env.FOOTBALL_DATA_API_KEY;
if (!API_KEY) {
  console.error('[audit] FOOTBALL_DATA_API_KEY not set — cannot run the live check.');
  console.error('[audit] The key lives in prod /etc/oddlympics.env and is absent from local .env.');
  console.error('[audit] Get a free key at https://www.football-data.org/client/register or run this on the droplet.');
  process.exit(2);
}

const COMP = process.env.WC_COMPETITION ?? 'WC';
const TEAMS_JSON_PATH = resolve(
  process.env.TEAMS_JSON_PATH ?? resolve(__dirname, '../references/teams.json'),
);

const catalog = JSON.parse(readFileSync(TEAMS_JSON_PATH, 'utf-8'));
const resolveSlug = createTeamSlugResolver(catalog);
const catalogSlugs = new Set(catalog.map((t) => t.slug));

let payload;
try {
  const r = await fetch(`https://api.football-data.org/v4/competitions/${COMP}/teams`, {
    headers: { 'X-Auth-Token': API_KEY },
  });
  if (!r.ok) {
    const body = await r.text();
    console.error(`[audit] HTTP ${r.status} from /competitions/${COMP}/teams`);
    console.error(`[audit] ${body.slice(0, 300)}`);
    if (r.status === 403 || r.status === 429) {
      console.error('[audit] 403/429 often means the WC competition is NOT in your free tier,');
      console.error('[audit] or you are over quota. That itself is a launch blocker — the cron');
      console.error('[audit] uses this same endpoint. Confirm WC is on your plan before 06-11.');
    }
    process.exit(2);
  }
  payload = await r.json();
} catch (e) {
  console.error('[audit] network error:', e.message);
  process.exit(2);
}

const apiTeams = Array.isArray(payload.teams) ? payload.teams : [];
console.log(`[audit] live feed returned ${apiTeams.length} teams (expect 48 once the draw is fully populated)`);

const unmapped = [];   // API name → null: matches won't link
const seenSlugs = new Set();
for (const t of apiTeams) {
  const slug = resolveSlug(t.name);
  if (slug === null) {
    unmapped.push(t.name);
  } else {
    seenSlugs.add(slug);
    if (!catalogSlugs.has(slug)) {
      // resolver returned a slug not in the catalog — should be impossible, but surface it
      unmapped.push(`${t.name} → ${slug} (slug not in catalog!)`);
    }
  }
}

const missing = catalog.filter((t) => !seenSlugs.has(t.slug)).map((t) => `${t.label} (${t.slug})`);

let fail = false;

if (unmapped.length) {
  fail = true;
  console.error(`\n[audit] ✗ ${unmapped.length} live team name(s) do NOT resolve — their fans get NO alerts:`);
  for (const n of unmapped) console.error(`         • ${JSON.stringify(n)}  → add an alias in scripts/lib/resolve-team-slug.mjs`);
} else if (apiTeams.length) {
  console.log('[audit] ✓ every live team name resolves to a catalog slug');
}

if (missing.length) {
  fail = true;
  console.error(`\n[audit] ✗ ${missing.length} catalog team(s) absent from the live feed (TBD / not yet in feed):`);
  for (const m of missing) console.error(`         • ${m}`);
  console.error('         If the draw is complete this means the feed is incomplete — those fans get no fixtures.');
} else if (apiTeams.length) {
  console.log('[audit] ✓ all 48 catalog slugs are present in the live feed');
}

if (fail) {
  console.error('\n[audit] RESULT: FAIL — fix before flipping KICKOFF_NOTIFICATIONS_ENABLED=true');
  process.exit(1);
}
console.log('\n[audit] RESULT: PASS — every team maps both ways. Core promise is wired correctly.');
process.exit(0);
