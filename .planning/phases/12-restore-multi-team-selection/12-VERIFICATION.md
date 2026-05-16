---
phase: 12-restore-multi-team-selection
verified: 2026-05-16T00:00:00Z
status: gaps_found
score: 9/11 must-haves verified
overrides_applied: 0
gaps:
  - truth: "The one-email-per-match guarantee and the unsubscribe contract are preserved — an unsubscribed user cannot have team subscriptions written, and unsubscribing clears user_teams so re-subscription cannot silently re-activate a stale team list"
    status: failed
    reason: "CR-01: /api/save-selection has no SQL-level guard on confirmed_at IS NOT NULL AND unsubscribed_at IS NULL; the transaction writes user_teams rows and overwrites timezone for any email a valid token or session resolves to, including unsubscribed users. CR-02: markUnsubscribed (db.ts:114-119) does not delete from user_teams, and markConfirmed (db.ts:102-108) clears unsubscribed_at back to NULL, silently re-activating the full pre-unsubscribe team list for the kickoff cron without the user re-opting in via /manage."
    artifacts:
      - path: "src/pages/api/save-selection.ts"
        issue: "Transaction at lines 74-79 uses updateTimezone (UPDATE vip_signups SET timezone = ? WHERE email = ?) with no state predicate, and deleteUserTeams + insertUserTeam run unconditionally. No equivalent of the replaced setSelection WHERE confirmed_at IS NOT NULL AND unsubscribed_at IS NULL guard exists at the SQL or application level. A user with a valid 30-day session or 24h manage token can write user_teams rows and overwrite timezone after unsubscribing."
      - path: "src/pages/api/unsubscribe.ts"
        issue: "Calls only markUnsubscribed.get(result.email) — does not call deleteUserTeams. user_teams rows are left intact on unsubscribe."
      - path: "src/lib/db.ts"
        issue: "markUnsubscribed (line 114-119) only sets unsubscribed_at; no cascade or explicit DELETE FROM user_teams. markConfirmed (line 102-108) clears unsubscribed_at to NULL on re-confirmation, making the stale user_teams rows live again for the cron without any user action on /manage."
    missing:
      - "In save-selection.ts transaction: gate writes on a state check — either scope updateTimezone to WHERE email = ? AND confirmed_at IS NOT NULL AND unsubscribed_at IS NULL and check res.changes === 0 to abort the transaction (returning redirectTo(formToken, 'unknown')), or run an explicit SELECT before the transaction to verify the row is confirmed and active."
      - "In unsubscribe.ts: after markUnsubscribed, call deleteUserTeams.run(result.email) so unsubscribed users have no active user_teams rows."
      - "Restore the 'unknown' entry to STATUS_COPY in manage.astro (was removed when the guard was dropped) so the UI can surface the not-active failure case."
---

# Phase 12: Restore Multi-Team Selection — Verification Report

**Phase Goal:** A signed-in subscriber can follow 1–5 World Cup teams via confederation-grouped checkboxes on /manage (current picks pre-checked, server-enforced bounds), those picks persist in a user_teams join table, and the kickoff cron fans out one email per match for any followed team — while cold signup stays single-team and the one-email-per-match guarantee is preserved.

