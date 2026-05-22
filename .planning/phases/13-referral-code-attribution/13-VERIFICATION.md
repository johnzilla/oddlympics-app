---
phase: 13-referral-code-attribution
verified: 2026-05-22T22:30:00Z
status: human_needed
score: 8/8 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 7/8
  gaps_closed:
    - "New-signup referral_code insert collision is safely retried (CR-01)"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Load /?ref=k7m2qx9a in a browser"
    expected: "The hidden #ref input value equals 'k7m2qx9a' (verify in DevTools Console: document.getElementById('ref').value)"
    why_human: "index.astro is prerendered; the inline script runs in the browser at runtime. Grep confirms the script is structurally correct, but execution confirmation requires a live browser."
  - test: "Load / (no ?ref= param) after the above visit"
    expected: "The #ref input value is still 'k7m2qx9a' — localStorage fallback working"
    why_human: "localStorage persistence across navigations requires a live browser session."
  - test: "In DevTools, run localStorage.setItem('oddlympics_ref', JSON.stringify({ ref: 'k7m2qx9a', ts: Date.now() - 31*24*60*60*1000 })) then reload /"
    expected: "document.getElementById('ref').value returns '' — expired TTL entry correctly discarded"
    why_human: "Requires direct localStorage manipulation in a running browser."
  - test: "Open a private/incognito window and load /?ref=k7m2qx9a"
    expected: "Page renders normally with no console errors and the form is submittable (localStorage DOMException silently swallowed)"
    why_human: "localStorage availability in private mode is a runtime browser behavior, not verifiable by grep or static analysis."
---

# Phase 13: Referral Code & Attribution Verification Report

