# Phase 5 Plan Check

**Phase:** 05-schema-signup-payload
**Plans checked:** 6 (waves 1–4)
**Checker date:** 2026-05-12
**Verdict:** REVISIONS_REQUIRED → **RESOLVED** (orchestrator-applied fixes, 2026-05-12)

## Post-Check Resolution Log

All 3 blockers and 2 warnings were fixed in-place by the plan-phase orchestrator (no full revision spawn needed — defects were tactical verify-command issues, not coverage/decision gaps):

- **Plan 05-03 Task 2 verify (blocker 1):** replaced `node -e import('./*.ts')` with `npm run build` + `timeout 6 node ./dist/server/entry.mjs` against a temp `DATABASE_PATH`, then `better-sqlite3` readonly `require()` for `pragma_table_info`. Idempotency re-tested by booting twice against the same temp DB.
- **Plan 05-04 Task 1 verify (blocker 2):** dropped the `.ts` imports; rely on `npx astro check` + source-grep assertions on `src/lib/teams.ts` and `src/lib/timezones.ts`. Behavioral validation deferred to Plan 06's smoke script (which boots the built server).
- **Plan 05-04 Task 2 verify (blocker 3):** dropped the inline COALESCE round-trip; replaced with source-grep assertions on the prepared statement shape. Round-trip behavior is verified by Plan 06's smoke script.
- **Plan 05-03 SQLite version comparison (warning 4):** rewrote the assert to compare numeric `[major, minor]` integers directly instead of the lexicographic `.join('.') < '3.35'`.
- **Plan 05-06 background server PID (warning 5):** removed the subshell so `$!` captures the actual node PID; added `wait $SERVER_PID 2>/dev/null` after `kill` to reap the process cleanly.

---

## Summary

The 6-plan set correctly covers every Phase 5 requirement (SIGNUP-01/02/03, COMPAT-01/02),
all 7 locked decisions (D-01 through D-07), and the 5 success criteria. The wave sequencing
is valid. However, two issues require revision before execution:

1. **BLOCKER (×1):** Automated `<verify>` commands in Plans 03 and 04 call
   `node -e "import('./src/lib/db.ts')..."` — Node 22 cannot execute raw `.ts` files.
   `tsx` and `ts-node` are absent from the project's `node_modules/.bin/`. These commands
   will error on the executor's machine. The acceptance criteria are sound; only the
   automated verify shell commands are broken.

2. **WARNING (×2):** Two lower-severity issues documented below.

---

## Dimension-by-Dimension Results

### Dimension 1: Requirement Coverage — PASS

| Requirement | Plans | Tasks | Status |
|-------------|-------|-------|--------|
| SIGNUP-01 | 02, 04, 06 | 02-T1/T2, 04-T1/T3, 06-T1 | Covered |
| SIGNUP-02 | 04, 06 | 04-T1/T3, 06-T1 (cases 4+5) | Covered |
| SIGNUP-03 | 03, 04, 05, 06 | 03-T2, 04-T2/T3, 05-T1/T2/T3, 06-T1 | Covered |
| COMPAT-01 | 01, 02, 03, 05, 06 | All plans touch aspects | Covered |
| COMPAT-02 | 04, 06 | 04-T3 (bad-form slug), 06-T1 (cases 2/3/4/5) | Covered |

All 5 requirement IDs from the roadmap appear in at least one plan's `requirements:` frontmatter
and have concrete task coverage.

### Dimension 2: Task Completeness — FAIL (BLOCKER)

All tasks have `<files>`, `<action>`, `<verify>`, `<acceptance_criteria>`, and `<done>` elements.
Actions are specific and measurable. Acceptance criteria are all source/behavior assertions —
no subjective language. The `<read_first>` element is present on every task.

**BLOCKER: `node -e "import('./src/lib/db.ts')..."` verify commands won't execute.**

