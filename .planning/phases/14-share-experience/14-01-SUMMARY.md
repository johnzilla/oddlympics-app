---
phase: 14-share-experience
plan: 01
subsystem: share-copy
tags: [copy, share, contract, wave-1, foundation]
requires:
  - .planning/phases/14-share-experience/14-CONTEXT.md
  - src/lib/copy.ts (pre-existing 3-constant file)
provides:
  - src/lib/copy.ts::shareText — single template for personalized share message (D-08, D-11)
affects:
  - downstream Wave-2 consumers (14-03 email body, 14-04 share UI on pending/confirmed/manage)
tech-stack:
  added: []
  patterns:
    - "Named-export helper colocated with module string constants — extends the established `copy.ts` pattern (NO_ACCOUNT_TITLE / NO_ACCOUNT_BODY / REENTRY_CTA)"
    - "Explicit return-type annotation on exported function (per CONVENTIONS.md TypeScript rules)"
    - "Single source of truth for cross-surface copy — same pattern as `teamLabel(slug)` for team names"
key-files:
  created: []
  modified:
    - path: src/lib/copy.ts
      lines: 4 → 8 (added shareText)
decisions:
  - "Honored D-08 wording verbatim — em-dash U+2014 (not hyphen, not en-dash), LF newline (not CRLF, not space) between sentence and URL — verified by behavior probe"
  - "No JSDoc block — conforms to project convention (CONVENTIONS.md: 'No comments explaining what code does')"
  - "Helper takes pre-resolved teamLabel (string), not a slug — callers resolve via teamLabel(slug) from src/lib/teams.ts (D-09)"
  - "Single template-literal return, no defensive escaping — D-09 guarantees teamLabel is from allow-listed references/teams.json (zero user input); output-context escaping is the caller's responsibility per D-12 (email) / D-06 (clipboard) / D-03 (DOM)"
metrics:
  duration: 78s
  completed: 2026-05-23T01:31:36Z
  tasks: 1
  files: 1
---

# Phase 14 Plan 01: Add shareText helper to src/lib/copy.ts — Summary

Added the `shareText(teamLabel, url): string` helper to `src/lib/copy.ts` — the single source of truth for the personalized share-message template that Wave-2 plans 14-03 (confirmation-email share line) and 14-04 (share UI on /pending, /confirmed, /manage) will consume.

## What Was Built

A single 4-line addition to `src/lib/copy.ts` (the existing 3-constant copy module):

```ts
export function shareText(teamLabel: string, url: string): string {
  return `I'm following ${teamLabel} — get your team's World Cup kickoff alerts.\n${url}`;
}
```

Three things matter and were verified:

1. **Em-dash character** — `—` (U+2014), not a hyphen `-`, not an en-dash `–`. Matches D-08 verbatim and the editorial-minimalist house style established in `email.ts:51`.
2. **LF newline `\n`** — single linefeed between the sentence and the URL, so SMS / WhatsApp / tweet composers line-break gracefully. Not CRLF, not a space.
3. **No escaping, no encoding** — the team label is interpolated literally (D-09: comes from allow-listed `references/teams.json`, no user input); the URL is appended unchanged (callers build `${PUBLIC_SITE_URL}/?ref=${code}` per D-07).

Behavior probe (in-memory load + invoke) returned:

```
I'm following USA — get your team's World Cup kickoff alerts.
https://oddlympics.app/?ref=k7m2qx9a
```

…exactly matching the D-08 lock in 14-CONTEXT.md § Specifics.

## Tasks

| # | Task | Type | Commit | Files |
|---|------|------|--------|-------|
| 1 | Add shareText helper to src/lib/copy.ts | auto (tdd) | 7173cb6 | src/lib/copy.ts |

## Verification

All seven acceptance criteria from the plan green:

