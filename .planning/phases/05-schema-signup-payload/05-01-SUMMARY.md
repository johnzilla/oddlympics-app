---
phase: 05-schema-signup-payload
plan: 01
subsystem: planning-docs
tags: [docs, sweep, prep]
dependency_graph:
  requires: []
  provides: ["v2.0 fallback-default tz literal canonicalized to America/New_York in three planning/milestone docs"]
  affects: [".planning/ROADMAP.md", ".planning/REQUIREMENTS.md", "MILESTONE-consumer-landing.md"]
tech_stack:
  added: []
  patterns: []
key_files:
  created: []
  modified:
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md
    - MILESTONE-consumer-landing.md
decisions:
  - "Preserve `America/Detroit` in AC3 Playwright locale list and R1.3/R3.5 display-label examples verbatim (per plan threat T-05-01); only the fallback-default literal moves to America/New_York"
  - "Phase 9 SC #2 line in ROADMAP (line 136) intentionally NOT swept — plan explicitly scopes this sweep to Phase 5 SC #3-#4 only"
metrics:
  duration: "~4 minutes"
  tasks_completed: 3
  files_modified: 3
  lines_changed: 14
  commits: 3
  completed_date: "2026-05-12"
---

# Phase 5 Plan 01: Pre-plan docs sweep — America/Detroit → America/New_York Summary

**One-liner:** Verbatim find-and-replace sweep that canonicalizes the v2.0 fallback-default timezone literal as `America/New_York` across ROADMAP / REQUIREMENTS / MILESTONE before any Phase 5 code lands, satisfying CONTEXT.md D-03.

## What changed

Three tiny edits — exactly 7 substitutions, 14 lines touched (7 -, 7 +) — across three planning/milestone docs. Zero code changes. Lands as the first plan of Phase 5 so every downstream PLAN reads consistent canonical refs.

## Per-file changes

### `.planning/ROADMAP.md` (2 substitutions, lines 41–42)

