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

- [x] **Phase 5: Schema + signup payload** — additive `team`/`timezone` columns, allow-list validation, backfill, `/api/signup` widened without breaking the existing contract
- [x] **Phase 6: Landing page + form + meta + analytics** — replace `index.astro` with the consumer template, wire 48-team dropdown + tz-label JS + Plausible `Signup Submit` event, swap meta tags (completed 2026-05-13)
- [x] **Phase 7: Legal pages** — `/privacy` and `/terms` routes serving canonical copy, same site shell as landing (completed 2026-05-14)
- [x] **Phase 8: Open Graph image** — source SVG + rendered 1200×630 PNG + OG/Twitter image meta tags wired to it (completed 2026-05-14)
- [x] **Phase 9: `/manage` editor + unsubscribe** — show + edit team and timezone, one-time banner for backfilled rows, confirm unsubscribe token semantics (completed 2026-05-14)
- [x] **Phase 10: Confirmation email update** — name team + timezone in the body, deliverability cross-client + spam-score check (completed 2026-05-16)
- [ ] **Phase 11: End-to-end + launch gate** — AC1–AC12 on production, Lighthouse run, real signup test, tag `v1.0-consumer-landing` (BLOCKED on multi-team — re-runs AFTER Phase 12)
- [x] **Phase 12: Restore multi-team selection** — `user_teams` join table, `/manage` confederation checkboxes (1–5), kickoff cron join swap, N-team copy check (completed 2026-05-16)

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
- [x] 05-01-PLAN.md — Docs sweep (America/Detroit → America/New_York in ROADMAP/REQUIREMENTS/MILESTONE)
- [x] 05-02-PLAN.md — references/teams.json (48 entries) + teams.slug column + ingestor + backfill

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 05-03-PLAN.md — vip_signups migration: add team, drop selected_teams; pre-migration backup

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 05-04-PLAN.md — Widen /api/signup: VALID_TEAMS, VALID_TZ allow-lists + persist team/timezone
- [x] 05-05-PLAN.md — Downstream consumers: kickoff cron, schedule.astro, /api/save-selection

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 05-06-PLAN.md — scripts/smoke-signup.mjs verification (AC2/AC9/AC12 evidence)

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
**Plans:** 3 plans
**UI hint**: yes

Plans:
- [x] 06-01-PLAN.md — Full rewrite of `src/pages/index.astro` (consumer copy + 48-team confederation-grouped <select> + OG/Twitter meta tags + retuned `<style is:global>`); covers LAND-01/02/04, FORM-01/02/03, META-01.
- [x] 06-02-PLAN.md — Inline JS (tz-label swap + retained `?error=` swap + Plausible `Signup Submit` listener); covers ANLTC-01.
- [x] 06-03-PLAN.md — `scripts/smoke-landing.mjs` + `npm run smoke:landing` + Lighthouse mobile manual gate + Plausible dashboard operator action + DEPLOY.md Day-2-ops row; covers LAND-03.

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
**Plans:** 2 plans
**UI hint**: yes

Plans:
- [x] 07-01-PLAN.md — Create `src/pages/privacy.astro` (prerendered, verbatim site shell from index.astro, canonical body from references/privacy.md) + build & 200 OK verification; covers LEGAL-01.
- [x] 07-02-PLAN.md — Create `src/pages/terms.astro` (prerendered, verbatim site shell from index.astro, canonical body from references/terms.md) + build & 200 OK verification; covers LEGAL-02.

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
**Plans:** 1/1 plans complete
**UI hint**: yes (image asset is a public-facing visual surface)

