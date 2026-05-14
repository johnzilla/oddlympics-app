# Phase 8: Open Graph image - Pattern Map

**Mapped:** 2026-05-14
**Files analyzed:** 6 (2 new scripts/config entries, 3 vendored fonts, 1 SVG edit, 1 new static asset)
**Analogs found:** 5 / 6 (font TTF files have no analog — binary assets, no code pattern needed)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `scripts/render-og-image.mjs` | utility (one-shot script) | file-I/O + transform | `scripts/smoke-landing.mjs` | role-match |
| `package.json` (devDep + script) | config | — | `package.json` itself (existing scripts/deps blocks) | exact |
| `public/og-image.png` | static asset | — | `public/favicon.svg` | exact |
| `references/fonts/JetBrainsMono-Bold.ttf` | reference artifact | — | `references/teams.json` | convention-match (no code pattern) |
| `references/fonts/Inter-Regular.ttf` | reference artifact | — | `references/teams.json` | convention-match (no code pattern) |
| `references/fonts/Inter-Bold.ttf` | reference artifact | — | `references/teams.json` | convention-match (no code pattern) |
| `references/og-image.svg` (mechanical edit) | reference artifact | — | `references/og-image.svg` itself | exact (in-place edit) |

---

## Pattern Assignments

### `scripts/render-og-image.mjs` (utility, file-I/O + transform)

**Primary analog:** `scripts/smoke-landing.mjs`
**Secondary analog:** `scripts/smoke-signup.mjs` (for `node:` import style and env reading)

---

**Header comment + shebang pattern** (`scripts/smoke-landing.mjs` lines 1–43):

```javascript
#!/usr/bin/env node
// Phase 6 — Plan 03.
// End-to-end smoke verification for the v2.0 consumer landing — asserts
// LAND-01, LAND-02, FORM-01, FORM-02, FORM-03, META-01, and ANLTC-01
// against a running dev/prod server. Mirrors the Phase 5 scripts/smoke-signup.mjs
// harness shape (shebang, header comment, runCase wrapper, env override,
// server reachability probe, exit codes) but replaces DB reads with
// HTML-string grep + a pair of POST /api/signup checks. Exits 0 only when
// all cases PASS.
//
// How to run:
//   Boot a server in another terminal:
//     npm run dev
//   ...
//
//   Env (optional):
//     SMOKE_BASE_URL   default http://localhost:4321
//
// Exit codes:
//   0 = all PASS
//   1 = any FAIL
//   2 = setup error (server unreachable)
```

The render script header must follow this shape: shebang line, single-line phase/plan reference, multi-sentence purpose sentence, "How to run" block with the exact `npm run og:render` invocation, exit codes, and (for this script) source URLs for re-vendoring fonts. The RESEARCH.md skeleton already matches this shape.

---

**`node:` import style** (`scripts/smoke-signup.mjs` lines 33–35):

```javascript
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
```

Key rules: `node:` prefix on all Node built-ins; named imports (not `* as fs`); third-party imports (no `node:` prefix) come first when mixed.

For `render-og-image.mjs` the import block should be:

```javascript
import { readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { Resvg } from '@resvg/resvg-js';
```

---

**Absolute path construction via `import.meta.url`** — the render script must resolve all paths against the repo root, not `process.cwd()`, to be safe when run from any directory. Pattern from RESEARCH.md (no existing project analog uses `import.meta.url`, but it is the correct ESM idiom for scripts):

```javascript
const root = new URL('..', import.meta.url).pathname;
const svgPath  = resolve(root, 'references/og-image.svg');
const outPath  = resolve(root, 'public/og-image.png');
const fontsDir = resolve(root, 'references/fonts');
```

---

**Pass/fail counter + console.error on failure + process.exit(1)** (`scripts/smoke-landing.mjs` lines 55–72, 230–238):

```javascript
let pass = 0;
let fail = 0;

async function runCase(name, fn) {
  try {
    const ok = await fn();
    if (ok) {
      console.log(`[smoke] PASS ${name}`);
      pass++;
    } else {
      console.error(`[smoke] FAIL ${name}`);
      fail++;
    }
  } catch (err) {
    console.error(`[smoke] FAIL ${name} (exception) ${err.message}`);
    fail++;
  }
}
// ...
console.log(`[smoke] result: pass=${pass} fail=${fail}`);
process.exit(fail === 0 ? 0 : 1);
```

The render script uses a simpler inline `check(label, ok)` helper (no async wrapper needed — all five D-05 checks are synchronous), but it MUST follow the same pattern: `console.log` on pass, `console.error` on fail, `process.exit(1)` when any check fails.

---

**`SMOKE_BASE_URL` env reading pattern** (`scripts/smoke-landing.mjs` line 44, `scripts/smoke-signup.mjs` lines 37–38):

