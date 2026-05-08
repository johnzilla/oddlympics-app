# Phase 1: Pre-launch Hardening - Context

**Gathered:** 2026-05-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Close the 6 known security/compliance gaps in the existing teaser app so it's safe to send a real email campaign to the captured list before any forward-feature work (Phase 2+) begins.

In scope: HARDEN-01 through HARDEN-06 (confirmed.astro fix, unsubscribe, Origin policy, CSP, off-droplet backup, magic-link TTL).

Out of scope: any Phase 2 personalization (team picker, schedule, time zone), notifications, tip jar, schema changes beyond what HARDEN-02 requires.

Migrations must be **additive** — must not break the existing teaser signup flow or invalidate captured emails.

</domain>

<decisions>
## Implementation Decisions

### Token Revocation (HARDEN-06)
- **D-01:** Strategy is **TTL drop only** — no DB-tracked nonce, no `used_tokens` table. Idempotency at the row level (`markConfirmed WHERE confirmed_at IS NULL`) already prevents replay damage; DB nonce is overkill for v1 risk profile.
- **D-02:** New TTL = **24 hours** (was 7 days). Single-line change to `TTL_SECONDS` in `src/lib/token.ts:4`.
- **D-03:** `/confirmed?status=bad-token` (after the HARDEN-01 fix renders it correctly) shows error copy + a "Re-send confirmation →" CTA linking back to `/`. Lowest-friction recovery for legitimate-but-late confirmers.
- **D-04:** Cutover treatment: tokens already minted with the old 7-day TTL remain valid until their original expiry (verifyToken checks the embedded `exp`); only newly minted tokens get the 24h window. No proactive invalidation of in-flight pre-cutover tokens.

### Unsubscribe (HARDEN-02)
- **D-05:** Data model is **soft delete** — add `unsubscribed_at TEXT` column to `vip_signups`. All future notification queries filter `WHERE unsubscribed_at IS NULL`. Hard delete deferred to a future "forget me" admin path; not v1.
- **D-06:** Auth is a **signed unsubscribe token** in the URL, distinct purpose from the magic-link confirm token. Reuse `mintToken` pattern with a `purpose: 'unsubscribe'` claim in the payload (verify rejects mismatched purpose). One-click GET endpoint: `GET /api/unsubscribe?token=...` → set `unsubscribed_at` → 303 to `/unsubscribed`.
- **D-07:** Scope: link appears in **all non-confirmation emails**. The double-opt-in confirmation email itself is transactional under CAN-SPAM and is exempt from the unsubscribe requirement.
- **D-08:** Add **RFC 8058 headers** to outbound mail via Resend custom headers: `List-Unsubscribe: <https://oddlympics.app/api/unsubscribe?token=...>` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click`. Enables Gmail/Apple Mail's native unsubscribe button and meets Gmail's 2024 bulk-sender requirements.
- **D-09:** New surface: `/unsubscribed` static page (same minimalist style as `/pending`, `/confirmed`) confirming the action.

### Backup (HARDEN-05)
- **D-10:** Destination is **Backblaze B2** (S3-compatible, ~$0.005/GB/mo, off-droplet ≠ DigitalOcean — real cross-vendor redundancy).
- **D-11:** Scheduler is a **systemd timer** (`oddlympics-backup.service` + `oddlympics-backup.timer`) running as the `oddlympics` user. Lives next to existing `oddlympics.service`; logs to journalctl.
- **D-12:** Tooling is **rclone** (already noted as canonical in `DEPLOY.md:133`) with the B2 backend. Application-key scoped to a single bucket.
- **D-13:** Retention: **daily snapshots for 30 days + weekly snapshots for 12 weeks**. Implemented via B2 lifecycle rules (preferred) or rclone `--backup-dir` if lifecycle proves awkward.
- **D-14:** **Restore must be tested before phase complete** (HARDEN-05 success criterion explicitly says "tested"). Plan includes: rclone download → `sqlite3 .restore` on a scratch VM (or local) → row-count + last-confirmed-email sanity check. Procedure documented in `DEPLOY.md`.
- **D-15:** Backup credentials live in `/etc/oddlympics-backup.env` (root-owned, group-readable by `oddlympics`), separate from `/etc/oddlympics.env` so the app can't read the backup key.

### CSP (HARDEN-04)
- **D-16:** Rollout is **report-only first, then enforce**. Add `Content-Security-Policy-Report-Only` header in Caddy, watch browser console + Plausible referrer for violations on real traffic for 1–2 days, then flip to `Content-Security-Policy`. Two-step deploy.
- **D-17:** Policy uses a **minimal allow-list**:
  ```
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://plausible.io;
  img-src 'self' data:;
  style-src 'self' 'unsafe-inline';
  connect-src 'self' https://plausible.io;
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  object-src 'none';
  ```
  Keeps `'unsafe-inline'` because all three pages have inline `<script is:inline>` and inline `<style is:global>` blocks; refactoring to nonces is out of scope for Phase 1.
- **D-18:** CSP header lives in **`deploy/Caddyfile`** alongside the existing security headers (HSTS, nosniff, frame-deny, Referrer-Policy at `Caddyfile:24-32`). One source of truth for security headers.
- **D-19:** Verification target: **A grade on securityheaders.com**. Plan includes a "verify A grade" acceptance step that scans `https://oddlympics.app` after deploy.

