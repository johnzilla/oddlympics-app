---
phase: 12-restore-multi-team-selection
reviewed: 2026-05-16T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/lib/db.ts
  - src/pages/api/save-selection.ts
  - src/pages/api/unsubscribe.ts
  - src/pages/manage.astro
  - scripts/smoke-manage.mjs
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 12: Code Review Report (Gap-Closure Re-Review)

**Reviewed:** 2026-05-16
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

This is the gap-closure re-review of the `ab0d201..HEAD` diff that closes the
two BLOCKER consent/privacy regressions (CR-01, CR-02) plus WR-04 (negative-path
smoke coverage M15/M16) flagged in the prior review (2 critical / 5 warning).
The diff is tight and well-targeted: 199 insertions across 5 files, 170 of
which are new smoke cases.

**The two BLOCKER fixes are correct and complete.**

- **CR-01** — `updateTimezoneActive` (`db.ts:298-301`) carries
  `WHERE email = ? AND confirmed_at IS NOT NULL AND unsubscribed_at IS NULL`,
  the same SQL state gate the replaced `setSelection` had. It runs *first*
  inside `db.transaction()` (`save-selection.ts:76-81`); for any
  unconfirmed/unsubscribed user `res.changes === 0` throws `not-active`
  *before* `deleteUserTeams.run`/`insertUserTeam.run`. better-sqlite3's
  `db.transaction()` rolls the whole transaction back on throw, so zero
  `user_teams` writes and zero `timezone` clobber occur. The catch
  (`save-selection.ts:98-106`) correctly discriminates: `err.message ===
  'not-active'` → `status=unknown` with a distinct journald log line; any other
  throw → `status=server`. Verified there is no false-negative trap for an
  active user re-saving an unchanged tz — SQLite counts a WHERE-matched row as
  modified even when the new value equals the old, so `changes === 1` holds.

- **CR-02** — `deleteUserTeams.run(result.email)` (`unsubscribe.ts:19`) is on
  the verified-token path only (after `verifyToken(token, 'unsubscribe')`
  succeeds at line 11-12), is idempotent (DELETE on zero rows is a no-op), and
  is sufficient: `markConfirmed` (`db.ts:102-108`) clears `unsubscribed_at` on
  re-confirm but leaves `user_teams` empty, so the cron's `usersQuery`
  (`send-kickoff-notifications.mjs:104-118`, INNER `JOIN user_teams`) yields
  zero rows for a re-confirmed user until they actively re-pick on `/manage`.
  No stale fan-out.

- **`'unknown'` STATUS_COPY** (`manage.astro:104`) is shape-consistent
  (`{ kind: 'err', text: ... }`) and renders through the existing
  `statusMsg`/branch-D path (`manage.astro:107,226-228`).

**M15/M16 are genuine, non-tautological proofs.** M15 drives the real
`/api/save-selection` under the exact CR-01 scenario (confirmed-but-unsubscribed
row, valid session) and asserts `status=unknown` + `user_teams` unchanged +
`timezone` preserved. M16 drives the real `/api/unsubscribe` (the CR-02 unit
under test) and asserts `user_teams` cleared, then re-confirms and asserts the
cron JOIN yields zero rows. Both use disposable `smoke-*@example.com` emails
and never send real email — the unsubscribe path is pure DB+redirect, and no
`sendMagicLink` call sits on the M15/M16 code paths.

**Scope fences held.** No edits to `api/signup.ts`, `index.astro`, or any
schema/DDL. The `db.ts` change is purely additive — one new prepared statement,
no `ALTER`/`CREATE`/`DROP`. Project conventions respected throughout (ESM,
`node:` prefix, strict TS with typed prepared-statement generics, no framework
JS, `?status=` 303-redirect pattern, named exports only, no JSDoc).

No BLOCKER-severity defects remain in the gap-closure diff. The two prior
BLOCKERs (CR-01, CR-02) are resolved. Two WARNINGs and three INFO items below —
none gate ship, but WR-01 is a latent contract fragility in the unsubscribe
path and WR-02 is a test-fidelity gap that weakens the M16 regression sentinel.

## Warnings

### WR-01: `deleteUserTeams` runs on unsubscribe before any subscriber-existence check

**File:** `src/pages/api/unsubscribe.ts:14-25`

**Issue:** `deleteUserTeams.run(result.email)` executes unconditionally after
token verification, *before* the `markUnsubscribed` result or the `getByEmail`
existence check is consulted. A valid HMAC token only proves the bearer holds a
correctly-signed `{email, purpose:unsubscribe}` payload — it does not prove a
`vip_signups` row exists for that email. The statement is parameterized so this
is **not** an injection vector and **not a BLOCKER**: in normal operation a
non-subscriber email has no `user_teams` rows either, so the DELETE is a
harmless no-op and the route correctly falls through to `status=unknown`. The
concern is contract fragility: the fix couples `user_teams` mutation to *token
validity* rather than to *subscription existence*. `user_teams` has no FK to
`vip_signups`, so if a future hard-delete of `vip_signups` ever leaves orphaned
`user_teams` rows, this path would silently scrub them on any minted
unsubscribe token regardless of subscriber state. The comment at lines 15-18
justifies the unconditional placement for already-unsubscribed idempotency
(correct intent) but does not acknowledge the no-`vip_signups`-row case.

**Fix:** Either (a) add a comment documenting that `user_teams` has no FK to
`vip_signups` and orphan scrubbing on a valid token is acceptable, or (b) gate
the delete on the existence signal already computed two lines later:

```ts
const updated = markUnsubscribed.get(result.email);
const existing = updated ?? getByEmail.get(result.email);
if (existing) deleteUserTeams.run(result.email); // only touch user_teams for a real subscriber
if (updated) return redirect('/unsubscribed?status=ok');
if (existing) return redirect('/unsubscribed?status=already');
return redirect('/unsubscribed?status=unknown');
```

