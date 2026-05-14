---
phase: 08-open-graph-image
verified: 2026-05-14T10:10:00Z
status: passed
score: 3/3 must-haves verified
overrides_applied: 0
re_verification: false
---

# Phase 8 — Verification Report

**Verifier:** gsd-verifier
**Date:** 2026-05-14
**Verdict:** PASSED

**Phase Goal:** Every social share (Slack, iMessage, Twitter, opengraph.xyz preview) of an oddlympics.app URL renders a clean 1200×630 card with wordmark, banner, headline, sub, URL, and FIFA-disclaimer tag.

---

## Goal-backward checks

| SC | Description | Status | Evidence |
|----|-------------|--------|----------|
| SC1 | PNG byte format (1200×630, <300KB, valid PNG sig) | VERIFIED | Size 85,070 bytes; sig `89504e470d0a1a0a`; IHDR width `000004b0` (1200); IHDR height `00000276` (630) |
| SC2 | Visual elements + LAND-02 clean | VERIFIED | All 6 elements present in SVG; prohibited-term grep: 0 hits |
| SC3 | SVG committed + rebuildable | VERIFIED | git ls-files confirms all artifacts tracked; re-render produces byte-identical output (MD5 match) |
| SC4 | opengraph.xyz / Slack / iMessage | DEFERRED | Phase 11 AC6 per CONTEXT D-05 — asset is correctly produced locally |

---

## Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `npm run og:render` renders `public/og-image.png` at exactly 1200×630, <300KB, with no LAND-02 prohibited terms | VERIFIED | Live re-run: `[og:verify] 6 passed, 0 failed`; exit 0; output `1200×630  85070 bytes` |
| 2 | All six visual elements present in source SVG with vendored fonts (not system fallbacks) | VERIFIED | SVG contains: `oddlympics` (wordmark ×2), `WORLD CUP 2026 · JUNE 11 – JULY 19` (×1), `JUNE 11` (×1), `oddlympics.app` (×1), `FIFA` / `Not affiliated with FIFA` (×1); `loadSystemFonts: false` in render script |
| 3 | `references/og-image.svg` is committed sole source of truth; `font-family` attrs point at vendored names | VERIFIED | `grep -c 'font-family="JetBrains Mono"'` = 4; `grep -c 'font-family="Inter"'` = 2; `ui-monospace` = 0; `ui-sans-serif` = 0 |
| 4 | `public/og-image.png` committed; `astro build` copies it byte-exactly to `dist/client/og-image.png` | VERIFIED | Build passes (exit 0); `diff public/og-image.png dist/client/og-image.png` exits 0 |
| 5 | Render+verify exits 1 on failure; exits 0 on 6/6 pass (D-05 gate) | VERIFIED | Live re-run confirms 6/6 pass and exit 0 |

