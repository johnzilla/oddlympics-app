# oddlympics

## What This Is

**Personalized "when does MY thing happen" notifications for international sports
fans, launching with the 2026 FIFA World Cup.** Users pick the teams they care
about and receive an email kickoff notification in their local time zone — one
ping, one hour before each match. The teaser landing page launched at
https://oddlympics.app; v1 MVP (magic-link sign-in, team picker, schedule,
kickoff cron) shipped to `main`. **v2.0 Consumer Landing & Signup Flow shipped
2026-05-16** (`v1.0-consumer-landing` tagged + pushed): the public surface is
now a consumer-targeted World Cup landing — two-field signup, legal pages, OG
image, `/manage` multi-team editor, team+tz confirmation email — all live and
gate-verified on production ahead of group-stage kickoff **2026-06-11**.

## Core Value

**A user picks their team and gets a kickoff notification in their local time,
on time, before group stage 2026.** If everything else fails — the OG image
renders wrong, Plausible events drop, the dropdown is ugly — the user must
still get a "USA vs. Iran kicks off in 60 minutes (your time)" email that
lands when promised.

## Current State

**v2.0 Consumer Landing & Signup Flow — SHIPPED 2026-05-16.** 8 phases (5–12),
32 plans, tagged `v1.0-consumer-landing` (annotated, pushed to origin). App
live at https://oddlympics.app (HTTP 200), production launch gate green
(AC1/AC2/AC5/AC7/AC9/AC12 PASS direct against prod; multi-team `/manage`
covered by Phase 12, 11/11). Delivered:
- Consumer landing rewrite — headline, JS tz label, banner pill, four below-fold sections, consumer footer, 48-team confederation-grouped `<select>`, OG/Twitter meta, zero prohibited terms
- Two-field signup (`team` + `email` + hidden `timezone`), additive `/api/signup` widening with allow-list + IANA-tz fallback
- `/privacy` + `/terms` legal pages on the shared site shell
- `/og-image.png` (1200×630, <300KB) from a checked-in source SVG
- `/manage` multi-team editor (1–5 confederation-grouped checkboxes, `user_teams` join table) + one-click unsubscribe with per-purpose token TTLs
- Confirmation email naming team + timezone; custom Resend domain `hello@oddlympics.app` live, Mail-Tester 10/10
- Kickoff cron fans out via `user_teams`, one-email-per-match guarantee preserved

**Public-surface constraint held:** no `bitcoin`/`lightning`/`crypto`/"world
domination"/"personal Olympics" anywhere in `/`, `/privacy`, `/terms`,
`/manage`, meta, OG image, inline assets.

## Status

**Active milestone: v2.1 Referral & Social Sharing** (started 2026-05-22) —
v2.0 shipped and is live; v2.1 adds a referral/share loop on top of the
consumer landing (see Current Milestone below). The project stays in
launch-readiness mode until World Cup group stage on **2026-06-11**, and v2.1
targets that same hard date.

**Pre-launch operator actions (launch blockers, not a milestone):**
- Fire `scripts/launch-blast.mjs --send` (currently dry-run)
- Flip `KICKOFF_NOTIFICATIONS_ENABLED=true` + restart `oddlympics-notify.timer`
- End-to-end smoke one real kickoff notification
- Verify football-data.org name→slug mapping (kickoff-cron silent-loss risk)

**Deferred (no scheduled milestone — see Out of Scope):** Telegram bot
notifications, Lightning tip jar via vaultwarden, niche-sport long tail
(strongman, cubing). Not on a schedule; revisit only if post-launch demand
warrants.

## Current Milestone: v2.1 Referral & Social Sharing

**Goal:** Turn every new signup into a referral channel — let a user share
their personalized World Cup signup and track which signups it drives back.

**Target features:**
- **Per-user referral link + attribution** — a referral code per signup; the
  landing page reads `?ref=CODE` and threads it through `/api/signup` into a
  `referred_by` column so share-driven signups are measurable.
- **Personalized share content** — share text names the user's team + flag
  ("I'm following USA 🇺🇸 — get your team's World Cup kickoff alerts"); a
  per-team Open Graph image so the unfurl shows their team.
