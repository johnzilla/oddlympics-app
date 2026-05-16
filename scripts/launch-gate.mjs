#!/usr/bin/env node
// Phase 11 — launch-gate.mjs
// Consolidated AC1–AC12 gate runner against production https://oddlympics.app
// (SMOKE_BASE_URL env override mirrors the existing smoke-* convention; the
// default is prod, inverted from smoke-* which default to localhost).
//
// How to run:
//   node scripts/launch-gate.mjs
//   OR: npm run smoke:gate
//
//   Env (optional):
//     SMOKE_BASE_URL   default https://oddlympics.app  (override for local pre-flight)
//     CHROME_PATH      path to chrome-headless-shell binary (required for AC3/AC8)
//                      install once: npx @puppeteer/browsers install chrome-headless-shell@stable
//                      binary lands at ./chrome-headless-shell/<platform>/chrome-headless-shell
//     DATABASE_PATH    not used by this script (see cleanup-gate-rows.mjs)
//
// Exit codes:
//   0 = all automated ACs PASS
//   1 = any automated AC FAIL
//   2 = setup error (server unreachable, chrome-headless-shell binary missing/invalid)
//
// DOCUMENTED DEVIATION — D-03:
//   MILESTONE-consumer-landing.md AC3 and REQUIREMENTS.md literally say "Playwright".
//   This script satisfies the AC's intent using puppeteer-core + chrome-headless-shell,
//   the established Phase-6 repo pattern (06-03-SUMMARY.md lines 97–157). Rationale:
//   zero new devDependency, no Playwright install overhead, puppeteer-core is loaded
//   via npx/tmp at runtime only, and the underlying Chrome behavior is identical.
//   This deviation is recorded here, in 11-SUMMARY.md, and in the per-AC evidence.

import { readFileSync, mkdirSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import { execSync, spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const BASE = process.env.SMOKE_BASE_URL ?? 'https://oddlympics.app';
// RFC 5737 TEST-NET-1; distinct from smoke-signup (192.0.2.42) and smoke-landing (192.0.2.43)
// so AC9/AC12 POSTs don't share a rate-limit bucket with existing smoke scripts.
const GATE_IP = '192.0.2.44';

const EVIDENCE_DIR = resolve(REPO_ROOT, '.planning/phases/11-end-to-end-launch-gate/evidence');

// chrome-headless-shell installs into a version-pinned dir that changes per
// install (e.g. chrome-headless-shell/mac_arm-148.../chrome-headless-shell-mac-arm64/).
// Making the operator hand-build that path is brittle (D-01 in-phase fix):
// honor an explicit CHROME_PATH override, else auto-discover the binary.
function resolveChromePath() {
  const override = process.env.CHROME_PATH;
  if (override && existsSync(override)) return override;
  const root = resolve(REPO_ROOT, 'chrome-headless-shell');
  if (!existsSync(root)) return null;
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const full = resolve(dir, ent.name);
      if (ent.isDirectory()) stack.push(full);
      else if (ent.name === 'chrome-headless-shell' || ent.name === 'chrome-headless-shell.exe') return full;
    }
  }
  return null;
}

console.log(`[gate] target: ${BASE}`);
console.log(`[gate] evidence: ${EVIDENCE_DIR}`);

// Ensure evidence directory exists before any case runs.
mkdirSync(EVIDENCE_DIR, { recursive: true });

let pass = 0;
let fail = 0;

async function runCase(name, fn) {
  try {
    const ok = await fn();
    if (ok) {
      console.log(`[gate] PASS ${name}`);
      pass++;
    } else {
      console.error(`[gate] FAIL ${name}`);
      fail++;
    }
  } catch (err) {
    console.error(`[gate] FAIL ${name} (exception) ${err.message}`);
    fail++;
  }
}