**Verified:** 2026-05-16
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | user_teams join table exists, additive, idempotent (D-01) | VERIFIED | db.ts lines 261-269: CREATE TABLE IF NOT EXISTS user_teams + UNIQUE(email, team_slug) + idx_user_teams_email. No ALTER/DROP/probe. |
| 2 | deleteUserTeams, insertUserTeam, getUserTeams, updateTimezone exported with typed generics (D-01) | VERIFIED | db.ts lines 274-292: all four statements exported at module level with correct typed generics and correct SQL bodies. |
| 3 | /manage signed-in branch renders confederation-grouped pre-checked checkboxes (D-04) | VERIFIED | manage.astro lines 251-266: fieldset iterates groupedTeams, renders input type="checkbox" name="team" with checked={userTeamSlugs.has(t.slug)}. No <select name="team"> present. Legend "Your teams — Follow up to 5". |
| 4 | Saving 1-5 valid teams persists to user_teams atomically with timezone in one db.transaction (D-05) | VERIFIED | save-selection.ts lines 74-79: single db.transaction with deleteUserTeams.run, insertUserTeam.run loop, updateTimezone.run. VALID_TEAMS allow-list enforced. >=1 and <=5 bounds enforced before transaction. |
| 5 | Saving >5 teams redirects with status=too-many, zero writes (D-05) | VERIFIED | save-selection.ts lines 63-66: validSlugs.length > 5 returns redirectTo(formToken, 'too-many') before transaction. M12 smoke case confirms zero writes on reject. |
| 6 | Saving 0 or invalid slugs redirects with status=bad-team, zero writes (D-05) | VERIFIED | save-selection.ts lines 59-62: hasBadSlug || validSlugs.length === 0 returns redirectTo(formToken, 'bad-team') before transaction. M13 smoke case confirms zero writes on empty. |
| 7 | Kickoff cron joins vip_signups -> user_teams -> teams.slug (D-06), preserves confirmed/unsubscribed filter and NOT EXISTS guard | VERIFIED | cron lines 104-118: usersQuery uses JOIN user_teams ut ON ut.email = v.email JOIN teams t ON t.slug = ut.team_slug, WHERE v.confirmed_at IS NOT NULL AND v.unsubscribed_at IS NULL, NOT EXISTS match_notifications guard, SELECT DISTINCT v.email. v.team IS NOT NULL dropped (correct). Call site argv unchanged. |
| 8 | A user following 2+ teams in a match receives exactly one email (NOTIFY-04) | VERIFIED | Structurally guaranteed by match_notifications UNIQUE(user_email, match_id, channel) + claim-before-send INSERT OR IGNORE (cron lines 120-123, 206-207). SELECT DISTINCT v.email is belt-and-suspenders. Proven by 12-03 Task 2 dry-run: "1 subscriber(s)" for two user_teams rows. |
| 9 | Cold signup stays single-team — index.astro and api/signup.ts untouched (D-03) | VERIFIED | grep across all modified files: index.astro and api/signup.ts appear in zero files_modified lists across 12-01 through 12-04. sendMagicLink signature is single team: string (email.ts line 20). SIGNUP-04 copy unchanged. |
| 10 | The unsubscribe contract is preserved: unsubscribed users cannot have user_teams written, and re-subscription does not silently re-activate a stale team list | FAILED | CR-01: save-selection.ts transaction has no confirmed_at IS NOT NULL AND unsubscribed_at IS NULL guard. CR-02: unsubscribe.ts does not delete from user_teams; markConfirmed clears unsubscribed_at to NULL, silently re-activating stale rows. (Detail below.) |
| 11 | D-07: email copy handles N teams without regression (SIGNUP-04, LAND-02) | VERIFIED | email.ts lines 17-22: sendMagicLink still takes single team: string. Value-prop "We'll email you 1 hour before every ${teamHuman} match in ${tzHuman}." grammatically correct. No LAND-02 terms. Confirmed unchanged (zero git diff). |

**Score:** 9/11 truths verified (2 failed — both map to the same root-cause gap)

---

## Critical Findings: CR-01 and CR-02 Independent Evaluation

The code review (12-REVIEW.md) alleged two BLOCKER findings. This verification independently evaluated each against the actual source files.

### CR-01: save-selection transaction lacks confirmed/unsubscribed guard — CONFIRMED TRUE

**Reading `src/pages/api/save-selection.ts` lines 31-102:**

The auth chain (lines 40-48) resolves an email from a manage token or session cookie. Both credentials are long-lived (manage = 24h, session = 30 days). After auth succeeds, the route proceeds directly to slug validation and then the transaction:

```
const saveSelection = db.transaction((email, slugs, timezone) => {
  deleteUserTeams.run(email);                    // unconditional
  for (const slug of slugs) insertUserTeam.run(email, slug);  // unconditional
  updateTimezone.run(timezone, email);           // no WHERE state check
});
saveSelection(result.email, validSlugs, tz);
```

The replaced `setSelection` (still present at db.ts lines 239-244) carried:
```sql
UPDATE vip_signups SET team = ?, timezone = ?
WHERE email = ? AND confirmed_at IS NOT NULL AND unsubscribed_at IS NULL
RETURNING *
```

