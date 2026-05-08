# Phase 1: Pre-launch Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-08
**Phase:** 1-pre-launch-hardening
**Areas discussed:** Token revocation, Unsubscribe data model, Backup destination, CSP rollout

---

## Token revocation (HARDEN-06)

### Q1: How should magic-link tokens be revoked after first use?

| Option | Description | Selected |
|--------|-------------|----------|
| TTL drop only (7d → 24h) | One-line change to TTL_SECONDS in token.ts. No schema change. Replay window shrinks 7x. Idempotency at the row level (confirmed_at IS NULL) already prevents double-confirm. | ✓ |
| DB-tracked nonce, single-use | Add token_nonce column or used_tokens table; mint includes a jti; verify rejects on second use. Tighter but adds schema migration + DB write per click. | |
| Both — short TTL AND nonce | Belt-and-suspenders. Best security posture; most code change in this phase. | |

**User's choice:** TTL drop only.
**Notes:** Recommended option chosen. Aligns with "minimal additive change" constraint.

### Q2: Magic-link TTL of 24 hours — keep it there, or shorter?

| Option | Description | Selected |
|--------|-------------|----------|
| 24 hours | Matches REQUIREMENTS.md spec (≤ 24h). Comfortable for users who don't check email immediately. | ✓ |
| 1 hour | Aggressive. Best for security-sensitive operations. May frustrate users who don't check email promptly. | |
| 4 hours | Middle ground. Most users confirm within minutes; 4h covers a work-day-with-meetings gap. | |

**User's choice:** 24 hours.

### Q3: When a user clicks an expired/bad token, what should /confirmed?status=bad-token do beyond showing copy?

| Option | Description | Selected |
|--------|-------------|----------|
| Show copy + 're-request' CTA back to / | Add a 'Re-send confirmation →' link to the home page so the user can re-enter their email. Lowest-friction recovery. | ✓ |
| Show copy only — user retypes URL or revisits | Bare error message, no CTA. Matches current minimalism. Slightly worse for legitimate-but-late confirmers. | |
| Auto-redirect to / after 3s | Aggressive. Could feel jarring. Probably overkill. | |

**User's choice:** Show copy + 're-request' CTA back to /.

---

## Unsubscribe data model (HARDEN-02)

### Q1: When a user clicks unsubscribe, what happens to their row in vip_signups?

| Option | Description | Selected |
|--------|-------------|----------|
| Soft: set unsubscribed_at column | Add `unsubscribed_at TEXT` column. Notification queries filter `WHERE unsubscribed_at IS NULL`. Preserves Plausible/conversion data; prevents accidental re-signup loops. | ✓ |
| Hard: DELETE the row | GDPR-cleanest — row is gone. But: Plausible referrer attribution lost; no audit trail. | |
| Soft now, add 'forget me' (hard delete) endpoint as well | Most thorough. Soft is the default; a separate explicit 'delete my data' link does hard delete. More surface for v1. | |

**User's choice:** Soft via unsubscribed_at.

### Q2: How should the unsubscribe link in emails be authenticated?

| Option | Description | Selected |
|--------|-------------|----------|
| Signed unsubscribe token in URL, one-click GET | Reuse mintToken pattern with a different purpose claim. GET /api/unsubscribe?token=... → set unsubscribed_at → redirect. | ✓ |
| Plain email-in-URL, public endpoint | Anyone with the URL can unsubscribe anyone. Bad. Skip. | |
| Magic-link login → page with unsubscribe button | Higher friction. Conflicts with one-click unsubscribe expectations. | |

**User's choice:** Signed unsubscribe token, one-click GET.

### Q3: Which emails need the unsubscribe link in Phase 1?

| Option | Description | Selected |
|--------|-------------|----------|
| All non-confirmation emails | Confirmation email is transactional under CAN-SPAM. Every other email gets the link. | ✓ |
| All emails, including the double-opt-in confirm | More conservative — unsub on the confirm email too. Slightly weird UX. | |
| Only the launch announcement | Narrower. Risks Phase 3 notification work re-litigating. | |

**User's choice:** All non-confirmation emails.

### Q4: Should Phase 1 also add the RFC 8058 List-Unsubscribe + List-Unsubscribe-Post headers?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — add both headers | Resend supports custom headers. Enables Gmail/Apple Mail's native unsubscribe button. Meets Gmail's 2024 bulk-sender requirements. | ✓ |
| Only the URL link in the body — skip headers | Functional but loses the native client integration. May affect deliverability once volume scales. | |
| Defer to Phase 3 when notifications start | Adding it now is essentially free — same code path. | |

**User's choice:** Yes — both headers.

---

## Backup destination (HARDEN-05)

### Q1: Where should the daily SQLite backup land?

| Option | Description | Selected |
|--------|-------------|----------|
| Backblaze B2 | Cheapest object storage (~$0.005/GB/mo), S3-compatible, rclone first-class. Different cloud than DigitalOcean = real off-droplet redundancy. | ✓ |
| DigitalOcean Spaces | Same vendor as the droplet. Convenient but couples blast radius. $5/mo minimum. | |
| AWS S3 | Enterprise default. More expensive, more setup, more knobs. Overkill. | |
| Dreamhost storage / DreamObjects | Existing account. S3-compatible. | |

