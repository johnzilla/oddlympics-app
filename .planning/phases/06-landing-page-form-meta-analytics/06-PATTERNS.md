# Phase 6: Landing page + form + meta + analytics — Pattern Map

**Mapped:** 2026-05-13
**Files analyzed:** 2 (1 modified, 1 net-new)
**Analogs found:** 2 / 2 (both exact role + data flow match)

## Scope of this phase

Phase 6 is a **frontend-only rewrite of a single existing file** (`src/pages/index.astro`) plus **one optional new evidence script** (`scripts/smoke-landing.mjs`). No backend, schema, CSP, or sibling-page changes — all wired in Phase 5. The closest analog for the rewrite is *the file being rewritten*; the closest analog for the smoke script is the Phase 5 smoke script.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/pages/index.astro` (rewrite) | page (Astro prerendered static page) | request-response (browser GET; client-side URL-param swap; form POST → 303 → `/pending`) | `src/pages/index.astro` (current file — prior version of itself) | exact (it IS the analog) |
| `scripts/smoke-landing.mjs` (new, optional per RESEARCH §"Wave 0 Gaps") | test (curl-based evidence script) | request-response (Node `fetch` against running dev server; HTML-string assertions) | `scripts/smoke-signup.mjs` | exact role (smoke), partial data flow (this one parses HTML body instead of inspecting SQLite rows) |

**Secondary analog for `index.astro` (URL-param swap convention):** `src/pages/pending.astro:28-54` — multi-key COPY map driven by `?action=…` + `?email=…`. Demonstrates that the same inline-script pattern scales to multiple swapped DOM nodes; useful precedent if the executor splits the Phase 6 inline JS into one block per concern.

---

## Pattern Assignments

### `src/pages/index.astro` (page, request-response)

**Analog:** `src/pages/index.astro` (the file being rewritten — read end-to-end at the file root above). This is unusual but correct: Phase 6 is an in-place rewrite, so the prior version IS the closest pattern source. Reuse the *structural shell* verbatim; rewrite only the content + the style values.

#### Pattern 1 — Frontmatter + `prerender = true` (lines 1-5)

Current:
```astro
---
export const prerender = true;
const title = 'oddlympics — World domination. Your world.';
const description = 'Your personal Olympics, translated to your time zone. Personal World Cup 2026 notifications and more, on Bitcoin/Lightning rails.';
---
```

**MUST preserve:**
- `export const prerender = true;` (CLAUDE.md §"Architecture worth understanding" — keeps the page CDN-cacheable; LAND-03 Lighthouse Performance budget depends on it).

**MUST change (LAND-02 prohibited terms in both `title` and `description`):**
- All copy strings — replace per UI-SPEC §"Meta tags" and §"Copywriting Contract".
- Add a JSON build-time import: `import teams from '../../references/teams.json' with { type: 'json' };` — the syntax is already validated at `src/lib/teams.ts:1` (Node 22 ESM import-attributes).
- Add `CONFEDERATION_ORDER` const tuple + `CONFEDERATION_LABEL` record + a derived `groupedTeams` array (RESEARCH §"Code Examples" → Frontmatter — Build-Time JSON Import + Grouping).

**MAY change:**
- Hoist all meta-tag strings (`TITLE`, `DESCRIPTION`, `OG_TITLE`, `OG_DESCRIPTION`, `TWITTER_DESCRIPTION`, `SITE_URL`, `OG_IMAGE`) as named consts for readability. UI-SPEC §"Meta tags" lists exact strings; CONTEXT D-08 mandates hardcoded `https://oddlympics.app/*` URLs (do NOT derive from `Astro.site`).

#### Pattern 2 — `<head>` shell (lines 7-25)

Current:
```astro
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="description" content={description} />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <title>{title}</title>
  <!-- Privacy-friendly analytics by Plausible -->
  <script async src="https://plausible.io/js/pa-wRAab3seDWDDBnGbRbe0K.js"></script>
  <script is:inline>
    window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};
    plausible.init()
  </script>
</head>
```

