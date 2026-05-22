# Phase 13: Referral Code & Attribution - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Give every `vip_signups` row a unique, stable, public **referral code**, and
make the signup path record which code (if any) drove a new signup via a
`referred_by` column — so share-driven signups become measurable.

In scope:
- Two additive columns on `vip_signups`: `referral_code` (unique, every row)
  and `referred_by` (nullable, the code that referred this signup).
- An additive migration in `src/lib/db.ts` (`pragma_table_info` probe +
  `ALTER TABLE ADD COLUMN`) plus a one-time backfill so every *existing* row
  gets a code; re-running the migration is a no-op.
- `/api/signup` resolves a submitted `ref` value to a referral code and writes
  `referred_by` — never rejecting on a bad/unknown/self ref.
- `/?ref=CODE` carry-through: a hidden `ref` field on the prerendered landing
  form, populated client-side, with a localStorage fallback.
- Verification: extend `scripts/smoke-signup.mjs`. Measurement: a documented
  Day-2 ops SQL recipe in `DEPLOY.md`.

Out of scope (locked / deferred):
- **No share UI** — share prompts, the native share sheet, team-named copy on
  `/pending`/`/confirmed`/`/manage`, and the email share line are **Phase 14**.
  Phase 13 is plumbing only; the code is invisible to users this phase except
  as a URL param.
- **No per-team OG / `/r/CODE` route** — Phase 15.
- **No rewards, leaderboard, referral count, fraud system, or analytics
  dashboard** — REQUIREMENTS.md "Out of Scope" / "Future Requirements"
  (REF-F1, REF-F2).
- The referral code is **NOT** added to the HMAC `purpose`-claimed token
  system in `src/lib/token.ts` (locked in PROJECT.md Key Decisions).

</domain>

<decisions>
## Implementation Decisions

### Referral code shape & generation

- **D-01:** The referral code is a **random opaque string**, **8 characters**,
  charset **`a–z0–9`** (full lowercase alphanumeric) — keyspace ~36^8 ≈
  2.8e12. No team name, email, or other data is derived into it (the Phase 15
  OG route resolves code → team via a DB lookup, so the code carries no team
  info itself). It is a public short identifier, **not** an HMAC/signed token.
- **D-02:** New column `vip_signups.referral_code TEXT`. Uniqueness is enforced
  by a **`CREATE UNIQUE INDEX IF NOT EXISTS`** — *not* an inline column
  constraint (SQLite `ALTER TABLE ADD COLUMN` forbids `UNIQUE`/`PRIMARY KEY`
  constraints; see code_context landmine). Codes are generated app-layer with
  `node:crypto`; on a `UNIQUE` collision, **regenerate and retry**.
- **D-03:** The migration is **additive** — `pragma_table_info` probe +
  `ALTER TABLE ADD COLUMN` for both `referral_code` and `referred_by`,
  mirroring the existing `db.ts` blocks. **No SQLite-version assert, no
  `DROP COLUMN`** — this is not a destructive migration like Phase 5. Re-running
  is a no-op.
- **D-04:** **Backfill** — the migration assigns a unique `referral_code` to
  **every existing `vip_signups` row** (loop rows where `referral_code IS
  NULL`, generate, `UPDATE`). Idempotent: a second boot finds zero NULL rows.
  New rows get a code at insert time. **Stability:** once set, `referral_code`
  is never regenerated — `COALESCE`-protected in `upsertVipSignup` so a
  re-signup keeps the existing code.

### Attribution model

- **D-05:** New column `vip_signups.referred_by TEXT` (nullable, default
  `NULL`). It stores the **referral code string itself** (per SC3) — not an
  email or row id.
- **D-06:** **First-touch attribution.** `referred_by` is `COALESCE`-protected
  in `upsertVipSignup` exactly like `team`
  (`referred_by = COALESCE(excluded.referred_by, vip_signups.referred_by)`).
  Once set it is **never overwritten**; a still-`NULL` `referred_by` *can* be
  filled by a later re-signup that carries a valid ref.
