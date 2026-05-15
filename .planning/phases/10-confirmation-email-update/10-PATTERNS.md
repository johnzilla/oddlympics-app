# Phase 10: Confirmation email update — Pattern Map

**Mapped:** 2026-05-15
**Files analyzed:** 8 (5 modified, 3 created)
**Analogs found:** 8 / 8 (all have strong in-repo analogs)

> All analogs live in this same repo. No external pattern lookups required.
> The phase is small, surgical, and every new symbol has a within-arm's-reach
> sibling to copy from byte-for-byte.

---

## File Classification

| New/Modified File | Status | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|--------|------|-----------|----------------|---------------|
| `src/lib/email.ts` | MODIFIED | email-send lib (Resend integration) | request-response (HTTP side-effect) | `src/lib/email.ts` itself — `sendMagicLink` (15–53) + `sendManageLink` (67–100) | exact (in-file) |
| `src/lib/teams.ts` | MODIFIED | pure data-lookup helper | transform (slug → label) | `src/lib/teams.ts:12-14` (`isValidTeamSlug`) | exact (in-file) |
| `src/lib/timezones.ts` | MODIFIED | pure data-lookup helper | transform (IANA → human) | `src/pages/index.astro:204-210` (the inline JS algorithm Phase 10 ports) | exact-algorithm |
| `src/pages/api/signup.ts` | MODIFIED | Astro APIRoute (server handler) | request-response | `src/pages/api/signup.ts:109` (existing call site) | exact (in-file) |
| `scripts/smoke-confirm-email.mjs` | CREATED | Node ESM offline smoke | batch / table-driven assertions | `scripts/smoke-signup.mjs` + `scripts/smoke-manage.mjs` | role-match |
| `package.json` | MODIFIED | script-alias config | n/a | `package.json:13-14` (`smoke:landing`, `smoke:manage`) | exact (in-file) |
| `.planning/phases/10-confirmation-email-update/evidence/` | CREATED | operator-evidence dir | n/a | none (Phase 10 is first to commit screenshot evidence under `evidence/`) | NO analog |
| `.planning/phases/10-confirmation-email-update/10-SUMMARY.md` | CREATED | per-plan summary doc | n/a | `.planning/phases/09-manage-editor-unsubscribe/09-05-SUMMARY.md` | role-match |

> Watchout for the planner: CONTEXT.md / RESEARCH.md narratively refer to a
> `smoke:signup` npm script, but `package.json` only currently wires
> `smoke:landing` (13) + `smoke:manage` (14). The smoke-signup script exists
> on disk (`scripts/smoke-signup.mjs`) but is invoked via the bare path, not
> an npm alias. Phase 10's `smoke:confirm` alias is the **third** entry in
> the `scripts:` block, not the third-to-fourth — verify before editing.

---

## Pattern Assignments

### `src/lib/email.ts` (MODIFIED — email-send lib, request-response)

**Analog:** the same file's two existing sends (`sendMagicLink`, `sendManageLink`)
plus `buildUnsubscribeHeaders`. Phase 10 widens the first, leaves the second
untouched, and wires the third into the first.

**Match this pattern — module preamble (`src/lib/email.ts:1-13`):**
```ts
import { Resend } from 'resend';
import { mintToken } from './token';

const API_KEY = process.env.RESEND_API_KEY ?? '';
const FROM = process.env.EMAIL_FROM ?? 'oddlympics <onboarding@resend.dev>';
const SITE_URL = process.env.PUBLIC_SITE_URL ?? 'http://localhost:4321';
const isProd = process.env.NODE_ENV === 'production';

if (!API_KEY && isProd) {
  throw new Error('RESEND_API_KEY is required in production');
}

const resend = API_KEY ? new Resend(API_KEY) : null;
```
**Why this matters for Phase 10:** Do NOT touch this block. The module-load
side-effect (throw on prod boot if `RESEND_API_KEY` missing) is part of the
contract. New helper imports (`teamLabel` from `./teams`, `tzLabel` from
`./timezones`) go at the top of the import list, kept ESM-relative.

---

**Match this pattern — current `sendMagicLink` signature + body shape
(`src/lib/email.ts:15-53`):**
```ts
export async function sendMagicLink(email: string, token: string): Promise<void> {
  const url = `${SITE_URL}/api/confirm?token=${encodeURIComponent(token)}`;
  const subject = 'Confirm your spot — oddlympics';
  const text = [
    'Confirm your VIP spot for oddlympics.',
    '',
    'Click the link below to lock in your early access:',
    url,
    '',
    "We'll email you when it's time. No spam, no marketing — just the launch ping.",
    '',
    "If you didn't request this, ignore this email.",
    '',
    '— oddlympics',
  ].join('\n');

  const html = `<!doctype html>
