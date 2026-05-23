# Phase 15: Personalized Open Graph - Pattern Map

**Mapped:** 2026-05-23
**Files analyzed:** 9 (6 new/modified, 3 read-only context)
**Analogs found:** 9 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/pages/r/[code].astro` | route | request-response | `src/pages/manage.astro` | exact |
| `references/og-image-team.svg` | template | transform | `references/og-image.svg` | exact |
| `scripts/render-team-og-images.mjs` | script | batch / file-I/O | `scripts/render-og-image.mjs` | exact |
| `src/pages/pending.astro:77` | route (modify) | request-response | `src/pages/confirmed.astro:90` | exact |
| `src/pages/confirmed.astro:90` | route (modify) | request-response | `src/pages/pending.astro:77` | exact |
| `src/pages/manage.astro:70` | route (modify) | request-response | self (same file) | exact |
| `src/lib/email.ts:29` | service (modify) | request-response | self (same file) | exact |
| `scripts/smoke-signup.mjs` | test (extend) | request-response | self (same file, SHARE-* section) | exact |
| `package.json` | config (modify) | — | `og:render` script entry | exact |

---

## Wave 1: Template + Render Script + Route

---

### `references/og-image-team.svg` (template, transform)

**Analog:** `references/og-image.svg`

**Full chrome to preserve verbatim** (all sections except the headline block):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <!-- Background -->
  <rect width="1200" height="630" fill="#fafaf7"/>

  <!-- Subtle warm wash — right side -->
  <defs>
    <linearGradient id="wash" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fbe9e0" stop-opacity="0"/>
      <stop offset="100%" stop-color="#fbe9e0" stop-opacity="0.65"/>
    </linearGradient>
    <linearGradient id="dot" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#d94a1f"/>
      <stop offset="100%" stop-color="#b13a13"/>
    </linearGradient>
  </defs>
  <rect x="700" y="0" width="500" height="630" fill="url(#wash)"/>

  <!-- Top-left wordmark (preserve verbatim from og-image.svg:20-23) -->
  <g transform="translate(72, 78)">
    <circle cx="14" cy="14" r="10" fill="url(#dot)"/>
    <text x="38" y="22" font-family="JetBrains Mono" font-size="22"
          font-weight="700" fill="#14151a" letter-spacing="0.5">oddlympics</text>
  </g>

  <!-- Banner pill (preserve verbatim from og-image.svg:26-29) -->
  <g transform="translate(72, 168)">
    <rect x="0" y="0" rx="999" ry="999" width="430" height="40"
          fill="#fbe9e0" stroke="#d94a1f" stroke-width="1.5"/>
    <text x="20" y="26" font-family="JetBrains Mono" font-size="14"
          font-weight="700" letter-spacing="2.2" fill="#d94a1f">WORLD CUP 2026 · JUNE 11 – JULY 19</text>
  </g>

  <!-- Headline — PARAMETERIZED (replaces og-image.svg:32-36, D-05/D-07/D-08) -->
  <!-- {{HEADLINE_FONT_SIZE}} is substituted per-team by render script -->
  <!-- {{TEAM_LABEL}} carries the human label, e.g. "Bosnia and Herzegovina" -->
  <g transform="translate(72, 252)" font-family="Inter" fill="#14151a">
    <text x="0" y="0"   font-size="{{HEADLINE_FONT_SIZE}}" font-weight="700" letter-spacing="-1.2">Following {{TEAM_LABEL}}.</text>
    <text x="0" y="74"  font-size="{{HEADLINE_FONT_SIZE}}" font-weight="700" letter-spacing="-1.2">Every match in your zone.</text>
    <text x="0" y="148" font-size="{{HEADLINE_FONT_SIZE}}" font-weight="700" letter-spacing="-1.2" fill="#d94a1f">One ping before kickoff.</text>
  </g>

  <!-- Sub line (preserve verbatim from og-image.svg:39-41) -->
  <g transform="translate(72, 488)">
    <text font-family="Inter" font-size="22" fill="#5a5d68">Pick your team. Free for the whole tournament. No ads.</text>
  </g>

  <!-- URL (preserve verbatim from og-image.svg:44-46) -->
  <g transform="translate(72, 550)">
    <text font-family="JetBrains Mono" font-size="20" font-weight="600" fill="#14151a">oddlympics.app</text>
  </g>

  <!-- Right-side decorative flags (preserve verbatim from og-image.svg:49-70) -->
  <!-- ... same 6 flag blocks ... -->

  <!-- Bottom right tag (preserve verbatim from og-image.svg:73-75) -->
  <g transform="translate(1042, 588)">
    <text text-anchor="end" font-family="JetBrains Mono" font-size="14"
          fill="#5a5d68">Independent project · Not affiliated with FIFA</text>
  </g>
</svg>
```

