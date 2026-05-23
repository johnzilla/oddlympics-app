# Roadmap: oddlympics

## Milestones

- ✅ **v1 MVP** — Phases 1–4 (shipped on `main` 2026-05-08 → 2026-05-11; Phase 4 is a launch-week observation checkpoint 2026-06-11 → 2026-06-14)
- ✅ **v2.0 Consumer Landing & Signup Flow** — Phases 5–12 (shipped 2026-05-16, tagged `v1.0-consumer-landing`)
- 🚧 **v2.1 Referral & Social Sharing** — Phases 13–15 (active, started 2026-05-22, hard target 2026-06-11)

Active milestone: **v2.1 Referral & Social Sharing**. Project remains in
launch-readiness mode until World Cup group stage on **2026-06-11** — see
"Pending operator actions" below. Deferred (no schedule): Telegram bot,
Lightning tip jar, niche-sport long tail.

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

### 🚧 v2.1 Referral & Social Sharing (Active)

**Milestone Goal:** Turn every new signup into a referral channel — let a user
share their personalized World Cup signup and track which signups it drives
back. Lightweight attribution (a code + `?ref=` param + `referred_by` column);
no rewards, no leaderboard. Hard target **2026-06-11**.

- [x] **Phase 13: Referral Code & Attribution** - Every signup gets a stable referral code; `?ref=CODE` threads through signup into a `referred_by` column (completed 2026-05-22)
- [x] **Phase 14: Share Experience** - Personalized, team-named share prompts with native share sheet on `/pending`, `/confirmed`, `/manage`, and the confirmation email (completed 2026-05-23)
- [ ] **Phase 15: Personalized Open Graph** - Per-team OG images and a server-rendered referral route so a shared link unfurls with the sharer's team

## Phase Details

### Phase 13: Referral Code & Attribution

**Goal**: Every signup has a unique, stable, public referral code, and the signup path records which code (if any) drove a new signup — making share-driven signups measurable.
**Depends on**: Phase 12 (v2.0 signup flow + `vip_signups` schema)
**Requirements**: REF-01, REF-02, REF-03
**Success Criteria** (what must be TRUE):

  1. Every existing and new `vip_signups` row has a unique, stable referral code (additive `pragma_table_info` probe + `ALTER TABLE ADD COLUMN` migration; backfill for existing rows; re-running the migration is a no-op).
  2. Visiting `/?ref=CODE` carries the code through the signup form so it is submitted with the POST (hidden field, read client-side on the prerendered landing page — same pattern as the `?error=`/`?email=` inline-script trick).
  3. After a signup that arrived via `/?ref=CODE`, the new `vip_signups` row has its `referred_by` column set to that code; a direct (no-ref) signup leaves `referred_by` NULL.
  4. An unknown, malformed, or self-referencing `?ref=` value never blocks or errors the signup — it is silently ignored (`referred_by` stays NULL), preserving the v2.0 "signup never rejects" contract.

**Plans**: 4 plans

Plans:
**Wave 1**

