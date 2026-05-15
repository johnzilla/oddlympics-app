# Phase 9: manage-editor-unsubscribe — Pattern Map

**Mapped:** 2026-05-14
**Files analyzed:** 8 new/modified files
**Analogs found:** 8 / 8

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/pages/manage.astro` | page (SSR, dual-mode) | request-response | `src/pages/schedule.astro` | exact — signed-in editor branch ports verbatim; signed-out branch is current file |
| `src/pages/schedule.astro` | page (SSR, redirect) | request-response | `src/pages/api/confirm.ts` (pattern: one-liner redirect) | role-match — Astro.redirect with query-string pass-through |
| `src/pages/api/save-selection.ts` | API route | request-response + CRUD | `src/pages/api/save-selection.ts` (self) | exact — edits to redirectTo() target and team-input parse path |
| `src/lib/token.ts` | lib / utility | transform | `src/lib/token.ts` (self) + `src/lib/session.ts` (TTL constant pattern) | exact — constant table replaces scalar |
| `src/lib/db.ts` | lib / storage | CRUD | `src/lib/db.ts` `markUnsubscribed` (same idempotent WHERE pattern) | exact — `markConfirmed` WHERE widening mirrors `markUnsubscribed` shape |
| `src/lib/email.ts` | lib / service | request-response | `src/lib/email.ts` `sendMagicLink` (same URL-template pattern) | exact — one-line string change in `sendManageLink` |
| `scripts/smoke-manage.mjs` | script / test | batch | `scripts/smoke-signup.mjs` | exact — same structure: runCase harness, fetch with redirect:manual, DB assertions |
| `package.json` | config | — | `package.json` (self, existing `smoke:landing` script) | exact — colon-style npm script entry |

---

## Pattern Assignments

### `src/pages/manage.astro` (page, request-response — dual-mode rewrite)

**Analog:** `src/pages/schedule.astro` (signed-in editor branch) + `src/pages/manage.astro` (signed-out branch stays as-is)

#### Critical removal — line 7 (must be the first change)

**Source:** `src/pages/manage.astro` lines 5-7
```typescript
// REMOVE THIS BLOCK — after Phase 9 /manage IS the editor for signed-in users.
// Leaving it creates an infinite 301 loop: manage → schedule → manage → ...
const session = readSessionFromCookie(Astro.request.headers.get('cookie'));
if (session) return Astro.redirect('/schedule');
```

#### Frontmatter imports pattern (from `src/pages/schedule.astro` lines 1-6)
```typescript
export const prerender = false;

import { verifyToken } from '../lib/token';
import { buildSessionCookie, readSessionFromCookie } from '../lib/session';
import { db, getByEmail, type VipSignup, type Match } from '../lib/db';
import { TEAMS } from '../lib/teams';  // NEW for Phase 9 — needed for <select> options
```

Note: `getTeams` import from `schedule.astro` is replaced by `TEAMS` from `src/lib/teams.ts` because the `/manage` editor uses the optgroup-grouped structure from `index.astro`, not the raw `getTeams` query. Also import `groupedTeams` build logic from `index.astro` lines 17-39.

#### Session-or-token dual-auth pattern (`src/pages/schedule.astro` lines 8-20)
```typescript
const url = Astro.url;
const urlToken = url.searchParams.get('token') ?? '';
const status = url.searchParams.get('status') ?? '';

// Auth: prefer URL token (manage flow on first arrival); fall back to session cookie.
// On URL-token success, mint a 30-day session cookie so subsequent visits skip the email step.
let result = urlToken ? verifyToken(urlToken, 'manage') : null;
if (result) {
  Astro.response.headers.set('Set-Cookie', buildSessionCookie(result.email));
}
if (!result) {
  result = readSessionFromCookie(Astro.request.headers.get('cookie'));
}

