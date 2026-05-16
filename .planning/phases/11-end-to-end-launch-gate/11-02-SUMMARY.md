---
phase: 11-end-to-end-launch-gate
plan: "02"
subsystem: gate-scripts
tags: [launch-gate, acceptance-criteria, cleanup, puppeteer, lighthouse]
dependency_graph:
  requires:
    - references/teams.json (AC2 slug set-equality)
    - chrome-headless-shell binary (AC3/AC8 — gitignored, install once)
    - puppeteer-core (AC3 — loaded at runtime, not a project dep)
    - lighthouse npx (AC8 — one-shot via npx, not a project dep)
  provides:
    - scripts/launch-gate.mjs (AC1-AC12 prod gate runner)
    - scripts/cleanup-gate-rows.mjs (D-04 +tag row cleanup)
    - npm run smoke:gate (alias)
    - npm run cleanup:gate (alias)
  affects:
    - references/lighthouse-final.html (written by AC8)
    - .planning/phases/11-end-to-end-launch-gate/evidence/ (per-AC artifacts)
tech_stack:
  added: []
  patterns:
    - runCase harness + exit codes 0/1/2 (mirrors smoke-*.mjs verbatim)
    - redirect:'manual' fetch POST helper (mirrors smoke-manage.mjs)
    - dry-run-by-default + --confirm flag (mirrors launch-blast.mjs)
    - better-sqlite3 writable open + DATABASE_PATH resolve (mirrors backup-pre-05.mjs)
    - puppeteer-core emulateTimezone against #timezone/#tz-label DOM contract (Phase-6 pattern)
    - Lighthouse mobile → references/lighthouse-final.html via spawnSync npx (Phase-6 pattern)
    - LAND-02 bracket-char-class prohibited-terms regex (self-passes AC7)
    - RFC 5737 TEST-NET-1 GATE_IP=192.0.2.44 (distinct from smoke-signup/smoke-landing IPs)
    - Operator-prompt readline evidence capture to phase evidence/ dir
key_files:
  created:
    - scripts/launch-gate.mjs
    - scripts/cleanup-gate-rows.mjs
  modified:
    - package.json (smoke:gate + cleanup:gate aliases)
decisions:
  - D-03 deviation recorded in launch-gate.mjs header: puppeteer-core satisfies AC3 Playwright intent with zero new devDependency
  - AC3 persistence path pinned to #timezone hidden-input value + #tz-label textContent (no off-droplet DB read)
  - GATE_IP=192.0.2.44 (fresh RFC 5737 address, distinct from smoke-* IPs to avoid shared rate-limit bucket)
  - cleanup-gate-rows.mjs LIKE pattern '%+ac%@gmail.com' — '+ac' infix scopes delete to gate rows only; bare domain pattern intentionally absent
  - npm aliases placed alphabetically within smoke:* family (cleanup:gate before smoke:*, smoke:gate between smoke:confirm and smoke:landing)
metrics:
  duration: "~10 minutes"
  completed: "2026-05-16"
  tasks_completed: 2
  files_created: 2
  files_modified: 1
---

# Phase 11 Plan 02: Gate Runner + Cleanup Scripts Summary

One-liner: Consolidated AC1–AC12 prod gate runner (puppeteer-core + Lighthouse + operator prompts) and dry-run-by-default +tag cleanup script with npm aliases, zero new dependencies.

## What Was Built

### Task 1: `scripts/launch-gate.mjs`

Single re-runnable command (`npm run smoke:gate`) targeting production `https://oddlympics.app` by default (SMOKE_BASE_URL override for local pre-flight):

