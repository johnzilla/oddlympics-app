# Phase 8: Open Graph image - Research

**Researched:** 2026-05-14
**Domain:** SVG-to-PNG rendering with Node.js, font vendoring, static asset deployment
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** `@resvg/resvg-js` as devDep. `scripts/render-og-image.mjs`. `npm run og:render`. Commit `public/og-image.png`. Render at `fitTo: { mode: 'width', value: 1200 }`.
- **D-02:** No drift guard, no CI re-render step, no pre-commit hook.
- **D-03:** Vendor JetBrains Mono + Inter as `.ttf` in `references/fonts/`. Pass via `font.fontFiles`, `loadSystemFonts: false`. Swap SVG `font-family` from CSS-generic stack to explicit names: `'JetBrains Mono'` and `Inter`.
- **D-04:** `references/og-image.svg` ships byte-for-byte except the `font-family` attribute swap.
- **D-05:** Automated checks: file exists, PNG signature, IHDR width===1200 height===630, size<300KB, LAND-02 grep on SVG source. No Phase 8 production gate; Phase 11 AC6 owns that.

### Claude's Discretion
- Where the verify script lives (standalone `scripts/verify-og-image.mjs` vs. inlined post-render, vs. appended to existing smoke).
- Exact `Resvg` constructor options beyond `fitTo` and `font`.
- Which font builds to vendor (see research findings below — this choice matters for correctness).
- Whether to font-subset.
- Whether `npm run og:render` logs dimensions + file size.
- Plan split (1 plan is fine).

### Deferred Ideas (OUT OF SCOPE)
- CI re-render + git-diff drift guard.
- Husky/lefthook pre-commit hook.
- Visual-regression baseline.
- opengraph.xyz / Slack / iMessage preview at Phase 8 gate.
- Sub-line copy alignment to landing meta description.
- Per-team OG image variants.
- Font subsetting.
- Convert SVG text to paths.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OG-01 | `/og-image.png` at exact 1200×630, content-type `image/png`, size <300KB, shows all six required elements, source SVG in repo for rebuildability | Confirmed: resvg-js renders from SVG at fitTo width=1200; Astro `public/` → served at `/og-image.png`; PNG size will be well under 300KB at this resolution; SVG already committed |
</phase_requirements>

---

## Summary

Phase 8 is a one-plan phase: install `@resvg/resvg-js`, vendor static-weight TTF files, edit two `font-family` attributes in the SVG, run the render script once, commit the PNG, verify five assertions, done. The surface area is small; the only non-obvious findings are in font handling.

The CONTEXT.md description of "variable fonts" must be corrected before planning: `@resvg/resvg-js` 2.6.2 uses resvg 0.34.0, which predates variable-font `wght`-axis support (added in resvg 0.47.0, February 2026). Additionally, the canonical Inter variable font file (`InterVariable.ttf`) has family name `Inter Variable` (not `Inter`), so it would not match `font-family="Inter"` in the SVG at all. The correct approach — and the one that actually works — is three static-weight TTF files: `JetBrainsMono-Bold.ttf` (267 KB), `Inter-Regular.ttf` (317 KB), `Inter-Bold.ttf` (318 KB). All three have family name matching the D-03 swap targets and cover every weight used in the SVG.

