# Phase 12: Restore Multi-Team Selection — Pattern Map

**Mapped:** 2026-05-15
**Files analyzed:** 6
**Analogs found:** 6 / 6

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/lib/db.ts` | model/schema | CRUD | `src/lib/db.ts` (existing tables) | exact — same file, additive block |
| `src/pages/manage.astro` | component/page | request-response | `src/pages/manage.astro` (branch D, lines 196–284) | exact — same file, replace select block |
| `src/pages/api/save-selection.ts` | controller | CRUD | `src/pages/api/save-selection.ts` (current) | exact — same file, extend slug logic |
| `scripts/send-kickoff-notifications.mjs` | utility/script | CRUD/batch | `scripts/send-kickoff-notifications.mjs` (current) | exact — same file, swap `usersQuery` |
| `src/lib/email.ts` | service | request-response | `src/lib/email.ts` (current `sendMagicLink`) | exact — verify-only, no change expected |
| `scripts/smoke-manage.mjs` | test | request-response | `scripts/smoke-manage.mjs` (current M1–M9) | exact — same file, extend with new cases |

---

## Pattern Assignments

### 1. `src/lib/db.ts` — add `user_teams` table + prepared statements

**Analog:** `src/lib/db.ts` — existing `CREATE TABLE IF NOT EXISTS` blocks and prepared-statement declarations.

**DDL pattern to copy from** (lines 122–153 — `teams`/`matches`/`match_notifications` block):
```typescript
db.exec(`
  CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY,
    tla TEXT NOT NULL,
    ...
  );
  CREATE INDEX IF NOT EXISTS idx_matches_home_team ON matches(home_team_id);
  ...
  CREATE TABLE IF NOT EXISTS match_notifications (
    ...
    UNIQUE (user_email, match_id, channel)
  );
  CREATE INDEX IF NOT EXISTS idx_notif_match ON match_notifications(match_id);
`);
```

**Additive-column probe pattern** (lines 159–166 — `teams.slug` ALTER block):
```typescript
{
  const cols = db
    .prepare("SELECT name FROM pragma_table_info('teams')")
    .all() as { name: string }[];
  const has = (n: string) => cols.some((c) => c.name === n);
  if (!has('slug'))
    db.exec(`ALTER TABLE teams ADD COLUMN slug TEXT;`);
}
```

**Prepared-statement generic pattern** (lines 81–93 — `upsertVipSignup`):
```typescript
export const upsertVipSignup = db.prepare<
  [string, string, string | null, string | null, string | null, string]
>(`
  INSERT INTO vip_signups (email, requested_sport, ip, user_agent, team, timezone)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(email) DO UPDATE SET ...
  RETURNING *
`);
```

**Simple-param statement pattern** (lines 110–119 — `getByEmail`/`markUnsubscribed`):
```typescript
export const getByEmail = db.prepare<[string]>(`
  SELECT * FROM vip_signups WHERE email = ?
`);
```

**Adaptation for Phase 12:**
Append a new `db.exec` block after the `feature_requests` block (line 179). No probe needed — pure additive:
```typescript
db.exec(`
  CREATE TABLE IF NOT EXISTS user_teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    team_slug TEXT NOT NULL,
    UNIQUE(email, team_slug)
  );
  CREATE INDEX IF NOT EXISTS idx_user_teams_email ON user_teams(email);
`);
```

Then export three prepared statements matching the project's typed-generic idiom:
```typescript
export const deleteUserTeams = db.prepare<[string]>(`
  DELETE FROM user_teams WHERE email = ?
`);

export const insertUserTeam = db.prepare<[string, string]>(`
  INSERT OR IGNORE INTO user_teams (email, team_slug) VALUES (?, ?)
`);

export const getUserTeams = db.prepare<[string]>(`
  SELECT team_slug FROM user_teams WHERE email = ?
`);
```

Export a `UserTeam` type following the `VipSignup`/`Team` shape at lines 63–75 and 182–189.

---

### 2. `src/pages/manage.astro` — swap single `<select>` for confederation-grouped checkboxes

**Analog:** `src/pages/manage.astro` — the signed-in editor (branch D, lines 196–284) + the frontmatter confederation grouping (lines 9–31).

**Confederation grouping already present in frontmatter** (lines 9–31 — copy verbatim):
```typescript
const CONFEDERATION_ORDER = [
  'UEFA', 'CONMEBOL', 'CONCACAF', 'CAF', 'AFC', 'OFC',
] as const;

const CONFEDERATION_LABEL: Record<...> = {
  UEFA: 'UEFA — Europe',
  CONMEBOL: 'CONMEBOL — South America',
  CONCACAF: 'CONCACAF — North & Central America',
  CAF: 'CAF — Africa',
  AFC: 'AFC — Asia',
  OFC: 'OFC — Oceania',
};