**MUST preserve:**
- `<!doctype html>` + `<html lang="en">` shell (LAND-03 SEO audit requires `lang`).
- `<meta charset>` + `<meta name="viewport">` (Lighthouse mandatory).
- `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />`.
- `<script async src="https://plausible.io/js/pa-wRAab3seDWDDBnGbRbe0K.js"></script>` — line 20, verbatim. The hashed filename is the project's existing pa-script identity; do not regenerate.
- The 2-line Plausible global shim at lines 21-24 — keep verbatim (CONTEXT discretion notes considered dropping it; UI-SPEC explicitly keeps it for consistency across all 6 pages).

**MUST add (META-01, UI-SPEC §"Meta tags"):**
- `<meta property="og:url" content="https://oddlympics.app" />`
- `<meta property="og:site_name" content="Oddlympics" />`
- `<meta property="og:image" content="https://oddlympics.app/og-image.png" />` + `og:image:width=1200`, `og:image:height=630`, `og:image:alt` lines.
- `<meta name="twitter:title">` + `<meta name="twitter:description">` + `<meta name="twitter:image">` (currently only `twitter:card` is present).

**MUST change:**
- Replace `title` / `description` const values (line 3-4) with the UI-SPEC-locked strings.

#### Pattern 3 — Form HTML with hidden inputs and honeypot (lines 33-53)

Current:
```astro
<form class="cta-form" method="post" action="/api/signup">
  <input
    type="email"
    name="email"
    required
    autocomplete="email"
    placeholder="you@example.com"
    aria-label="Email address"
  />
  <input type="hidden" name="requested_sport" value="world_cup" />
  {/* honeypot — humans don't fill this */}
  <input
    type="text"
    name="website"
    tabindex="-1"
    autocomplete="off"
    class="hp"
    aria-hidden="true"
  />
  <button type="submit">Get early access</button>
</form>
```

**MUST preserve (FORM-01, FORM-03, COMPAT-02):**
- `<form method="post" action="/api/signup">` — exact method + action. `/api/signup` validates Origin and rejects cross-site POSTs (`src/pages/api/signup.ts:20-36`).
- `<input type="email" name="email" required autocomplete="email">` — name + required + autocomplete.
- `<input type="hidden" name="requested_sport" value="world_cup" />` — line 42, retained per FORM-01.
- The honeypot `<input type="text" name="website" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true" />` — exact attribute set (lines 43-51). Bots fill `website`; `/api/signup:58-61` short-circuits and returns 303 → `/pending` (no row). The `.hp` CSS class moves it off-screen.
- `<button type="submit">` — explicit `type="submit"` (avoids default-form-submit re-render flicker per RESEARCH Lighthouse Performance checklist).

**MUST add (FORM-01, FORM-02):**
- `id="signup-form"` on the `<form>` so the inline Plausible submit listener can `getElementById`.
- A `<label for="team">Your team</label>` + `<select name="team" id="team" required>` block with:
  - One placeholder `<option value="" disabled selected>Pick your team</option>`.
  - Six `<optgroup label="…">` blocks rendered via `groupedTeams.map(…)` over the JSON-imported `teams`. Confederation order UEFA → CONMEBOL → CONCACAF → CAF → AFC → OFC; respect insertion order inside each group; full `<optgroup>` labels per UI-SPEC §"Copywriting Contract" (e.g., `UEFA — Europe`).
- A `<label for="email">Email</label>` (replaces `aria-label="Email address"` — UI-SPEC mandates a visible `<label>` for LAND-03 Accessibility).
- A hidden `<input type="hidden" name="timezone" id="timezone" value="" />` — populated client-side by the inline tz script (D-04).
- A `<p id="error" class="error" role="alert" hidden></p>` block — current file has this at line 55 OUTSIDE the form; move INSIDE the form (UI-SPEC §"Interaction Contracts → Error message rendering").

**MUST change:**
- Submit button label `Get early access` → `Get match alerts` (UI-SPEC §"Copywriting Contract").
- The `.cta-form` class to whatever layout class the new design uses (CSS values discretionary per UI-SPEC §"Visual Hierarchy").