**Primary recommendation:** Use static-weight TTFs (not variable). All other locked decisions in CONTEXT.md are correct as written.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| SVG → PNG rendering | Developer toolchain (devDep) | — | Runs once locally; `npm run og:render`; output committed as artifact |
| Font loading (deterministic) | render script | — | Passed via `fontFiles`; never reaches production |
| Static asset serving (`/og-image.png`) | CDN / Static (Astro `public/`) | — | Astro copies `public/` to `dist/client/`; served verbatim by `@astrojs/node` adapter; no SSR layer involved |
| OG/Twitter meta tag wiring | Already shipped (Phase 6) | — | `src/pages/index.astro` already hardcodes `https://oddlympics.app/og-image.png`; Phase 8 must NOT touch it |
| Verification gate | Local script (post-render) | — | Five byte-level assertions in Node; no network, no running server needed |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@resvg/resvg-js` | `2.6.2` | SVG → PNG renderer | Pure-Node prebuilt Rust binding (napi-rs); no system deps; deterministic; mirrors Phase 6 puppeteer-core pattern [VERIFIED: npm registry] |

**`@resvg/resvg-js` internals:**
- Publishes platform-specific optional packages; npm resolves the right binary at install time (`@resvg/resvg-js-darwin-arm64`, `@resvg/resvg-js-linux-x64-gnu`, etc.) [VERIFIED: npm registry]
- No postinstall or rebuild step — unlike `better-sqlite3`, no `npm rebuild` needed after rsync [VERIFIED: npm package scripts field]
- NOT installed on prod droplet: deploy workflow runs `npm ci --omit=dev` [VERIFIED: `.github/workflows/deploy.yml:66`]
- Engines: `>= Node 10`; compatible with Node 22 (CI/prod) and Node 26 (dev machine) [VERIFIED: npm registry]
- Unpack sizes: linux-x64-gnu ≈ 4.2 MB, darwin-arm64 ≈ 3.4 MB, core ≈ 1.5 MB [VERIFIED: npm registry]; only one platform package installs per machine

### Supporting Font Files (vendored, not npm packages)

| File | Size | Family name | Weights covered | Source |
|------|------|-------------|-----------------|--------|
| `JetBrainsMono-Bold.ttf` | 267 KB | `JetBrains Mono` (NameID 1) | 700 | JetBrains/JetBrainsMono GitHub master |
| `Inter-Regular.ttf` | 317 KB | `Inter` (NameID 1) | 400 | Google Fonts static CDN |
| `Inter-Bold.ttf` | 318 KB | `Inter` (NameID 1) | 700 | Google Fonts static CDN |

[VERIFIED: font name tables parsed directly from downloaded TTF files — see Font Handling section]

**Installation:**
```bash
npm install --save-dev @resvg/resvg-js
```

Font vendoring via download (in script header comments):
```
JetBrainsMono-Bold.ttf:
  https://github.com/JetBrains/JetBrainsMono/raw/master/fonts/ttf/JetBrainsMono-Bold.ttf

Inter-Regular.ttf:
  https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf

Inter-Bold.ttf:
  https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZg.ttf
```

---

## Architecture Patterns

### System Architecture Diagram

```
references/og-image.svg (font-family attrs swapped)
           │
           ▼
scripts/render-og-image.mjs
 ├── reads SVG with node:fs
 ├── new Resvg(svgBuf, { font: { fontFiles: [...] }, fitTo: ... })
 ├── .render().asPng() → Buffer
 └── writes public/og-image.png
           │
           ▼
 post-render verify assertions (5 checks)
           │
           ▼
 git add public/og-image.png (committed artifact)
           │  Astro build
           ▼
dist/client/og-image.png
           │  rsync in deploy.yml
           ▼
droplet:/opt/oddlympics/dist/client/og-image.png
           │  @astrojs/node standalone adapter
           ▼
GET /og-image.png → 200 image/png (served verbatim; no SSR)
```

### Recommended Project Structure

```
references/
├── og-image.svg          # source (font-family attrs swapped in Phase 8)
└── fonts/                # NEW: vendored font files (render-time only, not served)
    ├── JetBrainsMono-Bold.ttf
    ├── Inter-Regular.ttf
    └── Inter-Bold.ttf
