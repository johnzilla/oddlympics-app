---
phase: 05-schema-signup-payload
reviewed: 2026-05-13T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - scripts/backup-pre-05.mjs
  - scripts/backfill-team-slugs.mjs
  - scripts/ingest-schedule.mjs
  - scripts/send-kickoff-notifications.mjs
  - scripts/smoke-signup.mjs
  - src/lib/db.ts
  - src/lib/teams.ts
  - src/lib/timezones.ts
  - src/pages/api/save-selection.ts
  - src/pages/api/signup.ts
  - src/pages/schedule.astro
findings:
  critical: 0
  warning: 5
  info: 5
  total: 10
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-05-13
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Phase 5 widens `/api/signup` to accept team + timezone, runs the first
non-additive SQLite migration (`vip_signups.team` added, `selected_teams`
dropped), and updates three downstream consumers (kickoff cron, `/schedule`,
`/api/save-selection`). The smoke test reports 8/8 PASS.

No Critical findings. The new code paths are parameterized at SQL boundaries,
HTML-escaped where Astro auto-escapes, and follow the project's dry-run /
purpose-claim / idempotent-migration conventions. The migration's DROP COLUMN
gate on SQLite 3.35 is the right pattern.

Five Warnings are flagged. The most material ones for plan 06's landing-page
work:

1. **WR-01** — the kickoff cron's HTML email interpolates third-party feed
   names (`match.home_name`, `match.group_name`) into HTML without escaping.
   football-data.org names like `Côte d'Ivoire` are benign today but the
   feed is an untrusted boundary; a future name with `<` or `&` would render
   broken-looking emails or fire a content-policy alarm in mail clients.
2. **WR-02** — `clientIp()` blindly trusts the first `X-Forwarded-For`
   value, which lets any client downstream of Caddy spoof the rate-limit
   key by setting their own XFF header. The smoke test exploits exactly
   this (sets `X-Forwarded-For: 192.0.2.42`). Pre-existing, but Phase 5
   leans on rate-limiting harder now (team validation is gated behind it),
   worth surfacing before plan 06 publishes the landing page.
3. **WR-03** — `save-selection.ts` does a per-iteration synchronous DB
   SELECT inside a loop over user-controlled `team_ids[]`. Currently capped
   by form input but should fetch all matching slugs in one query.

Two TypeScript correctness gaps (**WR-04**, **WR-05**) on `.mjs` scripts
that lack defensive checks on third-party API shapes and JSON catalog
shapes — operationally fine today, brittle to upstream changes.

The five Info items are convention/cleanup nits.

## Warnings

### WR-01: HTML email body interpolates third-party feed strings without escaping

**File:** `scripts/send-kickoff-notifications.mjs:150-159`
**Issue:** `buildEmail()` constructs the HTML body via template-literal
interpolation of `match.home_name`, `match.away_name`, `stage` (derived
from `match.group_name` or `match.stage`), and `url`. Team names come from
football-data.org, an external feed not under our control, and are stored
verbatim in `teams.name`. If any future name contains `<`, `>`, `&`, or
`"`, the email will render broken HTML or trigger spam-filter content
policies. Worst case (low-likelihood but defensible) is that an attacker
who compromises football-data.org could inject crafted markup; more
realistically, a real team name like `O'Higgins` already contains a `'`
that renders fine but illustrates the missing escape.

The plain-text `text` body is fine (no parser context). Only the HTML
branch needs escaping.

**Fix:**
```js
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
// then in the HTML body:
const html = `...<h1>${esc(match.home_name)} <span ...>vs</span> ${esc(match.away_name)}</h1>...`;
// and for the href:
`<a href="${esc(url)}">`
```

### WR-02: clientIp() trusts the first X-Forwarded-For value verbatim, allowing rate-limit-key spoofing

**File:** `src/pages/api/signup.ts:14-18`
**Issue:** `clientIp()` returns `xff.split(',')[0].trim()` from the
`X-Forwarded-For` header. In production Caddy adds the real client IP and
forwards. But any HTTP client can send `X-Forwarded-For: 1.2.3.4` directly
and have the app trust it as the rate-limit key. Two consequences:

1. An attacker can rotate spoofed IPs to bypass the 5-per-hour cap on
   `ip:<ip>`. The `email:<email>` cap still holds, so the attacker can't
   spam *one* email — but they can spam *many* emails (one per spoofed
   IP) which is exactly the bot-signup pattern we're trying to deter.
2. The DB column `ip` (stored on the signup row) is poisoned with
   attacker-controlled values.

Caddy strips/replaces XFF only if explicitly configured. If the droplet's
Caddyfile uses default `reverse_proxy` directive, Caddy *appends* to XFF
rather than replacing it.

This is a pre-Phase-5 issue, but the smoke test relies on it (line 39,
`SMOKE_IP = '192.0.2.42'`) and Phase 5 now gates team validation behind
the rate limit, so it's more load-bearing than before.