#### Pattern 4 — Inline `<script is:inline>` URL-param swap (lines 65-82)

Current — **THE canonical pattern** (CLAUDE.md §"Static page → URL params"):
```html
<script is:inline>
  try {
    const COPY = {
      'bad-email': 'That email looks off — try again.',
      'bad-form': 'Something went wrong with the form. Try again.',
      'bad-origin': 'Submission blocked. Please use the form on this page.',
      'rate-limited': 'Too many tries. Wait an hour and try again.',
      email: "We couldn't send the confirmation email. Try again in a minute.",
      server: 'Server hiccup. Try again in a minute.',
    };
    const code = new URL(location.href).searchParams.get('error');
    if (code) {
      const el = document.getElementById('error');
      el.textContent = COPY[code] || 'Something went wrong.';
      el.hidden = false;
    }
  } catch {}
</script>
```

**MUST preserve (FORM-03, COMPAT-02):**
- The entire COPY map, key for key, string for string — six error codes plus the `'Something went wrong.'` default. These are the exact strings that `/api/signup`'s `back()` helper at `src/pages/api/signup.ts:38-43` emits via `?error=<code>`. The grader at COPY[code] uses `textContent` (NOT `innerHTML`) — keeps the path XSS-safe even if a malicious `?error=` value lands.
- The `try { … } catch {}` wrapper — silently swallows exceptions on ancient browsers without `URL` or `searchParams`.
- The lookup pattern `COPY[code] || 'Something went wrong.'`.

**MUST extend (D-04, D-09):**
- Add a tz-label swap block (RESEARCH §"Pattern 3 — Inline JS Tz-Label Swap"):
  ```js
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const tzInput = document.getElementById('timezone');
    if (tzInput) tzInput.value = tz;
    if (tz && tz.indexOf('/') !== -1 && tz.indexOf('Etc/') !== 0) {
      const label = tz.split('/').pop().replace(/_/g, ' ') + ' time';
      if (label && label !== ' time') {
        const el = document.getElementById('tz-label');
        if (el) el.textContent = label;
      }
    }
  } catch {}
  ```
- Add a Plausible submit-listener block (RESEARCH §"Pattern 4"):
  ```js
  try {
    const form = document.getElementById('signup-form');
    if (form) {
      form.addEventListener('submit', function () {
        const team = (form.team && form.team.value) || '';
        if (!team) return;  // D-11 empty-team guard
        try { window.plausible('Signup Submit', { props: { team: team } }); } catch {}
        const h = location.hostname;
        if (h === 'localhost' || h === '127.0.0.1') {
          console.log('[plausible] Signup Submit', { team: team });
        }
      });
    }
  } catch {}
  ```
  The `console.log('[plausible] …')` tag mirrors `src/lib/email.ts`'s `[email-dev-fallback]` precedent (CONTEXT D-12 / RESEARCH §"Reusable Assets").

**MAY change (executor discretion per CONTEXT):**
- Combine all three responsibilities into one `<script is:inline>` block (recommended in RESEARCH §"Combined Inline Script"); or keep three separate blocks. Either works under the existing CSP `'unsafe-inline'`.
- DOM position: place the script AFTER the form in source order so `#tz-label`, `#timezone`, `#signup-form`, and `#error` all exist when the script runs (RESEARCH §"Anti-Patterns to Avoid").

#### Pattern 5 — `<style is:global>` inline CSS block (lines 88-254)

Current — large single `<style is:global>` block with `:root` variables (lines 89-102), reset (104), html/body baseline (106-115), section-specific selectors, mobile `@media (max-width: 520px)` (lines 243-248), and `@media (prefers-reduced-motion: reduce)` (250-253).

