---
phase: 12-restore-multi-team-selection
reviewed: 2026-05-16T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/lib/db.ts
  - src/pages/api/save-selection.ts
  - src/pages/manage.astro
  - scripts/send-kickoff-notifications.mjs
  - scripts/smoke-manage.mjs
findings:
  critical: 2
  warning: 5
  info: 3
  total: 10
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-05-16
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Phase 12 restores multi-team selection via a new additive `user_teams` join
table, a rewritten atomic `/api/save-selection`, a checkbox `/manage` editor,
and a re-pointed kickoff cron join. The parameterized SQL is clean (no
injection — the new IN clause uses `?` placeholders bound positionally, and the
join goes through `teams.slug` not user input). The transaction correctly
bundles the delete-all-then-insert plus timezone write. Server-side max-5 and
allow-list validation are present and ordered before any write.

However, the rewrite **dropped two correctness guards** that the previous
`setSelection` prepared statement enforced at the SQL level: the
`confirmed_at IS NOT NULL AND unsubscribed_at IS NULL` predicate. The new
transaction writes `user_teams` rows and overwrites `timezone`
**unconditionally** for any email a valid token/session resolves to. This is an
authorization/state-integrity regression (CR-01) and it also de-syncs the
"unknown signup" failure mode the UI still references. Separately, an
unsubscribe leaves orphaned `user_teams` rows that the kickoff cron's new join
will happily pick up if the row is ever reactivated by a non-`/manage` path
(CR-02). The smoke suite was extended but does not cover either regression —
M3/M10 only seed *confirmed, active* rows, so the missing guards pass silently.

## Critical Issues

### CR-01: Atomic save no longer gates on confirmed/active — unconfirmed or unsubscribed users can write team subscriptions and clobber timezone

**File:** `src/pages/api/save-selection.ts:74-79`, `src/lib/db.ts:274-292`

The replaced statement `setSelection` (still in `db.ts:239-244`) carried a
SQL-level guard:

```sql
UPDATE vip_signups SET team = ?, timezone = ?
WHERE email = ? AND confirmed_at IS NOT NULL AND unsubscribed_at IS NULL
RETURNING *
```

The route relied on this — `if (!updated) return redirectTo(formToken, 'unknown')`
— so a token that resolved to an unconfirmed or unsubscribed (or non-existent)
email produced zero writes and a clear failure.

The Phase 12 transaction has **no equivalent guard**:

```ts
const saveSelection = db.transaction((email, slugs, timezone) => {
  deleteUserTeams.run(email);
  for (const slug of slugs) insertUserTeam.run(email, slug);
  updateTimezone.run(timezone, email);  // UPDATE vip_signups SET timezone=? WHERE email=? — no state check
});
saveSelection(result.email, validSlugs, tz);
```

Consequences for any caller holding a valid `manage` token or session cookie
(both are long-lived: manage = 24h, session = 30d):

1. **Unsubscribed user.** `user_teams` rows are (re)created and `timezone`
   overwritten even though the user opted out. `manage.astro:111` only blocks
   the *editor render* (`isUnsubscribed`); it does not block the API. A user
   who unsubscribes, then replays a still-valid session cookie or an old
   `?token=` link directly to `POST /api/save-selection`, gets resurrected
   `user_teams` rows. Combined with CR-02, the next reactivation makes the
   kickoff cron email them — defeating the unsubscribe.
2. **Unconfirmed user.** Someone who signed up but never clicked the confirm
   link cannot normally reach `/manage` with a session, but a `manage`-purpose
   token (mintable for any email that requested one) now writes subscription
   state for a never-confirmed address.
3. **Deleted/unknown email.** `updateTimezone` silently no-ops (0 rows), but
   `insertUserTeam` still creates `user_teams` rows keyed on an email with no
   `vip_signups` parent (the table has no FK to `vip_signups`), leaving
   orphaned rows. The route still returns `status=saved`.

The `status=unknown` UI affordance is now dead: `STATUS_COPY` dropped the
`unknown` key (manage.astro diff) and the route never emits it, so even the
no-op-timezone case reports success.

**Fix:** Re-introduce the guard inside the transaction. Either gate the whole
transaction on a state check and abort if it fails, or make `updateTimezone`
state-scoped and verify it changed a row:

```ts
// db.ts — scope the timezone write and report whether the row qualified
export const updateTimezoneActive = db.prepare<[string, string]>(`
  UPDATE vip_signups SET timezone = ?
  WHERE email = ? AND confirmed_at IS NOT NULL AND unsubscribed_at IS NULL
`);

// save-selection.ts
const saveSelection = db.transaction((email: string, slugs: string[], timezone: string) => {
  const res = updateTimezoneActive.run(timezone, email);
  if (res.changes === 0) {
    // Not a confirmed, active signup — write nothing.
    throw new Error('not-active');
  }
  deleteUserTeams.run(email);
  for (const slug of slugs) insertUserTeam.run(email, slug);
});
try {
  saveSelection(result.email, validSlugs, tz);
} catch (err) {
  if ((err as Error).message === 'not-active') return redirectTo(formToken, 'unknown');
  console.error('[save-selection] db error', err);
  return redirectTo(formToken, 'server');
}
```