Plans 03 Task 2, 04 Task 1, and 04 Task 2 include automated verify commands that attempt to
dynamically `import()` TypeScript source files via plain `node -e`. Node 22 is not a TypeScript
runtime. The project has no `tsx`, `ts-node`, or equivalent in `node_modules/.bin/`. Running
these verify commands will produce:

```
TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".ts"
```

Affected verify commands:
- **Plan 03, Task 2**: `node -e "import('./src/lib/db.ts')..."`
- **Plan 04, Task 1**: `node -e "import('./src/lib/teams.ts')..."` and
  `node -e "import('./src/lib/timezones.ts')..."`
- **Plan 04, Task 2**: `node -e "import('./src/lib/db.ts')..."`

The `npx astro check` and `npm run build` verify commands in the same tasks ARE valid and
would catch TypeScript errors. But without working automated schema-boot verification, the
executor cannot confirm the migration ran correctly against a real database before proceeding
to wave 3.

**Fix required:** Replace each broken `node -e "import('./src/lib/foo.ts')..."` with one
of the following, in this preference order:
1. `DATABASE_PATH=/tmp/test-05.db npm run build && DATABASE_PATH=/tmp/test-05.db node ./dist/server/entry.mjs &  sleep 2; kill $! ...` (build first, then import the built JS)
2. `DATABASE_PATH=/tmp/test-05.db node --import tsx/esm -e "import('./src/lib/db.ts').then(...)"` after adding `tsx` as a dev dependency
3. For Plan 03 Task 2 specifically, use the SQLite3 CLI directly after `npm run build && npm run serve`: `sqlite3 /tmp/test-05.db "SELECT name FROM pragma_table_info('vip_signups')"`

The simplest fix: for Plan 03 Task 2 and Plan 04 Task 2, replace the `node -e import()` schema
assertion with a post-build sqlite3 CLI check:

```bash
npm run build 2>&1 | tail -3 && \
  DATABASE_PATH=/tmp/test-05.db timeout 5 node ./dist/server/entry.mjs 2>/dev/null || true && \
  sqlite3 /tmp/test-05.db "SELECT name FROM pragma_table_info('vip_signups')" | tr '\n' ',' | \
  grep -q "team" && echo "team col present" && \
  sqlite3 /tmp/test-05.db "SELECT name FROM pragma_table_info('vip_signups')" | \
  grep -qv "selected_teams" && echo "selected_teams absent"
```

For Plan 04 Task 1, replace the two `node -e import('./src/lib/teams.ts')` and
`node -e import('./src/lib/timezones.ts')` commands with a build-then-check approach,
or test the helpers indirectly via `npm run build` (which will fail if the modules have
TypeScript errors) plus a manual REPL invocation note.

### Dimension 3: Dependency Correctness — PASS

| Plan | Wave | Depends On | Validity |
|------|------|-----------|---------|
| 01 | 1 | [] | Valid — no code deps |
| 02 | 1 | [] | Valid — parallel with 01, different files |
| 03 | 2 | [02] | Valid — needs teams.slug column from 02 before vip_signups migration |
| 04 | 3 | [02, 03] | Valid — needs teams.json (02) + vip_signups.team (03) |
| 05 | 3 | [02, 03] | Valid — needs teams.slug (02) + no selected_teams (03); different files from 04 |
| 06 | 4 | [04, 05] | Valid — smoke tests need the full widened handler + downstream consumers |

**Plans 02 and 03 both modify `src/lib/db.ts`.** However they are in different waves (1 and 2
respectively) so there is no simultaneous write conflict. Plan 03 depends on Plan 02, meaning
Plan 02's db.ts changes are committed before Plan 03 edits the file. No merge conflict.

**Plans 04 and 05 are in the same wave (3).** Plan 04 modifies
`src/lib/teams.ts, src/lib/timezones.ts, src/pages/api/signup.ts, src/lib/db.ts`.
Plan 05 modifies `scripts/send-kickoff-notifications.mjs, src/pages/schedule.astro,
src/pages/api/save-selection.ts`. Zero file overlap. Safe to run in parallel.