**MUST preserve (CLAUDE.md §"Conventions"):**
- The `<style is:global>` mechanism — one block per page; no shared stylesheet; no `Layout.astro` (deferred to v1.1).
- `:root` CSS-variable convention. UI-SPEC §"Color" reuses the exact token names: `--bg`, `--fg`, `--fg-dim`, `--line`, `--surface`, `--accent`, `--accent-ink`. Adds `--accent-soft`, `--line-strong`, `--font-sans`, `--font-mono`, `--max`, `--pad-x`.
- `* { box-sizing: border-box; }` reset (line 104).
- Honeypot CSS class `.hp` at lines 233-240 — keep verbatim (`position: absolute; left: -10000px; width: 1px; height: 1px; opacity: 0; pointer-events: none`). Anti-pattern alert (RESEARCH §"Anti-Patterns"): do NOT switch to `display: none` — bots that parse CSS skip the field, defeating the honeypot.
- Mobile breakpoint `@media (max-width: 520px)` — UI-SPEC §"Spacing Scale" locks this exact value.
- Reduced-motion block at lines 250-253 — keep the pattern (`@media (prefers-reduced-motion: reduce) { … }`); UI-SPEC §"Interaction Contracts → Focus rings" adds an entry for `details summary::after` transition.

**MUST change (UI-SPEC-locked retune; first sans-serif page in the project):**
- All `:root` variable VALUES — see UI-SPEC §"Color" for the new palette (`#fafaf7` bg, `#14151a` fg, `#5a5d68` fg-dim, `#d94a1f` accent, `#fbe9e0` accent-soft, etc.). Variable NAMES stay; values flip from dark-mono to light-sans-serif.
- Add `--font-sans` token (UI-SPEC §"Typography" — `ui-sans-serif, system-ui, -apple-system, …`).
- Rename usage: `font-family: var(--mono)` → `font-family: var(--font-sans)` for body / headings / form / prose. Mono (`--font-mono`) is now scoped to micro-accents only (banner pill, step numerals, footer copyright per UI-SPEC §"Typography").
- Typography scale: exactly 4 sizes (`clamp(28px, 5vw, 40px)` / 17 / 15 / 13) and exactly 2 weights (400, 700). UI-SPEC §"Typography" is authoritative.
- All section-specific selectors (`.hero`, `.banner`, `.headline`, `.subhead`, `.cta-form`) — rebuild against the new UI-SPEC layout. The current 720px container max-width is preserved (`--max: 720px`) per UI-SPEC §"Spacing Scale".

**MUST scrub (LAND-02):**
- No CSS variable name containing `bitcoin`, `lightning`, `crypto` (RESEARCH §"Anti-Patterns"). `--accent` is safe.
- No inline comments referencing the prohibited terms.

#### Pattern 6 — Out-of-frontmatter body structure

Beyond the four blocks above, Phase 6 introduces NEW DOM structure not present in the current `index.astro`: 4 below-fold sections (How it works / Why this exists / After the World Cup / Common questions) + consumer footer + `<details>`/`<summary>` FAQ accordions. **There is no in-codebase analog for these sections.** Use:
- `references/index.html` as the structural reference (NOT a literal port — CONTEXT D-02).
- `references/oddlympics_landing_copy.md` as the verbatim copy source.
- UI-SPEC §"Copywriting Contract" tables for exact strings.
- UI-SPEC §"Interaction Contracts → FAQ accordion behavior" for the native `<details>` pattern (no JS).

---

### `scripts/smoke-landing.mjs` (test, request-response)

**Analog:** `scripts/smoke-signup.mjs` (Phase 5, 320 lines, exits 0 on all-PASS).

**Note:** This script is **optional** per RESEARCH §"Wave 0 Gaps" — the planner should call it out as a defensive evidence script (~50 LOC) but the phase passes without it if AC1/META-01 are verified manually. If the planner includes it, follow this pattern.

#### Pattern 1 — Script shebang + header comment (lines 1-31)

