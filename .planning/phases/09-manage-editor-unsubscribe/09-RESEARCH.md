# Phase 9: `/manage` editor + unsubscribe — Research

**Researched:** 2026-05-14
**Domain:** Astro 5 server-mode page redesign, HMAC token mechanics, SQLite UPDATE patterns
**Confidence:** HIGH (all critical claims verified against live source files)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Consolidate at `/manage`. `/schedule.astro` becomes a thin 301 redirect handler. `sendManageLink()` URL changes to `/manage?token=`.
- **D-02:** Reuse `/api/save-selection`. Form on `/manage.astro` POSTs there. Redirect target changes from `/schedule?status=` to `/manage?status=`.
- **D-03:** Single-select native `<select name="team">` with 48 `<option>` elements. Mirrors `src/pages/index.astro`. `/api/save-selection` switches from `team_ids[]` integer parse to `team` slug allow-list via `VALID_TEAMS`.
- **D-04:** Banner visible iff `user.team IS NULL`. No close button, no localStorage, no DB column. Implicit dismissal on team set.
- **D-05:** `TTL_BY_PURPOSE` table in `src/lib/token.ts`: `confirm`=24h, `manage`=24h, `unsubscribe`=1y, `session`=30d.
- **D-06:** DB-layer idempotency is the unsubscribe single-use contract. No nonce column.
- **D-07:** `markConfirmed` WHERE clause widened to `AND (confirmed_at IS NULL OR unsubscribed_at IS NOT NULL)`, plus `SET unsubscribed_at = NULL`.

### Claude's Discretion
- 301 vs 302 for `/schedule` redirect (301 default; 302 acceptable with reasoning)
- Whether `schedule.astro` is deleted or kept as a thin handler
- Banner placement and exact subhead copy beyond "Pick a team" headline
- Form layout details on the signed-in `/manage` editor branch
- `<option>` label text format in team `<select>`
- Exact `team_ids[]` fallback shape in `/api/save-selection` during transition
- npm script name for the smoke script

### Deferred Ideas (OUT OF SCOPE)
- Layout.astro extraction
- Footer harmonization beyond paste
- Server-side banner-dismissal state (`banner_dismissed_at` column)
- Token nonce server-side / `unsub_nonce` column
- Cross-device banner dismissal
- `/api/manage` rename to `/api/manage-request`
- Native browser `<datalist>` for team picker
- Per-team OG image variants
- Sub-page `/manage/matches`
- Email-confirm flow change to issue fresh unsubscribe token in body
- Telemetry on banner impressions
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MANAGE-01 | `/manage` displays team + tz and allows updating both; update endpoint pinned to `/api/save-selection` | D-02 confirmed; endpoint already exists, needs redirect-target and input-parse changes only |
| MANAGE-02 | Unsubscribe link works without auth; HMAC-signed, 1-year expiry, single-use per action | D-05 TTL table mechanics verified; D-06 idempotency already in `markUnsubscribed`; no new code in `/api/unsubscribe.ts` |
| COMPAT-01 | Pre-milestone subscribers (`team=NULL`) don't break `/manage`; one-time banner prompts team pick | Banner is a pure conditional render (`user.team IS NULL`) — no migration; Phase 5 backfill already set `timezone='America/New_York'` for all pre-milestone rows |
</phase_requirements>

---

## Executive Summary

Phase 9 is a page-consolidation and token-mechanics phase with no new database tables, no new external services, and no new API endpoints. Every success criterion is achievable by editing four existing files (`src/pages/manage.astro`, `src/pages/schedule.astro`, `src/pages/api/save-selection.ts`, `src/lib/token.ts`) plus three lib files (`src/lib/db.ts`, `src/lib/email.ts`) and adding one new smoke script.

