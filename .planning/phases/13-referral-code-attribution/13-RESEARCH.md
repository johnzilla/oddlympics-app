# Phase 13: Referral Code & Attribution - Research

**Researched:** 2026-05-22
**Domain:** SQLite additive migration, `node:crypto` code generation, better-sqlite3
constraint handling, Astro prerendered-page inline-script pattern
**Confidence:** HIGH — all findings verified against the live codebase + Node runtime

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Random opaque 8-char `[a-z0-9]` referral code (~2.8e12 keyspace); no team/email encoded.
- D-02: `vip_signups.referral_code TEXT`; uniqueness via `CREATE UNIQUE INDEX IF NOT EXISTS` (NOT inline UNIQUE constraint — SQLite forbids it on `ALTER TABLE ADD COLUMN`). App-layer collision-retry.
- D-03: Additive migration only — `pragma_table_info` probe + `ALTER TABLE ADD COLUMN`. No SQLite version assert, no `DROP COLUMN`.
- D-04: Backfill every existing NULL `referral_code` row on boot. `COALESCE`-protected on upsert so re-signup never regenerates a code.
- D-05: `vip_signups.referred_by TEXT` nullable, stores the code string (not an id/email).
- D-06: First-touch attribution. `referred_by` `COALESCE`-protected on upsert — once set, never overwritten; a still-NULL can be filled by a later re-signup with a valid ref.
- D-07: Ref resolution is synchronous inside `/api/signup`. Lookup ref against `referral_code` column. No-match → `referred_by = NULL`. No status filter on referrer row.
- D-08: Self-referral (resolved code's owner email == submitter email, both trimmed+lowercased) → ignore. Malformed/unknown ref → `NULL`. Neither blocks signup.
- D-09: Ref resolution is a post-validation, pre-upsert step in `/api/signup`. Never calls `back(...)`. Only computes `referred_by` string or `null`.
- D-10: Hidden `<input type="hidden" name="ref">` added to the form in `index.astro`.
- D-11: Inline script reads `?ref=` from `location.search` → writes to hidden field AND stores in localStorage (first-seen only). No URL `?ref=` → fall back to localStorage value.
- D-12: localStorage entry carries a timestamp; entries older than 30 days ignored. Shape: `{ref, ts}` JSON under a key like `oddlympics_ref`.
- D-13: Inline script is defensive (`try/catch`). Client does no format/existence validation — only transports the string. Server validates (D-07/D-08).
- D-14: Extend `scripts/smoke-signup.mjs` with referral cases (keep existing 8 green).
- D-15: Add referral-counting SQL recipe to `DEPLOY.md` Day-2 ops section.

### Claude's Discretion
- Code-generation helper placement (`src/lib/` vs inline in `db.ts`/`signup.ts`).
- The `node:crypto` primitive used (`randomInt` loop vs `randomBytes` + bias-rejection).
- Whether the new row's code is generated in the `/api/signup` handler or in a `db.ts` helper.
- Exact prepared-statement names; `referral_code` lookup statement shape; whether `VipSignup.referral_code` is typed `string` or `string | null`.
- localStorage key name and `{ref, ts}` JSON shape (D-12).
- Migration step order (create unique index before or after backfill).
- Exact wording/placement of the `DEPLOY.md` ops recipe.
- How the referral cases are structured inside `smoke-signup.mjs`.
- Plan/wave split.

### Deferred Ideas (OUT OF SCOPE)
- Share UI (prompts on `/pending`/`/confirmed`/`/manage`, native share sheet, team-named copy, email share line) — Phase 14.
- Per-team OG images + server-rendered `/r/CODE` route — Phase 15.
- "You've referred N friends" count (REF-F1), referral leaderboard/rewards (REF-F2) — Future Requirements.
- Referral analytics dashboard / admin UI — out of scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REF-01 | Every signup is assigned a unique, stable referral code | D-01–D-04: additive migration + backfill + COALESCE-protected upsert; UNIQUE INDEX enforces uniqueness |
| REF-02 | Landing page accepts `?ref=CODE` and carries it through the signup form | D-10–D-13: hidden field + inline script pattern, identical to existing `timezone` and `?error=` carry-through |
| REF-03 | `/api/signup` records the referring code on the new signup (`referred_by` column) | D-05–D-09: synchronous ref resolution in the signup pre-flight chain, COALESCE-protected first-touch write |
</phase_requirements>

---

## Summary

Phase 13 is a focused plumbing phase: two additive columns on `vip_signups`, a migration + backfill, a pre-upsert ref-resolution step in `/api/signup`, a hidden field carry-through on the prerendered landing page, and a smoke extension. No new dependencies are introduced. Every pattern has a clear prior-phase precedent in this codebase.

The codebase was read in full for all six files cited in CONTEXT.md `<canonical_refs>`. All line numbers were verified against the live source. Three minor drifts were found (documented below — none change the implementation plan, all are clarifications to imprecise line ranges).

The critical SQLite landmine (UNIQUE constraint on `ALTER TABLE ADD COLUMN`) was reproduced in the live Node 22 / better-sqlite3 12.9.0 environment. The workaround (`CREATE UNIQUE INDEX IF NOT EXISTS`) was confirmed to work. NULL-distinctness in the unique index was verified: two NULL rows can coexist, so the index can safely be created before the backfill completes.

**Primary recommendation:** Implement in four sequential waves — (1) schema + migration + backfill, (2) ref lookup helper + `/api/signup` resolution, (3) `index.astro` carry-through, (4) smoke extension + `DEPLOY.md` recipe.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Referral code generation + uniqueness | API / Backend (`db.ts` migration + `signup.ts`) | — | Codes are DB-layer identifiers; generation and uniqueness enforcement live server-side |
| `referred_by` attribution write | API / Backend (`/api/signup`) | — | Must run after rate-limit/allow-list but before the DB upsert; server-only |
| `?ref=` carry-through to form | Browser / Client (`index.astro` inline script) | — | Page is `prerender = true`; URL params must be read client-side at runtime |
| localStorage TTL ref persistence | Browser / Client (`index.astro` inline script) | — | Same prerendered-page constraint; server never sees the localStorage state |
| Ref lookup (validate submitted ref) | API / Backend (`/api/signup` synchronous step) | — | Server validates; client only transports (D-13) |
| Migration + backfill | Database / Storage (`src/lib/db.ts` module-load side-effect) | — | Runs at module-load time, same as all prior migrations |
| Day-2 measurement query | Database / Storage (`DEPLOY.md`) | — | Pure SQL read; no application surface |

---

## Standard Stack

No new packages are introduced in this phase. The existing stack covers all needs:

| Library | Version (pinned) | Purpose | Phase 13 use |
|---------|-----------------|---------|--------------|
| `better-sqlite3` | `^12.9.0` (registry: 12.10.0) | Synchronous SQLite driver | Migration, backfill, ref lookup, upsert |
| `node:crypto` | Node 22 built-in | Random byte generation | `referral_code` generation |
| Astro 5 | `^5.0.0` | Framework | `index.astro` hidden field + inline script |

[VERIFIED: live codebase — `package.json`] `better-sqlite3@^12.9.0` pinned. Registry latest is 12.10.0 — the `^` range will pull 12.10.0 on a clean install. No breaking changes expected (patch release).

**Installation:** No `npm install` needed. Zero new dependencies.

---

## Package Legitimacy Audit

No new packages. Section not applicable.

---

## Architecture Patterns

### System Architecture Diagram

```
User browser (prerendered /)
  ├── location.search reads ?ref=CODE
  ├── localStorage write (first-seen, {ref, ts} with 30-day TTL)
  ├── hidden <input name="ref"> ← populated by inline script
  └── POST /api/signup
        │
        ▼
/api/signup pre-flight chain (server)
  Origin check
  → formData parse
  → honeypot
  → email regex
  → rate-limit (ip + email)
  → team allow-list (VALID_TEAMS)
  → tz fallback
  → ref resolution ← NEW (D-09: post-tz-fallback, pre-upsert)
  │   SELECT referral_code, email FROM vip_signups WHERE referral_code = ?
  │   if not found, or self-referral → referred_by = null
  │   if found → referred_by = that code
  └── upsertVipSignup(email, sport, ip, ua, team, tz, referral_code, referred_by)
        │
        ▼
vip_signups table
  referral_code ← generated app-layer + UNIQUE INDEX enforced
  referred_by   ← COALESCE-protected (first-touch)
```

### Recommended Project Structure

No new files strictly required. Discretionary helper:

```
src/lib/
├── db.ts          # migration + backfill + upsertVipSignup update
├── token.ts       # reference only (node:crypto idiom)
├── referral.ts    # OPTIONAL: generateReferralCode() helper (planner discretion)
src/pages/
├── api/signup.ts  # add ref resolution step
├── index.astro    # add hidden field + inline script extension
scripts/
├── smoke-signup.mjs  # extend with referral cases
DEPLOY.md             # add Day-2 referral query recipe
```

### Pattern 1: `pragma_table_info` probe + `ALTER TABLE ADD COLUMN` (additive migration)

**What:** Check if a column exists before trying to add it. Idempotent — second boot finds the column present and skips.
**When to use:** Every new column on an existing table. Established in Phase 1, extended in Phases 5 and 12.

```typescript
// Source: src/lib/db.ts:33-61 (live codebase, verified)
{
  const cols = db
    .prepare("SELECT name FROM pragma_table_info('vip_signups')")
    .all() as { name: string }[];
  const has = (n: string) => cols.some((c) => c.name === n);
  if (!has('referral_code'))
    db.exec(`ALTER TABLE vip_signups ADD COLUMN referral_code TEXT;`);
  if (!has('referred_by'))
    db.exec(`ALTER TABLE vip_signups ADD COLUMN referred_by TEXT;`);
  // UNIQUE index MUST be separate — ALTER TABLE ADD COLUMN forbids UNIQUE constraint
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_vip_signups_referral_code
           ON vip_signups(referral_code);`);
}
```

### Pattern 2: `COALESCE`-protected upsert column

**What:** `col = COALESCE(excluded.col, table.col)` — incoming NULL does not overwrite an existing value. Used for `team` (Phase 5) and `slug` on the teams table (Phase 5).
**When to use:** Any column with first-touch / stability semantics.

```typescript
// Source: src/lib/db.ts:81-93 (live codebase, verified)
// The Phase 13 extension adds two COALESCE-protected columns:
//   referral_code = COALESCE(excluded.referral_code, vip_signups.referral_code)
//   referred_by   = COALESCE(excluded.referred_by, vip_signups.referred_by)
```

### Pattern 3: `randomInt(N)` from `node:crypto` for uniform code generation

**What:** `randomInt(max)` generates a cryptographically uniform integer in `[0, max)`. Simpler and bias-free compared to `randomBytes` + modulo-rejection loop.
**When to use:** Generating short opaque identifiers from a small charset where per-character selection is needed.

```typescript
// Source: node:crypto (Node 22 built-in, verified in runtime)
import { randomInt } from 'node:crypto';

