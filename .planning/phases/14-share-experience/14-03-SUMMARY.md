---
phase: 14-share-experience
plan: 03
subsystem: email
tags: [email, share, referral, copy, wave-2]

# Dependency graph
requires:
  - .planning/phases/14-share-experience/14-01-SUMMARY.md (shareText helper in src/lib/copy.ts)
  - .planning/phases/14-share-experience/14-02-SUMMARY.md (row: VipSignup captured in /api/signup.ts; row.referral_code in scope)
provides:
  - "sendMagicLink(email, token, team, timezone, referralCode): Promise<void> — 5-param signature composing the share URL and inserting the personalized share line into both HTML body and plaintext part of the confirmation email"
  - "Confirmation email body (HTML + plaintext) contains personalized share line + referral URL — SHARE-02 satisfied, SHARE-04 contributes via teamLabel"
affects:
  - "Operator email-rendering UAT (Apple Mail / Gmail / Outlook / Proton walk-through) — operator now sees a soft secondary share <p> after the Confirm-email button on every confirmation email"
  - "Plan 14-05 smoke (optional, body-of-confirmation-email assertions are operator-driven per D-20, not in smoke)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reuse upstream copy helper at call site (shareText from src/lib/copy.ts) — same single-source-of-truth pattern as teamLabel(slug)"
    - "Muted secondary nudge color token (#5a5d68 = Layout.astro --fg-dim) — visual hierarchy enforced via CSS in the email body, not separate copy"
    - "Belt-and-braces ?? '' coalesce at the call site to satisfy strict string parameter even when runtime invariant (Plan 14-02 narrowing) guarantees non-null"

key-files:
  created: []
  modified:
    - path: src/lib/email.ts
      lines: 137 → 144 (+7 net): shareText import added; 5th param + 2 new const locals (shareUrl, shareLine); 2 new plaintext-array entries; 1 new muted <p>; 1 new dev-fallback console.log
    - path: src/pages/api/signup.ts
      lines: 178 → 178 (one-line change): 5-arg call

key-decisions:
  - "D-12 honored: share line is a plain muted <p> (color:#5a5d68 / font-size:13px), NOT a colored callout. The accent-colored NO_ACCOUNT callout above the Confirm-email button remains the primary re-entry nudge; the share line is a soft secondary nudge"
  - "D-13 honored: 5-param signature, referralCode is the 5th positional arg (after timezone), passed from row.referral_code at the single call site"
  - "D-14 honored: share URL is /?ref=CODE (generic landing with first-touch localStorage attribution from Phase 13), NOT Phase-15's planned /r/CODE server-rendered route (which does not exist yet — Phase 15 will add it)"
  - "D-07 honored: share URL built from SITE_URL constant (PUBLIC_SITE_URL env or http://localhost:4321 dev default), never hardcodes the host"
  - "D-08 honored verbatim: the shareText helper imported from copy.ts emits the em-dash + LF newline + verbatim wording; no copy duplication in email.ts"
  - "Plaintext ordering mirrors HTML ordering: shareLine sits after the manage CTA block (mirrors the HTML's after-the-Confirm-email-button placement) — both place share as a soft secondary nudge after the primary CTA"
  - "Defensive ?? '' at the signup.ts call site: row.referral_code is typed string | null (db.ts:125) but runtime non-null since Plan 14-02's narrowing returns back('server') if null. The coalesce satisfies strict at zero runtime cost — same belt-and-braces pattern Plan 14-02 used"

patterns-established:
  - "Email body composition: SITE_URL + literal path + value, NEVER hardcode the host — preserves local-dev visibility of the share link"
  - "Dev fallback emits one [email-dev-fallback] console.log line per outbound URL — operators see the magic link, the body summary, and the share URL in the same npm run dev session"

requirements-completed: [SHARE-02, SHARE-04]

# Metrics
duration: 134s
completed: 2026-05-23T01:41:17Z
tasks: 2
files: 2
---

# Phase 14 Plan 03: Email share line — Summary

**`sendMagicLink` now accepts the user's `referral_code` as a 5th parameter and inserts a personalized share line (HTML and plaintext) into the confirmation email body. Closes SHARE-02 and contributes to SHARE-04.**

