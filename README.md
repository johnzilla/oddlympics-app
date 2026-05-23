# oddlympics

> Your team's matches. In your time zone. One ping before kickoff.

Personalized "when does MY thing happen" notifications for international sports
fans, launching with the 2026 FIFA World Cup. Pick your team, get every match
in your local time zone, and one email an hour before each kickoff. Signup is a
two-field form (team + email) confirmed via a magic-link double-opt-in flow;
after confirming you can follow up to 5 teams from the `/manage` editor.

**Live:** https://oddlympics.app

## What this is

Astro 5 server-mode app on the Node standalone adapter. SQLite for storage,
Resend for transactional email, Caddy in front of a `systemd`-managed Node
process on a single DigitalOcean droplet. GitHub Actions auto-deploys on push
to `main` (~40 seconds end-to-end).

**Shipped and live (toward 2026-06-11 World Cup kickoff):**
- ✅ **v1 MVP** — teaser landing + double-opt-in capture, Phase 1 hardening
  (`/api/unsubscribe`, CSP enforce, default-deny origin, 24h TTL), Phase 2
  magic-link sign-in + tz capture + football-data.org schedule ingestor
  (daily 03:00 timer), Phase 2.5 launch-blast + demand-capture, Phase 3
  kickoff notification cron (5-min timer, dry-run until
  `KICKOFF_NOTIFICATIONS_ENABLED=true`).
- ✅ **v2.0 — Consumer Landing & Signup Flow** — Phase 5 schema/payload
  (`vip_signups.team` slug + IANA `timezone`, first non-additive migration),
  Phase 6 consumer landing, Phase 7 `/privacy` + `/terms`, Phase 8 Open Graph
  image, Phase 9 dual-mode `/manage` editor, Phase 10 confirmation-email
  rework (custom verified sender, 10/10 Mail-Tester). Phase 11 launch gate
  run on production: automated ACs + Lighthouse green (Perf 0.97 / A11y 1.0 /
  Best-Practices 1.0 / SEO 1.0); AC-MT (multi-team `/manage`) operator-approved
  on the Phase-12 evidence basis; AC4/AC10/AC11/OG manual checks non-blocking
  by owner decision. Phase 11 closed, tagged **`v1.0-consumer-landing`**.
- ✅ **Phase 12 — multi-team restore** — `/manage` is a 1–5 team
  confederation-grouped checkbox editor backed by a `user_teams` join table;
  signup stays single-team (one slug); the kickoff cron fans out per followed
  team. Verified 11/11.
- ✅ **v2.1 — Referral & Social Sharing** — Phases 13/14/15:
  - **Phase 13** — per-user 8-char `[a-z0-9]` referral code with attribution
    (`referred_by`), additive `pragma_table_info` migration + idempotent
    backfill + UNIQUE index + collision-retry on insert; landing reads
    `?ref=CODE` (30-day first-touch localStorage fallback) and `/api/signup`
    records attribution without ever rejecting.
  - **Phase 14** — share prompts on `/pending`, `/confirmed`, and signed-in
    `/manage`, plus a share line in the confirmation email; one
    `shareText(teamLabel, url)` helper in `src/lib/copy.ts`; Web Share API
    with `navigator.clipboard.writeText` fallback + "Copied!" 1.5s flash;
    AbortError suppression on user cancel; regex-gated `?rc=` before any
    DOM-property assignment.
  - **Phase 15** — new server-rendered `/r/[code]` route emits per-team
    `og:image` + `Following <Team> · oddlympics` title for resolved codes
    (D-01); meta-refresh + try/catch'd `location.replace('/?ref=CODE')` so
    Phase 13 attribution plumbing fires unchanged; unresolved/malformed codes
    return 200 with generic OG (never 404). 48 per-team PNGs (1200×630,
    ~4.1 MB total) under `public/og/` built by `npm run og:render-teams`
    (parameterized `og-image-team.svg` + 6-check per-team gate). All four
    Phase 14 share emitters migrated `/?ref=CODE` → `/r/CODE`. Smoke 19/19
    PASS including new `SHARE-r-known` + `SHARE-r-unknown` cases.

**Operator actions remaining (pre-launch, before 2026-06-11):**
1. **Flip kickoff cron live** — set `KICKOFF_NOTIFICATIONS_ENABLED=true` in
   `/etc/oddlympics.env`, then `systemctl restart oddlympics-notify.timer`.
2. **End-to-end smoke** one real kickoff notification after the flip.
3. **Verify football-data.org name → slug mapping** (read-only `comm` check;
   silent-loss risk in the kickoff cron — resolver was hardened 2026-05-17 but
   needs one final pre-launch confirmation).