- **D-07:** Ref resolution runs **synchronously inside `/api/signup`**: look
  the submitted ref up against `referral_code`. Resolves to a row → that code
  is the `referred_by` candidate. Does not resolve → `referred_by` stays
  `NULL` (unknown ref silently ignored). Attribution applies **regardless of
  the referrer's `confirmed_at` / `unsubscribed_at`** — no status join;
  measurement queries filter later if they want to.
- **D-08:** **Self-referral** — if the resolved code's owner email equals the
  submitting email (both trimmed + lowercased), the ref is ignored
  (`referred_by` stays `NULL`). A malformed ref (wrong length/charset, or any
  value matching no code) → `NULL`. **None of these block or error the
  signup** — the v2.0 "signup never rejects" contract holds. The submitted ref
  is normalized (trim + lowercase) before lookup. Self-referral is only
  reachable on a *re-signup* (a brand-new email has no prior code).
- **D-09:** **Pre-flight ordering** — ref resolution is a post-validation,
  pre-upsert step in `/api/signup` that **never calls `back(...)`**. It only
  computes the `referred_by` value (string or `null`) passed to
  `upsertVipSignup`. Place it after the team allow-list + tz fallback, right
  before the upsert.

### Ref carry-through (landing page)

- **D-10:** Add a hidden field `<input type="hidden" name="ref">` to the
  `/api/signup` form in `src/pages/index.astro`. It is populated client-side
  via the existing prerendered-page `<script is:inline>` block — the same
  trick already used for `?error=`, `?email=`, and the `timezone` field.
- **D-11:** **Source precedence.** The inline script reads `?ref=` from
  `location.search`. If present → write it to the hidden field **and** store it
  in localStorage (**first-seen only** — do not overwrite an already-stored
  ref, consistent with first-touch). If the URL has no `?ref=` → fall back to
  the stored localStorage value when present and not expired. URL param is
  authoritative; localStorage is the no-param fallback.
- **D-12:** The localStorage entry carries a **timestamp**; a stored ref older
  than **30 days** is ignored. Suggested shape: a small `{ref, ts}` JSON under
  a key like `oddlympics_ref` (exact key/shape = planner discretion).
- **D-13:** The inline script is **defensive** — wrapped in `try/catch` like
  the existing scripts (localStorage throws in private mode / when disabled);
  on any failure it falls through with no ref rather than breaking the page.
  The client does **no** format/existence validation — it only transports
  whatever string is in `?ref=`; validation is the server's job (D-07/D-08).

### Verification & measurability

- **D-14:** **Extend `scripts/smoke-signup.mjs`** with referral cases (keep the
  existing 8 green): valid ref → `referred_by` set to that code; direct (no
  ref) → `NULL`; unknown ref → `NULL` + signup succeeds; malformed ref →
  `NULL` + succeeds; self-ref → `NULL` + succeeds; every created row has a
  non-null, unique `referral_code`. Exit 0 = all pass.
- **D-15:** Add a documented **referral-counting SQL recipe to `DEPLOY.md`'s
  Day-2 ops section**: signups grouped by `referred_by` (top referral codes),
  total referred vs. direct, % referred. This is the measurement mechanism
  REQUIREMENTS.md names ("queryable via the DEPLOY.md Day-2 ops path").

### Claude's Discretion

- Code-generation helper placement (`src/lib/` helper vs. inline in
  `db.ts`/`signup.ts`) and the `node:crypto` primitive used (`randomInt` loop
  vs. `randomBytes` + map) — match existing idiom.
- Whether a new row's code is generated in the `/api/signup` handler and
  passed as an upsert param, or generated inside a `db.ts` helper.
- Exact prepared-statement names and the `referral_code` lookup statement
  shape; whether `VipSignup.referral_code` is typed `string` (always populated
  post-migration) or `string | null`.
