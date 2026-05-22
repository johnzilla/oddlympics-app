---
phase: 13-referral-code-attribution
plan: "04"
subsystem: referral-smoke-ops
tags: [referral, smoke-test, deploy-ops, verification]
dependency_graph:
  requires:
    - referral_code + referred_by columns on vip_signups — Plan 13-01
    - ref-resolution wired into /api/signup — Plan 13-02
  provides:
    - automated proof of REF-01 (unique non-null codes), REF-03 (referred_by attribution), SC4 (bad ref never blocks)
    - Day-2 referral-attribution SQL recipe in DEPLOY.md
  affects:
    - scripts/smoke-signup.mjs (6 new referral cases, extended dbRowFor, REF_IP/SELF_REF_IP constants)
    - DEPLOY.md (new referral-counting SQL recipe section)
tech_stack:
  added: []
  patterns:
    - RFC 5737 TEST-NET-1 distinct IPs to isolate rate-limit slot accounting across smoke case groups
    - heredoc <<SQL block in DEPLOY.md (matches existing Day-2 ops format)
key_files:
  created: []
  modified:
    - scripts/smoke-signup.mjs
    - DEPLOY.md
decisions:
  - "SELF_REF_IP (192.0.2.44) added alongside REF_IP (192.0.2.43) — REF_IP exhausts after 5 valid POSTs (A, B, direct, unknown, malformed); self-ref re-signup requires a 6th slot, so a third RFC 5737 address avoids rate-limiting that case"
  - "Referral recipe placed as a new named subsection + heredoc (not a table one-liner) — the multi-statement SQL form is too long for the table and the <<SQL heredoc pattern matches the existing signal-pull block above it"
metrics:
  duration_seconds: 161
  completed_date: "2026-05-22"
  tasks_completed: 2
  files_created: 0
  files_modified: 2
---

# Phase 13 Plan 04: Smoke Extension + DEPLOY.md Recipe Summary

**One-liner:** Extended `scripts/smoke-signup.mjs` with six referral cases on RFC 5737 IPs proving SC1/SC3/SC4 (14 total, 14 PASS), plus a `DEPLOY.md` Day-2 referral-attribution SQL recipe grouping signups by `referred_by` with percentage computation.

## Tasks Completed

| # | Name | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Extend smoke-signup.mjs with referral cases | 28645cb | scripts/smoke-signup.mjs |
| 2 | Add referral-counting SQL recipe to DEPLOY.md Day-2 ops | 5de46d8 | DEPLOY.md |

## What Was Built

**`scripts/smoke-signup.mjs` additions:**

- `const REF_IP = '192.0.2.43'` — RFC 5737 address for referral POST cases; isolates from SMOKE_IP rate-limit slots
- `const SELF_REF_IP = '192.0.2.44'` — RFC 5737 address for REF-self-ref only; REF_IP exhausts at 5 valid POSTs
- `dbRowFor` extended: `SELECT email, team, timezone, requested_sport, referral_code, referred_by`
- Six new `runCase` blocks inserted before `case-7-rate-limit`:
  - `REF-valid-ref`: signs up A (England/Europe/London), reads `codeA`, signs up B with `ref=codeA` → asserts `B.referred_by === codeA` and `codeA` matches `/^[a-z0-9]{8}$/`
  - `REF-direct-no-ref`: signup with no `ref` → `referred_by === null`
  - `REF-unknown-ref`: signup with `ref=zzzzzzzz` (not in DB) → 303 + `/pending?email=` + `referred_by === null` (SC4)
  - `REF-malformed-ref`: signup with `ref=!!bad!!` (bad charset) → 303 + `/pending?email=` + `referred_by === null` (SC4)
  - `REF-self-ref`: re-signup emailA with `ref=codeA` → `referred_by === null` (D-08; uses SELF_REF_IP)
  - `REF-code-uniqueness`: all rows in `vip_signups` — referral_code non-null + `new Set(codes).size === codes.length` (SC1)
- `case-7-rate-limit` comment updated to document REF_IP/SELF_REF_IP slot isolation

**`DEPLOY.md` additions:**

- Table row in Day-2 ops table pointing to new referral recipe section
- `### Referral-counting SQL recipe (Phase 13)` subsection with description + `<<SQL` heredoc:
  ```sql
  SELECT COALESCE(referred_by, "(direct)") AS referrer,
         COUNT(*) AS signups,
         ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM vip_signups WHERE confirmed_at IS NOT NULL), 1) AS pct
  FROM vip_signups
  WHERE confirmed_at IS NOT NULL AND unsubscribed_at IS NULL
  GROUP BY referred_by
  ORDER BY signups DESC;
  ```
  Points at `/var/lib/oddlympics/oddlympics.db` (production path).

## Verification Results

Full smoke run after Task 1 commit (built server + `node scripts/smoke-signup.mjs`):

```
[smoke] result: pass=14 fail=0
```

All 14 cases PASS:
- 8 existing cases (AC2, case-1-valid through case-7-rate-limit): all PASS
- 6 new referral cases: REF-valid-ref, REF-direct-no-ref, REF-unknown-ref, REF-malformed-ref, REF-self-ref, REF-code-uniqueness — all PASS
- `case-7-rate-limit` still PASS (SMOKE_IP slot accounting undisturbed)

`grep -c "referred_by" DEPLOY.md` → 3

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added SELF_REF_IP (192.0.2.44) to prevent rate-limit on REF-self-ref**
- **Found during:** Task 1 smoke run (first attempt)
- **Issue:** The plan specified using `REF_IP` for the self-ref case, but `REF_IP` accumulates 5 valid POSTs from the preceding referral cases (A, B, direct, unknown, malformed) — exhausting its rate-limit slots. The self-ref re-signup (6th POST from REF_IP) was hitting `/?error=rate-limited` and failing.
- **Fix:** Added `const SELF_REF_IP = '192.0.2.44'` (another RFC 5737 TEST-NET-1 address) and used it only for the REF-self-ref case. Updated the case-7 comment and REF-self-ref comment to document the slot-accounting rationale.
- **Files modified:** `scripts/smoke-signup.mjs`
- **Commit:** 28645cb (included in Task 1 commit)

## Threat Surface Scan

No new network endpoints, auth paths, or trust boundary changes. The smoke script is a read-only test driver; `DEPLOY.md` additions are documentation. No new public surface introduced.

## Known Stubs

None — all referral cases assert concrete observable DB state and HTTP outcomes. The recipe SQL is production-ready (no placeholder values).

## Self-Check

- [x] `scripts/smoke-signup.mjs` contains `const REF_IP = '192.0.2.43'`: confirmed
- [x] `scripts/smoke-signup.mjs` contains `const SELF_REF_IP = '192.0.2.44'`: confirmed
- [x] `dbRowFor` SELECT includes `referral_code, referred_by`: confirmed
- [x] Six `runCase(` calls with names REF-valid-ref, REF-direct-no-ref, REF-unknown-ref, REF-malformed-ref, REF-self-ref, REF-code-uniqueness: confirmed
- [x] All referral POST cases use REF_IP or SELF_REF_IP (none uses SMOKE_IP): confirmed
- [x] `DEPLOY.md` contains `referred_by` and `COALESCE(referred_by, "(direct)")`: confirmed
- [x] `DEPLOY.md` recipe points at `/var/lib/oddlympics/oddlympics.db`: confirmed
- [x] Full smoke: 14 PASS, 0 FAIL, exit 0: confirmed
- [x] Commits 28645cb, 5de46d8 exist in git log: confirmed

## Self-Check: PASSED