scripts/
└── render-og-image.mjs   # NEW: render + post-render verify
public/
└── og-image.png          # NEW: committed artifact
```

### Pattern 1: resvg-js render call

```javascript
// Source: @resvg/resvg-js index.d.ts + official README example
import { readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const svg = readFileSync('references/og-image.svg');
const resvg = new Resvg(svg, {
  font: {
    fontFiles: [
      'references/fonts/JetBrainsMono-Bold.ttf',
      'references/fonts/Inter-Regular.ttf',
      'references/fonts/Inter-Bold.ttf',
    ],
    loadSystemFonts: false,
  },
  fitTo: { mode: 'width', value: 1200 },
});
const rendered = resvg.render();
const png = rendered.asPng();       // returns Buffer
const { width, height } = rendered; // .width and .height are numbers
writeFileSync('public/og-image.png', png);
console.log(`Rendered: ${width}×${height}, ${png.length} bytes`);
```

`render()` returns `RenderedImage` with `.asPng(): Buffer`, `.width: number`, `.height: number`. [VERIFIED: index.d.ts fetched from official repo]

### Pattern 2: PNG IHDR byte-format verification

PNG file layout is fixed by the specification:

```
Offset  Length  Content
0-7     8       PNG signature: 89 50 4E 47 0D 0A 1A 0A
8-11    4       IHDR chunk data length (always 0x0000000D = 13)
12-15   4       Chunk type: "IHDR" (0x49484452)
16-19   4       Image width (big-endian u32)   ← D-05 check
20-23   4       Image height (big-endian u32)  ← D-05 check
24      1       Bit depth
25      1       Color type
...
```

```javascript
// D-05 verify: IHDR width/height
// Source: PNG specification (ISO/IEC 15948), verified against live PNG bytes
import { readFileSync, statSync, existsSync } from 'node:fs';

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
const buf = readFileSync('public/og-image.png');

// Check 1: file exists (readFileSync would throw if not)
// Check 2: PNG signature
const sigMatch = PNG_SIG.every((b, i) => buf[i] === b);
// Check 3: IHDR dimensions
const width  = buf.readUInt32BE(16);  // bytes 16-19
const height = buf.readUInt32BE(20);  // bytes 20-23
// Check 4: file size
const { size } = statSync('public/og-image.png');
// Check 5: LAND-02 grep (run as shell command against SVG source)
```

Width `1200` = `0x000004B0`. Height `630` = `0x00000276`. [VERIFIED: Python struct.pack computation]

### Pattern 3: SVG font-family attr swap (D-03)

Two mechanical substitutions in `references/og-image.svg`:

```
BEFORE: font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
AFTER:  font-family="JetBrains Mono"

BEFORE: font-family="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
AFTER:  font-family="Inter"
```

The sub-line element (`translate(72, 488)`) also has the shorter sans-serif stack `"ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"` — same swap target (`Inter`). Three elements total to update.

### Anti-Patterns to Avoid

- **Using `InterVariable.ttf` from rsms.me:** Family name is `Inter Variable` (not `Inter`). The SVG `font-family="Inter"` would not match, causing silent fallback to default font. [VERIFIED: name table inspection of `https://rsms.me/inter/font-files/InterVariable.ttf`]
- **Using `JetBrainsMono[wght].ttf` (variable) expecting bold:** resvg 0.34.0 does not support the variable font `wght` axis. The wordmark and banner would render at the variable font's default weight (400 — Regular), not 700. [VERIFIED: resvg CHANGELOG shows wght axis support in 0.47.0 (Feb 2026), after resvg-js 2.6.2's snapshot]
- **Omitting `loadSystemFonts: false`:** Without this, resvg attempts to load system fonts (Menlo, Helvetica on macOS; DejaVu on Ubuntu) and picks the best match for CSS generic stacks. Renders differently on dev vs. CI — non-deterministic. [CITED: resvg-js README example pattern]
- **Using `font-family="'JetBrains Mono'"` (quoted):** resvg's SVG attribute parser is strict about identifiers; numbers and certain special characters in unquoted CSS font names cause parse failures. The family name `JetBrains Mono` has no problematic chars and works unquoted (SVG attribute syntax: `font-family="JetBrains Mono"`). [VERIFIED: resvg issues #804 and confirmed no parsing concern for these two family names]
- **Expecting weight=600 to select SemiBold:** Only two font files for JetBrains Mono are needed. The URL element uses `font-weight="600"`; with Bold (700) loaded but SemiBold not, fontdb's CSS font-matching algorithm selects the closest weight (700). The visual difference at 20px is negligible, and vendoring SemiBold would add an unnecessary third JBMono file.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SVG to PNG | Custom rendering pipeline | `@resvg/resvg-js` | Correct text rendering, gradient support, proper viewBox handling; edge cases in SVG path/text layout are handled by the Rust resvg engine |
| PNG signature check | Custom binary parser | `buf.readUInt32BE(16)` | Node's `Buffer.readUInt32BE` is a one-liner; PNG spec is stable |
| Font-family glyph fallback | Custom glyph substitution | Let fontdb silently substitute | When `loadSystemFonts: false`, missing glyphs render as the default font's replacement character — acceptable since all needed chars are verified present in both fonts |

