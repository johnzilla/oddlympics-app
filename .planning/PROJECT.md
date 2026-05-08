# oddlympics — v1 MVP

## What This Is

**Personalized "when does MY thing happen" notifications for international sports
fans, launching with the 2026 FIFA World Cup.** Users pick the teams they care
about, get the matches in their own time zone, receive email + Telegram pings
before kickoff, and can tip a single creator over Lightning. The teaser landing
page is already live at https://oddlympics.app — this milestone turns it into
the actual product before group stage starts on **2026-06-11**.

## Core Value

**A user picks their team and gets a kickoff notification in their local time,
on time, before group stage 2026.** If everything else fails — tipping breaks,
Telegram lags, the schedule is hand-typed — the user must still get a "USA
vs. Iran kicks off in 60 minutes (your time)" email that lands when promised.

## Requirements

### Validated

<!-- Shipped in v1 teaser, confirmed working -->

- ✓ Public landing page at oddlympics.app — v1 teaser
- ✓ Email capture with HMAC magic-link double-opt-in confirm — v1 teaser
- ✓ Honeypot + per-IP/email rate limiting on signup — v1 teaser
- ✓ Astro 5 server-mode + SQLite + Resend stack on a single DigitalOcean droplet — v1 teaser
- ✓ GitHub Actions auto-deploy on push to `main` (~40s end-to-end) — v1 teaser
- ✓ Caddy with auto Let's Encrypt + HSTS + nosniff + frame-deny + referrer policy — v1 teaser
- ✓ Plausible analytics across all pages — v1 teaser

### Active

<!-- v1 MVP scope — building toward 2026-06-11 World Cup launch -->

#### Pre-launch hardening (Phase 1)

- [ ] Fix `confirmed.astro` so error states (`bad-token`, `already`, `unknown`) render correctly (currently always shows success copy due to prerender bug)
- [ ] Add `/api/unsubscribe` and an unsubscribe link in every email (CAN-SPAM/CASL/GDPR before sending non-confirmation email)
- [ ] Stricter cross-origin POST handling (default-deny on missing `Origin`)
- [ ] CSP header in Caddyfile (allowing Plausible + own inline scripts)
- [ ] Automated daily SQLite backup off-droplet (rclone → S3/B2 or equivalent)
- [ ] Magic-link TTL drop from 7 days → 24 hours, or per-token nonce revocation

#### Identity + personalization

- [ ] User identifies via magic-link (extends existing teaser pattern; no password)
- [ ] User picks 1+ teams from a list of all 48 World Cup 2026 teams; selection persists
- [ ] User can edit team selection later from a magic-link-authenticated page
- [ ] User's local time zone is captured at signup (browser-detected) and used for all notification rendering

#### Schedule + data

- [ ] World Cup 2026 schedule (104 matches) ingested from a free football data API (e.g. football-data.org), with manual override path for corrections
- [ ] Local SQLite cache of schedule + per-user subscriptions; nightly refresh job
- [ ] Personal schedule page renders only the user's selected matches in their TZ

#### Notifications

- [ ] Email kickoff notification ~60 minutes before each match the user subscribed to (Resend)
- [ ] Optional Telegram notification via bot — user links a chat ID via deep-link from email
- [ ] Notifications include match metadata + a "view your schedule" link (signed token, no login needed)
- [ ] No-spam rule: at most one notification per user per match; idempotent if scheduler re-runs

#### Lightning tip jar

- [ ] Single global tip jar visible on schedule + notification footer
- [ ] Integration shape with vaultwarden TBD during phase planning (LNURL link-out vs. embedded widget vs. server-to-server invoice mint — surfaced as Phase TBD)

### Out of Scope

<!-- Explicit boundaries with reasoning to prevent re-adding -->

- **Niche-sport coverage (strongman, cubing, drone racing)** — captured as VIP-form interest signal only, not built. World Cup is the launch wedge; niche sports follow if v1 demand validates.
- **Per-event / per-creator tipping** — design doc explicitly defers; single-creator vault tip jar is v1.
- **OAuth / social login / password auth** — magic-link covers identity; password auth adds reset/session/hash surface area we don't have time for.
- **SMS notifications** — A2P 10DLC registration + provider integration is multi-week paperwork. Email + Telegram cover it.
- **Web push (browser)** — service worker + per-platform quirks too risky for the deadline; Telegram fills the "instant push" slot.
- **Multi-event coverage (Olympics, Tour de France, etc.)** — v2 territory after WC validates the personalization graph.
- **Real backend with Postgres / multiple replicas** — single droplet + SQLite handles WC-launch scale; revisit only if traffic forces it.
- **Custom Resend domain (DKIM/DMARC for oddlympics.app)** — v1.1; ship with Resend's verified sandbox sender first.
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
*Last updated: 2026-05-08 after initialization*
