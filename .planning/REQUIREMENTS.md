# Requirements: oddlympics

**Defined:** 2026-05-08 (v1 MVP) · 2026-05-12 (v2.0 Consumer Landing)
**Core Value:** A user picks their team and gets a kickoff notification in their local time, on time, before group stage 2026-06-11.

---

## v2.0 Consumer Landing & Signup Flow (current milestone)

Replace the indie/builder-themed teaser with a consumer-targeted World Cup 2026 landing page (team + email signup, browser-timezone capture, legal pages, Open Graph image) — paid-ad-reviewable and bot-resistant before group-stage kickoff on **2026-06-11**. Target completion **2026-05-19**.

Each requirement maps to one roadmap phase. Acceptance criteria AC1–AC12 in `MILESTONE-consumer-landing.md` cover end-to-end verification across the milestone; per-phase verification is pinned during `/gsd-plan-phase`.

### Landing page

- [x] **LAND-01**: Replace landing page (`index.astro`) with consumer template — headline "Your team's matches. In your time zone. One ping before kickoff."; sub-headline with JS-populated tz label (e.g., "Detroit time"), fallback "your local time" when JS is disabled or `Intl.DateTimeFormat().resolvedOptions().timeZone` is unavailable; banner pill `WORLD CUP 2026 · JUNE 11 – JULY 19`; four below-fold sections in order (How it works / Why this exists / After the World Cup / FAQ with 5 items); consumer footer (Manage, Privacy, Terms, Contact `hello@oddlympics.app`, "Independent project · Not affiliated with FIFA").
- [x] **LAND-02**: Zero occurrences (case-insensitive) of `bitcoin`, `lightning`, `crypto`, `world domination`, or `personal olympics` in any public surface — `/`, `/privacy`, `/terms`, `/manage`, meta tags, OG image, inline scripts, or inline styles.
- [x] **LAND-03**: Landing page passes Lighthouse mobile ≥ 90 across Performance, Accessibility, Best Practices, SEO.
- [x] **LAND-04**: Landing page renders correctly at 390 / 768 / 1280 px viewports without horizontal scroll or text overlap.

### Signup form

- [x] **FORM-01**: Form submits three fields — `team` (required, dropdown), `email` (required, `type="email"`), `timezone` (hidden, populated by JS from `Intl.DateTimeFormat().resolvedOptions().timeZone`). Retains existing honeypot (`name="website"`) and `requested_sport=world_cup` hidden field for forward compat.
- [x] **FORM-02**: Team dropdown contains all 48 qualified teams, grouped by confederation (UEFA → CONMEBOL → CONCACAF → CAF → AFC → OFC). `value` attributes are snake_case slugs (`united_states`, `south_korea`, `ivory_coast`, `dr_congo`, `cape_verde`, `bosnia`, `czech_republic`, `new_zealand`, `saudi_arabia`, `south_africa`). Display labels use natural English with diacritics ("Curaçao"). Canonical list checked into the repo at `references/teams.json`.
- [x] **FORM-03**: Form POSTs to `/api/signup` with same content-type and HTTP semantics as today — no breaking changes to the existing endpoint contract. Client-side `?error=...` rendering and the existing error code → message mapping continue to work.

### `/api/signup` payload

- [ ] **SIGNUP-01**: `/api/signup` accepts new `team` field, validates against the 48-team allow-list, rejects with `?error=bad-form` (303 redirect, no row written) when missing, empty, or unknown.
- [ ] **SIGNUP-02**: `/api/signup` accepts new `timezone` field, validates against the IANA timezone database (`Intl.supportedValuesOf('timeZone')` or equivalent allow-list). On invalid or empty: fall back to `America/New_York` and flag the row for later IP-based correction. Does NOT reject on bad timezone.
- [ ] **SIGNUP-03**: `team` and `timezone` persist on the subscriber record alongside `email`, `created_at`, and existing `requested_sport`. Existing rate-limit, honeypot, Origin-check, and email-format-validation behavior preserved unchanged.
- [ ] **SIGNUP-04**: Confirmation email body names the team and a human-readable timezone (e.g., "We'll email you 1 hour before every England match in Detroit time.").

### Legal pages

- [x] **LEGAL-01**: `/privacy` route renders canonical privacy copy from `references/privacy.md`. Declares: what is collected (email, team, timezone, server logs), retention (logs ≤ 30 days), no sale of data, no third-party tracking cookies, Plausible cookie-free, GDPR/CCPA deletion path (`privacy@oddlympics.app`, 30 days), ESP named. Last-updated date matches deploy date. Same site shell (fonts, footer) as landing; no nav menu required.
- [x] **LEGAL-02**: `/terms` route renders canonical terms copy from `references/terms.md`. Declares: free service through 2026-07-19, best-effort delivery (no liability for FIFA reschedules or delivery failures), no FIFA/ESPN/team affiliation, prohibition on submitting fake or others' emails, governing law (Michigan, USA), `hello@oddlympics.app` for questions. Last-updated date matches deploy date. Same site shell as landing.

