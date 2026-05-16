---
phase: 12-restore-multi-team-selection
verified: 2026-05-16T12:00:00Z
status: passed
score: 11/11 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 9/11
  gaps_closed:
    - "The unsubscribe contract is preserved: unsubscribed users cannot have user_teams written, and unsubscribing clears user_teams so re-subscription cannot silently re-activate a stale team list"
  gaps_remaining: []
  regressions: []
---

# Phase 12: Restore Multi-Team Selection — Verification Report

**Phase Goal:** A signed-in subscriber can follow 1–5 World Cup teams via confederation-grouped checkboxes on /manage (current picks pre-checked, server-enforced bounds), those picks persist in a user_teams join table, and the kickoff cron fans out one email per match for any followed team — while cold signup stays single-team and the one-email-per-match guarantee is preserved.

**Verified:** 2026-05-16
**Status:** PASSED
**Re-verification:** Yes — after gap closure plans 12-05 (CR-01/CR-02 fixes) and 12-06 (M15/M16 smoke cases)

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | user_teams join table exists, additive, idempotent (D-01) | VERIFIED | db.ts lines 261-269: CREATE TABLE IF NOT EXISTS user_teams + UNIQUE(email, team_slug) + idx_user_teams_email. No ALTER/DROP/probe. |
| 2 | deleteUserTeams, insertUserTeam, getUserTeams, updateTimezoneActive exported with typed generics (D-01) | VERIFIED | db.ts lines 274-301: all four statements present. updateTimezoneActive replaces the original updateTimezone in the save-selection transaction. updateTimezone still exported (line 290) and both are distinct. |
| 3 | /manage signed-in branch renders confederation-grouped pre-checked checkboxes (D-04) | VERIFIED | manage.astro lines 252-267: fieldset iterates groupedTeams, renders input type="checkbox" name="team" with checked={userTeamSlugs.has(t.slug)}. No <select name="team"> present. Legend "Your teams — Follow up to 5". |
| 4 | Saving 1–5 valid teams persists to user_teams atomically with timezone in one db.transaction (D-05) | VERIFIED | save-selection.ts lines 76-81: single db.transaction with updateTimezoneActive.run (first — gate), deleteUserTeams.run, insertUserTeam.run loop. VALID_TEAMS allow-list enforced. >=1 and <=5 bounds enforced before transaction. |
| 5 | Saving >5 teams redirects with status=too-many, zero writes (D-05) | VERIFIED | save-selection.ts lines 63-66: validSlugs.length > 5 returns redirectTo(formToken, 'too-many') before transaction. M12 smoke case confirms zero writes on reject. |
| 6 | Saving 0 or invalid slugs redirects with status=bad-team, zero writes (D-05) | VERIFIED | save-selection.ts lines 59-62: hasBadSlug || validSlugs.length === 0 returns redirectTo(formToken, 'bad-team') before transaction. M13 smoke case confirms zero writes on empty. |
| 7 | Kickoff cron joins vip_signups -> user_teams -> teams.slug (D-06), preserves confirmed/unsubscribed filter and NOT EXISTS guard | VERIFIED | cron lines 104-118: usersQuery uses JOIN user_teams ut ON ut.email = v.email JOIN teams t ON t.slug = ut.team_slug, WHERE v.confirmed_at IS NOT NULL AND v.unsubscribed_at IS NULL, NOT EXISTS match_notifications guard, SELECT DISTINCT v.email. |
| 8 | A user following 2+ teams in a match receives exactly one email (NOTIFY-04) | VERIFIED | match_notifications UNIQUE(user_email, match_id, channel) + claim-before-send INSERT OR IGNORE (cron lines 120-123). SELECT DISTINCT v.email is belt-and-suspenders. Confirmed by M14 dry-run. |
| 9 | Cold signup stays single-team — index.astro and api/signup.ts untouched (D-03) | VERIFIED | git log confirms zero Phase-12 commits touching src/pages/index.astro or src/pages/api/signup.ts. D-03 fence holds. |
| 10 | The unsubscribe contract is preserved: unsubscribed users cannot have user_teams written, and re-subscription does not silently re-activate a stale team list | VERIFIED | CR-01 closed: save-selection.ts transaction calls updateTimezoneActive (lines 77-78) as first statement — throws 'not-active' when row is not (confirmed AND not-unsubscribed); catch arm (lines 100-102) maps that to redirectTo(formToken, 'unknown'); zero user_teams writes occur. CR-02 closed: unsubscribe.ts calls deleteUserTeams.run(result.email) unconditionally at line 19 after markUnsubscribed. manage.astro STATUS_COPY has 'unknown' key restored (line 104). M15 + M16 smoke cases confirm behavioral enforcement. |
| 11 | D-07: email copy handles N teams without regression (SIGNUP-04, LAND-02) | VERIFIED | email.ts sendMagicLink still takes single team: string (signup stays single-team). Zero LAND-02 terms in manage.astro 'unknown' STATUS_COPY copy. No SIGNUP-04 regression. |

