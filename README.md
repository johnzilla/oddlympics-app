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

The app is currently the v1 *teaser*: a one-page hero, an email capture, and a
double-opt-in confirm. Personalized notifications, the Lightning tip jar, and
the niche-sport long tail are deferred to v1.x. See `DEPLOY.md` and the design
doc at `~/.gstack/projects/johnzilla-oddlympics-app/` for the full plan.

## Routes

| Route | Method | What it does |
|---|---|---|
| `/` | GET | Static hero + signup form |
| `/pending` | GET | "Check your email" — shown after a successful signup |
| `/confirmed` | GET | Confirmation result page (handles ok / already / bad-token / unknown) |
| `/api/signup` | POST | Validates email, rate-limits, writes SQLite row, mints magic-link token, sends via Resend |
| `/api/confirm` | GET | Verifies the token, marks the row confirmed, redirects to `/confirmed` |

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
    index.astro            # hero (prerendered)
    pending.astro          # post-signup "check email" (prerendered)
    confirmed.astro        # confirm result (prerendered)
    api/
      signup.ts            # POST → magic link
      confirm.ts           # GET ?token → mark confirmed
  lib/
    db.ts                  # better-sqlite3, schema migration on boot
    token.ts               # HMAC-SHA256 signed tokens, 7-day TTL
    email.ts               # Resend wrapper with dev console fallback
    rate-limit.ts          # in-memory IP + email throttle
public/
  favicon.svg
deploy/
  Caddyfile                # reverse proxy + auto Let's Encrypt
  oddlympics.service       # systemd unit (hardened, runs as oddlympics user)
  oddlympics.env.example   # template for /etc/oddlympics.env on the droplet
  bootstrap.sh             # one-shot droplet provisioner (idempotent)
.github/workflows/
  deploy.yml               # rsync + npm ci + restart on push to main
DEPLOY.md                  # step-by-step production deploy + Day 2 ops
```

## Design choices worth knowing

- **`output: 'server'`** on the Astro side, but the three HTML pages set
  `export const prerender = true;`. Result: static pages cached by Caddy with
  `max-age=31536000`, dynamic API routes served by Node. Tiny edge cache, real
  server logic.
- **Client-side URL param reads** in `pending.astro` and `index.astro` (for
  `?email=...` and `?error=...`). The pages stay statically prerendered; a
  small inline `<script is:inline>` hydrates the dynamic bits. No JS framework.
- **Honeypot + per-IP/email rate limiting** on `/api/signup`. Bots get a silent
  303 to `/pending` and never touch the DB; humans get standard error redirects.
- **`security: { checkOrigin: false }`** in `astro.config.mjs` because we do
  our own Origin check that allows `localhost`/`127.0.0.1` for local testing
  while blocking cross-origin form posts.
- **`better-sqlite3`** ships a native binding. The deploy workflow runs
  `npm rebuild better-sqlite3` after rsync so the binding is built for the
  droplet's exact Node + glibc.

## License

MIT. See `LICENSE`.
