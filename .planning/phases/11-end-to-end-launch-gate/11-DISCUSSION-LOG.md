# Phase 11: End-to-end + launch gate - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-15
**Phase:** 11-end-to-end-launch-gate
**Areas discussed:** Gate strictness & fix scope, AC3 browser-test tooling, Prod test-data hygiene, Verification mechanism

---

## Gate strictness & fix scope

### Q1 — When an AC comes back red on the prod run, what is Phase 11 allowed to do?

| Option | Description | Selected |
|--------|-------------|----------|
| Bounded fix-and-reverify | Carry SMALL AC-closing fixes in-phase (contrast, Plausible preventDefault, copy/header nits); larger failures escalate and report red | ✓ |
| Pure verify-and-report | Only run ACs + record PASS/FAIL; every red AC spawns a separate fix phase | |
| Fix anything needed to ship | Phase 11 owns whatever it takes to get all 12 green, large or small | |

**User's choice:** Bounded fix-and-reverify
**Notes:** Honest gate without extra phase ceremony for trivial fixes; preserves the launch checkpoint while respecting the 2026-05-19 deadline.

### Q2 — Land the diagnosed a11y contrast fix proactively, or wait for the prod Lighthouse run?

| Option | Description | Selected |
|--------|-------------|----------|
| Land it before the gate run | Deepen `#d94a1f→#b8350d` (banner) / button `#c43d15` as task 1, then run the gate | ✓ |
| Wait — only fix if prod run dips <90 | Run gate first; A11y 94 already ≥90; fix only on a dip | |

**User's choice:** Land it before the gate run
**Notes:** Removes a known redeploy+rerun round-trip; de-risks AC8 against prod Lighthouse run-to-run variance. Fix already specified — no investigation cost.

---

## AC3 browser-test tooling

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse Phase-6 puppeteer-core | Drive chrome-headless-shell, CDP/`TZ=` tz-spoof for 3 locales; document deviation from literal "Playwright" | ✓ |
| Introduce Playwright | Add `@playwright/test` devDep, write AC3 literally as worded | |

**User's choice:** Reuse Phase-6 puppeteer-core
**Notes:** Zero new devDeps, proven repo pattern, no test framework before the deadline. Deviation from AC3/MILESTONE literal "Playwright" wording documented in CONTEXT + SUMMARY.

---

## Prod test-data hygiene

### Q1 — How to keep AC3+AC4 prod submissions out of the real launch list?

| Option | Description | Selected |
|--------|-------------|----------|
| Tagged test emails + post-gate cleanup | John's-Gmail `+tag` addresses; delete those rows from prod DB after the gate | ✓ |
| Accept rows, just unsubscribe them | Let rows persist, mark unsubscribed via token path | |
| AC3 against prod-equiv build; only AC4 hits prod | Run AC3 against local built server; deviates from SC1 "on production" for AC3 | |

**User's choice:** Tagged test emails + post-gate cleanup
**Notes:** Launch list stays clean; real kickoff emails never fire to test rows; `+tag` keeps deliverability real and inboxes operator-controllable.

### Q2 — Cleanup deletion mechanism?

| Option | Description | Selected |
|--------|-------------|----------|
| Committed dry-run-guarded script | `scripts/cleanup-gate-rows.mjs`, dry-run default, `--confirm`, idempotent | ✓ |
| One-off documented SQL in the SUMMARY | Hand-pasted prod `DELETE` via DEPLOY.md DB-inspection path | |

**User's choice:** Committed dry-run-guarded script
**Notes:** Matches the established project destructive-script convention (launch-blast / send-kickoff / backup-pre-05); reusable for any future prod gate.

---

## Verification mechanism

### Q1 — How are the 12 ACs executed and recorded against production?

| Option | Description | Selected |
|--------|-------------|----------|
| Consolidated `scripts/launch-gate.mjs` | One prod runner; automates scriptable ACs, drives AC3/AC8, prompts+captures AC4/AC10/AC11, per-AC PASS/FAIL + evidence/, re-runnable | ✓ |
| Markdown runbook checklist | Per-AC commands run by hand and pasted | |
| Extend existing per-area smokes to prod | Point smoke-* at prod via `SMOKE_BASE_URL`, add missing checks | |

**User's choice:** Consolidated `scripts/launch-gate.mjs`
**Notes:** Single gate verdict + single re-run command makes the D-01 bounded fix-and-reverify loop cheap before the deadline.

### Q2 — Release tag mechanics?

| Option | Description | Selected |
|--------|-------------|----------|
| Annotated, on green-deploy commit, pushed | `git tag -a v1.0-consumer-landing` on the verified green-deploy commit, message names milestone + AC pass, `git push origin` | ✓ |
| Lightweight, local only | `git tag` locally, no push, no message | |
| Defer tag mechanics to the plan | Lock only string + "last step on verified green-deploy commit" | |

**User's choice:** Annotated, on green-deploy commit, pushed
**Notes:** Annotated = dated/authored/greppable; pushing makes the release point shareable. Tag is the last gate step, after all 12 green, before the D-05 cleanup delete.

## Claude's Discretion

- Exact npm alias for the gate runner (`gate` / `launch:gate` / `smoke:gate`).
- Exact `+tag` local-parts for the D-04 test emails (the `+tag` contract is the lock).
- Whether `launch-gate.mjs` is self-contained or shells the existing smoke-* scripts internally (single verdict + single re-run command must hold).
- Plan/wave split (contrast-fix → runner → operator gate run + evidence → tag → cleanup).
- AC3 tz-spoof technique (CDP `Emulation.setTimezoneOverride` vs. `TZ=` launch).
- Whether AC11 needs the Phase-6 `preventDefault + setTimeout` swap (apply only if live drop rate is unacceptable — a D-01 small fix).
- AC3 persistence-assertion path (prod-DB read vs. `/manage` read-back vs. label + email tzLabel) — pinned at plan time; not a user decision.

## Deferred Ideas

- Playwright / real test framework — rejected for v2.0; revisit post-launch.
- Outlook cross-client coverage — out of scope for v2.0 (Phase 10 closed decision).
- AC1 visual-diff vs. `references/landing_preview.png` — MILESTONE-only, best-effort if the reference image exists; don't block launch on a missing asset.
- Automated Plausible / opengraph.xyz polling — manual operator evidence per Phase-10 precedent.
- Layout.astro refactor — standing v1.1 deferral; do NOT bundle with the D-02 contrast commit.
