# Roadmap: oddlympics v1 MVP

## Overview

The teaser is live and collecting emails. This milestone turns it into the actual product before
World Cup group stage kicks off on 2026-06-11. Phase 1 hardens the existing teaser so it's safe
to email at scale. Phase 2 gives users a personalized match schedule. Phase 3 fires the
kickoff notifications that close the core value loop. Phase 4 surfaces the Lightning tip jar.
Each phase builds on the last; if time runs short, earlier phases still deliver value.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Pre-launch Hardening** - Existing teaser becomes safe to mass-email real users
- [ ] **Phase 2: Identity & Personal Schedule** - Users pick teams and see their matches in local time
- [ ] **Phase 3: Kickoff Notifications** - Users receive email (+ optional Telegram) before every match
- [ ] **Phase 4: Lightning Tip Jar** - Single global tip jar visible on schedule and in notification footer

## Phase Details

### Phase 1: Pre-launch Hardening
**Goal**: The existing teaser app has all known bugs fixed and security/compliance gaps closed before any production email campaign runs
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: HARDEN-01, HARDEN-02, HARDEN-03, HARDEN-04, HARDEN-05, HARDEN-06
**Success Criteria** (what must be TRUE):
  1. Production error pages render the correct copy for all `/confirmed` redirect targets (`ok`, `already`, `bad-token`, `unknown`) — a user who clicks an expired link sees an error, not a false success
  2. Every notification email contains a working one-click unsubscribe link, and a user who clicks it is removed from future mailings
  3. A POST to `/api/signup` with no `Origin` header is rejected with an appropriate error response
  4. Caddy serves a `Content-Security-Policy` header on all pages that passes an automated security header scanner
  5. The SQLite database is automatically backed up off-droplet daily, and the restore procedure is documented and tested
  6. Magic-link tokens are revoked on first use (or expire within 24 hours), confirmed by a second-click attempt returning the appropriate error state
**Plans**: 7 plans
Plans:
- [ ] 01-01-PLAN.md — HARDEN-01: fix confirmed.astro prerender + searchParams bug (move COPY map and status read into inline script)
- [ ] 01-02-PLAN.md — HARDEN-03: flip Origin missing default from allow to deny in /api/signup
- [ ] 01-03-PLAN.md — HARDEN-06: drop magic-link TTL from 7 days to 24 hours
- [ ] 01-04-PLAN.md — HARDEN-02: full unsubscribe slice (DB column, token purpose claim, /api/unsubscribe endpoint, /unsubscribed page, RFC 8058 helper)
- [ ] 01-05-PLAN.md — HARDEN-04 (report-only): add Content-Security-Policy-Report-Only to Caddyfile, observe 1-2 days
- [ ] 01-06-PLAN.md — HARDEN-04 (enforce): flip CSP from report-only to enforce, verify A grade on securityheaders.com
- [ ] 01-07-PLAN.md — HARDEN-05: daily off-droplet backup to Backblaze B2 via systemd timer + restore runbook + drill

### Phase 2: Identity & Personal Schedule
**Goal**: A signed-up user can identify themselves via magic-link, pick the teams they follow, and view a personal match schedule with all kickoffs in their local time
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: IDENT-01, IDENT-02, IDENT-03, IDENT-04, IDENT-05, DATA-01, DATA-02, DATA-03, DATA-04
**Success Criteria** (what must be TRUE):
  1. A user who received the original teaser confirmation email can request a new magic-link and land on a team-selection page without creating a new account
  2. A user can pick one or more teams from the full 48-team World Cup 2026 list and have their selection saved
  3. A user who returns via magic-link later can change their team selection and see the update reflected immediately
  4. The user's personal schedule page shows only matches involving their selected teams, with each kickoff displayed in the browser's local time zone
  5. A nightly schedule refresh runs without breaking the app; a refresh failure produces a log entry and alert rather than silently serving stale data
**Plans**: TBD
**UI hint**: yes

### Phase 3: Kickoff Notifications
**Goal**: Users receive a timely kickoff notification (email, and optionally Telegram) ~60 minutes before every match they are subscribed to, with no duplicate sends
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: NOTIFY-01, NOTIFY-02, NOTIFY-03, NOTIFY-04
**Success Criteria** (what must be TRUE):
  1. A user receives an email ~60 minutes before each subscribed match containing the teams, kickoff time in their local time zone, and a no-login link to their personal schedule
  2. A user who links a Telegram chat ID via the deep-link in their email receives the same notification through the Telegram bot
  3. If the notification scheduler runs twice for the same match window, the user receives exactly one notification per channel — not two
  4. The no-login schedule link in a notification email resolves to the user's full personal schedule without requiring them to re-authenticate
**Plans**: TBD
**UI hint**: yes

### Phase 4: Lightning Tip Jar
**Goal**: A single global Lightning tip jar is visible to every user on their schedule page and in every notification email footer, integrated with vaultwarden
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: TIP-01, TIP-02
**Success Criteria** (what must be TRUE):
  1. The tip jar is visible on the personal schedule page and in the footer of all notification emails
  2. A user who clicks the tip jar link is taken to a working Lightning payment surface (LNURL, embedded widget, or invoice — integration shape decided at phase planning)
  3. The integration uses the vaultwarden treasury and the chosen shape is documented so it can be changed in v1.1
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Pre-launch Hardening | 0/7 | Not started | - |
| 2. Identity & Personal Schedule | 0/TBD | Not started | - |
| 3. Kickoff Notifications | 0/TBD | Not started | - |
| 4. Lightning Tip Jar | 0/TBD | Not started | - |