**Automated ACs:**
- **AC1** — GET `/` body includes the canonical headline (literal includes check)
- **AC2** — Parses live rendered `<select>` options AND set-compares against `references/teams.json` slugs (both checks required — static JSON alone insufficient per D-06)
- **AC3** — puppeteer-core `emulateTimezone` across `America/Detroit`, `Europe/London`, `Africa/Lagos`; asserts `#timezone` hidden-input value === IANA tz string AND `#tz-label` textContent === `"${city} time"` (pinned AC3 persistence path — no off-droplet DB read)
- **AC6** — Raw fetch `/og-image.png`; asserts 200 + `image/png` + `< 300 KB` + `readUInt32BE(16/20)` width=1200/height=630
- **AC7** — LAND-02 bracket-char-class regex across all four surfaces: `/`, `/privacy`, `/terms`, `/manage` (extends `check:land-02` which only greps `dist/client/index.html`)
- **AC8** — Shells `npx lighthouse` mobile via `CHROME_PATH`; writes to exactly `references/lighthouse-final.html` (SC2/done-def #5); parses four category scores and asserts all >= 0.90
- **AC9** — POST `/api/signup` with `team=fake_team` using GATE_IP; asserts 303 + `/?error=bad-form` (redirect contract alone, no DB read)
- **AC12** — POST `/api/signup` with honeypot `website` set; asserts 303 + `/pending`

**Operator-gated ACs (readline evidence capture):**
- **AC4** — Full Gmail loop prompt: `johnturner+ac4@gmail.com` signup → confirm < 60s → `/manage` → unsubscribe
- **AC10** — Backfilled-row banner + save on `/manage`
- **AC11** — Plausible dashboard `Signup Submit` event with `team` prop
- **opengraph.xyz** — Done-definition #4 preview card

Each AC writes an artifact to `.planning/phases/11-end-to-end-launch-gate/evidence/`. Emits one per-AC PASS/FAIL/OPERATOR table. Exit codes: 0 (all automated ACs PASS), 1 (any FAIL), 2 (server unreachable or chrome-headless-shell missing).

### Task 2: `scripts/cleanup-gate-rows.mjs`

Dry-run-by-default destructive delete of D-04 +tag gate rows:
- `node scripts/cleanup-gate-rows.mjs` → prints rows it WOULD delete, exits 0
- `node scripts/cleanup-gate-rows.mjs --confirm` → issues DELETE, prints `deleted=N`
- Idempotent: zero-rows path prints "nothing to do (idempotent — re-run is a no-op)" and exits 0
- Opens DB writable via `new Database(DB_PATH)` (not readonly — issues DELETE)
- LIKE pattern `'%+ac%@gmail.com'` bound as single prepared-statement parameter (no string interpolation)
- The `+ac` infix is the safety lock — bare domain-only patterns are intentionally absent (T-11-02-01 mitigation)
- Runs **after** the `v1.0-consumer-landing` tag is pushed (D-05/D-07)

### `package.json` aliases

```json
"cleanup:gate": "node scripts/cleanup-gate-rows.mjs",
"smoke:gate":   "node scripts/launch-gate.mjs"
```

Placed alphabetically within the scripts block (cleanup:gate first, smoke:gate between smoke:confirm and smoke:landing). No new entries in `dependencies` or `devDependencies`.

## Deviations from Plan

### Auto-documented D-03 deviation

**1. [D-03 — Tool substitution] puppeteer-core instead of Playwright for AC3**
- **Specified in:** Plan task 1 `<action>` and `<behavior>`, CONTEXT D-03
- **Deviation:** MILESTONE-consumer-landing.md AC3 / REQUIREMENTS.md literally say "Playwright"; this script satisfies the AC intent using puppeteer-core + chrome-headless-shell (the proven Phase-6 pattern)
- **Rationale:** Zero new devDependency; puppeteer-core is loaded at runtime via npx/node_modules; the underlying Chrome behavior is identical; Phase-6 precedent (06-03-SUMMARY.md) established this exact pattern
- **Recorded in:** `launch-gate.mjs` header comment (DOCUMENTED DEVIATION — D-03 block) and this SUMMARY
- **Impact:** None — AC3 intent is fully satisfied; deviation is explicit and pre-planned

None — plan executed exactly as written (deviation was pre-planned and documented in D-03).

## Threat Flags

The two threat mitigations from T-11-02-01 are implemented as required:
- `'%+ac%@gmail.com'` scoped LIKE pattern (verified by `<verify>` grep)
- Bare domain-only pattern absent (verified by `! grep "'%@gmail.com'"`)

No new security-relevant surface beyond what the threat model covers.

## Known Stubs

None. Both scripts are complete implementations. `launch-gate.mjs` requires `CHROME_PATH` env var to be set (chrome-headless-shell binary, installed once in Phase 6); this is a documented operator prerequisite, not a stub.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| `scripts/launch-gate.mjs` exists | FOUND |
| `scripts/cleanup-gate-rows.mjs` exists | FOUND |
| `11-02-SUMMARY.md` exists | FOUND |
| Task 1 commit d3e130e | FOUND |
| Task 2 commit d16f49c | FOUND |