<html><body style="font:14px ui-monospace,SFMono-Regular,Menlo,monospace;color:#111;background:#fafafa;padding:32px">
<div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #eee;border-radius:8px;padding:28px">
  <h1 style="font-size:18px;margin:0 0 12px">Confirm your spot</h1>
  <p style="margin:0 0 20px;line-height:1.55">Click below to lock in your early access for <strong>oddlympics</strong>.</p>
  <p style="margin:0 0 24px"><a href="${url}" style="display:inline-block;background:hsl(18 70% 56%);color:#0b0b0e;text-decoration:none;padding:12px 18px;border-radius:6px;font-weight:700">Confirm email</a></p>
  <p style="margin:0 0 8px;color:#666;font-size:12px">Or paste this URL:</p>
  <p style="margin:0 0 24px;word-break:break-all;color:#666;font-size:12px">${url}</p>
  <p style="margin:0;color:#999;font-size:11px">No spam, no marketing — just the launch ping. If you didn't request this, ignore this email.</p>
</div>
</body></html>`;
```
**Why this matters for Phase 10:**
- D-01 widens the signature to `(email, token, team, timezone)`. Keep the
  `Promise<void>` return type and `async` keyword. Argument order: email, token,
  team, timezone (the rationale chain — caller-passes-validated-primitives —
  is in CONTEXT D-01).
- D-04 rewrites the value-prop paragraph. The two locations are:
  - plain-text array entry 5 (line 24 above) — currently the
    `"We'll email you when it's time. No spam..."` line; replace verbatim with
    `` `We'll email you 1 hour before every ${teamHuman} match in ${tzHuman}.` ``
    (ASCII apostrophe — 0x27).
  - HTML `<p>` at line 35 above — `Click below to lock in your early access for <strong>oddlympics</strong>.`;
    replace verbatim with
    `` `We'll email you 1 hour before every <strong>${teamHuman}</strong> match in ${tzHuman}.` ``.
- D-05 swaps the subject literal (line 17 above) to
  `'Confirm your World Cup alerts — oddlympics'`.
- The H1 (line 34 above) and the disclaimer paragraph (line 39) should be
  updated to match the consumer pivot per CONTEXT §Specific Ideas — the
  planner has discretion on the exact phrasing.

---

**Match this pattern — dev-fallback console.log (`src/lib/email.ts:43-49`):**
```ts
  if (!resend) {
    // Dev fallback: print the magic link to the console so you can test the flow
    // without configuring Resend.
    console.log('\n[email-dev-fallback] Magic link for', email);
    console.log('  ', url, '\n');
    return;
  }
```
**Why this matters for Phase 10:** Preserve the `if (!resend)` short-circuit
verbatim — it's a documented project invariant (CLAUDE.md §"Dev email
fallback"). CONTEXT §code_context adds one *extension*: the dev-fallback log
should also print the rendered value-prop line so a contributor can verify
team + tz interpolation without firing Resend. Suggested third `console.log`:
`console.log('   body:', \`every ${teamHuman} match in ${tzHuman}\`, '\n');`

---

**Match this pattern — Resend `emails.send` call (`src/lib/email.ts:51`):**
```ts
  const { error } = await resend.emails.send({ from: FROM, to: email, subject, text, html });
  if (error) throw new Error(`Resend error: ${error.message}`);
```
**Why this matters for Phase 10:** This is the exact send shape Phase 10
widens. Add two fields:
1. `replyTo: 'hello@oddlympics.app'` — **note**: the typed SDK field on
   `CreateEmailBaseOptions` is `replyTo` (camelCase) at
   `node_modules/resend/dist/index.d.mts:551`, NOT `reply_to` as a few
   RESEARCH.md prose snippets suggest. (The HTTP wire takes `reply_to`; the
   SDK translates. Stay on the typed field.)
2. `headers: buildUnsubscribeHeaders(email)` — spread the existing helper's
   return value directly into `headers`.