4. **Fire the launch blast** — `scripts/launch-blast.mjs --send` (currently
   dry-run by default).
5. **Walk through the human-UAT items** logged in
   `.planning/phases/13-referral-code-attribution/13-HUMAN-UAT.md` (4 items),
   `.planning/phases/14-share-experience/14-HUMAN-UAT.md` (5 items), and
   `.planning/phases/15-personalized-open-graph/15-HUMAN-UAT.md` (1
   post-deploy item — real social-card unfurl via Twitter/LinkedIn/Facebook/
   Slack validators). See `DEPLOY.md`.

**Deferred (no scheduled milestone):** Telegram bot, Lightning tip jar,
niche-sport long tail (strongman, cubing, etc.).

Roadmap, requirements, and per-phase plans + summaries live under `.planning/`.
See `.planning/ROADMAP.md` for the v1 phase breakdown and `DEPLOY.md` for the
operator runbook.

## Routes

| Route | Method | What it does |
|---|---|---|
| `/` | GET | Static hero + signup form |
| `/pending` | GET | "Check your email" — shown after a successful signup |
| `/confirmed` | GET | Confirmation result page (renders correct copy per `?status=` via inline script) |
| `/manage` | GET | Dual-mode: signed-out magic-link form, or (session/`?token=` valid) the 1–5 team confederation-checkbox editor + tz override + schedule preview. Uses the session cookie if valid; otherwise sends a `purpose=manage` link. |
| `/schedule` | GET | **301 → `/manage`**, preserving `?token=` (the editor + schedule live on `/manage` since Phase 9). |
| `/unsubscribed` | GET | Confirmation page after one-click unsubscribe |
| `/r/[code]` | GET | **Phase 15** server-rendered referral route. Emits per-team `og:image` + `Following <Team> · oddlympics` title for resolved 8-char `[a-z0-9]` codes, then meta-refreshes + `location.replace('/?ref=CODE')` so social-card bots scrape the meta and real users land on `/` with Phase 13 attribution intact. Unresolved or malformed codes return 200 with generic OG (never 404). Shape-gated before any DB lookup or HTML echo. |
| `/api/signup` | POST | Validates email + **team** (48-slug allow-list) + **timezone** (IANA-validated, falls back to `America/New_York`), rate-limits, writes SQLite row, mints magic-link, sends via Resend. Bad team rejects with `?error=bad-form`; bad/empty tz falls back silently. |
| `/api/confirm` | GET | Verifies token (purpose=confirm), marks row confirmed (re-subscribe restores an unsubscribed row), redirects to `/confirmed?status=` |
| `/api/manage` | POST | Sends a magic-link with purpose=manage; the link lands on `/manage`, which mints a 30-day session cookie |
| `/api/save-selection` | POST | Authenticated (form token or session). Persists **1–5 team slugs** into `user_teams` (delete-all-then-insert) + `timezone`, atomically in one transaction (a non-active/unsubscribed row is rejected, whole txn rolls back); also inserts the optional demand-capture field into `feature_requests` if non-empty (non-blocking — never gates the team-save) |
| `/api/unsubscribe` | GET | Verifies token (purpose=unsubscribe), sets `unsubscribed_at`, redirects to `/unsubscribed` |
| `/api/logout` | POST | Clears the session cookie |

## Local dev

Requires Node 22+.

```bash
npm install
cp .env.example .env
# Optionally fill in RESEND_API_KEY and MAGIC_LINK_SECRET in .env.
# Without RESEND_API_KEY, magic links print to the console (dev fallback).
npm run dev
```

The dev server runs on `http://localhost:4321/`. SQLite db is created at
`./data/oddlympics.db` on first request.

## Production build & run

```bash
npm run build           # → ./dist/server/entry.mjs + prerendered HTML
npm run serve           # node --env-file=.env ./dist/server/entry.mjs
```

In production this runs as a `systemd` unit; see `DEPLOY.md`.

## Layout

