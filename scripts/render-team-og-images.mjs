#!/usr/bin/env node
// Phase 15 — render-team-og-images.mjs
// Renders references/og-image-team.svg × 48 teams → public/og/<slug>.png
// Same Resvg config as render-og-image.mjs (D-11: deterministic, loadSystemFonts: false).
//
// IMPORTANT: If you edit references/og-image-team.svg or references/teams.json,
// you MUST run `npm run og:render-teams` and commit public/og/ in the same PR.
// There is no CI check that enforces this.
//
// How to run:
//   npm run og:render-teams
//   (or: node scripts/render-team-og-images.mjs)
//
// Exit codes:
//   0 = all N/48 teams PASS (6 checks each)
//   1 = any check FAIL

import { readFileSync, writeFileSync, statSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';
import { Resvg } from '@resvg/resvg-js';
import teams from '../references/teams.json' with { type: 'json' };

// Resolve all paths against the repo root regardless of cwd — avoids
// fontFiles mismatch when the script is run from a subdirectory.
const root     = new URL('..', import.meta.url).pathname;
const tmplPath = resolve(root, 'references/og-image-team.svg');
const outDir   = resolve(root, 'public/og');
const fontsDir = resolve(root, 'references/fonts');

// First-run safe — public/og/ may not exist before the initial render.
mkdirSync(outDir, { recursive: true });

const template = readFileSync(tmplPath, 'utf8');

const PNG_SIG = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

let totalPass = 0;
let totalFail = 0;

function check(slug, label, ok) {
  if (ok) { console.log(`[${slug}/og:verify] PASS  ${label}`); totalPass++; }
  else    { console.error(`[${slug}/og:verify] FAIL  ${label}`); totalFail++; }
}

for (const team of teams) {
  const { slug, label } = team;
  const labelLen = label.length;

  // D-08: auto-scale font-size by label length to keep block height balanced.
  const fontSize = labelLen <= 12 ? 64
                 : labelLen <= 16 ? 52
                 : 44;

  const svg = template
    .replace(/\{\{TEAM_LABEL\}\}/g, label)
    .replace(/\{\{HEADLINE_FONT_SIZE\}\}/g, String(fontSize));

  const outPath = resolve(outDir, `${slug}.png`);

  // Labels with SVG-special chars (<, >, &) would break this render; current
  // references/teams.json is clean (verified Phase 15-02). Apostrophes (e.g.
  // Curaçao) are valid in SVG element text without escaping.
  const resvg = new Resvg(Buffer.from(svg), {
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
  const png = rendered.asPng();
  writeFileSync(outPath, png);
  console.log(`[og:render-teams] ${slug.padEnd(20)} ${Math.round(png.length / 1024).toString().padStart(3)} KB  ${fontSize}pt  → ${outPath}`);

  // ── Per-team verification (6 checks, mirrors render-og-image.mjs:63-101) ───

  // 1. File exists
  check(slug, 'file-exists', existsSync(outPath));

  // 2. PNG signature — first 8 bytes must be 89 50 4E 47 0D 0A 1A 0A
  const buf = readFileSync(outPath);
  check(slug, 'png-signature', PNG_SIG.every((b, i) => buf[i] === b));

  // 3–4. IHDR width (bytes 16-19) and height (bytes 20-23) as big-endian u32
  check(slug, 'ihdr-width-1200',  buf.readUInt32BE(16) === 1200);
  check(slug, 'ihdr-height-630',  buf.readUInt32BE(20) === 630);

  // 5. Size budget — well under 300 KB expected for a flat-colour SVG
  check(slug, 'size-lt-300kb', statSync(outPath).size < 300_000);

  // 6. LAND-02 per-team: grep the SUBSTITUTED SVG (not the template) — catches
  // a team label that accidentally contains a banned term (T-15-LAND, D-11).
  // Tmpfile path uses slug ([a-z0-9_]) + pid so there is no shell-injection risk.
  const tmpSvg = resolve(tmpdir(), `og-team-${slug}-${process.pid}.svg`);
  writeFileSync(tmpSvg, svg);
  try {
    execSync(
      "! grep -iE 'bitcoin|lightning|crypto|world domination|personal olympics' " +
      JSON.stringify(tmpSvg),
      { stdio: 'inherit' }
    );
    check(slug, 'land-02-clean', true);
  } catch {
    check(slug, 'land-02-clean', false);
  } finally {
    try { unlinkSync(tmpSvg); } catch {}
  }
}

// D-12a: report teams-fully-passed (totalPass / 6 checks per team), not raw check count.
const teamsPassed = totalPass / 6;
console.log(`[og:render-teams] ${teamsPassed}/${teams.length} PASS`);
if (totalFail > 0) {
  console.error(`[og:render-teams] ${totalFail} check failures across ${teams.length} teams`);
  process.exit(1);
}