Resulting shape:
```ts
const { error } = await resend.emails.send({
  from: FROM,
  to: email,
  subject,
  text,
  html,
  replyTo: 'hello@oddlympics.app',
  headers: buildUnsubscribeHeaders(email),
});
if (error) throw new Error(`Resend error: ${error.message}`);
```

Error handling is unchanged: throw `Resend error: …`; the caller catches and
redirects per the established three-pattern error contract (CONTEXT §code_context).

---

**Match this pattern — `buildUnsubscribeHeaders` shape (`src/lib/email.ts:55-65`):**
```ts
export function buildUnsubscribeHeaders(email: string): {
  'List-Unsubscribe': string;
  'List-Unsubscribe-Post': string;
} {
  const token = mintToken(email, { purpose: 'unsubscribe' });
  const url = `${SITE_URL}/api/unsubscribe?token=${encodeURIComponent(token)}`;
  return {
    'List-Unsubscribe': `<${url}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}
```
**Why this matters for Phase 10:** DO NOT MODIFY. Phase 9 D-05 already gave
the `unsubscribe` purpose a 1-year TTL via `TTL_BY_PURPOSE` in `token.ts`;
this helper inherits that automatically. Phase 10 calls it from
`sendMagicLink` (it was never wired to the confirmation send before — only
to the unsubscribe-page response path).

---

**Match this pattern — `sendManageLink` (`src/lib/email.ts:67-100`, the sibling-don't-touch):**
The reason this matters is **negative**: `sendManageLink` is locked by Phase 9
D-01 and Phase 10 must NOT touch it. Its HTML card shape (mono font, accent
button, paste-URL hint) is the structural template `sendMagicLink` already
mirrors — keep that mirroring intact. If the planner extracts a private
`buildConfirmBody({email, url, team, tz})` helper (CONTEXT §Discretion), the
extraction must NOT touch `sendManageLink`'s inline body.

---

### `src/lib/teams.ts` (MODIFIED — pure data-lookup helper, transform)

**Analog:** the same file's existing `isValidTeamSlug` function — same
`TEAMS.find(...)` access pattern, same one-line body.

**Match this pattern — existing helper (`src/lib/teams.ts:1-14`):**
```ts
import teams from '../../references/teams.json' with { type: 'json' };

export type TeamEntry = {
  slug: string;
  label: string;
  confederation: 'UEFA' | 'CONMEBOL' | 'CONCACAF' | 'CAF' | 'AFC' | 'OFC';
};

export const TEAMS: readonly TeamEntry[] = teams as TeamEntry[];
export const VALID_TEAMS: ReadonlySet<string> = new Set(TEAMS.map((t) => t.slug));

export function isValidTeamSlug(slug: string): boolean {
  return VALID_TEAMS.has(slug);
}
```
**Why this matters for Phase 10:**
- `TEAMS` is already in scope — `TeamEntry.label` is exactly the human-readable
  string D-03 wants (e.g., `england` → "England", `bosnia` →
  "Bosnia and Herzegovina"; diacritics preserved per FORM-02).
- The new `teamLabel(slug)` helper slots in **next to** `isValidTeamSlug`
  (same naming cadence: `is…` returns boolean, `…Label` returns string).
- Return type annotation is mandatory (CLAUDE.md TS conventions). No JSDoc;
  no why-comment needed — the function name is self-documenting.

**Suggested addition (CONTEXT §Specific Ideas, line 423):**
```ts
export function teamLabel(slug: string): string {
  return TEAMS.find((t) => t.slug === slug)?.label ?? slug;
}
```
**Why fallback to the raw slug:** future-proofs against retired-team rows
in `vip_signups` where the slug is no longer in `TEAMS`. Returning the slug
is ugly but never produces an empty span in the email body — the alternative
("Unknown team") would be worse copy.

---

### `src/lib/timezones.ts` (MODIFIED — pure data-lookup helper, transform)

**Analog (intra-repo, cross-language):** the inline JS at
`src/pages/index.astro:198-211`. The new server-side TS helper must produce
byte-identical output for every input the JS sees — the email-side label and
the landing-page label must agree.

**Match this pattern — existing TS scaffolding (`src/lib/timezones.ts:1-15`):**
```ts
export const FALLBACK_TZ = 'America/New_York' as const;

function buildTzSet(): ReadonlySet<string> {
  try {
    return new Set(Intl.supportedValuesOf('timeZone'));
  } catch {
    return new Set([FALLBACK_TZ]);
  }
}

export const VALID_TZ: ReadonlySet<string> = buildTzSet();

