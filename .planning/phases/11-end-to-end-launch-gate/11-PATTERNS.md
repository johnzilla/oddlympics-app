# Phase 11: End-to-end + Launch Gate — Pattern Map

**Mapped:** 2026-05-15
**Files analyzed:** 4 new/modified files
**Analogs found:** 4 / 4

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `scripts/launch-gate.mjs` | utility (multi-AC gate runner) | request-response + event-driven | `scripts/smoke-landing.mjs` + `scripts/smoke-signup.mjs` + `scripts/smoke-manage.mjs` | exact (same harness shape; extends to prod + puppeteer-core + AC table) |
| `scripts/cleanup-gate-rows.mjs` | utility (destructive DB delete) | CRUD | `scripts/launch-blast.mjs` + `scripts/backup-pre-05.mjs` | exact (dry-run-by-default + `--confirm` flag + better-sqlite3 + idempotent) |
| `src/pages/index.astro` | component (static page) | transform (CSS variable values only) | `src/pages/index.astro` itself (lines 260, 408) | self (one-line color value change in existing `:root`) |
| `package.json` | config (npm scripts) | — | `package.json` lines 6–17 (`smoke:confirm`, `smoke:landing`, `smoke:manage`, `og:render`) | exact (colon/kebab convention) |

---

## Pattern Assignments

### `scripts/launch-gate.mjs` (utility, request-response + browser-driven)

**Analogs:** `scripts/smoke-landing.mjs`, `scripts/smoke-signup.mjs`, `scripts/smoke-manage.mjs`

**Shebang + header comment block** (smoke-landing.mjs lines 1–43):
```javascript
#!/usr/bin/env node
// Phase 11 — launch-gate.mjs
// Consolidated AC1–AC12 gate runner against production https://oddlympics.app
// (SMOKE_BASE_URL override mirrors existing smoke-* convention).
//
// How to run:
//   node scripts/launch-gate.mjs
//   OR: npm run gate
//
//   Env (optional):
//     SMOKE_BASE_URL   default https://oddlympics.app
//     DATABASE_PATH    not used by this script (see cleanup-gate-rows.mjs)
//
// Exit codes:
//   0 = all automated ACs PASS
//   1 = any FAIL
//   2 = setup error (server unreachable)
```

**Env + state initialization** (smoke-signup.mjs lines 37–50; smoke-landing.mjs lines 44–51):
```javascript
const BASE = process.env.SMOKE_BASE_URL ?? 'https://oddlympics.app';
// Gate runner targets prod by default (inverted from smoke-* which default to localhost).
// Override for local pre-flight: SMOKE_BASE_URL=http://localhost:4321 node scripts/launch-gate.mjs

let pass = 0;
let fail = 0;
```

**runCase harness** (smoke-signup.mjs lines 55–69 / smoke-landing.mjs lines 58–72 — all four smokes use this verbatim):
```javascript
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
```

**Server reachability probe** (smoke-landing.mjs lines 91–102):
```javascript
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
```

**fetch with redirect:manual** (smoke-manage.mjs lines 179–191):
```javascript
async function get(path, headers = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'GET',
    headers,
    redirect: 'manual',
  });
  return {
    status: res.status,
    location: res.headers.get('location'),
    body: await res.text(),
  };
}
```

**HTML grep pattern for AC1** (smoke-landing.mjs lines 112–114):
```javascript
await runCase('AC1-landing-renders', () =>
  html.includes("Your team's matches. In your time zone. One ping before kickoff."));
```

**48-team count assertion pattern for AC2** (smoke-signup.mjs lines 116–144):
```javascript
await runCase('AC2-teams-json (48 entries, FORM-02 slugs verified)', () => {
  const teams = JSON.parse(
    readFileSync(resolve('./references/teams.json'), 'utf8'),
  );
  if (!Array.isArray(teams) || teams.length !== 48) return false;
  const slugs = new Set(teams.map((t) => t.slug));
  // ... slug presence checks ...
  return true;
});
```
For AC2 the gate runner must ALSO parse the live rendered `<select>` from `GET /` and assert exactly 48 `<option>` values matching `references/teams.json` slugs — the static JSON check alone is insufficient.

