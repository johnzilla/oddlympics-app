---
phase: 13-referral-code-attribution
reviewed: 2026-05-22T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - scripts/smoke-signup.mjs
  - src/lib/db.ts
  - src/lib/referral.ts
  - src/pages/api/signup.ts
  - src/pages/index.astro
findings:
  critical: 1
  warning: 5
  info: 4
  total: 10
status: issues_found
---

# Phase 13: Code Review Report

**Reviewed:** 2026-05-22T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Reviewed the Phase 13 referral-code-attribution implementation: a new
`referral_code`/`referred_by` schema migration with backfill, a fresh-code
generator, the `?ref=` resolution path wired into `/api/signup`, the
client-side `?ref=`/localStorage capture in `index.astro`, and the extended
smoke suite.

The overall shape is sound — additive migration, COALESCE-protected upsert,
"never reject on bad ref" model. But there is one **BLOCKER**: the new-signup
path generates a fresh referral code with **no collision retry**, unlike the
backfill loop in `db.ts` which has a 5-attempt retry. A `SQLITE_CONSTRAINT_UNIQUE`
on the new unique index will be caught by the generic `catch` and surface to
the user as a `server` error, silently dropping a legitimate signup. The
probability is tiny today but grows with table size, and it is a genuine
correctness defect — the code's own comment acknowledges the risk and then
explicitly declines to handle it.

Additional warnings cover a stale smoke-suite comment (slot accounting now
wrong), a self-referral check that misses the not-yet-confirmed re-signup
edge case for `referred_by`, an unbounded `referred_by` value that is never
validated against the charset, and a redundant duplicate migration probe.

## Critical Issues

### CR-01: New-signup referral code generation has no collision retry — a unique-index collision drops the signup

**File:** `src/pages/api/signup.ts:113-132`

**Issue:** The new-row path mints exactly one referral code:

```ts
const referralCode = generateReferralCode();
try {
  upsertVipSignup.get(rawEmail, ..., referralCode, referredBy);
} catch (err) {
  console.error('[signup] db error', err);
  return back('server');
}
```

`db.ts:79` creates `CREATE UNIQUE INDEX idx_vip_signups_referral_code`. On a
brand-new signup (`INSERT` path of the upsert, no `ON CONFLICT(email)` match),
if `generateReferralCode()` returns a code that already exists in another row,
SQLite throws `SQLITE_CONSTRAINT_UNIQUE`. That exception is caught by the
generic `catch` block, which cannot distinguish a collision from a real DB
fault, logs `[signup] db error`, and returns `back('server')`. The user sees
"Server hiccup. Try again in a minute." and **no row is written** — a
legitimate signup is lost.