The new `updateTimezone` (db.ts lines 290-292) is:
```sql
UPDATE vip_signups SET timezone = ? WHERE email = ?
```

No state predicate. The route does not check `user.confirmed_at` or `user.unsubscribed_at` before executing the transaction.

**Practical impact:** `manage.astro` branch C shows "You've unsubscribed" to an unsubscribed user who arrives at the page normally (via session-gated render at line 108-111). However, a direct POST to `/api/save-selection` bypasses the page entirely. A user who:
1. Signs up, confirms, follows 3 teams
2. Unsubscribes (via email link)
3. Still has a valid session cookie (≤30 days old) or a still-valid manage token

...can POST directly to `/api/save-selection` and write user_teams rows + overwrite timezone without any server-side rejection. The route will respond with a 303 to /manage?status=saved.

**The `status=unknown` path is also dead:** STATUS_COPY in manage.astro (lines 97-104) no longer contains an 'unknown' key. Even if a future guard were added and the route emitted `status=unknown`, the user would see nothing (statusMsg would be null).

**CR-01 verdict: BLOCKER — TRUE**

### CR-02: Unsubscribe does not clear user_teams; re-confirmation silently re-activates stale subscriptions — CONFIRMED TRUE

**Reading `src/pages/api/unsubscribe.ts` lines 1-26:**

```javascript
const updated = markUnsubscribed.get(result.email);
```

Only `markUnsubscribed` is called. There is no `deleteUserTeams.run(result.email)`. The user_teams rows persist after unsubscribe.

**Reading `src/lib/db.ts` lines 114-119 (markUnsubscribed):**

```sql
UPDATE vip_signups SET unsubscribed_at = strftime('%s','now')
WHERE email = ? AND unsubscribed_at IS NULL
RETURNING *
```

Sets `unsubscribed_at`. Does not touch user_teams.

**Reading `src/lib/db.ts` lines 102-108 (markConfirmed):**

```sql
UPDATE vip_signups
SET confirmed_at = strftime('%s','now'),
    unsubscribed_at = NULL
WHERE email = ? AND (confirmed_at IS NULL OR unsubscribed_at IS NOT NULL)
RETURNING *
```

This is the re-subscribe path triggered by `/api/confirm`. When executed, it clears `unsubscribed_at` to NULL. At that instant, the cron's `WHERE v.unsubscribed_at IS NULL` predicate is satisfied, and the user's stale `user_teams` rows (never deleted) become live.

**The cron correctly excludes current unsubscribed users** (WHERE v.unsubscribed_at IS NULL at lines 109-110) — so CR-02 does NOT cause immediate harm while `unsubscribed_at IS NOT NULL`. The harm materializes on re-confirmation via `/api/confirm`.

**Is this a real user path?** Yes. A user who:
1. Followed 3 teams on /manage
2. Clicked the unsubscribe link in a notification email
3. Later received a new magic-link email (from a friend, or from the launch blast), clicked it, and landed on /confirmed

...would now have `unsubscribed_at = NULL`, their 3 old `user_teams` rows still present, and the cron would begin emailing them again — without the user ever visiting /manage to re-select teams. They opted out, and the system re-opted them in as a side effect of clicking a confirmation link.

**CR-02 verdict: BLOCKER — TRUE**

### Interaction between CR-01 and CR-02

If CR-01 is fixed (save-selection rejects unsubscribed users), the orphaned user_teams rows from an unsubscribed user can only be (re-)written after re-confirmation. CR-02 then becomes the path by which those rows re-activate. Fixing CR-02 (clear user_teams on unsubscribe) is the correct minimal closure and makes both paths safe.

---

### Mitigation Sufficiency Assessment

The review's proposed fixes are correct and minimal:

**For CR-01:** Make `updateTimezone` the state gate inside the transaction:
```ts
// db.ts — add a scoped variant, or reuse in save-selection
const res = updateTimezoneActive.run(timezone, email);  // WHERE confirmed_at IS NOT NULL AND unsubscribed_at IS NULL
if (res.changes === 0) throw new Error('not-active');
// then proceed with deleteUserTeams + insertUserTeam loop
```
This restores the SQL-level guard and produces the `not-active` throw that the catch block maps to `redirectTo(formToken, 'unknown')`. Also restore the `'unknown'` key in STATUS_COPY.

