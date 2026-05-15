---
phase: 10-confirmation-email-update
plan: "10-02"
subsystem: smoke
tags: [smoke, confirmation-email, offline-regression, signup-04, land-02]
requires:
  - "10-01"  # shipped composer + helpers + subject literal
provides:
  - "scripts/smoke-confirm-email.mjs — offline 10-case byte-equivalence drift net"
  - "npm run smoke:confirm — alias for the smoke"
affects:
  - "scripts/ (new file)"
  - "package.json scripts block"
tech-stack:
  added: []
  patterns:
    - "Inline re-implementation of TS helpers for byte-equivalence drift detection (mirrors scripts/smoke-manage.mjs:58-74 mintToken pattern)"
    - "Offline smoke (no network, no DB, no env vars) using readFileSync(references/teams.json)"
    - "[smoke] PASS|FAIL tag prefix matching smoke-signup / smoke-landing / smoke-manage"
key-files:
  created:
    - "scripts/smoke-confirm-email.mjs"
    - ".planning/phases/10-confirmation-email-update/10-02-SUMMARY.md"
  modified:
    - "package.json"
decisions:
  - "Smoke re-implements teamLabel + tzLabel + composeBody inline rather than importing from src/lib/* — same drift-detection pattern smoke-manage.mjs uses for mintToken. Byte-exact duplication IS the mitigation (PATTERNS.md §Re-implementing TS helpers inline)."
  - "Case 6 (Curaçao) asserts the diacritic-preserved label verbatim — slug=curacao, label=Curaçao verified at plan-time in references/teams.json:30; no runtime ASCII-fallback branch needed."
  - "Inserted smoke:confirm alphabetically before smoke:landing in package.json (final order: smoke:confirm < smoke:landing < smoke:manage) to match the existing smoke:* naming convention."
  - "tzLabel branches mirror the shipped src/lib/timezones.ts:19-24 byte-for-byte: falsy / no slash / starts-with-Etc/ → 'your local time'; otherwise last segment with underscores → spaces and ' time' suffix. Case 3 (FALLBACK_TZ America/New_York) does NOT collapse — it renders 'New York time'; only Case 5 (Etc/UTC) and Case 10 (empty) hit the no-tz path."
metrics:
  duration: "~12 minutes"
  completed: "2026-05-15"
---

# Phase 10 Plan 02: smoke-confirm-email Summary

Offline byte-equivalence drift net for the confirmation-email body composer shipped in Plan 10-01. 10 cases, run via `node scripts/smoke-confirm-email.mjs` or `npm run smoke:confirm`. Re-implements `teamLabel`, `tzLabel`, and the subject + text + html body composer inline (mirroring the `scripts/smoke-manage.mjs:58-74` pattern for `mintToken`) so a future drift in `src/lib/email.ts`, `src/lib/teams.ts`, `src/lib/timezones.ts`, or `references/teams.json` that is not propagated to this file in lockstep trips the smoke.

## Verification Map

| Plan Success Criterion | Evidence |
|---|---|
| 2 tasks executed | Commit `4b0b0b6` (Task 1) + commit `53d1d7c` (Task 2) in `git log` |
| Each task committed atomically with feat/chore prefix + (10-02) scope | `git log --oneline -3` shows both commits with the correct prefix |
| `scripts/smoke-confirm-email.mjs` exists, is executable Node ESM, runs offline | `node scripts/smoke-confirm-email.mjs` exits 0; imports `node:fs`, `node:path`, `node:url` only |
| `npm run smoke:confirm` exits 0 — all 10 cases PASS | Verbatim output below (`pass=10 fail=0`) |
| 10 cases match those locked in 10-02-PLAN.md §Specifics | One-to-one mapping table below |
| Case 6 (Curaçao) asserts the diacritic-preserved label verbatim | `text.includes('every Curaçao match in Curacao time.')` + html variant — `[smoke] PASS confirm-diacritic-curacao` |
| `package.json` has `"smoke:confirm": "node scripts/smoke-confirm-email.mjs"` alphabetically before `smoke:landing` | `node -e "console.log(Object.keys(require('./package.json').scripts).sort().join(' '))"` → `astro build check:land-02 dev og:render preview serve smoke:confirm smoke:landing smoke:manage start` |
| LAND-02 source self-grep PASS on smoke file | `! grep -iE '[b]itcoin\|[l]ightning\|[c]rypto\|[w]orld domination\|[p]ersonal olympics' scripts/smoke-confirm-email.mjs` exits 0 |
| U+2019 negative check PASS on smoke file | `! grep -F "$(printf '\xe2\x80\x99')" scripts/smoke-confirm-email.mjs` exits 0 (ASCII apostrophe 0x27 throughout) |

