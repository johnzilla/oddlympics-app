---
phase: 14-share-experience
plan: 05
subsystem: smoke
tags: [smoke, share, referral, ts-strip, verification, wave-3]

# Dependency graph
requires:
  - .planning/phases/14-share-experience/14-01-SUMMARY.md (shareText helper in src/lib/copy.ts — informational; smoke does not import it)
  - .planning/phases/14-share-experience/14-02-SUMMARY.md (/api/signup 303 carries &rc=&team=; /api/confirm 303 carries &rc=)
  - .planning/phases/14-share-experience/14-03-SUMMARY.md (email share line — informational; D-20 keeps email body operator-UAT, not smoke-asserted)
  - .planning/phases/14-share-experience/14-04-SUMMARY.md (share-card markup on /pending and /confirmed; TEAM_LABEL_JSON on /pending only)
provides:
  - "scripts/smoke-signup.mjs SHARE-pending-card case (D-18): proves /pending response body contains share-card markup + the team label from TEAM_LABEL_JSON"
  - "scripts/smoke-signup.mjs SHARE-confirmed-card case (D-19 page-render side): proves /confirmed response body contains share-card markup on status=ok"
  - "scripts/smoke-signup.mjs SHARE-confirm-redirect-location case (D-19 redirect side): proves /api/confirm's 303 Location carries &rc=<real referral_code> on first-click (status=ok) AND re-click (status=already) — closes the gap a synthetic-rc page-render check leaves open"
affects:
  - "Pre-launch gate: a future regression that drops &rc= from /api/confirm's 303 will now fail the smoke at gate-check time, not at operator UAT"
  - "Phase 14 closes: with SHARE-01/02/04 under automated regression coverage, the milestone-level verification surface is operator-UAT-only for D-20 browser-API behavior (navigator.share / navigator.clipboard) and email-body cross-client rendering"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "In-script TS import via Node 22.6+ native --experimental-strip-types (default-on flag in Node 22.6, stable in Node 23+, default in Node 26) — single-file Node script can import a .ts module without tsx, ts-node, or a build step"
    - "Per-run unique email pattern (`share-confirm-redirect-${Date.now()}@example.com`) for cases that confirm rows — matches the existing smoke-${name}-${Date.now()}@example.com convention used by cases 1, 4, 5"
    - "Header comment block above the three SHARE-* cases — same density as existing per-case banners; documents D-18/D-19 mapping and D-20 carve-out (browser-API still operator-only)"
    - "Distinct RFC 5737 TEST-NET-1 IP per smoke concern (SMOKE_IP, REF_IP, SELF_REF_IP, SHARE_IP) — keeps the case-7 rate-limit pre-condition (~3 of 5 SMOKE_IP slots consumed) stable"

key-files:
  created: []
  modified:
    - path: scripts/smoke-signup.mjs
      lines: 483 → 615 (+132 net): mintToken TS import + Node 22.6+ note; SHARE_IP constant; 3 new runCase blocks with shared header comment; cleanup hint extended

decisions:
  - "Per-run unique email for case 3 (deviation from the plan's literal `share-confirm-redirect@example.com`) — required for idempotence across consecutive runs against the same DB (the case writes confirmed_at, so a fixed email hits status=already on a 2nd run). Matches the existing `smoke-${name}-${Date.now()}@example.com` pattern. Rule 1 (auto-fix bug) — the test as literally written cannot pass on the 2nd consecutive run."
  - "Used `team: 'united_states'` (deviation from the plan's literal `team: 'usa'`) — `usa` is not a slug in references/teams.json (the slug is `united_states`, label `United States`). Without this fix the POST silently 303'd to /?error=bad-form and no row was written. Rule 1 (auto-fix bug) — the test as literally written cannot succeed because the chosen slug doesn't exist."
  - "TS import path (mintToken from '../src/lib/token.ts') CHOSEN over the documented fallbacks. Node 26 (the project's actual runtime — confirmed via `node --version` returning v26.0.0) strips TS by default; no flag, no extra deps, no duplicated token-format implementation."
  - "Added a redirect-location guard to the signup step in case 3 (`if (!signupRes.location?.startsWith('/pending?email=')) return false;`) — without it, the test silently passes a 303 to /?error=bad-form as a 'successful' signup. Defense-in-depth against future slug/tz regressions in the smoke itself."
  - "Used a plain object (`const form = {...}`) for the form payload instead of `new URLSearchParams({...})` — the existing `post(form, ...)` helper at line 76-90 wraps `form` in `new URLSearchParams(form)` internally; passing a URLSearchParams works but the plain-object form matches the convention used by every other case (1, 4, 5, REF-*)."

