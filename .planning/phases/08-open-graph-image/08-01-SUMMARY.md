---
phase: 08-open-graph-image
plan: "01"
subsystem: static-assets
tags: [og-image, svg-render, fonts, devDep]
dependency_graph:
  requires: []
  provides: [public/og-image.png, scripts/render-og-image.mjs, references/fonts]
  affects: [dist/client/og-image.png]
tech_stack:
  added: ["@resvg/resvg-js@2.6.2 (devDep, exact pin)"]
  patterns: [static-weight-ttf-vendoring, inline-post-render-verification, import-meta-url-path-resolution]
key_files:
  created:
    - scripts/render-og-image.mjs
    - references/fonts/JetBrainsMono-Bold.ttf
    - references/fonts/Inter-Regular.ttf
    - references/fonts/Inter-Bold.ttf
    - public/og-image.png
  modified:
    - package.json
    - package-lock.json
    - references/og-image.svg
decisions:
  - "Used static-weight TTFs (not variable) because resvg-js 2.6.2 uses resvg 0.34.0 which lacks variable-font wght-axis support (added in 0.47.0); using JetBrainsMono[wght].ttf would have silently rendered at fvar default weight 400 instead of 700"
  - "Pinned @resvg/resvg-js to exact 2.6.2 (no caret) to prevent semver drift to 2.7.x alpha which would bundle a different resvg version and potentially change render output"
  - "Inlined 6 post-render checks (5 D-05 byte-format + 1 LAND-02 grep) in render script rather than a separate verify script — coupled to the render, single command, no extra file"
metrics:
  duration_seconds: 198
  completed_date: "2026-05-14"
  tasks_completed: 4
  files_changed: 8
requirements_addressed: [OG-01]
---

# Phase 8 Plan 01: OG Image Render Toolchain Summary

Vendored 3 static-weight TTFs and rendered `references/og-image.svg` → `public/og-image.png` at exact 1200×630 (85 KB) via `@resvg/resvg-js@2.6.2`, with 6 inlined post-render verification checks.

## What Shipped

- **`@resvg/resvg-js@2.6.2`** installed as a devDependency (exact pin, no caret) — never installed on the prod droplet (`npm ci --omit=dev`). Platform binary that installed: `@resvg/resvg-js-darwin-arm64`.
- **`og:render` npm script** added to `package.json` (`node scripts/render-og-image.mjs`).
- **3 vendored static-weight TTFs** in `references/fonts/`:
  - `JetBrainsMono-Bold.ttf` — 274,096 bytes (NameID 1 = `JetBrains Mono`, weight 700)
  - `Inter-Regular.ttf` — 324,820 bytes (NameID 1 = `Inter`, weight 400)
  - `Inter-Bold.ttf` — 326,468 bytes (NameID 1 = `Inter`, weight 700)
- **`references/og-image.svg`** — 6 `font-family` attribute values swapped from CSS-generic stacks to vendored family names (4× monospace stack → `JetBrains Mono`, 2× sans-serif stack → `Inter`). Zero `ui-monospace` and zero `ui-sans-serif` occurrences remain. All other bytes unchanged (D-04).
- **`scripts/render-og-image.mjs`** — render script with top-of-file font source URL comment block, `loadSystemFonts: false` for deterministic cross-platform output, `fitTo: { mode: 'width', value: 1200 }`, and 6 inlined `[og:verify]` checks.
- **`public/og-image.png`** — committed artifact, 85,070 bytes (1200×630).

## Rendered PNG Properties

| Property | Value |
|----------|-------|
| Dimensions | 1200×630 px |
| File size | 85,070 bytes (83 KB) |
| PNG signature | `89 50 4E 47 0D 0A 1A 0A` ✓ |
| IHDR width (bytes 16–19) | 1200 ✓ |
| IHDR height (bytes 20–23) | 630 ✓ |
| Size budget (< 300 KB) | 83 KB ✓ |
| LAND-02 grep | 0 prohibited terms ✓ |

## Vendored Font Sizes (on-disk)

| File | Size |
|------|------|
| `references/fonts/JetBrainsMono-Bold.ttf` | 274,096 bytes |
| `references/fonts/Inter-Regular.ttf` | 324,820 bytes |
| `references/fonts/Inter-Bold.ttf` | 326,468 bytes |

## Gate Results

- `npm run og:render` exits 0; 6/6 `[og:verify]` checks PASS.
- `npm run build` exits 0; `cmp public/og-image.png dist/client/og-image.png` exits 0 (Astro static-asset pipeline verified).
- `npm run check:land-02` exits 0 (Phase 6 LAND-02 gate still green).
- `src/pages/index.astro` untouched — Phase 6 OG/Twitter meta tags preserved.
- `git check-ignore dist/client/og-image.png` exits 0 (dist/ correctly gitignored).

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | `75af078` | feat(08-01): install @resvg/resvg-js@2.6.2 + vendor 3 static TTFs |
| Task 2 | `a5db75c` | feat(08-01): swap 6 font-family attrs in og-image.svg to vendored names |
| Task 3 | `e0f92a5` | feat(08-01): add scripts/render-og-image.mjs with D-05 post-render checks |
| Task 4 | `a9edd9d` | feat(08-01): render and commit public/og-image.png (1200×630, 85KB) |

## Deviations from Plan

None — plan executed exactly as written. The RESEARCH.md override (static TTFs instead of variable fonts) was already incorporated into the plan's Task 1 action before execution.

## Key Decisions Made

1. **Static-weight TTFs over variable fonts** (RESEARCH.md override of CONTEXT D-03 "variable fonts" wording): `@resvg/resvg-js` 2.6.2 uses resvg 0.34.0 which does not support the variable-font `wght` axis. Using `JetBrainsMono[wght].ttf` would render the wordmark at weight 400 (fvar default). Using `InterVariable.ttf` would fail to match `font-family="Inter"` entirely (NameID 1 = `Inter Variable`, not `Inter`). Static TTFs are the only correct choice for this tool version.

2. **Exact pin `2.6.2` (no caret)**: Prevents accidental semver bump to 2.7.x alpha (variable-font support under development) which could change render output non-deterministically.

3. **`import.meta.url` path resolution**: All file paths resolved against `new URL('..', import.meta.url).pathname` rather than `process.cwd()`, making `npm run og:render` safe to invoke from any directory.

## Phase 6 Meta Tags: UNTOUCHED

`src/pages/index.astro` was not modified by this plan. The OG/Twitter meta tags shipped in Phase 6 (`og:image`, `og:image:width=1200`, `og:image:height=630`, `twitter:image`) continue to point at `https://oddlympics.app/og-image.png` — now resolved to a real 85 KB PNG asset.

## Reminder: Phase 11 AC6

Visual end-to-end verification (opengraph.xyz preview, Slack share card, iMessage preview) is owned by **Phase 11 AC6**, not Phase 8. Phase 8's gate is the 6 automated byte-level checks only (CONTEXT D-05). If re-rendering after a copy change, run `npm run og:render` and commit `public/og-image.png` in the same PR — there is no CI drift guard (CONTEXT D-02).

## Self-Check: PASSED

- `public/og-image.png` exists: FOUND
- `scripts/render-og-image.mjs` exists: FOUND
- `references/fonts/JetBrainsMono-Bold.ttf` exists: FOUND
- `references/fonts/Inter-Regular.ttf` exists: FOUND
- `references/fonts/Inter-Bold.ttf` exists: FOUND
- Commit `75af078` exists: FOUND
- Commit `a5db75c` exists: FOUND
- Commit `e0f92a5` exists: FOUND
- Commit `a9edd9d` exists: FOUND