```javascript
// smoke-landing.mjs
const BASE = process.env.SMOKE_BASE_URL ?? 'http://localhost:4321';

// smoke-signup.mjs
const BASE    = process.env.SMOKE_BASE_URL ?? 'http://localhost:4321';
const DB_PATH = resolve(process.env.DATABASE_PATH ?? './data/oddlympics.db');
```

The render script does not need env overrides (paths are always relative to `import.meta.url`), but if the executor wants to add any, `process.env.X ?? 'default'` is the pattern. No `dotenv` or `.env` loading in scripts — they rely on the shell environment.

---

### `package.json` — devDependencies + scripts block

**Analog:** `package.json` itself (lines 1–22).

**Full current file** (`package.json` lines 1–22):

```json
{
  "name": "oddlympics-app",
  "type": "module",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "astro dev",
    "start": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "serve": "node --env-file=.env ./dist/server/entry.mjs",
    "astro": "astro",
    "smoke:landing": "node scripts/smoke-landing.mjs",
    "check:land-02": "! grep -iE '[b]itcoin|[l]ightning|[c]rypto|[w]orld domination|[p]ersonal olympics' dist/client/index.html"
  },
  "dependencies": {
    "@astrojs/node": "^9.5.5",
    "astro": "^5.0.0",
    "better-sqlite3": "^12.9.0",
    "resend": "^6.12.2"
  }
}
```

**Executor must add:**

1. A `"devDependencies"` block after `"dependencies"` (there is none yet):
   ```json
   "devDependencies": {
     "@resvg/resvg-js": "2.6.2"
   }
   ```
   Pin to exact version `2.6.2` (not `^2.6.2`) — the RESEARCH.md confirms this is the last stable version with the resvg 0.34.0 snapshot; a semver bump to 2.7.x (alpha, variable-font support) could change render output.

2. An `"og:render"` entry in the `"scripts"` block, inserted alphabetically after `"check:land-02"` and before `"preview"` (script naming style: short colon-namespaced kebab, matching `smoke:landing` and `check:land-02`):
   ```json
   "og:render": "node scripts/render-og-image.mjs",
   ```

There is no `devDependencies` block in the current file — the executor is creating it for the first time. No alphabetical requirement has been established for devDeps (there is only one entry). For the scripts block, `og:render` sits naturally between `check:land-02` and `preview` alphabetically.

---

### `public/og-image.png` (static asset)

**Analog:** `public/favicon.svg`

**Directory listing** (`public/`):

```
total 8
drwxr-xr-x@  3 john  staff   96 May  1 20:53 .
drwxr-xr-x@ 29 john  staff  928 May 13 20:42 ..
-rw-r--r--   1 john  staff  337 May  1 20:53 favicon.svg
```

`public/` currently contains only `favicon.svg`. Astro copies everything in `public/` verbatim to `dist/client/` at `astro build` time. The `@astrojs/node` standalone adapter then serves `dist/client/og-image.png` at the URL path `/og-image.png` with `Content-Type: image/png` (extension-based MIME detection). No `prerender` directive, no API route, no SSR involvement. This is confirmed by RESEARCH.md and `08-CONTEXT.md §Integration Points`.

The executor commits `public/og-image.png` as a checked-in artifact. No further config changes needed for Astro to serve it.

---

### `references/fonts/JetBrainsMono-Bold.ttf`, `Inter-Regular.ttf`, `Inter-Bold.ttf` (vendored reference artifacts)

**Analog:** `references/teams.json`, `references/og-image.svg`, `references/terms.md`, `references/privacy.md`

**Directory listing** (`references/`):

```
total 4392
drwxr-xr-x@ 13 john  staff     416 May 13 21:29 .
-rw-r--r--@  1 john  staff    3929 May 13 17:40 og-image.svg
-rw-r--r--@  1 john  staff    1115 May 13 21:29 privacy.md
-rw-r--r--@  1 john  staff    3482 May 12 22:04 teams.json
-rw-r--r--@  1 john  staff     879 May 13 21:29 terms.md
```

The `references/` directory is the established location for committed source-of-truth files that are render-time inputs or source assets — not served directly, not built by Astro, not checked at CI. Font TTFs follow the same convention: downloaded once, committed, referenced by `render-og-image.mjs` at render time only. They are never in `public/` (they are not served assets) and never in `src/` (they are not TypeScript/Astro modules).

The executor creates `references/fonts/` as a new subdirectory. No existing `fonts/` subdirectory exists yet.

Download sources (from RESEARCH.md Standard Stack section — include these as comments in the render script header, NOT in any README):

```
JetBrainsMono-Bold.ttf  (267 KB, SIL OFL 1.1):
  https://github.com/JetBrains/JetBrainsMono/raw/master/fonts/ttf/JetBrainsMono-Bold.ttf

Inter-Regular.ttf  (317 KB, SIL OFL 1.1):
  https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf

Inter-Bold.ttf  (318 KB, SIL OFL 1.1):
  https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZg.ttf
```