Dependency graph is acyclic and wave-consistent.

### Dimension 4: Key Links Planned — PASS

All key artifacts are wired:

| Link | Wired in |
|------|---------|
| `references/teams.json` → `src/lib/teams.ts` (VALID_TEAMS set) | Plan 04 Task 1 |
| `src/lib/teams.ts` → `src/pages/api/signup.ts` (Set.has() validation) | Plan 04 Task 3 |
| `src/lib/timezones.ts` → `src/pages/api/signup.ts` (VALID_TZ, FALLBACK_TZ) | Plan 04 Task 3 |
| `src/pages/api/signup.ts` → `vip_signups` (upsertVipSignup with 6 args) | Plan 04 Task 3 |
| `vip_signups.team` → `send-kickoff-notifications.mjs` (JOIN on teams.slug) | Plan 05 Task 1 |
| `vip_signups.team` → `schedule.astro` (slug→id lookup) | Plan 05 Task 2 |
| `vip_signups.team` → `save-selection.ts` (setSelection with single slug) | Plan 05 Task 3 |
| `scripts/smoke-signup.mjs` → `/api/signup` (fetch POST) | Plan 06 Task 1 |

### Dimension 5: Scope Sanity — PASS

| Plan | Tasks | Files | Wave | Assessment |
|------|-------|-------|------|------------|
| 01 | 3 | 3 | 1 | Well within bounds — pure doc edits |
| 02 | 3 | 4 | 1 | Within bounds |
| 03 | 2 | 2 | 2 | Within bounds |
| 04 | 3 | 4 | 3 | Within bounds |
| 05 | 3 | 3 | 3 | Within bounds |
| 06 | 1 | 1 | 4 | Minimal, correct |

No plan exceeds 3 tasks or 4 files. Scope is appropriate.

### Dimension 6: Verification Derivation (must_haves) — PASS

All `must_haves.truths` are user- or operator-observable, not implementation-internal:
- Plan 01: docs contain specific strings (observable via grep)
- Plan 02: JSON file length + slug presence (observable via node assertion)
- Plan 03: column presence/absence in vip_signups (observable via sqlite3)
- Plan 04: POST behavior — 303 destinations + row contents (observable via smoke test)
- Plan 05: grep-verifiable absence of old patterns + boot without error
- Plan 06: smoke script exit code 0 with named AC lines

All `artifacts` have `contains` or `exports` fields. `key_links` connect the artifacts.

### Dimension 7: Context Compliance — PASS (with note)

**D-01:** Plan 03 drops `selected_teams`, adds `team TEXT`. Implemented.
**D-02:** Plan 04 Task 3 uses `console.log` for tz-fallback, no flag column. Implemented.
**D-03:** Plan 01 sweeps the three docs to `America/New_York`. Implemented. NOTE: at the
  time of this check, ROADMAP.md Phase 5 SC#3/#4 and REQUIREMENTS.md SIGNUP-02/COMPAT-01
  still read `America/Detroit`. This is expected — Plan 01 is the first wave-1 plan and
  will fix it before any code lands.
**D-04:** Plan 04 Task 1 builds VALID_TZ from `Intl.supportedValuesOf('timeZone')` at
  module load. Implemented.
**D-05:** Plan 02 Task 1 authors `references/teams.json` with the exact shape, confederation
  order, and FORM-02 explicit slugs. Implemented.
**D-06:** Plan 02 picks path (b): runtime JOIN via `teams.slug` column. Implemented.
**D-07:** Plan 06 verifies AC2/AC9/AC12 via smoke scripts; AC3/AC11 deferred. Implemented.

No deferred ideas from CONTEXT.md are present in the plans (no `timezone_inferred` column,
no `references/teams-ids.json` static map, no vitest).

### Dimension 7b: Scope Reduction Detection — PASS