```
src/
  components/
    Layout.astro           # shared shell: <html>/<head> (title/description/OG/noindex/analytics/footer props), unified :root tokens, base reset, shared chrome (.wrap/.banner/.headline/.subhead/.link), site footer. Every page wraps its content in <Layout> and keeps only page-specific scoped CSS.
  pages/
    index.astro            # hero + signup (prerendered, reads ?error= client-side)
    pending.astro          # post-signup "check email" (prerendered, reads ?email= client-side)
    confirmed.astro        # confirm result (prerendered, reads ?status= client-side)
    manage.astro           # dual-mode sign-in + 1–5 team editor (server-rendered, token/session)
    schedule.astro         # 301 → /manage, preserves ?token= (thin redirect)
    unsubscribed.astro     # post-unsubscribe (prerendered, reads ?status= client-side)
    r/
      [code].astro         # Phase 15: server-rendered referral route. Resolves code via lookupTeamByReferralCode → per-team og:image (VALID_TEAMS allow-list) + "Following <Team>" title; meta-refresh + try/catch'd location.replace('/?ref=CODE'). Unresolved/malformed → 200 with generic OG. Shape gate /^[a-z0-9]{8}$/ before DB or echo. Status-agnostic (no join on confirmed_at/unsubscribed_at — D-03).
    api/
      signup.ts            # POST → validate team + tz, mint purpose=confirm magic-link
      confirm.ts           # GET ?token → markConfirmed (restores re-subscribers) → 303 /confirmed?status=
      manage.ts            # POST → mint purpose=manage magic-link (lands on /manage)
      save-selection.ts    # POST → atomic txn: updateTimezoneActive + replace user_teams (1–5 slugs)
      unsubscribe.ts       # GET ?token → set unsubscribed_at + clear user_teams (CR-02)
      logout.ts            # POST → clear session cookie
  lib/
    db.ts                  # better-sqlite3 singleton + prepared statements + schema (vip_signups w/ team + timezone, teams w/ slug, matches, match_notifications, feature_requests, user_teams join table; idempotent ALTER + DROP guards)
    teams.ts               # VALID_TEAMS Set built from references/teams.json (48 slugs); TEAMS ordered array; isValidTeamSlug
    timezones.ts           # VALID_TZ Set built at module load from Intl.supportedValuesOf('timeZone'); FALLBACK_TZ=America/New_York; isValidTimezone
    token.ts               # HMAC-SHA256 signed tokens, 24h TTL, 4 purposes (confirm/manage/unsubscribe/session)
    session.ts             # cookie-based 30-day sliding-window sessions
    email.ts               # Resend wrapper with dev console fallback
    rate-limit.ts          # in-memory IP + email throttle
references/
  teams.json               # canonical 48-team World Cup 2026 list (snake_case slugs, confederation-grouped UEFA→CONMEBOL→CONCACAF→CAF→AFC→OFC)
  og-image.svg             # Phase 8: source for the generic /og-image.png
  og-image-team.svg        # Phase 15: parameterized {{TEAM_LABEL}} + {{HEADLINE_FONT_SIZE}} template; one render per team
  fonts/                   # vendored JetBrainsMono-Bold + Inter for deterministic OG rendering (loadSystemFonts: false)
scripts/
  ingest-schedule.mjs      # pull WC 2026 teams + matches from football-data.org (idempotent upsert); maps teams.json labels to teams.slug
  backfill-team-slugs.mjs  # one-shot teams.slug backfill from references/teams.json (dry-run by default)
  send-kickoff-notifications.mjs  # ~60min-before-kickoff sender, idempotent (UNIQUE on user+match+channel); LEFT JOIN user_teams, joins teams ON slug = COALESCE(ut.team_slug, vip_signups.team) so single-team signups AND multi-team /manage users are both reached
  launch-blast.mjs         # one-time "pick your teams" email to existing teaser list (manual --send)
  backup-pre-05.mjs        # pre-Phase-5-migration SQLite snapshot (operator runs on droplet before the deploy that drops selected_teams)
  render-og-image.mjs      # Phase 8: render references/og-image.svg → public/og-image.png at 1200×630 (@resvg/resvg-js) + byte/LAND-02 checks
  render-team-og-images.mjs # Phase 15: render references/og-image-team.svg × 48 → public/og/<slug>.png with D-08 font-size buckets (64/52/44pt) + per-team 6-check gate (file/sig/dims/size/LAND-02-on-substituted-svg); exits 1 on any FAIL
  smoke-signup.mjs         # End-to-end verification: 19 cases including Phase 5 signup, Phase 13 REF-*, Phase 14 SHARE-*, Phase 15 SHARE-r-known + SHARE-r-unknown (exit 0 = all PASS)
  smoke-landing.mjs        # Phase 6 landing-page verification (consumer copy, 48-option <select>, tz-label, no LAND-02 terms)
  smoke-manage.mjs         # Phase 9 /manage verification: 9 end-to-end cases (MANAGE-01/02, COMPAT-01, re-subscribe)
  smoke-confirm-email.mjs  # Phase 10 offline confirmation-email verification: 10 zero-network/zero-DB body-composition cases
public/
  favicon.svg
  og-image.png             # Phase 8 generic 1200×630 OG image
  og/                      # Phase 15: 48 per-team OG PNGs (1200×630, ~85KB each), one per references/teams.json slug
deploy/
  Caddyfile                # reverse proxy + auto Let's Encrypt + CSP enforce
  oddlympics.service       # systemd unit for the Node web server (hardened)
  oddlympics-notify.service / .timer  # 5-min cron firing send-kickoff-notifications.mjs (dry-run by default)
  oddlympics-ingest.service / .timer  # daily 03:00 cron firing ingest-schedule.mjs
  oddlympics.env.example   # template for /etc/oddlympics.env on the droplet
  bootstrap.sh             # idempotent droplet provisioner (installs all units above)
.github/workflows/
  deploy.yml               # rsync + npm ci + restart on push to main
.planning/                 # GSD planning artifacts (PROJECT, ROADMAP, REQUIREMENTS, STATE, codebase analysis, per-phase plans + summaries)
DEPLOY.md                  # step-by-step production deploy + Day 2 ops + per-cron operator runbooks
```

