# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v2.0 — Consumer Landing & Signup Flow

**Shipped:** 2026-05-16
**Phases:** 8 (5–12) | **Plans:** 32 | **Timeline:** 5 days (2026-05-12 → 2026-05-16)

### What Was Built
- Consumer World Cup 2026 landing rewrite (two-field signup, JS tz label, 48-team confederation dropdown, 4 sections, FAQ, consumer footer, 13 OG/Twitter meta tags)
- `/api/signup` widening — `team` allow-list + IANA-tz fallback, additive contract, first non-additive SQLite migration (`selected_teams`→`team`, version-asserted)
- `/privacy` + `/terms` legal pages, `/og-image.png` from checked-in source SVG
- `/manage` multi-team editor (`user_teams` join, 1–5 confederation checkboxes) + 1-year single-use unsubscribe tokens
- Team+timezone confirmation email; custom Resend domain live, Mail-Tester 10/10
- Production AC1–AC12 launch gate + `v1.0-consumer-landing` tag

### What Worked
- **Dry-run-by-default safety pattern** carried cleanly into every outbound/migration script (backup-pre-05, cleanup-gate-rows) — no production accidents.
- **Smoke scripts as the test substitute** (`smoke-signup` 8/8, `smoke-manage` M1–M16) gave real end-to-end proof without standing up a test framework — right call for a solo free app.
- **Phase 12 inserted late** (multi-team restore) and the launch gate re-ran after it cleanly — the dependency inversion (Phase 11 depends on 12, not vice-versa) was caught and documented (D-09) rather than silently mis-ordered.
- Tight 5-day execution against a hard external deadline; coarse granularity + speed-mode where artifacts didn't add value.

### What Was Inefficient
- **Tracking drift.** The milestone audit (2026-05-13) was never re-run after Phases 7–12 landed; REQUIREMENTS.md traceability for 4 Phase-5 reqs stayed `Pending` on shipped+verified code; a completed quick task's summary filename never matched its plan contract. All three surfaced as false "open work" at milestone close and needed reconciliation. The work was done correctly — only the bookkeeping lagged.
- The single-team→multi-team round trip (Phase 5 collapsed `selected_teams`; Phase 12 restored it via `user_teams`) was avoidable churn — the v1 multi-team model was dropped at schema time before the post-signup requirement was fully reconciled.
- CR-01/CR-02 consent regressions in Phase 12 needed a gap-closure wave (12-05/06) — caught by verification, but should have been in the original plan.

### Patterns Established
- **Per-purpose token TTL table** (`TTL_BY_PURPOSE` in `token.ts`) — replace scalar TTLs when a token type needs a different lifetime.
- **`user_teams` join table** as the canonical multi-select shape; cron fans out through it; one-email-per-match guarantee inherited from the join, not app logic.
- **Stale-tracking-is-not-debt:** at milestone close, distinguish "bookkeeping lagged shipped+verified code" from real deferred gaps — reconcile the metadata truthfully, don't record phantom "Known Gaps."
- Headless-Chrome-without-system-Chrome (`@puppeteer/browsers install chrome-headless-shell`) for Lighthouse + DOM verification — reusable for any browser-driven gate.

### Key Lessons
1. **Re-run the milestone audit at close, not just mid-milestone.** A `gaps_found` audit 3 days stale reads as a blocker; the launch gate (a strict superset) was the real source of truth.
2. **Flip requirement traceability when the code lands, not at close.** Four `Pending` rows on shipped code created false close-time friction.
3. **Don't collapse a working data model before its replacement requirement is reconciled.** The selected_teams→team→user_teams round trip was process churn, not product progress.
4. **Quick-task summary filenames must match the audit scanner's expectation** (`SUMMARY.md` + `status: complete` frontmatter), or completed work reads as missing.

### Cost Observations
- Model mix: planner Opus, executor Sonnet (balanced profile) — appropriate for the deadline.
- Notable: speed-mode (no discuss/plan artifacts) for v1 Phases 2/2.5/3 traded traceability for velocity; v2.0 used full artifacts and the bookkeeping drift above shows artifacts still need active maintenance to stay truthful.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Key Change |
|-----------|--------|------------|
| v1 MVP | 1–4 | Speed-mode shipping; only Phase 1 has full GSD artifacts |
| v2.0 | 5–12 | Full discuss/plan/execute artifacts; smoke scripts as test substitute; late phase insertion (12) handled cleanly |

### Cumulative Quality

| Milestone | Tests | Zero-Dep Additions |
|-----------|-------|--------------------|
| v1 MVP | manual curl smokes | better-sqlite3, resend |
| v2.0 | `smoke-signup` 8/8, `smoke-manage` M1–M16, `smoke-landing` 18, `smoke-confirm` 10 | resvg-js + vendored fonts (Phase 8) |

### Top Lessons (Verified Across Milestones)

1. Dry-run-by-default for every outbound/migration script — zero production accidents across two milestones.
2. Smoke scripts beat a test framework for a solo free app — fast to write, real end-to-end proof, no ceremony.
3. Planning artifacts only stay trustworthy if bookkeeping is updated when code lands, not at milestone close.