Restore the `unknown` entry in `STATUS_COPY` (manage.astro:97-104).

### CR-02: Unsubscribe does not clear `user_teams`; reactivation makes the kickoff cron email an opted-out address

**File:** `scripts/send-kickoff-notifications.mjs:104-118`, `src/lib/db.ts:114-119`, `src/lib/db.ts:262-269`

The new cron `usersQuery` joins `vip_signups → user_teams → teams`:

```sql
FROM vip_signups v
JOIN user_teams ut ON ut.email = v.email
JOIN teams t ON t.slug = ut.team_slug
WHERE v.confirmed_at IS NOT NULL AND v.unsubscribed_at IS NULL ...
```

`markUnsubscribed` (db.ts:114-119) only sets `vip_signups.unsubscribed_at`. It
does **not** delete `user_teams` rows, and there is no FK / `ON DELETE CASCADE`
(the join table is standalone with only a `UNIQUE(email, team_slug)`
constraint). So an unsubscribed user retains all their `user_teams` rows.

While `unsubscribed_at` is set the cron correctly excludes them. But the D-07
re-subscribe path (`markConfirmed`, db.ts:102-108) **clears
`unsubscribed_at` back to NULL** when a previously-unsubscribed user re-confirms
via magic link — *without* the user ever revisiting `/manage` to re-pick teams.
At that instant the stale `user_teams` rows become live again and the cron
resumes emailing every team the user followed *before* they unsubscribed. The
user opted out, re-confirmed (e.g. to receive a single specific thing), and is
now silently re-subscribed to their entire old team list with no action on
their part. This is a consent regression and an unsubscribe-bypass.

Pre-Phase-12 this could not happen: `markConfirmed` does not touch
`vip_signups.team`, but the *old* cron also keyed on `vip_signups.team` which
`setSelection` only wrote on an active row — and the single-team blast radius
was one team. The join-table indirection plus no cascade widens this to the
full historical selection.

**Fix:** Clear `user_teams` on unsubscribe so re-subscription starts from a
clean slate (user re-picks in `/manage`):

```ts
// db.ts
export const deleteUserTeamsByEmail = db.prepare<[string]>(`
  DELETE FROM user_teams WHERE email = ?
`); // (deleteUserTeams already exists — reuse it)

// src/pages/api/unsubscribe.ts — inside the success branch, after markUnsubscribed:
deleteUserTeams.run(email);
```

Alternatively, gate cron membership on an explicit "actively followed"
timestamp, but clearing on unsubscribe is the minimal correct fix and matches
the delete-all-then-insert contract already used on save.

## Warnings

### WR-01: Duplicate `placeholders` expansion in the matches IN clause double-binds and is fragile

**File:** `src/pages/manage.astro:75-91`

```ts
const placeholders = selectedIds.map(() => '?').join(', ');
... WHERE m.home_team_id IN (${placeholders}) OR m.away_team_id IN (${placeholders})
... .all(...selectedIds, ...selectedIds)
```

This is correct today (the same id list bound twice for two IN lists) and is
*not* an injection vector — `selectedIds` are integers resolved from
`SELECT id FROM teams WHERE slug = ?`, never user strings. But it is brittle:
the parameter count must stay exactly `2 * selectedIds.length` and the two
`${placeholders}` spans must remain identical. A future edit that adds a third
condition or a `LIMIT ?` will silently misalign positional binds (better-sqlite3
throws on count mismatch, but a *reordered* edit binds the wrong values without
error). Prefer a single named/JSON parameter or a CTE:

```sql
WHERE m.home_team_id IN (SELECT id FROM teams WHERE slug IN (...))
   OR m.away_team_id IN (SELECT id FROM teams WHERE slug IN (...))
```

or bind once via `json_each`:

```ts
db.prepare(`... WHERE m.home_team_id IN (SELECT value FROM json_each(?))
                   OR m.away_team_id IN (SELECT value FROM json_each(?))`)
  .all(JSON.stringify(selectedIds), JSON.stringify(selectedIds));
```

### WR-02: Bad-slug rejection is all-or-nothing and leaks raw user input to logs

**File:** `src/pages/api/save-selection.ts:56-62`

```ts
const validSlugs = rawSlugs.filter((s) => VALID_TEAMS.has(s));
const hasBadSlug = rawSlugs.length !== validSlugs.length;
if (hasBadSlug || validSlugs.length === 0) {
  console.error(`[save-selection] bad-team: raw=${rawSlugs.join(',')} ...`);
  return redirectTo(formToken, 'bad-team');
}
```

Two issues:

1. **UX/robustness:** a single unknown `team` value (e.g. a stale tab posting a
   slug that was renamed in `teams.json`, or a duplicate the browser sent)
   rejects the *entire* save. Given the client cap script and 48-team list, a
   benign mismatch loses the user's whole selection. Consider rejecting only
   when *zero* valid slugs remain after filtering, or de-duplicating
   (`new Set(rawSlugs)`) before counting — a checkbox form cannot legitimately
   send duplicates, but a crafted/replayed body can, and a duplicate currently
   trips `hasBadSlug` is false but inflates the >5 count (see WR-03).
