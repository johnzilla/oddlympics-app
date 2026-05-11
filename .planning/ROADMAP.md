# Roadmap: oddlympics v1 MVP

## Overview

The teaser is live and collecting emails. This milestone turns it into the actual product before
World Cup group stage kicks off on **2026-06-11**. The roadmap is trimmed for the deadline:
solo developer, evenings + weekends.

**As of 2026-05-11:** Phases 1, 2, 2.5, 3 are all shipped on `main`. Phase 1 has full GSD
planning artifacts; Phases 2, 2.5, 3 were shipped speed-mode without going through the GSD
discuss → plan → execute → verify workflow (see per-phase **Status** lines below for the
implementation commits). The remaining work is operational (fire the launch blast, flip
notifications to live) plus Phase 4 — a planned post-launch observation checkpoint during
the first weekend of group stage.

## Phases

- [x] **Phase 1: Pre-launch Hardening** — fixes + safety guards on the existing teaser
- [x] **Phase 2: Identity & Personal Schedule** — magic-link return flow, team picker, schedule data, personal schedule page *(shipped on `main`, no GSD artifact)*
- [x] **Phase 2.5: Launch Comms** — email the existing teaser list to invite them to pick teams *(code shipped, blast unsent — no GSD artifact)*
- [x] **Phase 3: Kickoff Notifications** — email ~60 min before each subscribed match (idempotent) *(shipped on `main` in dry-run mode, no GSD artifact)*
- [ ] **Phase 4: Launch Week Observation** — watch real kickoff notifications during World Cup group-stage opening weekend (2026-06-11 → 2026-06-14)

## Phase Details

### Phase 1: Pre-launch Hardening — DONE (in-repo)
**Goal**: Fix known bugs and close compliance gaps in the existing teaser before mass-emailing real users.
**Requirements**: HARDEN-01, HARDEN-02, HARDEN-03, HARDEN-04, HARDEN-06
**Status**: All in-repo work merged. Commits on `main`.

Plans:
- [x] 01-01 — HARDEN-01: confirmed.astro renders correct copy for all `?status=` values
- [x] 01-02 — HARDEN-03: `/api/signup` rejects POSTs with no Origin header
- [x] 01-03 — HARDEN-06: magic-link TTL 7d → 24h
- [x] 01-04 — HARDEN-02: full unsubscribe slice (DB column, token purpose, /api/unsubscribe, /unsubscribed page, RFC 8058 helper)
- [x] 01-05 — HARDEN-04: enforcing `Content-Security-Policy` header in Caddyfile

**Operator actions:**
- [x] **DigitalOcean Backups** enabled in the droplet dashboard (~$1.20/mo) — replaces the originally-planned Backblaze B2 setup. Done 2026-05-10.

### Phase 2: Identity & Personal Schedule — SHIPPED (no GSD artifact)
**Goal**: A signed-up user can request a magic-link, pick the teams they follow, and see their personal schedule with all kickoffs in their browser's local time zone.
**Depends on**: Phase 1
**Requirements**: IDENT-01, IDENT-02, IDENT-03, IDENT-04, IDENT-05, DATA-01, DATA-02, DATA-04
**Status**: Shipped on `main` without going through the GSD planning workflow — no `.planning/phases/02-*` directory exists. Implementation commits: `fa70514` (teams + matches schema), `c010531` (football-data.org ingestor), `60631cb` (selected_teams + timezone columns), `2e4799c` + `756bef5` (manage magic-link flow), `384a834` (/schedule + /api/save-selection), `b361288` (cookie sessions, 30d sliding), `381dfbb` (manual TZ override), `911b445` (nightly schedule refresh timer).
**Success Criteria**:
  1. A user already in the teaser list can request a new magic-link from the homepage and land on a team-selection page (no separate signup).
  2. The team picker shows all 48 World Cup 2026 teams; selection is multi-select; selection persists.
  3. A user who returns later via magic-link sees their previous selection and can edit it.
  4. The personal schedule page shows only matches involving selected teams, kickoffs in browser local time.
  5. Schedule data is ingested from a free public API (football-data.org or similar) into local SQLite, refreshed nightly. Failures log + alert; the app never serves silently-stale data.

**Risk**: DATA-01's external API is the only real unknown. Spike it early — pick a provider, get a key, write a 50-line ingestor against the actual JSON. If the chosen API can't deliver World Cup 2026 fixtures, you need to know in week 1, not week 4.

**UI hint**: yes (team picker + schedule are user-facing surfaces)

### Phase 2.5: Launch Comms — SHIPPED (no GSD artifact, blast unsent)
**Goal**: Convert the existing teaser-list signups into Phase-2 users by emailing them a "pick your teams" magic-link.
**Depends on**: Phase 2
**Requirements**: LAUNCH-01
**Status**: Code shipped on `main` (`scripts/launch-blast.mjs` ready, dry-run by default, requires explicit `--send`) without going through the GSD planning workflow — no `.planning/phases/02.5-*` directory exists. Implementation commit: `cc1f47d` (launch-blast mechanism). The blast itself has not been fired yet — that's an outstanding operator action, not a coding gap. Success criterion 4 (demand-capture field) was added 2026-05-11 and is not yet implemented in code.
**Success Criteria**:
  1. A single email blast goes out to all confirmed (and not-unsubscribed) rows in `vip_signups` with a one-click magic-link to the team-picker page.
  2. The blast is throttled enough to stay inside Resend's free-tier rate limits.
  3. Conversions are visible in Plausible (link click → team picker → schedule page funnel).
  4. The team-picker page exposes an optional free-text field — "Which other championship do you want us to cover next?" — and submissions persist to the database for v1.1 prioritization. Field is optional; empty submissions are valid; the field must not gate conversion.