---

## Font Handling (Critical Section)

### Why variable fonts do NOT work with resvg-js 2.6.2

`@resvg/resvg-js` 2.6.2 (npm stable, published 2024-03-26) uses a fork of resvg at commit `3495d870` (zimond/resvg, Sept 2023). This is functionally equivalent to resvg 0.34.0. [VERIFIED: `Cargo.toml` in yisibl/resvg-js repo]

Variable font `wght`-axis support (allowing `font-weight="700"` to select 700 on a variable font) was added in upstream resvg 0.47.0 (released 2026-02-05). [VERIFIED: resvg CHANGELOG from linebender/resvg]

A variable font loaded via `fontFiles` can be matched by family name, but `font-weight` is ignored — the font always renders at its `fvar` default weight. For `JetBrainsMono[wght].ttf`, the default `wght` is **400 (Regular)**. Loading only the variable file would render the wordmark, banner, and headlines at weight 400 instead of 700 — visually wrong.

### Why `InterVariable.ttf` fails name matching

The official Inter variable font (`InterVariable.ttf` from rsms.me v4.1) has OpenType name table:

| NameID | Value |
|--------|-------|
| 1 (Family) | `Inter Variable` |
| 4 (Full Name) | `Inter Variable` |
| 6 (PostScript) | `InterVariable` |

No NameID 16 (Preferred Family). fontdb matches font-family against NameID 16 if present, else NameID 1. The SVG after the D-03 swap uses `font-family="Inter"`, which does NOT match `Inter Variable`. [VERIFIED: name table parsed from `https://rsms.me/inter/font-files/InterVariable.ttf`]

### Verified static TTF name tables

**`JetBrainsMono-Bold.ttf`** (267 KB, OFL 1.1):
- NameID 1: `JetBrains Mono`
- NameID 2: `Bold`
- No NameID 16
- Matches `font-family="JetBrains Mono"` + `font-weight="700"` via fontdb weight selection
[VERIFIED: name table from `github.com/JetBrains/JetBrainsMono/raw/master/fonts/ttf/JetBrainsMono-Bold.ttf`]

**`Inter-Regular.ttf`** (317 KB, SIL OFL) and **`Inter-Bold.ttf`** (318 KB, SIL OFL):
- Both have NameID 1: `Inter` (the Google Fonts static distribution uses the simpler name table)
- Regular: weight 400; Bold: weight 700
- Both match `font-family="Inter"` via fontdb, weight selected by `font-weight` attribute
[VERIFIED: name tables from Google Fonts gstatic CDN]

### Character coverage (non-ASCII glyphs in SVG)

Actual non-ASCII characters in `references/og-image.svg` text content:

| Character | Unicode | Location | In JBMono Bold | In Inter Bold |
|-----------|---------|----------|----------------|---------------|
| `·` | U+00B7 Middle Dot | Banner pill, FIFA tag | PRESENT | N/A (Inter isn't used for these) |
| `–` | U+2013 En Dash | Banner pill | PRESENT | N/A |
| `'` | U+0027 ASCII Apostrophe | "team's" | PRESENT | PRESENT |

[VERIFIED: cmap table parsing from downloaded font files]

No curly apostrophe (U+2019) in the SVG — STATE.md confirms "ASCII apostrophe throughout body copy."

### Font download sources (include as comments in render script)

```
# JetBrains Mono Bold v2.304 (tag: 2.305 in font, SIL OFL 1.1)
# https://github.com/JetBrains/JetBrainsMono/raw/master/fonts/ttf/JetBrainsMono-Bold.ttf
#
# Inter Regular v20 (static, SIL OFL 1.1)
# https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf
#
# Inter Bold v20 (static, SIL OFL 1.1)
# https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZg.ttf
```

Both fonts are SIL Open Font License 1.1. No attribution requirement in the OG PNG itself. [CITED: name table license entries in font files]

---

## `public/` Static Serving

Astro with `output: 'server'` and `@astrojs/node` standalone adapter serves files from `public/` verbatim:

1. `astro build` copies `public/og-image.png` → `dist/client/og-image.png` [VERIFIED: existing `public/favicon.svg` → `dist/client/favicon.svg`]
2. Deploy workflow rsyncs `dist/` to droplet [VERIFIED: `.github/workflows/deploy.yml:44-49`]
3. `@astrojs/node` standalone adapter's static file handler serves `dist/client/og-image.png` at path `/og-image.png` with `Content-Type: image/png` (extension-based MIME detection)

No `prerender` directive, no API route, no SSR involvement. This is identical to how `favicon.svg` is served. Phase 8 has no deployment workflow changes.

---

## Common Pitfalls

### Pitfall 1: Variable font rendering at wrong weight
**What goes wrong:** Developer follows CONTEXT D-03's "variable fonts" wording, downloads `JetBrainsMono[wght].ttf` and `InterVariable.ttf`. The render runs without error but produces: (a) Inter text not rendered (wrong family name `Inter Variable` ≠ `Inter`); (b) JetBrains Mono at weight 400 throughout (bold wordmark looks like regular weight).
**Why it happens:** resvg 0.34.0 + fontdb 0.16.0 do not apply the `wght` axis based on SVG `font-weight`. Variable font wght support was added in resvg 0.47.0 (Feb 2026).
**How to avoid:** Use static-weight TTF files as specified in the Standard Stack table above.
**Warning signs:** Generated PNG has thin-weight text everywhere; or Inter text falls back to a generic sans-serif.

### Pitfall 2: `Inter Variable` family name mismatch
**What goes wrong:** Using `InterVariable.ttf` causes all Inter text (three headline lines + sub-line) to render in a fallback font.
**Why it happens:** fontdb matches `font-family="Inter"` against NameID 1 = `Inter Variable` — no match, silent fallback.
**How to avoid:** Use the Google Fonts static `Inter-Regular.ttf` + `Inter-Bold.ttf` (NameID 1 = `Inter` for both).
**Warning signs:** Headlines render in a different typeface; glyph shapes look wrong.

### Pitfall 3: SVG relative-path resolution
**What goes wrong:** Passing relative paths to `fontFiles` that resolve against the process cwd, not the script location. Fails if `npm run og:render` is run from a non-root directory.
**Why it happens:** `Resvg` resolves `fontFiles` paths relative to `process.cwd()`.
**How to avoid:** Use `new URL('./...', import.meta.url).pathname` or `path.resolve(import.meta.dirname, '...')` to build absolute paths.
**Warning signs:** `Error: cannot load font file` in stderr.

### Pitfall 4: PNG size overshoot
**What goes wrong:** Rendered PNG exceeds 300 KB limit (D-05 check 4).
**Why it happens:** resvg renders at full 1200×630; PNG compression defaults apply. Unlikely at this resolution with no photo content, but possible with complex gradients.
**How to avoid:** With this SVG (solid fills, two linear gradients, six flag rectangles), output should be well under 100 KB. Verify by logging `png.length` in the render script.
**Warning signs:** D-05 check 4 fails; consider `optipng`/`pngquant` post-processing (not expected to be needed).

### Pitfall 5: Drift between SVG and committed PNG
**What goes wrong:** A contributor edits `references/og-image.svg` (e.g., copy update) without re-running `npm run og:render`. Phase 11 AC6 sees the old PNG.
**Why it happens:** D-02 explicitly rejects a drift guard. The only safeguard is PR review discipline.
**How to avoid:** Document clearly in the render script header: "If you edit `references/og-image.svg`, you MUST run `npm run og:render` and commit `public/og-image.png` in the same PR."
**Warning signs:** Phase 11 AC6 opengraph.xyz preview shows old text; prod `/og-image.png` doesn't match the live copy.

---

## Code Examples

### Complete `render-og-image.mjs` skeleton

```javascript
#!/usr/bin/env node
// Phase 8 — render-og-image.mjs
// Renders references/og-image.svg → public/og-image.png (1200×630, image/png).
//
// Font sources (re-vendor if fonts need updating):
//   JetBrains Mono Bold v2.304 (SIL OFL 1.1):
//     https://github.com/JetBrains/JetBrainsMono/raw/master/fonts/ttf/JetBrainsMono-Bold.ttf
//   Inter Regular v20 (SIL OFL 1.1):
//     https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf
//   Inter Bold v20 (SIL OFL 1.1):
//     https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZg.ttf
//
// IMPORTANT: If you edit references/og-image.svg, re-run this script and commit
// public/og-image.png in the same PR. There is no CI check that enforces this.

import { readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { Resvg } from '@resvg/resvg-js';

const root = new URL('..', import.meta.url).pathname;
const svgPath    = resolve(root, 'references/og-image.svg');
const outPath    = resolve(root, 'public/og-image.png');
const fontsDir   = resolve(root, 'references/fonts');

const svg = readFileSync(svgPath);

const resvg = new Resvg(svg, {
  font: {
    fontFiles: [
      resolve(fontsDir, 'JetBrainsMono-Bold.ttf'),
      resolve(fontsDir, 'Inter-Regular.ttf'),
      resolve(fontsDir, 'Inter-Bold.ttf'),
    ],
    loadSystemFonts: false,
  },
  fitTo: { mode: 'width', value: 1200 },
});

const rendered = resvg.render();
const png = rendered.asPng();          // Buffer
writeFileSync(outPath, png);
console.log(`[og:render] ${rendered.width}×${rendered.height}  ${png.length} bytes → ${outPath}`);

// ── Post-render verification (D-05) ──────────────────────────────────────
let pass = 0; let fail = 0;

function check(label, ok) {
  if (ok) { console.log(`[og:verify] PASS  ${label}`); pass++; }
  else    { console.error(`[og:verify] FAIL  ${label}`); fail++; }
}

// 1. File exists
check('file-exists', existsSync(outPath));

// 2. PNG signature
const buf = readFileSync(outPath);
const PNG_SIG = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
check('png-signature', PNG_SIG.every((b, i) => buf[i] === b));

// 3. IHDR dimensions
check('ihdr-width-1200',  buf.readUInt32BE(16) === 1200);
check('ihdr-height-630',  buf.readUInt32BE(20) === 630);

// 4. Size < 300 KB
check('size-lt-300kb', statSync(outPath).size < 300_000);

// 5. LAND-02 grep on SVG source (prohibited terms)
try {
  execSync(
    "! grep -iE 'bitcoin|lightning|crypto|world domination|personal olympics' " +
    JSON.stringify(svgPath),
    { stdio: 'inherit' }
  );
  check('land-02-clean', true);
} catch {
  check('land-02-clean', false);
}

console.log(`[og:verify] ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| System `rsvg-convert` for SVG→PNG | `@resvg/resvg-js` pure-Node binding | Phase 8 (this phase) | No system dep, cross-platform, committed artifact |
| CSS-generic font stacks in SVG | Explicit vendored family names | Phase 8 (this phase) | Deterministic render across macOS/Ubuntu |

**Variable font note:** resvg will add variable font `wght`-axis support in 2.7.0+ (alpha as of May 2026). If `@resvg/resvg-js` releases a stable 2.7.x that bundles resvg ≥ 0.47.0, the static-weight-files approach can be replaced with a single variable TTF per family. Until then, static files are the only correct approach.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Google Fonts `fonts.gstatic.com` static Inter TTF URLs will remain stable | Standard Stack | Need to find replacement URLs; low risk (Google Fonts URLs are CDN-stable for years) |
| A2 | `@astrojs/node` standalone adapter auto-detects `image/png` MIME from `.png` extension | `public/` Serving | Phase 11 AC6 would fail with wrong content-type; mitigation: AC6 checks this |

---

## Open Questions

1. **Should the render script be idempotent-safe for CI use?**
   - What we know: D-02 rejects CI re-render. The script only runs manually.
   - What's unclear: Whether to add a `--force` flag for future use.
   - Recommendation: Keep it simple; no flag needed for a single-run script. Overwrite is the default.

2. **Where should verify logic live?**
   - What we know: CONTEXT leaves this to Claude's discretion.
   - Recommendation: Inline at the bottom of `render-og-image.mjs`. Avoids a second script, keeps the verify coupled to the render. Pattern mirrors how Phase 5 smoke tests are co-located with their feature.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `scripts/render-og-image.mjs` | ✓ | 26.0.0 (dev); 22 (CI/prod) | — |
| npm | install `@resvg/resvg-js` | ✓ | 11.12.1 | — |
| `@resvg/resvg-js` | render script | ✗ (not yet installed) | — | Install as devDep |
| Font files (3× TTF) | render script | ✗ (not yet vendored) | — | Download from URLs in Standard Stack |
| `public/` directory | Astro static serving | ✓ (`public/favicon.svg` exists) | — | — |

**Missing dependencies with no fallback:**
- None (all missing items are install/download steps in the plan tasks).

---

## Validation Architecture

Nyquist validation is enabled (`workflow.nyquist_validation: true` in `.planning/config.json`).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in (`node:fs`, `node:child_process`) — no test runner |
| Config file | None — verification inlined in `scripts/render-og-image.mjs` |
| Quick run command | `node scripts/render-og-image.mjs` |
| Full suite command | `node scripts/render-og-image.mjs` (same; all 5 checks run post-render) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OG-01 | `public/og-image.png` exists | unit (byte check) | `node scripts/render-og-image.mjs` → check 1 | ❌ Wave 0 |
| OG-01 | Content is valid PNG | unit (byte check) | `node scripts/render-og-image.mjs` → check 2 | ❌ Wave 0 |
| OG-01 | Dimensions exactly 1200×630 | unit (byte check) | `node scripts/render-og-image.mjs` → check 3+4 | ❌ Wave 0 |
| OG-01 | File size < 300 KB | unit (byte check) | `node scripts/render-og-image.mjs` → check 5 | ❌ Wave 0 |
| LAND-02 | SVG source has zero prohibited terms | unit (grep) | `node scripts/render-og-image.mjs` → check 6 | ❌ Wave 0 |
| OG-01 | `/og-image.png` returns 200 + `image/png` (prod) | smoke (manual) | Phase 11 AC6 only | ❌ deferred |

### Sampling Rate
- **Per task commit:** `node scripts/render-og-image.mjs` (runs render + all 5 checks)
- **Per wave merge:** Same
- **Phase gate:** All 5 checks pass, PNG committed, `npm run build` succeeds

### Wave 0 Gaps
- [ ] `scripts/render-og-image.mjs` — the entire render + verify script
- [ ] `references/fonts/JetBrainsMono-Bold.ttf` — download from vendoring URL
- [ ] `references/fonts/Inter-Regular.ttf` — download from vendoring URL
- [ ] `references/fonts/Inter-Bold.ttf` — download from vendoring URL
- [ ] `@resvg/resvg-js` devDep — `npm install --save-dev @resvg/resvg-js`

---

## Security Domain

`security_enforcement` is not set to `false`; include section.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — (no auth surface; render script is local-only) |
| V3 Session Management | no | — |
| V4 Access Control | no | — (PNG is public static asset, no auth required) |
| V5 Input Validation | no | — (input is a committed SVG file, not user input) |
| V6 Cryptography | no | — |

No security concerns for this phase. The render script is a devDep tool that runs locally; the output is a committed static file. No user input reaches the render pipeline.

---

## Sources

### Primary (HIGH confidence)
- `@resvg/resvg-js` npm registry (`npm view @resvg/resvg-js --json`) — version, engines, optional deps, publish date, unpack sizes
- `yisibl/resvg-js` `Cargo.toml` (main branch) — confirms resvg 0.34.0 + zimond/resvg fork
- `zimond/resvg` `Cargo.lock` — confirms fontdb 0.16.0
- `linebender/resvg` `CHANGELOG.md` — confirms variable font wght support added in 0.47.0 (2026-02-05)
- `thx/resvg-js` `index.d.ts` — `ResvgRenderOptions`, `RenderedImage.asPng(): Buffer`
- Font name tables parsed from live TTF downloads:
  - `JetBrainsMono-Bold.ttf` (GitHub JetBrains/JetBrainsMono master)
  - `Inter-Regular.ttf`, `Inter-Bold.ttf` (Google Fonts gstatic CDN)
  - `InterVariable.ttf` (rsms.me/inter/font-files/)
- `JetBrainsMono[wght].ttf` fvar table — default wght = 400
- PNG specification — IHDR byte offsets 16-19/20-23 (big-endian u32)
- `references/og-image.svg` — actual font-family values and text content
- `.github/workflows/deploy.yml` — confirms `npm ci --omit=dev` on droplet
- `public/favicon.svg` presence in `dist/client/` — confirms Astro `public/` → `dist/client/` copy
- `.planning/config.json` — `workflow.nyquist_validation: true`

### Secondary (MEDIUM confidence)
- resvg-js GitHub issues #289, #210 — font weight and font loading failure patterns

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- resvg-js API: HIGH — type definitions fetched from official repo
- Variable font incompatibility: HIGH — resvg CHANGELOG + Cargo.toml version verified directly
- Font name tables: HIGH — TTF files downloaded and name tables parsed in this session
- PNG byte layout: HIGH — PNG spec + verified via Python struct computation
- Astro static serving: HIGH — confirmed by existing favicon.svg in dist/client/
- Font character coverage: HIGH — cmap tables parsed from downloaded TTF files

**Research date:** 2026-05-14
**Valid until:** 2026-06-15 (font CDN URLs may change; re-verify if re-vendoring)

---

## RESEARCH COMPLETE

**Phase:** 8 — Open Graph image
**Confidence:** HIGH

### Key Findings

1. **Variable fonts do NOT work with resvg-js 2.6.2** — resvg 0.34.0 lacks `wght`-axis support (added in 0.47.0). Use static-weight TTF files. CONTEXT D-03's "variable fonts" wording is incorrect; the executor should use static files.

2. **InterVariable.ttf family name mismatch** — `InterVariable.ttf` has family name `Inter Variable`, not `Inter`. The D-03 SVG swap (`font-family="Inter"`) would fail to match. Use Google Fonts static `Inter-Regular.ttf` + `Inter-Bold.ttf` (family name = `Inter`).

3. **Three font files, all verified** — `JetBrainsMono-Bold.ttf` (267 KB, GitHub master), `Inter-Regular.ttf` (317 KB), `Inter-Bold.ttf` (318 KB) from Google Fonts gstatic. All have correct family names; all cover the non-ASCII chars in the SVG (U+00B7, U+2013, U+0027).

4. **PNG IHDR byte offsets confirmed** — `buf.readUInt32BE(16) === 1200`, `buf.readUInt32BE(20) === 630`. Width = `0x000004B0`, Height = `0x00000276`.

5. **No deployment changes** — `public/og-image.png` flows through the existing `astro build` → `dist/client/` → rsync pipeline unchanged. devDep is never installed on the production droplet (`npm ci --omit=dev`).

### File Created
`.planning/phases/08-open-graph-image/08-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard stack | HIGH | Version and compatibility verified via npm + Cargo.toml + resvg CHANGELOG |
| Font strategy | HIGH | Name tables parsed from live downloaded TTF files; fvar default weight verified |
| Architecture | HIGH | Confirmed by existing codebase (public/favicon.svg → dist/client/, deploy.yml) |
| Pitfalls | HIGH | Variable font pitfall confirmed against resvg version chain |
| PNG byte layout | HIGH | Verified via Python struct + PNG spec |

### Open Questions
- Where verify logic lives: recommend inline in `render-og-image.mjs` (Claude's discretion)
- Whether to log dimensions in render script: yes, costs nothing

### Ready for Planning
Research complete. Planner can now create `08-PLAN.md`.
