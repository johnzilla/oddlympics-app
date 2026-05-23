---
phase: 15-personalized-open-graph
plan: 04
status: complete
completed: 2026-05-23
---

# Plan 15-04 Summary — Migrate four share-URL emit sites to /r/CODE

## What was built

Migrated all four Phase 14 share-URL emit sites from `/?ref=CODE` (the
Phase 14 generic-landing-carry-through default) to `/r/CODE` (the Phase 15
server-rendered referral route from Plan 15-01). Every newly emitted share
link now unfurls personalized via the new route. Already-shipped Phase 14
links continue to function unchanged via Phase 13's `/api/signup`
ref-resolution path (D-13).

## Tasks completed

| # | Task | Status |
|---|------|--------|
| 1 | Migrate four share-URL emit sites from /?ref= to /r/ | ✓ |

## Key files modified

- `src/pages/pending.astro:77` — `'/?ref=' + rc` → `'/r/' + rc`
- `src/pages/confirmed.astro:90` — `'/?ref=' + rc` → `'/r/' + rc`
- `src/pages/manage.astro:70` — `'/?ref=' + user.referral_code` → `'/r/' + user.referral_code`
- `src/lib/email.ts:29` — `'/?ref=' + referralCode` → `'/r/' + referralCode`

Each edit is a single-line substring substitution; no surrounding logic was
touched. `src/lib/copy.ts` (the `shareText` helper) is byte-identical to
its pre-15-04 state per D-13.

## Verification

**Per-site grep:**
- `grep -c "'/r/' + rc" src/pages/pending.astro` → `1`
- `grep -c "'/r/' + rc" src/pages/confirmed.astro` → `1`
- `grep -c "'/r/' + user.referral_code" src/pages/manage.astro` → `1`
- `grep -c "'/r/' + referralCode" src/lib/email.ts` → `1`

**Exhaustive no-regression grep (T-15-16 mitigation):**
- `grep -RnE "'/\?ref='" src/ --include='*.astro' --include='*.ts'` returns
  ZERO matches — no missed migration sites and no straggling literal usages.

**Build:** `npm run build` exits 0. `npx astro check` reports 0 errors,
0 warnings, 3 hints (pre-existing, unrelated).

**copy.ts untouched:** `git diff src/lib/copy.ts` is empty — D-13 contract
holds; the helper accepts any URL string.

## Commits

- `<this commit>`: feat(15-04): migrate four share-URL emit sites from /?ref=CODE to /r/CODE

## Deviations

None. The four edits matched the planned substring substitutions exactly.

## Self-Check: PASSED

All success criteria met:
- ✓ Four emit sites use `/r/CODE`
- ✓ Zero residual `/?ref=` emits in `src/`
- ✓ `src/lib/copy.ts` unchanged
- ✓ `npm run build` exits 0
- ✓ `npx astro check` reports 0 new errors
- ✓ Four substitutions are the ONLY content changes