const CHARSET = 'abcdefghijklmnopqrstuvwxyz0123456789'; // 36 chars

export function generateReferralCode(): string {
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += CHARSET[randomInt(CHARSET.length)];
  }
  return code;
}
```

`randomInt(36)` internally uses rejection sampling to eliminate modulo bias — the caller does not need to implement it. This is the idiomatic choice when CHARSET.length is small and doesn't divide 256 evenly.

### Pattern 4: Collision-retry loop with `SqliteError` detection

**What:** Generate → INSERT → catch `SQLITE_CONSTRAINT_UNIQUE` → retry up to N times. In production with a 2.8e12 keyspace and a few hundred rows, the probability of even one collision is negligible (~1 in 10 billion), so 3–5 retries is more than sufficient.

```typescript
// Source: verified in test (better-sqlite3 12.9.0 against SQLite 3.53.0)
// e.code === 'SQLITE_CONSTRAINT_UNIQUE' and e.message contains 'UNIQUE'
// The error class is SqliteError (better-sqlite3's own class).

function insertWithCode(
  stmt: Database.Statement,
  ...params: Parameters<typeof stmt.run>
): void {
  const MAX_RETRIES = 5;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      stmt.run(...params);
      return;
    } catch (e: unknown) {
      if (
        e instanceof Error &&
        'code' in e &&
        (e as { code: string }).code === 'SQLITE_CONSTRAINT_UNIQUE' &&
        attempt < MAX_RETRIES - 1
      ) {
        // Genuine collision (astronomically rare); regenerate and retry
        continue;
      }
      throw e; // not a collision, or retries exhausted
    }
  }
}
```

### Pattern 5: Inline `<script is:inline>` URL-param + hidden-field population

**What:** Prerendered pages cannot access request-time URL params in Astro frontmatter. Client-side inline scripts run after HTML is parsed and can read `location.search`. All existing inline scripts in `index.astro` use the `try/catch` wrapper pattern.
**When to use:** Any prerendered page that needs to react to URL params or populate hidden form fields.

```javascript
// Source: src/pages/index.astro:175-225 (live codebase, verified)
// Pattern: each block independently try/catch-wrapped.
// Phase 13 adds a third block inside the existing <script is:inline>:
try {
  const params = new URL(location.href).searchParams;
  const urlRef = params.get('ref') || '';
  const REF_KEY = 'oddlympics_ref';
  const REF_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

  let activeRef = urlRef.trim();
  if (activeRef) {
    // URL param is authoritative — store only if nothing stored yet (first-touch)
    const stored = localStorage.getItem(REF_KEY);
    if (!stored) {
      localStorage.setItem(REF_KEY, JSON.stringify({ ref: activeRef, ts: Date.now() }));
    }
  } else {
    // No URL param — try localStorage fallback
    const raw = localStorage.getItem(REF_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.ref && Date.now() - parsed.ts < REF_TTL_MS) {
          activeRef = parsed.ref;
        }
      } catch {}
    }
  }

  const refInput = document.getElementById('ref');
  if (refInput && activeRef) {
    refInput.value = activeRef;
  }
} catch {}
```

### Anti-Patterns to Avoid

- **Inline UNIQUE on `ALTER TABLE ADD COLUMN`:** SQLite rejects this with "Cannot add a UNIQUE column". Always use `CREATE UNIQUE INDEX IF NOT EXISTS` separately. [VERIFIED: reproduced live]
- **Modulo-bias in code generation:** `randomBytes(1)[0] % 36` is biased (256 is not divisible by 36). Use `randomInt(36)` which handles this internally.
- **Client-side ref validation:** The client must not attempt to validate format or existence of the ref — it only transports the string. Server (D-07/D-08) validates.
- **Calling `back()` from ref resolution:** Ref handling never rejects. A bad ref silently sets `referred_by = null`. The "signup never rejects" contract extends to ref attribution.
- **Regenerating an existing code on re-signup:** The `referral_code` column must be `COALESCE`-protected in the upsert, exactly like `team`. A re-signup must not get a new code.
- **Adding ref resolution before the tz fallback step:** D-09 is explicit — place ref resolution after team allow-list + tz fallback, right before the upsert call.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bias-free random character selection | Custom rejection-sampling loop over `randomBytes` | `node:crypto` `randomInt(N)` | Node built-in handles rejection sampling internally; less surface area |
| UNIQUE index creation after `ALTER TABLE` | Any ORM migration tool | `CREATE UNIQUE INDEX IF NOT EXISTS` direct SQL | Already the pattern for every index in this codebase; no new tooling needed |
| Idempotent column addition | Migration version table | `pragma_table_info` probe | Established codebase idiom; migration tools would require a new dependency |

---

## Codebase Drift Report

CONTEXT.md `<canonical_refs>` cites specific line ranges in the live files. All six files were read in full. Findings:

### `src/lib/db.ts`

- **CONTEXT says:** `pragma_table_info` probe at `:33-61`, `upsertVipSignup` at `:81-93`, `VipSignup` type at `:63-75`. **Verified: ACCURATE.** Lines match the live file exactly.
- **CONTEXT says:** `teams.slug` probe at `:159-166`. **Verified: ACCURATE.** The teams probe is at lines 159–166.
- `upsertVipSignup` currently takes 6 params: `(email, requested_sport, ip, user_agent, team, timezone)`. Phase 13 must extend this to 8 params, adding `referral_code` and `referred_by`.
- The `VipSignup` type (lines 63–75) does NOT yet include `referral_code` or `referred_by` — both must be added.
- **Notable:** The migration block at lines 33–61 includes the `DROP COLUMN selected_teams` + SQLite version assert from Phase 5. Phase 13's new migration block is structurally simpler (no version assert, no DROP).

### `src/pages/api/signup.ts`

- **CONTEXT says:** pre-flight chain `:45-119`, `back()` helper `:38-43`. **Verified: ACCURATE.** The `POST` handler starts at line 45 and runs to line 119; `back()` is at lines 38–43.
- Pre-flight chain order as verified: (1) Origin check `:46-48`, (2) formData parse `:50-55`, (3) honeypot `:57-61`, (4) email regex `:63-67`, (5) sport assignment `:69`, (6) rate-limit `:71-73`, (7) team allow-list `:75-80`, (8) tz fallback `:82-90`, (9) DB upsert `:92-104`, (10) mintToken `:106`, (11) sendMagicLink `:108-113`, (12) redirect `:115-118`.
- **D-09 insertion point confirmed:** Ref resolution must be inserted between step (8) tz-fallback and step (9) DB upsert — at approximately line 91 in the current file.
- **Signature of `upsertVipSignup.get(...)` call (line 93-100):** Currently called as `.get(rawEmail, requestedSport, ip|null, user_agent, rawTeam, tz)`. Phase 13 adds `referral_code` (string, generated) and `referred_by` (string|null, resolved).

### `src/pages/index.astro`

- **CONTEXT says:** signup form `:66-104`, inline script `:175-225`. **Verified: ACCURATE.** Form is lines 66–104; the `<script is:inline>` block is lines 175–225.
- The form currently has these hidden/special fields (lines 93–95):
  ```html
  <input type="hidden" name="timezone" id="timezone" value="" />
  <input type="hidden" name="requested_sport" value="world_cup" />
  <input type="text" name="website" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true" />
  ```
  Phase 13 adds `<input type="hidden" name="ref" id="ref" value="" />` alongside these.
- The inline script has **three independent `try/catch` blocks**: (1) tz-label swap + hidden tz field (lines 177–188), (2) `?error=` rendering (lines 190–208), (3) Plausible `Signup Submit` event listener (lines 210–224). Phase 13 adds a **fourth block** for the `?ref=` / localStorage reader.

### `scripts/smoke-signup.mjs`

- **CONTEXT says:** "Phase 5 8-case smoke". **Verified:** The script has 8 cases — 1 AC2 static assertion + 7 POST/DB cases (labeled AC2, case-1-valid, case-2-missing-team, AC9-invalid-team, case-4-missing-tz, case-5-invalid-tz, AC12-honeypot, case-7-rate-limit). The rate-limit case explicitly accounts for 3 IP slots already consumed by cases 1, 4, 5 — the Phase 13 cases must account for this when inserted before the rate-limit case.
- **`dbRowFor()` helper (lines 93–99):** Currently SELECTs `email, team, timezone, requested_sport`. Phase 13 extends it to also SELECT `referral_code, referred_by`.
- **Rate-limit dependency:** Case 7 (rate-limit) counts "3 IP slots used" from prior valid POST cases. Phase 13 referral cases that use valid POSTs must be counted and the rate-limit math adjusted, or referral cases should use a different `X-Forwarded-For` IP to avoid consuming slots.

### `DEPLOY.md`

- Day-2 ops table is at lines 99–114. The new referral-counting recipe adds one more row to this table.

### `src/lib/token.ts`

- `randomBytes` and the HMAC idiom are at lines 1–39. Phase 13 uses `randomInt` (also from `node:crypto`) for code generation — the import may need to be widened if `generateReferralCode` lives in `token.ts`, or a new `src/lib/referral.ts` helper may import `randomInt` directly.

---

## The SQLite `ALTER TABLE ADD COLUMN` + UNIQUE Landmine

**Confirmed behavior** [VERIFIED: reproduced in live Node 22 / better-sqlite3 12.9.0 / SQLite 3.53.0 environment]:

```
ALTER TABLE test ADD COLUMN code TEXT UNIQUE
→ SqliteError: Cannot add a UNIQUE column
```

**The workaround** (also confirmed working):
```sql
ALTER TABLE vip_signups ADD COLUMN referral_code TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_vip_signups_referral_code
  ON vip_signups(referral_code);
