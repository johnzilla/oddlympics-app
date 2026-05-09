# Requirements: oddlympics v1 MVP

**Defined:** 2026-05-08 · **Trimmed:** 2026-05-09
**Core Value:** A user picks their team and gets a kickoff notification in their local time, on time, before group stage 2026-06-11.

## v1 Requirements

For launch on or before **2026-06-11** (World Cup group stage kickoff). Each maps to one roadmap phase. The list was trimmed on 2026-05-09 to fit a 33-day solo-developer deadline; deferred items moved to "Deferred to v1.1" below.

### Hardening (existing teaser) — Phase 1

- [x] **HARDEN-01**: `/confirmed` page renders correct copy for each `?status=` value (`ok`, `already`, `bad-token`, `unknown`).
- [x] **HARDEN-02**: User can unsubscribe via a one-click link (DB column, /api/unsubscribe endpoint, /unsubscribed page, RFC 8058 helper for outbound mail).
- [x] **HARDEN-03**: Cross-origin POST `/api/signup` requests with missing `Origin` header are rejected by default.
- [x] **HARDEN-04**: Caddy serves a `Content-Security-Policy` header that allows Plausible + own inline scripts and blocks everything else.
- [x] **HARDEN-06**: Magic-link tokens expire within 24 hours.

> **HARDEN-05** (off-droplet backups) was originally in this list. Replaced with the operator action "enable DigitalOcean Backups in the dashboard" — not a code requirement.

### Identity & Personalization — Phase 2

- [ ] **IDENT-01**: User identifies themselves via magic-link only (no password); flow extends the existing teaser's signup → email → confirm pattern.
- [ ] **IDENT-02**: User can pick 1+ teams from a list of all 48 World Cup 2026 teams.
- [ ] **IDENT-03**: User's selection persists in SQLite, keyed off the same `vip_signups` row used by the teaser (no second user table).
- [ ] **IDENT-04**: User can return later via a magic-link request and edit their team selection.
- [ ] **IDENT-05**: User's local time zone is captured (browser-detected via `Intl.DateTimeFormat().resolvedOptions().timeZone`) and stored on the user row.

### Schedule data — Phase 2

- [ ] **DATA-01**: World Cup 2026 schedule (104 matches, 48 teams) is ingested from a free public football data API (football-data.org or similar) into local SQLite.
- [ ] **DATA-02**: Schedule data refreshes nightly via a scheduled job; refresh failures log and alert; the app never silently serves stale data.
- [ ] **DATA-04**: User's personal schedule page renders only the matches involving their selected teams, with kickoff times converted to their stored time zone.

### Launch comms — Phase 2.5

- [ ] **LAUNCH-01**: Send a "pick your teams" email blast to every confirmed, not-unsubscribed row in `vip_signups`. Email contains a one-click magic-link landing on the team picker. Send is throttled to stay inside Resend's free-tier limits. Click → picker → schedule funnel is visible in Plausible.

### Notifications — Phase 3