### Origin Policy (HARDEN-03 — partially pre-decided by REQUIREMENTS.md)
- **D-20:** Default-deny on missing `Origin` header for `POST /api/signup`. Replaces the current `if (!origin) return true` at `src/pages/api/signup.ts:22`. Allowlist for `localhost`/`127.0.0.1` is preserved per the existing custom check (`signup.ts:18-34`).

### confirmed.astro Fix (HARDEN-01 — pre-decided pattern)
- **D-21:** Apply the existing inline-script pattern from `index.astro:61-78` and `pending.astro:28-35` to `confirmed.astro`. Move the `COPY` map and `status` read into a `<script is:inline>` that swaps banner/headline/sub text at runtime. Keep `prerender = true`.

### Claude's Discretion
- Naming of new env vars (`B2_*`, `RCLONE_*`), exact systemd timer cadence (e.g., `OnCalendar=daily` vs. `03:00 UTC` to avoid traffic peaks), the precise `/unsubscribed` page copy, and whether to consolidate the duplicated-across-three-pages CSS into a shared layout component as part of HARDEN-01 (low-risk opportunistic refactor) — researcher/planner picks.
- Whether to set up a CSP `report-uri` / `Reporting-Endpoints` collector during the report-only window or just rely on browser console + manual page-load testing — planner decides; setting up a collector is likely overkill for 3 static pages.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements & decisions
- `.planning/REQUIREMENTS.md` §HARDEN-01..HARDEN-06 — the 6 success criteria for this phase
- `.planning/PROJECT.md` §Constraints — additive-only migrations, no email-list breakage
- `.planning/ROADMAP.md` §"Phase 1: Pre-launch Hardening" — goal + success criteria as roadmapped

### Codebase intel (read these to know what exists)
- `.planning/codebase/CONCERNS.md` — exact issue analysis for HARDEN-01 (CRITICAL: confirmed.astro), HARDEN-02 (no unsubscribe), HARDEN-03 (Origin missing), HARDEN-04 (no CSP), HARDEN-05 (no backup), HARDEN-06 (7-day token TTL)
- `.planning/codebase/ARCHITECTURE.md` §"Critical abstraction: prerendered pages reading URL params" — the inline-script pattern to apply for HARDEN-01
- `.planning/codebase/INTEGRATIONS.md` §Resend, §Caddy, §SQLite — auth, env vars, header location, and current backup state

### Source files implicated
- `src/lib/token.ts` — TTL change (HARDEN-06); `mintToken` extension for unsubscribe purpose claim (HARDEN-02)
- `src/lib/email.ts` — body template + RFC 8058 headers + unsubscribe URL injection (HARDEN-02)
- `src/lib/db.ts` — schema migration to add `unsubscribed_at` column (HARDEN-02); review startup migration pattern
- `src/pages/api/signup.ts` §originOk:18-34 — Origin default-deny (HARDEN-03)
- `src/pages/api/confirm.ts` — bad-token redirect remains; pairs with `confirmed.astro` fix
- `src/pages/confirmed.astro:3,11-26,39` — frontmatter searchParams bug + dead-code COPY branches (HARDEN-01); also Plausible script reference
- `src/pages/index.astro:61-78` and `src/pages/pending.astro:28-35` — reference implementations of the inline-script pattern

### New surface to add
- `src/pages/api/unsubscribe.ts` — GET handler (HARDEN-02)
- `src/pages/unsubscribed.astro` — minimalist confirmation page (HARDEN-02)

### Deploy / ops
- `deploy/Caddyfile:24-32` — existing security headers; add CSP here (HARDEN-04)
- `deploy/oddlympics.service` — reference style for the new `oddlympics-backup.service` + `.timer` (HARDEN-05)
- `DEPLOY.md:110,133-136` — manual `sqlite3 .backup` already documented; B2/rclone restore procedure to be added (HARDEN-05)

