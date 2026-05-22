---
phase: 13-referral-code-attribution
plan: "02"
subsystem: referral-attribution
tags: [referral, signup, attribution, api]
dependency_graph:
  requires:
    - generateReferralCode (src/lib/referral.ts) — Plan 13-01
    - upsertVipSignup 8-param (src/lib/db.ts) — Plan 13-01
    - lookupByReferralCode (src/lib/db.ts) — Plan 13-01
  provides:
    - ref resolution step in /api/signup pre-flight chain
    - referral_code generation per-signup in /api/signup
    - referred_by attribution wired to upsertVipSignup 8-param call
  affects:
    - src/pages/api/signup.ts (new imports, ref-resolution block, extended upsert call)
tech_stack:
  added: []
  patterns:
    - silent-fallback (tz-fallback analog) — bad/unknown/self ref → NULL, signup continues
    - post-validation pre-upsert insertion point (D-09)
    - self-referral guard via email comparison (T-13-04)
key_files:
  created: []
  modified:
    - src/pages/api/signup.ts
decisions:
  - "ref-resolution placed at D-09 (post-validation, pre-upsert) mirroring tz-fallback — never calls back(), never rejects"
  - "generateReferralCode() called unconditionally per-request; COALESCE in upsertVipSignup protects existing codes on re-signup (D-04)"
  - "Self-referral detected by comparing resolved code-owner email to rawEmail — both already lowercased, no extra normalization needed"
metrics:
  duration_seconds: 52
  completed_date: "2026-05-22"
  tasks_completed: 1
  files_created: 0
  files_modified: 1
---

# Phase 13 Plan 02: Referral Attribution Wiring Summary

**One-liner:** `/api/signup` wired to generate a `referral_code` per row, resolve the submitted `ref` to `referred_by` (valid → code; unknown/malformed/self → NULL) via a silent-fallback pre-upsert block, passing both as args 7 and 8 to the 8-param `upsertVipSignup`.

## Tasks Completed

| # | Name | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Add ref-resolution + referral-code generation to /api/signup | 75554ca | src/pages/api/signup.ts |

## What Was Built

**`src/pages/api/signup.ts` modifications:**

- **Import additions:**
  - `lookupByReferralCode` added to the existing `upsertVipSignup` import from `../../lib/db`
  - `import { generateReferralCode } from '../../lib/referral'` added as new import line

- **Ref-resolution block** inserted at D-09 (post-validation, pre-upsert, after tz-fallback block):
  - `rawRef` normalized via `.trim().toLowerCase()` (mirrors `rawEmail`/`rawTeam` normalization pattern)
  - `let referredBy: string | null = null` declared
  - If `rawRef` non-empty: calls `lookupByReferralCode.get(rawRef)` typed as `{ email: string; referral_code: string } | undefined`
  - Valid ref (row found) AND different owner email → `referredBy = refRow.referral_code`
  - Self-referral (row found, same email) → `referredBy` stays `null`, logs `[signup] ref-self-referral` (T-13-04 mitigated)
  - Unknown/malformed ref (no row) → `referredBy` stays `null`, logs `[signup] ref-unknown` (D-08 honored)
  - Block contains NO `back()` calls (SC4 guaranteed)

- **`referralCode` generation:** `const referralCode = generateReferralCode()` declared before the upsert try block

- **`upsertVipSignup.get(...)` extended to 8 args:** `referralCode` (7th) and `referredBy` (8th) appended after existing `tz` argument; surrounding try/catch unchanged

## Verification Results

- `npx astro check` — no type errors for signup.ts
- Acceptance criteria checks:
  - `generateReferralCode` imported from `../../lib/referral`: confirmed
  - `lookupByReferralCode` imported from `../../lib/db`: confirmed
  - `const referralCode = generateReferralCode()` present: confirmed
  - `lookupByReferralCode.get(` call present with self-referral check against `rawEmail`: confirmed
  - `back(` call count in ref-resolution block: **0** (SC4 compliant)
  - `upsertVipSignup.get(` now passes 8 arguments: confirmed

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new network endpoints introduced. The ref lookup is a read-only parameterized SELECT folded into the existing `/api/signup` POST path — no new public surface. STRIDE mitigations T-13-04 (self-referral guard) and T-13-05 (bad ref silent fallback) are implemented as specified. T-13-06 and T-13-07 accepted as per threat model.

## Self-Check

- [x] `src/pages/api/signup.ts` imports `lookupByReferralCode`: confirmed
- [x] `src/pages/api/signup.ts` imports `generateReferralCode`: confirmed
- [x] Ref-resolution block present at D-09 insertion point: confirmed
- [x] No `back()` call in ref-resolution block: confirmed (grep count = 0)
- [x] `upsertVipSignup.get(` passes 8 args: confirmed
- [x] Commit 75554ca exists in git log: confirmed
- [x] `npx astro check` clean: confirmed

## Self-Check: PASSED
