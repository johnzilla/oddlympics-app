# Requirements: oddlympics v1 MVP

**Defined:** 2026-05-08
**Core Value:** A user picks their team and gets a kickoff notification in their local time, on time, before group stage 2026-06-11.

## v1 Requirements

Requirements for v1 launch on or before **2026-06-11** (World Cup group stage kickoff). Each maps to one roadmap phase.

### Hardening (existing teaser)

Pre-launch fixes to the existing v1 teaser app that must land before mass-emailing real users.

- [ ] **HARDEN-01**: `/confirmed` page renders the correct copy for each `?status=` value (`ok`, `already`, `bad-token`, `unknown`) — currently always shows the success page due to prerender + frontmatter `searchParams` read
- [ ] **HARDEN-02**: User can unsubscribe via a one-click link present in every notification email (also a `/api/unsubscribe` endpoint)
- [ ] **HARDEN-03**: Cross-origin POST `/api/signup` requests with missing `Origin` header are rejected by default (no `return true` on absent header)
- [ ] **HARDEN-04**: Caddy serves a `Content-Security-Policy` header that allows Plausible + own inline scripts and blocks everything else
- [ ] **HARDEN-05**: SQLite database is automatically backed up off-droplet daily (rclone → S3/B2 or equivalent), with documented restore procedure
- [ ] **HARDEN-06**: Magic-link tokens are revoked on first successful use OR have a TTL of ≤ 24 hours (currently 7 days, replayable)

### Identity & Personalization

How a user gets a personalized schedule.

- [ ] **IDENT-01**: User identifies themselves via magic-link only (no password); flow extends the existing teaser's signup → email → confirm pattern
- [ ] **IDENT-02**: User can pick 1+ teams from a list of all 48 World Cup 2026 teams during signup or first-visit-after-confirm
- [ ] **IDENT-03**: User's selection persists in SQLite, keyed off the same `vip_signups` row used by the teaser (no second user table)
- [ ] **IDENT-04**: User can return later via a magic-link request and edit their team selection
- [ ] **IDENT-05**: User's local time zone is captured (browser-detected via `Intl.DateTimeFormat().resolvedOptions().timeZone` or equivalent) and stored on the user row at signup

### Schedule data

Where match data comes from and how it stays current.

- [ ] **DATA-01**: World Cup 2026 schedule (104 matches, 48 teams) is ingested from a free public football data API (football-data.org or similar) into local SQLite
- [ ] **DATA-02**: Schedule data refreshes nightly via a scheduled job; refresh failures alert via log + email and do not break the app
- [ ] **DATA-03**: Manual override path exists — an authenticated admin can hand-edit a row (kickoff time, teams, status) and have the override survive a subsequent nightly refresh
- [ ] **DATA-04**: User's personal schedule page renders only the matches involving their selected teams, with kickoff times converted to their stored time zone

### Notifications

How users find out a match is about to start.