Current:
```js
#!/usr/bin/env node
// Phase 5 — Plan 06.
// End-to-end smoke verification for POST /api/signup. Drives the 7 cases from
// MILESTONE-consumer-landing.md Phase 1 + an AC2 static assertion against
// references/teams.json. Exits 0 only when all 8 PASS.
//
// How to run:
//   Boot a dev server in another terminal:
//     npm run dev
//   …
// Exit codes:
//   0 = all PASS
//   1 = any FAIL
//   2 = setup error (server unreachable, DB unreadable)
//
// Evidence tags surfaced in the output:
//   [smoke] PASS AC2-teams-json    -- 48 entries + FORM-02 explicit slugs
//   …
```

**Reuse:** Header comment structure (phase header, run instructions, env vars, exit codes, evidence tags). Phase 6 evidence tags would be e.g. `LAND-01-headline`, `LAND-02-prohibited-terms`, `FORM-02-optgroup-count`, `META-01-meta-tags`.

#### Pattern 2 — Imports + base URL env override (lines 33-50)

Current:
```js
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.env.SMOKE_BASE_URL ?? 'http://localhost:4321';
const DB_PATH = resolve(process.env.DATABASE_PATH ?? './data/oddlympics.db');
const SMOKE_IP = '192.0.2.42'; // RFC 5737 TEST-NET-1; never a real client IP

console.log(`[smoke] target: ${BASE}`);
console.log(`[smoke] db:     ${DB_PATH}`);
```

**Reuse:** `SMOKE_BASE_URL` env override pattern. `[smoke]` log tag prefix. `node:` prefix on built-ins (CONVENTIONS.md §TypeScript).
**Drop:** SQLite imports — Phase 6 smoke is HTML-string assertions; no DB read needed.

#### Pattern 3 — `runCase` wrapper with pass/fail counters (lines 52-69)

Current:
```js
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
```

**Reuse verbatim.** This is the canonical evidence-script harness for the project.

#### Pattern 4 — Server reachability probe (lines 102-113)

Current:
```js
try {
  const res = await fetch(`${BASE}/`, { method: 'GET' });
  if (res.status >= 500) {
    console.error(`[smoke] FAIL: ${BASE}/ returned ${res.status}`);
    process.exit(2);
  }
} catch (err) {
  console.error(`[smoke] FAIL: cannot reach ${BASE} — is the dev server running? (${err.message})`);
  process.exit(2);
}
```

**Reuse verbatim.** Exit-code-2 for setup failure is the project's evidence-script convention.

#### Pattern 5 — HTTP-driven test case (lines 71-85 + 147-176 example)

Current `post()` helper:
```js
async function post(form, extraHeaders = {}) {
  const body = new URLSearchParams(form);
  const res = await fetch(`${BASE}/api/signup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Origin: BASE,
      'X-Forwarded-For': SMOKE_IP,
      ...extraHeaders,
    },
    body,
    redirect: 'manual',
  });
  return { status: res.status, location: res.headers.get('location') };
}
```

**Adapt for Phase 6:** Phase 6's smoke is GET `/` + body grep, not POST. Pattern shape (manual `fetch`, return shape `{ status, body }`, headers object) is the analog. Example new helper:
```js
async function getHtml(path) {
  const res = await fetch(`${BASE}${path}`);
  const body = await res.text();
  return { status: res.status, body };
}
```

#### Pattern 6 — Exit-code wiring (lines 311-320)

Current:
```js
console.log(`[smoke] result: pass=${pass} fail=${fail}`);
db.close();

if (fail > 0) {
  console.log("[smoke] cleanup: sqlite3 …");
}

