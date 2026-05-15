# Milestone: Consumer Landing & Signup Flow (M1)

**Project:** oddlympics.app
**Owner:** John Turner
**Created:** 2026-05-12
**Target completion:** 2026-05-19 (7 days)
**Status:** in progress — Phases 5–9 shipped (in code on `main`); Phase 10
(confirmation email) in its operator close-out gate; Phase 11 (E2E launch gate)
pending. Note: the GSD roadmap maps this milestone to phases 5–11, not the 1–7
"suggested phase breakdown" sketched below (which predates planning).

---

## Context

The current site at oddlympics.app is shipped but optimized for an indie / builder audience: monospace dark theme, "World domination. Your world." headline, "Personal Olympics, translated to your time zone" subhead, and "Bitcoin/Lightning rails" in the meta description. The signup form collects email only.

The product is pivoting to a **pure consumer launch** anchored on the 2026 FIFA World Cup (June 11 – July 19). The audience for that launch is casual soccer fans landing from cold paid and organic traffic — not crypto, not dev Twitter, not "builders." The current page does not convert that audience.

This milestone replaces the landing page, signup payload, and post-signup pages to support the consumer launch. It does not change product positioning beyond the public-facing surface: the backend, ESP, and infrastructure are untouched except where the signup payload widens.

Out of scope for this milestone: ads, GTM, content creation, social, email content beyond the confirmation, weird-sports product flows. Those are tracked in separate milestones.

---

## Goals

1. Replace the landing page with consumer-targeted copy and a two-field signup (team + email).
2. Capture team and IANA timezone at signup so per-user kickoff alerts can be computed.
3. Ship `/privacy` and `/terms` pages so paid ad reviewers will approve the domain.
4. Ship an Open Graph image so every social share renders cleanly.
5. Verify the full signup → confirmation → unsubscribe → manage loop works end to end with the new payload.

---

## Non-goals

- Multi-team selection at signup (single team only for v1).
- IP-based country preselection for the team dropdown.
- Localization of the landing page (English only for v1).
- Web push notifications (email only for v1).
- Any visible mention of crypto, Lightning, Bitcoin, or "world domination" in public copy.
- Any weird-sports verticals beyond the teaser block on the landing page.
- Pricing, paid tiers, or monetization surfaces.

---

## Requirements

### R1 — Landing page replacement

- R1.1 Replace `index.html` with the consumer landing template (provided in `references/index.html`).
- R1.2 Headline: "Your team's matches. In your time zone. One ping before kickoff."
- R1.3 Sub-headline includes a JS-populated timezone label (e.g., "Detroit time", "London time"), with a fallback string of "your local time" when JS is disabled or the browser does not expose `Intl.DateTimeFormat().resolvedOptions().timeZone`.
- R1.4 Banner pill reads: `WORLD CUP 2026 · JUNE 11 – JULY 19`.
- R1.5 Page must include four below-fold sections in this order: How it works (3 steps), Why this exists, After the World Cup, Common questions (FAQ, 5 items).
- R1.6 Footer must include: Manage subscription, Privacy, Terms, Contact (`mailto:hello@oddlympics.app`), and an "Independent project · Not affiliated with FIFA" copyright line.
- R1.7 No visible references to crypto, Lightning, Bitcoin, "world domination," or "personal Olympics" anywhere on the page or in any meta tag.
- R1.8 Page must pass Lighthouse mobile score ≥ 90 across Performance, Accessibility, and Best Practices.
- R1.9 Page must be responsive at 390px, 768px, and 1280px viewports without horizontal scroll or text overlap.

### R2 — Signup form