- **Share prompts in four places** — `/pending`, `/confirmed`, the
  confirmation email body, and `/manage` for returning users.

**Key context:**
- **Hard deadline 2026-06-11** (20 days from start) — shares the runway with
  the four outstanding operator launch tasks.
- **Long pole: per-team OG images** (~48 variants) — feasible with the resvg
  render toolchain vendored in Phase 8, pre-rendered at build time. First
  thing to trim to "personalized text, shared `/og-image.png`" if the runway
  gets tight.
- **Attribution stays lightweight** — a code + ref param, no rewards or
  leaderboard. A full referral *program* is explicitly out of scope.
- Phase numbering continues from 12 → this milestone starts at **Phase 13**.

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
- ✓ Two-field signup (`team` 48-team confederation-grouped dropdown + `email` + hidden JS `timezone`), honeypot + `requested_sport=world_cup` retained — v2.0 Phase 5 (FORM-01, FORM-02, FORM-03)
- ✓ `/api/signup` widened — `team` allow-list + IANA `timezone` (fallback `America/New_York`, never rejects), additive contract, `bad-form` reused, no new error codes — v2.0 Phase 5 (SIGNUP-01, SIGNUP-02, SIGNUP-03, COMPAT-02; verified Phase 5 smoke 8/8 + Phase 11 prod launch gate)
- ✓ Pre-milestone-row backfill + `/manage` one-time "pick a team" banner — v2.0 Phase 5/9 (COMPAT-01)
- ✓ `/privacy` + `/terms` legal pages on the shared site shell, last-updated matches deploy — v2.0 Phase 7 (LEGAL-01, LEGAL-02)
- ✓ `/og-image.png` (1200×630, <300KB) from checked-in source SVG + OG/Twitter image meta — v2.0 Phase 8 (OG-01)
- ✓ `/manage` multi-team editor (1–5 confederation-grouped checkboxes, `user_teams` join table) + HMAC unsubscribe (1y TTL, single-use), no new auth surface — v2.0 Phase 9/12 (MANAGE-01, MANAGE-02; restores v1 IDENT-02/03/04 multi-team model)
- ✓ Confirmation email names team + human-readable timezone; custom Resend domain `hello@oddlympics.app` live, Mail-Tester 10/10 — v2.0 Phase 10 (SIGNUP-04)
- ✓ Production launch gate AC1–AC12 green; `v1.0-consumer-landing` tagged + pushed — v2.0 Phase 11
- ✓ Per-user referral link with attribution — unique 8-char `[a-z0-9]` code per signup (additive `pragma_table_info` migration + idempotent backfill + UNIQUE index + collision-retry on insert); landing page reads `?ref=CODE` (with 30-day first-touch localStorage fallback) and `/api/signup` records `referred_by` without ever rejecting; smoke 14/14, DEPLOY.md attribution recipe — Validated in Phase 13: Referral Code & Attribution (REF-01, REF-02, REF-03)
- ✓ Share prompts on `/pending`, `/confirmed`, and signed-in `/manage` + share line in confirmation email (HTML + plaintext) — single `shareText(teamLabel, url)` helper in `src/lib/copy.ts`; transport via `&rc=` (+ `&team=` on /pending) appended to `/api/signup` and `/api/confirm` 303 redirects; Web Share API feature-detect with `navigator.clipboard.writeText` fallback + "Copied!" 1.5s flash; AbortError suppression on user cancel; regex-gated `?rc=` (8-char `[a-z0-9]`) before DOM-property assignment; smoke 17/17 end-to-end including 3 new SHARE-* cases — Validated in Phase 14: Share Experience (SHARE-01, SHARE-02, SHARE-03, SHARE-04). Note: 5 D-20 walk-through items (native share sheet on mobile, clipboard fallback on desktop, hidden-when-empty branches, cross-client email rendering, /manage share card per-branch visibility) tracked in `14-HUMAN-UAT.md` pending operator confirmation pre-launch.

### Active

<!-- v2.1 Referral & Social Sharing — started 2026-05-22. Detailed REQ-IDs in REQUIREMENTS.md. -->

- [ ] Per-team OG image rendered server-side at `/r/CODE` — Phase 15

