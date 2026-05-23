---
phase: 15-personalized-open-graph
plan: 05
status: complete
completed: 2026-05-23
---

# Plan 15-05 Summary — Add SHARE-r-* smoke cases

## What was built

Extended `scripts/smoke-signup.mjs` with two new runtime-side cases that
exercise the resolved-code and unresolved-code branches of `/r/[code].astro`
(Plan 15-01) against a live dev server. This is the runtime half (D-12b) of
Phase 15's two-way verification contract — the render-time half (D-12a) lives
in the `npm run og:render-teams` 6-check block from Plan 15-02.

## Tasks completed

| # | Task | Status |
|---|------|--------|
| 1 | Append SHARE-r-known and SHARE-r-unknown cases | ✓ |

## Key files modified

- `scripts/smoke-signup.mjs` — appended two new `runCase(...)` blocks
  between `SHARE-confirm-redirect-location` (ends ~line 568) and
  `case-7-rate-limit` (now starts ~line 633). 61 net lines added.

## Verification

**Static:**
- `node --check scripts/smoke-signup.mjs` exits 0
- `grep -c "SHARE-r-known"` → `2`; `grep -c "SHARE-r-unknown"` → `2`
- `grep -c "/r/notarealcode"` → `2`
- `grep -c "SELECT referral_code, team FROM vip_signups"` → `1` (DB lookup
  for known-code case; line 308's REF-valid-ref already had the analog
  pattern)
- `grep -c "case-7-rate-limit"` → `1` (existing case still in place)

**Live smoke (against `npm run dev` + DB seeded with England signup):**
```
[smoke] PASS SHARE-r-known (D-12b: personalized og:image + og:title)
[smoke] PASS SHARE-r-unknown (D-12b + D-02: 200 + generic og:image + no team title)
[smoke] result: pass=19 fail=0
```

Exit 0. Phase 14's 17 cases continue to PASS — no regression.

## Case 1 — SHARE-r-known
Reads one real `{referral_code, team}` row via the existing better-sqlite3
read-only connection, fetches `${BASE}/r/${row.referral_code}` with
`redirect: 'manual'`, and asserts:
- `res.status === 200`
- response body contains `og:image" content="` AND either `/og/<team>.png`
  (per-team) OR `/og-image.png` (D-10 trim fallback)
- response body matches `/og:title" content="Following [^"]+ · oddlympics"/`

Returns `false` (FAIL with actionable message) if the DB has no
team-assigned rows — does NOT skip silently (T-15-21 mitigation).

## Case 2 — SHARE-r-unknown
Fetches `${BASE}/r/notarealcode` with `redirect: 'manual'` and asserts:
- `res.status === 200` (never 404 per D-02)
- response body contains the generic absolute `og:image` URL
- response body does NOT contain a `Following`-prefixed `og:title`

This locks in the unresolved-branch contract: stale-link UX preserved, no
404 on unknown codes, no accidental personalization.

## Commits

- `<this commit>`: test(15-05): add SHARE-r-known and SHARE-r-unknown smoke cases

## Deviations

None. The cases match the planned skeleton; the live smoke went green on
first run (no debug iterations needed).

## Self-Check: PASSED

All success criteria met:
- ✓ Two new SHARE-r-* cases in `scripts/smoke-signup.mjs`
- ✓ Live smoke 19/19 PASS, exit 0
- ✓ No regression on existing 17 Phase 14 cases
- ✓ SC2 (route emits per-team OG meta) and SC3 (response would unfurl on a
  social validator) proved end-to-end at the response-body level
- ✓ T-15-19..T-15-22 mitigations/acceptances documented
