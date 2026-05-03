# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Teaser landing page for **oddlympics**, an upcoming personalized
"when does MY thing happen" notifications app for international sports fans
(launching around the 2026 FIFA World Cup). The current scope is the v1 teaser
only: hero + email capture + double-opt-in confirm. The full personalization /
notification engine and the Lightning tip jar are deferred to v1.x.

The full design context — original office-hours doc, premises, target metrics,
risks register, deferred features — lives at
`~/.gstack/projects/johnzilla-oddlympics-app/`.

## Stack

- **Astro 5** with `output: 'server'` and the **Node standalone adapter** (`@astrojs/node`)
- **better-sqlite3** for storage; schema migrates on boot in `src/lib/db.ts`
- **Resend** for transactional email (with a dev console fallback when no API key)
- **HMAC-SHA256 signed tokens** for magic links (Node built-in `crypto`, no JWT lib)
- Static pages set `export const prerender = true` and use small inline
  `<script is:inline>` blocks for dynamic URL-param content (no framework)
- **Caddy + systemd** in front of `node ./dist/server/entry.mjs` on a single
  DigitalOcean droplet
- **GitHub Actions** auto-deploys on push to `main` (~40s end-to-end)

## Common commands

```bash
npm install              # first-time setup
npm run dev              # astro dev server, port 4321, .env auto-loaded
npm run build            # produce dist/ (server + prerendered HTML)
npm run serve            # node --env-file=.env ./dist/server/entry.mjs (prod-equiv)
npx astro check          # type-check + lint .astro files (installs @astrojs/check on first run)
```

There is no formal test suite yet. Smoke tests are done by booting `npm run serve`
and curling endpoints; see `docs/smoke-tests` if/when extracted.

## Architecture worth understanding before editing

**Hybrid static + server.** The three HTML pages (`/`, `/pending`, `/confirmed`)
are statically prerendered and cacheable; the two API routes (`/api/signup`,
`/api/confirm`) are server-rendered. To add a new dynamic page, set
`export const prerender = false;` at the top.

**Why `security: { checkOrigin: false }`.** Astro's adapter has a built-in CSRF
check that compares the request's `Origin` to the configured `site` URL. That
blocks same-origin local testing because `site` points to `https://oddlympics.app`.
We disable it and do our own Origin check in `src/pages/api/signup.ts` that
allows `localhost`/`127.0.0.1` while still blocking real cross-origin POSTs.

**Magic-link flow.**
1. POST `/api/signup` validates email + honeypot + rate limit, upserts a row
   in `vip_signups`, mints a token (`{email, exp}` HMAC-signed), sends via
   Resend, returns 303 → `/pending?email=...`
2. The user clicks the link in their email → GET `/api/confirm?token=...`
3. Token verified (timing-safe), `confirmed_at` set, 303 → `/confirmed?status=ok`
4. Re-clicks return `status=already`; bad/expired tokens return `status=bad-token`

**Static page → URL params.** Because `index.astro` and `pending.astro` are
prerendered, `Astro.url.searchParams` returns build-time values (always empty).
The `?error=...` and `?email=...` query params are read client-side via small
inline scripts. **If you add a new page that needs to react to URL params at
request time, either drop `prerender = true` or do the same client-side trick.**
The latter is cheaper if you don't need server logic.

**Dev email fallback.** `src/lib/email.ts` checks `process.env.RESEND_API_KEY`.
If unset and `NODE_ENV !== 'production'`, magic links print to the console
instead of being sent. This is intentional — never error on missing email config
in dev. In production it throws on boot.

**Native binding.** `better-sqlite3` requires `npm rebuild better-sqlite3`
after rsync to the droplet (different glibc/Node ABI than the GitHub runner).
The deploy workflow does this automatically.

## Production

Single DigitalOcean droplet. App runs as the `oddlympics` user under systemd
with hardening flags (`ProtectSystem=strict`, only `/var/lib/oddlympics`
writable). Caddy reverse-proxies `oddlympics.app` and `www.oddlympics.app` to
`127.0.0.1:4321` with auto Let's Encrypt. Runtime config is in
`/etc/oddlympics.env` (root-owned, group-readable by `oddlympics`).

The deploy user has a narrow sudoers rule allowing only
`systemctl restart|status oddlympics` and `systemctl reload caddy` — both
`/bin/systemctl` and `/usr/bin/systemctl` paths because Ubuntu's usrmerge
makes them distinct to sudo's exact-path matching.

`DEPLOY.md` has the full bootstrap-from-blank-droplet procedure plus a Day 2
ops table (logs, restart, DB inspection, email-list export, backup).

## Conventions established

- **No framework JS.** Plain Astro + tiny `<script is:inline>` blocks where
  needed. If you find yourself reaching for React/Vue, ask first.
- **One mono font** (`ui-monospace, SFMono-Regular, Menlo, ...`) across every
  page. Aesthetic is "Bitcoin minimalist on near-black."
- **Accent color** is `hsl(18 70% 56%)` (a warm orange). Defined as `--accent`
  in each page's inline `<style is:global>`.
- **Astro CSS lives inline per page** in `<style is:global>` blocks — no
  global stylesheet, no layout component yet. Three pages doesn't justify the
  abstraction. Refactor to a shared layout when a 4th page lands.
- **Errors and pending state via URL params** (`?error=bad-email`,
  `?email=foo@bar`). Server endpoints redirect with 303; client scripts read
  the param and inject the message. Keeps pages CDN-cacheable.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
