---
phase: 14-share-experience
plan: 02
subsystem: api

tags: [astro, sqlite, redirects, referral, share]

# Dependency graph
requires:
  - phase: 13-referral-code-attribution
    provides: vip_signups.referral_code column + RETURNING * on upsertVipSignup + getByEmail lookup
provides:
  - "/api/signup success 303 carries &email, &rc=<referral_code>, &team=<slug>"
  - "/api/confirm success 303s (status=ok, status=already) carry &rc=<referral_code>"
  - "Transport layer for SHARE-01: prerendered /pending and /confirmed now receive the user's referral_code via URL param"
affects: [14-04 share UI on /pending + /confirmed (consumes ?rc=), 14-05 smoke extensions (asserts redirect Location format)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Public-short-code transport via URL param appended to 303 Location (mirrors existing ?error= / ?email= / ?status= idioms)"
    - "Defensive null-guard around RETURNING * field that DB types as `string | null` but runtime invariant says non-null — fall through to bare redirect rather than crash"

key-files:
  created: []
  modified:
    - src/pages/api/signup.ts
    - src/pages/api/confirm.ts

key-decisions:
  - "D-01 honored: signup 303 carries &rc=<code>&team=<slug> on success only; honeypot 303 and back() error 303 unchanged (no signal leakage)"
  - "D-02 honored: confirm 303 carries &rc= on status=ok and status=already; bad-token / unknown intentionally skip rc"
  - "D-15 honored: &team= appended alongside &rc= so /pending's future inline script can personalize share-card heading without a second lookup"
  - "Defensive null-guard pattern: VipSignup.referral_code is typed `string | null` (db.ts:125) even though Phase 13 backfill + per-insert generation makes it non-null in practice — guard rather than crash"

patterns-established:
  - "303 Location header builds: same-origin path literal + URL-encoded query params (encodeURIComponent on every dynamic value, even those that are technically URL-safe like [a-z0-9]{8} codes and [a-z0-9_]+ slugs — defensive-encode convention from rawEmail)"
  - "Cast at the call site for db.prepare<...> .get() results since the prepared-statement generic does not infer the return shape"

requirements-completed: [SHARE-01]

# Metrics
duration: 9min
completed: 2026-05-23
---

# Phase 14 Plan 02: Append referral code to signup/confirm redirects Summary

**`/api/signup` and `/api/confirm` now carry the user's `referral_code` (and team slug from signup) on their success 303s, transporting the public short code to the two prerendered pages that Plan 14-04 will wire share UI onto.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-05-23T01:27:00Z (approx)
- **Completed:** 2026-05-23T01:35:51Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `POST /api/signup` success path 303s to `/pending?email=<urlencoded>&rc=<8-char>&team=<slug>` (was `/pending?email=<urlencoded>`)
- `GET /api/confirm` first-click success path 303s to `/confirmed?status=ok&rc=<8-char>` (was `/confirmed?status=ok`)
- `GET /api/confirm` re-click path 303s to `/confirmed?status=already&rc=<8-char>` (was `/confirmed?status=already`)
- `bad-token` and `unknown` paths on `/api/confirm` remain rc-free (D-02: nothing meaningful to share)
- Honeypot 303 (`Location: '/pending'`) and `back()` error 303 (`Location: /?error=...`) on `/api/signup` are byte-identical to pre-plan state — no signal leakage to bots, no rc on error redirects
- `VipSignup` type is now imported into both files via `import { ..., type VipSignup } from '../../lib/db'` (same import line, not a new line) so prepared-statement results can be narrowed without `// @ts-expect-error` or `as unknown as`

## Task Commits

Each task was committed atomically:

1. **Task 1: Append &rc= + &team= to /api/signup success 303** — `ab951c1` (feat)
2. **Task 2: Append &rc= to /api/confirm success 303s (status=ok and status=already)** — `fb82608` (feat)

**Plan metadata:** pending (this commit)

## Files Created/Modified

- `src/pages/api/signup.ts` — captured `upsertVipSignup.get(...)` result into `let row: VipSignup | undefined`, added defensive null-guard before composing Location, extended success Location to `/pending?email=...&rc=...&team=...`. Honeypot and `back()` paths untouched.
- `src/pages/api/confirm.ts` — cast `markConfirmed.get()` and `getByEmail.get()` results to `VipSignup | undefined`, appended `&rc=<encoded code>` to both success Locations with a graceful fall-through to bare status (no `rc=`) if the field is somehow null. `bad-token` / `unknown` lines untouched. `redirect(to)` helper untouched.

## Decisions Made

- **Defensive null-guard rather than non-null assertion.** `VipSignup.referral_code` is declared `string | null` in `db.ts:125`. Phase 13's backfill + per-insert generation makes it runtime-non-null, but a `!` assertion would crash a real user's signup if that invariant ever broke. Both files instead null-check `row.referral_code` / `updated.referral_code` / `existing.referral_code`: in signup.ts the null branch returns `back('server')` (the upsert is meant to RETURN a row so absence is a real DB fault); in confirm.ts the null branch falls through to the bare `?status=ok` / `?status=already` redirect (still a valid behavior — the user is signed up, they just don't get a share link this session).
- **`encodeURIComponent` on every dynamic value, even URL-safe ones.** `referral_code` is `[a-z0-9]{8}` and `rawTeam` is from a fixed `[a-z0-9_]` allow-list — neither could shape-shift a URL. But the existing code already wraps `rawEmail` in `encodeURIComponent`, and matching the convention is one fewer thing for the next reader to wonder about.

## Deviations from Plan

None — plan executed exactly as written. All `<acceptance_criteria>` greps returned the expected counts (1/1/1/1/1/1 for Task 1; 1/1/1/0 for Task 2). `npx astro check` clean for both touched files (pre-existing `@types/node` resolution errors in unrelated files were ignored per scope-boundary rule — `npm i --save-dev @types/node` would resolve them but is out of scope for this plan).

## Issues Encountered

- **`npx astro check` baseline noise.** First `npx astro check` run after Task 1 reported 20 errors across the codebase — all `Cannot find name 'Buffer'` / `'process'` / module `'node:crypto'` in files this plan did not touch (token.ts, db.ts, email.ts, …). These are pre-existing missing-type-defs issues unrelated to this plan's changes. The plan's `<verify>` block scopes the check to `grep -E "signup\.ts" || echo "no type errors"` and `grep -E "confirm\.ts"`, both of which returned `no type errors in <file>.ts`. Out-of-scope per `<scope_boundary>` deviation rule; not committed to `deferred-items.md` because the baseline is already a known operator-side fix (`npm i --save-dev @types/node`) tracked elsewhere.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Plan 14-03 (email share line):** sendMagicLink still receives 4 args (email, token, team, tz); Plan 14-03 will add the 5th `referral_code` argument and the `/api/signup` call site already has `row.referral_code` in scope (captured by this plan as a side-effect — no extra DB read needed).
- **Plan 14-04 (share UI on prerendered pages):** `/pending` and `/confirmed` now reliably receive `?rc=<code>` (and `/pending` also receives `?team=<slug>` per D-15) on every success path. The inline-script reader can pattern-match `index.astro:230-259`'s existing `?ref=` reader.
- **Plan 14-05 (smoke extension):** `scripts/smoke-signup.mjs` can now grep response bodies of `/pending?email=...&rc=...` and `/confirmed?status=ok&rc=...` for the share URL — both URLs are produced by following the 303 from the existing smoke cases.

## Threat Flags

None — no new auth surface, no new schema. `rc` is a public short identifier per PROJECT.md Key Decision; `team` is from a fixed allow-list (`VALID_TEAMS`). Both are `encodeURIComponent`-encoded into a same-origin Location path. T-14-03..06 from the plan's `<threat_model>` all hold (verified by `<acceptance_criteria>` greps).

## Self-Check: PASSED

- `src/pages/api/signup.ts` exists and contains `rc=${encodeURIComponent(row.referral_code)}&team=${encodeURIComponent(rawTeam)}` on the success Location (1 match) and `type VipSignup` in the import line (1 match). Honeypot `Location: '/pending' }` unchanged (1 match). `back()` helper `Location: \`/?error=` unchanged (1 match).
- `src/pages/api/confirm.ts` exists and contains `status=ok&rc=${encodeURIComponent` (1) and `status=already&rc=${encodeURIComponent` (1) and `type VipSignup` (1). `bad-token` / `unknown` lines have 0 occurrences of `rc=`.
- Commits `ab951c1` and `fb82608` present on `main` (`git log --oneline -5` shows both).
- `npx astro check` shows zero type errors specific to `signup.ts` or `confirm.ts`.

---
*Phase: 14-share-experience*
*Completed: 2026-05-23*
