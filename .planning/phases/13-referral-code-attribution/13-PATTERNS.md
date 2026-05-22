# Phase 13: Referral Code & Attribution - Pattern Map

**Mapped:** 2026-05-22
**Files analyzed:** 6 new/modified files
**Analogs found:** 6 / 6

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/lib/db.ts` | model/migration | CRUD | `src/lib/db.ts` lines 33–61 (probe block), 81–93 (upsert), 159–166 (teams probe) | exact — self-referential modification |
| `src/lib/referral.ts` | utility | transform | `src/lib/timezones.ts` (small lib helper with exported const + function), `src/lib/token.ts` (node:crypto consumer) | role-match exact |
| `src/pages/api/signup.ts` | route/controller | request-response | `src/pages/api/signup.ts` lines 82–100 (tz-fallback + upsert pattern) | exact — self-referential modification |
| `src/pages/index.astro` | component | request-response | `src/pages/index.astro` lines 175–225 (inline script block), 93–95 (hidden fields) | exact — self-referential modification |
| `scripts/smoke-signup.mjs` | test | CRUD | `scripts/smoke-signup.mjs` lines 55–99 (runCase/post/dbRowFor framework) | exact — self-referential extension |
| `DEPLOY.md` | config/docs | — | `DEPLOY.md` lines 99–114 (Day-2 ops table) | exact — self-referential modification |

---

## Pattern Assignments

### `src/lib/db.ts` (model, CRUD — migration + upsert extension)

**Analog:** `src/lib/db.ts` — three existing patterns to copy from within the same file.

**Pattern A — `pragma_table_info` probe + `ALTER TABLE ADD COLUMN`** (lines 33–61):

The existing block probes `vip_signups` columns, then conditionally runs `ALTER TABLE`. Phase 13 adds a second probe block (or extends the same one) for `referral_code` and `referred_by`. The SQLite version assert and `DROP COLUMN` from lines 44–56 do NOT apply — Phase 13 is purely additive.

```typescript
// src/lib/db.ts:33-61 — copy this probe structure verbatim
{
  const cols = db
    .prepare("SELECT name FROM pragma_table_info('vip_signups')")
    .all() as { name: string }[];
  const has = (n: string) => cols.some((c) => c.name === n);
  if (!has('unsubscribed_at'))
    db.exec(`ALTER TABLE vip_signups ADD COLUMN unsubscribed_at INTEGER;`);
  // ... other probes ...
}
// The Phase 13 block is structurally identical but simpler: no version assert,
// no DROP COLUMN. Just the probe + two ADD COLUMNs + the UNIQUE INDEX + backfill.
```

**Pattern B — teams probe block** (lines 159–166), the simpler secondary-table example:

```typescript
// src/lib/db.ts:159-166 — the minimal probe shape (no version assert, no DROP)
{
  const cols = db
    .prepare("SELECT name FROM pragma_table_info('teams')")
    .all() as { name: string }[];
  const has = (n: string) => cols.some((c) => c.name === n);
  if (!has('slug'))
    db.exec(`ALTER TABLE teams ADD COLUMN slug TEXT;`);
}
// Phase 13's referral_code + referred_by block follows this simpler shape.
// Add the UNIQUE INDEX immediately after the ADD COLUMN (separate db.exec call —
// SQLite ALTER TABLE ADD COLUMN forbids inline UNIQUE constraint).
```

**Pattern C — `COALESCE`-protected upsert** (lines 81–93):

```typescript
// src/lib/db.ts:81-93 — current upsertVipSignup (6-param, extend to 8)
export const upsertVipSignup = db.prepare<
  [string, string, string | null, string | null, string | null, string]
>(`
  INSERT INTO vip_signups (email, requested_sport, ip, user_agent, team, timezone)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(email) DO UPDATE SET
    requested_sport = excluded.requested_sport,
    ip = COALESCE(excluded.ip, vip_signups.ip),
    user_agent = COALESCE(excluded.user_agent, vip_signups.user_agent),
    team = COALESCE(excluded.team, vip_signups.team),
    timezone = excluded.timezone
  RETURNING *
`);
// Phase 13 extends the generic tuple to 8 params and adds two COALESCE lines:
//   referral_code = COALESCE(excluded.referral_code, vip_signups.referral_code)
//   referred_by   = COALESCE(excluded.referred_by,   vip_signups.referred_by)
// COALESCE-on-referral_code = stability (D-04); COALESCE-on-referred_by = first-touch (D-06).
// Precedent: team uses the identical COALESCE shape (line 90), slug on upsertTeam (line 214).
```

**Pattern D — COALESCE on a different table** (lines 205–216), for additional COALESCE precedent:

```typescript
// src/lib/db.ts:205-216 — upsertTeam: slug = COALESCE(excluded.slug, teams.slug)
export const upsertTeam = db.prepare<
  [number, string, string, string | null, string | null]