### Out of Scope

<!-- Explicit boundaries with reasoning to prevent re-adding -->

- **Niche-sport coverage (strongman, cubing, drone racing)** — captured as VIP-form interest signal only, not built. World Cup is the launch wedge; niche sports follow if v1 demand validates.
- **Per-event / per-creator tipping** — design doc explicitly defers; single-creator vault tip jar is v1.
- **OAuth / social login / password auth** — magic-link covers identity; password auth adds reset/session/hash surface area we don't have time for.
- **SMS notifications** — A2P 10DLC registration + provider integration is multi-week paperwork. Email + Telegram cover it.
- **Web push (browser)** — service worker + per-platform quirks too risky for the deadline; Telegram fills the "instant push" slot.
- **Multi-event coverage (Olympics, Tour de France, etc.)** — v2 territory after WC validates the personalization graph.
- **Real backend with Postgres / multiple replicas** — single droplet + SQLite handles WC-launch scale; revisit only if traffic forces it.
- **Custom Resend domain (DKIM/DMARC for oddlympics.app)** — LIVE in v2.0 (Phase 10, 2026-05-15): production sends from the verified custom domain `hello@oddlympics.app` (set via `/etc/oddlympics.env` `EMAIL_FROM`), scoring 10/10 on Mail-Tester. Originally a deferral — the "sandbox sender first" plan was superseded once the custom domain was verified. (`src/lib/email.ts` keeps the `onboarding@resend.dev` default as the dev/fallback sender.)
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
deferred niche-sport long tail is a real personal need, not a hypothetical
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
| World Cup only for sport coverage; niche sports captured via VIP form only | Single-sport launch story is cleaner; niche coverage builds against post-launch demand signal, not speculation | — Pending |
| Free football data API (e.g. football-data.org) over fully hand-curated schedule | API removes manual upkeep risk during knockout-bracket changes; manual override path covers ToS or rate-limit issues | — Pending |
| Email + Telegram only for notifications (no SMS, no web push) | A2P 10DLC SMS registration is multi-week paperwork; web push has cross-platform quirks; email is shipping today and Telegram is one bot away | — Pending |
| Magic-link auth (extend teaser pattern) over email+password | Identity is solved by the existing token + Resend flow; password adds reset/session/hashing surface we don't need on this timeline | — Pending |
| Single global Lightning tip jar via vaultwarden; integration shape TBD at phase planning | Per-event/per-creator tipping is design-doc-explicit deferred scope; vault integration shape may need vault-side work, defer locking until then | — Pending |
| Stay on the existing droplet/Caddy/systemd stack | Stack is shipping reliably; no rewrites mid-deadline | ✓ Good (already proven) |
| **v2.0 consumer pivot — strip BTC/Lightning/"world domination"/"personal Olympics" from public surfaces; rewrite landing for casual soccer fans** | Existing copy is optimized for indie/builder audience and converts poorly from cold paid/organic traffic; paid-ad reviewers also require `/privacy` + `/terms`. Backend, ESP, and infra are untouched except for additive `team`/`timezone` columns on the signup payload — magic-link, kickoff cron, schedule data all stay. | ✓ Shipped v2.0 (2026-05-16) — LAND-02 grep clean on all public surfaces; market validation pending real signups by 2026-06-11 |
| **Single-team signup at intake; multi-team selection preserved post-signup on `/manage`** | Cold-traffic conversion favors one decision per field; multi-team is a returning-user need restored post-signup. | ✓ Shipped v2.0 (Phase 12, verified 11/11 2026-05-16): `user_teams` join table, `/manage` 1–5 confederation checkboxes, cron fan-out via `user_teams`, signup single-team (D-03), CR-01/CR-02 consent contract closed. Phase 11 launch gate re-ran post-Phase-12; `v1.0-consumer-landing` cut + pushed. Resolved — no open gate. |
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
*Last updated: 2026-05-23 — Phase 14 (Share Experience) complete; SHARE-01/02/03/04 validated, 5 human-UAT items pending operator walk-through. Next: Phase 15 (Personalized Open Graph). Milestone v2.1, hard target 2026-06-11.*
