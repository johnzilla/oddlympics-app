# Roadmap: oddlympics v2.0 Consumer Landing & Signup Flow

## Overview

The v1 MVP shipped: teaser landing, magic-link sign-in, team picker, personal
schedule, kickoff notification cron (dry-run). The public surface is still
optimized for an indie/builder audience and converts poorly from cold
paid/organic traffic. Paid-ad reviewers also require `/privacy` + `/terms`.

This milestone replaces the public-facing surface — landing page, signup
payload (now `team` + `timezone`), legal pages, OG image, `/manage` editor,
confirmation email — with consumer-targeted World Cup 2026 copy. Backend,
ESP, kickoff cron, and schedule data are untouched except for the additive
`team`/`timezone` columns. Target completion: **2026-05-19** (7 days from
start, before group-stage kickoff 2026-06-11).

**Scope discipline:** every public-surface byte must pass LAND-02 (no
`bitcoin`, `lightning`, `crypto`, `world domination`, `personal olympics`
anywhere in `/`, `/privacy`, `/terms`, `/manage`, meta tags, OG image,
inline scripts, or inline styles).

## Phases

- [ ] **Phase 5: Schema + signup payload** — additive `team`/`timezone` columns, allow-list validation, backfill, `/api/signup` widened without breaking the existing contract
- [ ] **Phase 6: Landing page + form + meta + analytics** — replace `index.astro` with the consumer template, wire 48-team dropdown + tz-label JS + Plausible `Signup Submit` event, swap meta tags
- [ ] **Phase 7: Legal pages** — `/privacy` and `/terms` routes serving canonical copy, same site shell as landing
- [ ] **Phase 8: Open Graph image** — source SVG + rendered 1200×630 PNG + OG/Twitter image meta tags wired to it
- [ ] **Phase 9: `/manage` editor + unsubscribe** — show + edit team and timezone, one-time banner for backfilled rows, confirm unsubscribe token semantics
- [ ] **Phase 10: Confirmation email update** — name team + timezone in the body, deliverability cross-client + spam-score check
- [ ] **Phase 11: End-to-end + launch gate** — AC1–AC12 on production, Lighthouse run, real signup test, tag `v1.0-consumer-landing`

## Phase Details

### Phase 5: Schema + signup payload
**Goal**: A signup that submits `team` + `email` + hidden `timezone` is validated, persisted, and reachable end-to-end on the API layer — without breaking the existing teaser contract or any existing row.
**Depends on**: Nothing (foundation for v2.0)
**Requirements**: SIGNUP-01, SIGNUP-02, SIGNUP-03, COMPAT-01, COMPAT-02
**Success Criteria** (what must be TRUE):
  1. A `POST /api/signup` with valid `team` (in the 48-team allow-list) + `email` + valid IANA `timezone` returns 303 → `/pending?email=...` and persists a row with all four fields (`email`, `team`, `timezone`, `requested_sport=world_cup`) plus `created_at`.
  2. A `POST /api/signup` with missing or unknown `team` is rejected with 303 → `/?error=bad-form` and no row is written; server log distinguishes "bad team" from other `bad-form` causes.
  3. A `POST /api/signup` with empty or invalid `timezone` falls back to `America/New_York`, persists the row, and flags it for later IP-based correction — does NOT reject.
  4. Pre-milestone subscriber rows (no `team`, no `timezone`) load from the DB without error after migration; their backfilled values are `team=NULL`, `timezone='America/New_York'`.
  5. Existing honeypot, Origin check, rate limit, and email-format-validation behavior are preserved — programmatic POST with `website` field set returns no row; no new error codes are introduced.
**Plans:** 6 plans

Plans:
**Wave 1**
- [ ] 05-01-PLAN.md — Docs sweep (America/Detroit → America/New_York in ROADMAP/REQUIREMENTS/MILESTONE)
- [ ] 05-02-PLAN.md — references/teams.json (48 entries) + teams.slug column + ingestor + backfill

**Wave 2** *(blocked on Wave 1 completion)*
- [ ] 05-03-PLAN.md — vip_signups migration: add team, drop selected_teams; pre-migration backup

**Wave 3** *(blocked on Wave 2 completion)*
- [ ] 05-04-PLAN.md — Widen /api/signup: VALID_TEAMS, VALID_TZ allow-lists + persist team/timezone
- [ ] 05-05-PLAN.md — Downstream consumers: kickoff cron, schedule.astro, /api/save-selection

**Wave 4** *(blocked on Wave 3 completion)*
- [ ] 05-06-PLAN.md — scripts/smoke-signup.mjs verification (AC2/AC9/AC12 evidence)

**Risk note (R-2)**: Existing subscriber count is unknown. Confirm row count
at plan time before running the backfill; if list is unexpectedly large
(>10k), revisit migration strategy (single `ALTER TABLE` is fine for SQLite
at our scale, but the one-time banner copy on `/manage` may need tuning).