- [x] 13-01-PLAN.md — Schema: referral_code + referred_by columns, unique index, backfill, code generator, 8-param COALESCE-protected upsert, lookupByReferralCode (Wave 1)
- [x] 13-03-PLAN.md — `index.astro` carry-through: hidden ref field + defensive inline-script reading ?ref= and localStorage (Wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 13-02-PLAN.md — `/api/signup` ref resolution: generate code, resolve submitted ref to referred_by, never reject on bad ref (Wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 13-04-PLAN.md — Verification + measurement: smoke-signup.mjs referral cases + DEPLOY.md Day-2 referral-counting SQL recipe (Wave 3)

### Phase 14: Share Experience

**Goal**: A user who has signed up is prompted, in every natural place, to share their personalized referral link with team-named copy and a native share sheet — closing the referral loop the codes from Phase 13 enable.
**Depends on**: Phase 13 (referral code must exist before it can be shared)
**Requirements**: SHARE-01, SHARE-02, SHARE-03, SHARE-04
**Success Criteria** (what must be TRUE):

  1. `/pending`, `/confirmed`, and `/manage` each show a share prompt containing the user's referral link (`/?ref=CODE`).
  2. The confirmation email body includes a personalized share line plus the user's referral link.
  3. The share action opens the native share sheet on supporting devices (Web Share API) and falls back to a visible copy-link control where the API is unavailable.
  4. The shared message names the user's team — e.g. "I'm following USA — get your team's World Cup kickoff alerts" — sourced from the same `references/teams.json` label data used elsewhere.

**Plans**: 5 plans
**UI hint**: yes

Plans:
**Wave 1** *(parallel — no file overlap)*

- [x] 14-01-PLAN.md — Copy helper: add `shareText(teamLabel, url)` to `src/lib/copy.ts` (D-08, D-11; contract for Wave 2)
- [x] 14-02-PLAN.md — API redirect plumbing: `/api/signup` appends `&rc=&team=`, `/api/confirm` appends `&rc=` on status=ok/already (D-01, D-02, D-15)

**Wave 2** *(14-03 and 14-04 both depend on Wave 1; 14-03 additionally depends on 14-02 because Task 2 modifies the sendMagicLink call site in src/pages/api/signup.ts that 14-02 also touches — within-wave ordering preserves the 14-03/14-04 parallelism otherwise)*

- [x] 14-03-PLAN.md — Email integration: `sendMagicLink` 5th `referralCode` param + share `<p>` in HTML body and plaintext; updates the call site in `/api/signup.ts` to pass `row.referral_code` (D-12, D-13, D-14; depends on 14-01, 14-02)
- [x] 14-04-PLAN.md — Share UI on three surfaces: `/pending` + `/confirmed` (prerendered, `?rc=` reader) + `/manage` (server-rendered from `user.referral_code`) with Web Share API + clipboard fallback (D-03, D-05, D-06, D-15, D-16, D-17; depends on 14-01, 14-02)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 14-05-PLAN.md — Smoke extension: SHARE-pending-card + SHARE-confirmed-card response-body greps + SHARE-confirm-redirect-location (mint token, GET /api/confirm with redirect: 'manual', assert 303 Location carries &rc=<row.referral_code>) in `scripts/smoke-signup.mjs` (D-18, D-19; depends on 14-01..14-04)

### Phase 15: Personalized Open Graph

**Goal**: When a referral link is shared on a social platform, the link preview unfurls with an image of the sharer's team — making the share visually personal. Resolve the server-rendered-referral-route mechanism so a prerendered landing page can still serve per-referrer OG meta.
**Depends on**: Phase 14 (share links must exist and be in circulation)
**Requirements**: OG-02, OG-03
**Success Criteria** (what must be TRUE):

  1. A per-team Open Graph image exists for each of the 48 World Cup teams (pre-rendered at build time via the resvg toolchain + fonts vendored in v2.0 Phase 8; each ≤300KB, 1200×630).
  2. A shared referral link resolves to a route that sets OG/Twitter meta tags pointing at the sharer's team image — implemented via a server-rendered share/referral route (e.g. `/r/CODE` that looks up code → team → team image) since the landing page `/` is `prerender = true` and cannot vary its meta per referrer.
  3. Pasting a referral link into a social unfurl preview (or an OG validator) shows the sharer's team image and personalized title, not the generic `/og-image.png`.
  4. If the per-team image set cannot be completed within the runway, the route still unfurls with personalized text over the existing generic `/og-image.png` — the share loop never breaks on a missing image. (Scope-trim fallback: this is the milestone's long pole and first trim candidate.)

**Plans**: TBD
**UI hint**: yes

Plans:

- [ ] 15-01: TBD
- [ ] 15-02: TBD

## Pending operator actions (pre-launch, milestone-independent)

Must complete before group-stage kickoff **2026-06-11**:

1. Fire the launch blast — `scripts/launch-blast.mjs --send` (currently dry-run)
2. Flip kickoff notifications live — `KICKOFF_NOTIFICATIONS_ENABLED=true` in `/etc/oddlympics.env`, restart `oddlympics-notify.timer`
3. End-to-end smoke of one real kickoff notification before 2026-06-11
4. Verify football-data.org name→slug mapping (kickoff-cron silent-loss risk — memory: `notify-slug-mapping-launch-risk`)

## Progress

**Execution Order:**
Phases execute in numeric order: 13 → 14 → 15

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
| 13. Referral Code & Attribution | v2.1 | 4/4 | Complete    | 2026-05-22 |
| 14. Share Experience | v2.1 | 5/5 | Complete    | 2026-05-23 |
| 15. Personalized Open Graph | v2.1 | 0/TBD | Not started | - |