- [ ] **NOTIFY-01**: A scheduled job sends an email kickoff notification ~60 minutes before each match the user is subscribed to (Resend), idempotent under re-runs
- [ ] **NOTIFY-02**: User can optionally link a Telegram chat ID (via deep-link from email) to receive the same notification through a Telegram bot
- [ ] **NOTIFY-03**: Each notification includes the match metadata (teams, kickoff in user's TZ, broadcaster info if available) and a signed-token link to the user's full schedule that requires no login
- [ ] **NOTIFY-04**: A given user receives at most one notification per channel per match — even if the scheduler re-runs, even if the schedule data changes upstream

### Lightning tip jar

Optional but design-doc-mandated for v1.

- [ ] **TIP-01**: A single global Lightning tip jar is visible on the user's schedule page and in the footer of notification emails
- [ ] **TIP-02**: Tip jar surface integrates with vaultwarden — exact integration shape (LNURL link-out vs. embedded widget vs. server-to-server invoice mint) is decided at phase planning, not pre-locked

## v2 Requirements

Acknowledged but deferred — captured here so we don't lose them, not in v1 scope.

### Niche-sport coverage

- **NICHE-01**: Strongman (World's Strongest Man + national qualifiers) data, schedule, notifications
- **NICHE-02**: Speedcubing (WCA-sanctioned competitions) data, schedule, notifications
- **NICHE-03**: VIP-form-driven demand capture for arbitrary sports user-typed into the existing teaser form

### Notifications

- **PUSH-01**: SMS notifications via A2P 10DLC-registered provider (deferred — registration is multi-week)
- **PUSH-02**: Browser web push via service worker (deferred — cross-platform quirks)

### Tipping

- **TIPS-01**: Per-event / per-creator tipping with multiple Lightning addresses
- **TIPS-02**: Cashu ecash issuance for VIP access tokens
- **TIPS-03**: Per-event tip analytics

### Identity

- **AUTH-01**: Email + password account with sessions (deferred — magic-link covers v1)
- **AUTH-02**: OAuth (Google, GitHub, Apple)

### Multi-event

- **EVENT-01**: 2026 Tour de France stage notifications
- **EVENT-02**: 2028 LA Summer Olympics personalization
- **EVENT-03**: World Athletics, esports majors, regional federations

### Infrastructure

- **INFRA-01**: Custom Resend domain for `oddlympics.app` with DKIM + DMARC
- **INFRA-02**: Postgres backend / multi-replica deploy (only if scale forces it)

## Out of Scope

Explicitly excluded for v1, with reasoning. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Niche sports (strongman, cubing, drone racing) in v1 | Single-sport WC launch is cleaner; niche follows once v1 demand validates |
| Per-event / per-creator tipping | Design doc explicitly defers to v1.1; single-creator vault tip jar covers v1 |
| Email + password authentication | Magic-link covers identity; password adds reset/session/hashing surface we don't have time for |
| OAuth (Google, GitHub, etc.) | Same as above — magic-link is sufficient |
| SMS notifications | A2P 10DLC registration is multi-week paperwork |
| Web push (browser notifications) | Service worker + per-platform quirks too risky for the deadline |
| Multi-event coverage (Olympics, TdF) | v2 territory after WC validates the personalization graph |
| Postgres / multi-replica backend | Single droplet + SQLite handles WC-launch scale |
| Custom Resend domain (DKIM/DMARC) | v1.1 — ship with verified Resend sandbox sender first |
| Cashu / Nostr-native architecture | Approach C from design doc; reconsider for 2028 LA Olympics relaunch |
| Native mobile apps | Web only with mobile-responsive design |
| Real-time match updates / live scores | Notification on kickoff is enough for v1; live updates are post-launch |
| Match streaming / video | We're a notification + schedule layer, not a broadcaster |
| Social features (follow other users, comments) | Out of v1 vision entirely |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| HARDEN-01 | Phase 1 | Pending |
| HARDEN-02 | Phase 1 | Pending |
| HARDEN-03 | Phase 1 | Pending |
| HARDEN-04 | Phase 1 | Pending |
| HARDEN-05 | Phase 1 | Pending |
| HARDEN-06 | Phase 1 | Pending |
| IDENT-01 | Phase 2 | Pending |
| IDENT-02 | Phase 2 | Pending |
| IDENT-03 | Phase 2 | Pending |
| IDENT-04 | Phase 2 | Pending |
| IDENT-05 | Phase 2 | Pending |
| DATA-01 | Phase 2 | Pending |
| DATA-02 | Phase 2 | Pending |
| DATA-03 | Phase 2 | Pending |
| DATA-04 | Phase 2 | Pending |
| NOTIFY-01 | Phase 3 | Pending |
| NOTIFY-02 | Phase 3 | Pending |
| NOTIFY-03 | Phase 3 | Pending |
| NOTIFY-04 | Phase 3 | Pending |
| TIP-01 | Phase 4 | Pending |
| TIP-02 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 21 total
- Mapped to phases: 21
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-08*
*Last updated: 2026-05-08 — traceability populated after roadmap creation*