export function isValidTimezone(tz: string): boolean {
  return VALID_TZ.has(tz);
}
```
**Why this matters for Phase 10:** Same file convention — `FALLBACK_TZ`
constant, `VALID_TZ` Set, sibling `isValid…` boolean helper. The new
`tzLabel` slots next to `isValidTimezone` (parallel structure with
`teams.ts`).

---

**Match this pattern — algorithm to port verbatim (`src/pages/index.astro:200-210`):**
```js
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
```
**Why this matters for Phase 10:** The algorithm's three branches map
directly to the new TS helper:
1. `tz` falsy OR no `/` OR starts with `Etc/` → return `'your local time'`
2. last segment of `tz.split('/')`, replace `_` with space → `'${human} time'`
3. empty post-replace → `'your local time'`

**Suggested addition (CONTEXT D-02 / §Specific Ideas):**
```ts
// Mirrors the landing-page JS at src/pages/index.astro:204-210 byte-for-byte
// so the email body's tz label matches what the user just read on /.
export function tzLabel(tz: string): string {
  if (!tz || tz.indexOf('/') === -1 || tz.indexOf('Etc/') === 0) return 'your local time';
  const last = tz.split('/').pop() ?? '';
  const human = last.replace(/_/g, ' ');
  return human ? `${human} time` : 'your local time';
}
```
**Why the comment earns its keep:** CLAUDE.md "no comments explaining what
code does — only why-comments". This is exactly the rare case where a
why-comment is warranted: the cross-file byte-equivalence is the invariant
the smoke verifies, and a future drift would be silent without the comment.

---

### `src/pages/api/signup.ts` (MODIFIED — Astro APIRoute, request-response)

**Analog:** the same file's existing call site + the same file's existing
validation chain that produces the two new args.

**Match this pattern — validation chain that produces `rawTeam` and `tz` (`src/pages/api/signup.ts:75-90`):**
```ts
// Phase 5 — SIGNUP-01 / COMPAT-02: team must be a known slug from references/teams.json.
const rawTeam = ((form.get('team') as string | null) ?? '').trim().toLowerCase();
if (!VALID_TEAMS.has(rawTeam)) {
  console.log(`[signup] bad-team rejected email=${rawEmail} input=${JSON.stringify(rawTeam)}`);
  return back('bad-form');
}

// Phase 5 — SIGNUP-02: timezone fallback (does NOT reject).
const rawTz = ((form.get('timezone') as string | null) ?? '').trim();
let tz: string;
if (rawTz && VALID_TZ.has(rawTz)) {
  tz = rawTz;
} else {
  tz = FALLBACK_TZ;
  console.log(`[signup] tz-fallback email=${rawEmail} input=${JSON.stringify(rawTz)}`);
}
```
**Why this matters for Phase 10:** Both `rawTeam` (member of `VALID_TEAMS`)
and `tz` (member of `VALID_TZ` or literally `FALLBACK_TZ`) are guaranteed
non-empty, known-good strings by the time the `sendMagicLink` call is reached
on line 109. The caller-passes-validated-primitives contract in CONTEXT D-01
is a real contract, not a hope.

---

**Match this pattern — current `sendMagicLink` call site (`src/pages/api/signup.ts:106-113`):**
```ts
const token = mintToken(rawEmail);

try {
  await sendMagicLink(rawEmail, token);
} catch (err) {
  console.error('[signup] email error', err);
  return back('email');
}
```
**Why this matters for Phase 10:** This is the **only** caller of
`sendMagicLink`. The widen edit is exactly:
```ts
await sendMagicLink(rawEmail, token, rawTeam, tz);
```
**Do NOT touch:**
- The try/catch shape (lib-throws / caller-catches is the established
  three-error-pattern; CONVENTIONS.md §"Error handling").
- The `console.error` log tag `[signup] email error` (Phase 9 may grep for it).
- The `back('email')` redirect (`?error=email`) — Phase 6 D-* binds the
  error-code surface; introducing `?error=email-bad-team` or similar would
  be a COMPAT-02 violation.

---

### `scripts/smoke-confirm-email.mjs` (CREATED — Node ESM offline smoke, batch / table-driven)

**Analogs:** `scripts/smoke-signup.mjs` (320 lines) + `scripts/smoke-manage.mjs`
(588 lines). The Phase 10 smoke is **offline** (no server boot, no DB) — closer
to `smoke-manage.mjs`'s helper-style portions than to `smoke-signup.mjs`'s
HTTP-driven cases. Total target: ~80 lines.

**Match this pattern — header banner + run instructions (`scripts/smoke-signup.mjs:1-32`):**
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
//   OR (against the built server):
//     npm run build && node ./dist/server/entry.mjs
//   Then in this terminal:
//     node scripts/smoke-signup.mjs
//
// Exit codes:
//   0 = all PASS
//   1 = any FAIL
//   2 = setup error (server unreachable, DB unreadable)
```
**Why this matters for Phase 10:** Same shebang, same Phase-N — Plan-NN
header line, same How-to-run + Exit-codes block. Phase 10's smoke has NO
server prerequisite — drop the `Boot a dev server` lines. Exit code 2 is
unreachable (no setup dep); keep the table for consistency anyway.