const valid = result !== null;
const hadUrlToken = urlToken.length > 0;
```

#### STATUS_COPY map — Phase 9 delta (`src/pages/schedule.astro` lines 60-67, with `too-many` replaced)
```typescript
const STATUS_COPY: Record<string, { kind: 'ok' | 'err'; text: string }> = {
  saved:      { kind: 'ok',  text: 'Saved. Your schedule is updated below.' },
  'bad-token':{ kind: 'err', text: 'That link is no longer valid. Request a new one.' },
  'bad-tz':   { kind: 'err', text: "Couldn't read your time zone. Try again." },
  'bad-team': { kind: 'err', text: 'Team not recognized. Use the dropdown.' },  // replaces 'too-many'
  unknown:    { kind: 'err', text: "We couldn't find your signup. Sign up at /." },
  server:     { kind: 'err', text: 'Server hiccup. Try again in a minute.' },
};
```

#### Banner conditional render (`src/pages/manage.astro` line 29 + `src/pages/schedule.astro` line 104)
```astro
{/* When team IS NULL → "Pick a team"; when team is set → "Your schedule" */}
<span class="banner">{!user?.team ? 'Pick a team' : 'Your schedule'}</span>
```

#### Team `<select>` with optgroup + pre-selected value (`src/pages/index.astro` lines 83-93, adapted)
```astro
<fieldset class="picker">
  <legend class="legend">YOUR TEAM</legend>
  <select name="team" aria-label="Your team" required>
    <option value="" disabled selected={!user?.team}>Pick your team</option>
    {groupedTeams.map(({ label, teams }) => (
      <optgroup label={label}>
        {teams.map((t) => (
          <option value={t.slug} selected={t.slug === user?.team}>{t.label}</option>
        ))}
      </optgroup>
    ))}
  </select>
</fieldset>
```

#### Timezone row (port verbatim from `src/pages/schedule.astro` lines 117-132)
```astro
<div class="tz-row">
  <span class="tz-prefix">Notifications in:</span>
  <strong id="tz-display">{user?.timezone || 'UTC'}</strong>
  <button type="button" id="tz-change" class="link-button" hidden>change</button>
  <select
    id="tz-select"
    name="timezone"
    data-saved-tz={user?.timezone ?? ''}
    hidden
  >
    <option value={user?.timezone || 'UTC'} selected>{user?.timezone || 'UTC'}</option>
  </select>
  <noscript>
    <span class="tz-noscript">(JavaScript disabled — timezone defaults to {user?.timezone || 'UTC'}; enable JS to change)</span>
  </noscript>
</div>
```

#### Matches list — conditional render (port verbatim from `src/pages/schedule.astro` lines 168-188)
```astro
{selectedIds.length > 0 && (
  <section class="schedule">
    <h2 class="section-h">Your matches ({matches.length})</h2>
    {matches.length === 0 ? (
      <p class="subhead">No matches yet. Once the schedule is loaded for your picks, they'll show up here.</p>
    ) : (
      <ol class="match-list" id="match-list">
        {matches.map((m) => (
          <li class="match" data-utc={m.utc_date}>
            <span class="match-time" data-utc={m.utc_date}>
              {new Date(m.utc_date * 1000).toISOString()}
            </span>
            <span class="match-stage">{m.group_name ?? m.stage.replace(/_/g, ' ')}</span>
            <span class="match-teams">
              {m.home_tla ?? 'TBD'} <span class="dim">vs</span> {m.away_tla ?? 'TBD'}
            </span>
          </li>
        ))}
      </ol>
    )}
  </section>
)}
```

#### Inline TZ + match-time scripts (port verbatim from `src/pages/schedule.astro` lines 207-268)

Two `<script is:inline>` blocks:
1. `setupTz()` — auto-detect + manual override (lines 207-254)
2. Match-time local render — `Intl.DateTimeFormat` format loop (lines 257-268)

Port both verbatim. Do not modify.

#### Footer + logout (port verbatim from `src/pages/schedule.astro` lines 193-202)
```astro
<p class="subhead" style="margin-top:32px">
  <a href="/" class="link">← oddlympics.app</a>
  {valid && (
    <>
      {' · '}
      <form method="post" action="/api/logout" style="display:inline">
        <button type="submit" class="link-button">Log out</button>
      </form>
    </>
  )}
