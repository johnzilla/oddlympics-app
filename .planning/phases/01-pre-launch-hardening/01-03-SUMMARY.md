---
phase: 01-pre-launch-hardening
plan: "03"
subsystem: auth
tags: [hmac, token, magic-link, ttl, security]

# Dependency graph
requires: []
provides:
  - "HMAC magic-link tokens with 24-hour TTL (down from 7 days)"
  - "Baseline token.ts for plan 04 purpose-claim extension"
affects:
  - "01-04-PLAN.md (mintToken/verifyToken purpose extension builds on this baseline)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TTL_SECONDS constant as the single source of truth for token lifetime; change it, all minted tokens follow"

key-files:
  created: []
  modified:
    - "src/lib/token.ts"

key-decisions:
  - "TTL drop only (D-01): no DB-tracked nonce added; row-level idempotency (markConfirmed WHERE confirmed_at IS NULL) is sufficient for v1 replay protection"
  - "No proactive invalidation of in-flight 7-day tokens (D-04): verifyToken checks embedded exp field, so legacy tokens age out naturally without a migration"
  - "Purpose claim NOT added in this plan (plan 04 owns that extension)"

patterns-established: []

requirements-completed:
  - HARDEN-06

# Metrics
duration: 5min
completed: "2026-05-09"
---

# Phase 01 Plan 03: TTL Reduction Summary

**Magic-link replay window shrunk 7x by dropping TTL_SECONDS from 604800 (7 days) to 86400 (24 hours) in src/lib/token.ts — single-line constant change, no migration needed**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-09T01:33:00Z
- **Completed:** 2026-05-09T01:34:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- TTL_SECONDS changed from `60 * 60 * 24 * 7` to `60 * 60 * 24` (86400 seconds = 24 hours)
- Comment updated from `// 7 days` to `// 24 hours`
- Legacy 7-day tokens already in flight age out naturally; no migration needed (D-04)
- `mintToken`/`verifyToken` signatures left untouched for plan 04 to extend with `purpose` claim

## Task Commits

1. **Task 1: Drop TTL_SECONDS from 7 days to 24 hours** - `c3023fe` (fix)

**Plan metadata:** (committed with SUMMARY.md below)

## Files Created/Modified

- `src/lib/token.ts` - TTL_SECONDS constant changed from 604800 to 86400; comment updated

## Decisions Made

- TTL drop only, no nonce (D-01): row-level idempotency already prevents replay damage
- No proactive invalidation (D-04): embedded `exp` in existing tokens enforces their original lifetime naturally
- `purpose` claim deferred to plan 04: keeps this change reviewable in isolation

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

`npx astro check` surfaced pre-existing type errors (`@types/node` not in project devDependencies — affects `db.ts`, `email.ts`, `rate-limit.ts`, `token.ts` alike). These errors are pre-existing across the entire codebase and unrelated to this plan's single-line change. `npm run build` exits 0 cleanly. This is out of scope per scope boundary rule; logged here for awareness.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `src/lib/token.ts` is at the baseline plan 04 requires
- Plan 04 can now safely extend `mintToken(email: string)` to `mintToken(email: string, purpose: string)` and add purpose verification to `verifyToken`
- No blockers

---
*Phase: 01-pre-launch-hardening*
*Completed: 2026-05-09*
