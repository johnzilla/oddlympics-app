---
phase: 09-manage-editor-unsubscribe
verified: 2026-05-14T22:26:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
---

# Phase 9: `/manage` Editor + Unsubscribe — Verification Report

**Phase Goal:** A signed-in subscriber can view + edit their team and timezone on `/manage`, pre-milestone subscribers see a one-time banner prompting them to pick a team, and the one-click unsubscribe email link works without re-authentication.
**Verified:** 2026-05-14T22:26:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 (SC1) | Signed-in user visits `/manage`, sees current team + tz, can change both via form, and after save sees updated values reflected on re-load. Auth uses existing magic-link/session. | VERIFIED | M2 (URL-token editor + Set-Cookie), M3 (save valid → DB updated, redirect to /manage?status=saved), manage.astro lines 39–75: dual-auth block, team `<select>` with pre-selected option, action="/api/save-selection". Smoke: pass=10/10. |
| 2 (SC2) | Pre-milestone subscriber row (`team=NULL`, `timezone='America/New_York'`) loads `/manage` without error AND sees one-time "Pick a team" banner; banner dismisses once team is set. | VERIFIED | M6 (smoke PASS): GET /manage with team=NULL session row → 200, body contains "Pick a team" and "You're signed up. Choose a team below to start getting kickoff alerts." manage.astro: `{!user?.team ? 'Pick a team' : 'Your schedule'}` conditional (line 198); implicit dismissal (no close button, no localStorage column). |
| 3 (SC3) | `/api/unsubscribe?token=...` removes user from active sending, no auth beyond signed token. HMAC-signed, expires after 1 year, single-use; second click is no-op. | VERIFIED | M8 (smoke PASS): 1-year token TTL verified programmatically (exp within ±1 day of 365 days); first click → /unsubscribed?status=ok; second click on same token → /unsubscribed?status=already. token.ts TTL_BY_PURPOSE.unsubscribe=60*60*24*365. markUnsubscribed WHERE clause: `WHERE email = ? AND unsubscribed_at IS NULL` (D-06 idempotency). |
| 4 (SC4) | Re-subscribing a previously-unsubscribed user via fresh signup is supported. | VERIFIED | M9 (smoke PASS): DB path — mark unsubscribed → dbMarkConfirmed → row has unsubscribed_at=NULL and confirmed_at updated. markConfirmed WHERE: `WHERE email = ? AND (confirmed_at IS NULL OR unsubscribed_at IS NOT NULL)` + `SET unsubscribed_at = NULL` (D-07). |

**Score: 4/4 truths verified**

---

### Decision Compliance Table (D-01 through D-07)

