---
phase: 14-share-experience
reviewed: 2026-05-23T02:06:02Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - scripts/smoke-signup.mjs
  - src/lib/copy.ts
  - src/lib/email.ts
  - src/pages/api/confirm.ts
  - src/pages/api/signup.ts
  - src/pages/confirmed.astro
  - src/pages/manage.astro
  - src/pages/pending.astro
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: issues_found
---

# Phase 14: Code Review Report

**Reviewed:** 2026-05-23T02:06:02Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Phase 14 wires the share UI across `/pending`, `/confirmed`, and `/manage`
(signed-in), threads `&rc=` through the signup and confirm 303 redirects,
adds a `shareText` helper in `copy.ts`, and extends `sendMagicLink` with the
referral code. The core happy path holds together: defensive `?rc=` regex
gating prevents query-string injection into the share UI, the upstream
guard at `signup.ts:157-160` makes `row.referral_code` non-null before
`sendMagicLink` is called, and `/api/confirm` correctly skips `&rc=` on
`bad-token` / `unknown` statuses where there is nothing meaningful to share.

No critical (security-breaking, data-losing, or crash-inducing) defects
surfaced. The findings cluster in two areas:

1. **The smoke-test cases added in Phase 14-05 are weaker than they read.**
   Two of the three new `SHARE-*` checks grep for substrings that exist in
   the static page markup regardless of whether the runtime injection
   actually fired. A regression that breaks the `?rc=` reader script
   entirely would still pass two of the three new assertions.