## Performance

- **Duration:** ~2 min 14 s
- **Started:** 2026-05-23T01:39:03Z
- **Completed:** 2026-05-23T01:41:17Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `sendMagicLink(email, token, team, timezone, referralCode)` — 5-param signature widening; explicit `Promise<void>` return preserved
- `shareUrl` composed from existing `SITE_URL` constant + `/?ref=` + `referralCode`; reuses existing `teamHuman` local (no second `teamLabel` call — preserves Phase-10 single-call invariant)
- `shareLine` computed via the Plan 14-01 `shareText` helper — single source of truth for D-08 wording across email + share UI
- **Plaintext part:** new `shareLine` entry inserted between the manage CTA block (`account, no password: ${manageUrl}`) and the "No spam" line — placed as a soft secondary nudge after the primary CTA, mirroring HTML ordering
- **HTML body:** new muted `<p style="color:#5a5d68;font-size:13px">Know someone else following <strong>${teamHuman}</strong>? Share your link: <a href="${shareUrl}">${shareUrl}</a></p>` inserted immediately AFTER the Confirm-email button paragraph and BEFORE the "Or paste this URL" paragraph. Color and size chosen so it does not visually compete with the accent-colored NO_ACCOUNT callout (D-12)
- **Dev fallback:** new `console.log('   share:', shareUrl, '\n')` line — operators running `npm run dev` (no `RESEND_API_KEY`) now see three `[email-dev-fallback]` lines: the magic-link URL, the body summary, and the share URL
- **Call site:** `/api/signup.ts` updated to pass `row.referral_code ?? ''` (one-line change); `?? ''` is a belt-and-braces type-narrower — Plan 14-02's `if (!row || !row.referral_code)` bail already guarantees non-null at runtime
- **Untouched:** `sendManageLink`, `buildUnsubscribeHeaders`, the Resend send pipeline, the NO_ACCOUNT callout chrome, the Confirm-email button paragraph — all byte-identical to pre-plan state

## Task Commits

Each task was committed atomically:

1. **Task 1: Add 5th referralCode param + share line to sendMagicLink (TDD)** — `7a1ec5d` (feat)
2. **Task 2: Pass row.referral_code as 5th sendMagicLink arg in /api/signup.ts** — `fef2584` (feat)

**Plan metadata:** pending (this commit)

## Files Created/Modified

- `src/lib/email.ts` — extended the `./copy` import to add `shareText`; widened `sendMagicLink` to 5 params; added two new locals (`shareUrl`, `shareLine`) immediately after the existing `tzHuman`; inserted `shareLine` into the plaintext array; inserted a muted `<p>` into the HTML body; added one `[email-dev-fallback]` line for the share URL
- `src/pages/api/signup.ts` — one-line change: the `sendMagicLink` call gained `row.referral_code ?? ''` as its 5th argument

## Verification

All acceptance criteria from both tasks green:

| Check | Expected | Actual | Pass |
|-------|----------|--------|------|
| `grep -c "referralCode: string" src/lib/email.ts` | ≥ 1 | 1 | ✓ |
| `grep -c "shareText" src/lib/email.ts` | ≥ 2 | 2 (import + call) | ✓ |
| `grep -c "SITE_URL + '/?ref='" src/lib/email.ts` | 1 | 1 | ✓ |
| `grep -c "Know someone else following" src/lib/email.ts` | 1 | 1 | ✓ |
| `grep -c "color:#5a5d68" src/lib/email.ts` | ≥ 1 | 1 | ✓ |
| `grep -c "shareLine" src/lib/email.ts` | ≥ 2 | 2 (const + text-array usage) | ✓ |
| `grep -c "share:" src/lib/email.ts` | 1 | 1 | ✓ |
| `grep -c "Pick your World Cup teams" src/lib/email.ts` | 1 | 1 (sendManageLink subject preserved) | ✓ |
| `grep -c "sendMagicLink(rawEmail, token, rawTeam, tz, row.referral_code" src/pages/api/signup.ts` | 1 | 1 | ✓ |
| `npx astro check 2>&1 \| grep -E "email\.ts"` | only pre-existing `Cannot find name 'process'` baseline | only pre-existing baseline (lines 7–10, unchanged in this plan) | ✓ |
| `npx astro check 2>&1 \| grep -E "signup\.ts"` | empty | empty (zero new type errors) | ✓ |