>(`
  INSERT INTO teams (id, tla, name, crest_url, slug)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    tla = excluded.tla,
    name = excluded.name,
    crest_url = excluded.crest_url,
    slug = COALESCE(excluded.slug, teams.slug),
    last_updated = strftime('%s','now')
`);
```

**Pattern E — VipSignup type block** (lines 63–75), extend by two fields:

```typescript
// src/lib/db.ts:63-75 — current VipSignup type (add referral_code + referred_by)
export type VipSignup = {
  id: number;
  email: string;
  requested_sport: string;
  confirmed_at: number | null;
  created_at: number;
  ip: string | null;
  user_agent: string | null;
  unsubscribed_at: number | null;
  team: string | null; // Phase 5: snake_case slug from references/teams.json
  timezone: string | null; // IANA TZ, e.g. "America/New_York"
  manage_blast_sent_at: number | null; // Phase 2.5: launch-blast tracking
};
// Add: referral_code: string | null  (nullable pre-backfill; always set post-migration)
//      referred_by: string | null     (nullable — set only for referred signups)
```

**Pattern F — prepared statement for lookup** (lines 110–112), shape for `lookupByReferralCode`:

```typescript
// src/lib/db.ts:110-112 — getByEmail: single-column WHERE = ? lookup pattern
export const getByEmail = db.prepare<[string]>(`
  SELECT * FROM vip_signups WHERE email = ?
`);
// Phase 13 adds: lookupByReferralCode = db.prepare<[string]>(`
//   SELECT email, referral_code FROM vip_signups WHERE referral_code = ?
// `);
// Narrowed SELECT (not SELECT *) because only email and referral_code are needed.
```

---

### `src/lib/referral.ts` (utility, transform — new file)

**Analog:** `src/lib/timezones.ts` (small lib helper: module constants + exported functions, no default export, no barrel index) and `src/lib/token.ts` (node:crypto consumer, named exports only).

**Import pattern** from `src/lib/timezones.ts` lines 1–11 and `src/lib/token.ts` line 1:

```typescript
// src/lib/timezones.ts:1 — node: prefix on built-in (not present here but pattern
// from token.ts:1 applies — all built-ins use node: prefix per CLAUDE.md)
// src/lib/token.ts:1
import { createHmac, timingSafeEqual } from 'node:crypto';
// Phase 13 analog: import { randomInt } from 'node:crypto';
// randomInt is not currently imported in token.ts — add to this new file, not token.ts.
```

**Module shape pattern** from `src/lib/timezones.ts` lines 1–11:

```typescript
// src/lib/timezones.ts:1-11 — small helper: module constant + exported function
export const FALLBACK_TZ = 'America/New_York' as const;

function buildTzSet(): ReadonlySet<string> {
  try {
    return new Set(Intl.supportedValuesOf('timeZone'));
  } catch {
    return new Set([FALLBACK_TZ]);
  }
}

export const VALID_TZ: ReadonlySet<string> = buildTzSet();
// No default export. Named exports only. No index barrel.
```

**Core pattern** — `generateReferralCode()` follows the same shape:

```typescript
// Mirrors timezones.ts module constant + function pattern.
// Uses node:crypto randomInt (verified: Node 22, bias-free per RESEARCH.md).
import { randomInt } from 'node:crypto';

const CHARSET = 'abcdefghijklmnopqrstuvwxyz0123456789'; // 36 chars, [a-z0-9]

