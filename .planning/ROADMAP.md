# Roadmap: oddlympics v1 MVP

## Overview

The teaser is live and collecting emails. This milestone turns it into the actual product before
World Cup group stage kicks off on **2026-06-11** (33 days from 2026-05-09). The roadmap is
trimmed for the deadline: solo developer, evenings + weekends, ~60-80 hours of focused work.
Anything not strictly required for the core value loop (pick a team → see your schedule →
get a kickoff email) is deferred to v1.1.

The core value loop ships in Phases 2 + 3. Phase 1 hardening is essentially done in-repo.
Phase 2.5 (launch comms) is the bridge that converts the existing teaser list into actual
Phase-2 users.

## Phases

- [x] **Phase 1: Pre-launch Hardening** — fixes + safety guards on the existing teaser
- [ ] **Phase 2: Identity & Personal Schedule** — magic-link return flow, team picker, schedule data, personal schedule page
- [ ] **Phase 2.5: Launch Comms** — email the existing teaser list to invite them to pick teams
- [ ] **Phase 3: Kickoff Notifications** — email ~60 min before each subscribed match (idempotent)
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

### Phase 2: Identity & Personal Schedule
**Goal**: A signed-up user can request a magic-link, pick the teams they follow, and see their personal schedule with all kickoffs in their browser's local time zone.
**Depends on**: Phase 1
**Requirements**: IDENT-01, IDENT-02, IDENT-03, IDENT-04, IDENT-05, DATA-01, DATA-02, DATA-04
**Success Criteria**:
  1. A user already in the teaser list can request a new magic-link from the homepage and land on a team-selection page (no separate signup).
  2. The team picker shows all 48 World Cup 2026 teams; selection is multi-select; selection persists.
  3. A user who returns later via magic-link sees their previous selection and can edit it.
  4. The personal schedule page shows only matches involving selected teams, kickoffs in browser local time.
  5. Schedule data is ingested from a free public API (football-data.org or similar) into local SQLite, refreshed nightly. Failures log + alert; the app never serves silently-stale data.

**Risk**: DATA-01's external API is the only real unknown. Spike it early — pick a provider, get a key, write a 50-line ingestor against the actual JSON. If the chosen API can't deliver World Cup 2026 fixtures, you need to know in week 1, not week 4.

**UI hint**: yes (team picker + schedule are user-facing surfaces)

### Phase 2.5: Launch Comms
**Goal**: Convert the existing teaser-list signups into Phase-2 users by emailing them a "pick your teams" magic-link.
**Depends on**: Phase 2
**Requirements**: LAUNCH-01
**Success Criteria**:
  1. A single email blast goes out to all confirmed (and not-unsubscribed) rows in `vip_signups` with a one-click magic-link to the team-picker page.
  2. The blast is throttled enough to stay inside Resend's free-tier rate limits.
  3. Conversions are visible in Plausible (link click → team picker → schedule page funnel).
  4. The team-picker page exposes an optional free-text field — "Which other championship do you want us to cover next?" — and submissions persist to the database for v1.1 prioritization. Field is optional; empty submissions are valid; the field must not gate conversion.

**Why this is its own phase**: it's the moment v1 actually launches to real users. Worth treating as deliberate work, not an afterthought tacked onto Phase 2.

### Phase 3: Kickoff Notifications
**Goal**: Subscribed users receive an email ~60 minutes before each match they care about, in their local time, with no duplicates.
**Depends on**: Phase 2
**Requirements**: NOTIFY-01, NOTIFY-03, NOTIFY-04
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
| 2. Identity & Personal Schedule | 0/TBD | Not started | - |
| 2.5. Launch Comms | 0/TBD | Not started | - |
| 3. Kickoff Notifications | 0/TBD | Not started | - |
| 4. Launch Week Observation | 0/TBD | Not started | - |

**Execution order:** 2 → 2.5 → 3 → 4