- localStorage key name and `{ref, ts}` JSON shape (D-12).
- Migration step order (create the unique index before or after backfill —
  both work: SQLite treats `NULL`s as distinct in a unique index).
- Exact wording/placement of the `DEPLOY.md` ops recipe; how the referral
  cases are structured inside `smoke-signup.mjs`.
- Plan/wave split — suggested: schema + migration + backfill → `/api/signup`
  ref resolution → landing-page carry-through → smoke + `DEPLOY.md` doc.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & scope (read first)
- `.planning/ROADMAP.md` §"Phase 13: Referral Code & Attribution" — goal,
  depends-on (Phase 12), the 4 success criteria (SC1–SC4 are authoritative).
- `.planning/REQUIREMENTS.md` §"Referral Attribution" — REF-01, REF-02, REF-03;
  §"Out of Scope" (no rewards/dashboard/fraud system) + §"Future Requirements"
  (REF-F1/REF-F2 deferred).
- `.planning/PROJECT.md` §"Key Decisions" / STATE.md §Decisions — "a referral
  code is a public short identifier, NOT a signed HMAC token"; "attribution
  stays lightweight — a `referred_by` column + `?ref=` param, no
  rewards/leaderboard".

### Prior-phase decisions (read before planning)
- `.planning/phases/05-schema-signup-payload/05-CONTEXT.md` — the
  `pragma_table_info` probe + `ALTER TABLE ADD COLUMN` migration pattern; the
  `VALID_TEAMS`-style allow-list idiom; `back('...')` 303-redirect + `?error=`
  vocabulary; `scripts/smoke-signup.mjs` as the signup-path smoke (Phase 13
  extends it). **Phase 13's migration is additive — the destructive-migration
  ceremony (version assert / `DROP COLUMN`) does NOT apply.**