---

**Match this pattern — `runCase` harness (`scripts/smoke-signup.mjs:52-69`):**
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
**Why this matters for Phase 10:** Drop in verbatim. The harness is reusable,
zero-dependency, and `[smoke] PASS|FAIL` tags are how the operator audit log
reads. The 10 cases (CONTEXT D-10 + RESEARCH §8) each become a `runCase` call.

---

**Match this pattern — final tally + exit (`scripts/smoke-signup.mjs:311-320`):**
```js
console.log(`[smoke] result: pass=${pass} fail=${fail}`);
db.close();

if (fail > 0) {
  console.log(
    "[smoke] cleanup: sqlite3 data/oddlympics.db \"DELETE FROM vip_signups WHERE email LIKE 'smoke-%@example.com'\"",
  );
}

process.exit(fail === 0 ? 0 : 1);
```
**Why this matters for Phase 10:** Same tally format. Drop the
`db.close()` and the cleanup hint — both are HTTP/DB-state artifacts; Phase
10's smoke is offline + stateless. Keep the `process.exit(fail === 0 ? 0 : 1)`.

---

**Match this pattern — re-implementing TS helpers inline to dodge TS-loader friction (`scripts/smoke-manage.mjs:58-74`):**
```js
// ---------------------------------------------------------------------------
// Inline token signing — mirrors src/lib/token.ts mintToken exactly.
// Re-implemented via node:crypto rather than importing the .ts source to avoid
// TypeScript loader friction and keep the smoke isolated from future TS-only
// language features.
// ---------------------------------------------------------------------------
function b64url(buf) {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function sign(data) {
  return b64url(createHmac('sha256', SECRET).update(data).digest());
}
```
**Why this matters for Phase 10 (RESEARCH §8 path (a)):** The smoke
**re-implements** `teamLabel`, `tzLabel`, and the body composer inline rather
than importing from `src/lib/`. This is the established pattern, not a
workaround. Two reasons:
1. Zero TS-loader friction (no `tsx` / `ts-node` dependency).
2. The byte-exact duplication is the *point* — the smoke is a second source
   of truth, so a future drift in the lib code (someone "improves" the
   algorithm) gets caught.

Inline weight is small: 2× helper (~5 lines each) + body composer (~30 lines)
+ TEAMS literal needed for `teamLabel` lookup. Use `references/teams.json`
read via `node:fs` + `JSON.parse` — same pattern as `smoke-signup.mjs:34`
(`import { readFileSync } from 'node:fs'`).

---

**The 10 smoke cases (RESEARCH §8 table, ready for the planner to translate):**

| # | Case (input) | Assertion (against composed body) |
|---|--------------|-----------------------------------|
| 1 | `team=england, tz=America/Detroit` | body contains `every England match in Detroit time.` |
| 2 | `team=united_states, tz=Europe/London` | body contains `every United States match in London time.` |
| 3 | `team=france, tz=America/New_York` (FALLBACK) | body contains `every France match in New York time.` |
| 4 | `team=brazil, tz=Asia/Ho_Chi_Minh` | body contains `every Brazil match in Ho Chi Minh time.` |
| 5 | `team=germany, tz=Etc/UTC` | body contains `every Germany match in your local time.` |
| 6 | `team=curacao, tz=America/Curacao` | body contains `every Curaçao match in Curacao time.` (diacritic preserved) |
| 7 | subject literal | equals `Confirm your World Cup alerts — oddlympics` (em-dash U+2014) |
| 8 | LAND-02 grep over `subject + text + html` | `grep -iE 'bitcoin\|lightning\|crypto\|world domination\|personal olympics'` → empty |
| 9 | `team=zzz_unknown` (raw slug fallback) | body contains `every zzz_unknown match in ...` |
| 10 | `team=spain, tz=''` (empty tz) | body contains `every Spain match in your local time.` |