**LAND-02 prohibited-terms grep pattern for AC7** (smoke-landing.mjs lines 124–126; smoke-confirm-email.mjs lines 236–243):
```javascript
// Bracket char-classes keep the literal prohibited substrings out of THIS
// source file so the file itself passes the same grep (LAND-02 convention).
await runCase('AC7-prohibited-terms', () =>
  !/([b]itcoin|[l]ightning|[c]rypto|[w]orld domination|[p]ersonal olympics)/i.test(html));
```
AC7 must cover four surfaces: `/`, `/privacy`, `/terms`, `/manage` — extend the single-page pattern from smoke-landing by fetching each separately.

**POST form + redirect assertion for AC9/AC12** (smoke-signup.mjs lines 197–214, 261–278):
```javascript
// AC9 — bad team rejects with 303 /?error=bad-form, no row written
await runCase('AC9-invalid-team', async () => {
  const { status, location } = await post({
    email: `johnturner+ac9@gmail.com`,
    team: 'fake_team',
    timezone: 'America/New_York',
    requested_sport: 'world_cup',
    website: '',
  });
  return status === 303 && location === '/?error=bad-form';
  // No DB read needed — redirect contract alone is sufficient (CONTEXT D-04 / Claude's Discretion)
});

// AC12 — honeypot set → silent 303 /pending, no row
await runCase('AC12-honeypot', async () => {
  const { status, location } = await post({
    email: `johnturner+ac12@gmail.com`,
    team: 'england',
    timezone: 'America/New_York',
    requested_sport: 'world_cup',
    website: 'evil-bot',
  });
  return status === 303 && location === '/pending';
});
```

**AC6 OG image check** — no direct analog; pattern is a raw fetch:
```javascript
await runCase('AC6-og-image', async () => {
  const res = await fetch(`${BASE}/og-image.png`);
  if (res.status !== 200) return false;
  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('image/png')) return false;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length >= 300 * 1024) return false;
  // PNG dimensions: bytes 16–23 of the PNG header are width (4 bytes BE) + height (4 bytes BE)
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return width === 1200 && height === 630;
});
```

**AC3 + AC8 puppeteer-core invocation** — established by Phase 6 Plan 3 (06-03-SUMMARY.md lines 97–157):
- Install: `npx @puppeteer/browsers install chrome-headless-shell@stable` → `./chrome-headless-shell/` (already gitignored from Phase 6).
- Lighthouse: `CHROME_PATH=<binary> npx lighthouse <url> --preset=mobile --output=html --output-path=references/lighthouse-final.html --chrome-flags="--headless=new --no-sandbox --disable-dev-shm-usage" --quiet`
- Puppeteer tz-spoof (06-03-SUMMARY.md lines 113–123):
```javascript
// puppeteer-core loaded from a /tmp scratch or npx path — no project dep
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH, // set to chrome-headless-shell binary
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
await page.emulateTimezone('America/Detroit');
await page.goto(`${BASE}/`);
const tzLabel = await page.$eval('#tz-label', el => el.textContent);
const tzValue = await page.$eval('#timezone', el => el.value);
// assert tzLabel === 'Detroit time' && tzValue === 'America/Detroit'
```

**Operator-prompt pattern for manual ACs** — no exact codebase analog; follow this shape:
```javascript
console.log('\n[gate] --- OPERATOR ACTION REQUIRED ---');
console.log('[gate] AC4: Perform full Gmail sign-in loop (signup → confirm → manage → unsubscribe)');
console.log('[gate] AC4: Target email: johnturner+ac4@gmail.com');
console.log('[gate] AC4: Timing must be < 60s from submit to inbox. Record timestamp.');
console.log('[gate] Paste evidence path when done (or press enter to skip):');
// Use readline to capture pasted path and emit to evidence/ dir
```

**Result summary + exit** (smoke-signup.mjs lines 311–320):
```javascript
console.log(`[gate] result: pass=${pass} fail=${fail}`);
if (fail > 0) {
  process.exit(1);
}
process.exit(0);
```

