# Plan 11-03 — Launch gate run — Summary

**Status:** PARTIAL — automatable ACs verified PASS on production; phase BLOCKED before tag
**Date:** 2026-05-16

## What ran

`npm run smoke:gate` against `https://oddlympics.app` (deployed commit `8092814`).

### Automatable ACs — 10/10 PASS

| AC | Result | Evidence |
|----|--------|----------|
| AC1 landing renders | PASS | evidence/AC1-pass.txt |
| AC2 48-team select | PASS | evidence/AC2-pass.txt |
| AC3 tz-spoof Detroit/London/Lagos | PASS (3/3) | evidence/AC3-locales.txt |
| AC6 OG image 1200×630 <300KB | PASS | evidence/AC6-og-image.txt |
| AC7 no prohibited terms (/ /privacy /terms /manage) | PASS | evidence/AC7-prohibited-terms.txt |
| AC8 Lighthouse mobile | PASS — Perf 97 / **A11y 100** / BP 100 / SEO 100 | references/lighthouse-final.html, evidence/AC8-lighthouse-score.txt |
| AC9 bad-team → 303 /?error=bad-form | PASS | evidence/AC9-invalid-team.txt |
| AC12 honeypot → 303 /pending | PASS | evidence/AC12-honeypot.txt |

`[gate] result: pass=10 fail=0`. Accessibility moved 94 → 100 — the D-02 contrast
fix (11-01) verified effective on production.

### Operator-gated ACs — PENDING (known-manual, not stealth gaps)

AC4 (full Gmail loop <60s), AC10 (`/manage` backfilled-row banner+save),
AC11 (Plausible "Signup Submit" dashboard), opengraph.xyz preview — SKIPPED
this run (no operator input piped). These require a human with browser/inbox
access; placeholder evidence files record SKIPPED. They are NOT code gaps and
do NOT block the items below — they are deferred with the tag.

## D-01 in-phase fixes applied during the gate run

All tooling-only (`scripts/launch-gate.mjs`), no deployed-code change except
the `/manage` fix:

- `7c3970f` auto-discover chrome-headless-shell binary (version-pinned path)
- `d756abe`/`29b164d` self-bootstrap puppeteer-core via `--no-save`, install before import (ESM negative-cache)
- `8092814` **(deployed)** `manage.astro`: scope `.cta-form button` width so the sign-in email field isn't collapsed (pre-existing Phase-9 CSS bug surfaced by the gate)
- `fix(11-03)` lighthouse `--form-factor=mobile` (no `mobile` preset exists in current Lighthouse)

## NOT executed — phase BLOCKED

- **11-04 (release tag) — NOT done. `v1.0-consumer-landing` tag deliberately
  withheld.** Tagging would assert a v2.0 public launch the founder has
  rejected (single-team-only is unacceptable — multi-team was silently removed
  by Phase 5/9 against the locked PROJECT.md decision).
- **11-05 (`+ac` test-row cleanup) — NOT done.** AC3 wrote 3 rows to prod
  (`johnturner+ac3-detroit@gmail.com`, `…+ac3-london@…`, `…+ac3-lagos@…`).
  Operator hygiene action when convenient, on the droplet:
  `node scripts/cleanup-gate-rows.mjs` (dry-run) then `--confirm`.

## Hand-off

v2.0 single-team baseline is technically certified (10/10 automatable ACs,
Lighthouse 97/100/100/100). The sole launch blocker is the multi-team product
gap (see STATE.md Blockers, `[[multi-team-required]]`). No tag, no
milestone-complete. Multi-team restoration is scoped as separate work — it is
NOT a Phase 11 item.