</p>
```

#### CSS `<style is:global>` block

**Source:** `src/pages/schedule.astro` lines 273-351 (the richer block — has `--ok`, `--err`, `.flash`, `.picker`, `.tz-row`, `.match-list`, `.link-button`). Use this block verbatim, not the leaner `manage.astro` block. Drop `.feature-request` rules (lines 339-343) and the `.grid` / `.team` / `.team .tla` rules (lines 308-313) since the checkbox grid is replaced by `<select>`.

---

### `src/pages/schedule.astro` (page → thin 301 redirect handler)

**Analog:** `src/pages/api/confirm.ts` for the pattern of a minimal server response; verified `Astro.redirect()` signature in `src/pages/schedule.astro` itself.

**New entire file content (`src/pages/schedule.astro` lines 87-101 in RESEARCH.md Q1):**
```astro
---
export const prerender = false;
// D-01: /schedule is now a thin 301 redirect to /manage, preserving ?token=
// Astro.redirect defaults to 302; pass 301 for permanent (browser caches it).
// Astro's `redirects:` config cannot preserve query strings (upstream limitation),
// so an in-process handler is required.
const dest = '/manage' + (Astro.url.search || '');
return Astro.redirect(dest, 301);
---
```

This is the complete file — no HTML, no imports, no CSS.

---

### `src/pages/api/save-selection.ts` (API route — targeted edits)

**Analog:** `src/pages/api/save-selection.ts` (self — three targeted changes)

#### Change 1: `redirectTo()` target string (`save-selection.ts` lines 23-27)
```typescript
// BEFORE:
const headers: Record<string, string> = { Location: `/schedule?${params}` };
// AFTER (D-02):
const headers: Record<string, string> = { Location: `/manage?${params}` };
```

#### Change 2: Add `VALID_TEAMS` import (top of file, after existing imports)
```typescript
import { VALID_TEAMS } from '../../lib/teams';
```

#### Change 3: Team-input dual-parse (replace lines 53-68 — `team_ids[]` block + its failure redirect)

Phase 9 primary parse path: `form.get('team')` slug via `VALID_TEAMS`. Keep `team_ids[]` fallback for the transition window. Replace `too-many` redirect with `bad-team`.

```typescript
// Phase 9 — D-03: primary input is team=<slug> from the /manage editor select.
// team_ids[] fallback retained for the deploy-window transition (stale /manage
// pages mid-deploy still post the old checkbox form). Remove fallback after
// 1 week of stable deploy.
let teamSlug: string | null = null;

const slugInput = ((form.get('team') as string) ?? '').trim().toLowerCase();
if (slugInput && VALID_TEAMS.has(slugInput)) {
  teamSlug = slugInput;
} else if (!teamSlug) {
  // Fallback: resolve first valid team_ids[] integer to slug (transition window only)
  const rawIds = form.getAll('team_ids') as string[];
  for (const raw of rawIds) {
    const s = (raw ?? '').trim();
    if (!TEAM_ID_RE.test(s)) continue;
    const n = Number(s);
    if (n <= 0) continue;
    const row = db.prepare('SELECT slug FROM teams WHERE id = ?').get(n) as { slug: string | null } | undefined;
    if (row?.slug) { teamSlug = row.slug; break; }
  }
}
if (!teamSlug) {
  return redirectTo(formToken, 'bad-team');  // was 'too-many'
}
```

---

### `src/lib/token.ts` (lib — constant table addition + mintToken TTL lookup)

**Analog:** `src/lib/token.ts` (self) + `src/lib/session.ts` line 4 (TTL-as-named-constant pattern)

#### Change 1: Replace `TTL_SECONDS` scalar with `TTL_BY_PURPOSE` table (`token.ts` line 4)

```typescript
// BEFORE (token.ts line 4):
const TTL_SECONDS = 60 * 60 * 24; // 24 hours

// AFTER (D-05 — MANAGE-02):
// Per-purpose TTLs: unsubscribe links are 1-year credentials so a user's
// inbox copy remains actionable without requiring a re-login flow.
const TTL_BY_PURPOSE = {
  confirm:     60 * 60 * 24,         // 24h — magic-link confirm window
  manage:      60 * 60 * 24,         // 24h — magic-link manage window
  unsubscribe: 60 * 60 * 24 * 365,   // 1y — MANAGE-02: long-lived unsubscribe credential
  session:     60 * 60 * 24 * 30,    // 30d — mirrors src/lib/session.ts SESSION_TTL_SECONDS
} as const;
```

#### Change 2: `mintToken()` TTL resolution (`token.ts` line 38)
```typescript
// BEFORE:
const ttl = opts?.ttlSeconds ?? TTL_SECONDS;