const groupedTeams = CONFEDERATION_ORDER.map((conf) => ({
  conf,
  label: CONFEDERATION_LABEL[conf],
  teams: TEAMS.filter((t) => t.confederation === conf),
}));
```

**Current single `<select>` to replace** (lines 232–244, inside branch D `<fieldset class="picker">`):
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

**Adaptation for Phase 12:**
Replace that `<fieldset>` block with confederation-grouped `<input type="checkbox">` elements. The `user?.team` pre-check becomes a set check against `user_teams` rows loaded in frontmatter. The `selected={t.slug === user?.team}` predicate becomes `checked={userTeamSlugs.has(t.slug)}`.

Frontmatter additions needed:
- Import `getUserTeams` from `../../lib/db`
- After `user = getByEmail.get(...)`, query `getUserTeams.all(result.email)` to get `{ team_slug: string }[]` rows, build `userTeamSlugs = new Set(rows.map(r => r.team_slug))`
- Drop the `user.team`-based `selectedIds` lookup; replace with a JOIN over `user_teams` for the matches query

`STATUS_COPY` at lines 78–86 needs two new entries (revive Phase-9 `too-many`):
```typescript
'too-many': { kind: 'err', text: 'You can follow at most 5 teams. Uncheck some and save again.' },
```
(`bad-team` entry already present at line 83 — keep it.)

Banner copy at line 199 changes from `user?.team` null-check to `userTeamSlugs.size === 0`.

The optional JS-off-safe checkbox cap (D-05 nicety) follows the same `<script is:inline>` pattern used at lines 291–335. It must degrade gracefully and be purely additive.

---

### 3. `src/pages/api/save-selection.ts` — multi-slug write with ≥1/≤5 enforcement

**Analog:** `src/pages/api/save-selection.ts` (current file, all 104 lines).

**Auth pattern to preserve verbatim** (lines 40–49):
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

**`redirectTo` helper to preserve verbatim** (lines 24–30):
```typescript
function redirectTo(token: string, status: string, setCookie?: string): Response {
  const params = new URLSearchParams({ status });
  if (token) params.set('token', token);
  const headers: Record<string, string> = { Location: `/manage?${params}` };
  if (setCookie) headers['Set-Cookie'] = setCookie;
  return new Response(null, { status: 303, headers });
}
```

**Current slug-resolution block to replace** (lines 51–74 — the `teamSlug` + `team_ids[]` fallback logic):
```typescript
let teamSlug: string | null = null;
const slugInput = ((form.get('team') as string) ?? '').trim().toLowerCase();
if (slugInput && VALID_TEAMS.has(slugInput)) {
  teamSlug = slugInput;
} else {
  // Fallback: resolve first valid team_ids[] integer to slug
  const rawIds = form.getAll('team_ids') as string[];
  for (const raw of rawIds) { ... }
}
if (!teamSlug) {
  return redirectTo(formToken, 'bad-team');
}
```

**Adaptation for Phase 12 — replace the slug block with multi-slug logic:**
```typescript
// Parse all `team` values from the multi-checkbox form.
const rawSlugs = (form.getAll('team') as string[])
  .map((s) => s.trim().toLowerCase())
  .filter((s) => s.length > 0);

// Validate all slugs against VALID_TEAMS allow-list.
const validSlugs = rawSlugs.filter((s) => VALID_TEAMS.has(s));
const hasBadSlug = rawSlugs.length !== validSlugs.length;