**Phase 15 adaptation notes:**
- The only section that changes from `og-image.svg` is lines 32–36 (the headline `<g>` block).
- Replace the existing 3-line generic headline with the parameterized block above (D-07).
- Two tokens: `{{TEAM_LABEL}}` (line 1 only) and `{{HEADLINE_FONT_SIZE}}` (applied to all 3 `<text>` elements per D-08 — keeps block height balanced).
- Accent color `#d94a1f` on line 3 preserved verbatim from `og-image.svg:35` (D-07).
- y-offsets (0 / 74 / 148) match the existing 64pt grid — planner may need to verify balance at the 44pt bucket (`labelLen > 16`); a shorter `y="56"` / `y="112"` rhythm might tighten the block. Leave final y-values to implementer.

---

### `scripts/render-team-og-images.mjs` (script, batch / file-I/O)

**Analog:** `scripts/render-og-image.mjs` (read verbatim)

**Resvg config block** (`render-og-image.mjs:40-55`) — copy verbatim per D-11:

```javascript
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
```

**6-check post-render verification block** (`render-og-image.mjs:63-101`) — replicate per D-11 with per-team loop:

```javascript
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

// 3-4. IHDR width (bytes 16-19) and height (bytes 20-23) as big-endian u32
check('ihdr-width-1200',  buf.readUInt32BE(16) === 1200);
check('ihdr-height-630',  buf.readUInt32BE(20) === 630);

// 5. Size budget — well under 300 KB expected for a flat-colour SVG
check('size-lt-300kb', statSync(outPath).size < 300_000);

// 6. LAND-02 grep on the *substituted* SVG string (not the template file) — each
// iteration checked individually so a team name accidentally matching a banned term
// is caught per D-11. Note: the source to grep is the in-memory substituted string,
// not svgTemplatePath. Write the substituted SVG to a temp file or pipe to execSync.
try {
  execSync(
    "! grep -iE 'bitcoin|lightning|crypto|world domination|personal olympics' " +
    JSON.stringify(svgPath),   // svgPath = path to the per-team substituted SVG written to a tmpfile
    { stdio: 'inherit' }
  );
  check('land-02-clean', true);
} catch {
  check('land-02-clean', false);
}
```

**Full script structure** (paths, imports, loop skeleton):

```javascript
#!/usr/bin/env node
// Phase 15 — render-team-og-images.mjs
// Renders references/og-image-team.svg × 48 teams → public/og/<slug>.png
// Same Resvg config as render-og-image.mjs (D-11: deterministic, loadSystemFonts: false).
//
// Run: npm run og:render-teams
// Exit: 0 = all N/48 PASS; 1 = any FAIL

import { readFileSync, writeFileSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { Resvg } from '@resvg/resvg-js';
import teams from '../references/teams.json' with { type: 'json' };

const root     = new URL('..', import.meta.url).pathname;
const tmplPath = resolve(root, 'references/og-image-team.svg');
const outDir   = resolve(root, 'public/og');
const fontsDir = resolve(root, 'references/fonts');

mkdirSync(outDir, { recursive: true });

const template = readFileSync(tmplPath, 'utf8');

let totalPass = 0;
let totalFail = 0;

for (const team of teams) {
  const { slug, label } = team;
  const labelLen = label.length;
  // D-08: auto-scale font-size by label length
  const fontSize = labelLen <= 12 ? 64
                 : labelLen <= 16 ? 52
                 : 44;

  const svg = template
    .replace(/\{\{TEAM_LABEL\}\}/g, label)
    .replace(/\{\{HEADLINE_FONT_SIZE\}\}/g, String(fontSize));

  const outPath = resolve(outDir, `${slug}.png`);

  const resvg = new Resvg(Buffer.from(svg), {
    font: {
      fontFiles: [ /* ... verbatim from render-og-image.mjs:43-45 ... */ ],
      loadSystemFonts: false,
    },
    fitTo: { mode: 'width', value: 1200 },
  });

  const rendered = resvg.render();
  const png = rendered.asPng();
  writeFileSync(outPath, png);
  console.log(`[og:render-teams] ${slug.padEnd(20)} ${Math.round(png.length / 1024)} KB → ${outPath}`);

  // Per-team 6-check verification block (replicate from render-og-image.mjs:63-101)
  // LAND-02: grep the substituted SVG string (write to tmpfile, grep, delete)
  // ... aggregate into totalPass / totalFail ...
}

console.log(`[og:render-teams] ${totalPass}/${teams.length} PASS`);
if (totalFail > 0) process.exit(1);
```