patterns-established:
  - "Smoke script can mint server-equivalent magic-link tokens via direct TS import of src/lib/token.ts — useful when future cases need to test token-gated endpoints without driving the full email loop"
  - "Two-layer redirect-location assertion: status code (303) AND Location header content — catches both transport failures and routing regressions; the existing case-1/case-2 status-only checks are a weaker form of this"

requirements-completed: [SHARE-01, SHARE-02, SHARE-04]

# Metrics
duration: 360s
completed: 2026-05-23T01:57:52Z
tasks: 1
files: 1
---

# Phase 14 Plan 05: Smoke extension for SHARE-01/02/04 — Summary

**`scripts/smoke-signup.mjs` now ships three new SHARE-* automated cases that cover D-18 (`/pending` share card), D-19 page-render side (`/confirmed` share card), and D-19 redirect side (`/api/confirm` 303 Location carries `&rc=<real-code>`). The smoke now reports `pass=17 fail=0` end-to-end. SHARE-01/02/04 are fully under automated regression coverage; D-20 browser-API behavior remains operator-UAT only.**

## Performance

- **Duration:** ~6 min (including end-to-end dev-server runs to verify, plus two-bug auto-fix cycle on the new case 3)
- **Started:** 2026-05-23T01:52:10Z (approx)
- **Completed:** 2026-05-23T01:57:52Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- **mintToken in-script TS import** (`import { mintToken } from '../src/lib/token.ts';`) — Node 26 strips TS by default; Node 22.6+ supports it via the default-on `--experimental-strip-types` flag. No new npm dep, no tsx, no build step. A header comment notes the Node 22.6+ requirement so older 22.x ops can `node --experimental-strip-types ...` explicitly.
- **SHARE_IP = '192.0.2.45'** — RFC 5737 TEST-NET-1, dedicated to case 3's one signup POST. SMOKE_IP slot accounting unchanged → case-7 rate-limit pre-condition holds.
- **SHARE-pending-card** — GET `/pending?email=share-smoke%40example.com&rc=abc12345&team=brazil`; asserts HTTP 200 and response body contains `share-card`, `share-url`, AND `Brazil` (last one proves the Plan 14-04 `TEAM_LABEL_JSON` injection actually serializes the slug→label map into the inline script).
- **SHARE-confirmed-card** — GET `/confirmed?status=ok&rc=abc12345`; asserts HTTP 200 and response body contains `share-card`, `share-url`. No team-label assertion (D-16: /confirmed deliberately omits `TEAM_LABEL_JSON` because the confirm 303 carries no `&team=`).
- **SHARE-confirm-redirect-location** — full end-to-end: POST `/api/signup` with SHARE_IP → read `referral_code` from DB via `dbRowFor` → mint a `purpose: 'confirm'` token via `mintToken` → GET `/api/confirm?token=...` with `redirect: 'manual'` → assert 303 + Location matches `/confirmed?status=ok&rc=<encodeURIComponent(referral_code)>`. Then a 2nd GET with the same token asserts the re-click path `/confirmed?status=already&rc=<code>`. This is the only case in the suite that catches a regression dropping `&rc=` from `/api/confirm`'s 303 — the synthetic-rc check (SHARE-confirmed-card) does not.
- **Per-run unique email** (`share-confirm-redirect-${Date.now()}@example.com`) — case 3 sets `confirmed_at` so a fixed email would hit `status=already` on a 2nd run. The `${Date.now()}` pattern matches the existing `smoke-valid-${Date.now()}` convention; two consecutive smoke runs both report 17/17 PASS.
- **Cleanup hint extended** — the file-header comment and the final `if (fail > 0)` cleanup line both now mention `share-confirm-redirect-%@example.com` as a `LIKE` pattern (the timestamp suffix means each run produces a new row).

