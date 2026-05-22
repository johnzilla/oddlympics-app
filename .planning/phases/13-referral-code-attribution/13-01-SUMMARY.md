---
phase: 13-referral-code-attribution
plan: "01"
subsystem: referral-schema
tags: [referral, sqlite-migration, db, schema, crypto]
dependency_graph:
  requires: []
  provides:
    - generateReferralCode (src/lib/referral.ts)
    - referral_code column + unique index on vip_signups
    - referred_by column on vip_signups
    - upsertVipSignup 8-param COALESCE-protected statement
    - lookupByReferralCode prepared statement
  affects:
    - src/lib/db.ts (VipSignup type, upsertVipSignup, new migration block)
    - all callers of upsertVipSignup (Plan 02 will wire in the new params)
tech_stack:
  added: []
  patterns:
    - pragma_table_info probe + ALTER TABLE ADD COLUMN (additive migration, no version assert)
    - CREATE UNIQUE INDEX IF NOT EXISTS (workaround for SQLite ALTER TABLE UNIQUE landmine)
    - COALESCE-protected ON CONFLICT DO UPDATE SET (first-touch + stability semantics)
    - node:crypto randomInt (bias-free opaque code generation)
key_files:
  created:
    - src/lib/referral.ts
  modified:
    - src/lib/db.ts
decisions:
  - "referral.ts is a dedicated helper (not inlined into db.ts) — mirrors timezones.ts module shape, keeps crypto concern separated"
  - "referral_code typed string | null in VipSignup (honest to schema — nullable before backfill)"
  - "Unique index created before backfill loop (index-first is cleaner; NULL-distinctness means no constraint violation on pre-backfill NULLs)"
metrics:
  duration_seconds: 289
  completed_date: "2026-05-22"
  tasks_completed: 3
  files_created: 1
  files_modified: 1
---

# Phase 13 Plan 01: Referral Schema Foundation Summary

**One-liner:** Additive `referral_code` + `referred_by` columns on `vip_signups` with unique index, idempotent boot-time backfill, 8-char `[a-z0-9]` CSPRNG code generator, and 8-param COALESCE-protected `upsertVipSignup` with `lookupByReferralCode` lookup statement.

## Tasks Completed

| # | Name | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Create src/lib/referral.ts code generator | 3d07bd0 | src/lib/referral.ts (new) |
| 2 | Add referral_code + referred_by migration, unique index, backfill | 5f6888a | src/lib/db.ts |
| 3 | Extend VipSignup type, upsertVipSignup to 8 params, add lookupByReferralCode | 9c69610 | src/lib/db.ts |

## What Was Built

**`src/lib/referral.ts` (new):**
- Imports `randomInt` from `node:crypto` (bias-free; no modulo bias unlike `randomBytes % N`)
- `CHARSET = 'abcdefghijklmnopqrstuvwxyz0123456789'` (36 chars, D-01)
- `export function generateReferralCode(): string` — 8-char loop using `randomInt(36)` per character
- Named export only, no default export, no barrel index

**`src/lib/db.ts` additions:**
- Import of `generateReferralCode` from `./referral`
- New migration block (modeled on simpler teams probe at :159-166 — no SQLite version assert, no DROP COLUMN):
  - `pragma_table_info` probe + `ALTER TABLE vip_signups ADD COLUMN referral_code TEXT`
  - `ALTER TABLE vip_signups ADD COLUMN referred_by TEXT`
  - `CREATE UNIQUE INDEX IF NOT EXISTS idx_vip_signups_referral_code` (separate — SQLite forbids inline UNIQUE on ALTER ADD COLUMN)
  - Idempotent backfill loop: SELECT WHERE referral_code IS NULL → generateReferralCode() → UPDATE, with 5-attempt SQLITE_CONSTRAINT_UNIQUE retry
- `VipSignup` type extended: `referral_code: string | null` + `referred_by: string | null`
- `upsertVipSignup` extended to 8-param tuple: adds `referral_code` + `referred_by` with COALESCE protection (D-04 stability + D-06 first-touch)
- `lookupByReferralCode` exported: narrowed `SELECT email, referral_code FROM vip_signups WHERE referral_code = ?`

## Verification Results

Migration confirmed against live DB (`data/oddlympics.db`, 43 existing rows):

- `SELECT COUNT(*) FROM vip_signups WHERE referral_code IS NULL` → **0** (SC1: all rows backfilled)
- `SELECT COUNT(*), COUNT(DISTINCT referral_code) FROM vip_signups` → **43 | 43** (all unique)
- `PRAGMA index_list('vip_signups')` → **idx_vip_signups_referral_code** present
- Second boot: NULL count remains **0** (idempotent backfill confirmed)
- `npm run build` → **Complete!** (no build errors)

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new network endpoints, auth paths, or trust boundary changes in this plan. Migration runs at module-load time (boot-time, server-side only). No new public surface introduced.

## Self-Check

- [x] `src/lib/referral.ts` exists: confirmed
- [x] `src/lib/db.ts` contains `idx_vip_signups_referral_code`: confirmed
- [x] Commits 3d07bd0, 5f6888a, 9c69610 exist in git log
- [x] Migration ran against live DB: 0 NULL rows, 43/43 unique
- [x] Idempotency verified: second run finds 0 NULL rows

## Self-Check: PASSED