**Score:** 11/11 truths verified

---

## CR-01 and CR-02 Independent Verification (Re-verification Focus)

### CR-01: save-selection transaction state gate — VERIFIED CLOSED

**Reading `src/pages/api/save-selection.ts`:**

Import line 2: `import { db, deleteUserTeams, insertUserTeam, updateTimezoneActive, insertFeatureRequest } from '../../lib/db';`

Transaction callback (lines 76-81):
```
const saveSelection = db.transaction((email: string, slugs: string[], timezone: string) => {
  const res = updateTimezoneActive.run(timezone, email);   // FIRST — state gate
  if (res.changes === 0) throw new Error('not-active');
  deleteUserTeams.run(email);
  for (const slug of slugs) insertUserTeam.run(email, slug);
});
```

The gate runs BEFORE any user_teams write. `updateTimezoneActive` (db.ts lines 298-301) is:
```sql
UPDATE vip_signups SET timezone = ?
WHERE email = ? AND confirmed_at IS NOT NULL AND unsubscribed_at IS NULL
```

`res.changes === 0` throws before `deleteUserTeams` or any `insertUserTeam` executes. better-sqlite3 rolls back the entire transaction on the throw, guaranteeing zero user_teams writes and no timezone change for an unsubscribed or unconfirmed user.

Catch block (lines 100-102): the discriminated arm maps `'not-active'` to `redirectTo(formToken, 'unknown')` with a distinct `console.error('[save-selection] not-active: ...)` log line.

**CR-01 verdict: CLOSED — TRUE**

### CR-01 UI: 'unknown' STATUS_COPY restored — VERIFIED CLOSED

**Reading `src/pages/manage.astro` lines 97-105:**

```
const STATUS_COPY: Record<string, { kind: 'ok' | 'err'; text: string }> = {
  saved:       { kind: 'ok',  text: 'Saved. Your schedule is updated below.' },
  'bad-token': { kind: 'err', text: 'That link is no longer valid. Request a new one.' },
  'bad-tz':    { kind: 'err', text: "Couldn't read your time zone. Try again." },
  'bad-team':  { kind: 'err', text: 'Team not recognized. Pick 1–5 teams from the list and save again.' },
  'too-many':  { kind: 'err', text: 'You can follow at most 5 teams. Uncheck some and save again.' },
  server:      { kind: 'err', text: 'Server hiccup. Try again in a minute.' },
  'unknown':   { kind: 'err', text: 'Your account is not an active subscription. Re-confirm your email or sign up again.' },
};
```

All seven entries present. `'unknown'` entry has `kind: 'err'` and action-oriented copy. LAND-02 prohibited terms: zero matches confirmed by grep.

**CR-01 UI verdict: CLOSED — TRUE**

### CR-02: unsubscribe clears user_teams — VERIFIED CLOSED

**Reading `src/pages/api/unsubscribe.ts` lines 3, 14, 19:**

Import: `import { markUnsubscribed, getByEmail, deleteUserTeams } from '../../lib/db';`

Execution path:
```
const updated = markUnsubscribed.get(result.email);   // line 14
deleteUserTeams.run(result.email);                    // line 19 — unconditional
```

`deleteUserTeams.run` is called unconditionally on the verified-token path (after the `!token` / `!result` early returns). Calling it when `updated` is falsy (already-unsubscribed branch) is correct and safe: DELETE on zero matching rows is a no-op (.changes === 0), making the call idempotent. The markConfirmed (re-subscription) path in db.ts line 104-106 clears `unsubscribed_at = NULL` — but post-CR-02-fix there are no user_teams rows left to re-activate.

**CR-02 verdict: CLOSED — TRUE**

### M15/M16 Smoke Behavioral Evidence

`scripts/smoke-manage.mjs` contains M15-unsub-save-rejected and M16-unsub-reconfirm-no-stale (confirmed by `grep -c` returning 4 — 2 header evidence-tag occurrences + 2 runCase name occurrences). `node --check scripts/smoke-manage.mjs` exits 0 (syntax valid).

M15 asserts all three CR-01 facts: `status=unknown` in Location, `dbUserTeamSlugs(email)` unchanged from pre-seeded value, `dbRowFor(email).timezone` unchanged from seeded value.