No scope-reduction language detected in any plan's action sections. All D-XX decisions are
implemented fully, not partially:
- D-03 fallback is `America/New_York` (not a placeholder; it's the literal constant)
- D-05 is hand-authored at 48 entries (not "will add later")
- D-06 path (b) is wired with an actual JOIN (not "stub JOIN")

### Dimension 7c: Architectural Tier Compliance — PASS

All validations remain in the API tier (`src/pages/api/signup.ts`). The `VALID_TEAMS` and
`VALID_TZ` allow-lists are built server-side at module load and checked per-request in the
API handler. No security-sensitive validation is pushed to the client. The `schedule.astro`
frontmatter reads from DB server-side (SSR, `prerender = false`). Correct tier assignment
throughout.

### Dimension 8: Nyquist Compliance — PASS (with note)

All tasks have `<verify>` blocks with automated commands. The broken `node -e import(.ts)`
commands are addressed as a BLOCKER in Dimension 2. Excluding those broken commands, every
task has at least one working automated command (`npx astro check`, `npm run build`,
`grep -c`, `node --check`). Sampling continuity: 6 plans × 2-3 tasks each — all have
automated verify. No watch-mode flags. No full E2E suite (smoke script uses fetch, fast).

Plan 06's verify forks a server via background process:
```bash
(node --env-file=.env ./dist/server/entry.mjs &) && SERVER_PID=$!; sleep 3; node scripts/smoke-signup.mjs
```
This is a shell sequencing issue — `&&` after a background process always succeeds, and
`SERVER_PID=$!` after a subshell doesn't capture the PID reliably. The executor should
treat this as a guideline and run the server separately. This is a WARNING, not a BLOCKER,
since the smoke script's AC itself says "Boot a dev server in another terminal."

### Dimension 9: Cross-Plan Data Contracts — PASS

Plans 02 and 03 both touch `src/lib/db.ts` but in different waves with different concerns:
- Plan 02 adds the `teams.slug` column (teams table)
- Plan 03 migrates the `vip_signups` table

No conflicting transforms. The `setSelection` parameter tuple stays `[string, string, string]`
in both Plan 03's migration and Plan 05's consumer update — contracts are compatible.

The `upsertVipSignup` grows from 4 to 6 params; Plan 04 Task 2 writes the new statement
and Plan 04 Task 3 updates the call site in the same plan. No cross-plan contract gap.

### Dimension 10: CLAUDE.md Compliance — PASS

Plans follow all CLAUDE.md conventions:
- TypeScript strict mode (type over interface, node: prefix, prepared-statement generics)
- No framework JS added
- No new required env vars
- Dry-run-by-default pattern on backfill and backup scripts
- No new test framework (smoke script uses better-sqlite3 + node:fetch)
- `selected_teams` removed additively (well, non-additively but with the documented backup
  + operator-count risk-sizing rationale)
- Systemd-timer pattern for background jobs respected (backfill/backup are one-shots, not
  timer units)

### Dimension 11: Research Resolution — SKIPPED (no RESEARCH.md)

No RESEARCH.md for this phase.

### Dimension 12: Pattern Compliance — SKIPPED (no PATTERNS.md)

No PATTERNS.md for this phase.

---

## Success Criteria Traceability

| SC | Description | Plans | Tasks | Status |
|----|-------------|-------|-------|--------|
| SC#1 | Valid team+email+tz → 303 /pending, row persists with 4 fields | 03, 04, 06 | 03-T2, 04-T2/T3, 06-T1-case1 | Covered |
| SC#2 | Missing/unknown team → 303 /?error=bad-form, no row, log | 04, 06 | 04-T3, 06-T1-cases2/3 | Covered |
| SC#3 | Empty/invalid tz → fallback America/New_York, persists, logs | 04, 06 | 04-T3, 06-T1-cases4/5 | Covered |
| SC#4 | Pre-milestone rows load without error after migration | 03, 05 | 03-T2 (idempotent probe), 05-T2 (team=NULL renders empty state) | Covered |
| SC#5 | Honeypot, Origin check, rate limit, email regex preserved | 04, 06 | 04-T3 (byte-identical block AC), 06-T1-cases6/7 | Covered |

---

## Issues (Structured YAML)

```yaml
issues:
  - plan: "05-03"
    dimension: "task_completeness"
    severity: "blocker"
    task: 2
    description: |
      Verify command calls `node -e "import('./src/lib/db.ts')..."` but Node 22 cannot execute
      .ts files. `tsx` is absent from the project's node_modules/.bin. This command will error
      with ERR_UNKNOWN_FILE_EXTENSION and the executor will have no automated proof that the
      vip_signups migration (ADD team / DROP selected_teams) ran correctly on the test DB.
    fix_hint: |
      Replace the `node -e "import('./src/lib/db.ts')..."` section of the <verify> command with
      a sqlite3 CLI check run after `npm run build` causes the migration to execute on boot.
      Example replacement:
        npm run build 2>&1 | tail -3 &&
        rm -f /tmp/test-05.db &&
        DATABASE_PATH=/tmp/test-05.db timeout 5 node ./dist/server/entry.mjs 2>&1 | head -5 || true &&
        sqlite3 /tmp/test-05.db "SELECT group_concat(name) FROM pragma_table_info('vip_signups')"
          | grep -q "team" && echo "team col ok" &&
        ! sqlite3 /tmp/test-05.db "SELECT group_concat(name) FROM pragma_table_info('vip_signups')"
          | grep -q "selected_teams" && echo "selected_teams gone"

  - plan: "05-04"
    dimension: "task_completeness"
    severity: "blocker"
    task: 1
    description: |
      Verify command calls `node -e "import('./src/lib/teams.ts')..."` and
      `node -e "import('./src/lib/timezones.ts')..."`. Same ERR_UNKNOWN_FILE_EXTENSION issue as
      Plan 03. The executor cannot confirm VALID_TEAMS.size===48 or FALLBACK_TZ==='America/New_York'
      via automation.
    fix_hint: |
      Replace with `npx astro check` plus a build-and-boot test, OR install tsx as a devDependency
      and use `npx tsx -e "import('./src/lib/teams.ts').then(({VALID_TEAMS})=>{...})"`.
      Alternatively, verify the helpers indirectly: `npm run build` will type-check them, and the
      Plan 06 smoke script will catch behavioral regressions at runtime.

  - plan: "05-04"
    dimension: "task_completeness"
    severity: "blocker"
    task: 2
    description: |
      Verify command calls `node -e "import('./src/lib/db.ts').then(({upsertVipSignup})..."`. Same
      ERR_UNKNOWN_FILE_EXTENSION issue. The COALESCE behavior smoke test (team preserved when
      second upsert passes null) cannot run as written.
    fix_hint: |
      Same fix as Plan 03 Task 2: use sqlite3 CLI after `npm run build` boots the server against
      a test DB, OR add tsx as a devDependency. The acceptance criteria (grep assertions on
      db.ts source) are still verifiable without the node -e command and should suffice.

  - plan: "05-03"
    dimension: "task_completeness"
    severity: "warning"
    task: 2
    description: |
      The SQLite version assert uses string comparison after `.map(Number).join('.')`:
        `sqliteVersion.v.split('.').slice(0,2).map(Number).join('.') < '3.35'`
      After join('.'), the value is a STRING like '3.20', and `<` performs lexicographic
      comparison. This is coincidentally correct for all real SQLite minor versions 20–99
      (single-digit tens digit), but fails for hypothetical version 3.100 (string '3.100' <
      '3.35' is TRUE, but numerically 3.100 > 3.35). Unlikely to manifest with current SQLite,
      but technically unsound.
    fix_hint: |
      Use numeric comparison instead:
        const [maj, min] = sqliteVersion.v.split('.').map(Number);
        if (maj < 3 || (maj === 3 && min < 35)) {
          throw new Error(`SQLite ${sqliteVersion.v} too old; need ≥ 3.35 for DROP COLUMN`);
        }

  - plan: "05-06"
    dimension: "task_completeness"
    severity: "warning"
    task: 1
    description: |
      The <verify> command forks a background server process using `(cmd &) && SERVER_PID=$!`.
      Two issues: (1) `&&` always succeeds after a background process; (2) `$!` after a subshell
      `(...)` captures the subshell's PID, not the server's PID. The kill command at the end may
      not terminate the server, leaving a dangling process.
    fix_hint: |
      Use process substitution or direct backgrounding:
        node --env-file=.env ./dist/server/entry.mjs & SERVER_PID=$!; sleep 3;
        node scripts/smoke-signup.mjs; SMOKE_EXIT=$?; kill $SERVER_PID 2>/dev/null;
        test $SMOKE_EXIT -eq 0
      Or document that the operator boots the server separately (which the script's objective
      already says is the intended pattern).
```

---

## Specific Revisions Required

### Plan 05-03-PLAN.md — Task 2 `<verify>` block

**Replace the broken node -e verify command.** The `import('./src/lib/db.ts')` invocation
does not work in plain Node 22. The replacement must validate that:
1. The `team` column exists in `vip_signups` after the migration
2. The `selected_teams` column does NOT exist after the migration

**Exact change:** In `<verify>`, replace the `node -e "import('./src/lib/db.ts')..."` portion with:

```bash
npm run build 2>&1 | grep -E 'error|completed|built' | tail -3 &&
rm -f /tmp/test-05.db &&
DATABASE_PATH=/tmp/test-05.db timeout 8 node ./dist/server/entry.mjs 2>&1 | head -3 || true &&
sqlite3 /tmp/test-05.db "SELECT group_concat(name) FROM pragma_table_info('vip_signups')" | tee /tmp/cols-05.txt &&
grep -q "team" /tmp/test-05-cols.txt && echo "PASS: team col present" &&
! grep -q "selected_teams" /tmp/test-05-cols.txt && echo "PASS: selected_teams absent"
```

### Plan 05-04-PLAN.md — Task 1 and Task 2 `<verify>` blocks

**Task 1:** Remove the two `node -e "import('./src/lib/teams.ts')..."` and
`node -e "import('./src/lib/timezones.ts')..."` commands. Replace with:
- For teams: `npm run build 2>&1 | grep error | head -3` (build failure = module broken)
  plus `grep -c 'VALID_TEAMS' src/lib/teams.ts && grep -c 'FALLBACK_TZ' src/lib/timezones.ts`
- The behavioral checks (VALID_TEAMS.size===48, FALLBACK_TZ==='America/New_York') are
  adequately covered by Plan 06's smoke script assertions (AC2, tz fallback cases 4/5).

**Task 2:** Remove the `node -e "import('./src/lib/db.ts')..."` command. The COALESCE
behavior is covered by the smoke script's re-signup semantics (not directly tested in Phase 5
smoke but is a correctness concern for Plan 06's case 1). Add a note that the COALESCE
behavior is validated by the upsert prepared statement's source (grep assertion in AC).

---

## What the Planner Does NOT Need to Change

The following are correct and should NOT be revised:

- Wave structure and dependency ordering
- All acceptance criteria (they are sound)
- The decision to delete the `if (!has('selected_teams')) ADD COLUMN` line from Plan 03
  (correct — the `if (has('selected_teams')) DROP COLUMN` probe handles idempotency)
- Plan 02's choice of D-06 path (b) runtime JOIN
- Plan 05 Task 3's decision to use `'too-many'` as the error redirect for no-valid-team
  in save-selection (acceptable v2.0 rough edge per plan notes)
- The `must_haves` blocks (all are goal-tied and observable)
- The smoke script structure in Plan 06
- Plan 01's doc sweep targets and find/replace specifications

---

*Check date: 2026-05-12*