---

### `package.json` (MODIFIED — script-alias config)

**Analog:** the two existing `smoke:*` entries in the same `scripts:` block.

**Match this pattern — existing aliases (`package.json:13-16`):**
```json
"smoke:landing": "node scripts/smoke-landing.mjs",
"smoke:manage": "node scripts/smoke-manage.mjs",
"check:land-02": "! grep -iE '[b]itcoin|[l]ightning|[c]rypto|[w]orld domination|[p]ersonal olympics' dist/client/index.html",
"og:render": "node scripts/render-og-image.mjs"
```
**Why this matters for Phase 10:**
- Alias name: kebab-with-colon (`smoke:confirm`), matching `smoke:landing` /
  `smoke:manage`.
- Value: `"node scripts/smoke-confirm-email.mjs"` — bare `node`, no
  `--env-file=.env` (smoke is offline, no env reads).
- Placement: alphabetic between `smoke:landing` and `smoke:manage` keeps the
  block readable.
- The `check:land-02` line shows a parallel-but-different pattern: a built-in
  LAND-02 grep already exists for `dist/client/index.html`. Phase 10's smoke
  does the same `grep -iE` but over the composed email body — same regex,
  different target. Do NOT add a `check:land-02-email` alias; the body grep
  lives inside `smoke-confirm-email.mjs` as Case 8.

> Note for the planner: CONTEXT.md mentions `smoke:signup` as an existing
> npm alias to mirror. It is NOT in `package.json` today — the script file
> `scripts/smoke-signup.mjs` exists and is invoked via the bare path. Treat
> `smoke:landing` + `smoke:manage` as the actual mirror.

---

### `.planning/phases/10-confirmation-email-update/evidence/` (CREATED — operator-evidence dir)

**Analog:** none in-repo. Phase 10 is the first phase to commit screenshot
evidence under its phase directory. The pattern is established here.

**Match this convention:** four files under the dir, all PNG, all
operator-captured post-deploy:
- `mailtester-score.png` — D-08 evidence
- `mail-gmail.png` — D-09 evidence
- `mail-proton.png` — D-09 evidence
- `mail-outlook.png` — D-09 evidence

The dir is referenced from `10-SUMMARY.md` via relative paths; no committed
README; no `.gitkeep` (the screenshots themselves keep it non-empty).

---

### `.planning/phases/10-confirmation-email-update/10-SUMMARY.md` (CREATED — per-plan summary doc)

**Analog:** `.planning/phases/09-manage-editor-unsubscribe/09-05-SUMMARY.md`
(the most recent shipped summary, by `git log`). The Phase 10 SUMMARY for the
operator-action plan (Plan 03) extends the existing template with two new
sections.

**Match this pattern:** standard SUMMARY skeleton (verification map, files
touched, evidence) plus two Phase-10-specific sections:
- `## Deliverability Evidence` — Mail-Tester score (numeric), embedded
  `mailtester-score.png` reference, 7 sub-check breakdown verbatim from the
  Mail-Tester UI (SPF/DKIM/DMARC, content, blacklists, body/subject, server,
  links, unsubscribe).
- `## Cross-Client Evidence` — three rows (Gmail / Proton / Outlook), each
  with the screenshot reference and a pass/fail bullet list (layout intact,
  link resolves, unsubscribe visible, LAND-02 absent).

---

## Shared Patterns

### Caller-passes-validated-primitives (lib never imports `db`)
**Source:** CONTEXT D-01 + CONVENTIONS.md Pattern 3 + the existing
`src/lib/email.ts:1-2` import list (only `resend` + `./token` — never `./db`).

**Apply to:** the new `sendMagicLink(email, token, team, timezone)` signature.
`src/lib/email.ts` must NOT import from `src/lib/db.ts` or
`src/lib/teams.ts`'s `VALID_TEAMS` (validation already happened in the
caller; helpers like `teamLabel` are pure lookups, not validators).