process.exit(fail === 0 ? 0 : 1);
```

**Reuse:** `process.exit(fail === 0 ? 0 : 1)`. **Drop:** `db.close()` (no DB). **Drop:** cleanup hint (Phase 6 has no DB side effects).

#### Cases Phase 6 should cover (RESEARCH §"Phase Requirements → Test Map")

- `LAND-01-headline` — body contains `"Your team's matches"` (apostrophe variant matters — use literal from copy doc).
- `LAND-02-prohibited-terms` — `/^(.|\n)*(bitcoin|lightning|crypto|world domination|personal olympics)/i.test(body)` is `false`. Case-insensitive. (Same gate Phase 11 AC7 runs against prod.)
- `FORM-02-optgroup-count` — body contains exactly 6 `<optgroup` substrings AND ≥ 49 `<option value="` substrings (48 teams + placeholder).
- `FORM-02-confederation-order` — first occurrence of `UEFA` is before first occurrence of `CONMEBOL` is before `CONCACAF` is before `CAF` is before `AFC` is before `OFC`.
- `META-01-meta-tags` — body contains each of: `<title>Oddlympics — World Cup 2026 alerts in your time zone</title>`, `og:title`, `og:description`, `og:type" content="website"`, `og:url" content="https://oddlympics.app"`, `og:site_name" content="Oddlympics"`, `og:image" content="https://oddlympics.app/og-image.png"`, `twitter:card" content="summary_large_image"`, `twitter:title`, `twitter:description`, `twitter:image`.

---

## Shared Patterns

### Pattern S1 — `prerender = true` for cacheable static pages

**Source:** `src/pages/index.astro:2`, `src/pages/pending.astro:2`, `src/pages/confirmed.astro:2`, `src/pages/unsubscribed.astro:2`.

**Apply to:** `src/pages/index.astro` (Phase 6 rewrite). MUST stay `true`. RESEARCH §"Tier-misassignment risks" — making this `false` would lose Lighthouse Performance + cacheability and break LAND-03.

### Pattern S2 — Inline `<script is:inline>` reads URL params on a prerendered page

**Source:** `src/pages/index.astro:65-82` (current — `?error=`), `src/pages/pending.astro:28-54` (`?action=` + `?email=`).

**Apply to:** Phase 6 `index.astro` — three responsibilities (tz-label swap, `?error=` swap, Plausible submit listener). Combine into one or split into three at executor discretion. Position AFTER the form so DOM elements exist when the script runs.

**Excerpt** (current `?error=` swap — must be preserved verbatim per FORM-03):
```html
<script is:inline>
  try {
    const COPY = { 'bad-email': 'That email looks off — try again.', /* … */ };
    const code = new URL(location.href).searchParams.get('error');
    if (code) {
      const el = document.getElementById('error');
      el.textContent = COPY[code] || 'Something went wrong.';
      el.hidden = false;
    }
  } catch {}
</script>
```

**Why `textContent` not `innerHTML`:** RESEARCH §"Security Domain" — `textContent` does not parse HTML, so injected `?error=…` cannot XSS. Lookup-table COPY map adds defense in depth.

### Pattern S3 — `<style is:global>` inline CSS per page, no Layout.astro

**Source:** `src/pages/index.astro:88-254`, `src/pages/pending.astro:63-82`, also present in `confirmed.astro`, `unsubscribed.astro`, `manage.astro`, `schedule.astro`.

**Apply to:** Phase 6 `index.astro` — full retune of the block. Token names from the existing convention (`--bg`, `--fg`, `--fg-dim`, `--line`, `--surface`, `--accent`, `--accent-ink`); add `--accent-soft`, `--line-strong`, `--font-sans`, `--font-mono`, `--max`, `--pad-x` per UI-SPEC §"Color" and §"Typography".

**Why no shared stylesheet:** CLAUDE.md §"Conventions" — Layout.astro extraction explicitly deferred to v1.1. The duplication is manageable; deadline (2026-06-11) trumps cleanup.

### Pattern S4 — Plausible global-shim init

**Source:** `src/pages/index.astro:20-24`, identical block at `src/pages/pending.astro:13-17`, present on all 6 pages.

**Apply to:** Phase 6 `index.astro` — keep verbatim. UI-SPEC §"Design System" architecture note explicitly keeps it. The new Phase 6 Plausible call (`plausible('Signup Submit', { props: { team } })`) RELIES on this shim to queue events if `pa-*.js` hasn't loaded yet (RESEARCH §"Pattern 4").

**Excerpt:**
```html
<script async src="https://plausible.io/js/pa-wRAab3seDWDDBnGbRbe0K.js"></script>
<script is:inline>
  window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};
  plausible.init()
</script>
```

### Pattern S5 — Honeypot via `<input type="text" name="website">` + `.hp` CSS