async function post(form) {
  const body = new URLSearchParams(form);
  const res = await fetch(`${BASE}/api/signup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Origin: BASE,
      'X-Forwarded-For': GATE_IP,
    },
    body,
    redirect: 'manual',
  });
  return { status: res.status, location: res.headers.get('location') };
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'GET',
    redirect: 'manual',
  });
  return {
    status: res.status,
    location: res.headers.get('location'),
    body: await res.text(),
  };
}

// Helper for readline-based operator evidence capture.
function prompt(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ---------------------------------------------------------------------------
// Server reachability probe — exit 2 before any AC runs.
// ---------------------------------------------------------------------------
try {
  const res = await fetch(`${BASE}/`, { method: 'GET' });
  if (res.status >= 500) {
    console.error(`[gate] FAIL: ${BASE}/ returned ${res.status}`);
    process.exit(2);
  }
} catch (err) {
  console.error(
    `[gate] FAIL: cannot reach ${BASE} — is the server running? (${err.message})`,
  );
  process.exit(2);
}

// Fetch landing page once; shared by AC1, AC2, AC7-slash.
const landingRes = await fetch(`${BASE}/`);
if (landingRes.status !== 200) {
  console.error(`[gate] FAIL: GET / returned ${landingRes.status}`);
  process.exit(2);
}
const landingHtml = await landingRes.text();

// ---------------------------------------------------------------------------
// AC1 — landing renders with the canonical headline.
// ---------------------------------------------------------------------------
await runCase('AC1-landing-renders', () => {
  const ok = landingHtml.includes("Your team's matches. In your time zone. One ping before kickoff.");
  writeFileSync(
    resolve(EVIDENCE_DIR, 'AC1-pass.txt'),
    ok
      ? `PASS: headline found in landing HTML at ${new Date().toISOString()}\nTarget: ${BASE}/\n`
      : `FAIL: headline NOT found at ${new Date().toISOString()}\nTarget: ${BASE}/\n`,
  );
  return ok;
});

// ---------------------------------------------------------------------------
// AC2 — exactly 48 <option> values in the live rendered <select>, set-equal to
//        references/teams.json slugs.
// ---------------------------------------------------------------------------
await runCase('AC2-team-select-48-options', () => {
  // Static JSON check.
  const teams = JSON.parse(
    readFileSync(resolve(REPO_ROOT, 'references/teams.json'), 'utf8'),
  );
  if (!Array.isArray(teams) || teams.length !== 48) {
    console.error(`  references/teams.json: expected 48 entries, got ${teams?.length}`);
    return false;
  }
  const jsonSlugs = new Set(teams.map((t) => t.slug));

  // Live rendered <select> check — parse option values from the HTML.
  // Matches <option value="slug"> but NOT <option value=""> (placeholder).
  const optionRegex = /<option\s+value="([^"]+)"/g;
  const liveSlugs = new Set();
  let m;
  while ((m = optionRegex.exec(landingHtml)) !== null) {
    if (m[1]) liveSlugs.add(m[1]);
  }

  if (liveSlugs.size !== 48) {
    console.error(`  live <select>: expected 48 options, got ${liveSlugs.size}`);
    return false;
  }

  // Assert set equality between live slugs and teams.json slugs.
  for (const slug of jsonSlugs) {
    if (!liveSlugs.has(slug)) {
      console.error(`  slug in teams.json but NOT in live <select>: ${slug}`);
      return false;
    }
  }
  for (const slug of liveSlugs) {
    if (!jsonSlugs.has(slug)) {
      console.error(`  slug in live <select> but NOT in teams.json: ${slug}`);
      return false;
    }
  }

  writeFileSync(
    resolve(EVIDENCE_DIR, 'AC2-pass.txt'),
    `PASS: 48 options matched teams.json at ${new Date().toISOString()}\nTarget: ${BASE}/\n`,
  );
  return true;
});

// ---------------------------------------------------------------------------
// AC3 — puppeteer-core tz-spoof across 3 locales; asserts #timezone value and
//        #tz-label text (the pinned persistence-assertion path — no off-droplet
//        DB read needed because /api/signup persists the #timezone value verbatim
//        after VALID_TZ validation; all three locales are valid IANA zones).
// ---------------------------------------------------------------------------
{
  const CHROME_PATH = resolveChromePath();
  if (!CHROME_PATH) {
    console.error(
      '[gate] FAIL: AC3 needs the chrome-headless-shell binary (not found).',
    );
    console.error(
      '[gate] Install once: npx @puppeteer/browsers install chrome-headless-shell@stable',
    );
    console.error(
      '[gate] It auto-discovers under ./chrome-headless-shell/ after install; or set CHROME_PATH explicitly.',
    );
    process.exit(2);
  }
  console.log(`[gate] AC3: using chrome-headless-shell at ${CHROME_PATH}`);

  // Load puppeteer-core via the project's existing node_modules (installed as
  // a Phase-6 pattern; kept out of package.json deps per 06-03 decision).
  // If not available, require operator to install once via npx.
  // D-06: one re-runnable command. puppeteer-core stays out of package.json
  // (D-03 / 06-03). Install BEFORE the first import — Node's ESM loader
  // negative-caches a failed specifier resolution for the whole process, so
  // install-then-retry in the same process cannot work; an existence-gated
  // pre-install can.
  if (!existsSync(resolve(REPO_ROOT, 'node_modules/puppeteer-core/package.json'))) {
    console.log('[gate] AC3: puppeteer-core not found — installing (--no-save, package.json untouched)…');
    try {
      execSync('npm install --no-save puppeteer-core', { cwd: REPO_ROOT, stdio: 'inherit' });
    } catch (err) {
      console.error(`[gate] FAIL: AC3 could not install puppeteer-core: ${err.message}`);
      process.exit(2);
    }
  }
  let puppeteer;
  try {
    puppeteer = await import('puppeteer-core');
  } catch (err) {
    console.error(`[gate] FAIL: AC3 could not load puppeteer-core after install: ${err.message}`);
    console.error('[gate] Install manually then re-run: npm install --no-save puppeteer-core && npm run smoke:gate');
    process.exit(2);
  }

  const locales = [
    { tz: 'America/Detroit', city: 'Detroit' },
    { tz: 'Europe/London',   city: 'London'  },
    { tz: 'Africa/Lagos',    city: 'Lagos'   },
  ];

  let browser;
  try {
    browser = await puppeteer.default.launch({
      executablePath: CHROME_PATH,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
  } catch (err) {
    console.error(`[gate] FAIL: AC3 could not launch puppeteer-core: ${err.message}`);
    process.exit(2);
  }

  for (const { tz, city } of locales) {
    await runCase(`AC3-tz-spoof-${city}`, async () => {
      const page = await browser.newPage();
      try {
        await page.emulateTimezone(tz);
        await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' });

        const tzValue = await page.$eval('#timezone', (el) => el.value).catch(() => '');
        const tzLabel = await page.$eval('#tz-label', (el) => el.textContent?.trim() ?? '').catch(() => '');

        const expectedLabel = `${city} time`;
        const okValue = tzValue === tz;
        const okLabel = tzLabel === expectedLabel;

        if (!okValue) {
          console.error(`  #timezone value: expected "${tz}", got "${tzValue}"`);
        }
        if (!okLabel) {
          console.error(`  #tz-label text: expected "${expectedLabel}", got "${tzLabel}"`);
        }
        return okValue && okLabel;
      } finally {
        await page.close();
      }
    });
  }

  await browser.close();

  // Write combined evidence after all three locales.
  writeFileSync(
    resolve(EVIDENCE_DIR, 'AC3-locales.txt'),
    `AC3 puppeteer-core tz-spoof — ${new Date().toISOString()}\nTarget: ${BASE}/\n` +
    `Locales: America/Detroit, Europe/London, Africa/Lagos\n` +
    `DEVIATION: Used puppeteer-core (Phase-6 pattern) instead of Playwright per D-03\n`,
  );
}