### Open Graph image

- [x] **OG-01**: `/og-image.png` served at exact 1200×630, content-type `image/png`, file size < 300 KB. Image shows wordmark, banner text "WORLD CUP 2026 · JUNE 11 – JULY 19", headline, one-line sub, URL `oddlympics.app`, and "Independent project · Not affiliated with FIFA" tag. Source SVG (`references/og-image.svg`) checked into repo so the asset is rebuildable after copy changes.

### Meta tags

- [x] **META-01**: Public `<head>` includes new `<title>` "Oddlympics — World Cup 2026 alerts in your time zone", meta description "Pick your team. Get one email one hour before every 2026 World Cup match, in your local time zone. Free. No ads. No betting odds.", Open Graph (`og:title`, `og:description`, `og:type=website`, `og:url=https://oddlympics.app`, `og:site_name=Oddlympics`, image tags from OG-01), and Twitter card (`twitter:card=summary_large_image`, `twitter:title`, `twitter:description`, `twitter:image`). No meta tag references prohibited terms per LAND-02.

### Analytics

- [x] **ANLTC-01**: Plausible script and init call preserved unchanged. Submit handler fires a `Signup Submit` Plausible event with a `team` prop equal to the selected slug. Plausible goal `Signup Submit` is configured server-side in the Plausible dashboard before the form ships.

### `/manage` flow

- [ ] **MANAGE-01**: `/manage` displays the subscriber's current team and timezone and allows updating both. Update endpoint pinned in the plan — either reuse `/api/save-selection` semantics or introduce `/api/manage`; the plan must specify which. Auth continues to use the existing magic-link/session mechanism — no new auth surface.
- [ ] **MANAGE-02**: One-click unsubscribe via the email link works without authentication beyond a signed token in the URL. Token is HMAC-signed, expires after 1 year, and is single-use per unsubscribe action.

### Backward compatibility

- [ ] **COMPAT-01**: Pre-milestone subscribers (rows with no `team` and no `timezone`) do not break `/manage` or the kickoff cron. Backfill at migration time: set `team = NULL`, `timezone = 'America/New_York'`. A one-time banner on `/manage` prompts them to pick a team.
- [ ] **COMPAT-02**: Existing `/api/signup` error-code contract unchanged — no new error codes introduced. Bad-team and bad-timezone both reuse `bad-form` (with a server-side log line distinguishing them).

---

## Acceptance criteria (milestone-level)

These come from `MILESTONE-consumer-landing.md` and must all pass before v2.0 is marked complete. Per-phase verification fans these out across plans 5–11.

| # | Criterion | Verified in |
|---|-----------|-------------|
| AC1 | Landing page renders ("Your team's matches" present); visual diff matches `references/landing_preview.png` within tolerance | Phase 6 |
| AC2 | All 48 `<option>` elements selectable; values match `references/teams.json` | Phase 5 |
| AC3 | Playwright in `America/Detroit`, `Europe/London`, `Africa/Lagos` submits form and persists the correct IANA tz; sub-headline label renders the expected city | Phase 5/6 |
| AC4 | End-to-end signup loop: Gmail/Proton/Outlook receive a confirmation within 60 s naming team + tz; unsubscribe link works | Phase 11 |
| AC5 | `/privacy` and `/terms` return 200 with canonical copy; last-updated date matches deploy | Phase 7 |
| AC6 | `/og-image.png` returns 200, type `image/png`, exactly 1200×630; opengraph.xyz preview renders headline/banner/URL | Phase 8 |
| AC7 | No prohibited terms (`bitcoin`, `lightning`, `crypto`, `world domination`, `personal olympics`) anywhere in `/`, `/privacy`, `/terms`, `/manage` | Phase 11 |
| AC8 | Lighthouse mobile ≥ 90 across Performance, Accessibility, Best Practices, SEO | Phase 11 |
| AC9 | `/api/signup` rejects `team=fake_team` with redirect to `/?error=bad-form`; no row written | Phase 5 |
| AC10 | Existing pre-milestone subscriber row loads on `/manage`, sees the one-time banner, can save a team without errors | Phase 9 |
| AC11 | Form submission triggers `Signup Submit` Plausible event with `team` prop populated | Phase 5/11 |
| AC12 | Programmatic POST with `website` honeypot field set is rejected; no row written | Phase 5 |