**Evidence directory** — mirrors Phase 10 pattern (`.planning/phases/10-confirmation-email-update/evidence/`). Gate runner writes per-AC evidence to `.planning/phases/11-end-to-end-launch-gate/evidence/` — one file per AC (e.g. `AC1-pass.txt`, `AC8-lighthouse-score.txt`).

---

### `scripts/cleanup-gate-rows.mjs` (utility, destructive CRUD)

**Analogs:** `scripts/launch-blast.mjs`, `scripts/backup-pre-05.mjs`

**Shebang + dry-run-by-default header** (launch-blast.mjs lines 1–16):
```javascript
#!/usr/bin/env node
// Phase 11 — cleanup-gate-rows.mjs
// Deletes gate-test rows (D-04 +tag addresses) from vip_signups on the prod DB.
//
// SAFETY: defaults to dry-run. --confirm is required to actually delete.
//
//   node scripts/cleanup-gate-rows.mjs                    # dry-run, shows rows WOULD be deleted
//   node scripts/cleanup-gate-rows.mjs --confirm           # really delete
//
// Run AFTER the v1.0-consumer-landing tag is pushed (D-05 / D-07).
// Operator runs on the droplet: ssh oddlympics 'cd /opt/oddlympics && node scripts/cleanup-gate-rows.mjs --confirm'
// Env: DATABASE_PATH (default ./data/oddlympics.db)
```

**Args + dry-run flag** (launch-blast.mjs lines 31–33):
```javascript
const args = process.argv.slice(2);
const CONFIRM = args.includes('--confirm');
```

**better-sqlite3 open + env override** (smoke-signup.mjs lines 33–49; launch-blast.mjs lines 22–23; backup-pre-05.mjs lines 42–54):
```javascript
import Database from 'better-sqlite3';
import { resolve } from 'node:path';

const DB_PATH = resolve(process.env.DATABASE_PATH ?? './data/oddlympics.db');

const db = new Database(DB_PATH);
// cleanup-gate-rows.mjs opens writable (not readonly) since it deletes rows
```

**Idempotent SELECT before delete** (launch-blast.mjs lines 73–91):
```javascript
// D-04 pattern: +tag addresses all match LIKE '%+ac%@gmail.com'
const PATTERN = '%+ac%@gmail.com';
const rows = db
  .prepare('SELECT email, confirmed_at, created_at FROM vip_signups WHERE email LIKE ?')
  .all(PATTERN);

console.log(`[cleanup] mode=${CONFIRM ? 'DELETE' : 'dry-run'} rows=${rows.length}`);

if (rows.length === 0) {
  console.log('[cleanup] nothing to do (idempotent — re-run is a no-op).');
  db.close();
  process.exit(0);
}
```

**Dry-run output vs. execute** (launch-blast.mjs lines 94–100):
```javascript
if (!CONFIRM) {
  console.log('[cleanup] would delete:');
  for (const row of rows) console.log(`  - ${row.email}`);
  console.log('\n[cleanup] dry-run complete. Re-run with --confirm to actually delete.');
  db.close();
  process.exit(0);
}
```

**Prepared-statement delete** (smoke-manage.mjs lines 153–162 style):
```javascript
const del = db.prepare(
  'DELETE FROM vip_signups WHERE email LIKE ?',
);
const result = del.run(PATTERN);
console.log(`[cleanup] done. deleted=${result.changes}`);
db.close();
```

---

### `src/pages/index.astro` (component, CSS token change only)

**Analog:** `src/pages/index.astro` itself — the D-02 edit is a same-file two-value change.

**Current `:root` accent token** (index.astro line 260):
```css
--accent: #d94a1f;
```
Change to: `--accent: #b8350d;` (banner pill: 3.6:1 → ≥ 4.5:1 WCAG-AA)