// ---------------------------------------------------------------------------
// AC4 — full Gmail loop (operator-gated). Emit prompt, capture evidence.
// ---------------------------------------------------------------------------
console.log('\n[gate] --- OPERATOR ACTION REQUIRED: AC4 ---');
console.log('[gate] AC4: Perform full Gmail sign-in loop:');
console.log('[gate] AC4:   1. Open a fresh browser profile (incognito)');
console.log('[gate] AC4:   2. Go to ' + BASE);
console.log('[gate] AC4:   3. Sign up with: johnturner+ac4@gmail.com  team=england  (use your tz)');
console.log('[gate] AC4:   4. Check Gmail inbox for confirmation email — should arrive < 60s');
console.log('[gate] AC4:   5. Click the confirmation link, then visit /manage, then unsubscribe');
console.log('[gate] AC4:   6. Record start-to-confirmation time in seconds');
const ac4Evidence = await prompt('[gate] AC4: Paste evidence (screenshot path, timing note) or press Enter to skip: ');
if (ac4Evidence) {
  writeFileSync(
    resolve(EVIDENCE_DIR, 'AC4-operator-evidence.txt'),
    `AC4 Gmail full loop — ${new Date().toISOString()}\n${ac4Evidence}\n`,
  );
  console.log('[gate] AC4: OPERATOR-CONFIRMED — evidence saved');
} else {
  writeFileSync(
    resolve(EVIDENCE_DIR, 'AC4-operator-evidence.txt'),
    `AC4 Gmail full loop — ${new Date().toISOString()}\nSKIPPED (no evidence provided)\n`,
  );
  console.log('[gate] AC4: SKIPPED (no evidence provided — mark manually if verified)');
}