**Data files in this phase**: `references/teams.json` (canonical 48-team
list with snake_case slugs + confederation grouping) checked into the repo;
IANA tz allow-list derived at runtime from `Intl.supportedValuesOf('timeZone')`
per R-5 (pin Node 22 in the unit + CI).

### Phase 6: Landing page + form + meta + analytics
**Goal**: A first-time visitor lands on a consumer-targeted page, sees the headline + JS-populated tz label + banner pill, scrolls through four below-fold sections, selects their team from a 48-option dropdown, submits, and fires a `Signup Submit` Plausible event with the `team` prop populated.
**Depends on**: Phase 5
**Requirements**: LAND-01, LAND-02, LAND-03, LAND-04, FORM-01, FORM-02, FORM-03, META-01, ANLTC-01
**Success Criteria** (what must be TRUE):
  1. The landing page renders the headline "Your team's matches. In your time zone. One ping before kickoff."; sub-headline includes a JS-populated tz label (e.g., "Detroit time"); banner pill reads `WORLD CUP 2026 · JUNE 11 – JULY 19`; the four below-fold sections (How it works / Why this exists / After the World Cup / FAQ with 5 items) and the consumer footer (Manage, Privacy, Terms, Contact `hello@oddlympics.app`, "Independent project · Not affiliated with FIFA") are all present.
  2. The signup form posts `team` (48-team confederation-grouped dropdown, snake_case slugs) + `email` + hidden `timezone` (populated by JS from `Intl.DateTimeFormat().resolvedOptions().timeZone`) + retained honeypot + retained `requested_sport=world_cup` to `/api/signup` with the same content-type/HTTP semantics as today; the existing `?error=...` client-side rendering still works.
  3. The page renders without horizontal scroll or text overlap at 390 / 768 / 1280 px viewports and scores ≥ 90 on Lighthouse mobile (Performance, Accessibility, Best Practices, SEO).
  4. The page's `<head>` carries the new `<title>`, meta description, Open Graph (`og:title`, `og:description`, `og:type=website`, `og:url=https://oddlympics.app`, `og:site_name=Oddlympics`), and Twitter card (`twitter:card=summary_large_image`, `twitter:title`, `twitter:description`) tags — with zero occurrences of `bitcoin`, `lightning`, `crypto`, `world domination`, `personal olympics` anywhere in the served HTML or inline assets.
  5. Submitting the form fires a `Signup Submit` Plausible event with `team` prop = selected slug; the existing Plausible script + init call is unchanged.
**Plans**: TBD
**UI hint**: yes

**Risk note (R-4)**: Plausible custom goal `Signup Submit` must be configured
server-side in the Plausible dashboard BEFORE this phase ships, or the
events drop silently. Pin this as a pre-deploy operator action in the plan.

**Note**: OG image meta tags (`og:image`, `og:image:width`, `og:image:height`,
`og:image:alt`, `twitter:image`) are listed in META-01 but their value
points at the asset built in Phase 8. The page can ship with placeholder
image URLs in Phase 6 and the image tags get wired to the real asset in
Phase 8 — OR Phase 8 ships first. Plan-time decision; either order is fine.

### Phase 7: Legal pages
**Goal**: `/privacy` and `/terms` return 200 with canonical copy on the same site shell as the landing page, satisfying paid-ad reviewer requirements.
**Depends on**: Phase 6 (uses the same site shell — fonts, footer)
**Requirements**: LEGAL-01, LEGAL-02
**Success Criteria** (what must be TRUE):
  1. `GET /privacy` returns 200 with copy declaring: data collected (email, team, timezone, server logs), retention (logs ≤ 30 days), no third-party tracking cookies, Plausible cookie-free, GDPR/CCPA deletion path (`privacy@oddlympics.app`, 30 days), Resend named as ESP. Last-updated date matches the deploy date.
  2. `GET /terms` returns 200 with copy declaring: free service through 2026-07-19, best-effort delivery, no FIFA/ESPN/team affiliation, prohibition on submitting fake/others' emails, Michigan (USA) governing law, `hello@oddlympics.app` for questions. Last-updated date matches the deploy date.
  3. Both pages match the landing page shell (same fonts, same consumer footer); no nav menu required.
  4. Both pages pass LAND-02 — zero occurrences (case-insensitive) of `bitcoin`, `lightning`, `crypto`, `world domination`, `personal olympics` anywhere in the rendered HTML or inline assets.
**Plans**: TBD
**UI hint**: yes

**Canonical copy**: lives at `references/privacy.md` and `references/terms.md`,
checked into the repo at plan time. Pages can be Astro static (`prerender = true`)
since they're pure content.