| Decision | Spec | Code Evidence | Status |
|----------|------|---------------|--------|
| D-01: URL consolidation — `/manage` is single editor URL | `/schedule` → 301 to `/manage`, preserving query string; `sendManageLink` URL changed | schedule.astro: 9-line file with `Astro.redirect('/manage' + (Astro.url.search || ''), 301)`; email.ts line 68: `${SITE_URL}/manage?token=...`; no `/schedule?token=` in email.ts | VERIFIED |
| D-02: Reuse `/api/save-selection` as update endpoint | Form on `/manage` POSTs to `/api/save-selection`; redirect target → `/manage?status=...` | manage.astro: `action="/api/save-selection"` (1 occurrence); save-selection.ts redirectTo: `Location: \`/manage?${params}\``; no `/schedule?` in save-selection.ts | VERIFIED |
| D-03: Native `<select name="team">` + VALID_TEAMS slug allow-list | Single `<select>` with 48 optgroup options; save-selection reads `form.get('team')` first, validates via VALID_TEAMS.has | manage.astro: `<select name="team" aria-label="Your team" required>` with groupedTeams optgroups; save-selection.ts: VALID_TEAMS imported + `VALID_TEAMS.has(slugInput)` check | VERIFIED |
| D-04: Implicit banner dismissal (no close button, no localStorage, no DB column) | Banner visible iff `user.team IS NULL`; dismissed on next render after team set | manage.astro: `{!user?.team ? 'Pick a team' : 'Your schedule'}` — no dismiss button, no localStorage, no DB column for dismissal state | VERIFIED |
| D-05: TTL_BY_PURPOSE table (confirm/manage=24h, unsubscribe=1y, session=30d) | Replace scalar `TTL_SECONDS` with per-purpose table; mintToken resolves via `opts?.ttlSeconds ?? TTL_BY_PURPOSE[opts?.purpose ?? 'confirm']` | token.ts: `TTL_BY_PURPOSE = { confirm: 60*60*24, manage: 60*60*24, unsubscribe: 60*60*24*365, session: 60*60*24*30 } as const`; mintToken lookup form present; no `TTL_SECONDS` scalar declaration | VERIFIED |
| D-06: DB-layer idempotency for unsubscribe (`WHERE unsubscribed_at IS NULL`) | Second click on same token is no-op; no nonce column needed | db.ts markUnsubscribed: `WHERE email = ? AND unsubscribed_at IS NULL`; M8 second-click → status=already confirmed | VERIFIED |
| D-07: `markConfirmed` widened — `WHERE email = ? AND (confirmed_at IS NULL OR unsubscribed_at IS NOT NULL)`; SET `unsubscribed_at = NULL` | Re-subscribe after unsubscribe re-fires the UPDATE and clears unsubscribed_at | db.ts markConfirmed: exact WHERE clause and `SET confirmed_at = strftime('%s','now'), unsubscribed_at = NULL`; M9 confirmed passing | VERIFIED |

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/token.ts` | TTL_BY_PURPOSE table + purpose-aware mintToken | VERIFIED | 88 lines; TTL_BY_PURPOSE declared as const; mintToken uses `opts?.ttlSeconds ?? TTL_BY_PURPOSE[opts?.purpose ?? 'confirm']`; legacy TTL_SECONDS scalar removed |
| `src/lib/db.ts` | markConfirmed WHERE widening + SET unsubscribed_at = NULL | VERIFIED | Lines 102–108: exact D-07 SQL; markUnsubscribed unchanged at lines 114–119 |
| `src/lib/email.ts` | sendManageLink URL is `/manage?token=` | VERIFIED | Line 68: `${SITE_URL}/manage?token=${encodeURIComponent(token)}`; no `/schedule?token=` anywhere in file |
| `src/pages/schedule.astro` | Thin 301 redirect handler, no UI | VERIFIED | 9 lines; only frontmatter with `Astro.redirect(dest, 301)`; no `<style>`, `<form>`, `<select>`, `<html>`, no imports |
| `src/pages/manage.astro` | Dual-mode editor: signed-out form + signed-in editor with banner, team `<select>`, tz row | VERIFIED | 429 lines; 4 branches (A=signed-out, B=expired token, C=unsubscribed, D=editor); STATUS_COPY with 6 entries incl. bad-team; no too-many; no feature-request; no legacy redirect to /schedule |
| `src/pages/api/save-selection.ts` | VALID_TEAMS slug parse + /manage redirect + bad-team status | VERIFIED | VALID_TEAMS imported + .has() check; redirectTo Location: `/manage?${params}`; redirectTo(formToken, 'bad-team') on failed slug; team_ids[] fallback retained for transition window |
| `scripts/smoke-manage.mjs` | 9-case (10 with M7b) end-to-end smoke | VERIFIED | 588 lines; runCase harness; 10 cases M1–M9 (M7b separate); inline node:crypto mintToken; dual DB handles |
| `package.json` | `smoke:manage` npm script | VERIFIED | `"smoke:manage": "node scripts/smoke-manage.mjs"` present |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| manage.astro signed-in branch | /api/save-selection | `<form method="post" action="/api/save-selection">` | WIRED | 1 occurrence confirmed; grep-verified |
| save-selection.ts redirectTo() | /manage?status=... | `Location: \`/manage?${params}\`` | WIRED | No /schedule? remaining in file |
| save-selection.ts team parse | VALID_TEAMS.has() | `form.get('team')` → trim/lowercase → VALID_TEAMS.has | WIRED | 2 VALID_TEAMS references (import + use) |
| email.ts sendManageLink | /manage?token= | URL string at line 68 | WIRED | No /schedule?token= anywhere in email.ts |
| schedule.astro | /manage (301) | Astro.redirect + Astro.url.search | WIRED | Query string preserved; M7 + M7b confirmed |
| markConfirmed | unsubscribed_at = NULL | WHERE widened + SET clause | WIRED | Exact D-07 SQL in db.ts lines 102–108 |
| buildUnsubscribeHeaders | 1-year TTL token | mintToken({ purpose: 'unsubscribe' }) auto-resolves TTL_BY_PURPOSE | WIRED | No call-site change required; token.ts handles resolution |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| manage.astro (editor branch D) | `user` (VipSignup) | `getByEmail.get(result.email)` from db.ts | Yes — live DB query | FLOWING |
| manage.astro (editor branch D) | `matches` array | JOIN query on `matches` + `teams` via teamRow.id | Yes — live DB JOIN; empty when no matches ingested | FLOWING |
| manage.astro (editor branch D) | `selectedIds` | resolved from `user.team` slug → `teams.id` | Yes — single-row SELECT | FLOWING |
| manage.astro (all branches) | `user?.team` (banner conditional) | same `user` from getByEmail | Yes | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Build succeeds without errors | `npm run build` | Build Complete! 653ms; 6 static routes prerendered | PASS |
| Smoke M1-M9 all pass (with matching MAGIC_LINK_SECRET) | `MAGIC_LINK_SECRET=... node scripts/smoke-manage.mjs` | `[smoke] result: pass=10 fail=0` | PASS |
| Phase 5 smoke no regression | `MAGIC_LINK_SECRET=... node scripts/smoke-signup.mjs` | `[smoke] result: pass=8 fail=0` | PASS |
| /schedule → 301 → /manage | M7 case | status=301, Location=/manage | PASS |
| /schedule?token=abc123 → 301 → /manage?token=abc123 | M7b case | status=301, Location=/manage?token=abc123 | PASS |