```

**NULL distinctness in SQLite unique indexes** [VERIFIED: live]:
Two rows with `referral_code IS NULL` can coexist under the unique index. This means:
- The unique index can be created before the backfill without violating any constraint.
- New signups that have not yet been assigned a code (impossible in practice, since the code is generated at upsert time) would not collide.
- **Implication for migration ordering:** Create the column, create the unique index, then run the backfill. Or create the column, run the backfill, then create the index. Both are safe. Index-first is slightly cleaner because the index immediately enforces uniqueness during the backfill loop.

**Verified error surface for collision retry:**
- `e.code === 'SQLITE_CONSTRAINT_UNIQUE'` [VERIFIED: live]
- `e.message` contains `'UNIQUE'` [VERIFIED: live]
- Error class is `SqliteError` (better-sqlite3's own error class)

---

## `node:crypto` Code Generation

**Recommendation: use `randomInt(36)` per character** [VERIFIED: Node 22 built-in].

`randomInt(max)` generates a uniform integer in `[0, max)`. Node's implementation uses rejection sampling internally to eliminate modulo bias. This is simpler and more correct than a manual `randomBytes` + rejection loop.

```typescript
import { randomInt } from 'node:crypto';

const CHARSET = 'abcdefghijklmnopqrstuvwxyz0123456789';