**Current submit button focus-ring color** (index.astro line 408 — the only hardcoded hex outside `:root`):
```css
button[type="submit"]:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(217, 74, 31, 0.35);
}
```
This hardcoded hex (`217, 74, 31` = `#d94a1f` in RGB) must also be updated when the accent changes. But per D-02, the **submit button background** darkens to `#c43d15` independently (the focus-ring is a separate concern; planner should decide whether to update both or just `:root`).

**Where `--accent` is consumed for the submit button background** (index.astro lines 391–402):
```css
button[type="submit"] {
  /* ... */
  background: var(--accent);   /* ← This is the submit button color D-02 targets */
}
```

**The D-02 decision requires TWO distinct darkened values** (not one):
- Banner pill (`.banner`): `--accent` token changes `#d94a1f → #b8350d`
- Submit button: also uses `--accent`; D-02 says `→ #c43d15`
- Since both consume the same `--accent` var, the planner must decide: split into two tokens (`--accent-banner` / `--accent-btn`) OR pick one value that clears both. Per the CONTEXT D-02 literal ("banner pill `→ #b8350d`" and "submit button `→ #c43d15`"), two distinct values are intended — this requires introducing a second token or using `background: #c43d15` directly on the button rule.

**ASCII-apostrophe + no U+2019 constraint** (Phase 6 locked — do NOT introduce curly quotes):
```html
<!-- In text content, always: "Your team's matches" (U+0027 apostrophe) -->
<!-- NOT: "Your team’s matches" (U+2019 right single quotation mark) -->
```

**Phase 6 structure constraint** — color edit ONLY; do NOT touch:
- Markup structure (confirmed by 06-03-SUMMARY.md §"Self-Check" META-01 grepping)
- OG meta tag content (hardcoded `https://oddlympics.app` D-08)
- JavaScript block (Plausible listener, tz-label swap)
- Layout.astro refactor (standing v1.1 deferral)

---

### `package.json` (config, npm scripts)

**Analog:** `package.json` lines 6–17 (current scripts block)

**Current scripts convention** (package.json lines 13–17):
```json
"scripts": {
  "smoke:confirm": "node scripts/smoke-confirm-email.mjs",
  "smoke:landing": "node scripts/smoke-landing.mjs",
  "smoke:manage": "node scripts/smoke-manage.mjs",
  "check:land-02": "! grep -iE '[b]itcoin|[l]ightning|[c]rypto|[w]orld domination|[p]ersonal olympics' dist/client/index.html",
  "og:render": "node scripts/render-og-image.mjs"
}
```

**New alias to add** — planner pins exact name; Claude's Discretion says `gate` / `launch:gate` / `smoke:gate`. The established pattern is `<verb>:<noun>` for scripts with a side-effect target (`smoke:confirm`, `og:render`) or `<check>:<scope>` for assertions. The closest fit for the gate runner is `smoke:gate` (follows the `smoke:*` family) or `gate` (short, unambiguous). Either satisfies the convention; `smoke:gate` aligns with the `smoke:*` namespace:
```json
"smoke:gate": "node scripts/launch-gate.mjs"
```
And for cleanup:
```json
"cleanup:gate": "node scripts/cleanup-gate-rows.mjs"
```

---

## Shared Patterns

### Dry-run-by-default (destructive scripts)
**Source:** `scripts/launch-blast.mjs` lines 31–100
**Apply to:** `scripts/cleanup-gate-rows.mjs`
```javascript
const args = process.argv.slice(2);
const CONFIRM = args.includes('--confirm');
// ...
if (!CONFIRM) {
  console.log('[cleanup] would delete: ...');
  console.log('[cleanup] dry-run complete. Re-run with --confirm to actually delete.');
  process.exit(0);
}
```

### better-sqlite3 open pattern (scripts)
**Source:** `scripts/smoke-signup.mjs` lines 33–49; `scripts/backup-pre-05.mjs` lines 42–54
**Apply to:** `scripts/cleanup-gate-rows.mjs`
```javascript
import Database from 'better-sqlite3';
import { resolve } from 'node:path';
const DB_PATH = resolve(process.env.DATABASE_PATH ?? './data/oddlympics.db');
const db = new Database(DB_PATH);           // writable for cleanup
// OR:
const db = new Database(DB_PATH, { readonly: true });  // readonly for assertions
```