**Fix:** Trust only the right-most XFF value when behind a known
trusted proxy, or use the socket peer address. With Astro + Node adapter
behind Caddy on localhost, the right-most XFF is the one Caddy added:
```ts
function clientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    // Caddy appends the real peer IP rightmost; take that, not the leftmost
    // attacker-controlled value.
    const parts = xff.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }
  return request.headers.get('x-real-ip') ?? 'unknown';
}
```
Verify the Caddyfile sets `X-Real-IP` or that the rightmost XFF is what
Caddy added. If unsure, prefer `X-Real-IP` (which Caddy controls) and
ignore XFF entirely.

### WR-03: save-selection.ts runs a per-iteration DB SELECT inside a user-controlled loop

**File:** `src/pages/api/save-selection.ts:53-65`
**Issue:** For each `team_ids[]` value the client posts, the handler does
a regex check then a synchronous `db.prepare('SELECT slug FROM teams
WHERE id = ?').get(n)`. The loop also re-prepares the statement on every
request (the `db.prepare(...)` call is inside the handler, not module
scope), which `better-sqlite3` caches but still incurs work.

A client can POST hundreds of `team_ids[]` values; the early-exit
`break` only triggers on the *first* row that has a non-null slug, so
worst case is hundreds of synchronous DB queries blocking the event
loop. Pre-Phase-5 the schema persisted multiple teams so this loop made
sense; Phase 5 takes only the first, making the per-iteration DB call
unnecessary.

**Fix:** Collect candidate IDs first, run one `IN (...)` query, take the
first non-null slug:
```ts
const STMT_SLUGS = db.prepare(
  // Module-scope so prepare runs once.
  `SELECT id, slug FROM teams WHERE id IN (SELECT value FROM json_each(?))`,
);
// inside handler:
const candidates = rawIds
  .map((s) => (s ?? '').trim())
  .filter((s) => TEAM_ID_RE.test(s))
  .map(Number)
  .filter((n) => n > 0);
if (candidates.length === 0) return redirectTo(formToken, 'too-many');
// Or simpler: cap candidates server-side (e.g. .slice(0, 64)) and use
// the existing single-row query in a bounded loop.
```
Minimum viable fix: `candidates.slice(0, 48)` before the loop — bounds
the attack surface to the 48 legitimate teams.

### WR-04: ingest-schedule.mjs lacks shape validation on football-data.org response

**File:** `scripts/ingest-schedule.mjs:117-162`
**Issue:** The script destructures `teamsResp.teams`, `matchesResp.matches`,
`t.id`, `t.tla`, `t.name`, `t.crest`, `m.utcDate`, `m.id`, `m.stage`,
`m.group`, `m.homeTeam?.id`, `m.awayTeam?.id`, `m.status` with no
validation. If the API changes shape (e.g. renames `tla` to `code`, or
returns `tla: null` for unconfirmed qualifiers), `upsertTeam.run(t.id,
t.tla, t.name, ...)` will violate `NOT NULL` on `teams.tla` and the
*entire transaction* will rollback — the ingest silently produces zero
rows and exits 0.

Same risk for `m.stage`/`m.status` (NOT NULL) and `Math.floor(new
Date(m.utcDate).getTime() / 1000)` returning `NaN` for malformed dates.
The `if (!m.utcDate)` check covers some but not all of this.

**Fix:** Add a per-row guard that skips and logs malformed rows instead
of failing the whole transaction:
```js
for (const t of teams) {
  if (typeof t.id !== 'number' || !t.tla || !t.name) {
    console.warn(`[ingest] skip team malformed: ${JSON.stringify(t).slice(0, 200)}`);
    continue;
  }
  // ...
}
```
And clamp `Math.floor` result with `Number.isFinite()` before insert.

### WR-05: backfill-team-slugs.mjs and ingest-schedule.mjs assume teams.json shape without runtime validation

**File:** `scripts/backfill-team-slugs.mjs:39-40`, `scripts/ingest-schedule.mjs:35-36`
**Issue:** Both scripts do
`new Map(teamsCatalog.map((t) => [t.label, t.slug]))` with no check that
the parsed JSON is an array or that each entry has both `label` and
`slug`. A hand-edit that drops a brace or accidentally sets `slug: null`
silently produces a Map with `undefined` keys/values, and the affected
team slugs go missing without diagnosis.