### Verification
- securityheaders.com — target A grade after CSP enforcement deploy (HARDEN-04 acceptance)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **HMAC token machinery** (`src/lib/token.ts`): `mintToken` / `verifyToken` already use `node:crypto` with `timingSafeEqual`. Extend the payload with a `purpose` claim for the unsubscribe token; no new crypto needed.
- **Inline-script pattern** (`index.astro:61-78`, `pending.astro:28-35`): copy-paste-able pattern for the `confirmed.astro` fix.
- **Custom Origin check** (`signup.ts:18-34`): the structure is right — only the `if (!origin) return true` line needs flipping.
- **Resend wrapper** (`email.ts`): `sendMagicLink` is the template for `sendUnsubscribeReceipt` if needed; more importantly, the existing send call is the place to inject `List-Unsubscribe` headers.
- **systemd hardening unit** (`deploy/oddlympics.service`): clone the `ProtectSystem`, `User`, `Group` shape for `oddlympics-backup.service`.

### Established Patterns
- **Errors via 303 + `?error=<code>`** — keeps pages CDN-cacheable. Apply to `/api/unsubscribe` (e.g., `?status=bad-token`, `?status=ok`, `?status=already`) and the new `/unsubscribed` page reads it client-side.
- **Schema migrations on import** (`db.ts:15-26`): `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE … ADD COLUMN IF NOT EXISTS` (SQLite supports IF NOT EXISTS for ADD COLUMN since 3.35). Append `unsubscribed_at TEXT` the same way.
- **Inline `<style is:global>` per page** — the new `/unsubscribed` page follows this; do not introduce a shared layout in this phase (that's the "4th page lands" trigger from CLAUDE.md, but a security-hardening phase isn't the right time).
- **Security headers in Caddyfile, not Astro** — established convention; CSP joins them.

### Integration Points
- **`src/pages/api/signup.ts:22`** — flip the `Origin` default-deny.
- **`src/pages/api/confirm.ts`** — no change needed; pairs with HARDEN-01 fix on the page side.
- **`src/lib/email.ts:16-40`** — body template gets a footer line + RFC 8058 headers added to the `resend.emails.send` call.
- **`src/lib/db.ts`** — schema migration block; new prepared statement for the unsubscribe UPDATE.
- **`deploy/Caddyfile`** — CSP report-only header → CSP enforcement header.
- **New**: `deploy/oddlympics-backup.service` + `deploy/oddlympics-backup.timer` mirroring the existing service unit; `deploy/bootstrap.sh` extension to install rclone + drop the new units; `/etc/oddlympics-backup.env` for B2 credentials.
- **DEPLOY.md** — documented restore runbook section.

</code_context>

<specifics>
## Specific Ideas

- Backup destination is **Backblaze B2 specifically** (cheapest, real cross-vendor isolation from DO).
- securityheaders.com is the **specific scanner** for HARDEN-04 acceptance — A grade.
- Inline-script pattern from `index.astro:61-78` is the **specific reference implementation** for fixing `confirmed.astro`.
- RFC 8058 `List-Unsubscribe` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers are explicitly required, not optional.
- 30 days daily + 12 weeks weekly is the **specific retention policy**.

</specifics>

<deferred>
## Deferred Ideas

- **DB-tracked token nonce / `used_tokens` table** — discussed as alternative to TTL-only revocation; rejected for v1 (idempotency already exists at the row level), but may be revisited if a real replay attack lands.
- **Hard-delete "forget me" admin path** — Phase 1 is soft delete only; explicit "delete my data" is an admin/v1.x concern.
- **Strict CSP with per-request nonces** (no `'unsafe-inline'`) — rejected for Phase 1 because every page has inline scripts/styles; revisit only if a stricter Mozilla Observatory grade becomes a goal.
- **Mozilla Observatory grade** — not the target scanner; only securityheaders.com A.
- **CSP `report-uri` / `Reporting-Endpoints` collector** — likely unnecessary for 3 static pages; planner may opt in if it's nearly free, otherwise defer.
- **Preflight invalidation of in-flight 7-day tokens** at TTL-cutover — accepted as not-an-issue; existing tokens age out naturally.
- **Shared layout / consolidating duplicated CSS across the three pages** — `CLAUDE.md` already names "4th page lands" as the trigger; the new `/unsubscribed` page makes 4 pages. A future phase (or an opportunistic Phase 1 sub-task if Claude judges it low-risk) handles this. Not a hardening blocker.
- **Rotating Plausible tracker ID into an env var** — listed in CONCERNS.md as MEDIUM but unrelated to the 6 hardening goals; defer.
- **`Content-Type` validation on POST `/api/signup`** — listed in CONCERNS.md as LOW; defer.
- **Failing on missing `EMAIL_FROM` in prod** (CONCERNS.md LOW) — defer.

</deferred>

---

*Phase: 1-pre-launch-hardening*
*Context gathered: 2026-05-08*