## Task Commits

1. **Task 1: Add SHARE-pending-card, SHARE-confirmed-card, SHARE-confirm-redirect-location smoke cases** — `150be30` (feat)

**Plan metadata:** pending (next commit)

## Files Created/Modified

- `scripts/smoke-signup.mjs` — added the `mintToken` TS import + Node 22.6+ comment; added the `SHARE_IP` constant; inserted three new `runCase` blocks (with a shared 8-line header comment documenting the D-18/D-19/D-20 mapping) between `REF-code-uniqueness` and `case-7-rate-limit`; updated both cleanup hints (file header + post-fail `console.log`) to include the new email pattern; updated the file-header "How to run" block to note the Node 22.6+ requirement for the in-script TS import. Existing cases are byte-identical to pre-plan state.

## Verification

### Acceptance criteria (from plan `<acceptance_criteria>`)

| Check | Expected | Actual | Pass |
|-------|----------|--------|------|
| `grep -c "SHARE-pending-card" scripts/smoke-signup.mjs` | ≥ 1 | 2 (header comment + runCase name) | ✓ |
| `grep -c "SHARE-confirmed-card" scripts/smoke-signup.mjs` | ≥ 1 | 2 (header comment + runCase name) | ✓ |
| `grep -c "SHARE-confirm-redirect-location" scripts/smoke-signup.mjs` | ≥ 1 | 3 (TS-import comment + header comment + runCase name) | ✓ |
| `grep -c "SHARE_IP" scripts/smoke-signup.mjs` | ≥ 1 | 4 (constant decl + 3 references in case 3) | ✓ |
| `grep -c "mintToken" scripts/smoke-signup.mjs` | ≥ 2 | 5 (import + 4 references in case 3 / comments) | ✓ |
| `grep -c "status=ok&rc=" scripts/smoke-signup.mjs` | ≥ 1 | 4 (D-18 url + case 3 expected + comments) | ✓ |
| `grep -c "status=already&rc=" scripts/smoke-signup.mjs` | ≥ 1 | 3 (case 3 expected2 + comments) | ✓ |
| Ordering: SHARE-* cases appear BEFORE case-7-rate-limit | line(SHARE) < line(case-7) | SHARE-pending-card @ 461, SHARE-confirmed-card @ 482, SHARE-confirm-redirect-location @ 510, case-7 @ 580 | ✓ |
| `node --check scripts/smoke-signup.mjs` exits 0 | clean | clean ("syntax OK") | ✓ |
| End-to-end smoke (npm run dev + node scripts/smoke-signup.mjs) | pass=17 fail=0, exit 0 | pass=17 fail=0, exit 0 (verified twice consecutively to confirm idempotence) | ✓ |

### TDD cycle

- **RED:** Pre-implementation `grep -c "SHARE-pending-card\|SHARE-confirmed-card\|SHARE-confirm-redirect-location\|SHARE_IP\|mintToken" scripts/smoke-signup.mjs` returned `0, 0, 0, 0, 0`. Confirmed at 2026-05-23T01:53:30Z (approx).
- **GREEN:** Post-implementation greps returned the expected counts (2/2/3/4/5). Critically: `node --check scripts/smoke-signup.mjs` exits 0; `node scripts/smoke-signup.mjs` against a fresh `npm run dev` reports `pass=17 fail=0` and exits 0; a 2nd consecutive run (no DB reset, no server restart-other-than-rate-limit) also reports `pass=17 fail=0`.
- **REFACTOR:** Two auto-fix iterations on case 3 (see "Deviations" below). After fixes, no further refactoring needed.