**Source:**
- HTML: `src/pages/index.astro:43-51` (current).
- CSS: `src/pages/index.astro:233-240` (`.hp` rule).
- Server check: `src/pages/api/signup.ts:57-61` (`if (form.get('website') !== '') return 303 → /pending`).

**Apply to:** Phase 6 `index.astro` form — keep the input markup AND the CSS rule verbatim. Phase 5 smoke `scripts/smoke-signup.mjs:261-278` (AC12) exercises this path.

**Why not `display: none`:** RESEARCH §"Anti-Patterns" — bots that parse CSS skip `display: none` inputs. The off-screen-absolute pattern survives.

### Pattern S6 — Dev-only console log with bracket tag

**Source:** `src/lib/email.ts` `[email-dev-fallback]` (cited in CLAUDE.md §"Logging").

**Apply to:** Phase 6 `index.astro` Plausible listener — emit `console.log('[plausible] Signup Submit', { team })` ONLY when `location.hostname === 'localhost' || location.hostname === '127.0.0.1'` (CONTEXT D-12). Prod console stays clean.

### Pattern S7 — `<form method="post" action="/api/signup">` posting URL-encoded fields

**Source:** `src/pages/index.astro:33` (current) + `/api/signup`'s expectation at `src/pages/api/signup.ts:50-65` (consumes via `request.formData()`).

**Apply to:** Phase 6 `index.astro` form. Field names locked by `/api/signup`:
- `email` (required, regex + ≤254 chars)
- `team` (required, must be in `VALID_TEAMS` from `src/lib/teams.ts`)
- `timezone` (optional; invalid/empty falls back to `America/New_York` per `src/lib/timezones.ts` `FALLBACK_TZ`)
- `requested_sport` (defaults `world_cup`)
- `website` (honeypot — must be empty)

### Pattern S8 — JSON build-time import via `with { type: 'json' }`

**Source:** `src/lib/teams.ts:1`:
```ts
import teams from '../../references/teams.json' with { type: 'json' };
```

**Apply to:** Phase 6 `index.astro` frontmatter — same syntax. Node 22 stable; project already uses it. RESEARCH §"Pitfall 5" confirms no build issues.

**Alternative:** Import via `src/lib/teams.ts`'s `TEAMS` re-export (`import { TEAMS } from '../lib/teams';`). Equivalent at build time; either works. UI-SPEC §Asset Inventory leaves the choice to the executor.

---

## Negative Patterns — What MUST NOT Appear (LAND-02)

**Source:** UI-SPEC §"Negative Space" and CONTEXT §Decisions.

The prohibited terms (case-insensitive) **MUST NOT** appear anywhere in the served HTML, including inline scripts, inline styles, meta tags, asset URLs, or CSS variable names:

- `bitcoin`
- `lightning`
- `crypto`
- `world domination`
- `personal olympics`

**Current `src/pages/index.astro` violations to scrub:**
- Line 3: `title = 'oddlympics — World domination. Your world.'` — both `world domination` AND it's also the headline at line 30.
- Line 4: `description` contains `Personal Olympics` AND `Bitcoin/Lightning rails` — three hits.
- Line 30: `<h1 class="headline">World domination. Your world.</h1>`.

**Pre-merge gate:** `! grep -i -E 'bitcoin|lightning|crypto|world domination|personal olympics' dist/client/index.html` (Phase 11 AC7 runs the same gate on prod).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (4 below-fold sections + footer + FAQ `<details>` accordions inside `index.astro`) | section markup | static | No in-codebase precedent for multi-section landing structure. Use `references/index.html` as structural reference (NOT a literal port — CONTEXT D-02), `references/oddlympics_landing_copy.md` as verbatim copy source, and UI-SPEC §"Copywriting Contract" tables for exact strings. The `<details>`/`<summary>` accordion pattern is HTML-native (no JS) per UI-SPEC §"Interaction Contracts → FAQ accordion behavior". |
| (Confederation `<optgroup>` rendering loop in `index.astro`) | template fragment | build-time map | No in-codebase precedent for grouped `<select>` rendering. Use RESEARCH §"Code Examples → Frontmatter" + §"Form Markup" — the `groupedTeams.map(…)` pattern + `<optgroup label={label}>` is the canonical shape. |