**Phase 15 adaptation notes vs analog:**
- Load the template once (`readFileSync` before loop); substitute `{{TEAM_LABEL}}` and `{{HEADLINE_FONT_SIZE}}` inside the loop (D-05).
- `outPath` is `public/og/<slug>.png` per team, not a single `public/og-image.png` (D-09).
- The Resvg instance is recreated per team (different SVG bytes each iteration).
- The 6-check block runs per iteration, aggregating `totalPass` / `totalFail` across all 48. Final exit code mirrors the analog's `fail > 0 ? process.exit(1)` pattern (D-12).
- LAND-02 check grepping the *substituted* SVG string, not the template path — write the substituted SVG to a tmpfile, grep, delete. The key constraint from CONTEXT.md: "each iteration grepped individually to catch a team name accidentally matching a banned term."
- `mkdirSync(outDir, { recursive: true })` — `public/og/` directory may not exist before first run.
- Import `teams` from `references/teams.json` with `{ type: 'json' }` assertion (matches `src/lib/teams.ts:1` pattern).

---

### `src/pages/r/[code].astro` (route, request-response)

**Analog:** `src/pages/manage.astro`

**`prerender = false` + imports pattern** (`manage.astro:1-9`):

```typescript
---
import Layout from '../components/Layout.astro';
import { verifyToken } from '../lib/token';
import { buildSessionCookie, readSessionFromCookie } from '../lib/session';
import { db, getByEmail, getUserTeams, type VipSignup, type Match } from '../lib/db';
import { TEAMS, teamLabel } from '../lib/teams';
import { NO_ACCOUNT_TITLE, NO_ACCOUNT_BODY, shareText } from '../lib/copy';

export const prerender = false;
```

Phase 15 imports will be narrower:

```typescript
---
import Layout from '../../components/Layout.astro';
import { lookupByReferralCode } from '../../lib/db';
import { teamLabel, TEAMS } from '../../lib/teams';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export const prerender = false;
```

**Note on import path depth:** `src/pages/r/[code].astro` is one directory deeper than `src/pages/manage.astro`, so the relative path is `../../components/` and `../../lib/` (not `../`).

**`PUBLIC_SITE_URL` constant pattern** (`manage.astro:69` / `email.ts:9`):

```typescript
const base = process.env.PUBLIC_SITE_URL ?? 'http://localhost:4321';
```

**`lookupByReferralCode` call + team resolution** (`db.ts:174-176` context):

```typescript
// lookupByReferralCode returns { email, referral_code } — NOT team.
// Phase 15 needs team. Two options (Discretion):
//   Option A: extend db.ts with a new narrow lookupTeamByReferralCode:
//     SELECT referral_code, team FROM vip_signups WHERE referral_code = ?
//   Option B: two-step — lookupByReferralCode → email → getByEmail → .team
//
// Option A is preferred: single DB round-trip, no extra import surface, keeps
// the route frontmatter simple. Planner should add the prepared statement to
// db.ts (additive, no schema change). Pattern follows lookupByReferralCode:

// In src/lib/db.ts (new prepared statement):
// export const lookupTeamByReferralCode = db.prepare<[string]>(`
//   SELECT referral_code, team FROM vip_signups WHERE referral_code = ?
// `);