### Phase 8: Open Graph image
**Goal**: Every social share (Slack, iMessage, Twitter, opengraph.xyz preview) of an oddlympics.app URL renders a clean 1200×630 card with wordmark, banner, headline, sub, URL, and FIFA-disclaimer tag.
**Depends on**: Phase 6 (image meta tags get wired in `<head>`; can land before or after Phase 6 as long as both ship before launch)
**Requirements**: OG-01
**Success Criteria** (what must be TRUE):
  1. `GET /og-image.png` returns 200, content-type `image/png`, exact dimensions 1200×630, file size < 300 KB.
  2. The rendered image shows wordmark, banner text `WORLD CUP 2026 · JUNE 11 – JULY 19`, the headline, a one-line sub, the URL `oddlympics.app`, and the "Independent project · Not affiliated with FIFA" tag — with zero prohibited terms (LAND-02).
  3. The source SVG (`references/og-image.svg`) is committed to the repo so the asset can be re-rendered after copy changes.
  4. opengraph.xyz preview for `https://oddlympics.app`, a Slack share, and an iMessage share each render the card cleanly (headline + banner + URL visible).
**Plans**: TBD
**UI hint**: yes (image asset is a public-facing visual surface)

**Risk note (R-3)**: SVG → PNG rendering in CI requires a tool not currently
installed. At plan time choose ONE: (a) install `rsvg-convert` or `cairosvg`
in the GitHub Actions runner + as a npm build step, or (b) commit a
pre-rendered `og-image.png` next to the SVG and treat the SVG as
"editable source, manually re-render with `rsvg-convert ... > og-image.png`
when copy changes." Option (b) is faster to ship; option (a) closes the
"rebuildable from source in CI" loop.

### Phase 9: `/manage` editor + unsubscribe
**Goal**: A signed-in subscriber can view + edit their team and timezone on `/manage`, pre-milestone subscribers see a one-time banner prompting them to pick a team, and the one-click unsubscribe email link works without re-authentication.
**Depends on**: Phase 5 (schema columns must exist before /manage can show them)
**Requirements**: MANAGE-01, MANAGE-02
**Success Criteria** (what must be TRUE):
  1. A signed-in user visiting `/manage` sees their current team + current timezone displayed, can change both via a form, and after save sees the updated values reflected on a re-load. Auth continues to use the existing magic-link/session mechanism — no new auth surface.
  2. A pre-milestone subscriber row (`team=NULL`, `timezone='America/Detroit'` from Phase 5 backfill) loads `/manage` without error and sees a one-time banner prompting "Pick a team" — the banner dismisses once `team` is set to a non-NULL value.
  3. Clicking the unsubscribe link in an outbound email reaches `/api/unsubscribe?token=...` and removes the user from active sending, with no authentication beyond the signed token. Token is HMAC-signed, expires after 1 year, single-use per unsubscribe action; second click on the same token does not error but is a no-op.
  4. Re-subscribing a previously-unsubscribed user via a fresh signup is supported (existing teaser behavior preserved).
**Plans**: TBD
**UI hint**: yes

**Plan-time decision**: choose between reusing `/api/save-selection`
semantics or introducing `/api/manage` for the update endpoint. MANAGE-01
requires the plan to pin this. Document the choice in the plan, not the
roadmap.

### Phase 10: Confirmation email update
**Goal**: The confirmation email a new signup receives names the user's team and timezone in human-readable form, renders cleanly across Gmail/Proton/Outlook, and scores ≥ 8/10 on Mail-Tester.
**Depends on**: Phase 5 (template needs the `team` + `timezone` fields persisted)
**Requirements**: SIGNUP-04
**Success Criteria** (what must be TRUE):
  1. The confirmation email body names both the team and a human-readable timezone (e.g., "We'll email you 1 hour before every England match in Detroit time.") using the values from the signup row.
  2. Test sends to Gmail, Proton, and Outlook inboxes render the email cleanly (no broken layout, links resolve, unsubscribe footer present, no prohibited terms).
  3. A Mail-Tester run against the production sender scores ≥ 8/10.
**Plans**: TBD

**Risk note (R-1 resolved)**: ESP is already wired (Resend). No provider
pick needed in this phase; the work is template copy + cross-client
verification.

