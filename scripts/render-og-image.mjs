#!/usr/bin/env node
// Phase 8 — render-og-image.mjs
// Renders references/og-image.svg → public/og-image.png (1200×630, image/png).
// Run once after any SVG edit; commit the resulting public/og-image.png.
//
// Font sources — re-vendor from these URLs if fonts need updating:
//   JetBrains Mono Bold v2.304 (SIL OFL 1.1):
//     https://github.com/JetBrains/JetBrainsMono/raw/master/fonts/ttf/JetBrainsMono-Bold.ttf
//   Inter Regular v20 (static, SIL OFL 1.1):
//     https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf
//   Inter Bold v20 (static, SIL OFL 1.1):
//     https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZg.ttf
//
// IMPORTANT: If you edit references/og-image.svg, you MUST run
// `npm run og:render` and commit public/og-image.png in the same PR.
// There is no CI check that enforces this.
//
// How to run:
//   npm run og:render
//   (or: node scripts/render-og-image.mjs)
//
// Exit codes:
//   0 = render + all 6 post-render checks PASS
//   1 = any check FAIL

import { readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { Resvg } from '@resvg/resvg-js';

// Resolve all paths against the repo root regardless of cwd — avoids
// fontFiles mismatch when the script is run from a subdirectory.
const root = new URL('..', import.meta.url).pathname;
const svgPath  = resolve(root, 'references/og-image.svg');
const outPath  = resolve(root, 'public/og-image.png');
const fontsDir = resolve(root, 'references/fonts');

const svg = readFileSync(svgPath);

const resvg = new Resvg(svg, {
  font: {
    fontFiles: [
      resolve(fontsDir, 'JetBrainsMono-Bold.ttf'),
      resolve(fontsDir, 'Inter-Regular.ttf'),
      resolve(fontsDir, 'Inter-Bold.ttf'),
    ],
    // Must be false: with system fonts enabled, resvg falls back to host fonts
    // (Menlo/Helvetica on macOS, DejaVu on Ubuntu) producing non-deterministic
    // renders across dev machines and CI.
    loadSystemFonts: false,
  },
  // Lock output width to 1200px so future SVG viewBox changes don't silently
  // break the OG image dimensions expected by the Phase 6 meta tags.
  fitTo: { mode: 'width', value: 1200 },
});

const rendered = resvg.render();
const png = rendered.asPng();          // Buffer
writeFileSync(outPath, png);
console.log(`[og:render] ${rendered.width}×${rendered.height}  ${png.length} bytes → ${outPath}`);

// ── Post-render verification (D-05) ──────────────────────────────────────────
let pass = 0;
let fail = 0;

function check(label, ok) {
  if (ok) { console.log(`[og:verify] PASS  ${label}`); pass++; }
  else    { console.error(`[og:verify] FAIL  ${label}`); fail++; }
}

// 1. File exists
check('file-exists', existsSync(outPath));

// 2. PNG signature — first 8 bytes must be 89 50 4E 47 0D 0A 1A 0A
const buf = readFileSync(outPath);
const PNG_SIG = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
check('png-signature', PNG_SIG.every((b, i) => buf[i] === b));

// 3–4. IHDR width (bytes 16-19) and height (bytes 20-23) as big-endian u32
// Per PNG spec, IHDR starts at offset 8+4+4 = 16; width precedes height.
check('ihdr-width-1200',  buf.readUInt32BE(16) === 1200);
check('ihdr-height-630',  buf.readUInt32BE(20) === 630);

// 5. Size budget — well under 300 KB expected for a flat-colour SVG
check('size-lt-300kb', statSync(outPath).size < 300_000);

// 6. LAND-02 grep on SVG source — PNG bytes carry no text, so the source is
// the right place to check for prohibited terms.
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