teams.json is hand-authored per CLAUDE.md ("48 entries, lives at repo
root, hand-edited when football-data.org names drift"), so operator
error is a foreseeable failure mode.

**Fix:** Add a shape probe after the JSON parse:
```js
const teamsCatalog = JSON.parse(readFileSync(TEAMS_JSON_PATH, 'utf-8'));
if (!Array.isArray(teamsCatalog)) {
  throw new Error(`teams.json is not an array`);
}
for (const t of teamsCatalog) {
  if (typeof t?.label !== 'string' || typeof t?.slug !== 'string') {
    throw new Error(`teams.json entry missing label/slug: ${JSON.stringify(t)}`);
  }
}
```
The smoke test already enforces `length === 48` — extend that pattern
into the runtime scripts.

## Info

### IN-01: smoke-signup.mjs case-7 comment misstates the validation order

**File:** `scripts/smoke-signup.mjs:281-287`
**Issue:** The comment says "Cases 2 and 3 hit bad-form which is BEFORE
the rate limiter, also not counted" — but `src/pages/api/signup.ts:72-77`
applies the rate limiter (line 72) BEFORE team validation (line 77). So
cases 2 and 3 *do* consume rate-limit slots.

The test still passes (after cases 1-5, SMOKE_IP has consumed 5/5 slots;
case 7's first POST is already rate-limited, and only the last response
is inspected), but the comment's reasoning is wrong and could mislead a
future maintainer who edits the limiter-ordering and trusts the comment.

**Fix:** Rewrite the comment to reflect actual order:
```
// rate-limit.ts: MAX_PER_WINDOW = 5 per WINDOW_MS = 1h, keyed by 'ip:<ip>' AND 'email:<email>'.
// The rate limiter is BEFORE team/tz validation in signup.ts, so every prior case
// that got past Origin + honeypot + email regex consumed a slot:
//   case 1 (valid), case 2 (missing team), case 3 (bad team),
//   case 4 (missing tz), case 5 (bad tz) — 5 IP slots used.
// Case 6 (honeypot) short-circuits BEFORE the rate limiter (line 58 < line 72),
// so it doesn't count. After cases 1-6, SMOKE_IP is at 5/5; the first POST in
// case 7 is already rate-limited. We loop 4 to be safe and check the last response.
```

### IN-02: token machinery duplicated across send-kickoff-notifications.mjs and src/lib/token.ts

**File:** `scripts/send-kickoff-notifications.mjs:45-60`
**Issue:** `b64u`, `sign`, and `mintManageToken` are hand-reimplemented to
keep the script "self-contained" (per the inline comment). The HMAC
construction must stay byte-identical to `src/lib/token.ts`'s
`mintToken(email, { purpose: 'manage' })` output, since `verifyToken` in
the server signs the same bytes and a one-character drift silently breaks
every magic link from the cron.

If a future edit to `src/lib/token.ts` (e.g. payload shape, signing algo,
b64url variant) is not mirrored here, the cron's tokens will all 401.
There's no test catching this drift.

**Fix:** Either import from `src/lib/token.ts` (the script is `.mjs` but
better-sqlite3 already imports natively; a small ESM shim or running the
script through `tsx` is feasible), or add an assertion at the top of the
script that mints a token and verifies it against `src/lib/token.ts` via
a tiny child-process spawn. Cheaper short-term fix: add a comment on
both sides — "KEEP IN SYNC with scripts/send-kickoff-notifications.mjs"
— so the drift risk is at least surfaced.

### IN-03: schedule.astro uses Astro.response.headers.set (not .append) for Set-Cookie

**File:** `src/pages/schedule.astro:16`
**Issue:** `Astro.response.headers.set('Set-Cookie', buildSessionCookie(...))`
replaces any prior `Set-Cookie` header on the response. Currently nothing
else on this code path sets a cookie, so this is fine. But the HTTP spec
allows multiple `Set-Cookie` headers, and `.set` would silently clobber
if a future middleware or library added one. `.append` is the safer
default.

**Fix:**
```astro
Astro.response.headers.append('Set-Cookie', buildSessionCookie(result.email));
```

### IN-04: save-selection.ts re-prepares the slug-lookup statement on every request

**File:** `src/pages/api/save-selection.ts:60`
**Issue:** `db.prepare('SELECT slug FROM teams WHERE id = ?')` lives
inside the POST handler, so it runs on every request. `better-sqlite3`
caches prepared statements internally, but the convention elsewhere in
the codebase (`db.ts` lines 77, 91, 98, 102, 193, 206, 221, 227, 242)
is to declare prepared statements at module scope. Drift from the
convention is small but the file is the only one in scope that
violates it.

**Fix:** Move to module scope:
```ts
const slugById = db.prepare<[number]>('SELECT slug FROM teams WHERE id = ?');
// then inside the handler:
const row = slugById.get(n) as { slug: string | null } | undefined;
```
(Combine with WR-03 for the larger refactor.)

### IN-05: schedule.astro auto-resaves session cookie even when a stale URL token is presented

**File:** `src/pages/schedule.astro:14-17`
**Issue:** Currently:
```astro
let result = urlToken ? verifyToken(urlToken, 'manage') : null;
if (result) {
  Astro.response.headers.set('Set-Cookie', buildSessionCookie(result.email));
}
if (!result) {
  result = readSessionFromCookie(Astro.request.headers.get('cookie'));
}
```
This is correct on the happy path, but the cookie is *only* refreshed
when a URL token is present and valid — not on plain session-cookie
visits. `readSessionFromCookie` does its own sliding-window renewal
internally (per `src/lib/session.ts`), so behavior is correct, but the
asymmetry makes the file harder to read. Future maintainer might think
session-cookie visits don't refresh and add a redundant `.set`.

**Fix:** Add a one-line comment noting that `readSessionFromCookie`
handles the sliding-window renewal itself:
```astro
// URL-token entry mints a fresh 30-day cookie. Returning-cookie users
// get their sliding-window renewal inside readSessionFromCookie().
```
No code change needed.

---

_Reviewed: 2026-05-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