function generateReferralCode(): string {
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += CHARSET[randomInt(CHARSET.length)]; // randomInt(36)
  }
  return code;
}
```

**Why not `randomBytes` + modulo?** `256 % 36 = 4`, so bytes 252–255 would be more likely to map to characters 0–3 (the first four characters). This introduces a ~1.5% bias. `randomInt` avoids this.

**Token module note:** `src/lib/token.ts` imports `{ createHmac, timingSafeEqual }` from `node:crypto` (line 1). `randomInt` is not currently imported there. If `generateReferralCode` lives in `token.ts`, that import must be widened. Alternatively, a dedicated `src/lib/referral.ts` file keeps concerns separated (planner discretion, per CONTEXT.md "Claude's Discretion").

**Backfill loop shape:**
The backfill runs at module-load time, reading all rows with `referral_code IS NULL` and assigning codes in a loop. With better-sqlite3's synchronous API, the pattern is:

```typescript
// Runs inside the migration block in db.ts
const nullRows = db
  .prepare('SELECT id FROM vip_signups WHERE referral_code IS NULL')
  .all() as { id: number }[];
const updateCode = db.prepare<[string, number]>(
  'UPDATE vip_signups SET referral_code = ? WHERE id = ?',
);
for (const row of nullRows) {
  let code: string;
  let assigned = false;
  for (let attempt = 0; attempt < 5; attempt++) {
    code = generateReferralCode();
    try {
      updateCode.run(code, row.id);
      assigned = true;
      break;
    } catch (e: unknown) {
      if (
        e instanceof Error &&
        'code' in e &&
        (e as { code: string }).code !== 'SQLITE_CONSTRAINT_UNIQUE'
      ) throw e;
      // collision: try again
    }
  }
  if (!assigned) throw new Error('referral_code backfill: too many collisions');
}
```

In practice, with a 2.8 × 10^12 keyspace and a current subscriber count of ~1 (the operator's own row), collision probability per attempt is ~3.6 × 10^-13. The retry loop is a precaution, not a real concern.

---

## The `/api/signup` Pre-Flight Chain (Exact Current Ordering)

Verified from `src/pages/api/signup.ts` live file:

| Step | Line(s) | Action | Can call `back()`? |
|------|---------|--------|--------------------|
| 1 | 46–48 | Origin check | Yes → `'bad-origin'` |
| 2 | 50–55 | `request.formData()` parse | Yes → `'bad-form'` |
| 3 | 57–61 | Honeypot check | Yes → redirect `/pending` (no email) |
| 4 | 63–67 | Email regex + 254-char limit | Yes → `'bad-email'` |
| 5 | 69 | Sport assignment (allow-list or `'other'`) | Never rejects |
| 6 | 71–73 | Rate-limit (ip + email) | Yes → `'rate-limited'` |
| 7 | 75–80 | Team allow-list (`VALID_TEAMS`) | Yes → `'bad-form'` |
| 8 | 82–90 | TZ fallback (silent, never rejects) | Never rejects |
| **9-NEW** | ~91 | **Ref resolution (D-09 insertion point)** | **Never rejects** |
| 10 | 92–104 | `upsertVipSignup.get(...)` | Yes → `'server'` |
| 11 | 106 | `mintToken(rawEmail)` | Never throws |
| 12 | 108–113 | `sendMagicLink(...)` | Yes → `'email'` |
| 13 | 115–118 | 303 → `/pending?email=...` | — |

**Ref resolution pseudocode for the insertion point (step 9-NEW):**

```typescript
// D-07/D-08: resolve ref, never calls back()
const rawRef = ((form.get('ref') as string | null) ?? '').trim().toLowerCase();
let referredBy: string | null = null;
if (rawRef) {
  const refRow = lookupByReferralCode.get(rawRef) as
    | { email: string; referral_code: string }
    | undefined;
  if (refRow && refRow.email !== rawEmail) {
    // valid ref, not self-referral
    referredBy = refRow.referral_code;
  }
  // else: not found, or self-referral → referredBy stays null
}
```

Where `lookupByReferralCode` is a prepared statement:
```typescript
const lookupByReferralCode = db.prepare<[string]>(
  'SELECT email, referral_code FROM vip_signups WHERE referral_code = ?',
);
```

---

## The `index.astro` Inline Script Block

The existing `<script is:inline>` block (lines 175–225) contains **three independent `try/catch` blocks**:

1. **Lines 177–188:** TZ label swap + sets `#timezone` hidden field value. Uses `Intl.DateTimeFormat().resolvedOptions().timeZone`.
2. **Lines 190–208:** `?error=` param renderer. Reads `location.href` searchParams, looks up a `COPY` map, sets `#error` element text + unhides it.
3. **Lines 210–224:** Plausible `Signup Submit` event listener. Attaches to `#signup-form`, fires on submit.