---

## Pattern Fidelity Summary (for the planner)

| Must preserve | Must change | May change (executor discretion) |
|---------------|-------------|----------------------------------|
| `export const prerender = true;` | All copy strings (every byte through LAND-02 grep) | Whether to combine 3 inline scripts into 1 block |
| `<!doctype html><html lang="en">` shell | `title` + `description` const values | Whether to drop the Plausible global-shim block (UI-SPEC says keep) |
| `<script async src="…/pa-*.js">` + Plausible global-shim block | Adding `og:url`, `og:site_name`, `og:image` + dimensions + alt, `twitter:title`, `twitter:description`, `twitter:image` meta tags | Whether to import `teams.json` directly via `with { type: 'json' }` or re-import from `src/lib/teams.ts` |
| `<form method="post" action="/api/signup">` | Adding `id="signup-form"` on the form | Internal CSS values (UI-SPEC locks tokens; values are tuned to hit `references/landing_preview.png`) |
| `<input type="hidden" name="requested_sport" value="world_cup" />` | Adding `<select name="team" required>` with 6 `<optgroup>` × 48 `<option>` | Whether to add `scripts/smoke-landing.mjs` (RESEARCH §"Wave 0 Gaps" — optional) |
| Honeypot `<input type="text" name="website">` markup AND `.hp` CSS class | Adding `<input type="hidden" name="timezone" id="timezone">` | Mobile breakpoint stays 520px per UI-SPEC; section padding rhythm tuned |
| `<script is:inline>` `?error=` swap COPY map (verbatim, all 6 codes + default) | Submit button label `Get early access` → `Get match alerts` | DOM position of the inline script(s) — anywhere after the form |
| `try { … } catch {}` wrapper convention around all inline scripts | Adding tz-label swap script (D-04) and Plausible submit listener (D-09) | Whether to keep CSS comments (must scrub for LAND-02 if so) |
| `<style is:global>` block per page (no shared stylesheet) | All CSS variable VALUES (light/sans-serif consumer palette per UI-SPEC §Color) | Whether to keep `--mono` token name or rename — UI-SPEC introduces `--font-sans` + `--font-mono` |
| CSS variable NAMES (`--bg`, `--fg`, `--fg-dim`, `--line`, `--surface`, `--accent`, `--accent-ink`) | Body font-family from `var(--mono)` → `var(--font-sans)` | Sans-serif stack composition (UI-SPEC suggests `ui-sans-serif, system-ui, -apple-system, …`) |
| `* { box-sizing: border-box; }` reset | All section selectors (`.hero`, `.banner`, `.headline`, …) — rebuild against UI-SPEC | Whether to add `display: inline-block; min-width: 8ch;` on `#tz-label` (RESEARCH Pitfall 2 — only if Lighthouse complains) |
| Mobile `@media (max-width: 520px)` breakpoint | Adding 4 below-fold sections + 5 `<details>` FAQ + consumer footer | `<noscript>` block — UI-SPEC + RESEARCH say not needed |
| `@media (prefers-reduced-motion: reduce)` block | — | `details summary::after` transition + reduced-motion override (UI-SPEC §"FAQ accordion behavior") |

---

## Metadata

- **Analog search scope:** `src/pages/`, `src/lib/`, `scripts/`, `references/`, `src/pages/api/`.
- **Files scanned:** 14 (6 .astro pages, 7 src/lib + src/pages/api files, 6 scripts, 5 references files).
- **Pattern extraction date:** 2026-05-13.
- **Linked artifacts:** `06-CONTEXT.md`, `06-RESEARCH.md`, `06-UI-SPEC.md`, `references/oddlympics_landing_copy.md`, `references/teams.json`, `CLAUDE.md`, `.planning/codebase/CONVENTIONS.md`.