### runCase harness + exit codes 0/1/2
**Source:** `scripts/smoke-signup.mjs` lines 55–69; `scripts/smoke-landing.mjs` lines 58–72
**Apply to:** `scripts/launch-gate.mjs`
- Exit 0 = all automated ACs PASS
- Exit 1 = any FAIL
- Exit 2 = setup error (server unreachable, chrome-headless-shell missing)

### LAND-02 bracket-char-class grep
**Source:** `scripts/smoke-landing.mjs` line 126; `scripts/smoke-confirm-email.mjs` lines 236–243
**Apply to:** `scripts/launch-gate.mjs` (AC7 — extends to `/privacy`, `/terms`, `/manage`)
```javascript
!/([b]itcoin|[l]ightning|[c]rypto|[w]orld domination|[p]ersonal olympics)/i.test(html)
// Brackets keep literal prohibited substrings out of this source file
```

### RFC 5737 TEST-NET-1 X-Forwarded-For (smoke POST calls)
**Source:** `scripts/smoke-landing.mjs` lines 47–51; `scripts/smoke-signup.mjs` line 39
**Apply to:** `scripts/launch-gate.mjs` AC9/AC12 POST submissions
```javascript
// Use a fresh 192.0.2.x address not used by existing smokes:
// smoke-signup.mjs: 192.0.2.42; smoke-landing.mjs: 192.0.2.43
// Gate runner should use: 192.0.2.44
const GATE_IP = '192.0.2.44';
```

### Evidence artifact directory
**Source:** `.planning/phases/10-confirmation-email-update/evidence/` (3 PNG files; referenced in 10-SUMMARY.md lines 52–53)
**Apply to:** `scripts/launch-gate.mjs` output
- Write per-AC pass/fail artifacts to `.planning/phases/11-end-to-end-launch-gate/evidence/`
- `references/lighthouse-final.html` is the AC8 artifact (path is SC2 / done-def #5 — NOT under `.planning/`)

### chrome-headless-shell invocation (established Phase 6)
**Source:** `06-03-SUMMARY.md` lines 97–157 (key decisions section lines 181–182)
**Apply to:** `scripts/launch-gate.mjs` AC3 (tz spoof) + AC8 (lighthouse)
```bash
# One-time binary fetch (already gitignored in .gitignore as chrome-headless-shell/)
npx @puppeteer/browsers install chrome-headless-shell@stable

# AC8 — Lighthouse mobile → references/lighthouse-final.html
CHROME_PATH=./chrome-headless-shell/<platform>/chrome-headless-shell \
  npx lighthouse https://oddlympics.app \
  --preset=mobile \
  --output=html \
  --output-path=references/lighthouse-final.html \
  --chrome-flags="--headless=new --no-sandbox --disable-dev-shm-usage" \
  --quiet

# AC3 — puppeteer-core (loaded via npx/tmp; NOT a project dep)
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
await page.emulateTimezone('America/Detroit');
await page.goto(`${BASE}/`);
const tzLabel = await page.$eval('#tz-label', el => el.textContent);
const tzValue = await page.$eval('#timezone', el => el.value);
// assert: tzLabel === 'Detroit time' && tzValue === 'America/Detroit'
await browser.close();
```

### No new npm devDependencies
**Source:** 06-03-SUMMARY.md lines 181–182 (key decision — do NOT add lighthouse/puppeteer-core/browsers to package.json)
**Apply to:** `scripts/launch-gate.mjs` — use `npx` one-shot invocations only; CHROME_PATH set from the locally-installed binary in `chrome-headless-shell/`

---

## No Analog Found

All four files have analogs. No entries in this section.

---

## Metadata

**Analog search scope:** `scripts/`, `src/pages/`, `src/lib/`, `.planning/phases/06-*/`, `.planning/phases/10-*/`
**Files scanned:** 10 scripts + 1 Astro page + 1 config + 1 lib + 2 Phase summaries
**Pattern extraction date:** 2026-05-15