M16 asserts the full CR-02 chain: real GET /api/unsubscribe → `dbUserTeamSlugs(email).length === 0` → `dbMarkConfirmed` → usersQuery-equivalent JOIN filtered to email yields 0 rows.

The 12-06-SUMMARY records pass=17 fail=0 exit 0 against the freshly-built 12-05-fixed server on a scratch DB.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|---------|---------|--------|---------|
| `src/lib/db.ts` | user_teams DDL + statements + updateTimezoneActive | VERIFIED | Lines 261-301. user_teams DDL additive. updateTimezoneActive exported at line 298 with predicate `confirmed_at IS NOT NULL AND unsubscribed_at IS NULL`. Both updateTimezone (line 290) and setSelection (line 239) retained unchanged. |
| `src/pages/api/save-selection.ts` | State-gated multi-slug writer with VALID_TEAMS, >=1/<=5, single transaction, consent gate | VERIFIED | updateTimezoneActive as first transaction stmt (line 77); res.changes === 0 throws (line 78); discriminated catch maps to 'unknown' (lines 100-102); zero writes on inactive user. |
| `src/pages/manage.astro` | Confederation-grouped pre-checked checkboxes, 'unknown' STATUS_COPY, too-many/bad-team copy | VERIFIED | Lines 252-267: checkboxes with checked={userTeamSlugs.has(t.slug)}. Lines 97-105: all 7 STATUS_COPY entries including 'unknown'. |
| `scripts/send-kickoff-notifications.mjs` | usersQuery via user_teams join + confirmed/unsubscribed filter + NOT EXISTS guard | VERIFIED | Lines 104-118: full join chain, filters, and NOT EXISTS guard. |
| `scripts/smoke-manage.mjs` | M1–M16 including M15/M16 negative-path cases | VERIFIED | M15 + M16 added after M14. M1–M14 intact. `node --check` exits 0. |
| `src/lib/email.ts` | sendMagicLink single-team signature unchanged, no LAND-02 terms | VERIFIED | Unchanged across Phase 12. Single team: string param. |
| `src/pages/api/unsubscribe.ts` | deleteUserTeams.run called after markUnsubscribed on verified-token path | VERIFIED | Line 19: unconditional deleteUserTeams.run(result.email) after line 14 markUnsubscribed. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| manage.astro | /api/save-selection | form POST repeated name="team" checkboxes | VERIFIED | Lines 230, 260: action="/api/save-selection", input type="checkbox" name="team" value={t.slug} |
| save-selection.ts | user_teams + vip_signups.timezone | single db.transaction gated by updateTimezoneActive | VERIFIED | updateTimezoneActive is first stmt; throws 'not-active' on res.changes===0; catch maps to 'unknown'; zero writes for inactive user. |
| save-selection.ts | updateTimezoneActive (db.ts) | imported module-level constant | VERIFIED | Line 2 import, line 77 call as first statement in transaction. |
| manage.astro | user_teams | getUserTeams.all(email) | VERIFIED | Line 60: getUserTeams.all(result.email) |
| cron | user_teams -> teams.slug | JOIN user_teams ut ON ut.email = v.email JOIN teams t ON t.slug = ut.team_slug | VERIFIED | Lines 107-108 in cron. |
| unsubscribe.ts | user_teams | deleteUserTeams.run after markUnsubscribed | VERIFIED | Line 19: unconditional, idempotent. Closes CR-02. |
| manage.astro STATUS_COPY | /manage?status=unknown render | 'unknown' key present | VERIFIED | Line 104: 'unknown' entry with kind: 'err'. statusMsg resolves non-null on status=unknown. |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---------|--------------|--------|-------------------|--------|
| manage.astro | userTeamSlugs | getUserTeams.all(result.email) → user_teams table | Yes — real DB query | FLOWING |
| save-selection.ts | validSlugs | form.getAll('team') parsed + VALID_TEAMS filtered | Yes — user input through validation | FLOWING |
| send-kickoff-notifications.mjs | users | usersQuery JOIN user_teams JOIN teams | Yes — real DB query with filters | FLOWING |