Plans:
- [x] 08-01-PLAN.md — Vendor @resvg/resvg-js + 3 static-weight TTFs (JetBrains Mono Bold + Inter Regular/Bold), swap 6 font-family attrs in references/og-image.svg, write scripts/render-og-image.mjs (render + 5 D-05 byte checks + LAND-02 grep inlined), run + commit public/og-image.png, verify Astro build copies it to dist/client/. Covers OG-01.

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
  2. A pre-milestone subscriber row (`team=NULL`, `timezone='America/New_York'` from Phase 5 backfill) loads `/manage` without error and sees a one-time banner prompting "Pick a team" — the banner dismisses once `team` is set to a non-NULL value.
  3. Clicking the unsubscribe link in an outbound email reaches `/api/unsubscribe?token=...` and removes the user from active sending, with no authentication beyond the signed token. Token is HMAC-signed, expires after 1 year, single-use per unsubscribe action; second click on the same token does not error but is a no-op.
  4. Re-subscribing a previously-unsubscribed user via a fresh signup is supported (existing teaser behavior preserved).
**Plans:** 4/5 plans executed
**UI hint**: yes

Plans:
**Wave 1**
- [x] 09-01-PLAN.md — TTL_BY_PURPOSE table in src/lib/token.ts (D-05; underpins MANAGE-02 1y unsubscribe TTL)
- [x] 09-02-PLAN.md — markConfirmed WHERE widening + unsubscribed_at clear (D-07, SC4 re-subscribe) + sendManageLink URL change /schedule → /manage (D-01)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 09-03-PLAN.md — src/pages/schedule.astro becomes a thin 301 redirect to /manage preserving query string (D-01)
- [x] 09-04-PLAN.md — Rewrite src/pages/manage.astro as dual-mode editor (signed-out form retained; signed-in branch with banner + team <select> + tz row + matches list + logout) + update /api/save-selection to accept team=<slug> via VALID_TEAMS, retain team_ids[] fallback, change redirect to /manage, replace too-many with bad-team (D-01, D-02, D-03, D-04; covers MANAGE-01 + COMPAT-01)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 09-05-PLAN.md — scripts/smoke-manage.mjs with 9 end-to-end cases + npm run smoke:manage (verifies MANAGE-01, MANAGE-02, COMPAT-01, D-01 redirect, and SC4)

**Plan-time decision**: choose between reusing `/api/save-selection`
semantics or introducing `/api/manage` for the update endpoint. MANAGE-01
requires the plan to pin this. Document the choice in the plan, not the
roadmap.

### Phase 10: Confirmation email update
**Goal**: The confirmation email a new signup receives names the user's team and timezone in human-readable form, renders cleanly across Gmail + Proton (Outlook out of scope for v2.0), and scores ≥ 8/10 on Mail-Tester. ACHIEVED 2026-05-15.
**Depends on**: Phase 5 (template needs the `team` + `timezone` fields persisted)
**Requirements**: SIGNUP-04
**Success Criteria** (what must be TRUE):
  1. The confirmation email body names both the team and a human-readable timezone (e.g., "We'll email you 1 hour before every England match in Detroit time.") using the values from the signup row.
  2. Test sends to Gmail and Proton inboxes render the email cleanly (no broken layout, links resolve, unsubscribe footer present, no prohibited terms). MET 2026-05-15: Gmail (England) + Proton dark-mode (France) both PASS from prod sender `hello@oddlympics.app`. Outlook is out of scope for v2.0 — Gmail + Proton is the accepted cross-client standard (no operator Outlook access; Outlook.com is Blink-engine, ~= the passing Gmail render per RESEARCH §4). No further tracking.
  3. A Mail-Tester run against the production sender scores ≥ 8/10.
**Plans:** 3/3 plans complete

Plans:
**Wave 1**
- [x] 10-01-PLAN.md — Widen sendMagicLink(email, token, team, timezone); add teamLabel + tzLabel helpers; rewrite subject (D-05) + value-prop line (D-04); wire replyTo + List-Unsubscribe headers onto the Resend send; update /api/signup call site; covers SIGNUP-04 code surface.

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 10-02-PLAN.md — scripts/smoke-confirm-email.mjs (10 cases: canonical, multi-word, FALLBACK_TZ, underscore tz, Etc/UTC, diacritic-or-fallback, subject literal, LAND-02 grep, unknown-slug fallback, empty-tz fallthrough) + npm run smoke:confirm alias; offline byte-equivalence drift net for SIGNUP-04.

