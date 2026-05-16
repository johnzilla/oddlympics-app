# Milestones

## v2.0 Consumer Landing & Signup Flow (Shipped: 2026-05-16)

**Phases:** 8 (5–12) · **Plans:** 32 · **Tasks:** 42
**Timeline:** 2026-05-12 → 2026-05-16 (5 days)
**Release:** `v1.0-consumer-landing` (annotated, on deploy commit, pushed to origin)
**Production:** live at https://oddlympics.app (HTTP 200), launch gate green

**Delivered:** Replaced the indie/builder teaser with a consumer-targeted World
Cup 2026 product surface — two-field signup, legal pages, OG image, multi-team
`/manage` editor, and a team+timezone confirmation email — all gate-verified on
production before group-stage kickoff (2026-06-11).

**Key accomplishments:**

- **Phase 5 — Schema + signup payload:** 48-team canonical `references/teams.json` + `teams.slug` column; first non-additive SQLite migration in project history (`team TEXT` added, `selected_teams` dropped, version-asserted + pre-deploy backup); `/api/signup` widened with 48-slug allow-list + IANA-tz fallback (`America/New_York`, never rejects), pre-flight chain byte-identical. `smoke-signup.mjs` 8/8 PASS.
- **Phase 6 — Landing page:** full `index.astro` rewrite to consumer World Cup landing (banner pill, headline, JS tz label, 48-team confederation `<select>`, 4 below-fold sections, 5-item FAQ, consumer footer); 13 OG/Twitter meta tags; zero prohibited terms; Lighthouse mobile Perf 1.00 / A11y 0.94→AA-fixed / BP 1.00 / SEO 1.00.
- **Phase 7 — Legal pages:** `/privacy` + `/terms` on the shared site shell, last-updated matching deploy.
- **Phase 8 — Open Graph image:** `/og-image.png` 1200×630 <300KB rendered from a checked-in source SVG via vendored resvg + fonts.
- **Phase 9 — `/manage` editor + unsubscribe:** dual-mode editor, per-purpose token TTL table (1-year single-use unsubscribe), one-time backfill banner, `/schedule`→`/manage` 301.
- **Phase 10 — Confirmation email:** body names team + human-readable timezone; custom Resend domain `hello@oddlympics.app` live, Mail-Tester 10/10, Gmail + Proton cross-client verified.
- **Phase 11 — Launch gate:** AC1–AC12 + Lighthouse green on production; `v1.0-consumer-landing` tagged + pushed; AC-MT operator-approved on the Phase-12 evidence basis.
- **Phase 12 — Restore multi-team:** `user_teams` join table, `/manage` 1–5 confederation checkboxes, kickoff-cron fan-out via `user_teams` (one-email-per-match preserved), CR-01/CR-02 consent-contract gap-closure, smoke M1–M16 green.

**Reconciliation notes (close, 2026-05-16):**

- The `v2.0-MILESTONE-AUDIT.md` (run 2026-05-13, `gaps_found`) predated Phases
  7–12. Its 6 "orphaned" requirements were all closed by work that landed
  2026-05-14→16; superseded by the Phase 11 production launch gate (a strict
  superset). Closed on launch-gate evidence by owner decision.
- REQUIREMENTS.md traceability for SIGNUP-01/02/03 + COMPAT-02 (Phase 5)
  lagged the code; flipped `Pending`→`Complete` at close — verified by Phase 5
  `smoke-signup.mjs` 8/8 + Phase 11 prod gate (AC9/AC10/AC12). Stale-checkbox
  correction, not deferred gaps. **20/20 v2.0 requirements complete.**
- Quick task `260511-ccx` (Phase 2.5 SC4 demand-capture) reconciled: summary
  filename + `status: complete` frontmatter corrected to match shipped reality
  (commits `ed77383`, `6129910`, 2026-05-11).

**Known deferred items at close:** 0

**Standing v1.1 deferrals (not gaps):** Telegram bot (NOTIFY-02), Lightning
tip jar via vaultwarden (TIP-01/02), niche-sport long tail. One pre-launch
operator item, milestone-independent: football-data.org name→slug mapping
check before 2026-06-11 (kickoff-cron silent-loss risk).

---