---

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|---------|
| IDENT-02 | User can pick 1+ teams from all 48 World Cup 2026 teams | VERIFIED | /manage checkboxes + user_teams table + cron join all wired |
| IDENT-03 | Selection persists in SQLite keyed off vip_signups row | VERIFIED | user_teams(email, team_slug) persists; getUserTeams returns the set |
| IDENT-04 | User can return via magic-link and edit team selection | VERIFIED | manage.astro loads getUserTeams and pre-checks boxes; save-selection writes new set |
| NOTIFY-04 | At most one notification per channel per match | VERIFIED | match_notifications UNIQUE + INSERT OR IGNORE + SELECT DISTINCT |
| SIGNUP-04 | Confirmation email names team + tz (single-team-correct) | VERIFIED | sendMagicLink unchanged; single team: string param |
| LAND-02 | No prohibited terms in public surfaces | VERIFIED | Zero occurrences in manage.astro (including 'unknown' copy). LAND-02 grep confirmed. |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| src/pages/manage.astro | 286 | `{m.home_tla ?? 'TBD'}` | INFO | Not a debt marker — a null-coalescing display fallback for an unresolved team abbreviation from the DB. Present since commit 451530a (Phase 9), predates Phase 12. Not actionable. |
| src/pages/manage.astro | 76-88 | Dynamic IN clause via placeholder string expansion; ids bound twice as ...selectedIds, ...selectedIds | WARNING (WR-01, carry-forward) | Not an injection vector (ids are integers from a slug lookup). Fragile but low-priority. Unchanged from prior verification. |

No TBD/FIXME/XXX unreferenced debt markers in Phase-12-modified files. The `TBD` in manage.astro line 286 is a Astro JSX null-coalescing string literal, not a code debt marker, and predates this phase.

---

### Behavioral Spot-Checks

Step 7b: Note — the 12-06 plan executed a full end-to-end smoke (M1–M16) against the freshly-built server on a scratch DB, which is the project's established smoke-via-built-server convention. The smoke script (`node --check` syntax-valid) serves as the behavioral verification spine. Individual grep-based structural checks confirm the critical behaviors:

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| Unsubscribed user blocked at save-selection (CR-01) | grep for updateTimezoneActive as first stmt in transaction + res.changes === 0 throw | Present at lines 77-78 (first in transaction body) | PASS |
| 'unknown' STATUS_COPY renders visible message | grep for 'unknown': in manage.astro STATUS_COPY | Present at line 104 with { kind: 'err', text } | PASS |
| user_teams cleared on unsubscribe (CR-02) | grep for deleteUserTeams.run in unsubscribe.ts | Present at line 19, unconditional | PASS |
| Cron excludes unsubscribed users | usersQuery WHERE v.unsubscribed_at IS NULL | Present at line 110 of cron | PASS |
| updateTimezoneActive uses active-user predicate | grep for confirmed_at IS NOT NULL AND unsubscribed_at IS NULL in db.ts | Present at lines 242 (setSelection) and 300 (updateTimezoneActive) | PASS |
| No new redirectTo error codes introduced | grep -oE "redirectTo(formToken, '[a-z-]+'" | Only: too-many, bad-team, bad-tz, unknown, server, saved | PASS |
| D-03: index.astro and api/signup.ts untouched | git log Phase-12 commits filtering those paths | Zero commits | PASS |

---

### Human Verification Required

None. All truths are programmatically verified and confirmed. No human-only verification items exist.

---

### Gaps Summary

No gaps remaining. Both BLOCKER findings from the prior verification (CR-01 and CR-02) are independently confirmed closed in the live source.

**Previously FAILED truth #10 is now VERIFIED:**

CR-01 (save-selection state gate): `updateTimezoneActive` runs as the first statement inside the existing `db.transaction` in `save-selection.ts`. Its SQL predicate (`confirmed_at IS NOT NULL AND unsubscribed_at IS NULL`) restores the guard the replaced `setSelection` carried. `res.changes === 0` throws `'not-active'`, rolling back the transaction (zero user_teams writes, no timezone change). The discriminated catch arm maps that to `redirectTo(formToken, 'unknown')`. The `'unknown'` key is restored in `manage.astro` STATUS_COPY so the message renders.

CR-02 (unsubscribe clears user_teams): `deleteUserTeams.run(result.email)` is called unconditionally after `markUnsubscribed` on the verified-token path in `unsubscribe.ts`. This is idempotent (DELETE on zero rows is a no-op). After re-confirmation via `markConfirmed` (which clears `unsubscribed_at = NULL`), the cron's `user_teams` JOIN yields zero rows — no stale fan-out. The user must explicitly re-pick teams on `/manage`.

M15 and M16 in `scripts/smoke-manage.mjs` provide behavioral regression detection for both fixes. The full M1–M16 suite (pass=17 fail=0) confirmed by 12-06-SUMMARY.

---

_Verified: 2026-05-16_
_Verifier: Claude (gsd-verifier)_
_Re-verification: Yes — after gap closure plans 12-05 (commits b36825c, 287ebbe, b3482b2) and 12-06 (commit 274fd8f)_