**User's choice:** Backblaze B2.

### Q2: How should the backup job be scheduled?

| Option | Description | Selected |
|--------|-------------|----------|
| systemd timer running as oddlympics user | Drop a oddlympics-backup.service + .timer next to existing oddlympics.service. Logs to journalctl alongside the app. | ✓ |
| Crontab entry under deploy or root user | Classic cron. Simple, one line. Less observable. | |
| GitHub Actions scheduled workflow | Wider blast radius. Skip. | |

**User's choice:** systemd timer.

### Q3: What backup retention policy do you want?

| Option | Description | Selected |
|--------|-------------|----------|
| Daily for 30 days, weekly for 12 weeks | ~42 snapshots, well under 1GB total. Covers 'oh shit deleted yesterday' and 'something broke 2 months ago'. | ✓ |
| Daily for 7 days only | Bare minimum. Cheapest. Risk: corruption goes unnoticed >7 days. | |
| Daily forever (rely on B2 lifecycle) | Cheap for tiny SQLite. Simplest cron. No prune logic. | |

**User's choice:** Daily 30d + weekly 12w.

### Q4: Should Phase 1 include a documented + tested restore procedure, or just the backup half?

| Option | Description | Selected |
|--------|-------------|----------|
| Both — backup + documented + actually-tested restore | HARDEN-05 explicitly says 'restore procedure is documented and tested'. Includes a runbook entry in DEPLOY.md. | ✓ |
| Backup + documentation only, restore tested manually post-launch | Faster but risks an untested restore being broken. Violates HARDEN-05's 'tested' clause. | |
| Backup only, restore TBD | Doesn't meet HARDEN-05. | |

**User's choice:** Both — restore documented and tested in-phase.

---

## CSP rollout (HARDEN-04)

### Q1: How should the Content-Security-Policy be rolled out?

| Option | Description | Selected |
|--------|-------------|----------|
| Report-only first (1–2 days), then enforce | Add `Content-Security-Policy-Report-Only` header in Caddy, watch for violations on real traffic, then flip to enforcement. | ✓ |
| Enforce immediately | Cleaner, one PR. Risk: silently breaking on a browser/edge case. | |
| Report-only forever, no enforcement | Defeats the purpose. | |

**User's choice:** Report-only → enforce.

### Q2: What should the actual CSP directive set look like?

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal allow-list | default-src 'self'; script-src 'self' 'unsafe-inline' https://plausible.io; img-src 'self' data:; style-src 'self' 'unsafe-inline'; connect-src 'self' https://plausible.io; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'. | ✓ |
| Strict with nonces (no 'unsafe-inline') | Generate per-request nonce in Caddy. Higher engineering cost; conflicts with inline-script design. | |
| You draft it — I'll review | Defer to planner/researcher. | |

**User's choice:** Minimal allow-list.

### Q3: Where does the CSP header live — Caddy or the Astro app?

| Option | Description | Selected |
|--------|-------------|----------|
| Caddy (deploy/Caddyfile) | Existing security headers already live in Caddyfile:24-32. CSP belongs with them. | ✓ |
| Astro middleware (src/middleware.ts) | Per-route control. Couples policy to app code. | |
| Both — Caddy default + Astro per-route override | Overkill for three nearly-identical pages. | |

**User's choice:** Caddy.

### Q4: Does HARDEN-04 mean a specific scanner you want the plan to target?

| Option | Description | Selected |
|--------|-------------|----------|
| securityheaders.com — target an A grade | De-facto standard. Free. | ✓ |
| Mozilla Observatory — target B+ or A | Stricter scoring; penalizes 'unsafe-inline'. Would push toward nonce-based CSP. | |
| Either — you pick whichever is more convenient | Researcher/planner decides. | |

**User's choice:** securityheaders.com — A grade.

---

## Claude's Discretion

- Naming of new env vars (`B2_*`, `RCLONE_*`).
- Exact systemd timer cadence (e.g., daily UTC time to avoid traffic peaks).
- Precise `/unsubscribed` page copy.
- Whether to consolidate the duplicated-across-three-pages CSS into a shared layout component as part of HARDEN-01 (low-risk opportunistic refactor) — researcher/planner picks. CLAUDE.md's "4th page lands" trigger fires when `/unsubscribed` is added, so it's a defensible moment.
- Whether to set up a CSP `report-uri` / `Reporting-Endpoints` collector during the report-only window or rely on browser console + manual page-load testing.

## Deferred Ideas

- DB-tracked token nonce / `used_tokens` table.
- Hard-delete "forget me" admin path (Phase 1 is soft delete only).
- Strict CSP with per-request nonces (no `'unsafe-inline'`).
- Mozilla Observatory grade target.
- CSP `report-uri` / `Reporting-Endpoints` collector beyond planner discretion.
- Preflight invalidation of in-flight 7-day tokens at TTL-cutover.
- Shared layout / consolidating duplicated CSS across pages.
- Rotating Plausible tracker ID into an env var (CONCERNS.md MEDIUM).
- `Content-Type` validation on POST `/api/signup` (CONCERNS.md LOW).
- Failing on missing `EMAIL_FROM` in prod (CONCERNS.md LOW).