// AFTER:
// opts.ttlSeconds takes precedence (buildSessionCookie passes it explicitly);
// otherwise resolve via purpose table; fall back to confirm (24h) if purpose absent.
const ttl = opts?.ttlSeconds ?? TTL_BY_PURPOSE[opts?.purpose ?? 'confirm'];
```

**Session minting is unaffected:** `buildSessionCookie` in `src/lib/session.ts` line 9-10 always passes `ttlSeconds: SESSION_TTL_SECONDS` explicitly, so it takes the `opts?.ttlSeconds ??` branch and never reads `TTL_BY_PURPOSE`.

**Unsubscribe minting requires zero call-site change:** `src/lib/email.ts` line 59 calls `mintToken(email, { purpose: 'unsubscribe' })` with no `ttlSeconds` — after the change it resolves to 1 year automatically.

---

### `src/lib/db.ts` (lib — markConfirmed WHERE widening)

**Analog:** `src/lib/db.ts` `markUnsubscribed` (lines 106-110) — same idempotent partial-WHERE pattern

#### Existing `markUnsubscribed` (the structural model, lines 106-110)
```typescript
export const markUnsubscribed = db.prepare<[string]>(`
  UPDATE vip_signups
  SET unsubscribed_at = strftime('%s','now')
  WHERE email = ? AND unsubscribed_at IS NULL
  RETURNING *
`);
```

#### Change: `markConfirmed` WHERE widening + `unsubscribed_at = NULL` clear (lines 95-100)
```typescript
// BEFORE:
export const markConfirmed = db.prepare<[string]>(`
  UPDATE vip_signups
  SET confirmed_at = strftime('%s','now')
  WHERE email = ? AND confirmed_at IS NULL
  RETURNING *
`);

// AFTER (D-07 — re-subscribe SC4):
// WHERE widened: also matches a row that was previously unsubscribed
// (unsubscribed_at IS NOT NULL), enabling the re-confirm path after re-signup.
// SET clears unsubscribed_at so the row is fully active after re-confirm.
// Already-confirmed non-unsubscribed rows (both conditions false) → 0 rows → idempotent.
export const markConfirmed = db.prepare<[string]>(`
  UPDATE vip_signups
  SET confirmed_at = strftime('%s','now'),
      unsubscribed_at = NULL
  WHERE email = ? AND (confirmed_at IS NULL OR unsubscribed_at IS NOT NULL)
  RETURNING *
`);
```

**RETURNING * is safe:** SQLite 3.53.0 is on the live droplet (verified in RESEARCH.md Q4). Phase 5 already asserts `>= 3.35`. No new version check needed.

---

### `src/lib/email.ts` (lib — sendManageLink URL change)

**Analog:** `src/lib/email.ts` `sendMagicLink` (lines 15-53) — same URL-template pattern

#### Change: `sendManageLink()` URL (`email.ts` line 68)
```typescript
// BEFORE:
const url = `${SITE_URL}/schedule?token=${encodeURIComponent(token)}`;

// AFTER (D-01):
const url = `${SITE_URL}/manage?token=${encodeURIComponent(token)}`;
```

One-line change. All surrounding HTML template, Resend call, and dev-fallback console.log are unchanged.

**`buildUnsubscribeHeaders` requires no change** (`email.ts` lines 55-65): it calls `mintToken(email, { purpose: 'unsubscribe' })` with no `ttlSeconds`. After the `TTL_BY_PURPOSE` change in `token.ts`, this automatically yields a 1-year token. Zero call-site diff needed.

---

### `scripts/smoke-manage.mjs` (script — new 9-case E2E smoke)

**Analog:** `scripts/smoke-signup.mjs` (all 321 lines)

#### File header + preamble pattern (`smoke-signup.mjs` lines 1-50)
```javascript
#!/usr/bin/env node
// Phase 9 — Plan 09-05.
// End-to-end smoke for /manage editor + /schedule redirect + re-subscribe path.
// Covers M1–M9 from RESEARCH.md Q12.
//
// How to run:
//   Boot dev server: npm run dev
//   OR: npm run build && node ./dist/server/entry.mjs
//   Then: node scripts/smoke-manage.mjs
//
//   Env (optional):
//     SMOKE_BASE_URL   default http://localhost:4321
//     DATABASE_PATH    default ./data/oddlympics.db