**For CR-02:** In `unsubscribe.ts`, after `markUnsubscribed`:
```ts
deleteUserTeams.run(result.email);
```
`deleteUserTeams` is already exported from db.ts (line 274). This is a one-line fix.

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|---------|---------|--------|---------|
| `src/lib/db.ts` | user_teams DDL + 4 prepared statements + UserTeam type | VERIFIED | All present at lines 261-292. Additive, no ALTER/DROP. |
| `src/pages/api/save-selection.ts` | Multi-slug writer with VALID_TEAMS, >=1/<=5, single transaction | VERIFIED (partial) | Transaction wiring correct; VALID_TEAMS allow-list and bounds enforced; atomicity correct. Missing: confirmed/unsubscribed state gate. |
| `src/pages/manage.astro` | Confederation-grouped pre-checked checkboxes, too-many copy, Follow up to 5 | VERIFIED | Lines 251-266: checkboxes with checked={userTeamSlugs.has(t.slug)}. Legend "Your teams — Follow up to 5". STATUS_COPY has too-many. No <select name="team">. |
| `scripts/send-kickoff-notifications.mjs` | usersQuery via user_teams join + defensive DDL | VERIFIED | Lines 77-118: user_teams DDL extended, usersQuery joins through user_teams, SELECT DISTINCT, confirmed/unsubscribed filter, NOT EXISTS guard, call site unchanged. |
| `scripts/smoke-manage.mjs` | M10-M14 multi-team end-to-end cases | VERIFIED | M10-M14 present, dbInsertUserTeams/dbUserTeamSlugs/postMultiTeam helpers present, suite passed 15/15 per 12-04-SUMMARY. |
| `src/lib/email.ts` | sendMagicLink single-team signature unchanged, no LAND-02 terms | VERIFIED | Lines 17-22: team: string param. Value-prop single-team-correct. Zero LAND-02 terms. Zero edits. |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| manage.astro | /api/save-selection | form POST repeated name="team" checkboxes | VERIFIED | Lines 229, 259: action="/api/save-selection", input type="checkbox" name="team" value={t.slug} |
| save-selection.ts | user_teams + vip_signups.timezone | single db.transaction | VERIFIED (partial) | Wired correctly; missing state guard (CR-01) |
| save-selection.ts | updateTimezone (db.ts) | imported module-level constant | VERIFIED | Line 2 import, line 77 call inside transaction. No inline db.prepare. |
| manage.astro | user_teams | getUserTeams.all(email) | VERIFIED | Line 60: getUserTeams.all(result.email) |
| cron | user_teams -> teams.slug | JOIN user_teams ut ON ut.email = v.email JOIN teams t ON t.slug = ut.team_slug | VERIFIED | Lines 107-108 in cron. |
| unsubscribe.ts | user_teams | deleteUserTeams after markUnsubscribed | FAILED | unsubscribe.ts only calls markUnsubscribed — no deleteUserTeams call. user_teams rows persist after unsubscribe. |

---

## Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|---------|
| IDENT-02 | User can follow 1+ teams (v1 multi-team model restored) | VERIFIED | /manage checkboxes + user_teams table + cron join all wired |
| IDENT-03 | Selection persists in SQLite keyed off vip_signups row | VERIFIED | user_teams(email, team_slug) persists; getUserTeams returns the set |
| IDENT-04 | User can return via magic-link and edit team selection | VERIFIED | manage.astro loads getUserTeams and pre-checks boxes; save-selection writes new set |
| NOTIFY-04 | At most one notification per channel per match | VERIFIED | match_notifications UNIQUE + INSERT OR IGNORE + SELECT DISTINCT; proven by 12-03 dry-run |
| SIGNUP-04 | Confirmation email names team + tz (single-team-correct) | VERIFIED | sendMagicLink unchanged; "every ${teamHuman} match in ${tzHuman}" |
| LAND-02 | No prohibited terms in public surfaces | VERIFIED | Zero occurrences in manage.astro, email.ts (the Phase 12 surfaces) |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| src/pages/api/save-selection.ts | 74-79 | Transaction writes user_teams rows unconditionally for any authenticated email — no state predicate on confirmed_at / unsubscribed_at | BLOCKER | Unsubscribed user with a valid session (≤30 days) or manage token (≤24h) can write user_teams rows and clobber timezone via direct POST. Combined with CR-02, any future re-confirmation makes these rows live for the cron. |
| src/pages/api/unsubscribe.ts | 14 | markUnsubscribed called; user_teams NOT deleted | BLOCKER | Orphaned user_teams rows persist after unsubscribe. markConfirmed (re-subscription) clears unsubscribed_at, activating the stale rows for the cron without user action. |
| src/pages/manage.astro | 97-104 | STATUS_COPY no longer has 'unknown' key | WARNING | Even if a state guard is added to save-selection.ts (CR-01 fix), the 'unknown' redirect would render no message in the UI. Must be restored alongside the fix. |
| src/pages/manage.astro | 76-88 | Dynamic IN clause built via placeholder string expansion; ids bound twice as ...selectedIds, ...selectedIds | WARNING (WR-01, carry-forward) | Not an injection vector (ids are integers from a slug lookup, not user strings). But fragile: future edit adding a third IN or a LIMIT will silently misalign positional binds. Low priority. |

---

## Behavioral Spot-Checks

Step 7b is not fully runnable without a live server. The smoke suite (M10-M14) serves as the primary behavioral evidence. The following structural checks were performed directly against source:

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| Unsubscribed user blocked at save-selection | grep for confirmed_at OR unsubscribed_at in save-selection.ts | Zero matches — no state check before writes | FAIL |
| Cron excludes unsubscribed users | usersQuery WHERE v.unsubscribed_at IS NULL | Present at line 110 | PASS |
| user_teams cleared on unsubscribe | grep for deleteUserTeams in unsubscribe.ts | Zero matches | FAIL |
| markConfirmed clears unsubscribed_at | db.ts lines 104-105: SET unsubscribed_at = NULL | Present — confirmed as the re-activation path | INFO |
| save-selection uses imported updateTimezone (no inline db.prepare) | grep -c "db.prepare.*UPDATE vip_signups SET timezone" in save-selection.ts | Zero matches — uses imported constant | PASS |

---

## Human Verification Required

None — all gaps identified are programmatically verifiable and are confirmed BLOCKERs. No human-only verification items exist.

---

## Gaps Summary

Two blockers share a single root cause: Phase 12 introduced a join table (user_teams) as the authoritative subscription store, but did not update the authorization and lifecycle boundaries that govern writes to and cleanup of that store.

**Root cause:** The transaction in save-selection.ts replaced `setSelection` (which carried a SQL-level state guard) with a stateless write. Simultaneously, the unsubscribe handler was not updated to clean up the new join table it is now responsible for.

**Gap 1 (CR-01):** `save-selection.ts` transaction writes `user_teams` rows and clobbers timezone for any authenticated email regardless of `confirmed_at`/`unsubscribed_at` state. Fix: re-introduce the state guard inside the transaction (scope `updateTimezone` to the active-user predicate; abort transaction and return `status=unknown` on zero changes). Restore `'unknown'` to `STATUS_COPY` in `manage.astro`.

**Gap 2 (CR-02):** `unsubscribe.ts` does not call `deleteUserTeams` after `markUnsubscribed`. When `markConfirmed` clears `unsubscribed_at` (re-subscription path via `/api/confirm`), the stale `user_teams` rows become live for the cron without the user re-visiting `/manage`. Fix: add `deleteUserTeams.run(result.email)` to `unsubscribe.ts` after the `markUnsubscribed` call.

Both fixes are surgical (1-3 lines each) and do not require schema changes. The smoke suite (M10-M14) should be extended to cover the unsubscribed-POST rejection (CR-01) and the unsubscribe-then-reconfirm-then-cron-excludes path (CR-02) before re-verification is complete.

**Smoke coverage note:** The existing M10-M14 cases exercise only confirmed, active users — they do not cover the negative paths that would catch these regressions (WR-04 from the code review is accurate). The gap-closing plan should include smoke cases for these paths.

---

_Verified: 2026-05-16_
_Verifier: Claude (gsd-verifier)_
