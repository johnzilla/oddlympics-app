---
phase: 15-personalized-open-graph
plan: "01"
subsystem: routing
tags: [og, referral, server-rendered, route, db]
dependency_graph:
  requires:
    - 13-referral-code-attribution (lookupByReferralCode pattern, referral code shape [a-z0-9]{8})
    - 14-share-experience (Layout.astro og prop shape, define:vars bounce pattern)
  provides:
    - src/pages/r/[code].astro — server-rendered referral route with per-team OG meta
    - lookupTeamByReferralCode prepared statement — single DB SELECT for team slug resolution
  affects:
    - src/lib/db.ts (additive export)
    - Any plan consuming /r/CODE URLs (15-02 migration, 15-03 PNGs)
tech_stack:
  added: []
  patterns:
    - Nested dynamic Astro route (first in codebase): src/pages/r/[code].astro
    - existsSync + fileURLToPath(import.meta.url) + resolve() for trim-fallback path resolution
    - define:vars for safe bounceUrl injection into inline script
key_files:
  created:
    - src/pages/r/[code].astro
  modified:
    - src/lib/db.ts
decisions:
  - lookupTeamByReferralCode uses narrowed SELECT (referral_code, team) — no email/status leak to unauthenticated route (D-03)
  - Code-shape gate /^[a-z0-9]{8}$/ runs before any DB lookup or HTML echo — T-15-01 XSS mitigation
  - Trim fallback: missing per-team PNG -> og:image uses /og-image.png but title still personalizes (D-10)
  - No analytics on /r/CODE — page is sub-50ms transit, not a content page (Discretion area)
  - repoRoot resolved via fileURLToPath(import.meta.url) + 4 levels up — never process.cwd() (wrong under systemd)
metrics:
  duration: 198s
  completed: "2026-05-23T16:09:34Z"
  tasks_completed: 2
  files_modified: 2
---

# Phase 15 Plan 01: Referral Route + DB Statement Summary

Server-rendered `/r/[code].astro` route with per-team OG meta via new `lookupTeamByReferralCode` DB statement — bot scraping surface for Phase 15 personalized Open Graph unfurls.

## What Was Built

**Task 1 — `lookupTeamByReferralCode` prepared statement (commit 6d69b28):**
Added a new export to `src/lib/db.ts` immediately after the existing `lookupByReferralCode` (Phase 13, untouched). The new statement returns `{ referral_code, team }` only — narrowed to avoid leaking email or subscription status to the unauthenticated `/r/CODE` route (D-03). Single SELECT, no schema change, additive export.

**Task 2 — `src/pages/r/[code].astro` server-rendered route (commit e3d399d):**
First nested dynamic route in the codebase. Key behaviors:
- Code-shape gate `/^[a-z0-9]{8}$/` validates `Astro.params.code` before any DB call or HTML echo (T-15-01 XSS + open-redirect mitigation)
- Resolved branch: personalizes `og:title = 'Following <Team> · oddlympics'` and `og:image = ${SITE_URL}/og/<slug>.png` with trim-fallback to `/og-image.png` when per-team PNG is absent (D-10)
- Unresolved branch: generic OG meta, bounce to `/` — always HTTP 200, never 404 (D-02)
- Bounce mechanism: `<meta http-equiv="refresh">` in Layout's `<slot name="head" />` + `try { location.replace(bounceUrl); } catch {}` via `define:vars` (D-15)
- `noindex`, no analytics, no auth, no DB writes — status-agnostic redirect intermediary
- `repoRoot` resolved via `fileURLToPath(import.meta.url)` + 4 directory levels up (not `process.cwd()` which is `/var/lib/oddlympics` under systemd)

## Smoke Results

Both branches verified against live dev server:

| Check | Result |
|-------|--------|
| GET /r/notarealcode → HTTP 200 | PASS |
| /r/notarealcode og:image = generic /og-image.png | PASS |
| /r/notarealcode has no "Following" prefix | PASS |
| /r/notarealcode has meta http-equiv=refresh | PASS |
| GET /r/ab12cd34 (seeded: england) → HTTP 200 | PASS |
| /r/ab12cd34 og:title = "Following England · oddlympics" | PASS |
| /r/ab12cd34 og:image = generic fallback (no england.png yet — D-10 trim) | PASS |
| XSS: /r/ABC"<script>alert(1)</script> → generic response, no injected script | PASS |
| npm run build exits 0 | PASS |

## Deviations from Plan

None — plan executed exactly as written.

The `npx astro check` reports 25 errors, but all are pre-existing (present in `db.ts`, `token.ts`, `email.ts`, `session.ts`, `manage.astro` before this plan) — the same `node:` module type declaration warnings that exist across the codebase. The new file's errors follow the identical pattern as `manage.astro:69` (`process`) and other established files. `npm run build` exits 0.

## Known Stubs

None — no PNGs exist yet (`public/og/` empty), so the trim-fallback fires universally until Plan 15-03 commits the 48 team PNGs. This is intentional and documented in D-10. The route functions correctly in both cases; plan goal (bot-scraping surface for OG meta) is achieved.

## Threat Surface Scan

All T-15-01..T-15-05 mitigations verifiably in place:
- T-15-01 (XSS): code-shape gate + Astro auto-escape on `href={bounceUrl}` + `define:vars` JSON-encoding — three independent layers
- T-15-02 (path traversal): same shape gate; `row.team` comes from DB allow-list, not from user-supplied code
- T-15-03 (open redirect): bounceUrl constructed from hardcoded template, never from user input
- T-15-05 (info disclosure): `lookupTeamByReferralCode` returns only `{referral_code, team}` — no email, no confirmed_at, no unsubscribed_at

T-15-04 (DoS) and T-15-06 (code enumeration) documented as accepted per plan threat register.

No new security surface introduced beyond what the plan's threat model already covers.

## Self-Check: PASSED

- `src/lib/db.ts` exports `lookupTeamByReferralCode`: FOUND
- `src/pages/r/[code].astro` exists: FOUND (74 lines, exceeds 60-line minimum)
- Commit 6d69b28 (Task 1) exists: FOUND
- Commit e3d399d (Task 2) exists: FOUND