- [ ] **NOTIFY-01**: A scheduled job sends an email kickoff notification ~60 minutes before each subscribed match (Resend); idempotent under re-runs.
- [ ] **NOTIFY-03**: Each notification includes match metadata (teams, kickoff in user's TZ) and a signed-token link to the user's full schedule that requires no login.
- [ ] **NOTIFY-04**: A given user receives at most one notification per channel per match — even if the scheduler re-runs, even if schedule data changes upstream.

## Deferred to v1.1 (post-launch)

Originally in v1 scope; trimmed for the deadline. Re-prioritize after the first World Cup notifications fire cleanly.

- **NOTIFY-02** — Telegram bot notifications. Bot token, /start handler, deep-link verification, webhook/polling. Real ops surface; email-only ships a complete product.
- **TIP-01, TIP-02** — Lightning tip jar with **vaultwarden** integration. Needs proper design time the deadline doesn't allow. Ship v1 without it; if you want a placeholder, hardcode an LNURL or `lightning:` URI in the email footer.
- **DATA-03** — Admin override path for hand-editing match rows. Build only if a real upstream-data incident demands it.
- **HARDEN-05** — Off-droplet (cross-vendor) backups via rclone/B2. Replaced by DigitalOcean Backups dashboard checkbox. Revisit if you ever feel the cross-vendor argument matters more than the simplicity argument.

## v2 Requirements (acknowledged, not v1)

Captured to avoid losing them; not in v1 scope.

### Niche-sport coverage
- **NICHE-01**: Strongman (World's Strongest Man + national qualifiers)
- **NICHE-02**: Speedcubing (WCA-sanctioned competitions)
- **NICHE-03**: VIP-form-driven demand capture for arbitrary sports

### Notifications
- **PUSH-01**: SMS via A2P 10DLC-registered provider
- **PUSH-02**: Browser web push via service worker

### Tipping
- **TIPS-01**: Per-event / per-creator tipping with multiple Lightning addresses
- **TIPS-02**: Cashu ecash issuance for VIP access tokens
- **TIPS-03**: Per-event tip analytics

### Identity
- **AUTH-01**: Email + password account with sessions
- **AUTH-02**: OAuth (Google, GitHub, Apple)

### Multi-event
- **EVENT-01**: 2026 Tour de France stage notifications
- **EVENT-02**: 2028 LA Summer Olympics personalization
- **EVENT-03**: World Athletics, esports majors, regional federations

### Infrastructure
- **INFRA-01**: Custom Resend domain for `oddlympics.app` with DKIM + DMARC
- **INFRA-02**: Postgres / multi-replica deploy (only if scale forces it)

## Out of Scope

Explicitly excluded for v1, with reasoning. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Niche sports (strongman, cubing, drone racing) in v1 | Single-sport WC launch is cleaner; niche follows once v1 demand validates |
| Per-event / per-creator tipping | Single-creator vault tip jar covers v1.1 if it ships; per-event is v2 |
| Email + password authentication | Magic-link covers identity; password adds reset/session/hashing surface we don't have time for |
| OAuth (Google, GitHub, etc.) | Same as above — magic-link is sufficient |
| SMS notifications | A2P 10DLC registration is multi-week paperwork |
| Web push (browser notifications) | Service worker + per-platform quirks too risky for the deadline |
| Multi-event coverage (Olympics, TdF) | v2 territory after WC validates the personalization graph |
| Postgres / multi-replica backend | Single droplet + SQLite handles WC-launch scale |
| Custom Resend domain (DKIM/DMARC) | Ship with verified Resend sandbox sender first |
| Cashu / Nostr-native architecture | Reconsider for 2028 LA Olympics relaunch |
| Native mobile apps | Web only with mobile-responsive design |
| Real-time match updates / live scores | Notification on kickoff is enough for v1; live updates are post-launch |
| Match streaming / video | We're a notification + schedule layer, not a broadcaster |
| Social features | Out of v1 vision entirely |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| HARDEN-01 | Phase 1 | Done |
| HARDEN-02 | Phase 1 | Done |
| HARDEN-03 | Phase 1 | Done |
| HARDEN-04 | Phase 1 | Done |
| HARDEN-06 | Phase 1 | Done |
| IDENT-01 | Phase 2 | Pending |
| IDENT-02 | Phase 2 | Pending |
| IDENT-03 | Phase 2 | Pending |
| IDENT-04 | Phase 2 | Pending |
| IDENT-05 | Phase 2 | Pending |
| DATA-01 | Phase 2 | Pending |
| DATA-02 | Phase 2 | Pending |
| DATA-04 | Phase 2 | Pending |
| LAUNCH-01 | Phase 2.5 | Pending |
| NOTIFY-01 | Phase 3 | Pending |
| NOTIFY-03 | Phase 3 | Pending |
| NOTIFY-04 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 17 total (was 21; trimmed by 4)
- Mapped to phases: 17
- Unmapped: 0 ✓

---
*Trimmed: 2026-05-09 — moved HARDEN-05, NOTIFY-02, DATA-03, TIP-01, TIP-02 out of v1; added LAUNCH-01 + Phase 2.5 for launch comms.*