| Check | Expected | Actual |
|-------|----------|--------|
| `grep -c "export function shareText" src/lib/copy.ts` | 1 | 1 |
| `grep -c "I'm following" src/lib/copy.ts` | 1 | 1 |
| `grep -c "get your team's World Cup kickoff alerts" src/lib/copy.ts` | 1 | 1 |
| `grep -c "—" src/lib/copy.ts` | ≥ 1 | 2 (em-dash also appears in NO_ACCOUNT_BODY) |
| `grep -E "^export const (NO_ACCOUNT_TITLE\|NO_ACCOUNT_BODY\|REENTRY_CTA)" src/lib/copy.ts \| wc -l` | 3 | 3 |
| `npx astro check 2>&1 \| grep -E "copy\.ts"` | empty | empty (no type errors for copy.ts) |
| Behavior probe via dynamic in-memory module load | exit 0 | exit 0, output matches D-08 verbatim |

### TDD cycle

- **RED:** Pre-implementation `grep -c "export function shareText" src/lib/copy.ts` returned `0` (helper did not exist). Confirmed at 2026-05-23T01:30:18Z.
- **GREEN:** Post-implementation behavior probe loaded `src/lib/copy.ts` via dynamic import, called `shareText('USA', 'https://oddlympics.app/?ref=k7m2qx9a')`, asserted the returned string contains `I'm following USA`, the URL, an `\n` newline, and `—` em-dash. Exited 0.
- **REFACTOR:** None needed — minimal one-statement template-literal return matches the explicit D-08 wording; reshaping it adds nothing.

The project has no formal test suite (per CLAUDE.md), so the RED→GREEN cycle was driven by grep + in-memory dynamic-import probe rather than a vitest/jest file. Wave-2's smoke (Plan 14-05) provides end-to-end behavioral coverage downstream.

## Deviations from Plan

None — plan executed exactly as written.

The plan calls for `npx astro check` to be clean for `copy.ts` specifically (`grep -E "copy\.ts"` filter); this is what was verified. The 20 pre-existing `@types/node` errors in unrelated files (`src/lib/token.ts`, `src/lib/db.ts`, etc.) are out of scope for this plan (no `@types/node` in `devDependencies` is a long-standing condition, not introduced by Plan 14-01) and are logged below as a deferred observation rather than fixed.

## Deferred Observations

- **20 pre-existing `npx astro check` errors** across `src/lib/token.ts`, `src/lib/db.ts`, `src/lib/session.ts`, `src/lib/email.ts`, `src/pages/api/*.ts`, etc. — all of the form `Cannot find name 'Buffer'` / `Cannot find name 'process'` / `Cannot find module 'node:crypto'`. Root cause: `@types/node` is not declared in `package.json`. These were present before Plan 14-01, are not introduced by this plan, and are explicitly out of scope per the executor's `<scope_boundary>` rule. Recommend opening a quick-task to `npm i -D @types/node` if the team wants `astro check` clean across the project — but the runtime is unaffected (Node 22 ships these built-ins; this is purely an editor/typecheck signal).

## Threat Flags

None — Plan 14-01 introduces zero new trust-boundary surface. The two threats in the plan's threat register (T-14-01 template-literal interpolation of `teamLabel`, T-14-02 template-literal interpolation of `url`) are both `accept` with documented mitigations (allow-listed team label data, code-controlled URL construction, caller-side output-context escaping). T-14-SC (supply-chain) is `mitigate` with the natural defense that this plan adds zero new dependencies — `package.json` is untouched.

## Known Stubs

None.

## Self-Check

- [x] `src/lib/copy.ts` contains `export function shareText` (verified via `grep -c "export function shareText" src/lib/copy.ts` → 1)
- [x] Commit `7173cb6` exists on `main` (verified via `git log --oneline -1` → `7173cb6 feat(14-01): add shareText helper to src/lib/copy.ts`)
- [x] No files deleted by the task commit (verified via `git diff --diff-filter=D HEAD~1 HEAD` → empty)
- [x] Three existing exports preserved (verified via grep → 3 matches)
- [x] D-08 wording exact (verified via dynamic-import behavior probe — em-dash, LF newline, no extra characters)

## Self-Check: PASSED