if (hasBadSlug || validSlugs.length === 0) {
  console.error(`[save-selection] bad-team: raw=${rawSlugs.join(',')} valid=${validSlugs.join(',')}`);
  return redirectTo(formToken, 'bad-team');
}
if (validSlugs.length > 5) {
  console.error(`[save-selection] too-many: count=${validSlugs.length}`);
  return redirectTo(formToken, 'too-many');
}
```

**Current `setSelection.get(...)` call to replace** (lines 79–81) with a better-sqlite3 transaction:
```typescript
// Transaction pattern: the db object is imported from ../../lib/db.
// better-sqlite3 transactions are synchronous — no await needed.
const saveTeams = db.transaction((email: string, slugs: string[]) => {
  deleteUserTeams.run(email);
  for (const slug of slugs) {
    insertUserTeam.run(email, slug);
  }
});
saveTeams(result.email, validSlugs);
```

The `feature_request` insert block (lines 88–95) is preserved as-is. Remove the `setSelection` import; add `deleteUserTeams`, `insertUserTeam` imports from `../../lib/db`. Remove `TEAM_ID_RE` constant and `team_ids[]` fallback entirely (D-08 removes the transition scaffold).

---

### 4. `scripts/send-kickoff-notifications.mjs` — swap `usersQuery` join

**Analog:** `scripts/send-kickoff-notifications.mjs` — `usersQuery` (lines 91–105) and `matchesQuery` (lines 77–87).

**Current `usersQuery` to replace** (lines 91–105):
```javascript
const usersQuery = db.prepare(`
  SELECT DISTINCT v.email AS email, v.timezone AS timezone
  FROM vip_signups v
  JOIN teams t ON v.team = t.slug
  WHERE v.confirmed_at IS NOT NULL
    AND v.unsubscribed_at IS NULL
    AND v.team IS NOT NULL
    AND t.id IN (?, ?)
    AND NOT EXISTS (
      SELECT 1 FROM match_notifications n
      WHERE n.user_email = v.email
        AND n.match_id = ?
        AND n.channel = 'email'
    )
`);
```

**Adaptation for Phase 12 — new `usersQuery` (D-06):**
```javascript
const usersQuery = db.prepare(`
  SELECT DISTINCT v.email AS email, v.timezone AS timezone
  FROM vip_signups v
  JOIN user_teams ut ON ut.email = v.email
  JOIN teams t ON t.slug = ut.team_slug
  WHERE v.confirmed_at IS NOT NULL
    AND v.unsubscribed_at IS NULL
    AND t.id IN (?, ?)
    AND NOT EXISTS (
      SELECT 1 FROM match_notifications n
      WHERE n.user_email = v.email
        AND n.match_id = ?
        AND n.channel = 'email'
    )
`);
```

**Defensive `CREATE TABLE IF NOT EXISTS` block to extend** (lines 65–75):
Add `user_teams` alongside `match_notifications` in the defensive block at the top of the script, so the cron is self-contained even if run against a DB that hasn't been booted through the web server yet:
```javascript
db.exec(`
  CREATE TABLE IF NOT EXISTS match_notifications (
    ...
  );
  CREATE INDEX IF NOT EXISTS idx_notif_match ON match_notifications(match_id);
  CREATE TABLE IF NOT EXISTS user_teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    team_slug TEXT NOT NULL,
    UNIQUE(email, team_slug)
  );
  CREATE INDEX IF NOT EXISTS idx_user_teams_email ON user_teams(email);
`);
```

**Call site is unchanged** (line 180):
```javascript
const users = usersQuery.all(match.home_id, match.away_id, match.id);
```
Three positional params (`home_id`, `away_id`, `match.id`) match the new query's `t.id IN (?, ?)` + `match_id = ?` — no call-site change needed.

---

### 5. `src/lib/email.ts` — verify `sendMagicLink` copy handles single-team (D-07)

**Analog:** `src/lib/email.ts` — `sendMagicLink` function (lines 17–73).

**Value-prop line to verify** (line 33 in text body, line 46 in HTML body):
```typescript
// text:
`We'll email you 1 hour before every ${teamHuman} match in ${tzHuman}.`

// html:
`We'll email you 1 hour before every <strong>${teamHuman}</strong> match in ${tzHuman}.`
```

**Assessment:** Signup remains single-team (D-03). `sendMagicLink` receives one `team: string` slug at signup time — still valid. The confirmation email is still single-team. **No code change needed.** Planner should write a verify-only task (read the file, assert copy still reads correctly, close the task without edits).

If Phase 12 introduces any new outbound email that names a user's full followed set (not planned in D-08's MVP fence), the pattern to follow is `teamLabel(slug)` for each slug joined by `', '` — consistent with how `teamHuman` is built at line 24. No new email surfaces are in scope.

---

### 6. `scripts/smoke-manage.mjs` — extend with multi-team cases

**Analog:** `scripts/smoke-manage.mjs` — all existing M1–M9 cases (full file).

**`runCase` harness to copy verbatim** (lines 218–232):
```javascript
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

**`postForm` helper to reuse** (lines 193–210):
```javascript
async function postForm(path, form, headers = {}) {
  const body = new URLSearchParams(form);
  ...
  body,      // URLSearchParams serializes repeated keys correctly: team=a&team=b
  ...
}
```
`URLSearchParams` constructor accepts `Record<string, string>` — for multi-value `team` the cases must build the body manually as `URLSearchParams` with `.append('team', slug)` for each slug, or pass an array form. See note below.

**`dbInsertSmokeRow` to extend** (lines 131–151):
The existing function writes `vip_signups` only. Phase 12 cases need a parallel helper that inserts into `user_teams`:
```javascript
// New helper — mirrors dbInsertSmokeRow pattern but targets user_teams.
function dbInsertUserTeams(email, slugs = []) {
  dbWrite.prepare('DELETE FROM user_teams WHERE email = ?').run(email);
  const ins = dbWrite.prepare('INSERT OR IGNORE INTO user_teams (email, team_slug) VALUES (?, ?)');
  for (const slug of slugs) ins.run(email, slug);
}
```