### Phase 11: End-to-end + launch gate
**Goal**: AC1–AC12 from MILESTONE-consumer-landing.md all pass on production, Lighthouse mobile ≥ 90 is captured to a saved report, a real signup from a fresh browser profile completes the full confirm → manage → unsubscribe loop, and the release is tagged.
**Depends on**: Phases 5–10
**Requirements**: (none new — verification/launch-gate phase)
**Success Criteria** (what must be TRUE):
  1. All twelve acceptance criteria AC1–AC12 (in REQUIREMENTS.md and MILESTONE-consumer-landing.md) are verified passing on `https://oddlympics.app` and the evidence is captured per-AC in the plan (curl outputs, Playwright run logs, screenshots, dashboard links).
  2. A Lighthouse mobile run against the production landing page is saved to `references/lighthouse-final.html` and shows Performance, Accessibility, Best Practices, SEO all ≥ 90.
  3. A real signup from John's personal Gmail in a fresh browser profile delivers a correctly-rendered confirmation email naming the team and timezone within 60 seconds; the unsubscribe link from that email returns the user to `/unsubscribed` and removes them from active sending.
  4. The release is tagged `v1.0-consumer-landing` in git on the deploy commit.
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 5. Schema + signup payload | 0/6 | Not started | - |
| 6. Landing page + form + meta + analytics | 0/TBD | Not started | - |
| 7. Legal pages | 0/TBD | Not started | - |
| 8. Open Graph image | 0/TBD | Not started | - |
| 9. `/manage` editor + unsubscribe | 0/TBD | Not started | - |
| 10. Confirmation email update | 0/TBD | Not started | - |
| 11. End-to-end + launch gate | 0/TBD | Not started | - |

**Execution order:** 5 → 6 → 7 → 8 → 9 → 10 → 11. Phases 7 and 8 only
depend on Phase 6's site shell + meta-tag scaffolding respectively; 9 and
10 only depend on Phase 5's schema. The strict order above is the
conservative sequence; some pairs (7↔8, 9↔10) could run in parallel if
attention budget allows.

## Coverage

✓ All 20 v2.0 requirements mapped to exactly one phase
✓ No orphans, no duplicates

| Phase | v2.0 Requirements | Count |
|-------|-------------------|-------|
| 5 | SIGNUP-01, SIGNUP-02, SIGNUP-03, COMPAT-01, COMPAT-02 | 5 |
| 6 | LAND-01, LAND-02, LAND-03, LAND-04, FORM-01, FORM-02, FORM-03, META-01, ANLTC-01 | 9 |
| 7 | LEGAL-01, LEGAL-02 | 2 |
| 8 | OG-01 | 1 |
| 9 | MANAGE-01, MANAGE-02 | 2 |
| 10 | SIGNUP-04 | 1 |
| 11 | (verification only — no new reqs) | 0 |
| **Total** | | **20** |

---

## Previous milestones

### v1 MVP — shipped on `main` (2026-05-08 → 2026-05-11)

Five phases (1, 2, 2.5, 3, 4) turned the teaser landing into a working
World Cup notification product. Phases 1–3 are in code on `main`; Phase 4
is a planned launch-week observation checkpoint scheduled
**2026-06-11 → 2026-06-14** (still pending real execution). Phase 1 is
the only one with full GSD planning artifacts; Phases 2, 2.5, 3 were
shipped speed-mode without going through discuss → plan → execute.

- **Phase 1 — Pre-launch Hardening** (HARDEN-01/02/03/04/06): confirmed.astro
  status fix, `/api/unsubscribe`, CSP enforce, default-deny on missing
  Origin, 24h magic-link TTL. Operator action: DigitalOcean Backups enabled
  2026-05-10.
- **Phase 2 — Identity & Personal Schedule** (IDENT-01…05, DATA-01/02/04):
  magic-link sign-in, team picker, browser-tz capture with manual override,
  football-data.org → `teams`/`matches` SQLite ingestor + nightly timer,
  cookie-based 30-day sliding sessions.
- **Phase 2.5 — Launch Comms** (LAUNCH-01 + SC4): `scripts/launch-blast.mjs`
  ready (dry-run by default); demand-capture textarea on `/schedule` +
  `feature_requests` table.
- **Phase 3 — Kickoff Notifications** (NOTIFY-01, NOTIFY-03, NOTIFY-04):
  `oddlympics-notify.timer` every 5 min, dry-run pending `KICKOFF_NOTIFICATIONS_ENABLED=true`.
- **Phase 4 — Launch Week Observation**: scheduled 2026-06-11 → 2026-06-14.

Per-phase detail: `.planning/phases/01-pre-launch-hardening/`,
`.planning/phases/04-launch-week-observation/` (Phases 2, 2.5, 3 have no
phase-dir artifacts — speed-mode ships).

**Pending operator actions inherited from v1 (independent of v2.0 work,
must complete before group-stage kickoff 2026-06-11):**
1. Fire the launch blast — `scripts/launch-blast.mjs --send` (currently dry-run).
2. Flip kickoff notifications to live — set `KICKOFF_NOTIFICATIONS_ENABLED=true`
   on the droplet (`/etc/oddlympics.env`) and restart `oddlympics-notify.timer`.
3. End-to-end smoke test of one real kickoff notification before 2026-06-11.