The project has no formal test suite per CLAUDE.md; the RED→GREEN cycle was driven by acceptance-criteria grep counts + end-to-end live-dev-server runs.

## Deviations from Plan

Two Rule-1 (auto-fix bug) deviations from the plan's literal directives in case 3 — both required to make the test pass against the actual codebase. Both documented inline as comments in the smoke for the next reader.

### [Rule 1 - Bug] Team slug `usa` does not exist in references/teams.json

- **Found during:** First end-to-end run of case 3 — signup returned 303 to `/?error=bad-form` and no row was written. dbRowFor returned undefined.
- **Issue:** Plan 14-05 case 3 literal directive: `team: 'usa'`. `usa` is not a slug in `references/teams.json` — the slug for the United States is `united_states` (label "United States"). The signup endpoint correctly rejected with `bad-form`, but the test asserted only `status === 303` (which `/?error=bad-form` satisfies) and then failed downstream on `dbRowFor` returning undefined.
- **Fix:** Changed to `team: 'united_states'`. Also added a redirect-target guard (`if (!signupRes.location?.startsWith('/pending?email=')) return false;`) so a future slug regression in the smoke itself produces a specific error message instead of a confusing downstream DB-row-missing error.
- **Files modified:** `scripts/smoke-signup.mjs` (case 3 body only)
- **Commit:** `150be30`

### [Rule 1 - Bug] Fixed email is not idempotent across consecutive runs

- **Found during:** Second end-to-end run of case 3 after first run fixed the slug bug.
- **Issue:** Plan 14-05 case 3 literal directive: `const email = 'share-confirm-redirect@example.com';`. Case 3 POSTs a signup AND walks the confirm flow which writes `confirmed_at`. On a 2nd consecutive run, the row from the 1st run is already `confirmed`, so `markConfirmed.get()` (which has `WHERE confirmed_at IS NULL`) returns nothing, the code falls through to the "already confirmed" path, and the Location is `/confirmed?status=already&rc=...` instead of the asserted `/confirmed?status=ok&rc=...`. The case fails on every run after the first.
- **Fix:** Switched to a per-run unique email: `const email = \`share-confirm-redirect-${Date.now()}@example.com\`;`. Matches the existing `smoke-valid-${Date.now()}` / `smoke-rl-${Date.now()}` convention used by other cases that write to the DB. Also extended the cleanup hint (both the file-header comment and the post-fail console.log) from `email = 'share-confirm-redirect@example.com'` to `email LIKE 'share-confirm-redirect-%@example.com'` so operators clean up timestamped rows correctly.
- **Files modified:** `scripts/smoke-signup.mjs` (case 3 email + 2 cleanup hint locations)
- **Commit:** `150be30`

### Non-deviations (plan-prescribed fallbacks not needed)

- **TS-import path worked on the first try** — Node 26 (`node --version` → v26.0.0) strips TS by default. The plan's documented fallbacks (inline-reimplement mintToken via `node:crypto`, OR downgrade case 3 to a DEPLOY.md curl recipe) were not exercised. The preferred path is shipped.

## Issues Encountered