**DB assertion pattern to copy** (lines 333–349 — `M3-save-valid` DB read):
```javascript
const row = dbRead
  .prepare('SELECT team, timezone FROM vip_signups WHERE email = ?')
  .get(email);
if (!row) { console.error(`  expected row for ${email}`); return false; }
if (row.team !== 'germany') { console.error(`  expected team=germany, got ${row.team}`); return false; }
```

**Adaptation — new cases to add (M10–M14):**

Evidence tags and what each case asserts:

| Case | Evidence tag | What it covers |
|---|---|---|
| M10 | `M10-multi-save-n` | POST N slugs (2–3) → 303 `status=saved`; `user_teams` rows match |
| M11 | `M11-pre-check` | GET `/manage` with session; HTML contains `checked` on each saved slug |
| M12 | `M12-too-many` | POST 6 slugs → 303 `status=too-many`; `user_teams` unchanged |
| M13 | `M13-empty-save` | POST 0 slugs → 303 `status=bad-team`; `user_teams` unchanged |
| M14 | `M14-cron-visibility` | DB: insert confirmed user + 2 teams in `user_teams`; assert `usersQuery`-equivalent SQL finds the user for a match involving one of those teams |

**`postForm` multi-value note:** `URLSearchParams(form)` from a plain object only serializes one value per key. For M10/M12/M13, construct the body manually:
```javascript
// Pattern for multi-value form POST (reuse fetch pattern from postForm).
const body = new URLSearchParams();
for (const slug of ['england', 'france', 'germany']) body.append('team', slug);
body.append('timezone', 'Europe/London');
const res = await fetch(`${BASE}/api/save-selection`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: BASE, Cookie: `...` },
  body,
  redirect: 'manual',
});
```

**Cleanup comment to update** (lines 38–40):
Add `user_teams` to the cleanup hint:
```
// sqlite3 data/oddlympics.db \
//   "DELETE FROM vip_signups WHERE email LIKE 'smoke-%@example.com'; \
//    DELETE FROM user_teams WHERE email LIKE 'smoke-%@example.com'"
```

---

## Shared Patterns

### `?error=` / `?status=` redirect convention
**Source:** `src/pages/api/save-selection.ts` lines 24–30 (`redirectTo`) + `src/pages/manage.astro` lines 78–87 (`STATUS_COPY`).
**Apply to:** `save-selection.ts` (new `too-many` redirect path) and `manage.astro` (new `too-many` STATUS_COPY entry).
```typescript
// save-selection.ts — redirect:
return redirectTo(formToken, 'too-many');

// manage.astro — STATUS_COPY:
'too-many': { kind: 'err', text: 'You can follow at most 5 teams. Uncheck some and save again.' },
```

### better-sqlite3 transaction pattern
**Source:** Not yet in codebase (this is the first transaction use). Per project conventions (CLAUDE.md), better-sqlite3 transactions are synchronous:
```typescript
const txn = db.transaction((email: string, slugs: string[]) => {
  deleteUserTeams.run(email);
  for (const slug of slugs) insertUserTeam.run(email, slug);
});
txn(result.email, validSlugs);
```
**Apply to:** `save-selection.ts` save block only.

### `VALID_TEAMS` allow-list validation
**Source:** `src/lib/teams.ts` line 10 (`VALID_TEAMS: ReadonlySet<string>`), imported in `save-selection.ts` line 5.
**Apply to:** `save-selection.ts` multi-slug loop — `VALID_TEAMS.has(slug)` per slug, same as current single-slug check.

### `CREATE TABLE IF NOT EXISTS` additive DDL
**Source:** `src/lib/db.ts` lines 122–153 (no ALTER, no DROP, purely additive `db.exec` blocks).
**Apply to:** `db.ts` new `user_teams` block; cron defensive block.

### Dry-run-by-default pattern
**Source:** `scripts/send-kickoff-notifications.mjs` lines 33, 196–200 (`ENABLED` flag + `releaseNotification` on dry-run).
**Apply to:** No new outbound scripts in Phase 12. Pattern is preserved as-is in the cron.

### No framework JS
**Source:** CLAUDE.md convention, implemented as `<script is:inline>` throughout `manage.astro`.
**Apply to:** The optional checkbox-cap nicety (D-05) — must be a single `<script is:inline>` block, degrade gracefully JS-off, no imports.

---

## No Analog Found

None — all Phase 12 files have direct analogs in the existing codebase.

---

## Metadata

**Analog search scope:** `src/lib/`, `src/pages/`, `src/pages/api/`, `scripts/`, `references/`
**Files scanned:** 8 (`db.ts`, `manage.astro`, `save-selection.ts`, `send-kickoff-notifications.mjs`, `email.ts`, `smoke-manage.mjs`, `teams.ts`, `teams.json`)
**Pattern extraction date:** 2026-05-15