export function generateReferralCode(): string {
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += CHARSET[randomInt(CHARSET.length)]; // randomInt(36): bias-free (Node handles rejection sampling)
  }
  return code;
}
```

**No error handling pattern** needed at the function level — `randomInt` does not throw under normal conditions. The collision-retry loop belongs in the caller (`db.ts` backfill and `signup.ts` upsert call site).

---

### `src/pages/api/signup.ts` (route, request-response — modify)

**Analog:** `src/pages/api/signup.ts` — self-referential modification. Three internal patterns govern the insertion point.

**Import block** (lines 1–8) — extend with referral lookup import:

```typescript
// src/pages/api/signup.ts:1-8 — current imports
import type { APIRoute } from 'astro';
import { upsertVipSignup } from '../../lib/db';
import { mintToken } from '../../lib/token';
import { sendMagicLink } from '../../lib/email';
import { checkRateLimit } from '../../lib/rate-limit';
import { VALID_TEAMS } from '../../lib/teams';
import { VALID_TZ, FALLBACK_TZ } from '../../lib/timezones';
// Phase 13 adds: import { generateReferralCode } from '../../lib/referral';
// Phase 13 adds: import { lookupByReferralCode } from '../../lib/db';
// (or both imports from db if generateReferralCode inlines into db.ts)
```

**Analog for the "never rejects, silent fallback" step** — tz-fallback block (lines 82–90):

```typescript
// src/pages/api/signup.ts:82-90 — tz-fallback: post-validation, pre-upsert, never calls back()
// Phase 5 — SIGNUP-02: timezone fallback (does NOT reject).
const rawTz = ((form.get('timezone') as string | null) ?? '').trim();
let tz: string;
if (rawTz && VALID_TZ.has(rawTz)) {
  tz = rawTz;
} else {
  tz = FALLBACK_TZ;
  console.log(`[signup] tz-fallback email=${rawEmail} input=${JSON.stringify(rawTz)}`);
}
// D-09 insertion point: ref resolution block goes immediately after line 90,
// before the upsertVipSignup.get() call at line 92.
// It follows the identical "never calls back(), compute-then-continue" shape.
```

**`back()` helper** (lines 38–43) — for negative confirmation that ref resolution MUST NOT use it:

```typescript
// src/pages/api/signup.ts:38-43 — back(): used by all rejecting steps
function back(message: string): Response {
  return new Response(null, {
    status: 303,
    headers: { Location: `/?error=${encodeURIComponent(message)}` },
  });
}
// D-09: ref resolution never calls back(). Bad/unknown/self ref → referredBy = null.
// This preserves the "signup never rejects" contract (Phase 5/6).
```

**Upsert call site** (lines 92–104) — shows current 6-param signature to extend:

```typescript
// src/pages/api/signup.ts:92-104 — current upsert call (6 params → extend to 8)
try {
  upsertVipSignup.get(
    rawEmail,
    requestedSport,
    ip === 'unknown' ? null : ip,
    request.headers.get('user-agent'),
    rawTeam,
    tz,
    // Phase 13 adds: referralCode (string — generated before this call)
    // Phase 13 adds: referredBy  (string | null — resolved from ref resolution block)
  );
} catch (err) {
  console.error('[signup] db error', err);
  return back('server');
}
```

**Pre-flight ordering** (verified line numbers from RESEARCH.md):

| Step | Lines | Can call `back()`? |
|------|-------|-------------------|
| 1 Origin check | 46–48 | yes |
| 2 formData parse | 50–55 | yes |
| 3 Honeypot | 57–61 | yes (→ /pending) |
| 4 Email regex | 63–67 | yes |
| 5 Sport assignment | 69 | never |
| 6 Rate-limit | 71–73 | yes |
| 7 Team allow-list | 75–80 | yes |
| 8 TZ fallback | 82–90 | never |
| **9-NEW ref resolution** | ~91 | **never** |
| 10 Upsert | 92–104 | yes (server error) |

---

### `src/pages/index.astro` (component, request-response — modify)

**Analog:** `src/pages/index.astro` — self-referential modification. Two internal patterns govern the changes.

**Hidden field pattern** (lines 93–95) — existing hidden fields to add alongside:

```html
<!-- src/pages/index.astro:93-95 — existing hidden/special fields block -->
<input type="hidden" name="timezone" id="timezone" value="" />
<input type="hidden" name="requested_sport" value="world_cup" />
<input type="text" name="website" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true" />
<!-- Phase 13 adds immediately before or after the timezone input: -->
<!-- <input type="hidden" name="ref" id="ref" value="" /> -->
```

**Inline script block structure** (lines 175–225) — three independent `try/catch` blocks to add a fourth to:

```javascript
// src/pages/index.astro:175-225 — existing <script is:inline> with 3 independent try/catch blocks
// Block 1 (lines 177–188): tz-label swap + sets #timezone hidden field
try {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  const tzInput = document.getElementById('timezone');
  if (tzInput) tzInput.value = tz;
  // ...
} catch {}

// Block 2 (lines 190–208): ?error= param renderer
try {
  const COPY = { /* error code → message map */ };
  const code = new URL(location.href).searchParams.get('error');
  // ...
} catch {}

// Block 3 (lines 210–224): Plausible Signup Submit event listener
try {
  const form = document.getElementById('signup-form');
  if (form) { form.addEventListener('submit', function () { /* ... */ }); }
} catch {}

