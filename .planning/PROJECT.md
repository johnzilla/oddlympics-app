# oddlympics

## What This Is

**Personalized "when does MY thing happen" notifications for international sports
fans, launching with the 2026 FIFA World Cup.** Users pick the team they care
about and receive an email kickoff notification in their local time zone — one
ping, one hour before each match. The teaser landing page launched at
https://oddlympics.app; v1 MVP (magic-link sign-in, team picker, schedule,
kickoff cron) shipped to `main`. The current milestone (**v2.0 Consumer Landing
& Signup Flow**) replaces the indie/builder-themed public surface with a
consumer-targeted World Cup landing before group stage kicks off on
**2026-06-11**.

## Core Value

**A user picks their team and gets a kickoff notification in their local time,
on time, before group stage 2026.** If everything else fails — the OG image
renders wrong, Plausible events drop, the dropdown is ugly — the user must
still get a "USA vs. Iran kicks off in 60 minutes (your time)" email that
lands when promised.

## Current Milestone: v2.0 Consumer Landing & Signup Flow

**Goal:** Replace the indie/builder-themed teaser with a consumer-targeted
World Cup 2026 landing page (team + email signup, browser-timezone capture,
legal pages, Open Graph image) — paid-ad-reviewable and bot-resistant before
group-stage kickoff on 2026-06-11. **Target completion: 2026-05-19.**

**Target features:**
- Landing page rewrite — consumer headline, JS-populated timezone label, banner pill, How it works / Why this exists / After the World Cup / FAQ sections, consumer footer (R1)
- Two-field signup — team dropdown (48 teams, confederation-grouped) + email + hidden timezone (R2)
- `/api/signup` payload widening — `team` allow-list + IANA `timezone` w/ fallback, additive contract (R3)
- `/privacy` + `/terms` legal pages (R4, R5)
- `/og-image.png` (1200×630, <300KB) + checked-in source SVG (R6)
- Meta tags rewrite — title, description, OG, Twitter (R7)
- Plausible `Signup Submit` event with `team` prop (R8)
- `/manage` team + timezone editor; one-time backfill banner for legacy rows (R9, R10)
- 12 acceptance criteria (AC1–AC12) — including Lighthouse mobile ≥90, Playwright across 3 locales, full signup→confirm→unsubscribe loop

**Constraint:** No visible references to crypto, Lightning, Bitcoin, "world domination," or "personal Olympics" anywhere in the public surface (landing, /privacy, /terms, /manage, OG image, meta tags). Public copy is consumer soccer fan — not crypto, not dev Twitter.

## Requirements

### Validated

<!-- Shipped in v1 teaser + v1 MVP, in code on main -->

