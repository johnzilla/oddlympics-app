---
phase: 01-pre-launch-hardening
plan: "04"
subsystem: api+db+ui
tags:
  - unsubscribe
  - rfc-8058
  - can-spam
  - token-purpose-claim
  - schema-migration

requires:
  - "01-03 (token TTL drop must land first; 01-04 extends token.ts on top of that baseline)"
provides:
  - "vip_signups.unsubscribed_at INTEGER column (additive migration)"
  - "mintToken / verifyToken with optional purpose claim ('confirm' | 'unsubscribe')"
  - "GET /api/unsubscribe handler (303 redirect with status query param)"
  - "/unsubscribed status page (prerendered, COPY hydration)"
  - "buildUnsubscribeHeaders(email) helper for RFC 8058 / Gmail bulk-sender compliance"
affects:
  - "Phase 3 sendNotification (will call buildUnsubscribeHeaders at send-time)"

tech-stack:
  added: []
  patterns:
    - "Token purpose claim with backward-compat fallback (legacy tokens treated as 'confirm')"
    - "PRAGMA table_info() probe for additive column migration (SQLite has no ADD COLUMN IF NOT EXISTS)"
    - "RFC 8058 List-Unsubscribe + List-Unsubscribe-Post: List-Unsubscribe=One-Click"
    - "Idempotent UPDATE WHERE … IS NULL (mirrors markConfirmed)"

key-files:
  created:
    - src/pages/api/unsubscribe.ts
    - src/pages/unsubscribed.astro
  modified:
    - src/lib/token.ts
    - src/lib/db.ts
    - src/lib/email.ts

key-decisions:
  - "D-04: legacy tokens with no purpose field accepted as purpose='confirm' (no proactive invalidation)"
  - "D-05 type override: unsubscribed_at INTEGER (matches confirmed_at/created_at convention) rather than TEXT"
  - "D-06: mintToken accepts opts.purpose; verifyToken accepts expectedPurpose; mismatch -> null"
  - "D-07: sendMagicLink intentionally does NOT call buildUnsubscribeHeaders (CAN-SPAM exemption)"
  - "D-08: List-Unsubscribe is angle-bracketed URL (RFC 2369/8058); List-Unsubscribe-Post value is exact case-sensitive literal"
  - "D-09: /unsubscribed reuses the inline-script COPY hydration pattern from /confirmed"
  - "mintToken signature uses options object (not positional purpose arg) for forward extensibility"

patterns-established:
  - "When extending an existing schema with an additive column: use PRAGMA table_info() probe, not ALTER TABLE IF NOT EXISTS — SQLite has no IF NOT EXISTS clause for ADD COLUMN. Only CREATE TABLE / CREATE INDEX support IF NOT EXISTS."

requirements-completed:
  - HARDEN-02

duration: ~25min (including E2E smoke test that found and fixed the SQLite syntax bug)
completed: 2026-05-09
---

# Phase 01 Plan 04: Unsubscribe Vertical Slice (HARDEN-02)

**Complete unsubscribe scaffolding: schema column, token purpose claim, GET endpoint, status page, RFC 8058 helper. End-to-end tested via curl against the running server.**

## Performance

- **Duration:** ~25 min including E2E smoke test
- **Tasks:** 3 (all auto)
- **Files modified:** 3 (`src/lib/token.ts`, `src/lib/db.ts`, `src/lib/email.ts`)
- **Files created:** 2 (`src/pages/api/unsubscribe.ts`, `src/pages/unsubscribed.astro`)
- **Bugs caught + fixed during E2E test:** 1 (SQLite migration syntax)

## Accomplishments

### Task 1 — token.ts + db.ts extensions
- `Payload` type gains optional `purpose: 'confirm' | 'unsubscribe'`.
- `mintToken(email, opts?)` adds optional `opts.purpose` (backward-compatible: existing `mintToken(rawEmail)` call site at `signup.ts:85` requires no change).
- `verifyToken(token, expectedPurpose?)` rejects tokens whose purpose claim does not match `expectedPurpose`. Legacy tokens (no purpose field) treated as `'confirm'` per D-04.
- `vip_signups.unsubscribed_at INTEGER` column added via additive migration. Type override of D-05's "TEXT" → INTEGER for in-tree consistency with `confirmed_at`/`created_at`.
- `markUnsubscribed` prepared statement mirrors `markConfirmed` shape (`WHERE … IS NULL`).