**Wave 3** *(blocked on Waves 1 + 2 completion; NOT autonomous — operator action)*
- [x] 10-03-PLAN.md — Deploy via GitHub Actions; operator runs Mail-Tester ≥ 8/10 (D-08 / SC3) + 3 cross-client sends to Gmail / Proton / Outlook (D-09 / SC2); commit 4 PNG screenshots under evidence/; write 10-SUMMARY.md with §Deliverability Evidence + §Cross-Client Evidence + §Hand-off to Phase 11.

**Risk note (R-1 resolved)**: ESP is already wired (Resend). No provider
pick needed in this phase; the work is template copy + cross-client
verification.

### Phase 11: End-to-end + launch gate
**Goal**: AC1–AC12 from MILESTONE-consumer-landing.md all pass on production, Lighthouse mobile ≥ 90 is captured to a saved report, a real signup from a fresh browser profile completes the full confirm → manage → unsubscribe loop, and the release is tagged.
**Depends on**: Phases 5–10 **and Phase 12** (multi-team must be restored before the gate certifies; the gate re-runs AFTER Phase 12 and only then cuts the withheld `v1.0-consumer-landing` tag — D-09)
**Requirements**: (none new — verification/launch-gate phase)
**Status**: BLOCKED — single-team baseline certified but the founder rejects single-team v2.0; the `v1.0-consumer-landing` tag is deliberately WITHHELD. Re-gates after Phase 12 ships (must re-verify AC2/AC3-class behavior plus the new multi-team behavior).
**Success Criteria** (what must be TRUE):
  1. All twelve acceptance criteria AC1–AC12 (in REQUIREMENTS.md and MILESTONE-consumer-landing.md) are verified passing on `https://oddlympics.app` and the evidence is captured per-AC in the plan (curl outputs, Playwright run logs, screenshots, dashboard links).
  2. A Lighthouse mobile run against the production landing page is saved to `references/lighthouse-final.html` and shows Performance, Accessibility, Best Practices, SEO all ≥ 90.
  3. A real signup from John's personal Gmail in a fresh browser profile delivers a correctly-rendered confirmation email naming the team and timezone within 60 seconds; the unsubscribe link from that email returns the user to `/unsubscribed` and removes them from active sending.
  4. The release is tagged `v1.0-consumer-landing` in git on the deploy commit (AFTER Phase 12).
**Plans:** 4/5 plans executed (re-gate pending Phase 12)

