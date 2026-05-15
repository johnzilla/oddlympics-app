---
phase: 09-manage-editor-unsubscribe
plan: "05"
subsystem: smoke/verification
tags:
  - smoke
  - verification
  - manage-01
  - manage-02
  - compat-01
  - sc1
  - sc2
  - sc3
  - sc4
dependency_graph:
  requires:
    - 09-01  # TTL_BY_PURPOSE for 1y token mint
    - 09-02  # markConfirmed D-07 widening, sendManageLink URL change
    - 09-03  # /schedule thin 301 redirect handler
    - 09-04  # manage.astro editor + save-selection endpoint changes
  provides:
    - E2E proof that ROADMAP SC1-SC4 hold
    - npm run smoke:manage (exit 0 = all M1-M9 PASS)
  affects: []
tech_stack:
  added: []
  patterns:
    - inline node:crypto HMAC re-implementation for token signing in smoke scripts
    - dual DB handles (read-only + writable) for isolated assertion + mutation
key_files:
  created:
    - scripts/smoke-manage.mjs
  modified:
    - package.json
decisions:
  - "Inline node:crypto mintToken re-implementation chosen over TS import to avoid build-step friction and isolate smoke from TS-only language features"
  - "M6 subhead check uses &#39; HTML entity fallback because Astro SSR HTML-encodes apostrophes"
  - "M7b counted as a separate case from M7 — total case count is 10 (pass=10 fail=0)"
metrics:
  duration: 3m
  completed: "2026-05-15"
  tasks: 2
  files: 2
---

# Phase 9 Plan 05: Smoke Verification Script Summary

**One-liner:** 10-case end-to-end smoke covering MANAGE-01, MANAGE-02, COMPAT-01, and all four ROADMAP SCs via inline node:crypto token minting + direct SQLite handle.

## Case Map

| Case | Name | SCs/Decisions | What it verifies |
|------|------|---------------|-----------------|
| M1 | `M1-signed-out-form` | MANAGE-01 | GET /manage (no auth) → 200, body has `action="/api/manage"` |
| M2 | `M2-url-token-editor` | SC1 / MANAGE-01 | GET /manage?token= → 200, Set-Cookie, body has editor + team select |
| M3 | `M3-save-valid` | SC1 / MANAGE-01 | POST /api/save-selection valid slug+tz → 303 /manage?status=saved, DB updated |
| M4 | `M4-save-bad-team` | D-02 / MANAGE-01 | POST with fake_slug → 303 /manage?status=bad-team, DB unchanged |
| M5 | `M5-save-bad-tz` | MANAGE-01 | POST with Foo/Bar tz → 303 /manage?status=bad-tz, DB unchanged |
| M6 | `M6-banner-team-null` | SC2 / COMPAT-01 | GET /manage (team=NULL session) → banner "Pick a team" + subhead visible |
| M7 | `M7-schedule-redirect` | D-01 | GET /schedule → 301, Location: /manage |
| M7b | `M7b-schedule-redirect-with-token` | D-01 | GET /schedule?token=abc123 → 301, Location: /manage?token=abc123 |
| M8 | `M8-unsub-1y-token-and-single-use` | SC3 / MANAGE-02 / D-06 | 1y token TTL assertion + first click → ok, second click → already |
| M9 | `M9-resubscribe-path` | SC4 / D-07 | DB-only: mark unsubscribed → markConfirmed → unsubscribed_at=NULL, confirmed_at updated |

## Full Run Output

```
[smoke] target: http://localhost:4321
[smoke] db:     /Users/john/Desktop/vault/projects/github.com/oddlympics-app/data/oddlympics.db
[smoke] PASS M1-signed-out-form
[smoke] PASS M2-url-token-editor
[smoke] PASS M3-save-valid
[smoke] PASS M4-save-bad-team
[smoke] PASS M5-save-bad-tz
[smoke] PASS M6-banner-team-null
[smoke] PASS M7-schedule-redirect
[smoke] PASS M7b-schedule-redirect-with-token
[smoke] PASS M8-unsub-1y-token-and-single-use
[smoke] PASS M9-resubscribe-path
[smoke] result: pass=10 fail=0
```

Exit 0. `npm run smoke:manage` works as expected.

## Cleanup SQL

```sql
DELETE FROM vip_signups WHERE email LIKE 'smoke-%@example.com';
```

This single command cleans up rows from all three smoke suites (smoke-signup.mjs, smoke-landing.mjs, smoke-manage.mjs).

## Phase 9 Closure Summary

All five plans (09-01 through 09-05) have shipped on main. Each must_have truth from the phase has at least one smoke case backing it:

| Must-have truth | Backed by |
|-----------------|-----------|
| Signed-in /manage shows editor with current team/tz pre-filled | M2 |
| POST /api/save-selection valid slug+tz roundtrips to /manage?status=saved | M3 |
| Bad slug → /manage?status=bad-team, DB unchanged | M4 |
| Bad tz → /manage?status=bad-tz, DB unchanged | M5 |
| team=NULL row shows "Pick a team" banner | M6 |
| /schedule → 301 → /manage (and ?token= preserved) | M7, M7b |
| 1-year unsubscribe token TTL + single-use semantics | M8 |
| Re-subscribe DB path (markConfirmed D-07 widening) | M9 |

MANAGE-01 is evidenced by M2 + M3 + M4 + M5.
MANAGE-02 is evidenced by M8.
COMPAT-01 is evidenced by M6.
All four ROADMAP SCs (SC1–SC4) have direct evidence.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] M6 banner subhead HTML entity mismatch**

- **Found during:** Task 1, first smoke run
- **Issue:** The plan specified asserting `"You're signed up"` but Astro's SSR HTML-encodes the apostrophe as `&#39;`, so the body contains `You&#39;re signed up.` rather than the literal apostrophe form.
- **Fix:** Updated the M6 assertion to check for both `You&#39;re signed up` (HTML-encoded, what Astro emits) and `You're signed up` (literal fallback for environments that decode before returning).
- **Files modified:** `scripts/smoke-manage.mjs`
- **Commit:** incorporated into `7a28cd7` (no separate fix commit needed — caught before Task 1 commit)

## Known Stubs

None. The script has no placeholder logic; all 10 cases drive real HTTP or real DB operations.

## Threat Flags

None. This plan adds only a local test script and a package.json alias — no new network endpoints, auth paths, or schema changes.

## Self-Check: PASSED

Files created/modified:
- FOUND: `scripts/smoke-manage.mjs`
- FOUND: `package.json`

Commits:
- FOUND: `7a28cd7` (feat(09-05): add smoke-manage.mjs with M1-M9 end-to-end cases)
- FOUND: `15ca2a0` (chore(09-05): add smoke:manage npm script alias)
