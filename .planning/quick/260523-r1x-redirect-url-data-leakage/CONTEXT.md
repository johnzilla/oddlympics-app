---
quick_id: 260523-r1x
slug: redirect-url-data-leakage
date: 2026-05-23
phase: discussion
description: |
  External review flagged "data leakage via query params on /pending and
  /confirmed (email, referral codes)." Discussion fact-checked the claim
  against the codebase: rc and team are public by design (Phase 13 D-01),
  email exposure is bounded by current deployment (no Caddy access logs,
  global Referrer-Policy strict-origin), and the real high-impact leak the
  reviewer missed is the magic-link ?token= on /manage. Scope tightened to
  that surface; three tactics selected; one rejected.
---

# Context — redirect-URL data leakage

## Reviewer claim (original task input)

> Data Leakage in Redirect URLs: The application still passes sensitive data
> (email, referral codes) via query parameters to `/pending` and `/confirmed`.
> These can persist in browser history and server logs.
> Recommendation: Move this data to server-side session state or use
> short-lived, encrypted one-time tokens.

## Fact-checking the claim

### What's actually in the URLs

| URL | Param | Source-of-truth read | Sensitivity |
|-----|-------|----------------------|-------------|
| `/pending` | `email` | signup.ts:174 redirect; pending.astro:25,43-44 displays `we sent a link to <email>` | **Mild — bounded** |
| `/pending` | `rc` | signup.ts:174; pending.astro composes share URL | **Not sensitive — public by design (Phase 13 D-01: "public 8-char [a-z0-9] short ID, known-observable, not auth")** |
| `/pending` | `team` | signup.ts:174; pending.astro uses for share text | **Not sensitive** |
| `/confirmed` | `rc` | confirm.ts:22,32 redirect; confirmed.astro:85 composes share URL | **Not sensitive (same as above)** |
| `/confirmed` | `status` | `ok` / `already` / `unknown` / `bad-token` | Not sensitive |
| `/manage` | `token` | manage.astro:36 reads, verifies, mints session | **HIGH-IMPACT — 24h-TTL auth credential. Reviewer did not mention.** |

### Leak-vector reality check

| Vector | Reviewer assumed | Actual state |
|--------|------------------|--------------|
| Browser history | Persists full URL | True — only practical fix is `history.replaceState()` or fragments |
| Server access logs | "persists in server logs" | **False as-deployed.** `deploy/Caddyfile` has no `log` directive — Caddy access logs are not enabled. Astro/Node logs no request URLs by default. Today this vector is empty. |
| Referrer-leakage to external sites | Implied | Mostly mitigated. `Caddyfile` sets `Referrer-Policy: strict-origin-when-cross-origin` globally — externals see origin only, no path/query. |

**Net:** the literal recommendation ("move to server-side session state or one-time tokens") is over-scoped for the actual leak surface. The cheapest defensible interpretation:

1. `rc` and `team` are public by design → out of scope.
2. `email` is mildly sensitive but only present in a UX greeting; bounded leak.
3. The `?token=` on `/manage` is the highest-value target — and the cheapest to harden.

## Decisions

### D-01: Scope is **tighten the /manage token surface only**

**User choice:** of the four scope options, only "tighten the /manage token surface" was selected.

**Why:** the reviewer conflated public referral codes (intentionally exposed) with the actual auth credential they didn't name. `rc` + `team` are not sensitive. `email` on `/pending` is mildly leaky but the only display use is a greeting; the full server-state refactor would cost more architecturally than the leak is worth. The `/manage` magic-link token is a 24h auth credential, and the same browser-history / referrer surfaces apply.

**Excluded from scope (declined options):**
- Drop email from `/pending` URL (greeting downgrade not worth small UX loss).
- Defense-in-depth Caddy log-redaction (Caddy access logs are not currently enabled; can add later if/when logging gets turned on for debugging).
- Full server-state refactor / one-time consumable tokens for `/pending` and `/confirmed` (architectural cost — flip both to `prerender = false`, new DB column for token-consumed state; over-budget pre-launch).

### D-02: Pre-launch (before 2026-06-11)

**User choice:** "Pre-launch."

**Why:** the leak is real and the tactics chosen are all bounded — no architectural churn, no migration risk that threatens the smoke or the cron.

### D-03: Three tactics will land together

**User choice:** all three of the following; declined the fourth.

#### Tactic 1 — `history.replaceState()` to scrub `?token=` from browser history (selected)

After `/manage` server-side verifies the URL token and mints the session cookie, emit a tiny inline `<script is:inline>` block that immediately rewrites the address bar to bare `/manage`. Browser history stores `/manage`, not `/manage?token=<24h-credential>`. Pure client-side, ~3 lines, zero UX impact. Kills the shared-device leak.

