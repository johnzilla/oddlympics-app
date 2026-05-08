# Stack

**Last mapped:** 2026-05-08

## Languages & runtime

- **TypeScript** (strict — `tsconfig.json` extends `astro/tsconfigs/strict`)
- **Astro 5** (`^5.0.0`) with `output: 'server'`
- **Node 22** (pinned in `.github/workflows/deploy.yml` and CI; production droplet runs Node 22 via NodeSource)
- ESM throughout (`"type": "module"` in `package.json`)
- Native `node:` built-ins preferred — `node:crypto`, `node:fs`, `node:path` (see `src/lib/token.ts:1`, `src/lib/db.ts:2`)

## Server adapter

`@astrojs/node` (`^9.5.5`) in **standalone mode** — produces `dist/server/entry.mjs` that
runs as a long-lived Node process. Configured in `astro.config.mjs:7`:

```js
adapter: node({ mode: 'standalone' }),
```

The standalone server binds to `127.0.0.1:4321` in production (driven by
`HOST`/`PORT` env vars set in `deploy/oddlympics.service:19-20`); Caddy reverse-proxies the public hostname.

## Direct dependencies

| Package | Version | What it does | Where used |
|---|---|---|---|
| `astro` | `^5.0.0` | Framework + dev server + build | `astro.config.mjs`, all `src/pages/*` |
| `@astrojs/node` | `^9.5.5` | Standalone Node SSR adapter | `astro.config.mjs:2,7` |
| `better-sqlite3` | `^12.9.0` | Synchronous SQLite driver (native binding) | `src/lib/db.ts:1` |
| `resend` | `^6.12.2` | Transactional email API | `src/lib/email.ts:1` |

That's the entire `dependencies` block in `package.json`. There are **no
`devDependencies`** declared — `astro check` installs `@astrojs/check` on first
run, and there is no test framework, linter, or formatter checked in.

## Native binding

`better-sqlite3` ships a compiled native addon. The deploy workflow runs
`npm rebuild better-sqlite3` after rsync because the GitHub runner's glibc/Node
ABI differs from the droplet's (`.github/workflows/deploy.yml:62`). It is also
externalized from Vite's SSR bundle (`astro.config.mjs:13-15`) so Vite doesn't
try to inline the binding.

## Build & runtime config

`astro.config.mjs` — three notable settings:

1. `site: 'https://oddlympics.app'` — used for canonical URLs and the (now
   disabled) Origin check.
2. `security: { checkOrigin: false }` — Astro's built-in CSRF check would
   reject same-origin local POSTs because `site` is the prod URL. Replaced by
   a custom check in `src/pages/api/signup.ts:18-34` that allows `localhost`
   and `127.0.0.1`.
3. `vite.ssr.external: ['better-sqlite3']` — keeps the native binding outside
   the Vite SSR bundle.

`tsconfig.json` is a one-liner — extends `astro/tsconfigs/strict` and adds
nothing else.

## NPM scripts

```json
"dev":     "astro dev",
"start":   "astro dev",
"build":   "astro build",
"preview": "astro preview",
"serve":   "node --env-file=.env ./dist/server/entry.mjs",
"astro":   "astro"
```

`npm run serve` is the production-equivalent local run — uses Node's native
`--env-file` flag (Node 20+) instead of a wrapper like `dotenv`.

## Environment variables

Loaded via `--env-file=.env` in dev/local-prod and from `/etc/oddlympics.env`
on the droplet (read by `EnvironmentFile=` in `deploy/oddlympics.service:16`).

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

**No framework.** Plain Astro `.astro` files, vanilla CSS in `<style is:global>`
blocks per page, tiny `<script is:inline>` snippets for client-side URL-param
reads (`src/pages/index.astro:61-78`, `src/pages/pending.astro:28-35`).

No bundler-managed CSS, no Tailwind, no PostCSS plugins beyond Astro defaults,
no client islands, no React/Vue/Svelte.

## Build output

`astro build` emits to `dist/`:

- `dist/server/entry.mjs` — Node entrypoint (the SSR server)
- `dist/client/_astro/*` — hashed client assets (favicon SVG, etc.)
- Prerendered HTML for the three pages with `prerender = true`

Caddy serves `_astro/*` and `favicon.svg` with `Cache-Control: public,
max-age=31536000, immutable` (`deploy/Caddyfile:11-14`); everything else is
proxied to the Node server.