### Task 2 — email helper + GET endpoint
- `buildUnsubscribeHeaders(email)` exported from `src/lib/email.ts`. Returns the two RFC 8058 headers exactly: `List-Unsubscribe: <{SITE_URL}/api/unsubscribe?token={urlencoded}>` (angle-bracketed), `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (case-sensitive literal — Gmail's bulk-sender check parses this exact string).
- The token embedded in the helper URL is minted with `purpose: 'unsubscribe'` so wrong-purpose attempts are rejected.
- `sendMagicLink` is intentionally untouched (D-07: confirmation emails are exempt under CAN-SPAM).
- `src/pages/api/unsubscribe.ts` mirrors `src/pages/api/confirm.ts` shape. Imports `markUnsubscribed` and `getByEmail`. 303-redirects to `/unsubscribed?status={ok|already|bad-token|unknown}`. File-local `redirect()` helper.

### Task 3 — /unsubscribed status page
- Prerendered (`prerender = true`) and `noindex`'d. Inline `<script is:inline>` reads `?status=` from `location.href` and hydrates banner/headline/sub from a COPY map (same pattern as the post-fix `/confirmed`).
- Distinct copy for `ok`, `already`, `bad-token`, `unknown`. Defaults to `ok` if no status param.
- Inline `<style is:global>` matches the existing minimalist Bitcoin-on-near-black aesthetic.
- Shared-layout refactor remains deferred per CONTEXT.md `<deferred>` (this is the 4th page; not a hardening blocker).

## Task Commits

1. `7513593` feat(01-04): extend token + db with unsubscribe purpose claim and column (HARDEN-02 task 1)
2. `3fd6a1b` feat(01-04): add buildUnsubscribeHeaders + /api/unsubscribe (HARDEN-02 task 2)
3. `53f7abd` feat(01-04): add /unsubscribed status page (HARDEN-02 task 3)
4. `c4ca39d` fix(01-04): replace ALTER TABLE IF NOT EXISTS with PRAGMA-based check

## Bug Caught + Fixed

The E2E smoke test surfaced a real bug introduced by the plan: `ALTER TABLE … ADD COLUMN IF NOT EXISTS` is **not valid SQLite syntax**. The plan claimed SQLite 3.35+ supports it; that's wrong (SQLite 3.35 added `DROP COLUMN`, not the `IF NOT EXISTS` clause for `ADD COLUMN`). The unconditional ALTER threw `near "EXISTS": syntax error` on every DB-module load, 500-ing every API request after a fresh DB.

Fixed by probing `pragma_table_info('vip_signups')` for the column and only running the unconditional `ALTER TABLE … ADD COLUMN unsubscribed_at INTEGER` when it's absent.

This is a **patterns lesson** worth keeping: SQLite supports `IF NOT EXISTS` on `CREATE TABLE` and `CREATE INDEX`, but **not** on `ALTER TABLE ADD COLUMN`. Future additive migrations must use the PRAGMA probe pattern.

## End-to-End Smoke Test (recorded)

Run against `node ./dist/server/entry.mjs` on `127.0.0.1:4321` with `MAGIC_LINK_SECRET=dev-test`, fresh DB, seeded with `INSERT INTO vip_signups (email, requested_sport, confirmed_at) VALUES ('seed@example.com','world_cup', strftime('%s','now'))`:

| Probe | Result |
|---|---|
| `GET /api/confirm?token=trigger-init` (cold start, schema bootstrap) | 303 (not 500) |
| `PRAGMA table_info(vip_signups)` after init | `unsubscribed_at INTEGER` present |
| `GET /api/unsubscribe?token=<valid-unsubscribe>` first call | 303 (status=ok) |
| DB after first unsubscribe | `unsubscribed_at` populated |
| `GET /api/unsubscribe?token=<same>` replay | 303 (status=already) |
| `GET /api/unsubscribe?token=garbage` | 303 (status=bad-token) |
| `GET /api/unsubscribe?token=<valid-confirm-purpose>` | 303 (status=bad-token; wrong-purpose rejected) |
| `GET /unsubscribed?status=ok` | 200 |
| `GET /api/confirm?token=<valid-confirm>` for a different email | 303 (regression-safe) |

## Decisions Made

See `key-decisions` in frontmatter. Noteworthy:
- The `unsubscribed_at` column is INTEGER (unix epoch seconds via `strftime('%s','now')`), matching `confirmed_at`/`created_at`. CONTEXT.md D-05 wording said "TEXT" — overridden for in-tree consistency. Documented in commit message and SUMMARY.

## Deviations from Plan

- **SQLite migration syntax**: plan said `ALTER TABLE … ADD COLUMN IF NOT EXISTS` is supported; it isn't. Implemented via `pragma_table_info` probe instead. Result equivalent; mechanism different.

## Threat Surface

- Unsubscribe token is a bearer credential. Anyone with the URL can unsubscribe the embedded email. Mitigated by HMAC + 24h TTL inherited from plan 01-03. CSRF surface intentionally open (GET unsubscribe is fine for one-click compliance under RFC 8058).
- Wrong-purpose token rejection prevents a confirm-purpose token from being repurposed to unsubscribe (and vice versa).
- Idempotent UPDATE means replay with the same token is a no-op (already-unsubscribed) — same hardening as `markConfirmed`.

## Next Phase Readiness

- Phase 3 notification senders call `buildUnsubscribeHeaders(email)` and spread the result into the Resend `headers` field at send-time. Wiring is one line per send.
- The `unsubscribed_at IS NULL` filter is the canonical predicate for "still subscribed" — apply to all future notification queries.

---

*Phase: 01-pre-launch-hardening*
*Completed: 2026-05-09*