- R2.1 Form must include three submitted fields: `team` (required, dropdown), `email` (required, type=email), `timezone` (hidden, populated by JS).
- R2.2 Team dropdown must contain all 48 qualified teams, grouped by confederation in this order: UEFA, CONMEBOL, CONCACAF, CAF, AFC, OFC. Canonical team list and slug values are in `references/teams.json` (to be created by execution).
- R2.3 Team `value` attributes must be snake_case slugs (`united_states`, `south_korea`, `ivory_coast`, `dr_congo`, `cape_verde`, `bosnia`, `czech_republic`, `new_zealand`, `saudi_arabia`, `south_africa`). Display labels use natural English with diacritics (e.g., "Curaçao").
- R2.4 Form must retain the existing hidden honeypot field (`name="website"`).
- R2.5 Form must retain the existing hidden `requested_sport=world_cup` field to remain compatible with the future weird-sports flow.
- R2.6 Form must POST to `/api/signup` with the same content-type and HTTP semantics as today; no breaking changes to the existing endpoint contract.
- R2.7 Existing client-side error rendering (reading `?error=` from the query string) must continue to work with the same error code → message mapping.

### R3 — `/api/signup` payload handling

- R3.1 Accept new `team` field. Validate against the 48-team allow-list. Reject with `?error=bad-form` if missing, empty, or not in the allow-list.
- R3.2 Accept new `timezone` field. Validate against the IANA timezone database (use the runtime's `Intl.supportedValuesOf('timeZone')` or an equivalent allow-list). On invalid or empty, fall back to `America/New_York` and flag the row for later IP-based correction. Do not reject.
- R3.3 Persist `team` and `timezone` on the subscriber record alongside `email`, `created_at`, and the existing `requested_sport`.
- R3.4 Existing rate limit, honeypot check, origin check, and email validation behavior is preserved.
- R3.5 Confirmation email must include the team name and a human-readable timezone in the body (e.g., "We'll email you 1 hour before every England match in Detroit time.").

### R4 — `/privacy` page

- R4.1 New page at `/privacy` rendering the canonical privacy copy from `references/privacy.md`.
- R4.2 Must declare: what is collected (email, team, timezone, server logs), retention (logs ≤ 30 days), no sale of data, no third-party tracking cookies, Plausible Analytics in use (cookie-free), GDPR/CCPA deletion request path (`privacy@oddlympics.app`, honored within 30 days), and the ESP used for delivery.
- R4.3 Last-updated date in the header must match the deploy date.
- R4.4 Same site shell as the landing page (same fonts, same footer, no nav menu required).

### R5 — `/terms` page

- R5.1 New page at `/terms` rendering the canonical terms copy from `references/terms.md`.
- R5.2 Must declare: free service through July 19 2026, best-effort delivery (no liability for FIFA reschedules or delivery failures), no FIFA/ESPN/team affiliation, prohibition on submitting fake or others' emails, governing law (Michigan, USA), and `hello@oddlympics.app` for questions.
- R5.3 Last-updated date matches deploy date.

### R6 — Open Graph image

- R6.1 PNG file served at `/og-image.png`, exact dimensions 1200×630, under 300KB.
- R6.2 Image must show the wordmark, the banner text "WORLD CUP 2026 · JUNE 11 – JULY 19", the headline, a one-line sub, the URL `oddlympics.app`, and the "Independent project · Not affiliated with FIFA" tag.
- R6.3 `<meta>` tags for `og:image`, `og:image:width`, `og:image:height`, `og:image:alt`, `twitter:image` must point to it and match the constants above.
- R6.4 Source SVG (`references/og-image.svg`) committed to the repo so the asset can be re-rendered after copy changes.

### R7 — Meta tags

- R7.1 New `<title>`: `Oddlympics — World Cup 2026 alerts in your time zone`.
- R7.2 New `<meta name="description">`: `Pick your team. Get one email one hour before every 2026 World Cup match, in your local time zone. Free. No ads. No betting odds.`
- R7.3 Open Graph: `og:title`, `og:description`, `og:type=website`, `og:url=https://oddlympics.app`, `og:site_name=Oddlympics`, image tags from R6.3.
- R7.4 Twitter: `twitter:card=summary_large_image`, `twitter:title`, `twitter:description`, `twitter:image`.
- R7.5 No meta tag may reference crypto, Lightning, Bitcoin, "world domination," or "personal Olympics."

### R8 — Analytics

- R8.1 Plausible script and init call preserved unchanged.
- R8.2 Submit handler fires a `Signup Submit` Plausible event with a `team` prop equal to the selected slug.
- R8.3 Plausible goal `Signup Submit` configured in the Plausible dashboard before deploy.

### R9 — `/manage` flow

- R9.1 Existing `/manage` route preserved.
- R9.2 The page must display the subscriber's current team and timezone and allow updating both. Update endpoint may reuse `/api/signup` semantics or expose a new `/api/manage`; implementer's choice but must be specified in the plan.
- R9.3 One-click unsubscribe must work without authentication beyond a signed token in the email link. Token must be HMAC-signed, expire after 1 year, and be single-use per unsubscribe action.

### R10 — Backward compatibility

- R10.1 Existing subscribers (who signed up before this milestone, with no `team` or `timezone` on record) must not break the `/manage` page or the future kickoff-alert job. Backfill: set `team = NULL`, `timezone = 'America/New_York'`, and surface a one-time banner on `/manage` prompting them to pick a team.
- R10.2 The existing `/api/signup` error-code contract is unchanged. No new error codes introduced; bad-team and bad-timezone reuse `bad-form` (with a server-side log line distinguishing them).

---

## Acceptance criteria (UAT)

These must all pass before the milestone is marked complete.

1. **AC1 — Landing page renders.** `curl -sL https://oddlympics.app | grep -c "Your team's matches"` returns ≥ 1. Visual diff against `references/landing_preview.png` matches within tolerance.
2. **AC2 — All 48 teams selectable.** Programmatic test parses the rendered `<select>` and asserts exactly 48 `<option>` elements (excluding the placeholder), each matching `references/teams.json`.
3. **AC3 — Timezone capture works.** A scripted Playwright test in three locales (`America/Detroit`, `Europe/London`, `Africa/Lagos`) submits the form and asserts the persisted row has the correct IANA timezone string and the sub-headline label rendered the expected city ("Detroit time", "London time", "Lagos time").
4. **AC4 — End-to-end signup loop.** Manual test from three email providers (Gmail, Proton, Outlook): submit form with team=England, email=tester address. Confirmation email arrives within 60 seconds, names England and the correct timezone, and the unsubscribe link in the email returns the user to a "you're unsubscribed" page and removes them from the list (verified in the ESP dashboard).
5. **AC5 — `/privacy` and `/terms` live.** Both URLs return 200 with the canonical copy. Last-updated date matches the deploy date.
6. **AC6 — OG image renders.** `https://oddlympics.app/og-image.png` returns 200, content-type `image/png`, dimensions 1200×630. [opengraph.xyz](https://www.opengraph.xyz/) preview for `https://oddlympics.app` shows the headline, banner, and URL correctly.
7. **AC7 — No prohibited terms in public surfaces.** `curl` of `/`, `/privacy`, `/terms`, `/manage` shows zero occurrences (case-insensitive) of: `bitcoin`, `lightning`, `crypto`, `world domination`, `personal olympics`.
8. **AC8 — Lighthouse mobile ≥ 90.** Performance, Accessibility, Best Practices, SEO categories all score ≥ 90 on a fresh `lighthouse https://oddlympics.app --preset=mobile` run.
9. **AC9 — `/api/signup` rejects invalid team.** POST with `team=fake_team` returns a redirect to `/?error=bad-form` and writes no row.
10. **AC10 — Backfill safety.** An existing pre-milestone subscriber row with no `team` field can be loaded on `/manage`, sees the one-time banner, and can save a team without errors.
11. **AC11 — Plausible event fires.** Form submission triggers a `Signup Submit` event visible in the Plausible dashboard with the `team` prop populated.
12. **AC12 — Honeypot still blocks bots.** Programmatic POST to `/api/signup` with the `website` field populated is rejected with no row written.

---

## Suggested phase breakdown

Phases are sized so each one is a single `/gsd-plan-phase` → `/gsd-execute-phase` cycle. Order matters: phases 2 and 3 depend on phase 1; phase 4 depends on phase 3.

### Phase 1 — Schema + payload

- Migrate subscribers table to add `team TEXT`, `timezone TEXT` (default `'America/New_York'`).
- Update `/api/signup` to parse, validate, and persist `team` and `timezone`.
- Backfill existing rows per R10.1.
- Add team allow-list and IANA-timezone allow-list as data files committed to the repo.
- Unit tests for: valid submission, missing team, invalid team, missing timezone (falls back), invalid timezone (falls back), honeypot triggered, rate limit triggered.

### Phase 2 — Landing page rewrite

- Replace `index.html` with the reference template.
- Add new meta tags per R7.
- Wire timezone JS, team dropdown, and Plausible event.
- Remove all prohibited terms from the served HTML and any inline styles/scripts.
- Playwright tests for: render at 390/768/1280, dropdown has 48 options, timezone label populates correctly in three locales, error param rendering still works.

### Phase 3 — Legal pages

- Add `/privacy` and `/terms` routes serving the reference copy.
- Match the landing page shell (header wordmark, footer).
- HTTP tests confirming 200 + content match.

### Phase 4 — OG image + share preview

- Commit `references/og-image.svg`.
- Build step renders SVG → PNG at 1200×630 and writes `/public/og-image.png` (or wherever static assets live).
- Add the `og:image` and `twitter:image` meta tags.
- Manual verification via [opengraph.xyz](https://www.opengraph.xyz/), Slack share, and iMessage share.

### Phase 5 — `/manage` updates

- Update the manage page to show team and timezone, allow editing both.
- Add the one-time banner for backfilled rows (R10.1).
- Confirm unsubscribe token semantics (HMAC, expiry, single-use) per R9.3.
- Tests: load a backfilled row, save a team, change timezone, unsubscribe, re-subscribe.

### Phase 6 — Confirmation email update

- Update the confirmation email template to name the team and timezone per R3.5.
- Send-from-staging test to Gmail/Proton/Outlook to verify rendering across clients.
- Spam-score check (Mail-Tester ≥ 8/10).

### Phase 7 — End-to-end + launch gate

- Run the full AC1–AC12 suite against production.
- Lighthouse run.
- One real test signup with John's personal email from a fresh browser profile.
- Tag the release as `v1.0-consumer-landing`.

---

## Files and references

The following reference files exist in the workspace and should be copied into `.planning/M1-consumer-landing/references/` at plan time:

- `index.html` — full HTML template, drop-in replacement for the current root file
- `oddlympics_landing_copy.md` — copy doc with headline, sub, sections, meta tags, and stub /privacy and /terms text
- `og-image.svg` — source SVG for the OG image
- `og-image.png` — pre-rendered PNG at 1200×630 (rebuildable from the SVG)
- `landing_desktop.png` — visual reference for AC1 diff comparison

The 48-team list (canonical for R2.2 and AC2) is derived from the [2026 FIFA World Cup Wikipedia entry](https://en.wikipedia.org/wiki/2026_FIFA_World_Cup) and is fully enumerated in the reference `index.html` `<select>`.

---

## Risks and open questions

- **R-1: ESP choice not specified.** Confirmation email send path needs an ESP. If none is wired today, phase 6 needs to pick one (Resend, Buttondown, ConvertKit) before it can pass.
- **R-2: Existing subscriber count unknown.** R10.1 backfill is trivial if the list is small (< 1000), trickier if there are tens of thousands. Confirm at plan time.
- **R-3: SVG → PNG render in CI.** If the build environment lacks `rsvg-convert` or `cairosvg`, phase 4 needs to either install one or commit the PNG directly. Pre-rendered PNG is in the references as a fallback.
- **R-4: Plausible goal naming.** Plausible custom events require the goal to be configured server-side. R8.3 must be done before the form ships or events drop silently.
- **R-5: Timezone allow-list staleness.** IANA timezones change occasionally. Using `Intl.supportedValuesOf('timeZone')` at runtime is preferred over a static list; pin the Node version if so.

---

## Done definition

Milestone is done when:
1. All AC1–AC12 pass on production.
2. The release is tagged `v1.0-consumer-landing` in git.
3. A real signup (John's personal Gmail) from a fresh browser receives a correctly-rendered confirmation email naming the team and timezone within 60 seconds.
4. [opengraph.xyz](https://www.opengraph.xyz/) preview of `https://oddlympics.app` renders the OG image without errors.
5. Lighthouse mobile report (saved to `references/lighthouse-final.html`) shows all four categories ≥ 90.