**Critical:** Do NOT use `JetBrainsMono[wght].ttf` (variable) or `InterVariable.ttf` (rsms.me). See RESEARCH.md §Font Handling and §Anti-Patterns for the full explanation. The static-weight files above are the only correct choices for resvg-js 2.6.2.

---

### `references/og-image.svg` (mechanical font-family attribute swap)

**Analog:** In-place edit of the existing file. No structural change — only the three `font-family` attribute values change.

**Full current SVG** (`references/og-image.svg` lines 1–76):

The executor needs exact old strings for the Edit-tool swap. Here are the three elements with `font-family` attributes and their current values:

**Line 22** — wordmark `<text>` inside `<g transform="translate(72, 78)">`:
```
font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
```
Swap to: `font-family="JetBrains Mono"`

**Line 28** — banner pill `<text>` inside `<g transform="translate(72, 168)">`:
```
font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
```
Swap to: `font-family="JetBrains Mono"`

**Line 32** — headline `<g>` group open tag (the `font-family` is on the `<g>`, applying to all three `<text>` children):
```xml
<g transform="translate(72, 252)" font-family="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" fill="#14151a">
```
Swap `font-family` value to: `Inter`

**Line 40** — sub-line `<text>` inside `<g transform="translate(72, 488)">`:
```
font-family="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
```
Swap to: `font-family="Inter"`

**Line 44** — URL `<text>` inside `<g transform="translate(72, 550)">`:
```
font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
```
Swap to: `font-family="JetBrains Mono"`

**Line 74** — bottom-right tag `<text>` inside `<g transform="translate(1042, 588)">`:
```
font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
```
Swap to: `font-family="JetBrains Mono"`

Total: 6 attribute values changed — 4 instances of the monospace stack → `JetBrains Mono`, 2 instances of the sans-serif stack → `Inter` (one long stack on the `<g>` element at line 32, one shorter stack on the sub-line `<text>` at line 40).

**No other changes to `references/og-image.svg`.** D-04 is absolute: byte-for-byte except the six `font-family` value swaps above.

The two distinct old strings to replace (use these as literal `old_string` values in Edit-tool calls):

```
old_string_1: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace
new_string_1: JetBrains Mono

old_string_2: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif
new_string_2: Inter

old_string_3: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif
new_string_3: Inter
```

The monospace stack appears 4 times in the SVG (lines 22, 28, 44, 74 — confirmed by reading the full file). All 4 must be swapped. If the Edit tool replaces only the first occurrence, the executor must run 4 separate Edit-tool calls or use a global replace. The sans-serif stacks each appear once.

---

## Shared Patterns

### `node:` built-in prefix
**Source:** `scripts/smoke-signup.mjs` lines 33–35
**Apply to:** `scripts/render-og-image.mjs`

All Node built-in imports must use the `node:` prefix: `node:fs`, `node:path`, `node:child_process`. No exceptions. This is a hard project convention from CLAUDE.md §Conventions.

---

### Console output tagging
**Source:** `scripts/smoke-landing.mjs` lines 53, 62, 65, 69
**Apply to:** `scripts/render-og-image.mjs`

All `console.log` / `console.error` calls in scripts are prefixed with a bracketed tag matching the npm script name:

```javascript
// smoke-landing.mjs uses:
console.log(`[smoke] target: ${BASE}`);
console.log(`[smoke] PASS ${name}`);
console.error(`[smoke] FAIL ${name}`);
```

The render script must use `[og:render]` for the render log line and `[og:verify]` for the five check lines — matching the RESEARCH.md skeleton exactly.

---

### `process.exit(fail === 0 ? 0 : 1)` terminal pattern
**Source:** `scripts/smoke-landing.mjs` line 238, `scripts/smoke-signup.mjs` line 320
**Apply to:** `scripts/render-og-image.mjs`

```javascript
process.exit(fail === 0 ? 0 : 1);
```

Both existing scripts use this identical ternary. The render script uses `process.exit(1)` directly when `fail > 0` (equivalent; either form is acceptable).

---

### ESM module shape (`"type": "module"`)
**Source:** `package.json` line 2
**Apply to:** `scripts/render-og-image.mjs` (all scripts)

`"type": "module"` in `package.json` means `.mjs` files (and all `.js` files in this repo) are ESM by default. Scripts use top-level `await` freely (Node 22 supports it). No `require()`, no CommonJS wrapper.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `references/fonts/*.ttf` (3 files) | vendored binary artifact | — | Binary files have no code pattern. The `references/` directory convention applies (confirmed by `ls`); download URLs are in RESEARCH.md Standard Stack. |

---

## Metadata

**Analog search scope:** `scripts/`, `public/`, `references/`, `package.json`
**Files read:** `scripts/smoke-landing.mjs` (239 lines), `scripts/smoke-signup.mjs` (321 lines), `references/og-image.svg` (76 lines), `package.json` (22 lines), `ls public/`, `ls references/`
**Pattern extraction date:** 2026-05-14

---

## PATTERN MAPPING COMPLETE