**Phase Goal:** Every signup has a unique, stable, public referral code, and the signup path records which code (if any) drove a new signup — making share-driven signups measurable.
**Verified:** 2026-05-22T22:30:00Z
**Status:** human_needed
**Re-verification:** Yes — after CR-01 gap closure (commit `fix(13-02): retry referral_code on SQLITE_CONSTRAINT_UNIQUE collision (CR-01)`)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC1 | Every existing and new vip_signups row has a unique, stable referral code; re-running migration is a no-op | ✓ VERIFIED | db.ts lines 64-111: pragma_table_info probe, ALTER TABLE ADD COLUMN (additive only), CREATE UNIQUE INDEX IF NOT EXISTS, idempotent backfill with 5-attempt collision retry. signup.ts lines 113-152: 5-attempt retry loop wrapping upsertVipSignup.get(), catches SQLITE_CONSTRAINT_UNIQUE, regenerates referralCode, re-throws non-collision errors, exhaustion guard calls back('server'). Both paths consistent. |
| SC2 | Visiting /?ref=CODE carries the code through the signup form so it is submitted with the POST | ✓ VERIFIED | index.astro line 94: `<input type="hidden" name="ref" id="ref" value="" />` inside the form. Lines 227-259: 4th try/catch block reads searchParams.get('ref'), persists first-touch to localStorage under 'oddlympics_ref' with 30-day TTL, falls back to stored value, assigns to refInput.value (line 259). |
| SC3 | After a signup via /?ref=CODE, referred_by is set to that code; a direct signup leaves referred_by NULL | ✓ VERIFIED | signup.ts lines 97-111: lookupByReferralCode.get(rawRef) resolves the submitted ref; on match with different owner, referredBy = refRow.referral_code; direct signup (empty rawRef) leaves referredBy = null. Both values passed as args 7 and 8 to upsertVipSignup. Smoke cases REF-valid-ref and REF-direct-no-ref validate end-to-end (14/14 PASS, SUMMARY). |
| SC4 | Unknown, malformed, or self-referencing ?ref= never blocks or errors the signup | ✓ VERIFIED | signup.ts lines 99-111: lookup miss → referredBy stays null; self-referral → referredBy stays null; block contains zero back() calls. Smoke cases REF-unknown-ref, REF-malformed-ref, REF-self-ref all assert 303 /pending?email= plus referred_by === null. |
| T1 | referral_code uniqueness enforced by separate CREATE UNIQUE INDEX, not inline ALTER TABLE constraint | ✓ VERIFIED | db.ts lines 78-80: `CREATE UNIQUE INDEX IF NOT EXISTS idx_vip_signups_referral_code ON vip_signups(referral_code)`. No inline UNIQUE on the ALTER TABLE ADD COLUMN line (line 73). |
| T2 | referred_by is COALESCE-protected in upsertVipSignup (first-touch: once set, never overwritten) | ✓ VERIFIED | db.ts line 149: `referred_by = COALESCE(excluded.referred_by, vip_signups.referred_by)` in the ON CONFLICT DO UPDATE SET clause. |
| T3 | New-signup referral_code insert collision is safely retried (CR-01) | ✓ VERIFIED | signup.ts lines 113-152: `let upserted = false; for (let attempt = 0; attempt < 5; attempt++) { ... upsertVipSignup.get(...); upserted = true; break; } catch (err) { if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') { referralCode = generateReferralCode(); continue; } console.error('[signup] db error', err); return back('server'); } } if (!upserted) { console.error('[signup] db error: referral_code collision retries exhausted'); return back('server'); }` — 5-attempt loop, discriminates collision vs. real fault, exhaustion guard present. Mirrors db.ts backfill loop exactly. |
| T4 | lookupByReferralCode is exported and resolves a submitted ref for attribution | ✓ VERIFIED | db.ts line 174: `export const lookupByReferralCode = db.prepare<[string]>('SELECT email, referral_code FROM vip_signups WHERE referral_code = ?')`. Imported and used in signup.ts lines 2 and 100. |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/referral.ts` | generateReferralCode() using node:crypto randomInt | ✓ VERIFIED | 13 lines; `import { randomInt } from 'node:crypto'`; CHARSET = 'abcdefghijklmnopqrstuvwxyz0123456789'; 8-char loop; named export only |
| `src/lib/db.ts` | additive migration, unique index, backfill, 8-param upsert, lookupByReferralCode | ✓ VERIFIED | Migration block lines 64-111; upsertVipSignup lines 137-151 (8-param, both COALESCE-protected); lookupByReferralCode lines 174-176; VipSignup type lines 113-127 |
| `src/pages/api/signup.ts` | ref resolution + referral_code generation with 5-attempt collision retry, 8-param upsert call | ✓ VERIFIED | Ref resolution lines 93-111; 5-attempt retry loop lines 118-152; 8-argument upsert call lines 122-131. CR-01 fix confirmed present. |
| `src/pages/index.astro` | hidden ref input + defensive inline-script block | ✓ VERIFIED | Line 94: hidden input name="ref" id="ref"; 4th try/catch block lines 227-259 with LS_KEY, TTL, urlRef, localStorage fallback, refInput.value assignment |
| `scripts/smoke-signup.mjs` | 6 referral cases, extended dbRowFor, REF_IP/SELF_REF_IP | ✓ VERIFIED | All 6 runCase calls present (REF-valid-ref, REF-direct-no-ref, REF-unknown-ref, REF-malformed-ref, REF-self-ref, REF-code-uniqueness). REF_IP=192.0.2.43, SELF_REF_IP=192.0.2.44 at lines 40-44. dbRowFor extended with referral_code, referred_by at line 101. |
| `DEPLOY.md` | Day-2 referral-counting SQL recipe with referred_by grouping | ✓ VERIFIED | Lines 129-143: "Referral-counting SQL recipe (Phase 13)" section with COALESCE(referred_by, "(direct)"), percentage computation, table row at line 111 linking to recipe. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| db.ts migration block | src/lib/referral.ts generateReferralCode | import for backfill loop | ✓ WIRED | db.ts line 4: `import { generateReferralCode } from './referral'`; used at line 92 inside backfill loop |
| db.ts upsertVipSignup | vip_signups.referral_code / referred_by | COALESCE ON CONFLICT DO UPDATE SET | ✓ WIRED | Lines 148-149: both COALESCE expressions present |
| signup.ts ref resolution | db.ts lookupByReferralCode | prepared-statement lookup | ✓ WIRED | signup.ts line 2 imports lookupByReferralCode; line 100: lookupByReferralCode.get(rawRef) |
| signup.ts | db.ts upsertVipSignup (8-param) | referralCode + referredBy as args 7+8 | ✓ WIRED | Lines 122-131: 8-argument call with referralCode at position 7, referredBy at position 8 |
| index.astro inline script | hidden #ref input | document.getElementById('ref').value | ✓ WIRED | Line 258: `const refInput = document.getElementById('ref')` and line 259: `if (refInput && activeRef) refInput.value = activeRef` |
| hidden ref field | /api/signup form POST | name="ref" in form action="/api/signup" | ✓ WIRED | index.astro line 66 (form action) and line 94 (input name="ref") |
| signup.ts CR-01 retry | generateReferralCode() on collision | `referralCode = generateReferralCode()` inside catch branch | ✓ WIRED | Line 141: regeneration on SQLITE_CONSTRAINT_UNIQUE within the 5-attempt for-loop |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| signup.ts referred_by | referredBy (string\|null) | lookupByReferralCode.get(rawRef) → SQLite SELECT | Yes — DB lookup against real table | ✓ FLOWING |
| signup.ts referral_code | referralCode (string) | generateReferralCode() → node:crypto randomInt, with up to 5 regenerations on collision | Yes — CSPRNG, retry-guarded | ✓ FLOWING |
| db.ts backfill | nullRows | SELECT id FROM vip_signups WHERE referral_code IS NULL | Yes — real DB query | ✓ FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — no persistent server process available in this environment. The SUMMARY documents 14/14 PASS (8 original + 6 referral cases) from a live smoke run against the fixed code. The smoke script assertions have been verified by direct code read.

### Probe Execution

Step 7c: No probe-*.sh scripts declared in plans or found conventionally. The phase uses `scripts/smoke-signup.mjs` as its integration harness. Smoke run reported as 14/14 PASS in 13-04-SUMMARY.md on the post-fix codebase; verifier cannot re-execute without a running server.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| REF-01 | 13-01, 13-04 | Every signup is assigned a unique, stable referral code | ✓ SATISFIED | Schema migration (additive, idempotent), unique index (separate CREATE UNIQUE INDEX), backfill with 5-attempt retry, new-signup path with 5-attempt collision retry (CR-01 fixed), COALESCE-protected re-signup preservation. All code paths consistently handle uniqueness. |
| REF-02 | 13-03 | Landing page accepts ?ref=CODE and carries it through the signup form | ✓ SATISFIED | Hidden input (name="ref", id="ref") + 4th inline-script try/catch block with URL param read, localStorage first-touch persistence (30-day TTL), fallback logic, and refInput.value assignment. |
| REF-03 | 13-02, 13-04 | /api/signup records referring code on new signup (referred_by column) | ✓ SATISFIED | Ref resolution block (lines 93-111), COALESCE-protected upsert (never overwrites first-touch), smoke cases REF-valid-ref/REF-direct-no-ref verify the behavior end-to-end. |

All three phase requirements are mapped in REQUIREMENTS.md (REF-01, REF-02, REF-03 all marked Complete at Phase 13) and are satisfied. SHARE-01 through OG-03 are mapped to Phases 14-15 — not in scope for Phase 13. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | — | — | — |

No TBD, FIXME, or XXX markers found in any of the 6 files modified by this phase. The prior BLOCKER (comment at old line 114-115 rationalizing the CR-01 omission) has been replaced by the correct implementation comment explaining the retry rationale.

### Human Verification Required

#### 1. ?ref= URL param populates hidden field in browser

**Test:** Load `http://localhost:4321/?ref=k7m2qx9a` in a browser. Open DevTools Console and run `document.getElementById('ref').value`.
**Expected:** Returns `'k7m2qx9a'`
**Why human:** index.astro is prerendered — the inline script runs at browser runtime. Static grep confirms the script is structurally correct, but execution confirmation requires a live browser.