import Database from 'better-sqlite3';
import { resolve } from 'node:path';

const BASE = process.env.SMOKE_BASE_URL ?? 'http://localhost:4321';
const DB_PATH = resolve(process.env.DATABASE_PATH ?? './data/oddlympics.db');
```

#### `runCase` harness (port verbatim from `smoke-signup.mjs` lines 55-68)
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
```

#### `fetch` with `redirect: 'manual'` pattern (from `smoke-signup.mjs` lines 71-84)
```javascript
// For GET requests:
async function get(path, headers = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'GET',
    headers,
    redirect: 'manual',
  });
  return { status: res.status, location: res.headers.get('location'), body: await res.text() };
}

// For POST requests (save-selection):
async function postForm(path, form, headers = {}) {
  const body = new URLSearchParams(form);
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: BASE, ...headers },
    body,
    redirect: 'manual',
  });
  return { status: res.status, location: res.headers.get('location'), setCookie: res.headers.get('set-cookie') };
}
```

#### DB open pattern (from `smoke-signup.mjs` lines 44-50)
```javascript
let db;
try {
  db = new Database(DB_PATH, { readonly: true });
} catch (err) {
  console.error(`[smoke] FAIL: cannot open DB at ${DB_PATH} — ${err.message}`);
  process.exit(2);
}
```

Note: for M9 (re-subscribe DB assertions requiring writes), the smoke opens a second non-readonly handle to `markUnsubscribed` and `markConfirmed` directly via their prepared statements — import `mintToken` and `verifyToken` from `src/lib/token.ts` using the dev secret.

#### Token minting in smoke (needed for M2, M8 — mint without email flow)
```javascript
// Import from built dist (smoke runs against the built or dev server):
// mintToken is an ESM export from src/lib/token.ts.
// For the built server, import from dist; for dev, use --loader or a small
// inline re-implementation using node:crypto with the dev secret.
// Simplest approach: set MAGIC_LINK_SECRET to the dev fallback and import directly.
import { mintToken, verifyToken } from '../src/lib/token.ts';  // works with tsx/dev
// OR:  import { mintToken, verifyToken } from '../dist/server/chunks/token-*.mjs';
```

Planner should pin the exact import path. The dev-secret approach (no API key, no Resend) is correct per CLAUDE.md.

#### Exit code pattern (from `smoke-signup.mjs` lines 311-320)
```javascript
console.log(`[smoke] result: pass=${pass} fail=${fail}`);
db.close();
process.exit(fail === 0 ? 0 : 1);
```

---

### `package.json` (config — new npm script entry)

**Analog:** `package.json` line 13 (`smoke:landing`)

```json
"smoke:manage": "node scripts/smoke-manage.mjs"
```

Add after `"smoke:landing"`. Colon-style naming is the established convention (`smoke:landing` is the live precedent; `smoke:signup` from RESEARCH.md Q12 may also exist — check before adding).

---

## Shared Patterns

### Session-or-token dual auth
**Source:** `src/pages/schedule.astro` lines 14-20 (page layer) and `src/pages/api/save-selection.ts` lines 40-48 (API layer)
**Apply to:** `src/pages/manage.astro` signed-in branch, `src/pages/api/save-selection.ts` (unchanged — already correct)

Page layer:
```typescript
let result = urlToken ? verifyToken(urlToken, 'manage') : null;
if (result) {
  Astro.response.headers.set('Set-Cookie', buildSessionCookie(result.email));
}
if (!result) {
  result = readSessionFromCookie(Astro.request.headers.get('cookie'));
}
```

API layer (unchanged in save-selection.ts lines 40-48):
```typescript
const formToken = ((form.get('token') as string) ?? '').trim();
let result = formToken ? verifyToken(formToken, 'manage') : null;
if (!result) result = readSessionFromCookie(request.headers.get('cookie'));
if (!result) {
  return new Response(null, {
    status: 303,
    headers: { Location: '/manage?error=bad-token' },
  });
}
```

### DB-layer idempotency via partial WHERE
**Source:** `src/lib/db.ts` `markUnsubscribed` (lines 106-110), `setSelection` (lines 231-236), `upsertVipSignup` (lines 81-93)
**Apply to:** `markConfirmed` WHERE widening (D-07)