**Open detail (to resolve in PLAN):** Do we rewrite unconditionally when `?token=` is present (even on `bad-token` branches), or only on successful auth? Recommendation: rewrite unconditionally — even an invalid/expired token in history is unwanted noise.

#### Tactic 2 — Route-specific `Referrer-Policy: no-referrer` on `/manage` (selected)

Override the global `strict-origin-when-cross-origin` with the tightest setting (`no-referrer`) for `/manage` specifically. Means no part of the URL — origin OR path — leaves the browser when the user clicks an outbound link from `/manage`. Belt-and-suspenders on top of the global policy.

**Open detail (to resolve in PLAN):** set via `Astro.response.headers.set('Referrer-Policy', 'no-referrer')` in the frontmatter (server-side, applies before HTML parses) vs. `<meta name="referrer" content="no-referrer">` in `<head>` (client-side, applies after parse). The header is strictly safer.

#### Tactic 3 — Single-use enforcement on manage-purpose tokens (selected)

Today a `manage`-purpose token can be re-used within its 24h TTL (the verify path is idempotent). With this tactic, after first successful verify the token signature is recorded as consumed; subsequent verifies for the same signature reject with `bad-token`. Eliminates the 24h replay window if a token leaks via any vector.

**Open detail (to resolve in PLAN):**

- **Storage shape.** Investigate the existing per-purpose-TTL token-tracking machinery already shipped in Phase 9 ("per-purpose token TTL table (1-year single-use unsubscribe)" per `CLAUDE.md`). If a `tokens_used` or similar table already exists for unsubscribe, generalize it to cover `manage` purpose. If not, the cheapest new shape is a small table:
  ```sql
  CREATE TABLE IF NOT EXISTS consumed_tokens (
    sig TEXT PRIMARY KEY,        -- HMAC signature is unique per token; no email/exp leak
    purpose TEXT NOT NULL,       -- 'manage' for this task; later: 'confirm', 'unsubscribe' as needed
    consumed_at INTEGER NOT NULL
  );
  ```
  Verify-and-mark in one transaction: `verifyToken(token, 'manage')` succeeds → check `consumed_tokens` for sig → insert if absent → return success; if present → return null (treated as `bad-token`).

- **Semantic change is acknowledged.** Today re-clicks of the same `/manage` link work. After this change, a re-click of an already-used link goes to `bad-token` and the user has to request a new one. The session cookie minted on first use keeps them signed in, so a real user only sees this if they: (a) used the link, (b) cleared cookies, (c) tried the same link again. Edge case; acceptable trade for closing the 24h replay window.

- **TTL janitor / pruning.** Consumed-token rows accumulate. Either add a startup-time prune of rows older than the longest token TTL (24h), or accept unbounded growth (rows are ~80 bytes each — even 100k rows is ~8 MB). Recommendation: prune on boot, opportunistically.

#### Tactic 4 — Cut TTL from 24h to 1h (REJECTED)

**Why declined:** real users routinely sit on confirmation emails for hours (lunch breaks, end-of-day catch-up). A 1h TTL would generate measurable "link expired, please request another" friction on a launch funnel that explicitly cannot afford it.

## Implementation order (suggested for PLAN phase)

1. Tactic 1 (`history.replaceState()` scrub) — pure client-side, smallest blast radius, no schema change.
2. Tactic 2 (`Referrer-Policy: no-referrer` response header) — single-line response-header set in manage.astro frontmatter.
3. Tactic 3 (single-use enforcement) — investigate Phase 9 unsubscribe-token table first; either generalize that or add a new `consumed_tokens` table. Schema change goes through the existing `pragma_table_info` migration pattern (`src/lib/db.ts`).

Each tactic stands alone — if Tactic 3 hits unexpected schema complications, Tactics 1+2 still ship.

## Out of scope (carried forward to a future task if revisited)

- Generalizing the single-use enforcement to `confirm` and `unsubscribe` purposes. Confirm tokens are already de facto single-use (the `confirmed_at IS NULL` clause makes the second click idempotent without rejecting). Unsubscribe tokens are already 1-year single-use per Phase 9.
- One-time-token swap to drop `?email=` from `/pending`. Acceptable browser-history cost; UX greeting kept.
- Caddy access-log redaction as defense-in-depth. Defer until logs are actually enabled.
- Server-rendered `/pending` and `/confirmed`. Architectural cost out of proportion to remaining leak surface.

## Open questions for PLAN

1. Does the Phase 9 unsubscribe-token table generalize to manage? (Investigate first — may save schema work.)
2. `history.replaceState()` on bad-token branch: yes/no? (Recommendation: yes — even invalid tokens shouldn't stay in history.)
3. Should the response-header approach for Referrer-Policy also apply to `/api/manage` POST? (Probably not — it's a redirect endpoint, no rendered output. But worth a one-line check.)