#### 2. localStorage fallback carries code across navigations

**Test:** After the above visit, navigate to `http://localhost:4321/` (no ?ref= param). Check `document.getElementById('ref').value`.
**Expected:** Still returns `'k7m2qx9a'` — localStorage fallback in effect.
**Why human:** Requires a live browser session with persisted localStorage state.

#### 3. 30-day TTL expiry

**Test:** In DevTools Console, run `localStorage.setItem('oddlympics_ref', JSON.stringify({ ref: 'k7m2qx9a', ts: Date.now() - 31*24*60*60*1000 }))` then reload `/`.
**Expected:** `document.getElementById('ref').value` returns `''` — expired entry correctly ignored.
**Why human:** Requires DevTools localStorage manipulation in a live browser.

#### 4. Private/incognito mode resilience

**Test:** Open a private/incognito window and load `/?ref=k7m2qx9a`. Check browser console for errors and verify the form is submittable.
**Expected:** Page renders with no console errors; form submit button is functional.
**Why human:** localStorage throws in private mode — the try/catch guards must swallow the exception silently, which requires runtime verification.

---

## Re-verification Summary

**Gap closed:** CR-01 (T3) is now VERIFIED. The fix in `src/pages/api/signup.ts` correctly wraps `upsertVipSignup.get()` in a 5-attempt retry loop (lines 120-148) that:
- Catches `SQLITE_CONSTRAINT_UNIQUE` specifically (checks `err.code === 'SQLITE_CONSTRAINT_UNIQUE'`)
- Regenerates `referralCode` via `generateReferralCode()` on each collision
- Re-throws non-collision errors immediately (falling through to `back('server')`)
- Guards exhaustion: `if (!upserted) { console.error('[signup] db error: referral_code collision retries exhausted'); return back('server'); }`

The fix mirrors the db.ts backfill loop (lines 90-109) exactly, as the code review prescribed. The old rationalizing comment has been replaced by a comment explaining the retry policy.

**No regressions detected.** All 7 previously-passing must-haves remain verified. No new anti-patterns or debt markers introduced.

**Remaining gate:** 4 browser-runtime behaviors (localStorage TTL, persistence across navigations, private-mode resilience, URL param population) require human testing. All automated checks pass.

---

_Verified: 2026-05-22T22:30:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification: Yes (gap closure for CR-01)_
