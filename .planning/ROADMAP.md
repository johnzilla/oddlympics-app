# Roadmap: oddlympics

## Milestones

- ✅ **v1 MVP** — Phases 1–4 (shipped on `main` 2026-05-08 → 2026-05-11; Phase 4 is a launch-week observation checkpoint 2026-06-11 → 2026-06-14)
- ✅ **v2.0 Consumer Landing & Signup Flow** — Phases 5–12 (shipped 2026-05-16, tagged `v1.0-consumer-landing`)

No active milestone. Project is in launch-readiness mode until World Cup
group stage on **2026-06-11** — see "Pending operator actions" below.
Deferred (no schedule): Telegram bot, Lightning tip jar, niche-sport long tail.

## Phases

<details>
<summary>✅ v2.0 Consumer Landing & Signup Flow (Phases 5–12) — SHIPPED 2026-05-16</summary>

Full detail: [`milestones/v2.0-ROADMAP.md`](milestones/v2.0-ROADMAP.md) · Requirements: [`milestones/v2.0-REQUIREMENTS.md`](milestones/v2.0-REQUIREMENTS.md) · Audit: [`milestones/v2.0-MILESTONE-AUDIT.md`](milestones/v2.0-MILESTONE-AUDIT.md)

- [x] Phase 5: Schema + signup payload (6/6) — completed 2026-05-13
- [x] Phase 6: Landing page + form + meta + analytics (3/3) — completed 2026-05-13
- [x] Phase 7: Legal pages (2/2) — completed 2026-05-14
- [x] Phase 8: Open Graph image (1/1) — completed 2026-05-14
- [x] Phase 9: `/manage` editor + unsubscribe (5/5) — completed 2026-05-14
- [x] Phase 10: Confirmation email update (3/3) — completed 2026-05-16
- [x] Phase 11: End-to-end + launch gate (4/6; 2 operator-gate plans summary-less by design) — completed 2026-05-16
- [x] Phase 12: Restore multi-team selection (6/6) — completed 2026-05-16

</details>

<details>
<summary>✅ v1 MVP (Phases 1–4) — SHIPPED on `main` 2026-05-08 → 2026-05-11</summary>

Five phases (1, 2, 2.5, 3, 4) turned the teaser landing into a working World
Cup notification product. Phase 1 has full GSD artifacts under
`.planning/phases/01-pre-launch-hardening/`; Phases 2, 2.5, 3 were shipped
speed-mode (no phase-dir artifacts); Phase 4 is the launch-week observation
checkpoint scheduled **2026-06-11 → 2026-06-14**.

- [x] Phase 1: Pre-launch Hardening (HARDEN-01/02/03/04/06) — `confirmed.astro` fix, `/api/unsubscribe`, CSP enforce, default-deny missing Origin, 24h magic-link TTL; DO Backups enabled 2026-05-10
- [x] Phase 2: Identity & Personal Schedule (IDENT-01…05, DATA-01/02/04) — magic-link sign-in, team picker, browser-tz capture, football-data.org ingestor + nightly timer, 30-day sliding sessions
- [x] Phase 2.5: Launch Comms (LAUNCH-01 + SC4) — `scripts/launch-blast.mjs` (dry-run by default), demand-capture `feature_requests` table
- [x] Phase 3: Kickoff Notifications (NOTIFY-01/03/04) — `oddlympics-notify.timer` every 5 min, dry-run pending `KICKOFF_NOTIFICATIONS_ENABLED=true`
- [ ] Phase 4: Launch Week Observation — scheduled 2026-06-11 → 2026-06-14 (post-launch checkpoint, not yet executed)

</details>

## Pending operator actions (pre-launch, milestone-independent)

Must complete before group-stage kickoff **2026-06-11**:

1. Fire the launch blast — `scripts/launch-blast.mjs --send` (currently dry-run)
2. Flip kickoff notifications live — `KICKOFF_NOTIFICATIONS_ENABLED=true` in `/etc/oddlympics.env`, restart `oddlympics-notify.timer`
3. End-to-end smoke of one real kickoff notification before 2026-06-11
4. Verify football-data.org name→slug mapping (kickoff-cron silent-loss risk — memory: `notify-slug-mapping-launch-risk`)

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1. Pre-launch Hardening | v1 MVP | —/— | Complete | 2026-05-11 |
| 2. Identity & Personal Schedule | v1 MVP | —/— | Complete | 2026-05-11 |
| 2.5. Launch Comms | v1 MVP | —/— | Complete | 2026-05-11 |
| 3. Kickoff Notifications | v1 MVP | —/— | Complete | 2026-05-11 |
| 4. Launch Week Observation | v1 MVP | —/— | Scheduled | 2026-06-11 → 06-14 |
| 5. Schema + signup payload | v2.0 | 6/6 | Complete | 2026-05-13 |
| 6. Landing page + form + meta | v2.0 | 3/3 | Complete | 2026-05-13 |
| 7. Legal pages | v2.0 | 2/2 | Complete | 2026-05-14 |
| 8. Open Graph image | v2.0 | 1/1 | Complete | 2026-05-14 |
| 9. `/manage` editor + unsubscribe | v2.0 | 5/5 | Complete | 2026-05-14 |
| 10. Confirmation email update | v2.0 | 3/3 | Complete | 2026-05-16 |
| 11. End-to-end + launch gate | v2.0 | 4/6 | Complete | 2026-05-16 |
| 12. Restore multi-team selection | v2.0 | 6/6 | Complete | 2026-05-16 |
