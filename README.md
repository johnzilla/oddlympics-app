# oddlympics

> World domination. Your world.

Personalized "when does MY thing happen" notifications for international sports
fans, launching around the 2026 FIFA World Cup. The first surface is a teaser
landing page that captures email signups via a magic-link confirm flow.

**Live:** https://oddlympics.app

## What this is

Astro 5 server-mode app on the Node standalone adapter. SQLite for storage,
Resend for transactional email, Caddy in front of a `systemd`-managed Node
process on a single DigitalOcean droplet. GitHub Actions auto-deploys on push
to `main` (~40 seconds end-to-end).

**v1 MVP status (toward 2026-06-11 World Cup kickoff):**
- ✅ Public teaser landing + double-opt-in email capture (v1.0)
- ✅ Phase 1 hardening — `/api/unsubscribe` + `/unsubscribed`, CSP enforce in
  Caddy, default-deny on missing Origin, 24h magic-link TTL, `confirmed.astro`
  status copy fixed
- ✅ Phase 2 — magic-link sign-in (`/manage`), team picker + personal schedule
  (`/schedule`), browser-tz capture with manual override, World Cup schedule
  ingestor (football-data.org → `teams`/`matches` tables) with a daily 03:00
  systemd timer
- ✅ Phase 2.5 — `scripts/launch-blast.mjs` (idempotent, dry-run by default);
  `/schedule` also captures an optional "which other championship next?"
  demand-signal into the `feature_requests` table (v1.1 triage input)
- ✅ Phase 3 — kickoff notification cron every 5 min (`oddlympics-notify.timer`,
  dry-run until `KICKOFF_NOTIFICATIONS_ENABLED=true`)
- 🎯 Phase 4 (planned) — Launch Week Observation: watch real notifications fire
  during the World Cup group-stage opening weekend (2026-06-11 → 2026-06-14),
  confirm delivery health, capture early feedback
- ⏳ **Operator actions remaining:** fire the launch blast, flip the kickoff
  cron live (`KICKOFF_NOTIFICATIONS_ENABLED=true` in `/etc/oddlympics.env`),
  end-to-end smoke-test one real kickoff notification before group stage opens
- 🚫 **Deferred to v1.1:** Telegram bot, Lightning tip jar, niche-sport long tail
  (strongman, cubing, etc.), shared `Layout.astro` refactor

Roadmap, requirements, and per-phase plans + summaries live under `.planning/`.
See `.planning/ROADMAP.md` for the v1 phase breakdown and `DEPLOY.md` for the
operator runbook.

## Routes

| Route | Method | What it does |
|---|---|---|
| `/` | GET | Static hero + signup form |
| `/pending` | GET | "Check your email" — shown after a successful signup |
| `/confirmed` | GET | Confirmation result page (renders correct copy per `?status=` via inline script) |
| `/manage` | GET | Magic-link sign-in (uses existing session cookie if valid; otherwise asks for email and sends a `purpose=manage` link) |
| `/schedule` | GET | Authenticated team picker + personal schedule. Browser-detected tz with manual override. Reads `teams`/`matches`. |
| `/unsubscribed` | GET | Confirmation page after one-click unsubscribe |
| `/api/signup` | POST | Validates email, rate-limits, writes SQLite row, mints magic-link, sends via Resend |
| `/api/confirm` | GET | Verifies token (purpose=confirm), marks row confirmed, redirects to `/confirmed` |
| `/api/manage` | POST | Sends a magic-link with purpose=manage; landing on `/schedule` mints a session cookie |
| `/api/save-selection` | POST | Persists `selected_teams` + `timezone` for the authenticated user; also inserts the optional demand-capture field into `feature_requests` if non-empty (non-blocking — never gates the team-save) |
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
  pages/
    index.astro            # hero + signup (prerendered, reads ?error= client-side)
    pending.astro          # post-signup "check email" (prerendered, reads ?email= client-side)
    confirmed.astro        # confirm result (prerendered, reads ?status= client-side)
    manage.astro           # magic-link sign-in (server-rendered, checks session cookie)
    schedule.astro         # team picker + personal schedule (server-rendered, gated by session)
    unsubscribed.astro     # post-unsubscribe (prerendered)
    api/
      signup.ts            # POST → mint purpose=confirm magic-link
      confirm.ts           # GET ?token → mark confirmed, mint session, redirect to /schedule
      manage.ts            # POST → mint purpose=manage magic-link
      save-selection.ts    # POST → persist selected_teams + timezone
      unsubscribe.ts       # GET ?token → set unsubscribed_at
      logout.ts            # POST → clear session cookie
  lib/
    db.ts                  # better-sqlite3 singleton + prepared statements + schema (vip_signups, teams, matches, match_notifications, feature_requests; ALTER guards on existing tables)
    token.ts               # HMAC-SHA256 signed tokens, 24h TTL, 4 purposes (confirm/manage/unsubscribe/session)
    session.ts             # cookie-based 30-day sliding-window sessions
    email.ts               # Resend wrapper with dev console fallback
    rate-limit.ts          # in-memory IP + email throttle
scripts/
  ingest-schedule.mjs      # pull WC 2026 teams + matches from football-data.org (idempotent upsert)
  send-kickoff-notifications.mjs  # ~60min-before-kickoff sender, idempotent (UNIQUE on user+match+channel)
  launch-blast.mjs         # one-time "pick your teams" email to existing teaser list (manual --send)
public/
  favicon.svg
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

- **`output: 'server'`** on the Astro side, but the three HTML pages set
  `export const prerender = true;`. Result: static pages cached by Caddy with
  `max-age=31536000`, dynamic API routes served by Node. Tiny edge cache, real
  server logic.
- **Client-side URL param reads** in `index.astro`, `pending.astro`, and
  `confirmed.astro` (for `?error=...`, `?email=...`, `?status=...`). The
  pages stay statically prerendered; a small inline `<script is:inline>`
  hydrates the dynamic bits. No JS framework. The two server-rendered
  pages (`manage.astro`, `schedule.astro`) read params normally in the
  Astro frontmatter because they're not prerendered.
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
  COLUMN` (SQLite has no `ADD COLUMN IF NOT EXISTS`). Re-running on a
  fully-migrated DB is a no-op. Zero migration-tool dependencies.

## License

MIT. See `LICENSE`.