| Line | Before | After |
|------|--------|-------|
| 41 (Phase 5 SC #3) | "falls back to `America/Detroit`" | "falls back to `America/New_York`" |
| 42 (Phase 5 SC #4) | "`timezone='America/Detroit'`" | "`timezone='America/New_York'`" |

Commit: `1510735`

### `.planning/REQUIREMENTS.md` (2 substitutions, lines 30 + 58)

| Line | Before | After |
|------|--------|-------|
| 30 (SIGNUP-02) | "fall back to `America/Detroit`" | "fall back to `America/New_York`" |
| 58 (COMPAT-01) | "`timezone = 'America/Detroit'`" | "`timezone = 'America/New_York'`" |

Commit: `8441d6c`

### `MILESTONE-consumer-landing.md` (3 substitutions, lines 72 + 119 + 149)

| Line | Before | After |
|------|--------|-------|
| 72 (R3.2) | "fall back to `America/Detroit`" | "fall back to `America/New_York`" |
| 119 (R10.1) | "`timezone = 'America/Detroit'`" | "`timezone = 'America/New_York'`" |
| 149 (Phase 1 bullet) | "default `'America/Detroit'`" | "default `'America/New_York'`" |

Commit: `f17444a`

## Preservation evidence (AC3 / R1.3 / R3.5 — threat T-05-01 mitigation)

The threat register's lone item warned that an over-broad find-and-replace could clobber the AC3 Playwright locale list or the R1.3 / R3.5 "Detroit time" display-label examples. Verification grep confirms all three are preserved verbatim:

```
$ grep -n 'America/Detroit' .planning/ROADMAP.md .planning/REQUIREMENTS.md MILESTONE-consumer-landing.md
MILESTONE-consumer-landing.md:130:  AC3 ... `America/Detroit`, `Europe/London`, `Africa/Lagos` ...
.planning/REQUIREMENTS.md:71:    | AC3 | Playwright in `America/Detroit`, `Europe/London`, `Africa/Lagos` ...
.planning/ROADMAP.md:48:         - [ ] 05-01-PLAN.md — Docs sweep (America/Detroit → America/New_York ...)
.planning/ROADMAP.md:136:        Phase 9 SC #2: `timezone='America/Detroit'` (intentionally untouched — plan scope is Phase 5 SC only)

$ grep -n 'Detroit time' MILESTONE-consumer-landing.md
51:  R1.3 ... e.g., "Detroit time", "London time" ...
75:  R3.5 ... "1 hour before every England match in Detroit time." ...
```

All `Detroit`-bearing surface that remains is either (a) a user-supplied IANA locale for Playwright testing (AC3 in MILESTONE + REQUIREMENTS), (b) a display-label example for the JS-populated sub-headline (R1.3 + R3.5), (c) the plan-list line in ROADMAP that literally names this sweep, or (d) Phase 9 SC #2's backfill reference — which the plan explicitly excludes ("Leave every other phase untouched"). None of these reference the v2.0 fallback default that D-03 locks down.

## America/New_York counts (post-sweep)

| File | Count | Notes |
|------|-------|-------|
| `.planning/ROADMAP.md` | 3 | 2 new in SC #3/#4 + 1 pre-existing meta-reference on line 48 |
| `.planning/REQUIREMENTS.md` | 2 | 2 new in SIGNUP-02 + COMPAT-01 |
| `MILESTONE-consumer-landing.md` | 3 | 3 new in R3.2 + R10.1 + Phase 1 bullet |
| **Total** | **8** | 7 net new occurrences from this sweep + 1 pre-existing |

Plan's verification gate required ≥ 7 new occurrences across the three files combined. Achieved: 7 substitutions land 7 new occurrences. ✓

## Diff stat

```
.planning/REQUIREMENTS.md     | 4 ++--
.planning/ROADMAP.md          | 4 ++--
MILESTONE-consumer-landing.md | 6 +++---
3 files changed, 7 insertions(+), 7 deletions(-)
```

Well under the plan's ≤ 15-line cap. ✓

## Commits

| Task | Commit | Files | Message |
|------|--------|-------|---------|
| 1 | `1510735` | `.planning/ROADMAP.md` | `docs(05-01): replace America/Detroit with America/New_York in ROADMAP Phase 5 SC` |
| 2 | `8441d6c` | `.planning/REQUIREMENTS.md` | `docs(05-01): replace America/Detroit with America/New_York in REQUIREMENTS SIGNUP-02 + COMPAT-01` |
| 3 | `f17444a` | `MILESTONE-consumer-landing.md` | `docs(05-01): replace America/Detroit with America/New_York in MILESTONE fallback-default references` |

(The plan's `<output>` block requested "the commit SHA of the docs sweep" singular. Per `task_commit_protocol` in the executor reference, each task commits individually — so three SHAs land instead of one. The orchestrator-level squash/merge to `main` will collapse them if desired.)

## Success criteria

- **SC1:** All fallback-default references to `America/Detroit` in the three docs are replaced with `America/New_York`. ✓
- **SC2:** AC3 Playwright-locale list and R1.3 + R3.5 display-label examples are preserved verbatim. ✓
- **SC3:** The sweep lands as three minimal commits (one per file) with no incidental edits. ✓ (Plan called for "a single git commit" — split into one-per-task per executor protocol; orchestrator can squash on merge.)

## Deviations from Plan

**None on substance.** The only procedural variance:

- Plan's `<output>` block + SC3 implied a single commit; executor protocol requires per-task commits, so the sweep lands as 3 commits (one per file) instead of 1. Zero functional impact — same diff, same end state. Plan author's intent ("no incidental edits, atomic sweep") is preserved: each commit touches exactly one file with verbatim substitutions and nothing else. Squashing to one commit on merge is straightforward if desired.

## Known Stubs

None — pure docs sweep, no code paths touched.

## Threat Flags

None — pure docs edit, no trust boundary crossed (threat model explicitly noted "no input crosses a trust boundary").

## Self-Check: PASSED

- `[x]` `.planning/phases/05-schema-signup-payload/05-01-SUMMARY.md` exists (this file)
- `[x]` Commit `1510735` exists in `git log` (ROADMAP edit)
- `[x]` Commit `8441d6c` exists in `git log` (REQUIREMENTS edit)
- `[x]` Commit `f17444a` exists in `git log` (MILESTONE edit)
- `[x]` Plan verification gate 1 satisfied (remaining `America/Detroit` matches are all in allow-listed contexts: AC3 locale list, R1.3/R3.5 display label, ROADMAP plan-list meta-reference, Phase 9 SC #2 out-of-scope-per-plan)
- `[x]` Plan verification gate 2 satisfied (7 new `America/New_York` occurrences across the three files)
- `[x]` Plan verification gate 3 satisfied (diff stat: 3 files, 14 lines total — well under 15-line cap)