2. **The share-text template was duplicated by hand into the two
   prerendered pages**, in direct contradiction of decision D-11 ("Single
   template across all surfaces — one place to tweak"). `pending.astro`
   and `confirmed.astro` each carry their own inline copy of the
   `"I'm following …"` literal, so a future edit to `shareText()` in
   `copy.ts` will silently desync the email + `/manage` from the two
   static pages.

Other warnings cover smoke-test fragility (cross-run state, `allRows[0]`
ordering, false-positive substring assertions), prototype-pollution-shaped
input on the `?team=` resolver, and dead code in `confirmed.astro`.

## Warnings

### WR-01: SHARE-pending-card and SHARE-confirmed-card smoke checks are false-positives

**File:** `scripts/smoke-signup.mjs:459-496`
**Issue:** Both new smoke cases assert that the response body contains
the substrings `'share-card'` and `'share-url'`. Those strings are
present in the **static markup** of both pages (`pending.astro:52-66`
and `confirmed.astro:18-32` — the `<section id="share-card">` and
`<input id="share-url">` are always emitted, just `hidden` by default).
They appear regardless of whether `?rc=` was passed, whether the inline
`<script is:inline>` runs, or whether the `?team=` lookup against
`TEAM_LABEL_JSON` actually resolves. A regression that completely deletes
the `<script>` block (or breaks the `JSON.parse(TEAM_LABEL_JSON)` /
`navigator.share` wiring) leaves the markup in place and both tests still
pass.

The `'Brazil'` substring check in SHARE-pending-card has the same problem:
`Brazil` is embedded in `TEAM_LABEL_JSON` at build time (a serialized map
of all 48 team labels), so it appears in the rendered body for every
`/pending` response regardless of the `?team=` query param. The test
would pass with `?team=uruguay`, `?team=zzzzz`, or no `?team=` at all.

The only smoke case that genuinely exercises the new behavior is
SHARE-confirm-redirect-location at `:504-568`, which does check the
303 `Location` header against the live DB-resolved `rc`.

**Fix:** Move the share-card assertions from substring presence to
runtime-rendered evidence. Two options:

```js
// Option A — assert the hidden attribute is no longer literally in the
// section opening tag (the inline script removes it on success). Brittle
// against whitespace/attribute reordering but cheap.
if (!body.includes('id="share-card" class="share-card" hidden')) {
  // markup is still hidden — script either didn't run or the rc gate failed
}

// Option B — drop these two cases entirely and rely on
// SHARE-confirm-redirect-location (which DOES catch a real regression),
// then defer share-card visibility to the operator-UAT D-20 mentions.
```

For the team-label check specifically: assert against a string that can
ONLY appear if the runtime resolver fired — e.g. the full shareTextStr
phrase `"I'm following Brazil — "` (note the em-dash + space + word that
no other surface emits). Even then, recognize this only verifies the
literal got into the embedded `TEAM_LABEL_JSON` build artifact, not the
runtime `params.get('team')` → `labels[teamSlug]` resolution.

---

### WR-02: Share-text template is duplicated by hand across `/pending` and `/confirmed`, violating D-11

**File:** `src/pages/pending.astro:80-81`, `src/pages/confirmed.astro:94-95`, `src/lib/copy.ts:6-8`
**Issue:** Decision D-11 in `14-CONTEXT.md` is explicit: "Single template
across all surfaces — no per-page variants. One string in `copy.ts`, one
place to tweak." `email.ts` and `manage.astro` both import + call
`shareText(teamLabel, url)`. But the two prerendered pages can't import
into inline browser scripts, so the planner hand-copied the template
literal:

```js
// pending.astro:80-81
const shareTextStr = "I'm following " + (teamLabel || 'my team') +
  " — get your team's World Cup kickoff alerts.\n" + shareUrl;

// confirmed.astro:94-95 — same string
const shareTextStr = "I'm following " + (teamLabel || 'my team') +
  " — get your team's World Cup kickoff alerts.\n" + shareUrl;

// copy.ts:6-8 — the actual source of truth
export function shareText(teamLabel: string, url: string): string {
  return `I'm following ${teamLabel} — get your team's World Cup kickoff alerts.\n${url}`;
}
```

Three copies of the same template. When the next product iteration tweaks
the wording (e.g. dropping "World Cup" to make it sport-agnostic for
Olympics), the email + `/manage` will update; `/pending` and `/confirmed`
will silently drift.

**Fix:** Either (a) export the template as a string constant and inject
it into the inline scripts via `define:vars`, or (b) accept the
duplication but add a why-comment in `copy.ts` pointing at the two
mirrors so future editors are warned. Option (a) keeps D-11 honest:

```astro
---
// copy.ts
export const SHARE_TEXT_TEMPLATE = "I'm following {team} — get your team's World Cup kickoff alerts.";

// pending.astro frontmatter
import { SHARE_TEXT_TEMPLATE } from '../lib/copy';
---
<script is:inline define:vars={{ SHARE_TEXT_TEMPLATE, TEAM_LABEL_JSON }}>
  // ...
  const shareTextStr = SHARE_TEXT_TEMPLATE.replace('{team}', teamLabel || 'my team') + '\n' + shareUrl;
</script>
```

---

### WR-03: REF-self-ref smoke case may pick the wrong row across DB persistence

**File:** `scripts/smoke-signup.mjs:403-429`
**Issue:** The REF-self-ref case looks up the `smoke-ref-a-*` row via:

```js
const allRows = db
  .prepare("SELECT email, referral_code FROM vip_signups WHERE email LIKE 'smoke-ref-a-%@example.com'")
  .all();
// ...
const refRow = allRows[0];
```

There is no `ORDER BY`. If a prior smoke run failed (or wasn't cleaned
up — the cleanup line only fires when `fail > 0`), one or more stale
`smoke-ref-a-*` rows from previous runs persist. SQLite returns rows in
unspecified order absent `ORDER BY`, but the practical observed behavior
is ROWID ascending, meaning `[0]` is the *oldest* row, not the one just
inserted by REF-valid-ref in the current run.

The case happens to still pass today because all `smoke-ref-a-*` rows
will have `referred_by IS NULL` (none of them are referred), so the
assertion at `:424` holds. But the test is no longer verifying what it
claims to verify — it's asserting on an arbitrary historical row, not
the row REF-valid-ref just created. A future change to the self-ref
behavior (e.g. setting a flag on the existing row when self-ref is
detected) would only update the latest row, but the assertion would
check a stale row and silently pass.

**Fix:** Add `ORDER BY id DESC LIMIT 1` and use the result directly:

```js
const refRow = db
  .prepare("SELECT email, referral_code FROM vip_signups WHERE email LIKE 'smoke-ref-a-%@example.com' ORDER BY id DESC LIMIT 1")
  .get();
if (!refRow) {
  console.error('  could not find smoke-ref-a-* row from REF-valid-ref; ensure cases run in order');
  return false;
}
```

Or — better — capture `emailA`/`codeA` into module-scope variables in
REF-valid-ref and reuse them directly in REF-self-ref, eliminating the
DB round-trip + ordering dependency entirely.

---

### WR-04: `pending.astro` team resolver vulnerable to prototype-key lookup confusion

**File:** `src/pages/pending.astro:78-79`
**Issue:** The inline script resolves `?team=` against the embedded
`labels` object:

```js
const labels = JSON.parse(TEAM_LABEL_JSON);
const teamLabel = teamSlug && labels[teamSlug] ? labels[teamSlug] : '';
```

`labels` is a plain object built from `Object.fromEntries(...)`, which
does prevent direct prototype pollution on assignment. However, a
**lookup** of `labels['__proto__']` returns the inherited `Object.prototype`,
which is truthy, so the conditional `labels[teamSlug] ? labels[teamSlug] : ''`
binds `teamLabel` to the prototype object (or to `Object.prototype.toString`,
`.constructor`, `.valueOf`, etc. for those keys). String concatenation
then coerces it via `[object Object]`:

```
?team=__proto__  →  shareTextStr = "I'm following [object Object] — get your team's..."
?team=toString   →  shareTextStr = "I'm following function toString() { [native code] } — ..."
```

There is no XSS path — the value goes into `.value` (DOM property) and
`.textContent`, both of which auto-escape. But the share-card copy is
broken and embarrassing if a search-bot or crawler crafts the URL.

**Fix:** Use `Object.hasOwn` (or `Object.prototype.hasOwnProperty.call`)
and/or harden the regex on the slug:

```js
const teamLabel =
  teamSlug && /^[a-z_]+$/.test(teamSlug) && Object.hasOwn(labels, teamSlug)
    ? labels[teamSlug]
    : '';
```

The `/^[a-z_]+$/` shape matches every existing slug in
`references/teams.json` (lowercase letters + underscore) and rules out
`__proto__` (has digits 2 — actually it doesn't, but does have underscore;
better: use `/^[a-z]+(_[a-z]+)*$/` which excludes leading/trailing
underscores) and any other surprise key.

---

### WR-05: `confirmed.astro` carries dead code for personalized share text

**File:** `src/pages/confirmed.astro:93-95`
**Issue:** The inline script declares:

```js
const teamLabel = '';
const shareTextStr = "I'm following " + (teamLabel || 'my team') +
  " — get your team's World Cup kickoff alerts.\n" + shareUrl;
```

`teamLabel` is hardcoded to `''`, so `(teamLabel || 'my team')` ALWAYS
evaluates to `'my team'`. The `teamLabel` variable, the `||` short-circuit,
and the comment "D-16: generic copy on /confirmed — no team personalization"
all imply this is a placeholder for a future state. Today, this is dead
code — the entire `(teamLabel || 'my team')` expression can be replaced
with the string `'my team'`.

Worse, this is a maintenance trap: a future contributor will see the
parallel structure to `pending.astro` (which does have a meaningful
`teamLabel`) and may "fix" `confirmed.astro` by passing `&team=` through
the confirm 303. But D-16 deliberately omits team personalization on
`/confirmed` because the confirm token doesn't carry the team. The
guard is doctrinal, not technical — leaving the dead `teamLabel`
variable obscures that intent.

**Fix:** Collapse to the literal `'my team'` and add a why-comment
referencing D-16:

```js
// D-16: /confirmed deliberately omits team personalization — the confirm
// 303 carries no &team=, and prompting the user to re-pick would be off-key
// for a "you're in" success page.
const shareTextStr = "I'm following my team — get your team's World Cup kickoff alerts.\n" + shareUrl;
```

## Info

### IN-01: `confirm.ts` calls `verifyToken(token)` without `expectedPurpose='confirm'`

**File:** `src/pages/api/confirm.ts:11`
**Issue:** `verifyToken(token)` is called without the second
`expectedPurpose` argument. `token.ts:80-83` then falls through to
treating a missing `purpose` claim as `'confirm'` for backward
compatibility, but ALSO accepts tokens with `purpose='manage'`,
`'unsubscribe'`, or `'session'` because the purpose check only fires
when `expectedPurpose` is passed.

This is pre-existing behavior (not introduced in Phase 14), but the
file was modified in Phase 14, making it in scope to flag. The
practical impact is small — minting a token requires the server
secret, so an attacker can't craft cross-purpose tokens — but a
legitimately-issued manage-purpose link could be replayed as a
confirm-purpose action.

**Fix:** Tighten the call to `verifyToken(token, 'confirm')` once
all legacy purposeless tokens have aged out (their 24h TTL would
have expired weeks ago — D-04 in token.ts hints at this).

### IN-02: Hand-rolled share-button JS duplicated across three pages

**File:** `src/pages/pending.astro:99-125`, `src/pages/confirmed.astro:107-133`, `src/pages/manage.astro:492-518`
**Issue:** The `copyFallback()` function, the `navigator.share` /
`navigator.clipboard` feature-detection branch, the AbortError handling,
and the "Copied!" button-flash are all copy-pasted across three files.
The codebase doesn't have a JS bundler for inline scripts, but a small
shared snippet template (or a `<script>` source pulled from a static
asset) would reduce drift risk.

**Fix:** Defer until the next change to share behavior reveals the cost.
Inline duplication is acceptable per the project's "no abstraction
without ≥3 use cases" stance — but this IS the third site, so consider
extracting if a fourth share surface lands.

### IN-03: `pending.astro` ships ~2KB of team-label JSON for every page render

**File:** `src/pages/pending.astro:7-10`
**Issue:** `TEAM_LABEL_JSON` is the full 48-entry slug→label map embedded
into every `/pending` HTML response. The page only ever needs ONE entry
(the user's just-picked team). The other 47 entries are dead weight in
the response body.

This is a performance issue (out of v1 review scope per the workflow
config) but worth noting as a future cleanup. Alternatives: append
`&team_label=Brazil` to the 303 redirect alongside `&team=`, or pass
the label through `define:vars` at runtime (not possible — `pending`
is prerendered).

**Fix:** Out of v1 scope. Revisit when `/pending` response size
becomes measurable.

### IN-04: Smoke-test TS-import requires Node 22.6+ but doesn't enforce it

**File:** `scripts/smoke-signup.mjs:42`
**Issue:** `import { mintToken } from '../src/lib/token.ts';` requires
Node 22.6+ or the `--experimental-strip-types` flag. The doc comment at
lines 14-15 mentions this, but the shebang `#!/usr/bin/env node` does
not pass the flag, so running on Node 22.0-22.5 will fail with a
cryptic loader error.

**Fix:** Either bump the shebang to require the flag explicitly, add
a runtime version check at startup, or move the smoke's confirm-token
minting to use the HTTP endpoint instead of importing `mintToken`
directly:

```js
#!/usr/bin/env -S node --experimental-strip-types
```

Or, at the top of the file:

```js
const [vMajor, vMinor] = process.versions.node.split('.').map(Number);
if (vMajor < 22 || (vMajor === 22 && vMinor < 6)) {
  console.error(`[smoke] requires Node 22.6+ for TS import; you have ${process.versions.node}`);
  process.exit(2);
}
```

---

_Reviewed: 2026-05-23T02:06:02Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