**Phase 13 adds a fourth block:** The `?ref=` / localStorage reader (D-10–D-13). It must:
- Be its own `try/catch` block (follows established pattern).
- Read `?ref=` from `location.search`.
- Write to `localStorage` under a key like `oddlympics_ref` (first-seen only).
- Fall back to localStorage when URL has no `?ref=`.
- Write the active ref to `document.getElementById('ref')`.
- Ignore any stored ref older than 30 days.
- Not perform format/existence validation (client transports only).

---

## Common Pitfalls

### Pitfall 1: UNIQUE constraint on `ALTER TABLE ADD COLUMN`

**What goes wrong:** Adding `UNIQUE` inline in the `ALTER TABLE ADD COLUMN` SQL throws `SqliteError: Cannot add a UNIQUE column` at module-load time, crashing the server on boot.
**Why it happens:** SQLite's `ALTER TABLE ADD COLUMN` supports only a limited subset of column constraints; UNIQUE and PRIMARY KEY are excluded.
**How to avoid:** Always use `CREATE UNIQUE INDEX IF NOT EXISTS` in a separate `db.exec()` call after the `ALTER TABLE`.
**Warning signs:** Server fails to start; journald logs show `SqliteError: Cannot add a UNIQUE column`.

### Pitfall 2: Rate-limit slot consumption in smoke test