**Note on smoke execution environment:** The smoke script requires `MAGIC_LINK_SECRET` to be set to match the running server's secret. When run against a server that has `.env` loaded (via `npm run serve` which uses `--env-file=.env`), the script must be invoked with the matching secret. Without it, token signatures don't match and M2–M6/M8 fail. This is expected behavior by design and is documented in the smoke script's header. Running `node scripts/smoke-manage.mjs` alone (without the env var) against a server started via `npm run dev` (which also loads `.env`) will fail unless the smoke environment also has `MAGIC_LINK_SECRET` set.

---

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| MANAGE-01 | `/manage` displays + allows updating team and timezone; update endpoint pinned to `/api/save-selection` | SATISFIED | manage.astro dual-mode editor; save-selection.ts with VALID_TEAMS + /manage redirect; M2+M3+M4+M5 |
| MANAGE-02 | One-click unsubscribe, HMAC-signed, 1-year expiry, single-use | SATISFIED | TTL_BY_PURPOSE.unsubscribe=1y; markUnsubscribed WHERE idempotency; M8 passes both clicks |
| COMPAT-01 | Pre-milestone subscribers (`team=NULL`) load `/manage` without error; one-time banner prompts team pick | SATISFIED | manage.astro banner conditional; M6 passes |

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `src/pages/api/save-selection.ts` lines 51–70 | `team_ids[]` fallback parse retained | INFO | Intentional transition-window fallback. Plan comment says "remove after 2026-05-26". Not a stub — it's a documented temporary backward-compat path. No DB column or flag required; it resolves correctly via slug lookup. |

No `TBD`, `FIXME`, or `XXX` debt markers found in any Phase 9 modified files.

---

### Human Verification Required

**None.** All success criteria are verifiable programmatically and have been verified via smoke tests.

The following items are noted as informational for the operator, not as blockers:

1. **team_ids[] fallback removal** — `src/pages/api/save-selection.ts` contains a transition-window fallback for the old checkbox form. The plan documents removal by 2026-05-26. This is intentional and not a gap.

2. **Smoke must be run with matching MAGIC_LINK_SECRET** — The smoke passes 10/10 when MAGIC_LINK_SECRET matches the server's secret. Running without it against a server that has the env var set will produce token-verification failures. The smoke header documents this requirement.

---

### Gaps Summary

No gaps. All four ROADMAP success criteria are verified by code inspection and end-to-end smoke results.

---

## VERIFICATION PASSED

All must-haves verified. Phase 9 goal achieved. Ready to proceed to Phase 10 (confirmation email update).

**Evidence summary:**
- `npm run build` exits 0 (production build clean)
- `scripts/smoke-manage.mjs` exits 0 with `pass=10 fail=0` (against built server with matching secret)
- `scripts/smoke-signup.mjs` exits 0 with `pass=8 fail=0` (Phase 5 smoke, no regression)
- D-01 through D-07 all implemented exactly as specified in CONTEXT.md
- SC1–SC4 each have at least one passing smoke case as direct evidence
- MANAGE-01, MANAGE-02, and COMPAT-01 all satisfied

---

_Verified: 2026-05-14T22:26:00Z_
_Verifier: Claude (gsd-verifier)_