**Why this is its own phase**: it's the moment v1 actually launches to real users. Worth treating as deliberate work, not an afterthought tacked onto Phase 2.

### Phase 3: Kickoff Notifications — SHIPPED (no GSD artifact, dry-run)
**Goal**: Subscribed users receive an email ~60 minutes before each match they care about, in their local time, with no duplicates.
**Depends on**: Phase 2
**Requirements**: NOTIFY-01, NOTIFY-03, NOTIFY-04
**Status**: Code shipped on `main` without going through the GSD planning workflow — no `.planning/phases/03-*` directory exists. Implementation commit: `f276c59` (kickoff notification cron — NOTIFY-01, 03, 04). The `oddlympics-notify.timer` is running every 5 minutes in dry-run mode; flipping `KICKOFF_NOTIFICATIONS_ENABLED=true` activates real sends. That env-var flip is an outstanding operator action.
**Success Criteria**:
  1. A user receives an email ~60 min before each subscribed match: teams, kickoff in their TZ, no-login link to their schedule.
  2. Re-running the scheduler does not double-send. One notification per (user, match, channel).
  3. The no-login schedule link in the email resolves to the user's full schedule without re-authenticating.

**UI hint**: only the email template; no new pages.

### Phase 4: Launch Week Observation
**Goal**: Watch real kickoff notifications fire during the World Cup group-stage opening weekend (2026-06-11 through 2026-06-14), confirm delivery health, and collect early user feedback before the tournament hits full stride.
**Depends on**: Phase 3
**Requirements**: (none — operational checkpoint, not new product surface)
**Success Criteria**:
  1. Notifications for the first match (Mexico vs. opening opponent, kickoff 2026-06-11) are observed to send on time; spot-check at least 3 subscribed users confirm receipt + correct local-time rendering.
  2. `match_notifications` rows show no duplicates after the weekend; idempotency holds under real load.
  3. Bounce / complaint rate from Resend stays under 2% across the weekend; if higher, root cause is logged and a remediation issue filed.
  4. At least one inbound user feedback channel is monitored (Resend reply-to inbox, Plausible funnel, or a one-line "how was it?" reply prompt in the notification email); concrete feedback items are captured for v1.1 triage.
  5. A short post-weekend writeup lands in-repo (decisions, surprises, what to fix in v1.1) — even one paragraph.

**Why this is its own phase**: shipping Phase 3 is not the same as confirming it works in production. The first 72 hours of real kickoff notifications are the actual proof; treating them as a planned checkpoint (not "we're done") forces real observation and creates the feedback loop that informs v1.1 priorities.

**UI hint**: none — operational/observation work.

## Deferred to v1.1 (post-launch)

These were originally in the v1 scope but are not required for the World Cup launch. Re-prioritize after the first weekend of group-stage notifications has run cleanly.

- **Telegram notifications** (was NOTIFY-02): bot token, /start handler, deep-link verification, webhook/polling. Real ops surface; email-only is a complete product for v1.
- **Lightning tip jar** (was Phase 4 / TIP-01, TIP-02): the **vaultwarden** integration shape needs proper design time. Ship v1 without it; add a hardcoded LNURL or `lightning:` URI in the email footer if you want a placeholder. Real integration in v1.1.
- **Schedule admin override** (was DATA-03): editing match rows by hand. FIFA's API isn't going to silently misreport kickoff times; if it does, the next nightly refresh fixes it. Build only if a real incident demands it.

## Progress

| Phase | Plans | Status | Completed |
|-------|-------|--------|-----------|
| 1. Pre-launch Hardening | 5/5 | Done (in-repo) | 2026-05-09 |
| 2. Identity & Personal Schedule | — | Shipped (no GSD artifact) | 2026-05-10 |
| 2.5. Launch Comms | — | Code shipped, blast unsent | 2026-05-10 |
| 3. Kickoff Notifications | — | Shipped in dry-run | 2026-05-10 |
| 4. Launch Week Observation | 0/TBD | Not started | - |

**Execution order:** 4 (post-launch checkpoint) — phases 2/2.5/3 already shipped without GSD planning artifacts.

## Outstanding operator actions (pre-launch)

- [ ] Implement Phase 2.5 success criterion 4 — demand-capture free-text field on `/schedule` (added 2026-05-11, not yet in code)
- [ ] Fire the launch blast — `scripts/launch-blast.mjs --send` (currently dry-run)
- [ ] Flip kickoff notifications to live — set `KICKOFF_NOTIFICATIONS_ENABLED=true` on the droplet (`/etc/oddlympics.env`) and restart `oddlympics-notify.timer`
- [ ] End-to-end smoke test of one real kickoff notification before group stage opens 2026-06-11
