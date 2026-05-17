---
phase: quick-260517-px5
plan: "01"
subsystem: scripts
tags: [slug-resolver, ingest, backfill, launch-gate, offline-smoke]
dependency_graph:
  requires: []
  provides: [scripts/lib/resolve-team-slug.mjs, scripts/smoke-team-resolver.mjs]
  affects: [scripts/ingest-schedule.mjs, scripts/backfill-team-slugs.mjs, scripts/launch-gate.mjs]
tech_stack:
  added: []
  patterns: [layered-resolver-factory, offline-static-fixture-smoke]
key_files:
  created:
    - scripts/lib/resolve-team-slug.mjs
    - scripts/smoke-team-resolver.mjs
  modified:
    - scripts/ingest-schedule.mjs
    - scripts/backfill-team-slugs.mjs
    - scripts/launch-gate.mjs
    - package.json
decisions:
  - "Three-tier resolution order (exact→normalized→alias) so known divergences are covered structurally, not per-name"
  - "Aliases matched via the same normalize() function so minor spelling variants of alias keys also resolve"
  - "Resolver returns null (not undefined) so backfill branch conditions are explicit"
  - "Static fixture in smoke covers all 9 divergent names plus 39 exact-match names — full 48-slug coverage check"
  - "launch-gate AC-SLUG SKIP on absent DB / empty teams table to prevent false-fail before launch-day ingest"
metrics:
  duration: "~15 min"
  completed: "2026-05-17"
  tasks: 3
  files: 6
---

# Phase quick-260517-px5 Plan 01: Harden football-data.org team-name → slug mapping Summary

**One-liner:** Layered exact→normalized→alias resolver shared by ingest+backfill+smoke, with offline launch-gate NULL-slug AC, eliminating silent notification loss from API name divergences.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Shared layered resolver + offline 48-slug smoke | e91ba46 | scripts/lib/resolve-team-slug.mjs, scripts/smoke-team-resolver.mjs, package.json |
| 2 | Rewire ingest + backfill to shared resolver | c8a29bc | scripts/ingest-schedule.mjs, scripts/backfill-team-slugs.mjs |
| 3 | Launch-gate offline NULL-slug AC | 4684248 | scripts/launch-gate.mjs |

## What Was Built

### scripts/lib/resolve-team-slug.mjs

Named-export-only, dependency-free ESM resolver factory. `createTeamSlugResolver(teamsCatalog)` returns a `(name) => string | null` function. Resolution order:

- **(a) Exact** — byte-identical to the old `labelToSlug.get(name)`. The 39 non-divergent teams continue to hit this fast path unchanged.
- **(b) Normalized** — NFD + strip combining diacriticals + lowercase + `&`→`and` + strip `-.'` + collapse whitespace. Handles "Bosnia-Herzegovina", "Curaçao", "Côte d'Ivoire" diacritic/punctuation variants structurally.
- **(c) Alias** — explicit `ALIASES` map for 9 known football-data.org v4 divergences (Korea Republic, IR Iran, Czechia, Cabo Verde, Côte d'Ivoire, Congo DR/DR Congo, USA/United States, Bosnia & Herzegovina, Bosnia-Herzegovina). Alias keys are normalized at factory build time so spelling variants of alias keys also resolve.
- **(d)** returns `null` — caller decides what to log.

All three Maps are built once in the factory closure; each resolve call is O(1).

### scripts/smoke-team-resolver.mjs

Offline static-fixture smoke. Reads `references/teams.json`, builds the resolver, feeds a hardcoded array of 56 representative name strings (all 9 divergent strings + all 48 exact-match catalog labels), asserts the union of resolved slugs covers all 48 catalog slugs. Exit 0 on full coverage, exit 1 + uncovered slug list on failure. No network. No `fetch()`.

```
$ node scripts/smoke-team-resolver.mjs
[smoke-resolver] PASS — all 48 catalog slugs reachable from static fixture
```

### scripts/ingest-schedule.mjs / scripts/backfill-team-slugs.mjs

Both scripts now import `createTeamSlugResolver` from `./lib/resolve-team-slug.mjs`. The duplicated `const labelToSlug = new Map(teamsCatalog.map(...))` is removed from both. Behavioral contract preserved verbatim:

- Ingest: `[ingest] no-slug team-name=... id=...` log line + `noSlugCount++` + WARN summary block unchanged.
- Backfill: dry-run default (`--write` still required), `ok`/`ok-extra`/`fill`/`mismatch`/`missing` accounting, mismatch-never-overwrite safety invariant, `process.exit(mismatch === 0 && missing === 0 ? 0 : 1)` semantics — all preserved. Catalog count in the startup log now reads from `teamsCatalog.length` (48 entries, same number as before).

### scripts/launch-gate.mjs

New `AC-SLUG-no-null-slugs` case added just before the final summary table. Logic:

- **DB absent** → SKIP (PASS) — fresh machine / pre-fixture
- **teams table absent** → SKIP (PASS) — pre-WC-draw state
- **teams table empty** → SKIP (PASS) — pre-WC-draw, no fixtures loaded
- **all slugs non-NULL** → PASS — evidence written to `AC-SLUG-null-slug.txt`
- **any NULL slug** → FAIL — evidence lists each NULL-slug team name

No API call. No network. Per-AC summary table updated with AC-SLUG line.

## Verification Output

```
$ node scripts/smoke-team-resolver.mjs
[smoke-resolver] PASS — all 48 catalog slugs reachable from static fixture

$ node --check scripts/lib/resolve-team-slug.mjs && node --check scripts/ingest-schedule.mjs && node --check scripts/backfill-team-slugs.mjs && node --check scripts/smoke-team-resolver.mjs && node --check scripts/launch-gate.mjs
(exit 0 — all pass)

$ grep -rn "labelToSlug = new Map" scripts/
(no output — clean)

$ grep -rn "resolve-team-slug" scripts/
scripts/smoke-team-resolver.mjs:18:import { createTeamSlugResolver } from './lib/resolve-team-slug.mjs';
scripts/backfill-team-slugs.mjs:30:import { createTeamSlugResolver } from './lib/resolve-team-slug.mjs';
scripts/ingest-schedule.mjs:15:import { createTeamSlugResolver } from './lib/resolve-team-slug.mjs';

$ node scripts/backfill-team-slugs.mjs
[backfill] DB: /…/data/oddlympics.db
[backfill] teams.json: /…/references/teams.json (48 entries)
[backfill] mode: dry-run (use --write to apply)
[backfill] mode=dry-run ok=0 fill=0 mismatch=0 missing=0
```

## Locked Constraint Compliance

| Constraint | Status |
|---|---|
| ZERO new fetch() calls to football-data.org | PASS — `grep -rn "football-data" scripts/launch-gate.mjs scripts/smoke-team-resolver.mjs` returns nothing |
| NO new systemd timer / cron / loop | PASS — no such artifacts added |
| Smoke: hardcoded static fixture, no network, sub-second | PASS — exits in <100ms |
| Dry-run-by-default preserved in backfill | PASS — `--write` still required |
| Never auto-overwrite a disagreeing non-NULL slug | PASS — mismatch branch does not call `update.run` |
| No new npm deps | PASS — only `smoke:resolver` script added to package.json |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `scripts/lib/resolve-team-slug.mjs` — created, named export only, no default export
- `scripts/smoke-team-resolver.mjs` — created, exits 0 with all 48 slugs covered
- `scripts/ingest-schedule.mjs` — labelToSlug Map removed, resolver wired
- `scripts/backfill-team-slugs.mjs` — labelToSlug Map removed, resolver wired
- `scripts/launch-gate.mjs` — AC-SLUG case added, import Database added
- `package.json` — smoke:resolver script added
- Commits e91ba46, c8a29bc, 4684248 confirmed in git log