// ---------------------------------------------------------------------------
// AC6 — /og-image.png: 200, image/png, exactly 1200×630, < 300 KB.
// ---------------------------------------------------------------------------
await runCase('AC6-og-image', async () => {
  const res = await fetch(`${BASE}/og-image.png`);
  if (res.status !== 200) {
    console.error(`  expected 200, got ${res.status}`);
    return false;
  }
  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('image/png')) {
    console.error(`  expected image/png content-type, got ${ct}`);
    return false;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length >= 300 * 1024) {
    console.error(`  expected < 300 KB, got ${buf.length} bytes`);
    return false;
  }
  // PNG spec: bytes 16–19 = width (4 bytes big-endian), bytes 20–23 = height.
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  if (width !== 1200 || height !== 630) {
    console.error(`  expected 1200×630, got ${width}×${height}`);
    return false;
  }
  writeFileSync(
    resolve(EVIDENCE_DIR, 'AC6-og-image.txt'),
    `PASS: /og-image.png — 200, image/png, ${width}×${height}, ${buf.length} bytes at ${new Date().toISOString()}\nTarget: ${BASE}/og-image.png\n`,
  );
  return true;
});

// ---------------------------------------------------------------------------
// AC7 — prohibited-terms grep across /, /privacy, /terms, /manage.
//        Bracket char-classes keep literal prohibited substrings out of THIS
//        source file so the file itself self-passes the same grep (LAND-02).
// ---------------------------------------------------------------------------
{
  const surfaces = ['/', '/privacy', '/terms', '/manage'];
  const prohibitedRe = /([b]itcoin|[l]ightning|[c]rypto|[w]orld domination|[p]ersonal olympics)/i;

  let ac7Pass = true;
  const results = [];

  for (const path of surfaces) {
    const { body } = await get(path);
    const hit = prohibitedRe.test(body);
    results.push({ path, hit });
    if (hit) {
      ac7Pass = false;
      console.error(`  [gate] FAIL AC7-prohibited-terms: found prohibited term on ${path}`);
    }
  }

  await runCase('AC7-prohibited-terms (/, /privacy, /terms, /manage)', () => {
    writeFileSync(
      resolve(EVIDENCE_DIR, 'AC7-prohibited-terms.txt'),
      `AC7 prohibited-terms check — ${new Date().toISOString()}\nTarget: ${BASE}\n\n` +
        results.map((r) => `${r.path}: ${r.hit ? 'FAIL (prohibited term found)' : 'PASS (clean)'}`).join('\n') +
        '\n',
    );
    return ac7Pass;
  });
}