// Phase 13 adds Block 4: ?ref= / localStorage reader (D-10–D-13)
// Same independent try/catch wrapper. Must:
// - Read ?ref= from location.search (consistent with how block 2 reads ?error=)
// - Write to localStorage under 'oddlympics_ref' as {ref, ts} JSON (first-seen only)
// - Fall back to localStorage when no URL ?ref= present
// - Ignore stored entries older than 30 days
// - Write active ref to document.getElementById('ref').value
// - Perform no format validation (client transports only — server validates)
```

---

### `scripts/smoke-signup.mjs` (test — extend)

**Analog:** `scripts/smoke-signup.mjs` — self-referential extension. Three internal helpers govern the new cases.

**`runCase` / `post` / `dbRowFor` framework** (lines 55–99):

```javascript
// scripts/smoke-signup.mjs:55-99 — test framework to reuse verbatim
async function runCase(name, fn) {
  try {
    const ok = await fn();
    if (ok) { console.log(`[smoke] PASS ${name}`); pass++; }
    else     { console.error(`[smoke] FAIL ${name}`); fail++; }
  } catch (err) {
    console.error(`[smoke] FAIL ${name} (exception) ${err.message}`); fail++;
  }
}

async function post(form, extraHeaders = {}) {
  const body = new URLSearchParams(form);
  const res = await fetch(`${BASE}/api/signup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Origin: BASE,
      'X-Forwarded-For': SMOKE_IP,
      ...extraHeaders,
    },
    body,
    redirect: 'manual',
  });
  return { status: res.status, location: res.headers.get('location') };
}

function dbRowFor(email) {
  return db
    .prepare(
      'SELECT email, team, timezone, requested_sport FROM vip_signups WHERE email = ?',
    )
    .get(email);
}
// Phase 13 extends dbRowFor SELECT to also fetch referral_code, referred_by.
```

**Rate-limit slot accounting** (lines 281–287) — critical dependency for new case IP choice:

```javascript
// scripts/smoke-signup.mjs:281-287 — rate-limit slot comment (must update if adding valid POSTs)
// Pre-condition: prior cases (1, 4, 5) all came from SMOKE_IP and succeeded — that's 3 IP slots used.
// ...
// So at this point, SMOKE_IP has used ~3 of its 5 hourly slots.
// Phase 13: referral cases that issue valid POSTs MUST use a distinct IP
// (e.g. '192.0.2.43' — also RFC 5737 TEST-NET-1) to avoid consuming SMOKE_IP slots.
// Self-ref case re-signs up same email with same SMOKE_IP — counts as a slot.
// Insert referral cases BEFORE case-7-rate-limit and adjust the comment accordingly.
```

**Case shape to copy** (lines 147–176) — `case-1-valid` as the template for referral cases:

```javascript
// scripts/smoke-signup.mjs:147-176 — case-1-valid: the full POST + DB assertion shape to copy
await runCase('case-1-valid (team=england, tz=Europe/London)', async () => {
  const email = `smoke-valid-${Date.now()}@example.com`;
  const { status, location } = await post({ email, team: 'england', timezone: 'Europe/London' });
  if (status !== 303) { console.error(`  expected status 303, got ${status}`); return false; }
  if (!location?.startsWith('/pending?email=')) { /* ... */ return false; }
  const row = dbRowFor(email);
  if (!row) { console.error(`  expected row for ${email}, got nothing`); return false; }
  if (row.team !== 'england' || /* ... */) { /* ... */ return false; }
  return true;
});
// Phase 13 referral cases follow this exact shape.
// Additional assertion: row.referral_code (non-null), row.referred_by (code string or null).
```

**Six new cases required** (from RESEARCH.md Validation Architecture):

| Case name | IP to use | Key assertion |
|---|---|---|
| `REF-valid-ref` | `192.0.2.43` | signup B's `referred_by === codeA` |
| `REF-direct-no-ref` | `192.0.2.43` | `referred_by === null` |
| `REF-unknown-ref` | `192.0.2.43` | `referred_by === null`, signup succeeds |
| `REF-malformed-ref` | `192.0.2.43` | `referred_by === null`, signup succeeds |
| `REF-self-ref` | `SMOKE_IP` (re-signup) | `referred_by === null` |
| `REF-code-uniqueness` | — | all rows: `referral_code` non-null + Set.size === total count |

---

### `DEPLOY.md` (docs — extend)

**Analog:** `DEPLOY.md` lines 99–114 — Day-2 ops table. Add one row using the same Markdown table format.

**Table row format** (lines 103–114):

```markdown
<!-- DEPLOY.md:103-114 — Day-2 ops table format to match -->
| Want to... | Command |
|---|---|
| See live logs | `journalctl -u oddlympics -f` |
| Export the confirmed email list | `sqlite3 -csv /var/lib/oddlympics/oddlympics.db 'SELECT ...'` |
| See team distribution (post-Phase-5) | `sqlite3 -column -header /var/lib/oddlympics/oddlympics.db 'SELECT ...'` |
```

**One-shot signal pull format** (lines 117–126) — for the longer referral-attribution recipe, use the heredoc `<<SQL` style:

```bash
# DEPLOY.md:117-126 — multi-query format using <<SQL heredoc
ssh root@oddlympics.app 'sqlite3 /var/lib/oddlympics/oddlympics.db <<SQL
.mode column
.headers on
SELECT ...;
SQL'
```

---

## Shared Patterns

### `pragma_table_info` probe + `ALTER TABLE ADD COLUMN`
**Source:** `src/lib/db.ts` lines 33–61 (full vip_signups probe) and 159–166 (teams probe — simpler shape)
**Apply to:** Phase 13 migration block for `referral_code` and `referred_by`

The `teams` probe (lines 159–166) is the closer template for Phase 13 — it has no SQLite version assert and no `DROP COLUMN`. Copy that shape, adding two `if (!has(...))` guards and a `CREATE UNIQUE INDEX IF NOT EXISTS` call after them.

### COALESCE-protected upsert column
**Source:** `src/lib/db.ts` line 90 (`team = COALESCE(excluded.team, vip_signups.team)`) and line 214 (`slug = COALESCE(excluded.slug, teams.slug)`)
**Apply to:** Both new columns in the extended `upsertVipSignup` statement

### Never-rejects / silent-fallback step in `/api/signup`
**Source:** `src/pages/api/signup.ts` lines 82–90 (tz-fallback block)
**Apply to:** Ref resolution block (step 9-NEW, ~line 91)

The tz-fallback block is the canonical model: compute a value, use a fallback if the input is bad, log the fallback case, never call `back()`. Ref resolution follows the identical shape.

### Independent `try/catch`-wrapped inline script blocks
**Source:** `src/pages/index.astro` lines 177–188, 190–208, 210–224
**Apply to:** The new `?ref=` / localStorage reader block in `index.astro`

Each block is fully self-contained: its own `try/catch`, no shared mutable state with the other blocks. A thrown exception in one block cannot affect the others.

### node:crypto with `node:` prefix
**Source:** `src/lib/token.ts` line 1 (`import { createHmac, timingSafeEqual } from 'node:crypto'`)
**Apply to:** `src/lib/referral.ts` import of `randomInt`

All Node built-ins use the `node:` prefix per CLAUDE.md conventions.

### Named exports, no default export, no barrel index
**Source:** `src/lib/timezones.ts`, `src/lib/teams.ts`, `src/lib/token.ts` — all named exports only
**Apply to:** `src/lib/referral.ts`

### `type` over `interface`
**Source:** `src/lib/db.ts` line 63 (`export type VipSignup = { ... }`)
**Apply to:** Any new type shapes in `referral.ts` (if needed)

---

## No Analog Found

None. All six files have exact or role-match analogs within this codebase.

---

## Metadata

**Analog search scope:** `src/lib/`, `src/pages/api/`, `src/pages/`, `scripts/`, root docs
**Files read:** `src/lib/db.ts` (302 lines), `src/lib/token.ts` (88 lines), `src/lib/teams.ts` (18 lines), `src/lib/timezones.ts` (20 lines), `src/pages/api/signup.ts` (119 lines), `src/pages/index.astro` (481 lines), `scripts/smoke-signup.mjs` (321 lines), `DEPLOY.md` (130 lines)
**Pattern extraction date:** 2026-05-22

**Line number verification:** All line ranges cross-checked against live file reads above. RESEARCH.md cited ranges confirmed accurate:
- `db.ts:33-61` probe block — confirmed
- `db.ts:81-93` upsertVipSignup — confirmed (6-param, extending to 8)
- `db.ts:63-75` VipSignup type — confirmed (no referral_code/referred_by yet)
- `db.ts:159-166` teams probe — confirmed
- `signup.ts:38-43` back() helper — confirmed
- `signup.ts:45-119` POST handler — confirmed; D-09 insertion point at ~line 91
- `index.astro:66-104` form — confirmed; hidden fields at 93–95
- `index.astro:175-225` inline script — confirmed; 3 existing try/catch blocks
- `smoke-signup.mjs` 8-case structure — confirmed; `dbRowFor` at 93–99
- `DEPLOY.md` Day-2 table at 99–114 — confirmed