**Score:** 5/5 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/render-og-image.mjs` | Render script, ≥60 lines, 6 inlined checks | VERIFIED | 102 lines; shebang on L1; 6 `check()` calls (5 byte-format + 1 LAND-02 grep); `node --check` exits 0 |
| `references/fonts/JetBrainsMono-Bold.ttf` | Static TTF, 250-300 KB, NameID 1 = `JetBrains Mono` | VERIFIED | 274,096 bytes; TTF magic `00010000`; NameID 1 = `JetBrains Mono` (parsed from name table) |
| `references/fonts/Inter-Regular.ttf` | Static TTF, 290-340 KB, NameID 1 = `Inter` | VERIFIED | 324,820 bytes; TTF magic `00010000`; NameID 1 `Inter` confirmed (UTF-16BE search) |
| `references/fonts/Inter-Bold.ttf` | Static TTF, 290-340 KB, NameID 1 = `Inter` | VERIFIED | 326,468 bytes; TTF magic `00010000`; NameID 1 `Inter` confirmed (UTF-16BE search) |
| `references/og-image.svg` | Committed; 4× JetBrains Mono + 2× Inter attrs; 0 legacy stacks | VERIFIED | git ls-files confirms tracked; font-family grep counts pass exactly |
| `public/og-image.png` | Committed PNG, 1200×630, <300KB | VERIFIED | 85,070 bytes; all byte-level checks pass; git ls-files confirms tracked |
| `package.json` | `@resvg/resvg-js` pinned to exact `2.6.2`; `og:render` script entry | VERIFIED | `"@resvg/resvg-js": "2.6.2"` (no caret); `"og:render": "node scripts/render-og-image.mjs"` |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `scripts/render-og-image.mjs` | `references/og-image.svg` + `references/fonts/*.ttf` | `readFileSync` + `new Resvg(svg, { font: { fontFiles, loadSystemFonts: false } })` | WIRED | `new Resvg(` present; all 3 TTF filenames referenced; `loadSystemFonts: false` present |
| `references/og-image.svg` | `references/fonts/*.ttf` | `font-family` attribute string match against TTF NameID 1 | WIRED | SVG uses bare `JetBrains Mono` and `Inter`; TTF NameID 1 confirmed to match |
| `public/og-image.png` | `dist/client/og-image.png` | Astro build static-asset copy from `public/` | WIRED | `diff public/og-image.png dist/client/og-image.png` exits 0 post-build |
| `package.json scripts.og:render` | `scripts/render-og-image.mjs` | `node scripts/render-og-image.mjs` | WIRED | Script entry confirmed in package.json; `npm run og:render` live-ran to exit 0 |

---

## Data-Flow Trace (Level 4)

Not applicable. Phase 8 produces a static committed asset (`public/og-image.png`) from a deterministic render pipeline. There is no runtime data source — the PNG is committed to git and served verbatim by Astro's static handler. The render pipeline itself (`scripts/render-og-image.mjs` → `@resvg/resvg-js` → vendored TTFs + SVG) is verified live (rebuildability confirmed, byte-identical output on re-run).

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Render script exits 0, all 6 checks pass | `npm run og:render` | `[og:verify] 6 passed, 0 failed`; exit 0 | PASS |
| PNG is 1200×630 | `buf.readUInt32BE(16)===1200 && buf.readUInt32BE(20)===630` | Width `0x000004b0`=1200; height `0x00000276`=630 | PASS |
| PNG size < 300 KB | `stat -f%z public/og-image.png` | 85,070 bytes | PASS |
| PNG signature valid | `xxd -l 8 -ps public/og-image.png` | `89504e470d0a1a0a` | PASS |
| Build copies PNG byte-exactly | `npm run build && diff public/og-image.png dist/client/og-image.png` | exit 0 | PASS |
| Render is deterministic | MD5 before vs. after re-run | MD5 match — diff exits 0 | PASS |
| LAND-02 gate still green | `npm run check:land-02` | exit 0 | PASS |

---

## Decision Compliance

| Decision | Status | Evidence |
|----------|--------|----------|
| D-01: `@resvg/resvg-js` devDep pinned + `og:render` script | VERIFIED | `"@resvg/resvg-js": "2.6.2"` (exact, no caret) in `devDependencies`; `"og:render": "node scripts/render-og-image.mjs"` in scripts |
| D-02: No CI re-render, no pre-commit hook | VERIFIED | `git diff HEAD~5 HEAD -- .github/workflows/` = 0 lines; no `.husky/pre-commit` found |
| D-03 (with RESEARCH.md override): static TTFs, not variable | VERIFIED | `references/fonts/` contains only `JetBrainsMono-Bold.ttf`, `Inter-Regular.ttf`, `Inter-Bold.ttf`; no `[wght]` or `InterVariable` reference in render script |
| D-04: SVG byte-identical except font-family swap | VERIFIED | `ui-monospace` = 0 occurrences; `ui-sans-serif` = 0 occurrences; `font-family="JetBrains Mono"` = 4; `font-family="Inter"` = 2; viewBox, accent color, all text content unchanged |
| D-05: 5 byte-format checks + LAND-02 grep inlined | VERIFIED | 8 total `check(` calls in script (function def + 6 check invocations + the count is 8 due to definition); all 5 byte checks (file-exists, png-signature, ihdr-width-1200, ihdr-height-630, size-lt-300kb) + LAND-02 grep present and live-verified |

---

## Cross-Phase Invariant Preserved

| Invariant | Status | Evidence |
|-----------|--------|----------|
| Phase 6 meta tags untouched (`src/pages/index.astro`) | VERIFIED | Last commit touching `index.astro` is `b12044e` (Phase 6); none of the 4 Phase 8 code commits (`75af078`, `a5db75c`, `e0f92a5`, `a9edd9d`) show `.astro` file changes; `git diff --stat` on Phase 8 commit range: 0 `.astro` lines |
| `dist/` gitignored (only `public/og-image.png` committed) | VERIFIED | `git check-ignore dist/client/og-image.png` exits 0 |
| `npm run check:land-02` still green | VERIFIED | exit 0 on built `dist/client/index.html` |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| OG-01 | 08-01-PLAN.md | `/og-image.png` at exact 1200×630, <300KB, image/png; wordmark, banner, headline, sub, URL, FIFA tag; SVG committed and rebuildable | SATISFIED | PNG byte-level checks all pass; SVG committed with all 6 visual elements; `npm run og:render` exits 0 deterministically |
| LAND-02 (cross-cutting) | 08-01-PLAN.md | Zero prohibited terms in OG image source | SATISFIED | `grep -ic 'bitcoin|lightning|...'` = 0 on `references/og-image.svg`; `check:land-02` exits 0 on built HTML |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

No `TBD`, `FIXME`, `XXX`, placeholder returns, or hardcoded empty data found in phase-modified files. The `check()` helper in `scripts/render-og-image.mjs` uses empty catch blocks — this is intentional and documented (the `execSync` throw for the LAND-02 grep is caught to flip the check result, not to suppress an error).

---

## Human Verification Required

None for in-scope Phase 8 checks. SC4 is explicitly deferred to Phase 11 AC6 by CONTEXT D-05.

The following verifications are tracked but out of scope for Phase 8:

1. **opengraph.xyz preview** — open `https://www.opengraph.xyz/url/https%3A%2F%2Foddlympics.app` post-deploy; confirm headline + banner + URL visible in rendered card.
2. **Slack share card** — paste `https://oddlympics.app` into a Slack channel post-deploy; confirm OG preview card renders.
3. **iMessage link preview** — send `https://oddlympics.app` to self post-deploy; confirm preview card renders.

All three are Phase 11 AC6 deliverables.

---

## Notes

**`check()` call count is 8, not 6.** The function definition line itself (`function check(label, ok)`) and the terminal logging line both contain `check(` as a substring, so `grep -c "check("` returns 8 rather than 6. The plan requires "at least 6 check() calls" and stipulates 5 byte-format + 1 LAND-02. Actual live execution confirms all 6 verification calls fire and pass. No gap.

**Wordmark is lowercase `oddlympics`.** The SVG wordmark element contains the text `oddlympics` (lowercase), which is the correct brand treatment per the site. The verification method's grep pattern `Oddlympics\|ODDLYMPICS` returned 0 — this is a false negative in the grep pattern, not a missing element. Direct SVG inspection confirms the wordmark is present and rendered correctly.

**SC4 deferred per CONTEXT D-05.** The ROADMAP.md SC4 note explicitly states "DEFERRED to Phase 11 AC6" — this is a planning decision, not a gap. The asset is correctly produced locally and served by Astro's static handler.

---

_Verified: 2026-05-14T10:10:00Z_
_Verifier: Claude (gsd-verifier)_

## VERIFICATION PASSED