### Lib throws, caller catches and redirects
**Source:** `src/pages/api/signup.ts:108-113` + `src/lib/email.ts:52`.
```ts
// lib (email.ts:52):
if (error) throw new Error(`Resend error: ${error.message}`);

// caller (signup.ts:108-113):
try {
  await sendMagicLink(rawEmail, token);
} catch (err) {
  console.error('[signup] email error', err);
  return back('email');
}
```
**Apply to:** the widened `sendMagicLink` keeps throwing `Resend error: …`.
The caller's try/catch + `back('email')` redirect is unchanged. No new
error codes (COMPAT-02 invariant).

### Dev-fallback console branch preserves the side-effect contract
**Source:** `src/lib/email.ts:43-49` + CLAUDE.md §"Dev email fallback".
**Apply to:** the widened `sendMagicLink` keeps `if (!resend) { … return; }`
verbatim and extends the log loop to print the value-prop line so contributors
can verify team + tz interpolation without firing Resend.

### ASCII apostrophe (0x27) in all body copy
**Source:** CLAUDE.md §"Conventions established" + Phase 6 deviation log.
**Apply to:** every new copy string in `email.ts` text + html — `We'll`,
`don't`, `it's` use straight ASCII `'`. The smoke must `grep -F` byte-exact
to catch a future U+2019 typo.

### Return-type annotations on all exports + no `any`
**Source:** CLAUDE.md §"TypeScript" + `src/lib/teams.ts:12` +
`src/lib/timezones.ts:13`.
**Apply to:** `teamLabel(slug: string): string`,
`tzLabel(tz: string): string`. The widened `sendMagicLink` keeps
`: Promise<void>`.

### Why-comments only, no JSDoc
**Source:** CLAUDE.md §"What you won't see in this codebase".
**Apply to:** the only earned why-comment in Phase 10 is the one on
`tzLabel` flagging the cross-file byte-equivalence with the landing-page JS.
`teamLabel`, the widened `sendMagicLink` signature, and the smoke cases get
NO comments — names self-document.

### `node:` prefix on built-ins in `.mjs` smoke scripts
**Source:** CLAUDE.md §"TypeScript" + `scripts/smoke-signup.mjs:34-35` +
`scripts/smoke-manage.mjs:43-44`.
**Apply to:** `scripts/smoke-confirm-email.mjs` imports — `node:fs`,
`node:path` for the `references/teams.json` read.

### Operator-action audit trail = `evidence/*.png` + SUMMARY references
**Source:** Phase 10 is the first occurrence; convention established here.
**Apply to:** every operator-driven verification step in Plan 03 ends with
a commit of a `.png` under `evidence/` and a SUMMARY reference. No
operator action passes without a captured artifact.

---

## No Analog Found

| File | Role | Data Flow | Reason | Fallback |
|------|------|-----------|--------|----------|
| `.planning/phases/10-confirmation-email-update/evidence/` | operator-evidence dir | n/a | First phase to commit screenshot evidence under its phase dir | Convention established by Phase 10 itself (D-08 / D-09); future phases that need operator-captured evidence can mirror |

All other files have strong analogs within this same repo. Phase 10 is a
**small, in-pattern edit** — every new symbol has a sibling within 100 lines
of its target location.

---

## Metadata

**Analog search scope:** `src/lib/`, `src/pages/`, `src/pages/api/`,
`scripts/`, `package.json`, `node_modules/resend/dist/index.d.mts` (SDK type
verification), prior phase directories under `.planning/phases/`.

**Files scanned:** `src/lib/email.ts` (full), `src/lib/teams.ts` (full),
`src/lib/timezones.ts` (full), `src/pages/api/signup.ts` (full),
`src/pages/index.astro` (lines 30-40 + 190-215), `src/pages/manage.astro`
(lines 25-40), `scripts/smoke-signup.mjs` (lines 1-80 + 270-320),
`scripts/smoke-manage.mjs` (lines 1-80 + 540-587), `package.json` (full),
`node_modules/resend/dist/index.d.mts` (lines 511-565).

**Pattern extraction date:** 2026-05-15.

**Phase 10 source-of-truth ordering for the planner:**
1. CONTEXT.md decisions are LOCKED — no relitigation.
2. RESEARCH.md fills in *how* under each decision.
3. This PATTERNS.md provides the concrete excerpts to copy from.
4. VALIDATION.md provides the per-task verification map.

When a future drift surfaces, the smoke (cases 1-10) is the regression net.
When the smoke is silent and a problem still ships (e.g., Resend SDK semantics
change), the operator-driven Mail-Tester + cross-client re-run catches it.

## PATTERN MAPPING COMPLETE