### TDD cycle (Task 1)

- **RED:** Pre-implementation greps for all 7 acceptance markers (`referralCode: string`, `shareText`, `SITE_URL + '/?ref='`, `Know someone else following`, `color:#5a5d68`, `shareLine`, `share:`) all returned `0`. Confirmed at 2026-05-23T01:39:14Z.
- **GREEN:** Post-implementation greps all returned the expected counts. An inline Node behavior probe rendered both the plaintext `shareLine` and the muted HTML `<p>` with `teamHuman='USA'` and `shareUrl='http://localhost:4321/?ref=k7m2qx9a'` — output matched the D-08 lock verbatim (em-dash, LF newline, `<strong>USA</strong>` wrapper, `color:#5a5d68` muted styling).
- **REFACTOR:** None needed — the plan's exact wording, exact muted-color token, and exact insertion points were correct on first pass.

The project has no formal test suite (per CLAUDE.md), so the RED→GREEN cycle was driven by acceptance-criteria grep counts + inline behavior probe rather than a vitest/jest file. Wave-2's smoke (Plan 14-05) provides end-to-end behavioral coverage; **operator UAT** covers the cross-client (Apple Mail / Gmail / Outlook / Proton) rendering check per D-20.

## Decisions Made

- **`?? ''` belt-and-braces over non-null assertion `!` at the call site.** `row.referral_code` is `string | null` per `VipSignup` (db.ts:125), and the strict `string` parameter on the 5-arg signature would force a `!` or a coalesce. The coalesce is chosen because (a) it has zero runtime cost (Plan 14-02's narrowing already returns `back('server')` if null, so the `??` branch is unreachable at runtime) and (b) it's the same defensive pattern Plan 14-02 used for `${encodeURIComponent(row.referral_code)}` in the Location header. Surface-area consistency over micro-optimization.
- **Plaintext shareLine placement: after manage CTA (option-B), not after confirmation-link block (option-A).** The plan's `<interfaces>` block offered both options and recommended option-B because it mirrors the HTML's "after the primary CTA, before the disclaimer line" ordering. Honored without deviation — the plaintext ordering is now: confirm-link → "1h before kickoff" line → manage-link block → shareLine → "No spam" disclaimer → footer signature.
- **HTML muted color = `#5a5d68` (Layout.astro `--fg-dim` token), not a new color.** The plan locked this; the only alternative would have been to invent a new email-only muted hue, which would have diverged the email body from the site's design tokens for no benefit.
- **No `color:#5a5d68` style on the `<strong>${teamHuman}</strong>` element.** The team-name `<strong>` inherits the paragraph's `color:#5a5d68` automatically; an explicit color override would have made the team name compete with the surrounding share-prompt copy and would have diverged from the existing `<strong>${teamHuman}</strong>` on `:56` (which also has no explicit color).

## Deviations from Plan

None — plan executed exactly as written. All acceptance-criteria greps returned the expected counts on the first try; the only "deviation" worth recording is that the muted-color HTML `<p>` uses `margin:0 0 20px;line-height:1.55;color:#5a5d68;font-size:13px` exactly as specified — no rearrangement, no swap of inline-style ordering.

The plan called for two scope-isolated TODO-free tasks; both delivered on the first pass.

## Issues Encountered

- **Intermediate-state TypeScript error between Task 1 and Task 2 (expected).** After Task 1 widened the signature to 5 params, `signup.ts:165` correctly reported `Expected 5 arguments, but got 4`. Task 2 closed the error in the same executor session. This is a healthy two-step atomic commit pattern, not a deviation — the plan explicitly structures these as scope-isolated atomic tasks (one per file), and both tasks ship in the same session so the build is never observed in the broken intermediate state by anyone else.
- **`npx astro check` baseline noise unchanged.** The 20 pre-existing `Cannot find name 'process'` / `Cannot find name 'Buffer'` / `Cannot find module 'node:crypto'` errors across `src/lib/token.ts`, `src/lib/db.ts`, `src/lib/session.ts`, `src/lib/email.ts:7-10`, `src/pages/api/*.ts`, etc. — all attributable to `@types/node` not being a `devDependency` — were present before Plan 14-03 and are unchanged. The plan's `<verify>` block scopes the check to `grep -E "email\.ts"` and `grep -E "signup\.ts"`, both of which returned only the pre-existing baseline matches (no new errors). Out-of-scope per `<scope_boundary>`. Already logged as a deferred observation in 14-01 SUMMARY; not re-logged here.

## User Setup Required

None — no external service configuration required. Operator UAT pending:
- Send a real confirmation email via production Resend (or use a real Resend API key in `RESEND_API_KEY` locally) and inspect cross-client rendering in Apple Mail / Gmail / Outlook web / Proton Mail. D-20 explicitly defers this verification to operator walk-through.

## Next Plan Readiness

- **Plan 14-04 (share UI on /pending, /confirmed, /manage):** Independent of this plan — wires share UI on prerendered pages using the `?rc=` URL param that Plan 14-02 already plumbs. Will consume the same `shareText` helper from `src/lib/copy.ts` that this plan consumed via the email side.
- **Plan 14-05 (smoke extension):** Smoke will exercise the redirect format from 14-02 and the share UI from 14-04. Per D-20, smoke does NOT exercise email-body assertions — those stay operator-driven.
- **Phase 15 (per-team OG images):** Will introduce `/r/CODE` as a server-rendered referral route. Phase 15's URL will eventually replace `/?ref=CODE` in the share line — but only if Phase 15 ships. For now, `/?ref=CODE` works because the landing page (`index.astro`) already reads `?ref=` and writes to `localStorage` per Phase 13's first-touch attribution.

## Threat Flags

None — the plan's `<threat_model>` already enumerates T-14-07 (HTML injection via teamHuman, accepted — allow-listed teams.json), T-14-08 (URL injection via referralCode, mitigated — `[a-z0-9]{8}` shape and DB UNIQUE), T-14-09 (PII in share line, accepted — only the user's own public referral code), T-14-10 (dev-fallback share-URL logging, accepted — dev-only by `isProd` gate at email.ts:10–14), and T-14-SC (supply-chain, mitigated — zero new packages). All five dispositions still hold post-implementation. No new trust-boundary surface introduced.