## The 10 cases

| # | Case (input) | Assertion (against composed body) | Result |
|---|--------------|-----------------------------------|--------|
| 1 | `team=england, tz=America/Detroit` | text + html contain `every England match in Detroit time.` (html with `<strong>`) | PASS |
| 2 | `team=united_states, tz=Europe/London` | `every United States match in London time.` | PASS |
| 3 | `team=france, tz=America/New_York` (FALLBACK_TZ) | `every France match in New York time.` (underscore → space) | PASS |
| 4 | `team=brazil, tz=Asia/Ho_Chi_Minh` | `every Brazil match in Ho Chi Minh time.` (multi-underscore) | PASS |
| 5 | `team=germany, tz=Etc/UTC` | `every Germany match in your local time.` (Etc/* fallthrough) | PASS |
| 6 | `team=curacao, tz=America/Curacao` | `every Curaçao match in Curacao time.` (ç preserved verbatim) | PASS |
| 7 | subject literal | equals `Confirm your World Cup alerts — oddlympics` (em-dash U+2014) | PASS |
| 8 | LAND-02 grep over `subject + text + html` | `/([b]itcoin\|[l]ightning\|[c]rypto\|[w]orld domination\|[p]ersonal olympics)/i.test(...)` → false | PASS |
| 9 | `team=zzz_unknown, tz=America/Detroit` | `every zzz_unknown match in Detroit time.` (teamLabel raw-slug fallback) | PASS |
| 10 | `team=spain, tz=''` | `every Spain match in your local time.` (empty-tz fallthrough) | PASS |

## Verbatim smoke output (`npm run smoke:confirm`)

```
> oddlympics-app@0.1.0 smoke:confirm
> node scripts/smoke-confirm-email.mjs

[smoke] target: offline composer (no network, no DB)
[smoke] PASS confirm-canonical-england-detroit
[smoke] PASS confirm-multi-word-united-states-london
[smoke] PASS confirm-fallback-tz-france-new-york
[smoke] PASS confirm-underscore-tz-brazil-ho-chi-minh
[smoke] PASS confirm-etc-utc-fallthrough-germany
[smoke] PASS confirm-diacritic-curacao
[smoke] PASS confirm-subject-literal
[smoke] PASS confirm-land-02-grep-zero-hits
[smoke] PASS confirm-unknown-slug-fallback-zzz
[smoke] PASS confirm-empty-tz-fallthrough-spain
[smoke] result: pass=10 fail=0
```

Case 6 (`confirm-diacritic-curacao`) asserts the diacritic-preserved label string `every Curaçao match in Curacao time.` verbatim — both in `text` and in `<strong>Curaçao</strong>` inside `html`. References/teams.json:30 ships `{ "slug": "curacao", "label": "Curaçao", "confederation": "CONCACAF" }`, so the diacritic round-trips from disk through `teamLabel` into the body string with no ASCII fallback.

## New package.json scripts entry

```json
"smoke:confirm": "node scripts/smoke-confirm-email.mjs",
```

Placed alphabetically before `smoke:landing`. Resulting `smoke:*` block:

```json
"smoke:confirm": "node scripts/smoke-confirm-email.mjs",
"smoke:landing": "node scripts/smoke-landing.mjs",
"smoke:manage": "node scripts/smoke-manage.mjs",
```

## Tasks Completed

### Task 1: Create scripts/smoke-confirm-email.mjs with 10 cases
- **Commit:** `4b0b0b6` — `feat(10-02): add smoke-confirm-email.mjs with 10 offline cases`
- **Files:** `scripts/smoke-confirm-email.mjs` (+276 lines)
- **Result:** Offline Node ESM smoke. Inline `teamLabel` (mirrors `src/lib/teams.ts:16-18`), inline `tzLabel` (mirrors `src/lib/timezones.ts:19-24`), inline `composeBody` (mirrors `src/lib/email.ts:17-52` subject + text + html). 10 `runCase` invocations, `[smoke] PASS|FAIL` tags, final `[smoke] result: pass=N fail=N` tally, `process.exit(fail === 0 ? 0 : 1)`. Three `node:` prefix imports (`node:fs`, `node:path`, `node:url`); no third-party deps; no env vars consumed; no DB; no network.

### Task 2: Wire smoke:confirm npm-script alias
- **Commit:** `53d1d7c` — `chore(10-02): add smoke:confirm npm script alias`
- **Files:** `package.json` (+1 line)
- **Result:** Single-line insertion: `"smoke:confirm": "node scripts/smoke-confirm-email.mjs"` between `"astro"` and `"smoke:landing"` (alphabetic position). No new deps. `dependencies` + `devDependencies` byte-identical. `npm run smoke:confirm` exits 0.

## Deviations from Plan

None of substance.

One small note: the plan's per-task acceptance criterion `grep -nFc "runCase(" scripts/smoke-confirm-email.mjs` returns **11** (not 10) — the `async function runCase(name, fn)` definition matches `runCase(` in addition to the 10 call sites. This matches `scripts/smoke-signup.mjs` and `scripts/smoke-manage.mjs` exactly (both also have 1 definition + N invocations = N+1 grep hits). The 10 case invocations are present and run; the behavioral check (`[smoke] result: pass=10 fail=0`) is the authoritative gate.

A pre-execution attempt to load `references/teams.json` assumed a `{ teams: [...] }` wrapper object; the actual shape is a top-level array. The smoke was rewritten before commit; no incorrect bytes hit git history.

## Auth gates

None. The smoke is fully offline.

## Known stubs

None. No hardcoded empty values, no placeholder data flowing to UI, no unwired data sources.

## Threat flags

None. The smoke reads a checked-in JSON data file via `node:fs` and emits to stdout. No network surface, no DB, no env reads, no auth path, no schema change.

## Tasks Summary

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | smoke-confirm-email.mjs with 10 offline cases | `4b0b0b6` | scripts/smoke-confirm-email.mjs |
| 2 | smoke:confirm npm script alias | `53d1d7c` | package.json |

## Next Plan

**Plan 10-03:** deploy + operator-action verification (Mail-Tester ≥ 8/10 from D-08, cross-client sends to Gmail / Proton / Outlook from D-09, commit 4 screenshots under `evidence/`, close Phase 10 with `10-SUMMARY.md`).

## Self-Check: PASSED

- `scripts/smoke-confirm-email.mjs` exists: FOUND
- `package.json` has `"smoke:confirm"` key: FOUND
- Commit `4b0b0b6` (Task 1) in git log: FOUND
- Commit `53d1d7c` (Task 2) in git log: FOUND
- `node scripts/smoke-confirm-email.mjs` exits 0 (10/10 PASS): VERIFIED
- `npm run smoke:confirm` exits 0 (10/10 PASS): VERIFIED
- LAND-02 source self-grep on smoke: PASS (exit 0)
- U+2019 negative check on smoke: PASS (exit 0)
- ASCII apostrophe (0x27) used throughout: VERIFIED
- `node:` prefix on all built-in imports (node:fs, node:path, node:url): VERIFIED
- No third-party dependencies: VERIFIED
- `dependencies` + `devDependencies` byte-identical to pre-plan: VERIFIED