- **Dev-server in-memory rate-limit state from prior smoke runs caused initial confusion during verification.** After the first run, SMOKE_IP had used 7 of 5 hourly slots (cases 1, 4, 5 + case-7's 4 attempts), so the 2nd run reported 8 PASS / 9 FAIL with every `SMOKE_IP`-based valid-signup case returning `/?error=rate-limited`. Fix: `pkill -f 'astro dev'` between verification runs to reset the in-memory limiter map. The smoke itself is correct — this is just the documented "rate-limiter resets on server restart" behavior from `case-7-rate-limit`'s comment block.
- **No persistent issues.** The two auto-fix bugs above were both single-iteration fixes.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Phase 14 closure:** With SHARE-01/02/04 under automated regression coverage and D-20 explicitly scoped to operator UAT (browser-API behavior + email cross-client rendering), Phase 14's verification surface is fully covered as designed. The phase summary should record `[Phase 14]: Plan 14-05 — smoke extended with SHARE-pending-card / SHARE-confirmed-card / SHARE-confirm-redirect-location; pass=17 fail=0 against live dev server; D-19 redirect-side regressions now gate at smoke time, not operator UAT`.
- **Phase 15 (per-team OG images + `/r/CODE` server-rendered referral route):** Will introduce a new server route that the smoke can later assert against in the same pattern as `/api/confirm` here (POST signup → read row → curl the new route → grep). The mintToken TS-import pattern established here is reusable.
- **Pre-launch operator actions (2026-06-11 group-stage kickoff):** Unaffected by Phase 14 — `scripts/launch-blast.mjs --send`, `KICKOFF_NOTIFICATIONS_ENABLED=true` flip, end-to-end one real kickoff smoke, football-data.org name→slug mapping check.

## Threat Flags

None — Plan 14-05 introduces zero new trust-boundary surface. The four threats in the plan's `<threat_model>`:

- **T-14-19** (Information Disclosure: residual rows) — `accept`. Mitigated by the cleanup-hint update and the per-run-unique email pattern; rows accumulate `share-confirm-redirect-<ts>@example.com` and `smoke-*-<ts>@example.com` and are deleted via the documented LIKE pattern.
- **T-14-20** (Tampering: synthetic rc collision with real code) — `accept`. The synthetic `rc=abc12345` is `[a-z0-9]{8}`; collision probability ~3.6e-13 per real code; GET-only against prerendered pages so no `referred_by` side effect.
- **T-14-21** (Tampering: smoke minting tokens for arbitrary emails) — `accept`. Smoke runs against dev DB; dev `MAGIC_LINK_SECRET` is a fixed dev string per token.ts; secret-management protocol is the real defense.
- **T-14-SC** (Tampering: package installs) — `mitigate`. Zero new packages — the TS-import path uses Node's built-in `--experimental-strip-types`, not a new dev dep like `tsx`. `package.json` is byte-identical to pre-plan state.

No new surface introduced beyond the documented register.

## Known Stubs

None.

## Self-Check

- [x] `scripts/smoke-signup.mjs` contains `SHARE-pending-card` runCase name (verified via `grep -c "SHARE-pending-card" scripts/smoke-signup.mjs` → 2)
- [x] `scripts/smoke-signup.mjs` contains `SHARE-confirmed-card` runCase name (verified via `grep -c "SHARE-confirmed-card" scripts/smoke-signup.mjs` → 2)
- [x] `scripts/smoke-signup.mjs` contains `SHARE-confirm-redirect-location` runCase name (verified via `grep -c "SHARE-confirm-redirect-location" scripts/smoke-signup.mjs` → 3)
- [x] `scripts/smoke-signup.mjs` imports `mintToken` from `../src/lib/token.ts` (verified via `grep -c "mintToken" scripts/smoke-signup.mjs` → 5)
- [x] `scripts/smoke-signup.mjs` defines `SHARE_IP = '192.0.2.45'` (verified via `grep -c "SHARE_IP" scripts/smoke-signup.mjs` → 4)
- [x] All three SHARE-* cases appear BEFORE `case-7-rate-limit` (verified via line-number grep — SHARE cases at 461 / 482 / 510, case-7 at 580)
- [x] `node --check scripts/smoke-signup.mjs` exits 0 (verified — "syntax OK")
- [x] End-to-end `node scripts/smoke-signup.mjs` against a fresh `npm run dev` reports `pass=17 fail=0` and exits 0 (verified twice consecutively for idempotence)
- [x] Commit `150be30` exists on `main` (verified via `git log --oneline -1` → `150be30 feat(14-05): add SHARE-* smoke cases for /pending /confirmed /api/confirm`)
- [x] No files deleted by the task commit (verified via `git diff --diff-filter=D --name-only HEAD~1 HEAD` → empty)
- [x] No untracked files left behind (verified via `git status --short` → empty)

## Self-Check: PASSED

---
*Phase: 14-share-experience*
*Completed: 2026-05-23*