Plans:
**Wave 1**
- [x] 11-01-PLAN.md — D-02 a11y contrast fix in index.astro (#b8350d banner / #c43d15 button), color-only commit, lands FIRST
- [x] 11-02-PLAN.md — scripts/launch-gate.mjs (AC1-AC12 prod runner) + scripts/cleanup-gate-rows.mjs + smoke:gate/cleanup:gate aliases

**Wave 2** *(blocked on Wave 1 — needs the fix deployed AND the runner built)*
- [x] 11-03-PLAN.md — Deploy via GitHub Actions; operator runs npm run smoke:gate against prod, captures per-AC evidence, drives the D-01 bounded fix-and-reverify loop until AC1-AC12 all green

**Wave 3** *(blocked on Wave 2 — all 12 ACs green)*
- [x] 11-04-PLAN.md — Annotated v1.0-consumer-landing tag on the green-deploy commit, pushed (D-07)

**Wave 4** *(blocked on Wave 3 — tag must be pushed first)*
- [x] 11-05-PLAN.md — Operator post-tag cleanup of the D-04 +tag gate rows (D-05, dry-run then --confirm)

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 5. Schema + signup payload | 6/6 | Complete | 2026-05-13 |
| 6. Landing page + form + meta + analytics | 0/3 | Not started | - |
| 7. Legal pages | 0/2 | Not started | - |
| 8. Open Graph image | 1/1 | Complete   | 2026-05-14 |
| 9. `/manage` editor + unsubscribe | 4/5 | In Progress|  |
| 10. Confirmation email update | 3/3 | Complete    | 2026-05-16 |
| 11. End-to-end + launch gate | 4/5 | BLOCKED (re-gates after Phase 12) |  |
| 12. Restore multi-team selection | 4/4 | Complete   | 2026-05-16 |

**Execution order:** 5 → 6 → 7 → 8 → 9 → 10 → 11 (single-team baseline) →
**12 (restore multi-team)** → 11 re-gate + tag. Phase 12 depends on Phases
5–10 (current code), NOT on Phase 11 (D-09 — the auto-generated stub's
"Depends on: Phase 11" was inverted; this is the authoritative ordering).

## Coverage

✓ All 20 v2.0 requirements mapped to exactly one phase

| Phase | v2.0 Requirements | Count |
|-------|-------------------|-------|
| 5 | SIGNUP-01, SIGNUP-02, SIGNUP-03, COMPAT-01, COMPAT-02 | 5 |
| 6 | LAND-01, LAND-02, LAND-03, LAND-04, FORM-01, FORM-02, FORM-03, META-01, ANLTC-01 | 9 |
| 7 | LEGAL-01, LEGAL-02 | 2 |
| 8 | OG-01 | 1 |
| 9 | MANAGE-01, MANAGE-02 | 2 |
| 10 | SIGNUP-04 | 1 |
| 11 | (verification only — no new reqs) | 0 |
| 12 | (no new v2.0 reqs — restores v1 IDENT-02/03/04 model; touches NOTIFY-04, SIGNUP-04, LAND-02 as constraints) | 0 |
| **Total** | | **20** |

### Phase 12: Restore multi-team selection

**Goal:** A signed-in subscriber can follow 1–5 World Cup teams via confederation-grouped checkboxes on `/manage` (current picks pre-checked, server-enforced bounds), those picks persist in a `user_teams` join table, and the kickoff cron fans out one email per match for any followed team — while cold signup stays single-team and the one-email-per-match guarantee is preserved.
**Requirements**: (no new v2.0 reqs — restores the v1 IDENT-02/03/04 multi-team model removed by the Phase 5 schema collapse; constrained by NOTIFY-04, SIGNUP-04, LAND-02)
**Depends on:** Phases 5–10 (current code on `main`). NOT Phase 11 — the auto-generated "Depends on: Phase 11" stub was inverted; Phase 11's launch gate **re-runs AFTER** Phase 12 and only then cuts the withheld `v1.0-consumer-landing` tag (CONTEXT D-09 is authoritative).
**Plans:** 4/4 plans complete

Plans:
**Wave 1**
- [x] 12-01-PLAN.md — `user_teams` join table DDL + 3 typed prepared statements + `UserTeam` type in `src/lib/db.ts` (additive, no migration ceremony per D-02); boot-idempotency verified.

**Wave 2** *(both depend on 12-01; zero file overlap → run in parallel)*
- [x] 12-02-PLAN.md — `/manage` confederation-grouped checkbox editor + `/api/save-selection` multi-slug bounded (≥1/≤5) transactional writer reviving the `too-many`→`bad-team` redirect (D-04, D-05).
- [x] 12-03-PLAN.md — Kickoff cron `usersQuery` join swap to `user_teams` (D-06); NOTIFY-04 one-email guarantee inherited free; dry-run fan-out proof.

**Wave 3** *(depends on 12-02 + 12-03)*
- [x] 12-04-PLAN.md — D-07 `sendMagicLink` copy verify (single-team, no SIGNUP-04 regression, no LAND-02) + extend `scripts/smoke-manage.mjs` with M10–M14 end-to-end multi-team cases; full M1–M14 suite green.

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