The pattern: `WHERE email = ? AND <state-column> IS [NOT] NULL` makes any update safe to re-run — 0 rows on repeat = no-op. `RETURNING *` lets callers detect whether the update fired without a second SELECT.

### CSS token block — dark mono aesthetic
**Source:** `src/pages/schedule.astro` lines 274-290 (`:root` vars + reset)
**Apply to:** `src/pages/manage.astro` `<style is:global>` block (paste verbatim; this is the richer block with `--ok` and `--err` that `manage.astro` currently lacks)

```css
:root {
  --bg: #0b0b0e;
  --fg: #ececf1;
  --fg-dim: #b8b8c2;
  --line: rgba(255, 255, 255, 0.18);
  --surface: rgba(255, 255, 255, 0.06);
  --accent: hsl(18 70% 56%);
  --accent-ink: #0b0b0e;
  --ok: hsl(140 50% 60%);
  --err: hsl(360 70% 65%);
  --pad: 48px;
  --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
}
```

### `.banner` pill class
**Source:** `src/pages/manage.astro` line 101 = `src/pages/schedule.astro` line 292 (identical in both)
**Apply to:** `src/pages/manage.astro` Phase 9 rewrite — carry this rule verbatim

```css
.banner { display: inline-block; font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 700; color: var(--accent); border: 1px solid var(--accent); padding: 5px 10px; border-radius: 999px; margin-bottom: 18px; }
```

### URL-param status messaging + `<script is:inline>` client read
**Source:** `src/pages/manage.astro` lines 61-78 (error param) and `src/pages/schedule.astro` lines 60-68 (STATUS_COPY + `role="status"` flash paragraph)
**Apply to:** `src/pages/manage.astro` signed-in editor branch — STATUS_COPY is server-rendered (frontmatter reads `Astro.url.searchParams.get('status')`), not client-side for the editor branch (unlike the prerendered pages).

### `prerender = false` + typed APIRoute
**Source:** `src/pages/api/save-selection.ts` lines 1,6; all `src/pages/api/*.ts` files
**Apply to:** All modified/new API routes and server pages

---

## No Analog Found

All Phase 9 files have close analogs in the codebase. No new patterns are required from RESEARCH.md that don't have a live counterpart.

---

## Risk Flags for Planner

1. **`manage.astro` line 7 session-redirect removal is pre-condition for everything.** If this line is not removed, every signed-in user gets bounced to `/schedule` → 301 → `/manage` → line 7 redirect → infinite loop. Make it step 1 of the manage.astro plan.

2. **`smoke-manage.mjs` import of `mintToken`.** The smoke script needs to mint real tokens to test M2 (URL-token-first-arrival) and M8 (1-year unsubscribe). The cleanest approach: `import { mintToken, verifyToken } from '../src/lib/token.js'` when running via `tsx` or via the built output. Planner must pin the exact import mechanism consistent with how `smoke-signup.mjs` avoids needing a Resend key (it uses the dev-fallback secret automatically because `NODE_ENV` is not `production` in local smoke runs).

3. **`STATUS_COPY` slug `bad-team` must propagate to both the page and the handler.** The `redirectTo(formToken, 'bad-team')` call in `save-selection.ts` and the `STATUS_COPY['bad-team']` entry in `manage.astro` must be added in the same wave (Wave 2). Mismatched deploy produces a `?status=bad-team` with no copy → silent blank flash.

4. **`setSelection` WHERE clause blocks unsubscribed users** (`src/lib/db.ts` lines 231-236: `AND unsubscribed_at IS NULL`). An unsubscribed user with a valid session cookie will see the editor but get `?status=unknown` on save. The planner should add a defensive branch in `manage.astro` that checks `user.unsubscribed_at` before rendering the editor form (RESEARCH Risk 3).

---

## Metadata

**Analog search scope:** `src/pages/`, `src/lib/`, `src/pages/api/`, `scripts/`, `package.json`
**Files read:** 11 source files (manage.astro, schedule.astro, index.astro, save-selection.ts, token.ts, db.ts, email.ts, session.ts, smoke-signup.mjs lines 1-321, package.json, CONTEXT + RESEARCH + UI-SPEC)
**Pattern extraction date:** 2026-05-14