This preserves already-unsubscribed idempotency (`existing` is truthy there)
while not mutating `user_teams` for emails that were never subscribers.

### WR-02: M16 re-confirms via an inlined `dbMarkConfirmed` helper, not the real `/api/confirm` route — regression-proof fidelity gap

**File:** `scripts/smoke-manage.mjs:969-1010` (helper at `:180-190`)

**Issue:** CR-02's failure mode is precisely "a later `/api/confirm` →
`markConfirmed` silently re-activates stale team subscriptions." M16
unsubscribes through the **real** `/api/unsubscribe` route (correct — that is
the CR-02 unit under test), but re-confirms via the local `dbMarkConfirmed`
helper (lines 180-190), a hand-copied re-implementation of the `markConfirmed`
SQL rather than an HTTP call to `/api/confirm`. The helper SQL currently
mirrors `db.ts:102-108` byte-for-byte, so the test passes for the right reason
today. But the proof is only as strong as the copy: if `markConfirmed` in
`db.ts` were later extended to also touch `user_teams` (e.g. a "restore
previous picks on re-confirm" feature — exactly the change that would
re-introduce CR-02), the real `/api/confirm` route would regress while M16
stays green because it never exercises that route. This makes M16 a weaker
regression sentinel than its "CR-02 behavioral proof" comment claims. It is
not tautological (it does assert real cross-table behavior through the real
unsubscribe route), but it does not guard the actual integration point named
in the regression.

**Fix:** Replace the `dbMarkConfirmed(email)` call in step 4 with a real
`/api/confirm?token=...` round-trip, mirroring how M16 already drives the real
`/api/unsubscribe`:

```js
const confirmToken = mintToken(email, { purpose: 'confirm' });
const confirmRes = await get(`/api/confirm?token=${encodeURIComponent(confirmToken)}`);
if (confirmRes.status !== 303 || !confirmRes.location?.startsWith('/confirmed?status=ok')) {
  console.error(`  reconfirm: expected /confirmed?status=ok, got ${confirmRes.status} ${confirmRes.location}`);
  return false;
}
```

Then keep the existing post-reconfirm cron-JOIN assertion. (Note: `/api/confirm`
verifies the token with no explicit purpose — `verifyToken(token)` at
`confirm.ts:11` — and a `purpose:'confirm'` token resolves correctly, so this
substitution is faithful.)

## Info

### IN-01: `updateTimezone` is now an unused, unguarded export — a re-introduction footgun

**File:** `src/lib/db.ts:288-292`

**Issue:** `save-selection.ts` was the only consumer of `updateTimezone`; it
now imports `updateTimezoneActive` instead, leaving the unscoped
`updateTimezone` with no importer. It is a live footgun: it overwrites
`timezone` for any email with no confirmed/unsubscribed gate, so any future
caller that grabs `updateTimezone` instead of `updateTimezoneActive` silently
re-introduces the CR-01 class of bug. Keeping it "for symmetry" (referenced as
a mirror in the `updateTimezoneActive` comment at `db.ts:294-301`) is weaker
than the safety benefit of removing the unguarded variant.

**Fix:** Delete the `updateTimezone` export (lines 288-292) unless a concrete
out-of-scope consumer is planned; if it must stay, add a comment stating it is
intentionally unused and must never be wired into a consent-bearing write path.

### IN-02: Smoke helpers hand-copy `db.ts` UPDATE SQL with no drift anchor

**File:** `scripts/smoke-manage.mjs:169-190`

**Issue:** `dbMarkConfirmed` and `dbMarkUnsubscribed` re-implement
`markConfirmed`/`markUnsubscribed` as inline string literals. The comment at
lines 74-79 explains why *token signing* is re-implemented (TS-loader
friction) — reasonable for crypto — but the SQL duplication has no such
constraint, and it is the root cause of WR-02's fidelity gap. Low severity
because the copies are currently faithful and this is a test file, but every
future `db.ts` UPDATE-shape change must be manually mirrored here or these
tests silently validate the old shape.

**Fix:** Add a `// MUST stay byte-equivalent to src/lib/db.ts:<lines>` anchor
comment above each hand-copied statement, or (preferred) convert the DB-only
assertions to drive the real HTTP routes per WR-02 so there is nothing to keep
in sync.

### IN-03: Stale comment in `manage.astro` names the removed `setSelection` mechanism

**File:** `src/pages/manage.astro:109-111`

**Issue:** The `isUnsubscribed` comment reads "...get `?status=unknown` on save
(setSelection's WHERE excludes unsubscribed rows)." After CR-01,
`/api/save-selection` no longer routes through `setSelection` — it uses
`updateTimezoneActive` inside a throwing transaction, and `setSelection`
(`db.ts:239-244`) is itself now unused by the save path. The described behavior
is still accurate (a session-valid unsubscribed user does get `status=unknown`)
but the named mechanism is wrong, which will mislead the next reader tracing
the consent gate. The line was not in the gap-closure diff but is now factually
stale *because of* the CR-01 change and sits directly adjacent to the consent
logic in a reviewed file.

**Fix:** Update the parenthetical to name the current mechanism:

```astro
// RESEARCH Risk 3: a session-valid unsubscribed user would see the editor but get
// ?status=unknown on save (updateTimezoneActive's WHERE excludes unsubscribed rows;
// the transaction throws 'not-active' and rolls back before any user_teams write).
```

Note: `setSelection` (`db.ts:239-244`) is now also unused by the save path —
the same dead-export observation as IN-01 applies; consider folding both into
one cleanup commit.

---

_Reviewed: 2026-05-16_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
