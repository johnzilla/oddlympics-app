---
phase: 05-schema-signup-payload
plan: 06
subsystem: testing
tags: [smoke, fetch, http, signup, verification, ac2, ac9, ac12]

requires:
  - phase: 05-04
    provides: widened /api/signup with team + timezone validation
  - phase: 05-05
    provides: downstream consumer rewrites (so build is clean)
provides:
  - scripts/smoke-signup.mjs — 8-case end-to-end verification against a running server
  - AC2 (backend portion), AC9, AC12 evidence for Phase 5 VERIFICATION.md
affects: [verification of phase 05; future phases can wire this into CI when one exists]

tech-stack:
  added: []
  patterns:
    - "Smoke-as-script: single .mjs, hits a real running server, uses better-sqlite3 readonly for side-effect assertions, no test framework. Mirrors scripts/backfill-team-slugs.mjs, scripts/backup-pre-05.mjs, scripts/launch-blast.mjs."
    - "Clean exit-code discipline (0/1/2) so the script chains into a CI gate or a deploy preflight when one materializes"

key-files:
  created:
    - scripts/smoke-signup.mjs
    - .planning/phases/05-schema-signup-payload/05-06-SUMMARY.md
  modified: []

key-decisions:
  - "Used the in-built fetch + redirect: 'manual' to surface 303 Location headers directly. No axios/node-fetch dependency — Node 22 ships fetch as a built-in."
  - "Probe /  for server reachability BEFORE attempting any case so unreachable-server exits 2 (setup error), not 1 (test failure). Distinguishes 'red light' from 'red light cable unplugged.'"
  - "Used RFC 5737 TEST-NET-1 IP 192.0.2.42 in X-Forwarded-For so the rate-limit key is shared across cases and case 7 reliably triggers after the prior valid cases consumed 3 of 5 IP slots."
  - "Did NOT delete smoke rows post-run. The script's tail log lines suggest a manual sqlite3 cleanup command. Leaving rows in the dev DB across runs is harmless (each run uses Date.now()-suffixed emails)."

patterns-established:
  - "Side-effect assertion via readonly better-sqlite3 — cheap, no race with the server (the server's writes flush before fetch returns)"
  - "Test-IP via X-Forwarded-For — lets the smoke script control rate-limit scoping without a separate listener"

requirements-completed:
  - SIGNUP-01
  - SIGNUP-02
  - SIGNUP-03
  - COMPAT-01
  - COMPAT-02

duration: ~15min (orchestrator-inline)
completed: 2026-05-13
---

# Phase 05 Plan 06: Smoke Verification Summary

**One-shot fetch-based smoke proves Phase 5's signup contract end-to-end: 8/8 PASS, exit 0.**

## Performance

- **Duration:** ~15min
- **Started:** 2026-05-13T09:13Z (after 05-05 merge)
- **Completed:** 2026-05-13T16:31Z
- **Tasks:** 1
- **Files modified:** 1 (new)

## Accomplishments

- 8 cases (1 static + 7 HTTP) all PASS against the freshly-built server
- AC2 / AC9 / AC12 evidence tags surface inline in the smoke output for the verifier
- Persisted-row assertions confirm `team` + `tz` + `requested_sport='world_cup'` defaults flow through
- TZ fallback path explicitly verified — both empty and invalid `timezone=Foo/Bar` collapse to `America/New_York`
- Rate limit triggers on the 6th SMOKE_IP attempt (5 prior valid cases consumed 3 slots; case 7 fires 4 more, last is `?error=rate-limited`)
- Exit code 2 on unreachable server verified separately

## Task Commits

1. **Task 1: scripts/smoke-signup.mjs** — see `git log --oneline --grep='feat(05-06): add scripts/smoke-signup'`

## Files Created/Modified

- `scripts/smoke-signup.mjs` (new, 320 lines) — module-load constants, helpers (`post`, `dbHasEmail`, `dbRowFor`, `runCase`), 8 cases, summary

## Verification evidence (smoke output)

```
[smoke] target: http://127.0.0.1:4321
[smoke] db:     /tmp/oddlympics-smoke.db
[smoke] PASS AC2-teams-json (48 entries, FORM-02 slugs verified)
[smoke] PASS case-1-valid (team=england, tz=Europe/London)
[smoke] PASS case-2-missing-team (team="")
[smoke] PASS AC9-invalid-team (team=fake_team)
[smoke] PASS case-4-missing-tz (tz="")
[smoke] PASS case-5-invalid-tz (tz=Foo/Bar)
[smoke] PASS AC12-honeypot (website=evil-bot)
[smoke] PASS case-7-rate-limit (>5 from same IP)
[smoke] result: pass=8 fail=0
```

### Server log evidence (selected `[signup]` lines)

```
[signup] bad-team rejected email=smoke-miss-team-...  input=""
[signup] bad-team rejected email=smoke-bad-team-...   input="fake_team"
[signup] tz-fallback   email=smoke-miss-tz-...        input=""
[signup] tz-fallback   email=smoke-bad-tz-...         input="Foo/Bar"
```

### Persisted-row evidence

```
{"email":"smoke-valid-...@example.com",   "team":"england", "timezone":"Europe/London"}
{"email":"smoke-miss-tz-...@example.com", "team":"brazil",  "timezone":"America/New_York"}
{"email":"smoke-bad-tz-...@example.com",  "team":"france",  "timezone":"America/New_York"}
```

(cases 2, 3, 6 wrote no row — by design)

## Per-AC explicit evidence

| AC   | Evidence | Smoke line |
|------|----------|-----------|
| AC2 (backend portion) | references/teams.json has 48 entries + all 10 FORM-02 explicit slugs | `[smoke] PASS AC2-teams-json (48 entries, FORM-02 slugs verified)` |
| AC9 | Invalid team → 303 `/?error=bad-form` + no row | `[smoke] PASS AC9-invalid-team (team=fake_team)` |
| AC12 | Honeypot → 303 `/pending` + no row | `[smoke] PASS AC12-honeypot (website=evil-bot)` |

## Out of scope for Phase 5

- **AC3** (Playwright in three locales — Detroit / London / Lagos): Phase 6's job, per D-07. Requires a real browser harness; out of scope for backend smoke.
- **AC11** (Plausible `Signup Submit` event firing with `team` prop): Phase 6 owns the analytics wiring + verification.

## Deviations from Plan

None on substance. Orchestrator-inline execution pattern as 05-03/04/05 (sandbox-avoidance).

## Issues Encountered

- First smoke attempt against a fresh dev server failed: `cannot open DB at /tmp/oddlympics-smoke.db — unable to open database file`. Cause: `src/lib/db.ts` is lazy-loaded only on first server-rendered request, so the temp DB doesn't exist until the server handles an actual request. Fix in the orchestration: hit `/api/signup` once with junk before running the smoke (the warmup call gets rejected with `bad-team` since it has no team, but it triggers db.ts module load). For operator ergonomics: the smoke script does NOT add this warmup itself — the operator running it against a long-lived server (npm run dev kept open) will not see this issue. Document in the SUMMARY rather than baking a warmup into the script.

## Cleanup (operator, optional, post-run)

```bash
sqlite3 data/oddlympics.db \
  "DELETE FROM vip_signups WHERE email LIKE 'smoke-%@example.com'"
```

---
*Phase: 05-schema-signup-payload*
*Completed: 2026-05-13*