- ✓ Public landing page at oddlympics.app — v1 teaser
- ✓ Email capture with HMAC magic-link double-opt-in confirm — v1 teaser
- ✓ Honeypot + per-IP/email rate limiting on signup — v1 teaser
- ✓ Astro 5 server-mode + SQLite + Resend stack on a single DigitalOcean droplet — v1 teaser
- ✓ GitHub Actions auto-deploy on push to `main` (~40s end-to-end) — v1 teaser
- ✓ Caddy with auto Let's Encrypt + HSTS + nosniff + frame-deny + referrer policy — v1 teaser
- ✓ Plausible analytics across all pages — v1 teaser
- ✓ `/confirmed` status routing (`ok`/`already`/`bad-token`/`unknown`) — v1 MVP Phase 1 (HARDEN-01)
- ✓ `/api/unsubscribe` + `/unsubscribed` page + RFC 8058 list-unsubscribe headers — v1 MVP Phase 1 (HARDEN-02)
- ✓ Default-deny on missing `Origin` for cross-origin POST — v1 MVP Phase 1 (HARDEN-03)
- ✓ Content-Security-Policy enforced in Caddyfile — v1 MVP Phase 1 (HARDEN-04)
- ✓ Magic-link TTL 24 h with `purpose` claim — v1 MVP Phase 1 (HARDEN-06)
- ✓ DigitalOcean Backups enabled on droplet — v1 MVP Phase 1 operator action (2026-05-10)
- ✓ Magic-link sign-in (`/manage`), team picker, personal schedule (`/schedule`), browser-tz capture + manual override — v1 MVP Phase 2 (IDENT-01…05, DATA-04)
- ✓ World Cup schedule ingestor (football-data.org → `teams`/`matches` tables) + nightly `oddlympics-ingest.timer` — v1 MVP Phase 2 (DATA-01, DATA-02)
- ✓ Cookie-based 30-day sliding sessions — v1 MVP Phase 2
- ✓ Launch-blast mechanism (`scripts/launch-blast.mjs`, dry-run by default) — v1 MVP Phase 2.5 (LAUNCH-01, blast not yet fired — pending operator action)
- ✓ Demand-capture free-text field on `/schedule` + `feature_requests` table — v1 MVP Phase 2.5 SC4 (commit `6129910`)
- ✓ Kickoff notification cron (`oddlympics-notify.timer`, dry-run pending `KICKOFF_NOTIFICATIONS_ENABLED=true`) — v1 MVP Phase 3 (NOTIFY-01, NOTIFY-03, NOTIFY-04)
- ✓ Consumer landing page rewrite (`src/pages/index.astro`): consumer headline + JS-populated tz label + banner pill + four below-fold sections + consumer footer + 48-team confederation-grouped `<select>` + OG/Twitter meta tags + zero prohibited terms — v2.0 Phase 6 (LAND-01, LAND-02, LAND-03, LAND-04, FORM-01, FORM-02, FORM-03, META-01)
- ✓ Plausible `Signup Submit` custom event + dashboard custom goal configured — v2.0 Phase 6 (ANLTC-01)

### Active

<!-- v2.0 Consumer Landing scope — target 2026-05-19, before WC group stage 2026-06-11 -->

#### Signup flow widening (Phase 5)

- [ ] Two-field signup form: `team` (48-team dropdown, confederation-grouped) + `email`, plus hidden `timezone` populated by JS
- [ ] Team dropdown — snake_case slugs, UEFA → CONMEBOL → CONCACAF → CAF → AFC → OFC grouping, all 48 qualified teams
- [ ] Retain honeypot (`name="website"`) and `requested_sport=world_cup` hidden field for forward compat
- [ ] `/api/signup` accepts + validates `team` (allow-list) + `timezone` (IANA), persists alongside `email`/`requested_sport`/`created_at`, reuses `bad-form` error code
- [ ] Invalid/empty timezone falls back to `America/Detroit` and flags row for later correction — does NOT reject
- [ ] Confirmation email body names the team and timezone in human-readable form

#### Legal pages (Phase 7) — Complete (2026-05-14)

- [x] `/privacy` page — what's collected, retention (logs ≤30 days), no third-party tracking cookies, Plausible cookie-free, GDPR/CCPA deletion path (`privacy@oddlympics.app`, 30 days), ESP named
- [x] `/terms` page — free service through 2026-07-19, best-effort delivery, no FIFA/ESPN/team affiliation, governing law (Michigan, USA), `hello@oddlympics.app`
- [x] Last-updated date in headers matches deploy date
- [x] Same site shell (fonts, footer) as landing — no nav menu required

#### Open Graph image (Phase 8)

- [ ] `references/og-image.svg` checked into repo so OG image is rebuildable from source
- [ ] Built/rendered `/og-image.png` at exact 1200×630, <300KB — shows wordmark, banner, headline, sub, URL, "Not affiliated with FIFA" tag
- [ ] `og:image`, `og:image:width`, `og:image:height`, `og:image:alt`, `twitter:image` meta tags point to it
- [ ] opengraph.xyz preview, Slack share, iMessage share render cleanly

#### `/manage` updates + backward compat (Phase 9)

- [ ] `/manage` displays + allows editing current team and timezone (update endpoint TBD — `/api/save-selection` or new `/api/manage`; pin in plan)
- [ ] Unsubscribe via HMAC-signed token (expires 1y, single-use per action) — no auth beyond the email link
- [ ] Pre-milestone subscribers with NULL `team`/default `timezone` load `/manage` without errors; one-time banner prompts them to pick a team
- [ ] No new error codes — bad-team and bad-timezone reuse `bad-form` (server-side log distinguishes)