---

## v1 Requirements — shipped on `main` (historical)

For launch on or before **2026-06-11** (World Cup group stage kickoff). All shipped on `main` as of 2026-05-11; some carry pending operator actions (firing the launch blast, flipping kickoff notifications to live) that are independent of v2.0 work.

### Hardening — Phase 1 (DONE)

- [x] **HARDEN-01**: `/confirmed` page renders correct copy for each `?status=` value (`ok`, `already`, `bad-token`, `unknown`).
- [x] **HARDEN-02**: User can unsubscribe via a one-click link (DB column, `/api/unsubscribe` endpoint, `/unsubscribed` page, RFC 8058 helper).
- [x] **HARDEN-03**: Cross-origin POST `/api/signup` with missing `Origin` is rejected by default.
- [x] **HARDEN-04**: Caddy serves a CSP header that allows Plausible + own inline scripts and blocks everything else.
- [x] **HARDEN-06**: Magic-link tokens expire within 24 hours; tokens carry a `purpose` claim.

> **HARDEN-05** (off-droplet backups): replaced by enabling **DigitalOcean Backups** in the droplet dashboard (2026-05-10).

### Identity & Personalization — Phase 2 (SHIPPED, no GSD artifact)

- [x] **IDENT-01**: User identifies via magic-link (no password); extends teaser pattern.
- [x] **IDENT-02**: User can pick 1+ teams from all 48 World Cup 2026 teams (on `/schedule`).
- [x] **IDENT-03**: Selection persists in SQLite, keyed off `vip_signups` row.
- [x] **IDENT-04**: User can return via magic-link and edit their team selection.
- [x] **IDENT-05**: User's local timezone is captured (browser-detected) and stored.

### Schedule data — Phase 2 (SHIPPED)

- [x] **DATA-01**: World Cup 2026 schedule (104 matches, 48 teams) is ingested from football-data.org into local SQLite.
- [x] **DATA-02**: Schedule refreshes nightly via `oddlympics-ingest.timer`; failures log to journald.
- [x] **DATA-04**: Personal schedule page renders only the user's selected matches in their stored TZ.

### Launch comms — Phase 2.5 (CODE SHIPPED, blast unsent)

- [x] **LAUNCH-01**: `scripts/launch-blast.mjs` ready to email the existing teaser list with a one-click magic-link to the team picker (dry-run by default, requires `--send`). Throttled within Resend's free-tier limits. *Operator action pending: fire the blast.*

### Notifications — Phase 3 (SHIPPED in dry-run)

- [x] **NOTIFY-01**: `oddlympics-notify.timer` runs every 5 min, sends email ~60 min before each subscribed match (Resend); idempotent under re-runs. *Operator action pending: set `KICKOFF_NOTIFICATIONS_ENABLED=true`.*
- [x] **NOTIFY-03**: Each notification includes match metadata + signed-token link to user's full schedule, no login required.
- [x] **NOTIFY-04**: A given user receives at most one notification per channel per match.

---

## Future (deferred — post-v2.0)

Captured to avoid losing them; not in current scope.

### v1.1 deferrals (post-WC launch)