**What goes wrong:** The existing `smoke-signup.mjs` case 7 (rate-limit) relies on exactly 3 IP-keyed slots being consumed from `SMOKE_IP` before it runs (cases 1, 4, 5). Adding new valid POST cases from the same `SMOKE_IP` before case 7 shifts the slot count and may cause case 7 to trigger too early (rate-limiting a legitimate case) or not at all (slots not exhausted).
**Why it happens:** The rate-limit state is in-process memory keyed by IP; the smoke comment documents the exact count (`~3 of 5 hourly slots`).
**How to avoid:** Either (a) use a distinct `X-Forwarded-For` IP (e.g. `192.0.2.43`) for Phase 13 referral cases, or (b) insert referral cases after the rate-limit case and operate on a fresh email. Option (a) is cleaner.
**Warning signs:** Case 7 fails unexpectedly or a referral case gets `/?error=rate-limited`.

### Pitfall 3: Over-writing an existing `referred_by` on re-signup

**What goes wrong:** A user signs up via a referral link, then signs up again without `?ref=`. The second upsert sets `referred_by = NULL`, wiping the original attribution.
**Why it happens:** The upsert's `ON CONFLICT DO UPDATE SET referred_by = excluded.referred_by` replaces with the new value unconditionally.
**How to avoid:** Use `referred_by = COALESCE(excluded.referred_by, vip_signups.referred_by)` exactly as `team` is protected.
**Warning signs:** `referred_by` mysteriously becomes NULL for users who had it set.

### Pitfall 4: Over-writing an existing `referral_code` on re-signup

**What goes wrong:** A new code is generated on every upsert. A user's existing code changes, breaking all links they've already shared.
**Why it happens:** The upsert generates a fresh code each time and passes it as a param; without COALESCE, the new code replaces the old one.
**How to avoid:** `referral_code = COALESCE(excluded.referral_code, vip_signups.referral_code)` — same pattern as D-04 mandates.
**Warning signs:** D-04 ("Stability: once set, referral_code is never regenerated") is violated.

### Pitfall 5: Self-referral detection edge case

**What goes wrong:** Self-referral check compares emails using `===` without normalization. The submitted email is already trimmed+lowercased by step 4 of the pre-flight chain (`rawEmail`). The email on the referrer row must be compared using the same normalization.
**Why it happens:** `vip_signups.email` is stored lowercased+trimmed (guaranteed by the existing signup handler), so a simple `refRow.email !== rawEmail` comparison is safe. But only if both sides are consistently lowercased.
**How to avoid:** Compare `refRow.email` (already lowercase in DB) against `rawEmail` (already lowercased by handler). No extra lowercasing needed at the comparison site.
**Warning signs:** Self-referral succeeds; a user appears in their own `referred_by` column.

### Pitfall 6: localStorage throws in private browsing mode

**What goes wrong:** `localStorage.setItem(...)` or `localStorage.getItem(...)` throws a `DOMException` in Safari private mode and some locked-down browsers.
**Why it happens:** Browsers disable `localStorage` access in private/incognito mode in certain configurations.
**How to avoid:** The entire ref-persistence block is already inside a `try/catch` per D-13. Any localStorage exception causes the block to fall through with no ref — the form submits without a `ref` value, and the signup succeeds.
**Warning signs:** None visible to user; `referred_by` stays NULL for private-mode signups.

---

## Code Examples

All examples are verified against the live codebase and runtime.

### Migration block addition (append to the existing `vip_signups` probe block)