- `.planning/phases/12-restore-multi-team-selection/12-CONTEXT.md` — most
  recent touch of `vip_signups`/`db.ts`; additive `CREATE TABLE`/index idiom,
  `COALESCE`-protected upsert columns. (D-02's Phase-12-only "no legacy data"
  waiver does NOT carry here — Phase 13 still backfills every existing row per
  SC1, though there is effectively only the operator's own data.)

### Existing code to edit (READ before editing)
- `src/lib/db.ts` — schema + migration blocks (`pragma_table_info` probe at
  `:33-61`, `teams.slug` probe at `:159-166`); `upsertVipSignup` `:81-93`
  (`COALESCE` pattern — add `referral_code`/`referred_by`); `VipSignup` type
  `:63-75`; prepared-statement idiom with typed generics + `RETURNING *`.
- `src/pages/api/signup.ts` — pre-flight chain (`:45-119`); `back()` helper
  `:38-43`; insert ref resolution after tz fallback, before the upsert (D-09).
- `src/pages/index.astro` — signup `<form>` `:66-104` (add hidden `ref`
  field); inline `<script is:inline>` block `:175-225` (add the `?ref=` /
  localStorage reader alongside the `?error=` + `timezone` logic).
- `scripts/smoke-signup.mjs` — Phase 5 8-case smoke; extend per D-14.
- `DEPLOY.md` — Day-2 ops section; add the referral-counting recipe per D-15.
- `src/lib/token.ts` — uses `node:crypto` for HMAC; same module for random
  code generation. (The code does NOT join the token system — reference only.)

### Codebase conventions (downstream MUST match)
- `.planning/codebase/CONVENTIONS.md` — strict TS, `node:` prefix, prepared
  statements, `type` over `interface`, no framework JS, defensive inline
  scripts, `?error=` redirect pattern, why-only comments.
- `.planning/codebase/ARCHITECTURE.md` — hybrid static+server Astro; the
  prerendered-page-reads-URL-params abstraction (governs D-10/D-11).

No external ADRs/specs — requirements are fully captured in ROADMAP.md SC1–SC4
and the decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`pragma_table_info` probe + `ALTER TABLE ADD COLUMN`** (`src/lib/db.ts:33-61`,
  `:159-166`) — copy verbatim for `referral_code` + `referred_by`.
  **⚠ Landmine:** SQLite `ALTER TABLE ADD COLUMN` **cannot** add a column with
  a `UNIQUE` or `PRIMARY KEY` constraint. Enforce `referral_code` uniqueness
  with a separate `CREATE UNIQUE INDEX IF NOT EXISTS idx_vip_signups_referral_code
  ON vip_signups(referral_code)`.
- **`COALESCE`-protected upsert** (`upsertVipSignup` `src/lib/db.ts:81-93`;
  `upsertTeam` `:205-216`) — `team`/`slug` already use
  `col = COALESCE(excluded.col, table.col)`. `referral_code` (D-04 stability)
  and `referred_by` (D-06 first-touch) follow the identical shape.
- **`back()` 303 redirect + `?error=` chain** (`src/pages/api/signup.ts:38-43`)
  — ref resolution must **not** use it; ref handling never rejects (D-09).
- **Inline `<script is:inline>` URL-param reader** (`src/pages/index.astro:175-225`)
  — the `?error=` / `timezone` client-side trick; the `?ref=` + localStorage
  reader joins this block, defensively (D-13).
- **`scripts/smoke-signup.mjs`** — existing 8-case signup smoke; extend (D-14).
- **`node:crypto`** — already imported in `src/lib/token.ts`; use
  `randomBytes`/`randomInt` for code generation.

### Established Patterns
- Additive migrations via `pragma_table_info` probe; `CREATE INDEX IF NOT
  EXISTS`. No migration tool.
- Prepared statements with typed generics + `RETURNING *`.
- No framework JS — plain Astro + tiny `try/catch`-wrapped inline scripts.
- "Signup never rejects" (Phase 5/6) — every bad input either falls back or is
  silently ignored; bad ref handling extends this contract.

### Integration Points
- `vip_signups.referral_code` ← written by migration backfill (D-04) + signup
  upsert ← read by `/api/signup` ref lookup (this phase) ← **read by Phase 14**
  share UI ← **read by Phase 15** `/r/CODE` route.
- `vip_signups.referred_by` ← written by `/api/signup` (D-07) ← read by the
  `DEPLOY.md` Day-2 ops query (D-15).
- Hidden `ref` form field ← `index.astro` form ← read in `/api/signup`
  `request.formData()`.

</code_context>

<specifics>
## Specific Ideas

- Referral code: 8 chars, `[a-z0-9]`, e.g. `k7m2qx9a`.
- `referred_by` stores the literal code string (per SC3) — never an email/id.
- First-touch: `referred_by` `COALESCE`-protected, identical to how `team` is
  protected in `upsertVipSignup`.
- localStorage: first-seen ref wins, 30-day TTL via a stored timestamp.
- URL `?ref=` is authoritative when present; localStorage is the no-param
  fallback for reloads / return visits.
- Self-referral and unknown/malformed refs → `referred_by` stays `NULL`, signup
  still succeeds (SC4).

</specifics>

<deferred>
## Deferred Ideas

- **Share UI** (prompts on `/pending`/`/confirmed`/`/manage`, native share
  sheet, team-named copy, email share line) — **Phase 14** (SHARE-01..04).
- **Per-team OG images + server-rendered `/r/CODE` route** — **Phase 15**
  (OG-02, OG-03).
- **"You've referred N friends" count** (REF-F1) and **referral
  leaderboard / rewards** (REF-F2) — Future Requirements, explicitly out of
  scope for v2.1.
- **Referral analytics dashboard / admin UI** — out of scope (REQUIREMENTS.md);
  the `DEPLOY.md` Day-2 query (D-15) is the deliberate lightweight substitute.

None new from discussion — discussion stayed within phase scope.

</deferred>

---

*Phase: 13-referral-code-attribution*
*Context gathered: 2026-05-22*