- **NOTIFY-02** — Telegram bot notifications (bot token, `/start` handler, deep-link verification, webhook/polling). Real ops surface; email-only ships a complete product for the launch.
- **TIP-01, TIP-02** — Lightning tip jar with **vaultwarden** integration. Needs proper design time; ship without it for v2.0 to keep public copy crypto-free. Add a hardcoded LNURL or `lightning:` URI in the email footer only if it doesn't surface in the consumer landing.
- **DATA-03** — Admin override for hand-editing match rows. Build only if a real upstream-data incident demands it.
- **HARDEN-05** — Off-droplet cross-vendor backups via rclone/B2. Revisit only if cross-vendor argument matters more than simplicity.
- **Shared `Layout.astro` refactor** — extract the per-page `<style is:global>` blocks once v2.0 ships. CLAUDE.md trigger fired (we're at 6+ pages) but the deadline is hard; v2.0 pages should paste the same head pattern.

### v2 / longer-horizon

- **Niche-sport coverage** — NICHE-01 (strongman, WSM + national qualifiers), NICHE-02 (speedcubing, WCA-sanctioned), NICHE-03 (VIP-form-driven demand capture for arbitrary sports).
- **PUSH-01** — SMS via A2P 10DLC-registered provider.
- **PUSH-02** — Browser web push via service worker.
- **TIPS-01, TIPS-02, TIPS-03** — Per-event / per-creator tipping, Cashu ecash VIP tokens, per-event tip analytics.
- **AUTH-01, AUTH-02** — Email + password sessions; OAuth (Google, GitHub, Apple).
- **EVENT-01, EVENT-02, EVENT-03** — 2026 Tour de France, 2028 LA Summer Olympics, World Athletics / esports majors / regional federations.
- **INFRA-01** — Custom Resend domain for `oddlympics.app` with DKIM + DMARC.
- **INFRA-02** — Postgres / multi-replica deploy (only if scale forces it).

---

## Out of Scope

Explicitly excluded; documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Multi-team selection at signup intake | Cold-traffic conversion favors one decision per field; `/schedule` already supports multi-select for returning users, so power breadth is preserved post-signup |
| IP-based country preselection for the team dropdown | Adds geo-lookup dependency + privacy surface for marginal UX gain; defer until real signup data shows user-team mismatch is a problem |
| Localization of the landing page | English only for v2.0; localization adds copy/QA surface the 2026-05-19 deadline can't absorb |
| Web push (browser) | Service worker + per-platform quirks too risky; email-only ships a complete product |
| CAPTCHA on signup | Tanks conversion; existing honeypot + Origin check + rate limit survived v1 teaser without spam. Revisit only on real attack pattern |
| Crypto / Lightning / Bitcoin / "world domination" / "personal Olympics" in public copy, meta tags, or OG image | Consumer audience pivot; positioning is no longer indie/builder. Paid-ad reviewers will reject otherwise. Backend keeps Lightning/Cashu plumbing for v1.1 tip jar — this is a public-surface-only constraint |
| Weird-sports verticals beyond a teaser block on the landing page | Single-sport (WC) launch story is cleaner; niche follows once v1 demand validates |
| Pricing / paid tiers / monetization surfaces | Out of v2.0 scope — free through 2026-07-19 per `/terms` |
| Niche sports (strongman, cubing, drone racing) coverage | v2 territory; demand capture continues via `feature_requests` table (already shipped) |
| Per-event / per-creator tipping | Single-creator vault tip jar covers v1.1 if it ships; per-event is v2 |
| Email + password authentication | Magic-link covers identity; password adds reset/session/hashing surface we don't have time for |
| OAuth (Google, GitHub, etc.) | Same as above — magic-link is sufficient |
| SMS notifications | A2P 10DLC registration is multi-week paperwork |
| Multi-event coverage (Olympics, Tour de France, etc.) | v2 territory after WC validates the personalization graph |
| Postgres / multi-replica backend | Single droplet + SQLite handles WC-launch scale |
| Custom Resend domain (DKIM/DMARC) | v1.1; ship with verified Resend sandbox sender first |
| Cashu / Nostr-native architecture | Reconsider for 2028 LA Olympics relaunch |
| Native mobile apps | Web-only with mobile-responsive design |
| Real-time match updates / live scores / streaming | Notification on kickoff is enough; live updates are post-launch; we're a notification + schedule layer, not a broadcaster |
| Social features | Out of vision entirely |

---

## Traceability

Each v2.0 REQ-ID maps to exactly one phase. Filled by `/gsd-new-milestone` roadmapper after roadmap approval.

| Requirement | Phase | Status |
|-------------|-------|--------|
| LAND-01 | Phase 6 | Complete |
| LAND-02 | Phase 6 | Complete |
| LAND-03 | Phase 6 | Complete |
| LAND-04 | Phase 6 | Complete |
| FORM-01 | Phase 6 | Complete |
| FORM-02 | Phase 6 | Complete |
| FORM-03 | Phase 6 | Complete |
| SIGNUP-01 | Phase 5 | Pending |
| SIGNUP-02 | Phase 5 | Pending |
| SIGNUP-03 | Phase 5 | Pending |
| SIGNUP-04 | Phase 10 | Pending |
| LEGAL-01 | Phase 7 | Complete |
| LEGAL-02 | Phase 7 | Complete |
| OG-01 | Phase 8 | Complete |
| META-01 | Phase 6 | Complete |
| ANLTC-01 | Phase 6 | Complete |
| MANAGE-01 | Phase 9 | Pending |
| MANAGE-02 | Phase 9 | Pending |
| COMPAT-01 | Phase 5 | Pending |
| COMPAT-02 | Phase 5 | Pending |

**Coverage (v2.0):**
- v2.0 requirements: 20 total
- Mapped to phases: 20 ✓
- Unmapped: 0 ✓

---

*Defined: 2026-05-08 (v1 MVP) · Trimmed: 2026-05-09 (v1 MVP) · v2.0 added: 2026-05-12 (Consumer Landing & Signup Flow) · Traceability filled: 2026-05-13*