#### End-to-end + launch gate (Phase 11)

- [ ] AC1–AC12 all pass on production
- [ ] Lighthouse mobile report saved to `references/lighthouse-final.html`, all categories ≥ 90
- [ ] Real signup test from a fresh browser profile (John's personal Gmail) delivers correctly-rendered confirmation email within 60 s
- [ ] Release tagged `v1.0-consumer-landing` in git

### Out of Scope

<!-- Explicit boundaries with reasoning to prevent re-adding -->

- **Niche-sport coverage (strongman, cubing, drone racing)** — captured as VIP-form interest signal only, not built. World Cup is the launch wedge; niche sports follow if v1 demand validates.
- **Per-event / per-creator tipping** — design doc explicitly defers; single-creator vault tip jar is v1.
- **OAuth / social login / password auth** — magic-link covers identity; password auth adds reset/session/hash surface area we don't have time for.
- **SMS notifications** — A2P 10DLC registration + provider integration is multi-week paperwork. Email + Telegram cover it.
- **Web push (browser)** — service worker + per-platform quirks too risky for the deadline; Telegram fills the "instant push" slot.
- **Multi-event coverage (Olympics, Tour de France, etc.)** — v2 territory after WC validates the personalization graph.
- **Real backend with Postgres / multiple replicas** — single droplet + SQLite handles WC-launch scale; revisit only if traffic forces it.
- **Custom Resend domain (DKIM/DMARC for oddlympics.app)** — LIVE in v2.0 (Phase 10, 2026-05-15): production sends from the verified custom domain `hello@oddlympics.app` (set via `/etc/oddlympics.env` `EMAIL_FROM`), scoring 10/10 on Mail-Tester. Decision pulled forward from v1.1 — the "sandbox sender first" plan was superseded once the custom domain was verified. (`src/lib/email.ts` keeps the `onboarding@resend.dev` default as the dev/fallback sender.)
- **DigitalOcean platform migration** — droplet is fine, no Vercel/Render migration on the table.
- **Cashu / Nostr-native architecture** — Approach C from design doc; reconsider for a 2028 LA Olympics relaunch, not now.
- **Native mobile apps** — web only, mobile-friendly responsive design.

## Context

**Hard timeline.** Today is **2026-05-08**; group stage kickoff is **2026-06-11**.
**34 days** to ship a product that meets a deadline picked by FIFA, not by us.
The 6-week budget from the design doc is now a 5-week budget. Anything that
can't ship by 2026-06-11 either gets cut from v1 or gets a watered-down
version that still proves the value loop.

**The product is already partially live.** The teaser at oddlympics.app has
been collecting emails since v1 teaser deploy. Phase 1 must not break the
existing email list or signup path; the migration from "teaser only" to
"full product" should be additive — the existing magic-link flow is the
foundation for the personalization sign-up flow.

**Founder is the proof user.** John watches strongman + cubing himself; the
v1.1 niche-sport long tail is a real personal need, not a hypothetical
market. For v1, John can also be the WC test user.

**vaultwarden is the upstream integration.** The Lightning tip jar lives in
johnzilla/vaultwarden (TypeScript treasury — Cashu ecash + Lightning, RESERVE/
RELEASE/PAYMENT ledger, agent sub-accounts, policy engine). oddlympics-app
consumes it. The exact integration shape (LNURL link-out vs. embedded widget
vs. API invoice mint) is deferred to phase-level discussion because the vault
side may need work too.

**Codebase reference.** See `.planning/codebase/*` for the current state of
the teaser app — STACK, ARCHITECTURE, STRUCTURE, CONVENTIONS, TESTING,
INTEGRATIONS, CONCERNS. Phase 1 work pulls directly from CONCERNS.md.

**Original design context.** Office-hours design doc at
`~/.gstack/projects/johnzilla-oddlympics-app/john-main-design-20260430-203213.md`
contains the demand evidence, premises, and approach analysis (A/B/C). v1
ships Approach A — concierge MVP, World Cup-only.

## Constraints

- **Timeline**: Hard ship date 2026-06-11 (World Cup group-stage kickoff) — picked by FIFA, not negotiable. Notifications need to fire on real matches starting that morning.
- **Tech stack**: Astro 5 server mode + better-sqlite3 + Resend + Caddy + systemd on DigitalOcean. Established and shipping; no rewrites mid-deadline. New surface area uses the same stack unless there's a hard reason not to.
- **Solo developer**: One contributor (johnzilla), evenings + weekends. Scope must respect this; no "hire help" assumptions.
- **Single droplet**: One $6/mo box. No HA, no multi-region, no replicas. Restart cost ~2s; we'll live with it.
- **Bitcoin/Lightning ideology**: No tokens, no L2 alternatives, no "maybe USDC for v1." Lightning + Cashu through vault, period.
- **Existing email list**: Phase 1 cannot break the existing signup/confirm flow or invalidate captured emails. Migrations must be additive.
- **No relocation**: Founder constraint — affects fundraising path but not the product itself; mentioned for completeness.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Approach A from design doc (concierge MVP, WC-only) over Approach B (real backend, multi-event) or C (Nostr-native) | Only A ships before kickoff; A captures real demand signal that informs B's spec | — Pending (validates by 2026-06-11) |
| Phase 1 = pre-launch hardening before building forward | Existing teaser has CONCERNS.md issues (confirmed.astro silent failure, no unsubscribe, no DB backup) that must be fixed before sending production email at scale | — Pending |
| World Cup only for sport coverage; niche sports captured via VIP form only | Single-sport launch story is cleaner; niche coverage builds against v1.1 demand signal, not speculation | — Pending |
| Free football data API (e.g. football-data.org) over fully hand-curated schedule | API removes manual upkeep risk during knockout-bracket changes; manual override path covers ToS or rate-limit issues | — Pending |
| Email + Telegram only for notifications (no SMS, no web push) | A2P 10DLC SMS registration is multi-week paperwork; web push has cross-platform quirks; email is shipping today and Telegram is one bot away | — Pending |
| Magic-link auth (extend teaser pattern) over email+password | Identity is solved by the existing token + Resend flow; password adds reset/session/hashing surface we don't need on this timeline | — Pending |
| Single global Lightning tip jar via vaultwarden; integration shape TBD at phase planning | Per-event/per-creator tipping is design-doc-explicit v1.1; vault integration shape may need vault-side work, defer locking until that phase | — Pending |
| Stay on the existing droplet/Caddy/systemd stack | Stack is shipping reliably; no rewrites mid-deadline | ✓ Good (already proven) |
| **v2.0 consumer pivot — strip BTC/Lightning/"world domination"/"personal Olympics" from public surfaces; rewrite landing for casual soccer fans** | Existing copy is optimized for indie/builder audience and converts poorly from cold paid/organic traffic; paid-ad reviewers also require `/privacy` + `/terms`. Backend, ESP, and infra are untouched except for additive `team`/`timezone` columns on the signup payload — magic-link, kickoff cron, schedule data all stay. | — Pending (validates by 2026-05-19) |
| **Single-team signup at intake; multi-team selection deferred to `/schedule`/`/manage`** | ⚠ SUPERSEDED IN PRACTICE — the "multi-team preserved post-signup" half was silently invalidated and never re-confirmed: Phase 5 dropped `selected_teams` for a single `vip_signups.team` slug, and Phase 9 turned `/schedule` into a 301 → single-team `/manage`. v2.0 shipped single-team **end-to-end**. The founder did NOT approve single-team-only. | ✗ **Blocker** — multi-team restoration required before v2.0 public launch. Phase 11 launch gate halted; `v1.0-consumer-landing` tag deliberately withheld. See STATE.md Blockers. |
| **Bot-resistant via existing honeypot + Origin check + rate limit; no CAPTCHA in v2.0** | Adding visible CAPTCHA tanks conversion; existing controls survived the v1 teaser without spam load and the consumer audience isn't worth more than that yet. Revisit if real attack pattern emerges. | — Pending |
| **No IP-based country preselection for the team dropdown in v2.0** | Adds geo-lookup dependency + privacy surface for marginal UX gain; defer until we see real signup data show user-team mismatch is a problem. | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-14 after Phase 7 (legal-pages) verified passed*