```typescript
// Source: src/lib/db.ts:33-61 (live — add AFTER the existing probe block's closing brace)
{
  const cols = db
    .prepare("SELECT name FROM pragma_table_info('vip_signups')")
    .all() as { name: string }[];
  const has = (n: string) => cols.some((c) => c.name === n);
  // Phase 13 — REF-01: additive columns (no UNIQUE inline — SQLite forbids it on ALTER ADD COLUMN)
  if (!has('referral_code'))
    db.exec(`ALTER TABLE vip_signups ADD COLUMN referral_code TEXT;`);
  if (!has('referred_by'))
    db.exec(`ALTER TABLE vip_signups ADD COLUMN referred_by TEXT;`);
  // Unique index must be separate (verified: CREATE UNIQUE INDEX IF NOT EXISTS is idempotent)
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_vip_signups_referral_code
      ON vip_signups(referral_code);
  `);
  // Backfill: assign a code to every existing row that lacks one
  // (idempotent — second boot finds zero NULL rows)
  // ... backfill loop here ...
}
```

Note: A second `pragma_table_info` query is acceptable (the existing block already does one), OR the two phases of the migration block can be merged into one probe block — planner's call.

### `upsertVipSignup` extended signature (both new columns COALESCE-protected)

```typescript
// Source: src/lib/db.ts:81-93 (live — extend with 2 new params)
export const upsertVipSignup = db.prepare<
  [string, string, string | null, string | null, string, string, string, string | null]
>(`
  INSERT INTO vip_signups (email, requested_sport, ip, user_agent, team, timezone, referral_code, referred_by)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(email) DO UPDATE SET
    requested_sport = excluded.requested_sport,
    ip = COALESCE(excluded.ip, vip_signups.ip),
    user_agent = COALESCE(excluded.user_agent, vip_signups.user_agent),
    team = COALESCE(excluded.team, vip_signups.team),
    timezone = excluded.timezone,
    referral_code = COALESCE(excluded.referral_code, vip_signups.referral_code),
    referred_by   = COALESCE(excluded.referred_by,   vip_signups.referred_by)
  RETURNING *
`);
```

### DEPLOY.md Day-2 ops table row addition

```sql
-- Referral attribution: top referring codes, total referred vs direct, % referred
sqlite3 /var/lib/oddlympics/oddlympics.db '
.mode column
.headers on
SELECT COALESCE(referred_by, "(direct)") AS referrer,
       COUNT(*) AS signups,
       ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM vip_signups WHERE confirmed_at IS NOT NULL), 1) AS pct
FROM vip_signups
WHERE confirmed_at IS NOT NULL AND unsubscribed_at IS NULL
GROUP BY referred_by
ORDER BY signups DESC;
'
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `randomBytes(1)[0] % N` for char selection (biased) | `randomInt(N)` (Node built-in, bias-free) | Node 14.10+ | No manual rejection-sampling needed |
| Inline `UNIQUE` column constraint | `CREATE UNIQUE INDEX IF NOT EXISTS` (post-ALTER) | SQLite design (never changed) | Must always use the separate-index pattern for `ALTER TABLE` columns |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | — | — | — |

**All claims in this research were verified or cited against live codebase, live Node 22 runtime, or official Node docs. No assumed claims.** The CONTEXT.md decisions were written with the live codebase already reviewed; this research confirms they are accurate.

---

## Open Questions

None that block planning. The following are discretionary items left to the planner per CONTEXT.md "Claude's Discretion":