## Design choices worth knowing

- **`output: 'server'`**, but the four content pages (`index`, `pending`,
  `confirmed`, `unsubscribed`) set `export const prerender = true;`. Result:
  static pages cached by Caddy with `max-age=31536000`, dynamic API routes +
  the server-rendered `/manage` served by Node. Tiny edge cache, real server
  logic.
- **Shared `Layout.astro`, one light theme, no JS framework.** Every page
  wraps its content in `src/components/Layout.astro`, which owns the
  `<html>`/`<head>` shell (title/description/OG/`noindex`/`analytics`/`footer`
  as props), the unified `:root` design tokens, the base reset, and the shared
  chrome + footer. Pages keep only their own page-specific CSS in a scoped
  `<style>`. Aesthetic is light "editorial minimalist" (`--bg #fafaf7`,
  `--fg #14151a`, accent `#b8350d`); the earlier per-page-inline-style model
  let a dark/light drift creep in, so it was consolidated here.
- **Client-side URL param reads** in the prerendered pages (`?error=`,
  `?email=`, `?status=`) via a small inline `<script is:inline>` — the pages
  stay statically cacheable. `manage.astro` is server-rendered and reads
  `?token=`/cookies in the Astro frontmatter; `/schedule` is a thin 301 to
  `/manage` that preserves `?token=`.
- **Cookie-based sessions, 30-day sliding window** (`src/lib/session.ts`).
  Magic-link flows mint a session token after token verification; the
  cookie is HttpOnly + Secure + SameSite=Lax. `/manage` and `/schedule`
  use the session if it's valid, otherwise fall back to the magic-link
  email loop. `/api/logout` clears the cookie.
- **Two systemd timers handle background work** under the `oddlympics`
  user with the same hardening directives as the web server:
  - `oddlympics-notify.timer` — every 5 min, picks up matches kicking off
    in 55–65 min and emails subscribers. Idempotent via `UNIQUE
    (user_email, match_id, channel)` on `match_notifications`. Dry-run
    until `KICKOFF_NOTIFICATIONS_ENABLED=true` in `/etc/oddlympics.env`.
  - `oddlympics-ingest.timer` — daily 03:00 UTC, refreshes WC 2026
    teams + matches from football-data.org. Idempotent (upsert on `id`).
- **Honeypot + per-IP/email rate limiting** on `/api/signup`. Bots get a silent
  303 to `/pending` and never touch the DB; humans get standard error redirects.
- **`security: { checkOrigin: false }`** in `astro.config.mjs` because we do
  our own Origin check that allows `localhost`/`127.0.0.1` for local testing
  while blocking cross-origin form posts.
- **`better-sqlite3`** ships a native binding. The deploy workflow runs
  `npm rebuild better-sqlite3` after rsync so the binding is built for the
  droplet's exact Node + glibc.
- **Boot-time idempotent migrations** in `src/lib/db.ts`. New tables use
  `CREATE TABLE IF NOT EXISTS`; new columns on the existing `vip_signups`
  table use a `pragma_table_info` probe + conditional `ALTER TABLE ADD
  COLUMN` (SQLite has no `ADD COLUMN IF NOT EXISTS`). The Phase 5 migration
  (first non-additive change) extends this with a SQLite version assert
  (≥ 3.35 for `DROP COLUMN`) and a `has(...)` guard on the `DROP COLUMN
  selected_teams` line — same probe, opposite direction. A NULL-timezone
  backfill `UPDATE` runs once and is a no-op thereafter. Re-running the
  entire boot against a fully-migrated DB is still a no-op. Zero
  migration-tool dependencies. Always run `scripts/backup-pre-05.mjs` on
  the droplet before deploying the Phase 5 commits — see `DEPLOY.md`.

## License

MIT. See `LICENSE`.
