#!/usr/bin/env node
// Rasterize the brand mark (public/favicon.svg) into an upload-ready PNG for ad
// networks (e.g. kickbacks.ai brand icon, PNG ≤ 64 KB). Pure shapes, no fonts.
//
//   node scripts/render-icon.mjs            # 512x512 -> marketing/oddlympics-icon.png
//   ICON_SIZE=256 node scripts/render-icon.mjs
//
// Deterministic (loadSystemFonts: false) so re-running on unchanged input is
// byte-identical. Exits 1 if the PNG would exceed the 64 KB cap.

import { readFileSync, writeFileSync, statSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const root = new URL('..', import.meta.url).pathname;
const SIZE = Number(process.env.ICON_SIZE ?? 512);
const SRC = resolve(root, 'public/favicon.svg');
const OUT = resolve(root, 'marketing/oddlympics-icon.png');
const CAP = 64 * 1024;

const svg = readFileSync(SRC, 'utf-8');
const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: SIZE },
  font: { loadSystemFonts: false },
});
const png = resvg.render().asPng();

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, png);

const bytes = statSync(OUT).size;
const kb = (bytes / 1024).toFixed(1);
console.log(`[icon] ${SIZE}x${SIZE} -> ${OUT}  (${kb} KB)`);
if (bytes > CAP) {
  console.error(`[icon] FAIL: ${kb} KB exceeds 64 KB cap`);
  process.exit(1);
}
console.log('[icon] OK (under 64 KB cap)');