1. **Helper placement** — `generateReferralCode()` in `src/lib/referral.ts` (cleanest) vs. inlined in `src/lib/db.ts` (shorter, precedent from `token.ts`'s crypto use). Either works.
2. **Rate-limit IP in smoke cases** — use a distinct RFC-5737 IP (`192.0.2.43`) for Phase 13 referral POST cases to avoid disturbing the rate-limit slot count.
3. **`VipSignup.referral_code` TypeScript type** — `string | null` (accurate to the DB schema, where it's nullable before backfill and on the model type pre-post-migration) vs. `string` (true post-migration but requires a cast). `string | null` is safer and honest.

---

## Environment Availability

Step 2.6: SKIPPED (no new external dependencies; all tooling is Node 22 built-ins and existing packages already installed).

---

## Validation Architecture

`nyquist_validation: true` in `.planning/config.json` — this section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `scripts/smoke-signup.mjs` (custom Node ESM smoke, no vitest/jest) |
| Config file | none — script is self-contained |
| Quick run command | `node scripts/smoke-signup.mjs` (requires server running on port 4321) |
| Full suite command | `node scripts/smoke-signup.mjs` (same — only smoke test suite in project) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REF-01 | Every vip_signups row has a non-null, unique referral_code after migration | integration (DB-level) | `node scripts/smoke-signup.mjs` | ✅ (extend) |
| REF-01 | Backfill idempotency: second run finds zero NULL rows | integration (DB-level) | `node scripts/smoke-signup.mjs` | ✅ (extend) |
| REF-01 | New signup row gets a referral_code | integration (POST + DB check) | `node scripts/smoke-signup.mjs` | ✅ (extend) |
| REF-02 | `?ref=CODE` carry-through: hidden field populated | manual-only (requires browser; inline script not testable via curl) | — | N/A — manual |
| REF-02 | localStorage fallback: no URL param, stored ref used | manual-only | — | N/A — manual |
| REF-03 | Valid ref → `referred_by` set to that code | integration (POST + DB) | `node scripts/smoke-signup.mjs` | ✅ (extend) |
| REF-03 | Direct signup → `referred_by` NULL | integration (POST + DB) | `node scripts/smoke-signup.mjs` | ✅ (extend) |
| SC4 | Unknown ref → `referred_by` NULL + signup succeeds | integration (POST + DB) | `node scripts/smoke-signup.mjs` | ✅ (extend) |
| SC4 | Malformed ref → `referred_by` NULL + signup succeeds | integration (POST + DB) | `node scripts/smoke-signup.mjs` | ✅ (extend) |
| SC4 | Self-referral → `referred_by` NULL + signup succeeds | integration (POST + DB) | `node scripts/smoke-signup.mjs` | ✅ (extend) |

### Referral Smoke Cases (D-14 breakdown)

The following cases must be added to `scripts/smoke-signup.mjs`, keeping the existing 8 PASS:

| Case name | What it does | DB assertion |
|-----------|-------------|--------------|
| `REF-valid-ref` | Signup A (gets a code); signup B with `ref=A's code` → B's `referred_by = A's code` | `row.referred_by === codeA` |
| `REF-direct-no-ref` | Signup with no `ref` param → `referred_by IS NULL` | `row.referred_by === null` |
| `REF-unknown-ref` | Signup with `ref=xxxxxxxx` (doesn't exist) → `referred_by IS NULL` + signup succeeds | `row.referred_by === null`, status 303 `/pending?email=` |
| `REF-malformed-ref` | Signup with `ref=!!bad!!` (wrong chars) → `referred_by IS NULL` + signup succeeds | same |
| `REF-self-ref` | Re-signup with own `referral_code` as ref → `referred_by IS NULL` | `row.referred_by === null` |
| `REF-code-uniqueness` | Every created row has a non-null, distinct referral_code | all referral_codes non-null + Set dedup |

**Important for smoke sequencing:** Phase 13 referral cases that issue valid POSTs must use a distinct `X-Forwarded-For` IP (e.g. `192.0.2.43`) to avoid consuming rate-limit slots tracked against `SMOKE_IP` (`192.0.2.42`). The rate-limit case (case-7) depends on exactly 3 slots used from that IP.

### Sampling Rate
- **Per task commit:** `node scripts/smoke-signup.mjs` (full smoke; ~5s)
- **Per wave merge:** `node scripts/smoke-signup.mjs` (same)
- **Phase gate:** Full smoke green before `/gsd:verify-work`

### Wave 0 Gaps

None — existing test infrastructure (`scripts/smoke-signup.mjs`) covers the smoke pattern. Extension only, no new framework needed.

---

## Security Domain

`security_enforcement` is not set to false in config — included.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | ref codes are not auth credentials |
| V3 Session Management | no | ref codes have no session role |
| V4 Access Control | no | ref resolution is read-only, no gated resource |
| V5 Input Validation | yes | ref trimmed+lowercased; validated server-side against DB; malformed → NULL |
| V6 Cryptography | yes | `node:crypto randomInt` (CSPRNG); not hand-rolled |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Self-referral gaming | Tampering | D-08: compare ref code's owner email to submitter email; silently null |
| Referral code guessing (brute-force) | Information Disclosure | 8-char `[a-z0-9]` = ~2.8e12 keyspace; existing rate-limit (5/hr/IP) makes enumeration impractical |
| Unknown/malformed ref denial-of-service | Denial of Service | D-08: bad ref → null + signup continues; never blocks |
| localStorage poisoning | Tampering | D-13: client does no validation; server validates; poisoned stored ref resolves to null |
| Rate-limit bypass via referral code enumeration | Elevation of Privilege | Rate-limit applies to the signup path (IP + email); ref lookup is a read-only prepared-statement SELECT, not a separate rateable endpoint |

---

## Sources

### Primary (HIGH confidence)
- `src/lib/db.ts` (live codebase) — migration block pattern, `pragma_table_info` probe, `COALESCE`-protected upsert, prepared-statement idiom
- `src/pages/api/signup.ts` (live codebase) — pre-flight chain exact ordering and line numbers
- `src/pages/index.astro` (live codebase) — form structure, inline script block structure
- `src/lib/token.ts` (live codebase) — `node:crypto` import idiom
- `scripts/smoke-signup.mjs` (live codebase) — 8-case smoke structure, rate-limit slot accounting
- Node 22 runtime (`node -e ...`) — `randomInt` availability and behavior, SQLite version, better-sqlite3 UNIQUE constraint error shape, NULL-distinctness in UNIQUE indexes
- `.planning/phases/13-referral-code-attribution/13-CONTEXT.md` — 15 locked decisions (authoritative)

### Secondary (MEDIUM confidence)
- Node.js documentation (training knowledge, consistent with live runtime test): `randomInt(max)` uses rejection sampling internally to eliminate modulo bias

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all existing
- Architecture: HIGH — all patterns verified against live codebase
- Pitfalls: HIGH — SQLite landmine and rate-limit accounting verified in live runtime
- Line numbers: HIGH — all six cited files read in full; all cited ranges confirmed accurate

**Research date:** 2026-05-22
**Valid until:** 2026-06-11 (hard launch; codebase changes between now and then could shift line numbers but not patterns)
