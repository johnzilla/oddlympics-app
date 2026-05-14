---
phase: 06-landing-page-form-meta-analytics
fixed_at: 2026-05-13T00:00:00Z
review_path: .planning/phases/06-landing-page-form-meta-analytics/06-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 6: Code Review Fix Report

**Fixed at:** 2026-05-13
**Source review:** `.planning/phases/06-landing-page-form-meta-analytics/06-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope (Critical + Warning): 4
- Fixed: 4
- Skipped: 0
- Info findings (out of scope, deferred): 4 — see REVIEW.md

**Post-fix verification:** ran `node scripts/smoke-landing.mjs` against
`npm run build && node ./dist/server/entry.mjs` (port 4399, distinct from
the user's dev server) — **18/18 PASS, exit 0.**

## Fixed Issues

### WR-01: Smoke harness shares rate-limit IP with `smoke-signup.mjs`

**Files modified:** `scripts/smoke-landing.mjs`
**Commit:** `d5bce3f`
**Applied fix:** Swapped `SMOKE_IP` from `192.0.2.42` to `192.0.2.43`
(still RFC 5737 TEST-NET-1, but distinct from `scripts/smoke-signup.mjs`
which intentionally exhausts its slot). Expanded the comment to
cross-reference `smoke-signup.mjs` and document that future smokes
should default to a fresh address in `192.0.2.0/24`.

### WR-02: Smoke POSTs use `@example.invalid` — Resend rejects when key is set

**Files modified:** `scripts/smoke-landing.mjs`
**Commit:** `08acf5c`
**Applied fix:** Changed both POST cases (`FORM-01-post-303` and
`FORM-01-bad-team-303-error`) from `@example.invalid` to `@example.com`,
matching the working pattern from `smoke-signup.mjs`. Also updated the
header comment block (lines 37–42) and the in-process cleanup-hint at
line 220 to use the broader `LIKE 'smoke-landing-%@example.com'` pattern.
This also implicitly addresses IN-02 (cleanup-hint inconsistency
between the two smokes) — the two patterns now share an `@example.com`
suffix, so a single `LIKE 'smoke-%@example.com'` operator command
covers both harnesses' leftover rows.

### WR-03: `FORM-02-confederation-order` substring-collision bug

**Files modified:** `scripts/smoke-landing.mjs`
**Commits:** `8c79a86`, `8ac1e09`
**Applied fix:** Anchored the order check on full optgroup-label
fragments rather than bare acronyms, so `indexOf('CAF')` no longer
finds the substring inside `CONCACAF`. The initial patch (`8c79a86`)
used `'CONCACAF — North & Central America'` as the third fragment;
smoke verification against the built server (port 4399) surfaced that
Astro HTML-encodes `&` to `&#38;` in the served output, so the literal
string never matched. Follow-up patch (`8ac1e09`) shortened that
fragment to `'CONCACAF — North'` (still unique to that optgroup, no
`&` character). Other fragments (`'UEFA — Europe'`, `'CONMEBOL — South
America'`, `'CAF — Africa'`, `'AFC — Asia'`, `'OFC — Oceania'`) were
already `&`-free and unmodified between the two commits. End-to-end
smoke now reports 18/18 PASS.

**Requires human verification:** the fix changes assertion semantics
(unique-fragment match instead of acronym match) — confirm the
fragments chosen are stable against future copy edits to
`src/pages/index.astro`'s `CONFEDERATION_LABELS` map.

### WR-04: `check:land-02` npm script self-shadows prohibited terms

**Files modified:** `package.json`
**Commit:** `e91ef7b`
**Applied fix:** Wrapped each prohibited term in the grep pattern in
single-character bracket char-classes (`[b]itcoin`, `[l]ightning`,
`[c]rypto`, `[w]orld domination`, `[p]ersonal olympics`) — same trick
already used at `scripts/smoke-landing.mjs:124`. The grep semantics are
unchanged (a one-character class matches the literal character), but
the source text in `package.json` no longer contains the prohibited
terms verbatim, so a future full-repo scan will not flag
`package.json` itself. Functionally verified: `echo 'fake content with
bitcoin in it' | grep -iE '[b]itcoin|...'` still matches; `npm run
check:land-02` still exits 0 against the clean build. The POSIX-shell
portability concern (leading `!` under `cmd.exe`) was noted but
deliberately not addressed — project targets Linux/macOS today, and
the reviewer themselves flagged it as "low blast radius."

## Skipped Issues

None. All 4 in-scope warnings were applied and verified end-to-end.

The 4 Info findings (IN-01 Plausible SRI, IN-02 cleanup-hint
inconsistency, IN-03 COPY key naming, IN-04 missing OG image asset)
remain out of scope for this fix run per the `critical_warning` scope
setting. IN-02 was implicitly resolved by the WR-02 fix (cleanup hints
now share an `@example.com` suffix). The others are documented in
REVIEW.md and should be triaged in a future polish pass.

## Verification Summary

| Check | Result |
|---|---|
| `node -c scripts/smoke-landing.mjs` (syntax) | PASS after each edit |
| `node -e "JSON.parse(...)"` on `package.json` | PASS |
| `npm run build` | PASS (623ms server build, 4 prerendered pages) |
| `npm run check:land-02` | exit 0 (no prohibited terms in `dist/`) |
| `node scripts/smoke-landing.mjs` against built server | 18/18 PASS, exit 0 |

---

_Fixed: 2026-05-13_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
