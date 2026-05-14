# Phase 8: Open Graph image - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 08-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-14
**Phase:** 8-open-graph-image
**Areas discussed:** Render toolchain (R-3), Drift guard, Font fidelity, SVG copy sweep, Verification gate

---

## Render toolchain (R-3)

| Option | Description | Selected |
|--------|-------------|----------|
| `@resvg/resvg-js` + commit PNG | Pure-Node Rust binding, deterministic, no system deps. Write `scripts/render-og-image.mjs` + `npm run og:render`. Commit `public/og-image.png`. Mirrors Phase 6 puppeteer-core/chrome-headless-shell pattern. | ✓ |
| `sharp` + commit PNG | Same pattern with `sharp` (libvips). Heavier install (~30MB native bin); SVG-to-raster less complete than resvg. | |
| Install system `rsvg-convert` in CI | Add system pkg to deploy.yml + dev; PNG built fresh in CI; `.gitignore` the PNG. Closes "rebuildable from source in CI" loop but adds system-pkg surface. | |
| One-shot manual render | Render once locally outside repo toolchain; commit PNG; document re-render command. Fastest to ship; weakest reproducibility. | |

**User's choice:** `@resvg/resvg-js` + commit PNG (recommended).
**Notes:** Single-question decision; aligned with the project's "pin a Node-only tool, commit the artifact" pattern already established for puppeteer-core / chrome-headless-shell in Phase 6.

---

## Drift guard

| Option | Description | Selected |
|--------|-------------|----------|
| No drift guard | Accept the small risk; PR review + Phase 11 AC6 catch a wildly broken PNG. Keeps `deploy.yml` untouched. | ✓ |
| CI re-renders + `git diff --exit-code` check | Fail deploy if the committed PNG drifts from what `npm run og:render` produces. Strong reproducibility; one more CI step + slower deploy. | |
| Husky / lefthook pre-commit hook | Local pre-commit hook re-renders when `og-image.svg` is in the staged set. Catches drift before commit; adds a devDep not currently in the project. | |

**User's choice:** No drift guard (recommended).
**Notes:** SVG edits are expected to be rare; cost/benefit of CI surface vs. detection rate favors deferral. Captured in CONTEXT D-02.

---

## Font fidelity

| Option | Description | Selected |
|--------|-------------|----------|
| Vendor JetBrains Mono + Inter into repo | Commit two variable `.ttf` files in `references/fonts/`; pass to resvg via `fontFiles`; update SVG `font-family` attrs to explicit names. ~500KB; renders identically on macOS dev and Ubuntu CI. | ✓ |
| Convert SVG text to paths | One-time conversion (Inkscape CLI or Node) so text becomes `<path>` elements. Zero render-time font dep; SVG source becomes path-soup; doubles source-of-truth surface. | |
| Accept system-font fallback | `loadSystemFonts: true` on resvg, no vendored fonts. Works because we commit the macOS-rendered PNG, but the render step is non-portable across contributors. | |

**User's choice:** Vendor JetBrains Mono + Inter (recommended).
**Notes:** The pivotal Phase 8 risk: CSS-generic font families (`ui-monospace`, `ui-sans-serif`) are not in any renderer's fontdb. Vendoring eliminates host-fontdb dependency entirely. Variable fonts cover both weights needed (700 + 400) from one file each. Captured in CONTEXT D-03.

---

## SVG copy sweep before render

| Option | Description | Selected |
|--------|-------------|----------|
| Ship SVG as-is | Sub-line is card-tuned for the 1200×630 frame; all other copy already matches landing verbatim. SVG ships byte-for-byte (except the mechanical font-family swap from D-03). | ✓ |
| Sweep before render | Pre-render task: re-read SVG with copy doc + landing in hand; normalize sub-line + minor terms. Slight quality lift; ~10 min plan task. | |
| Sweep and align sub-line to landing meta description | Force sub-line to use meta-description text verbatim; requires smaller type or 2-line break. Highest copy alignment, highest visual-cramping risk. | |

**User's choice:** Ship SVG as-is (recommended).
**Notes:** Card sub-line ("Pick your team. Free for the whole tournament. No ads.") communicates the value prop in 8 words and fits one line at 22px. The long landing meta-description would look cramped. Captured in CONTEXT D-04.

---

## Verification gate

| Option | Description | Selected |
|--------|-------------|----------|
| Automated checks only | File exists, is `image/png`, exactly 1200×630, <300KB, LAND-02 grep on SVG source. Phase 11 AC6 owns prod-side opengraph.xyz / Slack / iMessage. | ✓ |
| Automated + manual operator checklist for SC4 | Same automated checks + DEPLOY.md operator action (paste URL into opengraph.xyz, share to Slack + iMessage). Belt-and-suspenders. | |
| Automated + visual-regression baseline | Commit rendered PNG as a baseline; verify byte-for-byte that re-render matches. Reproducibility audit; valuable only with frequent SVG edits. | |

**User's choice:** Automated checks only (recommended).
**Notes:** Single-gate strategy mirrors Phase 6 D-07. Phase 8 produces the asset; Phase 11 verifies it on prod. Captured in CONTEXT D-05.

---

## Claude's Discretion

- Where the verify script lives (standalone `scripts/verify-og-image.mjs`, inlined in `render-og-image.mjs`, or appended to an existing smoke script).
- Exact `Resvg` constructor options beyond viewBox-honored fitTo width=1200.
- Which builds of JetBrains Mono Variable + Inter Variable to vendor (Google Fonts mirror, official GitHub releases, etc.).
- Whether to font-subset before vendoring (probably unnecessary at the byte budget).
- Whether `npm run og:render` logs dimensions + file size for ergonomics (probably yes).
- Plan split (1 plan covering toolchain + fonts + SVG family swap + render + verify, vs. 2 plans). 1 plan is fine.

## Deferred Ideas

- CI-side re-render + git-diff drift guard.
- Husky / lefthook pre-commit hook for SVG-changed-but-PNG-not-re-rendered detection.
- Visual-regression baseline byte-compare.
- Phase-8-time opengraph.xyz / Slack / iMessage manual preview (deferred to Phase 11 AC6).
- Sub-line copy alignment to landing meta description.
- Per-team / per-event OG image variants.
- Font subsetting.
- Convert SVG text to paths (font-determinism alternative).