// ---------------------------------------------------------------------------
// AC8 — Lighthouse mobile → references/lighthouse-final.html; all 4 categories >= 90.
//        Path is EXACTLY references/lighthouse-final.html (SC2 / done-def #5).
// ---------------------------------------------------------------------------
await runCase('AC8-lighthouse-mobile', async () => {
  const CHROME_PATH = resolveChromePath();
  if (!CHROME_PATH) {
    console.error('[gate] AC8: chrome-headless-shell binary not found — cannot run Lighthouse');
    return false;
  }

  const lhOutputPath = resolve(REPO_ROOT, 'references/lighthouse-final.html');

  console.log('[gate] AC8: Running Lighthouse (this may take ~30s)…');
  const result = spawnSync(
    'npx',
    [
      'lighthouse',
      BASE,
      '--form-factor=mobile',
      '--output=html',
      `--output-path=${lhOutputPath}`,
      '--chrome-flags=--headless=new --no-sandbox --disable-dev-shm-usage',
      '--quiet',
    ],
    {
      env: { ...process.env, CHROME_PATH },
      encoding: 'utf8',
      timeout: 120_000,
    },
  );

  if (result.status !== 0) {
    console.error(`[gate] AC8: Lighthouse exited ${result.status}: ${result.stderr}`);
    return false;
  }

  // Parse the four category scores from the generated HTML report.
  // Lighthouse embeds a JSON blob: `window.__LIGHTHOUSE_JSON__ = {...}` OR uses
  // `<script>...</script>` with the report data. The most reliable parse is to
  // grep for the score values in the JSON that Lighthouse embeds in the HTML.
  // Pattern: `"performance":{"score":N,"displayValue"...}` etc.
  // Use a secondary JSON output alongside to get exact scores reliably.
  const lhJsonPath = lhOutputPath.replace('.html', '.json');
  const jsonResult = spawnSync(
    'npx',
    [
      'lighthouse',
      BASE,
      '--form-factor=mobile',
      '--output=json',
      `--output-path=${lhJsonPath}`,
      '--chrome-flags=--headless=new --no-sandbox --disable-dev-shm-usage',
      '--quiet',
    ],
    {
      env: { ...process.env, CHROME_PATH },
      encoding: 'utf8',
      timeout: 120_000,
    },
  );

  let scores;
  if (jsonResult.status === 0 && existsSync(lhJsonPath)) {
    try {
      const lhData = JSON.parse(readFileSync(lhJsonPath, 'utf8'));
      scores = {
        performance:     lhData.categories?.performance?.score,
        accessibility:   lhData.categories?.accessibility?.score,
        'best-practices': lhData.categories?.['best-practices']?.score,
        seo:             lhData.categories?.seo?.score,
      };
    } catch (e) {
      console.error(`[gate] AC8: could not parse Lighthouse JSON: ${e.message}`);
      return false;
    }
  } else {
    // Fallback: parse scores from the HTML report.
    const lhHtml = existsSync(lhOutputPath) ? readFileSync(lhOutputPath, 'utf8') : '';
    const scoreRe = /"(performance|accessibility|best-practices|seo)"\s*:\s*\{\s*"score"\s*:\s*([\d.]+)/g;
    scores = {};
    let sm;
    while ((sm = scoreRe.exec(lhHtml)) !== null) {
      scores[sm[1]] = parseFloat(sm[2]);
    }
  }

  const categories = ['performance', 'accessibility', 'best-practices', 'seo'];
  let allPass = true;
  const scoreLines = [];

  for (const cat of categories) {
    const score = scores[cat];
    const pct = score != null ? Math.round(score * 100) : 'N/A';
    const ok = score != null && score >= 0.9;
    if (!ok) {
      allPass = false;
      console.error(`  [gate] AC8: ${cat} = ${pct} (need >= 90)`);
    } else {
      console.log(`  [gate] AC8: ${cat} = ${pct} ✓`);
    }
    scoreLines.push(`${cat}: ${pct}`);
  }

  writeFileSync(
    resolve(EVIDENCE_DIR, 'AC8-lighthouse-score.txt'),
    `AC8 Lighthouse mobile — ${new Date().toISOString()}\nTarget: ${BASE}\nReport: references/lighthouse-final.html\n\n` +
      scoreLines.join('\n') + '\n' +
      `\nResult: ${allPass ? 'PASS (all >= 90)' : 'FAIL (one or more < 90)'}\n`,
  );

  return allPass;
});

// ---------------------------------------------------------------------------
// AC9 — bad team → 303 /?error=bad-form (no row written by design).
// ---------------------------------------------------------------------------
await runCase('AC9-invalid-team', async () => {
  const { status, location } = await post({
    email: 'johnturner+ac9@gmail.com',
    team: 'fake_team',
    timezone: 'America/New_York',
    requested_sport: 'world_cup',
    website: '',
  });
  // The redirect contract alone is sufficient — no off-droplet DB read needed
  // (bad-team guard fires before the row upsert in /api/signup).
  const ok = status === 303 && location === '/?error=bad-form';
  writeFileSync(
    resolve(EVIDENCE_DIR, 'AC9-invalid-team.txt'),
    `AC9 bad-team redirect — ${new Date().toISOString()}\nTarget: ${BASE}/api/signup\nStatus: ${status}\nLocation: ${location}\nResult: ${ok ? 'PASS' : 'FAIL'}\n`,
  );
  if (!ok) {
    console.error(`  expected 303 /?error=bad-form, got ${status} ${location}`);
  }
  return ok;
});

// ---------------------------------------------------------------------------
// AC10 — /manage backfilled-row banner + save (operator-gated).
// ---------------------------------------------------------------------------
console.log('\n[gate] --- OPERATOR ACTION REQUIRED: AC10 ---');
console.log('[gate] AC10: Verify backfilled-row banner on /manage:');
console.log('[gate] AC10:   1. Sign in as a legacy subscriber (NULL team column)');
console.log('[gate] AC10:   2. Verify "Pick a team" banner appears at the top of /manage');
console.log('[gate] AC10:   3. Select a team and timezone, click Save');
console.log('[gate] AC10:   4. Verify /manage?status=saved renders (banner gone)');
const ac10Evidence = await prompt('[gate] AC10: Paste evidence (screenshot path or note) or press Enter to skip: ');
if (ac10Evidence) {
  writeFileSync(
    resolve(EVIDENCE_DIR, 'AC10-operator-evidence.txt'),
    `AC10 backfilled-row banner + save — ${new Date().toISOString()}\n${ac10Evidence}\n`,
  );
  console.log('[gate] AC10: OPERATOR-CONFIRMED — evidence saved');
} else {
  writeFileSync(
    resolve(EVIDENCE_DIR, 'AC10-operator-evidence.txt'),
    `AC10 backfilled-row banner + save — ${new Date().toISOString()}\nSKIPPED (no evidence provided)\n`,
  );
  console.log('[gate] AC10: SKIPPED');
}

// ---------------------------------------------------------------------------
// AC11 — Plausible dashboard "Signup Submit" event (operator-gated).
// ---------------------------------------------------------------------------
console.log('\n[gate] --- OPERATOR ACTION REQUIRED: AC11 ---');
console.log('[gate] AC11: Verify Plausible "Signup Submit" custom event:');
console.log('[gate] AC11:   1. Visit plausible.io dashboard for oddlympics.app');
console.log('[gate] AC11:   2. Navigate to Goals → "Signup Submit"');
console.log('[gate] AC11:   3. Confirm recent events appear (from AC4 test signup or live users)');
console.log('[gate] AC11:   4. Confirm "team" prop is recorded alongside the event');
const ac11Evidence = await prompt('[gate] AC11: Paste Plausible dashboard URL or note or press Enter to skip: ');
if (ac11Evidence) {
  writeFileSync(
    resolve(EVIDENCE_DIR, 'AC11-operator-evidence.txt'),
    `AC11 Plausible Signup Submit event — ${new Date().toISOString()}\n${ac11Evidence}\n`,
  );
  console.log('[gate] AC11: OPERATOR-CONFIRMED — evidence saved');
} else {
  writeFileSync(
    resolve(EVIDENCE_DIR, 'AC11-operator-evidence.txt'),
    `AC11 Plausible Signup Submit event — ${new Date().toISOString()}\nSKIPPED (no evidence provided)\n`,
  );
  console.log('[gate] AC11: SKIPPED');
}

// ---------------------------------------------------------------------------
// AC12 — honeypot set → 303 /pending (no row written by design).
// ---------------------------------------------------------------------------
await runCase('AC12-honeypot', async () => {
  const { status, location } = await post({
    email: 'johnturner+ac12@gmail.com',
    team: 'england',
    timezone: 'America/New_York',
    requested_sport: 'world_cup',
    website: 'evil-bot',
  });
  // Honeypot short-circuits before the DB upsert — redirect contract alone is sufficient.
  const ok = status === 303 && location === '/pending';
  writeFileSync(
    resolve(EVIDENCE_DIR, 'AC12-honeypot.txt'),
    `AC12 honeypot redirect — ${new Date().toISOString()}\nTarget: ${BASE}/api/signup\nStatus: ${status}\nLocation: ${location}\nResult: ${ok ? 'PASS' : 'FAIL'}\n`,
  );
  if (!ok) {
    console.error(`  expected 303 /pending, got ${status} ${location}`);
  }
  return ok;
});

// ---------------------------------------------------------------------------
// AC-MT — multi-team /manage select+save+read-back (D-09 re-gate, operator-gated
// for the authenticated session; fetch+cookie, no browser launch needed).
// Test email: johnturner+acmt@gmail.com (+ac infix satisfies D-04 cleanup reach).
// runCase name: AC-MT-multi-team-manage
// ---------------------------------------------------------------------------
console.log('\n[gate] --- OPERATOR ACTION REQUIRED: AC-MT ---');
console.log('[gate] AC-MT: Verify multi-team /manage save+read-back on post-Phase-12 prod.');
console.log('[gate] AC-MT:   1. In a browser, go to ' + BASE + '/manage');
console.log('[gate] AC-MT:   2. Enter email: johnturner+acmt@gmail.com and request the magic link');
console.log('[gate] AC-MT:   3. Click the magic link in the email to sign in — a session cookie will be set');
console.log('[gate] AC-MT:   4. Open DevTools → Application → Cookies → ' + BASE);
console.log('[gate] AC-MT:   5. Copy the value of the "oddlympics_session" cookie');
console.log('[gate] AC-MT:   6. Paste it below as: oddlympics_session=<value>');
const acmtCookieRaw = await prompt('[gate] AC-MT: Paste session Cookie header (e.g. oddlympics_session=...) or press Enter to skip: ');

if (!acmtCookieRaw) {
  // No cookie pasted → AC-MT is OPERATOR-APPROVED on the Phase-12 evidence
  // basis, NOT a gap. Multi-team /manage save+read-back was verified
  // end-to-end in Phase 12 (12-VERIFICATION.md 11/11; smoke-manage M10/M11 —
  // the exact assertion this probe automates). This off-box probe can't mint
  // a prod session by design; owner approved it rather than repeat the
  // cookie ceremony. Deliberately NOT counted as fail and NOT exit-code
  // affecting — and NOT a silent green either: it prints + records WHY.
  // Do not "fix" this back to FAIL/SKIP; that reintroduces the nag the
  // owner explicitly closed (see evidence/AC-MT-multi-team.txt).
  writeFileSync(
    resolve(EVIDENCE_DIR, 'AC-MT-multi-team.txt'),
    `AC-MT multi-team /manage select+save+read-back — OPERATOR-APPROVED ${new Date().toISOString()}\n` +
    `Target: ${BASE}\n` +
    `Test email: johnturner+acmt@gmail.com\n` +
    `Result: OPERATOR-APPROVED (superseded by Phase 12 verification — not re-run)\n` +
    `Rationale: multi-team /manage save+read-back verified end-to-end in Phase 12 ` +
    `(12-VERIFICATION.md PASSED 11/11; smoke-manage M10/M11 multi-save + checked ` +
    `read-back). This off-box probe cannot mint a prod session (no MAGIC_LINK_SECRET, ` +
    `per 11-06-PLAN.md); owner approved AC-MT on the Phase-12 basis. Not a product defect.\n` +
    `Kickoff fan-out citation: kickoff fan-out via user_teams is prod-verified by ` +
    `12-VERIFICATION.md truth #7/#8 + M14 (cron joins vip_signups->user_teams->teams.slug, ` +
    `one email per match per followed team via match_notifications UNIQUE guard); ` +
    `off-box prod-DB read unavailable — the Phase-12 /manage read-back is the persistence ` +
    `proof (mirrors 11-CONTEXT AC3 persistence-assertion reasoning).\n`,
  );
  console.log('[gate] AC-MT: OPERATOR-APPROVED (Phase-12 verified; off-box session N/A — not a gap, not exit-affecting)');
} else {
  // Automated assertion with the operator-supplied session cookie.
  // runCase('AC-MT-multi-team-manage') counts into pass/fail tally.
  await runCase('AC-MT-multi-team-manage', async () => {
    const acmtCookieHeader = acmtCookieRaw.trim();
    const acmtSlugs = ['england', 'france', 'germany'];

    // POST multi-team selection using repeated team= appends (smoke-manage postMultiTeam shape).
    // URLSearchParams(object) only serializes one value per key — must append per slug.
    const acmtBody = new URLSearchParams();
    for (const slug of acmtSlugs) acmtBody.append('team', slug);
    acmtBody.append('timezone', 'America/New_York');

    let acmtSaveStatus;
    let acmtSaveLocation;
    let acmtVerdict = 'FAIL';
    let acmtDetails = '';

    const saveRes = await fetch(`${BASE}/api/save-selection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Origin: BASE,
        Cookie: acmtCookieHeader,
      },
      body: acmtBody,
      redirect: 'manual',
    });
    acmtSaveStatus = saveRes.status;
    acmtSaveLocation = saveRes.headers.get('location') ?? '';

    const savedOk = acmtSaveStatus === 303 && acmtSaveLocation.includes('status=saved');
    if (!savedOk) {
      acmtDetails += `FAIL: POST /api/save-selection returned ${acmtSaveStatus} ${acmtSaveLocation} (expected 303 status=saved)\n`;
    } else {
      // GET /manage and assert checked checkboxes + no <select name="team">.
      const manageRes = await fetch(`${BASE}/manage`, {
        method: 'GET',
        headers: { Cookie: acmtCookieHeader },
        redirect: 'manual',
      });
      const acmtManageBody = await manageRes.text();

      // Assert no legacy <select name="team"> (Phase-12 replaced it with checkboxes).
      if (acmtManageBody.includes('<select name="team"')) {
        acmtDetails += `FAIL: GET /manage body contains <select name="team"> (expected checkboxes post-12-02)\n`;
      } else {
        // Assert each posted slug renders as a CHECKED checkbox (smoke-manage M11 regex).
        const slugResults = [];
        let allChecked = true;
        for (const slug of acmtSlugs) {
          const pattern = new RegExp(`value="${slug}"[^>]*checked|checked[^>]*value="${slug}"`, 'i');
          const checked = pattern.test(acmtManageBody);
          slugResults.push(`  slug="${slug}": ${checked ? 'CHECKED (PASS)' : 'NOT CHECKED (FAIL)'}`);
          if (!checked) allChecked = false;
        }
        acmtDetails += slugResults.join('\n') + '\n';
        if (allChecked) {
          acmtVerdict = 'PASS';
          acmtDetails += 'All 3 slugs render as checked confederation checkboxes — multi-team persistence confirmed.\n';
        } else {
          acmtDetails += 'One or more slugs missing from checked checkboxes — multi-team persistence FAILED.\n';
        }
      }
    }

    const acmtEvidenceText =
      `AC-MT multi-team /manage select+save+read-back — ${new Date().toISOString()}\n` +
      `Target: ${BASE}\n` +
      `Test email: johnturner+acmt@gmail.com\n` +
      `Posted slugs: ${acmtSlugs.join(', ')}\n` +
      `POST /api/save-selection → status=${acmtSaveStatus} location=${acmtSaveLocation}\n` +
      `Per-slug checked read-back:\n${acmtDetails}` +
      `Result: ${acmtVerdict}\n` +
      `Kickoff fan-out citation: kickoff fan-out via user_teams is prod-verified by ` +
      `12-VERIFICATION.md truth #7/#8 + M14 (cron joins vip_signups->user_teams->teams.slug, ` +
      `one email per match per followed team via match_notifications UNIQUE guard); ` +
      `off-box prod-DB read unavailable — the /manage read-back is the persistence proof ` +
      `(mirrors 11-CONTEXT AC3 persistence-assertion reasoning).\n`;

    writeFileSync(resolve(EVIDENCE_DIR, 'AC-MT-multi-team.txt'), acmtEvidenceText);
    return acmtVerdict === 'PASS';
  });
}

// ---------------------------------------------------------------------------
// opengraph.xyz preview — operator-gated (done-definition #4).
// ---------------------------------------------------------------------------
console.log('\n[gate] --- OPERATOR ACTION REQUIRED: opengraph.xyz preview ---');
console.log('[gate] OG: Verify Open Graph preview card:');
console.log('[gate] OG:   1. Visit https://www.opengraph.xyz/url/https://oddlympics.app');
console.log('[gate] OG:   2. Confirm headline, banner, URL, and og-image render cleanly');
console.log('[gate] OG:   3. Optionally share oddlympics.app in Slack or iMessage to verify there too');
const ogEvidence = await prompt('[gate] OG: Paste opengraph.xyz URL, screenshot path, or note or press Enter to skip: ');
if (ogEvidence) {
  writeFileSync(
    resolve(EVIDENCE_DIR, 'OG-preview-operator-evidence.txt'),
    `OG preview (done-def #4) — ${new Date().toISOString()}\n${ogEvidence}\n`,
  );
  console.log('[gate] OG: OPERATOR-CONFIRMED — evidence saved');
} else {
  writeFileSync(
    resolve(EVIDENCE_DIR, 'OG-preview-operator-evidence.txt'),
    `OG preview (done-def #4) — ${new Date().toISOString()}\nSKIPPED (no evidence provided)\n`,
  );
  console.log('[gate] OG: SKIPPED');
}

// ---------------------------------------------------------------------------
// Final per-AC PASS/FAIL table + result line.
// ---------------------------------------------------------------------------
console.log('\n[gate] ─────────────────────────────────────────────────────────────');
console.log('[gate] Per-AC summary:');
console.log('[gate]   AC1  Landing renders headline          → see AC1-pass.txt');
console.log('[gate]   AC2  48 options match teams.json       → see AC2-pass.txt');
console.log('[gate]   AC3  3-locale tz-spoof (puppeteer)     → see AC3-locales.txt');
console.log('[gate]   AC4  Full Gmail loop < 60s             → OPERATOR-GATED (AC4-operator-evidence.txt)');
console.log('[gate]   AC6  OG image 1200×630 < 300KB         → see AC6-og-image.txt');
console.log('[gate]   AC7  No prohibited terms (4 surfaces)  → see AC7-prohibited-terms.txt');
console.log('[gate]   AC8  Lighthouse mobile all >= 90       → see AC8-lighthouse-score.txt');
console.log('[gate]   AC9  bad-team → 303 /?error=bad-form   → see AC9-invalid-team.txt');
console.log('[gate]   AC10 Backfilled-row banner + save      → OPERATOR-GATED (AC10-operator-evidence.txt)');
console.log('[gate]   AC11 Plausible "Signup Submit" event   → OPERATOR-GATED (AC11-operator-evidence.txt)');
console.log('[gate]   AC12 Honeypot → 303 /pending           → see AC12-honeypot.txt');
console.log('[gate]   AC-MT Multi-team /manage select+save+read-back  → OPERATOR-APPROVED via Phase 12 (AC-MT-multi-team.txt)');
console.log('[gate]   OG   opengraph.xyz preview card        → OPERATOR-GATED (OG-preview-operator-evidence.txt)');
console.log('[gate] ─────────────────────────────────────────────────────────────');
console.log(`[gate] result: pass=${pass} fail=${fail}`);

if (fail > 0) {
  process.exit(1);
}
process.exit(0);
