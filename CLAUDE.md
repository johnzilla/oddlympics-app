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

<!-- GSD:project-start source:PROJECT.md -->
## Project

**oddlympics — v1 MVP**

**Personalized "when does MY thing happen" notifications for international sports
fans, launching with the 2026 FIFA World Cup.** Users pick the teams they care
about, get the matches in their own time zone, receive email + Telegram pings
before kickoff, and can tip a single creator over Lightning. The teaser landing
page is already live at https://oddlympics.app — this milestone turns it into
the actual product before group stage starts on **2026-06-11**.

**Core Value:** **A user picks their team and gets a kickoff notification in their local time,
on time, before group stage 2026.** If everything else fails — tipping breaks,
Telegram lags, the schedule is hand-typed — the user must still get a "USA
vs. Iran kicks off in 60 minutes (your time)" email that lands when promised.

### Constraints

- **Timeline**: Hard ship date 2026-06-11 (World Cup group-stage kickoff) — picked by FIFA, not negotiable. Notifications need to fire on real matches starting that morning.
- **Tech stack**: Astro 5 server mode + better-sqlite3 + Resend + Caddy + systemd on DigitalOcean. Established and shipping; no rewrites mid-deadline. New surface area uses the same stack unless there's a hard reason not to.
- **Solo developer**: One contributor (johnzilla), evenings + weekends. Scope must respect this; no "hire help" assumptions.
- **Single droplet**: One $6/mo box. No HA, no multi-region, no replicas. Restart cost ~2s; we'll live with it.
- **Bitcoin/Lightning ideology**: No tokens, no L2 alternatives, no "maybe USDC for v1." Lightning + Cashu through vault, period.
- **Existing email list**: Phase 1 cannot break the existing signup/confirm flow or invalidate captured emails. Migrations must be additive.
- **No relocation**: Founder constraint — affects fundraising path but not the product itself; mentioned for completeness.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages & runtime
- **TypeScript** (strict — `tsconfig.json` extends `astro/tsconfigs/strict`)
- **Astro 5** (`^5.0.0`) with `output: 'server'`
- **Node 22** (pinned in `.github/workflows/deploy.yml` and CI; production droplet runs Node 22 via NodeSource)
- ESM throughout (`"type": "module"` in `package.json`)
- Native `node:` built-ins preferred — `node:crypto`, `node:fs`, `node:path` (see `src/lib/token.ts:1`, `src/lib/db.ts:2`)
## Server adapter
## Direct dependencies
| Package | Version | What it does | Where used |
|---|---|---|---|
| `astro` | `^5.0.0` | Framework + dev server + build | `astro.config.mjs`, all `src/pages/*` |
| `@astrojs/node` | `^9.5.5` | Standalone Node SSR adapter | `astro.config.mjs:2,7` |
| `better-sqlite3` | `^12.9.0` | Synchronous SQLite driver (native binding) | `src/lib/db.ts:1` |
| `resend` | `^6.12.2` | Transactional email API | `src/lib/email.ts:1` |
## Native binding
## Build & runtime config
## NPM scripts
## Environment variables
| Var | Required | Default | Used in |
|---|---|---|---|
| `RESEND_API_KEY` | prod only | — | `src/lib/email.ts:3` (throws on prod boot if missing) |
| `EMAIL_FROM` | optional | `oddlympics <onboarding@resend.dev>` | `src/lib/email.ts:4` |
| `MAGIC_LINK_SECRET` | prod only | dev fallback string | `src/lib/token.ts:3` (throws on prod boot if missing) |
| `PUBLIC_SITE_URL` | optional | `http://localhost:4321` | `src/lib/email.ts:5` (link base) |
| `DATABASE_PATH` | optional | `./data/oddlympics.db` | `src/lib/db.ts:6` |
| `NODE_ENV` | systemd sets to `production` | — | gates prod-only throws |
| `HOST` / `PORT` | systemd sets `127.0.0.1` / `4321` | — | bind address for the adapter |
## Frontend
## Build output
- `dist/server/entry.mjs` — Node entrypoint (the SSR server)
- `dist/client/_astro/*` — hashed client assets (favicon SVG, etc.)
- Prerendered HTML for the three pages with `prerender = true`
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## TypeScript
- **Strict mode** — `tsconfig.json` extends `astro/tsconfigs/strict` (no other overrides).
- **`type` over `interface`** for shape types (`type VipSignup`, `type Payload`).
- **`node:` prefix on all built-ins:** `node:crypto`, `node:fs`, `node:path`
- **Prepared-statement generics:** `db.prepare<[string, string, string | null, string | null]>(...)`
- **Return-type annotations** on exported functions (`mintToken(...): string`,
- **No `any`.** Casts go through `as` only at FormData boundaries
## Naming
- `camelCase` functions and locals
- `SCREAMING_SNAKE_CASE` module constants
- `PascalCase` types
- `kebab-case` files (multi-word) and URL slugs
- See STRUCTURE.md for the full list with examples
## Error handling — three patterns
## Logging
- **`console.error` for caught DB / email failures** in route handlers, with a
- **`console.log` for the dev email fallback** with a tag: `[email-dev-fallback]`
- **No structured logger** (no pino, no winston). systemd captures stdout/stderr
- No correlation IDs, no request IDs.
## CSS
- **Inline `<style is:global>` per page**, not a shared stylesheet. CLAUDE.md
- **CSS variables defined in `:root`** of each page. The shared set:
- **One mono font everywhere.** `--mono` is the only family used; no separate
- **Mobile breakpoint at 520px** with a single `@media` block per page.
- **Reduced motion respected** in `index.astro:233-235`.
## Astro patterns
- `export const prerender = true;` for static pages, `false` for API routes.
- Frontmatter (`---` block) is for *build-time* values (titles, descriptions,
- API route signatures: `export const POST: APIRoute = async ({ request, site }) => {...}`
## Form handling
- **`<form method="post" action="/api/signup">`** — old-school HTML POST, no
- **Honeypot field** named `website` with class `.hp` (visually hidden,
- **Email validation:** regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` plus a 254-char
- **Allowlists** for enum-like fields: `VALID_SPORTS = new Set([...])`,
## Security posture (in code)
- **Constant-time comparison** for HMAC signatures: `timingSafeEqual` after
- **Input always lowercased + trimmed** before hashing/storing
- **DB writes parameterized** via prepared statements — no string interpolation.
- **Origin check on POST** (`src/pages/api/signup.ts:18-34`) layered on top of
- **Magic links idempotent** via `WHERE confirmed_at IS NULL` clause in the
## What you won't see in this codebase
- No comments explaining what code does — only why-comments where the choice
- No JSDoc.
- No barrel `index.ts` exports — every import names its file directly:
- No `default export` in lib modules — only named exports.
- No async wrappers around sync code.
- No try/catch around things that can't reasonably throw.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern
## Layers
```
```
## Entry points
- **HTTP entrypoint (prod):** `dist/server/entry.mjs` — built by Astro from the
- **HTTP entrypoint (dev):** `astro dev` (port 4321 by default), no build step.
- **Static page prerender targets:** `src/pages/index.astro`, `pending.astro`,
- **Server route handlers:** `src/pages/api/signup.ts`, `src/pages/api/confirm.ts`
- **Module-load side effects:** Importing `src/lib/db.ts` runs the schema
## Data flow — signup happy path
## Data flow — confirmation
## Critical abstraction: prerendered pages reading URL params
- `src/pages/index.astro:61-78` — reads `?error=<code>` and renders message
- `src/pages/pending.astro:28-35` — reads `?email=<address>` and inlines it
## API routing
## State
- **Persistent:** SQLite `vip_signups` table on disk. One row per email.
- **In-memory (per process):** `src/lib/rate-limit.ts` — `Map<key, timestamp[]>`,
- **No session state, no cookies, no JWT** — the magic-link token is the only
## Deployment topology
- **Single process, single host.** No load balancer, no replicas.
- **CI/CD:** GitHub Actions on push to `main` rsyncs the build to the droplet
- **Restart cost:** brief 503 (~1-2 seconds, `RestartSec=2` in the unit) plus
## Why this shape
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
