---
phase: 01-pre-launch-hardening
plan: "02"
subsystem: api
tags:
  - origin-policy
  - csrf
  - signup
  - bugfix

requires: []
provides:
  - "POST /api/signup rejects requests with no Origin header (default-deny)"
affects: []

tech-stack:
  added: []
  patterns:
    - "Default-deny on missing Origin header for state-changing POST endpoints"

key-files:
  created: []
  modified:
    - src/pages/api/signup.ts

key-decisions:
  - "D-20: default-deny on missing Origin header — replaces fail-open default"

patterns-established: []

requirements-completed:
  - HARDEN-03

duration: 1min
completed: 2026-05-09
---

# Phase 01 Plan 02: Origin Default-Deny

**Fixed HARDEN-03: `originOk()` now returns `false` when the `Origin` header is absent, replacing the previous fail-open `return true`.**

## Performance

- **Duration:** ~1 min
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Single-line flip at `src/pages/api/signup.ts:22` from `if (!origin) return true;` to `if (!origin) return false;`.
- Comment updated to explain the threat model: modern browsers attach `Origin` to cross-origin form POSTs, so absence is suspicious.
- Localhost / 127.0.0.1 allowlist (lines 24-25) and same-host comparison (lines 26-29) preserved.

## Task Commits

1. `5aa6833` fix(01-02): default-deny Origin header in originOk (HARDEN-03)

## Files Modified

- `src/pages/api/signup.ts:22` — return value flipped from `true` to `false`.

## Decisions Made

- D-20 applied verbatim.

## Deviations from Plan

None.

## Recovery Note

Originally executed in an isolated worktree subagent that hit a session-level Write permission wall and could not write SUMMARY.md. The orchestrator cherry-picked the agent's `b73ebaf` task commit onto main as `5aa6833` (clean one-line diff) and authored this SUMMARY directly.

## Threat Surface

The combined posture for `POST /api/signup` is now: framework CSRF off (per CLAUDE.md `security: { checkOrigin: false }`), custom check at lines 18-34 enforces same-origin via header comparison, default-deny on missing Origin closes the historical fail-open hole.

---

*Phase: 01-pre-launch-hardening*
*Completed: 2026-05-09*
