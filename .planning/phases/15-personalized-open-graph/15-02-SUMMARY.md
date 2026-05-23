---
phase: 15-personalized-open-graph
plan: "02"
subsystem: og-render-toolchain
tags: [og-image, resvg, svg-template, render-script, phase-15]
dependency_graph:
  requires: []
  provides: [references/og-image-team.svg, scripts/render-team-og-images.mjs, npm:og:render-teams]
  affects: [public/og/, Plan 15-03 runs the script to produce PNGs]
tech_stack:
  added: []
  patterns: [parameterized-svg-template, batch-render-loop, per-item-6-check-verification, tmpfile-land-02-grep]
key_files:
  created:
    - references/og-image-team.svg
    - scripts/render-team-og-images.mjs
  modified:
    - package.json
decisions:
  - "D-07 headline copy locked: 'Following {{TEAM_LABEL}}. / Every match in your zone. / One ping before kickoff.' with #d94a1f accent on line 3"
  - "D-08 font-size buckets: labelLen<=12→64pt, labelLen<=16→52pt, >16→44pt applied to all 3 headline lines"
  - "D-11 Resvg config (loadSystemFonts: false, fitTo width:1200) copied verbatim from render-og-image.mjs as separate sibling script"
  - "D-12a exit contract: exits 1 on any FAIL, prints N/48 PASS on success (teams-fully-passed = totalPass/6)"
  - "T-15-07 verified: all 48 labels in references/teams.json are SVG-clean (no <, >, & chars)"
  - "T-15-09 mitigated: tmpfile path uses slug ([a-z0-9_]) + pid, wrapped with JSON.stringify for shell-safe quoting"
metrics:
  duration: "~9 minutes"
  completed_date: "2026-05-23"
  tasks_completed: 3
  files_changed: 3
---

# Phase 15 Plan 02: OG Render Toolchain Summary

Parameterized SVG template + per-team render script + npm script entry for the Phase 15 per-team OG image toolchain.

## What Was Built

**One-liner:** SVG template with `{{TEAM_LABEL}}`/`{{HEADLINE_FONT_SIZE}}` tokens + 128-line render script that loops 48 teams → `public/og/<slug>.png` with 6-check per-team verification and LAND-02 tmpfile grep.

### Task 1 — `references/og-image-team.svg`

Near-copy of `references/og-image.svg`. The headline `<g>` block (lines 31-36) is replaced with the D-07 parameterized block. All other sections (background, gradients, wordmark, banner pill, sub line, URL, flag art, bottom-right tag) are preserved byte-for-byte per D-06.

Token placement:
- `{{TEAM_LABEL}}` appears exactly once (headline line 1: "Following {{TEAM_LABEL}}.")
- `{{HEADLINE_FONT_SIZE}}` appears exactly three times (one per `<text>` line)
- `fill="#d94a1f"` on headline line 3 ("One ping before kickoff.") preserved per D-07

### Task 2 — `scripts/render-team-og-images.mjs` (128 lines)

Batch render script. Key implementation decisions:

- Template loaded once outside the loop (`readFileSync` before iteration)
- Per-team: string-replace both tokens globally, construct `Resvg(Buffer.from(svg), ...)`, render, write to `public/og/<slug>.png`
- D-08 font-size buckets applied at render time: `Bosnia and Herzegovina` (22 chars) → 44pt; `Czech Republic`/`United States` → 52pt; remaining 45 teams → 64pt
- Resvg config copied verbatim from `render-og-image.mjs` (D-11: same fontFiles, `loadSystemFonts: false`, `fitTo: {mode: 'width', value: 1200}`)
- Per-team 6-check block: file-exists, png-signature, ihdr-width-1200, ihdr-height-630, size-lt-300kb, land-02-clean
- LAND-02 runs against substituted SVG written to a tmpfile (not the template), then deleted in `finally` block
- Aggregates `totalPass`/`totalFail` across all 48 teams; exit code matches D-12a contract

### Task 3 — `package.json`

Added `"og:render-teams": "node scripts/render-team-og-images.mjs"` immediately after the existing `"og:render"` entry. Added trailing comma to the prior last entry.

## Threat Mitigations Applied

| Threat | Mitigation |
|--------|------------|
| T-15-07: SVG-injection via team label `<`, `>`, `&` | Verified all 48 labels are SVG-clean. Comment in script documents this assumption. |
| T-15-08: EXIF leak in output PNGs | Resvg produces bare PNGs (IHDR/IDAT/IEND only). Plan 15-03 includes a `file` assertion. |
| T-15-09: shell-injection via tmpfile path | Path uses slug `[a-z0-9_]` + PID integers; wrapped with `JSON.stringify`. |
| T-15-LAND: banned terms in team labels via substituted SVG | Per-team LAND-02 runs against the substituted SVG tmpfile — catches label-side regressions. |
| T-15-SC: package installs | No new packages — `@resvg/resvg-js` already in devDependencies. |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this plan creates toolchain only (no rendered PNGs). Plan 15-03 runs `npm run og:render-teams` and commits the 48 PNGs to `public/og/`.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED

- `references/og-image-team.svg` exists: PASS
- `scripts/render-team-og-images.mjs` exists: PASS
- `package.json` has `og:render-teams`: PASS
- Commits exist: e473f3f, 58c83d4, 76e65a7
- No unexpected deletions: PASS
- `node --check scripts/render-team-og-images.mjs` exits 0: PASS
- LAND-02 clean on template: PASS
- All 48 team labels SVG-safe (T-15-07): PASS