The most consequential judgment call is whether `schedule.astro` is deleted (using Astro's `redirects:` config or Caddy) or kept as a thin in-process handler. The research below resolves this: **keep as a thin server-rendered file** because Astro's `redirects:` config does not preserve query strings, and Caddy rewrite rules would bypass the Node process entirely without the ability to read the query string at redirect time. A minimal `schedule.astro` that calls `Astro.redirect()` with the full query string is the lowest-risk path.

The TTL mechanics, DB idempotency pattern, and `markConfirmed` WHERE widening are all straightforward edits with no hidden compatibility risk. SQLite 3.53.0 (verified on the live DB) fully supports `RETURNING *` (added in SQLite 3.35) — the Phase 5 version assertion already enforces this.

**Primary recommendation:** Five focused PLAN files across three waves: (1) token.ts TTL table, (2) db.ts + email.ts library edits, (3) manage.astro + schedule.astro page consolidation + save-selection endpoint update, (4) smoke script.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Signed-in editor UI (team + tz) | Frontend Server (Astro SSR page) | — | Must read session cookie / URL token server-side; cannot be prerendered |
| Unauth magic-link request form | Frontend Server (Astro SSR page) | — | Existing signed-out branch of `/manage`; no change |
| `/schedule` → `/manage` redirect | Frontend Server (Astro SSR page) | — | Query-string preservation requires in-process handler; see Q1 below |
| Team/tz update | API / Backend (`/api/save-selection`) | — | D-02: reuse existing endpoint, change redirect target + input parse |
| TTL-by-purpose token mint | API / Backend (lib/token.ts) | — | Pure library change; all callers pick up new behavior automatically |
| Re-subscribe SQL | Database / Storage (lib/db.ts) | — | `markConfirmed` WHERE widening + `unsubscribed_at = NULL` clear |
| Unsubscribe single-use | Database / Storage (`markUnsubscribed` WHERE) | — | Already implemented; D-06 formalizes the existing contract |
| Email URL update | API / Backend (lib/email.ts `sendManageLink`) | — | One-line string change: `/schedule?token=` → `/manage?token=` |

---

## Technical Patterns

### Q1: `/schedule` → `/manage` redirect strategy — keep thin handler, do not use `redirects:` config

**Finding (VERIFIED: Astro 5.18.1 source, `node_modules/astro/dist/core/render-context.js:544`):**

`Astro.redirect(path, status = 302)` accepts an optional second argument for the HTTP status code. It returns `new Response(null, { status, headers: { Location: path } })`. The `path` argument is a plain string — the caller constructs the full target URL including query string.

Astro's `redirects:` config (in `astro.config.mjs`) does **not** preserve query strings. This is a known upstream limitation (GitHub issue #7890). The `redirects:` config maps static route patterns to static destinations — no access to the incoming request's query string.

**Recommended implementation for `src/pages/schedule.astro`:**

```astro
---
export const prerender = false;
// D-01: /schedule is now a thin 301 redirect to /manage, preserving ?token=
// Astro.redirect defaults to 302; pass 301 for permanent (browser caches it).
const dest = '/manage' + (Astro.url.search || '');
return Astro.redirect(dest, 301);
---
```

`Astro.url.search` is `""` when no query string is present and `"?token=abc..."` when one is. Appending it to `/manage` preserves the token through the redirect exactly. This is 4 lines and zero imports.

**Alternative (delete schedule.astro, use `redirects:` config):**

```js
// astro.config.mjs
redirects: { '/schedule': '/manage' }
```

This creates a 301 redirect for `/schedule` → `/manage` but DROPS the query string. A user clicking an old manage-link email (`/schedule?token=abc`) would land on `/manage` with no token, see the signed-out branch, and have to request a new link. Since manage-purpose tokens have a 24h TTL, this window closes within one day of deploy. Whether this is acceptable is a discretion call — but it risks a bad experience for any user who clicks a just-sent email immediately after deploy. The thin handler approach has no downside and takes four lines.

**Verdict:** Keep `schedule.astro` as a thin redirect handler. Do not delete the file. [VERIFIED: Astro 5.18.1 source]

---

### Q2: In-flight magic-link compatibility

`sendManageLink()` currently builds `${SITE_URL}/schedule?token=...`. After D-01's URL change to `/manage?token=...`, emails sent before the deploy continue to carry `/schedule?token=...` links.

**Token mechanics (VERIFIED: `src/lib/token.ts:65`):**

`verifyToken` checks `Math.floor(Date.now() / 1000) > payload.exp`. Manage-purpose tokens have a 24h TTL (D-05). Any link minted before deploy expires within 24h of its creation, meaning at most 24h after deploy there are zero valid in-flight `/schedule?token=` links.

**The 301 redirect in `schedule.astro` covers this window.** A user who clicks an email sent before deploy:
1. Browser follows `/schedule?token=abc` → 301 → `/manage?token=abc`
2. `/manage` receives the token and processes it normally
3. No user action required

**Risk:** Zero token-based risk. The 24h manage-purpose TTL means even a token minted seconds before deploy is valid for at most 24h. After that, the user requests a new link (which goes to `/manage?token=...`).

**Email URL change timing:** Change `sendManageLink()` in the same deploy as the page consolidation. There is no safe "partial deploy" order — both must land together. [VERIFIED: `src/lib/email.ts:68`]

---

### Q3: TTL_BY_PURPOSE mechanics and legacy token handling

**Current state (VERIFIED: `src/lib/token.ts:4,37-39,67-71`):**

```typescript
const TTL_SECONDS = 60 * 60 * 24; // 24 hours

export function mintToken(email, opts?) {
  const ttl = opts?.ttlSeconds ?? TTL_SECONDS;
  // ...
}

// In verifyToken:
if (expectedPurpose) {
  // Legacy tokens (minted before D-06) have no purpose field; treat them as 'confirm'
  const tokenPurpose = payload.purpose ?? 'confirm';
  if (tokenPurpose !== expectedPurpose) return null;
}
```

The `purpose` field was added in Phase 1 (HARDEN-06). Any token minted before Phase 1 is now expired (24h TTL from months ago). Legacy-purpose-less tokens are a non-issue for any live user.

**D-05 change shape (from CONTEXT.md, no surprises):**

```typescript
const TTL_BY_PURPOSE = {
  confirm:     60 * 60 * 24,       // 24h
  manage:      60 * 60 * 24,       // 24h
  unsubscribe: 60 * 60 * 24 * 365, // 1y — MANAGE-02
  session:     60 * 60 * 24 * 30,  // 30d — mirrors src/lib/session.ts
} as const;

export function mintToken(email, opts?) {
  const ttl = opts?.ttlSeconds ?? TTL_BY_PURPOSE[opts?.purpose ?? 'confirm'];
  // ...
}
```

**Session token consistency check (VERIFIED: `src/lib/session.ts:4,9-10`):**

`buildSessionCookie` already passes `ttlSeconds: SESSION_TTL_SECONDS` (30 days) explicitly via `opts.ttlSeconds`. After the TTL table change, if `opts.ttlSeconds` is present it takes precedence (`opts?.ttlSeconds ??`), so existing session minting is unaffected. The `TTL_BY_PURPOSE.session` value is never used at runtime for session minting (because `buildSessionCookie` always passes `ttlSeconds` explicitly) — it is present only for documentation completeness.

**Unsubscribe token call site (VERIFIED: `src/lib/email.ts:59`):**

```typescript
const token = mintToken(email, { purpose: 'unsubscribe' });
```

No `ttlSeconds` override is passed. After the TTL table change, `mintToken` will resolve TTL via `TTL_BY_PURPOSE['unsubscribe']` = 1 year. The call site requires zero changes. [VERIFIED: `src/lib/email.ts:55-65`]

---

### Q4: `markConfirmed` WHERE widening and RETURNING support

**Current state (VERIFIED: `src/lib/db.ts:95-100`):**

```typescript
export const markConfirmed = db.prepare<[string]>(`
  UPDATE vip_signups
  SET confirmed_at = strftime('%s','now')
  WHERE email = ? AND confirmed_at IS NULL
  RETURNING *
`);
```

`RETURNING *` is already in use in the live codebase — `upsertVipSignup` at line 82 and `markConfirmed` at line 99 both use it. [VERIFIED: `src/lib/db.ts:82-100`]

**SQLite version check (VERIFIED: live DB query):**

```
SQLite version: 3.53.0
```

`RETURNING *` was added in SQLite 3.35. Phase 5 already asserts `SQLite >= 3.35` in the migration block (`src/lib/db.ts:44-52`). No new version assertion needed.

**D-07 replacement shape (from CONTEXT.md):**

```typescript
export const markConfirmed = db.prepare<[string]>(`
  UPDATE vip_signups
  SET confirmed_at = strftime('%s','now'),
      unsubscribed_at = NULL
  WHERE email = ? AND (confirmed_at IS NULL OR unsubscribed_at IS NOT NULL)
  RETURNING *
`);
```

**Behavioral verification:**

| Scenario | WHERE match? | Result |
|----------|-------------|--------|
| Fresh signup (never confirmed, never unsubscribed) | `confirmed_at IS NULL` → true | confirmed_at set, unsubscribed_at stays NULL |
| Already confirmed, never unsubscribed | both conditions false | 0 rows affected — idempotent |
| Unsubscribed user re-confirms | `unsubscribed_at IS NOT NULL` → true | confirmed_at updated, unsubscribed_at cleared |
| Already confirmed and later re-unsubscribed (unsubscribed_at set after second confirm) | `unsubscribed_at IS NOT NULL` → true | Will re-confirm again. This is correct: user signed up, unsubbed, re-signed up, re-confirmed = active again. |

The `/api/confirm.ts` handler (VERIFIED: `src/lib/confirm.ts:12-16`) calls `markConfirmed.get(result.email)` and checks the returned row. If `RETURNING *` returns a row, it redirects `?status=ok`. If 0 rows (already confirmed and not unsubscribed), it checks `getByEmail` and redirects `?status=already`. This flow remains correct after the WHERE widening.

**One edge case to document in the plan:** A user who confirmed, later unsubscribed, then re-confirms (D-07 path) gets `?status=ok` back, not `?status=already`. This is semantically correct (they ARE re-confirming an active subscription). The `/confirmed?status=ok` page renders "You're confirmed" — appropriate for the re-subscribe case. [VERIFIED: codebase + logic]

---

### Q5: `team_ids[]` transition fallback in `/api/save-selection`

**Current handler state (VERIFIED: `src/pages/api/save-selection.ts:51-65`):**

```typescript
const rawIds = form.getAll('team_ids') as string[];
let teamSlug: string | null = null;
for (const raw of rawIds) {
  const s = (raw ?? '').trim();
  if (!TEAM_ID_RE.test(s)) continue;
  const n = Number(s);
  if (n <= 0) continue;
  const row = db.prepare('SELECT slug FROM teams WHERE id = ?').get(n) as { slug: string | null } | undefined;
  if (row?.slug) { teamSlug = row.slug; break; }
}
if (!teamSlug) { return redirectTo(formToken, 'too-many'); }
```

After Phase 9, the form at `/manage` posts `team=<slug>` (not `team_ids[]`). The transition risk: a user has `/manage` open, page is stale from before deploy, and they submit the old checkbox form during the deploy window. Without a fallback, the new handler receives `team_ids[]` with no `team` field and returns `bad-team`.

**Recommended dual-parse shape (planner confirms exact wording):**

1. Try `form.get('team')` as slug first, validate via `VALID_TEAMS.has(slug)`.
2. If absent or invalid, fall back to the existing `form.getAll('team_ids')` integer parse path.
3. If both miss, redirect `bad-team`.

This makes the handler understand both form shapes during the transition window. The fallback can be removed after 1 week of stable deploy.

**Note:** The redirect target on success changes from `/schedule?status=saved` to `/manage?status=saved` in `redirectTo()`. [VERIFIED: `src/pages/api/save-selection.ts:23-27`]

---

### Q6: Single-team `<select>` pattern from `index.astro`

**Exact form structure (VERIFIED: `src/pages/index.astro:83-93`):**

```html
<select name="team" id="team" required>
  <option value="" disabled selected>Pick your team</option>
  {groupedTeams.map(({ label, teams }) => (
    <optgroup label={label}>
      {teams.map((t) => (
        <option value={t.slug}>{t.label}</option>
      ))}
    </optgroup>
  ))}
</select>
```

`TEAMS` from `src/lib/teams.ts` is an array of `{ slug, label, confederation }`. The `label` field is the natural English name (e.g., `"Ivory Coast"`, `"Bosnia and Herzegovina"`, `"Curaçao"`). There is **no TLA prefix** in the index.astro `<option>` text. The TLA prefix exists only in the old checkbox grid on `schedule.astro`.

**For the `/manage` editor `<select>`, the option label pattern is `{t.label}` alone** — matching index.astro exactly per D-03 ("Mirrors the team `<select>` already on `src/pages/index.astro`").

**Pre-selecting the current team (server-side):**

```astro
{TEAMS.map((t) => (
  <option value={t.slug} selected={t.slug === user?.team}>{t.label}</option>
))}
```

Or with `<optgroup>` structure matching index.astro using `groupedTeams`.

**Important:** The `/manage` editor page needs access to `TEAMS` from `src/lib/teams.ts`. This import does not currently exist in `manage.astro` (it's a server-rendered page, ESM import is fine). [VERIFIED: `src/lib/teams.ts`]

---

### Q7: Banner CSS class — `.banner` pill

**Both existing pages define this class identically (VERIFIED: `src/pages/manage.astro:101` and `src/pages/schedule.astro:292`):**

```css
.banner {
  display: inline-block;
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--accent);
  border: 1px solid var(--accent);
  padding: 5px 10px;
  border-radius: 999px;
  margin-bottom: 18px;
}
```

The pre-milestone "Pick a team" banner uses this exact class. In the new `/manage` editor branch, it sits above the `<h1>` headline, visible only when `user.team === null`:

```astro
{!user?.team && (
  <span class="banner">Pick a team</span>
)}
```

No new CSS class needed — `.banner` is already in the style block. [VERIFIED: live source]

---

### Q8: Inline matches list pattern from `schedule.astro`

**Server-side emission (VERIFIED: `src/pages/schedule.astro:174-188`):**

```astro
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
```

**Client-side local-time render (VERIFIED: `src/pages/schedule.astro:257-268`):**

```javascript
try {
  const fmt = new Intl.DateTimeFormat(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
    timeZoneName: 'short',
  });
  document.querySelectorAll('.match-time').forEach((el) => {
    const utc = Number(el.getAttribute('data-utc'));
    if (Number.isFinite(utc)) el.textContent = fmt.format(new Date(utc * 1000));
  });
} catch {}
```

**Single-team model port:** The query in `schedule.astro` first resolves `user.team` slug → `teams.id`, then queries `matches WHERE home_team_id IN (?) OR away_team_id IN (?)`. In Phase 9, with a single slug and a known `teams.id`, the exact same query works. The `selectedIds` array becomes `[row.id]` or `[]` for NULL team.

**Port this verbatim.** The pattern needs no modification for single-team semantics — it already handles `selectedIds.length === 1`. The only change is that the matches section renders `selectedIds.length > 0` (which it does in schedule.astro line 168). [VERIFIED: `src/pages/schedule.astro:34-58`]

**Conditional rendering:** Matches list only appears when `user.team` is set (non-NULL). When `user.team IS NULL`, show only the form (and the banner). The current schedule.astro condition `{selectedIds.length > 0 && (...)}` translates directly. [VERIFIED: `src/pages/schedule.astro:168`]

---

### Q9: Session-or-token dual auth pattern

**`schedule.astro` lines 14-20 (VERIFIED: `src/pages/schedule.astro:8-22`):**

```typescript
const urlToken = url.searchParams.get('token') ?? '';
// Auth: prefer URL token (manage flow on first arrival); fall back to session cookie.
let result = urlToken ? verifyToken(urlToken, 'manage') : null;
if (result) {
  Astro.response.headers.set('Set-Cookie', buildSessionCookie(result.email));
}
if (!result) {
  result = readSessionFromCookie(Astro.request.headers.get('cookie'));
}
```

This ports verbatim to `manage.astro`'s signed-in branch. Key points:
- `verifyToken(urlToken, 'manage')` rejects tokens with wrong purpose (e.g., a `confirm`-purpose token).
- `Set-Cookie` is set via `Astro.response.headers.set(...)` — this works in Astro SSR mode.
- The session read happens only when URL token is absent or invalid.

**`save-selection.ts` lines 41-48 (VERIFIED: `src/pages/api/save-selection.ts:40-48`):**

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

After Phase 9, the `Location` on auth failure changes from `/manage?error=bad-token` to `/manage?error=bad-token` — already correct. The existing auth dual-path requires no change except the redirect target URL (which changes globally in `redirectTo()`). [VERIFIED: `src/pages/api/save-selection.ts:23-27`]

**Important: `manage.astro` currently redirects session-valid users to `/schedule` (line 7):**

```typescript
const session = readSessionFromCookie(...);
if (session) return Astro.redirect('/schedule');
```

This redirect MUST be removed. In Phase 9, a session-valid user at `/manage` should see the editor, not be bounced to `/schedule`. [VERIFIED: `src/pages/manage.astro:5-7`]

---

### Q10: STATUS_COPY map for `/manage?status=`

**Current STATUS_COPY (VERIFIED: `src/pages/schedule.astro:60-67`):**

```typescript
const STATUS_COPY: Record<string, { kind: 'ok' | 'err'; text: string }> = {
  saved:      { kind: 'ok',  text: 'Saved. Your schedule is updated below.' },
  'bad-token':{ kind: 'err', text: 'That link is no longer valid. Request a new one.' },
  'bad-tz':   { kind: 'err', text: "Couldn't read your time zone. Try again." },
  'too-many': { kind: 'err', text: "That's a lot of teams. Pick fewer." },
  unknown:    { kind: 'err', text: "We couldn't find your signup. Sign up at /." },
  server:     { kind: 'err', text: 'Server hiccup. Try again in a minute.' },
};
```

**Delta for Phase 9:**
- `too-many` is dead code in the single-team model. Rename to `bad-team` in the STATUS_COPY (the slug emitted by `redirectTo()` changes from `too-many` to `bad-team` in the handler's failure path). Update the copy: `"Team not recognized. Use the dropdown."` or similar.
- All other slugs remain. The `bad-token` message should still reference "Request a new one" because the signed-out form on the same page is the action.

**STATUS_COPY for unsubscribe status (rendered on `/unsubscribed` page, not `/manage`):** No change needed — `/api/unsubscribe.ts` redirects to `/unsubscribed?status=ok|already|unknown|bad-token`. These are unaffected by Phase 9. [VERIFIED: `src/pages/api/unsubscribe.ts`]

---

### Q11: 1-year token expiry and clock skew

**`verifyToken` expiry check (VERIFIED: `src/lib/token.ts:65`):**

```typescript
if (Math.floor(Date.now() / 1000) > payload.exp) return null;
```

This is `exp > now` semantics: the token is valid as long as `now <= exp`. There is no skew tolerance built in — the comparison is exact epoch-seconds.

**Practical drift for 1-year tokens:** `Date.now()` on the production server and the client machine (where the email was received) don't differ — the `exp` is embedded in the token payload and compared against the server's clock. A 1-year token minted at deploy time expires 365 days later. NTP drift on a DigitalOcean droplet is sub-second. No skew issue.

**One real risk:** A user keeps the same email in their inbox for over 1 year without unsubscribing or re-subscribing. Their unsubscribe link stops working. They would need to contact `hello@oddlympics.app`. This is acceptable per D-06's design intent (the token is a long-lived credential, not a session). [VERIFIED: `src/lib/token.ts`]

---

### Q12: Verification strategy — `scripts/smoke-manage.mjs`

**Pattern (VERIFIED: `scripts/smoke-signup.mjs`):**

The smoke script boots against a real local server (`npm run dev` or `npm run build && node ./dist/server/entry.mjs`), opens a real SQLite connection, drives HTTP requests via `fetch()` with `redirect: 'manual'`, and asserts on status codes + Location headers + DB rows. Exit 0 = all PASS.

**9-case shape for `smoke-manage.mjs`:**

| Case | What to test | How to verify |
|------|-------------|---------------|
| M1 | GET `/manage` (no session, no token) → signed-out form | Response 200; HTML contains `action="/api/manage"` |
| M2 | GET `/manage?token=<valid-manage-token>` → editor branch + Set-Cookie | 200; `Set-Cookie` header present; DB row readable |
| M3 | POST `/api/save-selection` with valid session cookie + slug + tz | 303 → `/manage?status=saved`; DB row has updated team + tz |
| M4 | POST `/api/save-selection` with bad slug | 303 → `/manage?status=bad-team`; DB row unchanged |
| M5 | POST `/api/save-selection` with bad tz | 303 → `/manage?status=bad-tz`; DB row unchanged |
| M6 | GET `/manage` with session cookie for a `team=NULL` row | 200; HTML contains banner text "Pick a team" |
| M7 | GET `/schedule` (no query) → 301 → `/manage` | 301; Location == `/manage` |
| M7b | GET `/schedule?token=<token>` → 301 → `/manage?token=<token>` | 301; Location == `/manage?token=<token>` |
| M8 | Unsubscribe token verifies at 1y - 5s fake expiry (construct token manually) | `verifyToken` returns non-null; 303 → `/unsubscribed?status=ok` |
| M9 | Re-subscribe: mark row unsubscribed → re-confirm → row has `unsubscribed_at=NULL`, `confirmed_at` updated | DB assertions only; no HTTP |

**M2 note:** To test URL-token-first-arrival without a real Resend flow, the smoke script mints a manage-purpose token directly via `mintToken(email, { purpose: 'manage' })` using the dev secret, then GETs `/manage?token=<token>`.

**M8 note:** The smoke script imports `mintToken` to construct a token with `exp = now + 1y - 5s` (or just uses a real 1y token and checks the verification path directly). For integration simplicity, a real `mintToken(email, { purpose: 'unsubscribe' })` call and then GET `/api/unsubscribe?token=<token>` covers the end-to-end path.

**npm script name:** `smoke:manage` (colon style, consistent with `smoke:landing`). [VERIFIED: `package.json` scripts]

---

### Q13: Validation Architecture

**Test framework (VERIFIED: `CLAUDE.md`, project has no formal test suite):**

No Jest/Vitest/pytest. Tests are smoke scripts (Node ESM, no test runner). The established pattern is `scripts/smoke-*.mjs` with `exit 0 = PASS`.

**Phase 9 requirement → test map:**

| Req ID | Behavior | Test Type | Command | Coverage |
|--------|----------|-----------|---------|----------|
| MANAGE-01 | Signed-in user sees + updates team/tz | Integration (smoke) | `node scripts/smoke-manage.mjs` | M2, M3 |
| MANAGE-01 | Bad slug rejected | Integration (smoke) | `node scripts/smoke-manage.mjs` | M4 |
| MANAGE-01 | Bad tz rejected | Integration (smoke) | `node scripts/smoke-manage.mjs` | M5 |
| MANAGE-02 | 1-year unsubscribe token verifies + single-use | Integration (smoke) | `node scripts/smoke-manage.mjs` | M8 |
| MANAGE-02 | Second unsubscribe click is no-op | Integration (smoke) | `node scripts/smoke-manage.mjs` | (extend M8 with second click) |
| COMPAT-01 | `team=NULL` row shows banner | Integration (smoke) | `node scripts/smoke-manage.mjs` | M6 |
| COMPAT-01 + SC4 | Re-subscribe clears `unsubscribed_at` | Integration (smoke) | `node scripts/smoke-manage.mjs` | M9 |
| D-01 redirect | `/schedule` → 301 → `/manage` (query preserved) | Integration (smoke) | `node scripts/smoke-manage.mjs` | M7, M7b |
| AC10 | Pre-milestone subscriber loads `/manage`, sees banner, can save | Integration (smoke) | `node scripts/smoke-manage.mjs` | M6 + M3 (with team=NULL row) |

**Sampling rate (consistent with Phase 5):**
- Per wave commit: `node scripts/smoke-manage.mjs`
- Phase gate: all 9+ cases PASS before marking Phase 9 complete

**Wave 0 gaps:**
- `scripts/smoke-manage.mjs` — new file (does not exist yet)
- No framework install needed (Node ESM + better-sqlite3 already present)

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 9 |
|-----------|------------------|
| No framework JS — plain Astro + `<script is:inline>` | The team picker is a native `<select>`; the TZ picker JS is verbatim from `schedule.astro`; no React/Vue |
| One mono font (`ui-monospace, SFMono-Regular, Menlo, ...`) | Paste `<style is:global>` from existing pages into the new `/manage` signed-in branch |
| `--accent: hsl(18 70% 56%)` | Copy `:root` block verbatim; do not introduce new accent values |
| Paste-style `<style is:global>` per page (no Layout.astro until v1.1) | All CSS goes in the `<style is:global>` block of `manage.astro` |
| URL-param error/status messaging with 303 redirects | `STATUS_COPY` map + `<script is:inline>` pattern; no client-side routing |
| Dry-run-by-default for outbound side effects | Smoke script has no outbound email; uses dev console fallback |
| `node:` prefix on built-in imports | Required in all new TypeScript lib files |
| `type` over `interface`, no `any`, prepared-statement generics | Apply to new `db.ts` prepared statement shapes |
| `export const prerender = false;` on all server pages | `manage.astro` and `schedule.astro` both already have this |
| Why-only comments, no what-comments | Token TTL table addition is the kind of non-obvious choice that warrants a why-comment |
| kebab-case files, `SCREAMING_SNAKE_CASE` constants | `TTL_BY_PURPOSE` is the right name; the file `save-selection.ts` stays |
| Honeypot field `name="website"` with `.hp` class | Keep in the signed-out branch of `manage.astro`; not needed in the signed-in editor |
| `noindex` robots meta tag on gated pages | `manage.astro` already has this; keep it in Phase 9 rewrite |

---

## Risks and Open Questions

### Risk 1: `manage.astro` session redirect must be removed

**Current line (VERIFIED: `src/pages/manage.astro:6-7`):**

```typescript
const session = readSessionFromCookie(Astro.request.headers.get('cookie'));
if (session) return Astro.redirect('/schedule');
```

This redirects any session-valid user away from `/manage` to `/schedule`. After Phase 9, `/manage` IS the editor — this redirect must be removed or replaced with the editor branch. If overlooked, the entire feature doesn't work: every signed-in user gets redirected back to old `/schedule`, which now 301s to `/manage`, creating an infinite redirect loop.

**Mitigation:** Mark this as the first code change in the manage.astro plan task. Make it explicit in the acceptance criteria.

### Risk 2: `redirectTo()` target change in `save-selection.ts`

**Current (VERIFIED: `src/pages/api/save-selection.ts:23-27`):**

```typescript
function redirectTo(token: string, status: string, setCookie?: string): Response {
  const params = new URLSearchParams({ status });
  if (token) params.set('token', token);
  const headers: Record<string, string> = { Location: `/schedule?${params}` };
  // ...
}
```

The hardcoded `/schedule?` must become `/manage?`. The `token` param in the URL is still needed during the transition window (a URL-token-first-arrival user submitting the form should remain on the token-authenticated path). After sessions become the primary auth, the `token` param becomes vestigial — but removing it before sessions are stable is premature. Leave the token param logic unchanged.

### Risk 3: `setSelection` WHERE clause blocks unsubscribed users

**Current (VERIFIED: `src/lib/db.ts:231-236`):**

```sql
UPDATE vip_signups
SET team = ?, timezone = ?
WHERE email = ? AND confirmed_at IS NOT NULL AND unsubscribed_at IS NULL
RETURNING *
```

An unsubscribed user who still has a valid session cookie (30-day window) and visits `/manage` can see the editor — but the save will return 0 rows (`RETURNING *` returns nothing), triggering the `unknown` status redirect. The `/manage` editor should ideally not be accessible to unsubscribed users.

**Recommended handling:** Before rendering the editor branch, check `user.unsubscribed_at`. If set, show a minimal message ("You've unsubscribed. Sign up again at /") and hide the form. This prevents the confusing `?status=unknown` error.

This is not a locked decision — it is a discretion call for the planner. Document it as a conditional render check, not a new SQL query.

### Open Question 1: Feature request textarea

`schedule.astro` has a "v1.1 wishlist" demand-capture textarea that posts `feature_request` to `/api/save-selection`. Should this carry over to the `/manage` editor in Phase 9?

**Recommendation:** Drop it from the `/manage` editor. The CONTEXT.md does not mention it, and the demand-capture purpose was served during Phase 2.5. Removing it simplifies the editor. The `insertFeatureRequest` handler in `save-selection.ts` can remain as dead code (or be cleaned up in a later phase) — the safeguard is already there (the failing insert never gates the team save).

### Open Question 2: Logout link placement

`schedule.astro` has a "Log out" form at the bottom of the authenticated branch, posting to `/api/logout`. This should carry over to `/manage`'s signed-in branch — it is part of the session management UX. Confirm the planner includes it.

---

## Standard Stack

No new dependencies. All Phase 9 work uses the existing stack.

| Library | Version | Purpose | Phase 9 Usage |
|---------|---------|---------|--------------|
| `astro` | 5.18.1 (VERIFIED: `node_modules/astro/package.json`) | Framework + SSR routing | `Astro.redirect()` for schedule.astro, SSR frontmatter for manage.astro |
| `better-sqlite3` | 12.9.0 (VERIFIED) | SQLite sync driver | `markConfirmed` prepared statement update |
| `resend` | ^6.12.2 (VERIFIED: `package.json`) | Transactional email | URL change in `sendManageLink()` only |
| `node:crypto` | built-in | HMAC-SHA256 | No change; TTL_BY_PURPOSE is a pure constant table |

**No new npm installs required.**

---

## Recommended Plan Shape

Four plans across three waves, matching the established pattern from Phase 5.

### Wave 1 — Library layer (no UI surface, safe to land first)

**Plan 09-01: `src/lib/token.ts` TTL table**
- Add `TTL_BY_PURPOSE` constant table
- Update `mintToken()` TTL resolution logic
- Verify `buildSessionCookie` still works (it passes `ttlSeconds` explicitly — unaffected)
- Verify `buildUnsubscribeHeaders` now uses 1y automatically
- Acceptance: `node -e "const {mintToken,verifyToken}=await import('./src/lib/token.ts'); ..."` or smoke-level unit assertion

**Plan 09-02: `src/lib/db.ts` + `src/lib/email.ts` library edits**
- Update `markConfirmed` prepared statement (WHERE widening + `unsubscribed_at = NULL`)
- Update `sendManageLink()` URL from `/schedule?token=` to `/manage?token=`
- Acceptance: Grep confirms old URL is gone; SQL shape matches D-07 spec exactly

### Wave 2 — Page + endpoint consolidation (blocked on Wave 1)

**Plan 09-03: `src/pages/schedule.astro` — thin 301 redirect handler**
- Replace entire file content with 4-line redirect handler
- Preserve `export const prerender = false;`
- Use `Astro.redirect(dest, 301)` where `dest = '/manage' + (Astro.url.search || '')`
- Acceptance: `curl -I http://localhost:4321/schedule` → 301, `Location: /manage`; `curl -I "http://localhost:4321/schedule?token=abc"` → 301, `Location: /manage?token=abc`

**Plan 09-04: `src/pages/manage.astro` — full editor rewrite + `src/pages/api/save-selection.ts` update**
- Remove session-redirect-to-/schedule on line 7
- Port the dual-auth pattern (URL token → session cookie) from schedule.astro
- Add signed-in editor branch with: banner (team=NULL), team `<select>`, tz row, save form, matches list, logout link
- Add STATUS_COPY map for `?status=` rendering; replace `too-many` with `bad-team`
- In `save-selection.ts`: switch primary parse from `team_ids[]` to `team` (slug); keep `team_ids[]` fallback; change `redirectTo()` target to `/manage?...`; add `VALID_TEAMS` import and slug validation
- Paste CSS from schedule.astro `<style is:global>` (or manage.astro's, as appropriate — schedule.astro's is richer with flash/match styles)
- Acceptance: `curl http://localhost:4321/manage` → 200 (signed-out form present)

### Wave 3 — Verification (blocked on Wave 2)

**Plan 09-05: `scripts/smoke-manage.mjs` + `npm run smoke:manage`**
- Write 9-case smoke script covering M1–M9
- Add `"smoke:manage": "node scripts/smoke-manage.mjs"` to `package.json` scripts
- Acceptance: `npm run smoke:manage` exits 0 with all cases PASS

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Astro `redirects:` config does not preserve query strings (based on GitHub issue #7890 report and absence of preservation docs) | Q1 | If it does preserve them, the thin-handler approach is still valid — just adds no benefit vs config redirect. Low risk either way. |
| A2 | The feature request textarea (`feature_request` field) in save-selection.ts does not need to carry over to the `/manage` editor | Open Question 1 | If the user wants demand capture on /manage too, add the textarea back. Smoke tests don't cover it. |

---

## Environment Availability

Step 2.6: No new external dependencies identified. All tools (Node 22, better-sqlite3, Astro) are already present and verified. No installation steps required for Phase 9.

---

## Sources

### Primary (HIGH confidence — verified against live source files)
- `src/pages/manage.astro` — current state of manage page (lines 1-114 read)
- `src/pages/schedule.astro` — current state of schedule page (lines 1-351 read)
- `src/pages/api/save-selection.ts` — current handler state (all 99 lines read)
- `src/pages/api/unsubscribe.ts` — unsubscribe handler (all 26 lines read)
- `src/pages/api/confirm.ts` — confirm handler (all 26 lines read)
- `src/lib/token.ts` — token mechanics (all 76 lines read)
- `src/lib/db.ts` — database layer (all 250 lines read)
- `src/lib/email.ts` — email layer (all 101 lines read)
- `src/lib/session.ts` — session helpers (all 51 lines read)
- `src/lib/teams.ts` — VALID_TEAMS set (all 15 lines read)
- `src/lib/timezones.ts` — VALID_TZ set (all 14 lines read)
- `src/pages/index.astro` — team select pattern (lines 1-250 read)
- `references/teams.json` — slug/label/confederation format (first 40 entries sampled)
- `scripts/smoke-signup.mjs` — smoke pattern (all 321 lines read)
- `node_modules/astro/dist/core/render-context.js:544` — `Astro.redirect(path, status=302)` signature verified
- Live DB: SQLite 3.53.0 confirmed; better-sqlite3 12.9.0 confirmed; `RETURNING *` supported since 3.35

### Secondary (MEDIUM confidence)
- Astro 5 docs (routing page): confirmed `Astro.redirect()` exists in SSR mode; status code default is 302
- Astro configuration reference: `redirects:` config confirmed to produce 301 for GET; query preservation not documented

### Tertiary (LOW confidence — single source, needs validation)
- GitHub issue #7890: Astro `redirects:` config does not preserve query strings (issue is old, may be fixed — but the thin-handler approach works regardless) [CITED: github.com/withastro/astro/issues/7890]

---

## RESEARCH COMPLETE

**Phase:** 09 — manage-editor-unsubscribe
**Confidence:** HIGH

### Key Findings

1. The `session → redirect to /schedule` at `manage.astro:7` MUST be removed first — failing to do so creates an infinite 301 loop after the page consolidation.

2. `Astro.redirect(path, 301)` supports an explicit status code (verified in Astro 5.18.1 source). The thin 4-line `schedule.astro` redirect handler is the correct approach; `redirects:` config does not preserve query strings.

3. SQLite 3.53.0 (verified) fully supports `RETURNING *`. The `markConfirmed` WHERE widening and `unsubscribed_at = NULL` clear are safe edits with no version risk.

4. The `buildUnsubscribeHeaders()` call site requires zero changes — adding `TTL_BY_PURPOSE` to `token.ts` automatically makes all future unsubscribe tokens 1-year-lived.

5. The `team_ids[]` → `team` input transition in `save-selection.ts` needs a dual-parse fallback for the deploy window; the fallback can be removed ~1 week after stable deploy.

### Files Created
`.planning/phases/09-manage-editor-unsubscribe/09-RESEARCH.md`

### Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Token mechanics | HIGH | All claims verified against live `src/lib/token.ts` |
| DB patterns | HIGH | Verified against live `src/lib/db.ts`; SQLite 3.53 confirmed |
| Astro redirect | HIGH (approach) / MEDIUM (config limitation) | Source code confirmed `Astro.redirect(path, status)` signature; `redirects:` config limitation from issue report, not official docs |
| CSS/UI patterns | HIGH | Verified against live `.astro` files |
| Smoke script shape | HIGH | Derived from verified Phase 5 pattern |

### Open Questions (for planner to resolve)

1. Should the feature-request textarea (`feature_request` field) carry over to the `/manage` editor? Recommendation: drop it.
2. How should `/manage` handle a session-valid but unsubscribed user who tries to save? Recommendation: conditional render check on `user.unsubscribed_at` before showing the form, with a "you've unsubscribed — re-sign up at /" message.

### Ready for Planning
Research complete. Planner can now create PLAN.md files using the 4-plan wave structure above.
