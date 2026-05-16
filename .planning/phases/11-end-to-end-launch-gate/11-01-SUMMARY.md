---
phase: 11-end-to-end-launch-gate
plan: 01
subsystem: ui
tags: [css, accessibility, wcag, contrast, index.astro]

requires:
  - phase: 06-landing-page-form-meta-analytics
    provides: src/pages/index.astro with --accent token and inline style is:global block

provides:
  - Deepened --accent: #b8350d (banner pill, link accents, border — all --accent consumers)
  - submit-button background: #c43d15 (independent override, two-distinct-values per D-02)
  - All four focus rings updated to track new color values (no stale 217,74,31 RGB)

affects:
  - 11-02-gate-runner (AC8 Lighthouse mobile a11y now de-risked against run-to-run variance)

tech-stack:
  added: []
  patterns:
    - "Two-distinct-WCAG-values pattern: global --accent token (#b8350d for banner/borders) + direct background override (#c43d15) on submit button, both clearing WCAG-AA >=4.5:1"

key-files:
  created: []
  modified:
    - src/pages/index.astro

key-decisions:
  - "D-02 executed: color-value-only commit — no markup, no JS, no Layout.astro refactor bundled"
  - "submit-button gets direct background: #c43d15 override (not a second CSS token) per Phase-6 structure-lock (minimal surface)"
  - "All three non-button focus rings track global --accent via rgba(184,53,13,0.15); submit-button focus ring tracks its own value rgba(196,61,21,0.35)"

patterns-established:
  - "WCAG-AA contrast fix pattern: deepen both global token and submit-button override independently; update all hardcoded rgba() focus-ring values to match"

requirements-completed: []

duration: 5min
completed: 2026-05-15
---

# Phase 11 Plan 01: Accessibility Contrast Fix Summary

**Deepened two accent color values in index.astro inline CSS — banner pill #d94a1f to #b8350d and submit button to #c43d15 — closing the two Phase-6 WCAG-AA serious contrast hits ahead of the AC8 Lighthouse gate**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-15T21:22:00Z
- **Completed:** 2026-05-15T21:27:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Changed `--accent` CSS token from `#d94a1f` to `#b8350d` — banner pill contrast 3.6:1 -> >=4.5:1 WCAG-AA
- Added direct `background: #c43d15` override on `button[type="submit"]` — button contrast 4.24:1 -> >=4.5:1 WCAG-AA
- Updated all four hardcoded focus-ring `rgba()` values: submit-button ring tracks `#c43d15` (alpha 0.35), email-input + details-summary + footer-link rings track `#b8350d` (alpha 0.15)
- Zero stale `#d94a1f` or `217, 74, 31` values remain in the file
- Build passes; LAND-02 grep clean on `dist/client/index.html`; no U+2019 introduced

## Task Commits

1. **Task 1: Deepen the two accent values + track the focus rings (D-02)** - `fe2ecf6` (fix)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/pages/index.astro` — six CSS value substitutions in the inline `<style is:global>` block; markup, OG meta, JS blocks, and deferred Layout.astro refactor untouched

## Decisions Made

- Used a direct `background: #c43d15` override on the submit-button rule (not a new CSS custom property) to honor the Phase-6 minimal-surface structure-lock and the D-02 "two distinct values" requirement without introducing a new token scope
- All other --accent consumers (banner text, border, link colors) inherit the deepened token automatically — no further changes needed

## Deviations from Plan

None — plan executed exactly as written. Six CSS value substitutions, build verified, all acceptance criteria green.

## Issues Encountered

None. The stale-value grep command in `<verify>` exits with code 1 (no matches = desired outcome) which caused a composed shell chain to short-circuit; validated each check individually to confirm all passed.

## Known Stubs

None — this is a color-only CSS edit with no data flow or rendering stubs.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The only public-surface change is deepened CSS color values — inert from a security perspective (T-11-01-02 accept disposition per plan threat model).

## Next Phase Readiness

- `src/pages/index.astro` is ready for the Phase-11 gate run (Plan 02)
- AC8 Lighthouse a11y de-risked: the two serious WCAG-AA contrast hits that held Phase-6 a11y at 94 are now closed before the prod Lighthouse run
- No blockers for Plan 02 (gate-runner build)

## Self-Check: PASSED

- `fe2ecf6` commit exists: confirmed (`git rev-parse --short HEAD`)
- `src/pages/index.astro` modified: confirmed (6 insertions, 6 deletions)
- `#b8350d` present in source: confirmed (`grep -c` = 1)
- `#c43d15` present in source: confirmed (`grep -c` = 1)
- No stale `#d94a1f` / `217,74,31` in source: confirmed (grep returned no output)
- LAND-02 clean on `dist/client/index.html`: confirmed (no hits)
- No U+2019 in source: confirmed
- `npm run build` succeeded: confirmed (`dist/server/entry.mjs` + `dist/client/index.html` produced)
- Diff limited to `src/pages/index.astro`: confirmed (1 file changed)

---
*Phase: 11-end-to-end-launch-gate*
*Completed: 2026-05-15*