The backfill loop in `db.ts:89-110` handles exactly this case with a 5-attempt
regenerate loop. The signup path was written without the equivalent guard —
and the inline comment at `signup.ts:114-115` ("Collision risk ~3.6e-13 at
current row counts; no retry loop needed here") explicitly rationalizes the
omission. "Astronomically rare" is not "impossible"; this is an unhandled
error path that produces data loss, and the codebase already has the correct
pattern one file over. The two code paths must be consistent.

Note also: the COALESCE comment ("COALESCE in upsertVipSignup preserves the
existing code on re-signup") only protects the `ON CONFLICT(email)` *update*
branch. The collision risk is on the *insert* branch, where COALESCE never
runs — so the comment does not mitigate this finding.

**Fix:** Retry on `SQLITE_CONSTRAINT_UNIQUE`, mirroring the backfill loop.
Best done by exposing a helper from `referral.ts` so the retry policy lives in
one place, or inline:

```ts
let inserted = false;
for (let attempt = 0; attempt < 5; attempt++) {
  const referralCode = generateReferralCode();
  try {
    upsertVipSignup.get(
      rawEmail, requestedSport, ip === 'unknown' ? null : ip,
      request.headers.get('user-agent'), rawTeam, tz, referralCode, referredBy,
    );
    inserted = true;
    break;
  } catch (err) {
    if (err instanceof Error && 'code' in err &&
        (err as { code: string }).code === 'SQLITE_CONSTRAINT_UNIQUE') {
      continue; // collision on referral_code — regenerate
    }
    console.error('[signup] db error', err);
    return back('server');
  }
}
if (!inserted) {
  console.error('[signup] referral_code collision: retries exhausted');
  return back('server');
}
```

## Warnings

### WR-01: Self-referral check fails for the not-yet-confirmed re-signup case

**File:** `src/pages/api/signup.ts:97-111`

**Issue:** Self-referral is meant to be ignored (T-13-04). The check compares
`refRow.email !== rawEmail`. This works once the user's own row exists. But on
a **first-time signup** the user types their email and (somehow) their own
not-yet-existing code as `?ref=` — `lookupByReferralCode` returns `undefined`,
fine. The real gap is the re-signup ordering: `referredBy` is computed *before*
the upsert. If user A re-signs-up with someone else's code, then immediately
re-signs-up again, attribution is COALESCE-protected so first-touch wins —
correct. But the self-referral guard relies on `refRow.email` exactly matching
the *lowercased* `rawEmail`. `lookupByReferralCode` selects `email` as stored;
`vip_signups.email` is always lowercased at write time (`signup.ts:64`), and
`rawEmail` is lowercased, so this happens to hold. It is, however, an implicit
invariant with no assertion — if any other write path ever inserts a
non-lowercased email, self-referral silently breaks and a user can refer
themselves. Worth a defensive `.toLowerCase()` on `refRow.email` in the
comparison, or a comment pinning the invariant.

**Fix:**
```ts
if (refRow && refRow.email.toLowerCase() !== rawEmail) {
  referredBy = refRow.referral_code;
}
```

### WR-02: `referred_by` is stored without validating it is a real 8-char code shape

**File:** `src/pages/api/signup.ts:97-111`, `src/lib/db.ts:140-149`

**Issue:** `rawRef` is trimmed and lowercased but never checked against the
`[a-z0-9]{8}` charset before being used in `lookupByReferralCode.get(rawRef)`.
That lookup is parameterized so there is no injection risk, and an unknown
code resolves to `undefined` → `referredBy` stays NULL. So in the common case
this is harmless. The issue is `referredBy` is only ever set to
`refRow.referral_code` (a value read back from the DB), so a malformed `?ref=`
can never reach the `referred_by` column — good. But the smoke suite's
`REF-malformed-ref` case (`ref: '!!bad!!'`) only *happens* to pass because the
lookup misses. There is no positive guarantee that `referred_by` always holds
a well-formed code; it is an emergent property of the current control flow.
If a future refactor ever assigns `referredBy = rawRef` directly (an easy
mistake — `rawRef` is right there), arbitrary attacker-controlled strings land
in the column. Add an explicit charset guard so the invariant is enforced, not
incidental.

**Fix:** Gate the lookup on a shape check:
```ts
const REF_RE = /^[a-z0-9]{8}$/;
if (rawRef && REF_RE.test(rawRef)) {
  const refRow = lookupByReferralCode.get(rawRef) as ... ;
  ...
} else if (rawRef) {
  console.log(`[signup] ref-malformed email=${rawEmail} ref=${JSON.stringify(rawRef)}`);
}
```

### WR-03: Stale rate-limit slot accounting in smoke suite comment will cause confusing failures

**File:** `scripts/smoke-signup.mjs:42-44, 285-287, 440-449`

**Issue:** The comment at lines 440-449 claims "SMOKE_IP has used ~3 of its 5
hourly slots" and that firing 4 more brings the total to 7 so the last
rate-limits. The Phase 13 referral cases were added between case 6 and case 7
and the comment at 285-287 asserts they all use `REF_IP`/`SELF_REF_IP` and do
NOT consume SMOKE_IP slots. That is true for the *referral* cases. But the
accounting is fragile: case-7 depends on the exact number of prior SMOKE_IP
successes (cases 1, 4, 5 = 3 slots). If anyone adds another SMOKE_IP POST
before case 7, or removes one, the `for (let i = 0; i < 4; i++)` loop count
silently becomes wrong and case-7 either fails spuriously or passes for the
wrong reason. The loop count `4` is a magic number derived by hand from
`MAX_PER_WINDOW - 3 + 1`. This is test brittleness, not a product bug, but it
will burn a future maintainer.

**Fix:** Make case-7 self-contained: use a dedicated fresh IP and fire exactly
`MAX_PER_WINDOW + 1` POSTs from it, asserting only the last is rate-limited.
That removes the dependency on prior-case slot accounting entirely.

### WR-04: `REF-self-ref` smoke case re-runs a signup that mutates a row other cases assert on

**File:** `scripts/smoke-signup.mjs:395-421`

**Issue:** `REF-self-ref` re-POSTs `smoke-ref-a-*` (created by `REF-valid-ref`)
with `team: 'england'` and `timezone: 'Europe/London'`. The upsert's
`ON CONFLICT(email) DO UPDATE` always overwrites `timezone` (it is not
COALESCE-protected) and `requested_sport`. If `REF-valid-ref` is ever changed
to create row A with a different tz, this case silently mutates it, and any
later assertion on row A's tz would break. More importantly, `allRows[0]` is
picked from a `LIKE 'smoke-ref-a-%'` query — if a prior smoke run left rows
behind (the cleanup is "operator, optional"), `allRows[0]` may be a *stale*
row from a previous run, not the one `REF-valid-ref` just created this run.
The case would then re-signup a stale email and still pass, masking a real
regression. Tests should not depend on DB cleanliness across runs.

**Fix:** Capture `emailA`/`codeA` from `REF-valid-ref` into a shared variable
in this script's scope and reuse it directly in `REF-self-ref` instead of
re-querying by `LIKE`. That removes the cross-run contamination and the
"ensure cases run in order" caveat.

### WR-05: Generic catch in signup cannot distinguish constraint violations from real faults

**File:** `src/pages/api/signup.ts:118-132`

**Issue:** Even independent of CR-01, the single `catch (err)` around
`upsertVipSignup.get(...)` collapses every possible DB failure —
`SQLITE_CONSTRAINT_UNIQUE` on `referral_code`, `SQLITE_BUSY` under WAL
contention, a genuine disk error — into one `back('server')` response and one
log line. The backfill code in `db.ts:97-106` demonstrates the correct
pattern: inspect `e.code`, branch on `SQLITE_CONSTRAINT_UNIQUE`, re-throw
everything else. The signup handler should adopt the same discrimination so
that (a) collisions are retried (CR-01) and (b) real faults are not silently
miscategorized. Fixing CR-01 as suggested resolves this.

**Fix:** See CR-01 — the suggested retry block branches on `err.code`.

## Info

### IN-01: Duplicate `pragma_table_info` probe block adds an avoidable second table scan

**File:** `src/lib/db.ts:34-62` and `src/lib/db.ts:67-111`

**Issue:** Two separate `{ ... }` blocks each independently run
`SELECT name FROM pragma_table_info('vip_signups')` and redefine the identical
`has` helper. The Phase 13 block (67-111) could have appended its column
probes to the Phase 5 block. The comment at 66 explicitly says it "Models the
simpler teams probe" — but the teams probe is for a *different table*, so a
separate block there is justified; here it is the same table probed twice.
Not a bug (the probe is idempotent and cheap at boot), but it is duplication
the codebase's own conventions discourage.

**Fix:** Merge the Phase 13 column additions into the existing `vip_signups`
probe block, or leave a comment explaining the intentional separation if it is
meant to keep migration phases visually isolated.

### IN-02: `referral.ts` hardcodes the code length `8` as a literal inside the generator

**File:** `src/lib/referral.ts:8`

**Issue:** The loop bound `8` is a magic number. The 8-char contract is
asserted in three other places: the smoke regex `/^[a-z0-9]{8}$/`
(`smoke-signup.mjs:305`), and implicitly anywhere a ref is validated. If the
length ever changes, these drift. Promote it to an exported constant
(`export const REFERRAL_CODE_LENGTH = 8`) so the generator, any future
validator, and tests share one source of truth.

**Fix:**
```ts
export const REFERRAL_CODE_LENGTH = 8;
export function generateReferralCode(): string {
  let code = '';
  for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) {
    code += CHARSET[randomInt(CHARSET.length)];
  }
  return code;
}
```

### IN-03: Client `?ref=` capture stores the raw ref with no length/charset bound

**File:** `src/pages/index.astro:235-259`

**Issue:** `urlRef` is read from the URL, trimmed, and written verbatim to
`localStorage` and then to the hidden `#ref` field with the comment "client
performs NO validation (D-13)". Server-side validation is the right call, but
the client will happily persist an arbitrarily long attacker-supplied string
into `localStorage` and replay it on the next visit for 30 days. The server
only does a parameterized lookup so there is no injection, and the server
should bound the length anyway (see WR-02). Still, a multi-kilobyte `?ref=`
value silently sits in the visitor's `localStorage`. A cheap defensive cap
(e.g. ignore `urlRef` longer than, say, 64 chars before storing) costs
nothing and avoids polluting storage.

**Fix:** `if (urlRef && urlRef.length <= 64) { activeRef = urlRef; ... }`

### IN-04: `lookupByReferralCode` result type is asserted, not validated

**File:** `src/pages/api/signup.ts:100`

**Issue:** `lookupByReferralCode.get(rawRef) as { email: string; referral_code: string } | undefined`
casts the better-sqlite3 result. The prepared statement selects exactly
`email, referral_code`, so the shape is correct in practice. This is the
codebase's established pattern (casts at DB boundaries), so it is acceptable —
flagged only for completeness. No change required unless the team wants a
narrow runtime guard on `refRow.referral_code` being a non-empty string before
assigning it to `referredBy`.

**Fix:** Optional — none required; consistent with existing convention.

---

_Reviewed: 2026-05-22T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