const code = Astro.params.code ?? '';
const row = lookupTeamByReferralCode.get(code) as
  { referral_code: string; team: string | null } | undefined;
```

**`existsSync` path resolution pattern** (`db.ts:6` analog for file-path resolution from server-side module):

```typescript
// db.ts resolves the DB path with:
//   const DB_PATH = process.env.DATABASE_PATH ?? './data/oddlympics.db';
//   const db = new Database(resolve(DB_PATH));
// For existsSync in a server-rendered Astro page, use fileURLToPath + import.meta.url
// to get a reliable repo-root-anchored path:
import { fileURLToPath } from 'node:url';
const repoRoot = resolve(fileURLToPath(import.meta.url), '../../../../');
const pngExists = row?.team
  ? existsSync(resolve(repoRoot, 'public/og', row.team + '.png'))
  : false;
```

**`Layout.astro` og prop usage pattern** (`index.astro:1-16` + `Layout.astro:18-27`):

```typescript
// index.astro shows the OG_IMAGE constant pattern (line 15):
const OG_IMAGE = 'https://oddlympics.app/og-image.png';
// Phase 15 route builds the absolute URL from PUBLIC_SITE_URL (env var, not hardcoded):
const SITE_URL = process.env.PUBLIC_SITE_URL ?? 'http://localhost:4321';
const ogImage = pngExists
  ? `${SITE_URL}/og/${row!.team}.png`
  : `${SITE_URL}/og-image.png`;
```

**`<slot name="head" />` meta-refresh pattern** (`Layout.astro:81`):

```astro
<!-- In the route's JSX body, slot the meta-refresh into Layout's head slot: -->
<Layout title={pageTitle} og={ogProps} noindex={true}>
  <Fragment slot="head">
    <meta http-equiv="refresh" content={`0; url=${bounceUrl}`} />
  </Fragment>
  <div class="wrap" style="padding: 4rem 0;">
    <p>Redirecting… if you're not redirected,
       <a href={bounceUrl}>tap here</a>.</p>
  </div>
  <script is:inline define:vars={{ bounceUrl }}>
    try { location.replace(bounceUrl); } catch {}
  </script>
</Layout>
```

**Resolved vs unresolved branch skeleton** (mirrors D-01 / D-02 / D-14):

```typescript
// In frontmatter:
const code = Astro.params.code ?? '';
const row = lookupTeamByReferralCode.get(code) as
  { referral_code: string; team: string | null } | undefined;

const GENERIC_TITLE = 'oddlympics — your team\'s World Cup matches';
const GENERIC_DESC  = 'Every World Cup match in your time zone. One ping before kickoff.';
const SITE_URL = process.env.PUBLIC_SITE_URL ?? 'http://localhost:4321';

let pageTitle: string;
let ogProps: { title: string; description: string; image: string; url: string };
let bounceUrl: string;

