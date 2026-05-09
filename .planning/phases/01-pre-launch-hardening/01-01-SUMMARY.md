---
phase: 01-pre-launch-hardening
plan: "01"
subsystem: ui
tags:
  - astro
  - prerender
  - inline-script
  - url-params
  - bugfix

requires: []
provides:
  - "/confirmed page renders distinct copy for all four ?status= values at runtime"
  - "COPY map pattern (banner/headline/sub/cta boolean) for status pages"
  - "cta-row toggle pattern for conditional Re-send links"
affects:
  - "01-04 (unsubscribed.astro mirrors this COPY map shape)"

tech-stack:
  added: []
  patterns:
    - "Frontmatter -> inline-script migration for URL-param reads on prerendered pages"
    - "Status-page COPY shape: banner/headline/sub/cta boolean"

key-files:
  created: []
  modified:
    - src/pages/confirmed.astro

key-decisions:
  - "D-21: COPY map and searchParams.get(status) moved from frontmatter into <script is:inline>"
  - "D-03: bad-token branch says 24 hours and shows Re-send confirmation CTA"
  - "Extended cta:true to unknown status (also a recovery state)"

patterns-established:
  - "Status-page COPY map: banner/headline/sub/cta boolean"
  - "CTA toggle via id=cta-row revealed when cta===true"
  - "All text via .textContent (not .innerHTML) — XSS-safe"

requirements-completed:
  - HARDEN-01

duration: 4min
completed: 2026-05-09
---

# Phase 01 Plan 01: confirmed.astro Prerender Bug Fix

**Fixed HARDEN-01 CRITICAL: `/confirmed` now reads `?status=` from `location.href` at runtime so expired-link clickers no longer falsely see success copy.**

## Performance

- **Duration:** ~4 min
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Migrated COPY map and status read out of Astro frontmatter (build-time, baked at `status='ok'`) into a `<script is:inline>` (browser-runtime).
- All four `?status=` redirect targets (`ok`, `already`, `bad-token`, `unknown`) now render distinct copy.
- Added `id="cta-row"` with a "Re-send confirmation →" link for `bad-token` and `unknown` states (per D-03).
- Updated `bad-token` copy from "7 days" to "24 hours" (consistent with plan 01-03's TTL drop).
- Preserved `prerender = true`, the Plausible analytics script, and `<style is:global>` verbatim.

## Task Commits

1. `00d49d2` fix(01-01): rewrite confirmed.astro to hydrate status from URL at runtime

## Files Modified

- `src/pages/confirmed.astro` — frontmatter `Astro.url.searchParams` read removed; skeleton elements (`#banner`, `#headline`, `#sub`, `#cta-row`) populated by inline script at browser runtime.

## Decisions Made

- D-21 applied verbatim (inline-script pattern from `index.astro:61-78` and `pending.astro:28-35`).
- D-03 applied (24h copy + Re-send CTA on bad-token).
- CTA extended to `unknown` because it is also a recovery state.
- Used `.textContent` everywhere (XSS-safe).

## Deviations from Plan

None.

## Recovery Note

This plan was originally executed by an isolated worktree subagent that hit a session-level Write/Bash permission wall and could not commit its SUMMARY.md. The orchestrator cherry-picked the agent's `0f71471` task commit (clean, single-file change to `src/pages/confirmed.astro`) onto main as `00d49d2`. A spurious follow-on commit (`427fcd3`) where the agent attempted `gsd-sdk query commit` with malformed CLI args was NOT cherry-picked. The agent's worktree garbage files (`./--phase`, `./01`) were not promoted.

## Next Phase Readiness

- Plan 01-04 (`/unsubscribed.astro`) should mirror this COPY shape: `banner/headline/sub/cta` boolean.

---

*Phase: 01-pre-launch-hardening*
*Completed: 2026-05-09*