## Known Stubs

None.

## Self-Check: PASSED

- [x] `src/lib/email.ts` exists and contains the 5-param `sendMagicLink(...referralCode: string)` (verified via `grep -c "referralCode: string" src/lib/email.ts` → 1)
- [x] `src/lib/email.ts` imports `shareText` from `./copy` (verified via `grep -c "shareText" src/lib/email.ts` → 2: import + call)
- [x] `src/lib/email.ts` contains the muted `<p>` with `color:#5a5d68` and "Know someone else following" copy (verified via `grep -c "Know someone else following" src/lib/email.ts` → 1)
- [x] `src/lib/email.ts` dev fallback emits a `share:` log line (verified via `grep -c "share:" src/lib/email.ts` → 1)
- [x] `src/lib/email.ts` `sendManageLink` is byte-identical (verified — only the `sendMagicLink` block changed; `sendManageLink` at the bottom of the file is untouched)
- [x] `src/pages/api/signup.ts` passes `row.referral_code ?? ''` as the 5th `sendMagicLink` arg (verified via `grep -c "sendMagicLink(rawEmail, token, rawTeam, tz, row.referral_code" src/pages/api/signup.ts` → 1)
- [x] Commit `7a1ec5d` (Task 1) present on `main` (verified via `git log --oneline -2`)
- [x] Commit `fef2584` (Task 2) present on `main` (verified via `git log --oneline -2`)
- [x] No files deleted by either commit (verified via `git diff --diff-filter=D --name-only HEAD~2 HEAD` → empty)
- [x] `npx astro check` reports 20 errors (unchanged from pre-plan baseline) and zero new errors for `email.ts` or `signup.ts` (verified — the 4 `email.ts` errors at lines 7–10 are pre-existing `process` references untouched in this plan; `signup.ts` reports zero errors)
- [x] No untracked files left behind (verified via `git status --short` → empty)

---
*Phase: 14-share-experience*
*Completed: 2026-05-23*