if (row?.team) {
  const label = teamLabel(row.team);
  const pngPath = resolve(repoRoot, 'public/og', row.team + '.png');
  const pngExists = existsSync(pngPath);
  pageTitle = `Following ${label} · oddlympics`;
  ogProps = {
    title: pageTitle,
    description: GENERIC_DESC,
    image: pngExists ? `${SITE_URL}/og/${row.team}.png` : `${SITE_URL}/og-image.png`,
    url: `${SITE_URL}/r/${code}`,
  };
  bounceUrl = `/?ref=${code}`;
} else {
  // Unknown / unresolvable code — generic fallback (D-02)
  pageTitle = GENERIC_TITLE;
  ogProps = {
    title: GENERIC_TITLE,
    description: GENERIC_DESC,
    image: `${SITE_URL}/og-image.png`,
    url: `${SITE_URL}/`,
  };
  bounceUrl = '/';
}
```

**Phase 15 adaptation notes vs analog (`manage.astro`):**
- No auth / session / cookie logic (D-04: the route is status-agnostic, no `verifyToken`, no `buildSessionCookie`).
- No DB writes — read-only frontmatter.
- Nested route (`src/pages/r/[code].astro`) is the first nested dynamic route in the codebase; import paths are two levels deep (`../../lib/`, `../../components/`). Astro resolves these at build time identically to flat routes.
- `Astro.params.code` is the dynamic segment (Astro convention for `[code].astro`).
- `noindex={true}` on Layout — the `/r/CODE` pages should not be indexed by search engines (they are redirect intermediaries, not content pages).
- `lookupByReferralCode` currently returns `{ email, referral_code }` (not `team`) — planner must add a new `lookupTeamByReferralCode` prepared statement to `src/lib/db.ts` returning `{ referral_code, team }` (single SELECT, no schema change). See Shared Patterns section.

---

## Wave 2: Migrate Four Share-URL Emit Sites + Commit PNGs

---

### `src/pages/pending.astro:77` (route, modify)

**Analog:** same file, line 77 (the share-URL string under the Phase 14 `?rc=` reader)

**Current line** (`pending.astro:77`):
```javascript
const shareUrl = location.origin + '/?ref=' + rc;
```

**Phase 15 change** (D-13):
```javascript
const shareUrl = location.origin + '/r/' + rc;
```

**Pattern context** (lines 70-77 for surrounding logic):
```javascript
const params = new URL(location.href).searchParams;
const rc = params.get('rc');
// Defensive gate: only allow the locked 8-char [a-z0-9] shape (D-03 + T-14-11).
if (!rc || !/^[a-z0-9]{8}$/.test(rc)) {
  // share card stays hidden
} else {
  const shareUrl = location.origin + '/r/' + rc;   // ← was /?ref=
```

---

### `src/pages/confirmed.astro:90` (route, modify)

**Analog:** same file, line 90

**Current line** (`confirmed.astro:90`):
```javascript
const shareUrl = location.origin + '/?ref=' + rc;
```

**Phase 15 change** (D-13):
```javascript
const shareUrl = location.origin + '/r/' + rc;
```

---

### `src/pages/manage.astro:70` (route, modify)

**Analog:** same file, lines 68-73 (server-rendered share URL composition)

**Current block** (`manage.astro:68-70`):
```typescript
if (user?.referral_code) {
  const base = process.env.PUBLIC_SITE_URL ?? 'http://localhost:4321';
  shareUrl = base + '/?ref=' + user.referral_code;
```

**Phase 15 change** (D-13):
```typescript
if (user?.referral_code) {
  const base = process.env.PUBLIC_SITE_URL ?? 'http://localhost:4321';
  shareUrl = base + '/r/' + user.referral_code;
```

---

### `src/lib/email.ts:29` (service, modify)

**Analog:** same file, line 29

**Current line** (`email.ts:29`):
```typescript
const shareUrl = SITE_URL + '/?ref=' + referralCode;
```

**Phase 15 change** (D-13):
```typescript
const shareUrl = SITE_URL + '/r/' + referralCode;
```

**Surrounding context** (`email.ts:9,29-30`) for reference:
```typescript
const SITE_URL = process.env.PUBLIC_SITE_URL ?? 'http://localhost:4321';
// ...
const shareUrl = SITE_URL + '/r/' + referralCode;   // ← was /?ref=
const shareLine = shareText(teamHuman, shareUrl);
```

---

### `package.json` (config, modify)

**Analog:** existing `og:render` script (`package.json:20`):
```json
"og:render": "node scripts/render-og-image.mjs"
```

**Phase 15 addition** — insert next to the analog (D-09):
```json
"og:render": "node scripts/render-og-image.mjs",
"og:render-teams": "node scripts/render-team-og-images.mjs"
```

---

## Wave 3: Smoke Extension

---

### `scripts/smoke-signup.mjs` (test, extend)

**Analog:** the existing `SHARE-*` section (`smoke-signup.mjs:448-568`), specifically the `SHARE-pending-card` and `SHARE-confirm-redirect-location` cases.

**`runCase` + response-body grep pattern** (`smoke-signup.mjs:68-82` / `459-475`):

```javascript
// runCase wrapper (smoke-signup.mjs:68-82) — same for Phase 15 cases:
async function runCase(name, fn) {
  try {
    const ok = await fn();
    if (ok) { console.log(`[smoke] PASS ${name}`); pass++; }
    else    { console.error(`[smoke] FAIL ${name}`); fail++; }
  } catch (err) {
    console.error(`[smoke] FAIL ${name} (exception) ${err.message}`);
    fail++;
  }
}

// Body-grep pattern from SHARE-pending-card (lines 459-475):
await runCase('SHARE-pending-card ...', async () => {
  const url = BASE + '/pending?email=...&rc=...&team=...';
  const res = await fetch(url);
  if (res.status !== 200) { console.error(`  expected 200, got ${res.status}`); return false; }
  const body = await res.text();
  const needed = ['share-card', 'share-url', 'Brazil'];
  for (const s of needed) {
    if (!body.includes(s)) { console.error(`  body missing: ${s}`); return false; }
  }
  return true;
});
```

**Phase 15 new cases — exact pattern to copy** (D-12):

```javascript
// SHARE-r-known: GET /r/<real-code>, assert 200 + personalized og:image + og:title
// Uses a real referral_code from the DB (same DB-read pattern as REF-valid-ref).
// Resolves whether PNG exists at public/og/<team>.png or falls back to generic —
// the assert accepts either (D-10 trim-fallback).
await runCase('SHARE-r-known', async () => {
  // Fetch any existing row that has a referral_code and a team
  const row = db.prepare(
    'SELECT referral_code, team FROM vip_signups WHERE referral_code IS NOT NULL AND team IS NOT NULL LIMIT 1'
  ).get();
  if (!row) {
    console.error('  no row with referral_code + team in DB; run a valid signup first');
    return false;
  }
  const r1 = await fetch(`${BASE}/r/${row.referral_code}`, { redirect: 'manual' });
  if (r1.status !== 200) {
    console.error(`  expected 200, got ${r1.status}`);
    return false;
  }
  const body1 = await r1.text();
  // og:image must be per-team PNG or generic fallback (D-10)
  const hasOgImage = body1.includes(`og:image" content="`)
    && (body1.includes(`/og/${row.team}.png`) || body1.includes('/og-image.png'));
  if (!hasOgImage) {
    console.error('  body missing og:image (per-team or fallback)');
    return false;
  }
  // og:title must include "Following <Team>" (D-14)
  if (!body1.match(/og:title" content="Following [^"]+ · oddlympics"/)) {
    console.error('  body missing personalized og:title');
    return false;
  }
  return true;
});

// SHARE-r-unknown: GET /r/notarealcode, assert 200 + generic og:image + no team title
await runCase('SHARE-r-unknown', async () => {
  const r2 = await fetch(`${BASE}/r/notarealcode`, { redirect: 'manual' });
  if (r2.status !== 200) {
    console.error(`  expected 200, got ${r2.status}`);
    return false;
  }
  const body2 = await r2.text();
  // Generic og:image (absolute URL from SITE_URL — accept both prod and localhost)
  const hasGenericOg =
    body2.includes('og:image" content="https://oddlympics.app/og-image.png"') ||
    body2.includes('og:image" content="http://localhost:4321/og-image.png"');
  if (!hasGenericOg) {
    console.error('  body missing generic og:image');
    return false;
  }
  // Must NOT have "Following" in title (no team personalization for unknown codes)
  if (body2.includes('og:title" content="Following ')) {
    console.error('  body has team-personalized og:title for unknown code (wrong)');
    return false;
  }
  return true;
});
```

**Phase 15 adaptation notes vs analog (`SHARE-*` section):**
- Two new cases appended after the existing `SHARE-confirm-redirect-location` case, before `case-7-rate-limit`.
- Use `redirect: 'manual'` on `fetch` (same as the analog's SHARE-confirm-redirect-location pattern at line 534) — the route bounces humans, smoke checks the raw 200 response with meta in head.
- DB-read for `row.referral_code + row.team` follows the `REF-valid-ref` pattern (lines 308-316) — query by `smoke-ref-a-*` email or use `LIMIT 1` on existing rows.
- The IP for these cases can reuse `SHARE_IP` (already reserved at line 52 for Phase 14 share cases).

---

## Shared Patterns

### New prepared statement: `lookupTeamByReferralCode`
**Apply to:** `src/lib/db.ts` (new export) + `src/pages/r/[code].astro` (consumer)

The existing `lookupByReferralCode` (`db.ts:174-176`) returns `email, referral_code` — NOT `team`. Phase 15's `/r/[code].astro` needs the team slug in one DB round-trip. Add a narrow second statement following the exact same pattern:

```typescript
// In src/lib/db.ts — after lookupByReferralCode (line 176):
// Phase 15 — OG-02 (D-04/D-10): resolves a referral code to team slug for
// per-team OG image selection. Narrowed to avoid leaking email/status to the
// unauthenticated /r/CODE route — intentional (15-CONTEXT.md D-03).
export const lookupTeamByReferralCode = db.prepare<[string]>(`
  SELECT referral_code, team FROM vip_signups WHERE referral_code = ?
`);
```

**Source:** prepared-statement idiom from `db.ts:174-176` + `db.ts:137-138` (typed generic pattern).

### `noindex` on the new route
**Apply to:** `src/pages/r/[code].astro`

The `/r/CODE` pages are redirect intermediaries — not content pages. Pass `noindex={true}` to Layout (same as `manage.astro` and `schedule.astro` do for authenticated app pages).

**Source:** `Layout.astro:47` (`{noindex && <meta name="robots" content="noindex" />}`).

### Defensive `try/catch` on inline `<script>`
**Apply to:** `src/pages/r/[code].astro` bounce script

```javascript
<script is:inline define:vars={{ bounceUrl }}>
  try { location.replace(bounceUrl); } catch {}
</script>
```

Every inline script in the codebase is `try/catch`-wrapped (CLAUDE.md conventions, Phase 13 D-13, Phase 14 D-03). The bounce script (`location.replace`) is no different.

**Source:** `pending.astro:69-82` / `confirmed.astro:68-110` (try/catch outer wrapping around all inline script logic).

### `PUBLIC_SITE_URL` env pattern for absolute OG URLs
**Apply to:** `src/pages/r/[code].astro` (og:image absolute URL), `scripts/render-team-og-images.mjs` (console output only — the render script produces local files; the absolute URL is only needed in the route)

```typescript
const SITE_URL = process.env.PUBLIC_SITE_URL ?? 'http://localhost:4321';
```

Facebook and Twitter require absolute URLs for `og:image`. Do not hardcode `oddlympics.app` — use `SITE_URL` so localhost dev works.

**Source:** `email.ts:9`, `manage.astro:69`.

---

## No Analog Found

No files in Phase 15 are without an analog. All new files have direct existing counterparts.

---

## Read-only context (no edits)

These files were read for pattern extraction only — Phase 15 does not modify them:

| File | Lines read | Why |
|---|---|---|
| `src/lib/db.ts` | 100-176 | `lookupByReferralCode` shape, `VipSignup` type, prepared-statement idiom |
| `src/lib/teams.ts` | 1-18 | `teamLabel(slug)` signature, `TEAMS` array shape |
| `src/components/Layout.astro` | 1-100 | `og` prop shape (lines 18-27), twitter mirror (61-67), `<slot name="head" />` (81) |
| `src/pages/index.astro` | 1-16 | `OG_IMAGE` constant pattern (line 15), `SITE_URL` hardcoded vs env pattern |

**Key flag from `lookupByReferralCode` read:** The existing statement at `db.ts:174-176` returns `{ email, referral_code }` — it does NOT return `team`. Phase 15 requires `team` for the OG image selection. Planner MUST add `lookupTeamByReferralCode` to `db.ts` (see Shared Patterns above). This is an additive export; no schema change.

---

## Metadata

**Analog search scope:** `src/pages/`, `src/lib/`, `src/components/`, `scripts/`, `references/`, `package.json`
**Files scanned:** 11
**Pattern extraction date:** 2026-05-23