2. **Log hygiene:** `rawSlugs.join(',')` writes attacker-controlled,
   un-truncated form input straight into journald. Slugs are length-bounded
   only by the absence of a cap here (no per-value length check before the
   allow-list filter). Cap and sanitize before logging:
   `raw=${rawSlugs.map(s => s.slice(0,32)).join(',')}`.

### WR-03: Duplicate slugs bypass de-dup and can mis-trigger the max-5 reject

**File:** `src/pages/api/save-selection.ts:51-66`

`rawSlugs` is not de-duplicated. `insertUserTeam` is `INSERT OR IGNORE` with
`UNIQUE(email, team_slug)`, so duplicates don't create duplicate rows — good.
But the **count check runs on the pre-insert list**:
`if (validSlugs.length > 5)`. A replayed/crafted body with
`team=england&team=england&team=england&team=england&team=england&team=england`
(6 entries, 1 distinct, all valid) is rejected as `too-many` even though it
resolves to a single team. Conversely the inverse is fine. De-dup before both
the count and the allow-list filter:

```ts
const rawSlugs = [...new Set(
  (form.getAll('team') as string[]).map((s) => s.trim().toLowerCase()).filter(Boolean)
)];
```

### WR-04: Phase 12 smoke suite does not cover the CR-01 / CR-02 regressions it should catch

**File:** `scripts/smoke-manage.mjs:374-415, 648-677`

M3 and M10 (the multi-save happy paths) seed rows via `dbInsertSmokeRow`, which
always sets `confirmed_at = now` and `unsubscribed_at = NULL`. There is no case
that:

- POSTs `/api/save-selection` with a session for an **unsubscribed** email and
  asserts no `user_teams` rows are written (would catch CR-01);
- POSTs for an **unconfirmed** email and asserts rejection (CR-01);
- marks a user unsubscribed *with* seeded `user_teams` rows, then runs the
  cron-equivalent JOIN and asserts zero rows, then `markConfirmed` and asserts
  the user does **not** silently reappear (CR-02).

M14 only proves the positive case (active user *does* appear). The suite claims
"goal-backward proof for ... NOTIFY-04 ... D-07" in its header but exercises
neither failure direction. Add negative cases before treating the smoke as
evidence the unsubscribe contract holds.

### WR-05: `db` import retained in save-selection.ts but only used for the transaction; `db` import in manage.astro builds raw SQL strings inline

**File:** `src/pages/api/save-selection.ts:2`, `src/pages/manage.astro:6,67-87`

`save-selection.ts` no longer uses `db.prepare(...)` directly (the old
`SELECT slug FROM teams WHERE id = ?` fallback was removed) — `db` is now used
only for `db.transaction(...)`. That is legitimate, but the project convention
(CLAUDE.md: "No barrel exports — every import names its file directly"; prepared
statements live in `db.ts`) is for SQL to be centralized in `db.ts`.
`manage.astro:67` and `:76-87` build and `prepare()` ad-hoc SQL in a page
component instead of exporting named prepared statements from `db.ts` like every
other query. The dynamic `IN (${placeholders})` genuinely cannot be a static
prepared statement, but `SELECT id FROM teams WHERE slug = ?` (line 68) can and
should be a named export reused from `db.ts` (a `getTeamIdBySlug`), consistent
with `getByEmail`, `getUserTeams`, etc. This is a maintainability/consistency
defect, not a bug.

## Info

### IN-01: `UserTeam` type exported but never imported

**File:** `src/lib/db.ts:271`

`export type UserTeam = { id: number; email: string; team_slug: string };` is
declared but no module imports it (consumers use inline
`{ team_slug: string }[]` casts in manage.astro:60 and the `getUserTeams`
generic). Either use it at the call sites for type safety or drop it. Low
priority — it documents the table shape.

### IN-02: Cron `usersQuery` no longer filters `team IS NOT NULL`; relies entirely on join existence

**File:** `scripts/send-kickoff-notifications.mjs:104-118`

The removed `AND v.team IS NOT NULL` is correctly obsolete (membership is now
join existence). No bug — noting for reviewers tracing the diff that this
removal is intentional and the `JOIN user_teams` makes the predicate
redundant. The `SELECT DISTINCT` correctly collapses the both-teams-in-one-match
fan-out; NOTIFY-04 single-email remains enforced by the
`match_notifications` UNIQUE + claim-before-send.

### IN-03: Schema duplicated verbatim between `db.ts` and the cron script with no shared source

**File:** `src/lib/db.ts:262-269`, `scripts/send-kickoff-notifications.mjs:77-84`

The `user_teams` `CREATE TABLE` / index is hand-copied into the cron's
defensive block (matching the existing `match_notifications` precedent, so this
follows established project pattern). Acceptable per the codebase's
"self-contained script" convention, but any future column add to `user_teams`
must be applied in both places or the cron's table shape drifts from the web
server's. Worth a one-line comment cross-reference (the existing comment says
"Mirrors src/lib/db.ts" — adequate).

---

_Reviewed: 2026-05-16_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
