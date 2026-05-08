# Structure

**Last mapped:** 2026-05-08

## Top-level layout

```
oddlympics-app/
├── src/
│   ├── pages/
│   │   ├── index.astro              # / — hero + signup form (prerendered)
│   │   ├── pending.astro            # /pending — "check your email" (prerendered)
│   │   ├── confirmed.astro          # /confirmed — confirm result (prerendered)
│   │   └── api/
│   │       ├── signup.ts            # POST /api/signup (server)
│   │       └── confirm.ts           # GET  /api/confirm (server)
│   └── lib/
│       ├── db.ts                    # better-sqlite3 + schema + prepared stmts
│       ├── email.ts                 # Resend wrapper + dev console fallback
│       ├── rate-limit.ts            # in-memory IP+email throttle
│       └── token.ts                 # HMAC magic-link mint/verify
├── public/
│   └── favicon.svg                  # only static asset
├── deploy/
│   ├── Caddyfile                    # → /etc/caddy/Caddyfile
│   ├── oddlympics.service           # → /etc/systemd/system/
│   ├── oddlympics.env.example       # template for /etc/oddlympics.env
│   └── bootstrap.sh                 # one-shot droplet provisioner
├── .github/
│   └── workflows/
│       └── deploy.yml               # rsync + systemctl restart on push to main
├── data/                            # gitignored — SQLite db lives here in dev
│   ├── oddlympics.db
│   ├── oddlympics.db-shm
│   └── oddlympics.db-wal
├── dist/                            # gitignored — astro build output
├── astro.config.mjs                 # site, adapter, security, vite SSR external
├── tsconfig.json                    # extends astro/tsconfigs/strict (one line)
├── package.json                     # 4 deps, 0 devDeps, 6 scripts
├── package-lock.json
├── .env.example                     # gitignored on purpose? (see below)
├── .env                             # gitignored
├── .gitignore                       # standard + .astro/ + .gstack/ + data/
├── README.md                        # project overview + routes + design choices
├── DEPLOY.md                        # bootstrap + Day 2 ops
├── CLAUDE.md                        # project conventions for this assistant
└── LICENSE                          # MIT
```

`.env.example` is **denied by Claude permission settings** but exists on disk.
The other `.env` is gitignored (`.gitignore:15`). `.gstack/` is gitignored.
`.planning/` is the GSD planning dir created by this command.

## Where things live

| Need to... | File |
|---|---|
| Add a new public page | `src/pages/<name>.astro` (set `prerender = true` for static, `false` for SSR) |
| Add a new API endpoint | `src/pages/api/<name>.ts` (export `GET` / `POST` etc., set `prerender = false`) |
| Change the DB schema | `src/lib/db.ts` — add a new `db.exec(\`CREATE TABLE IF NOT EXISTS ...\`)` block. There is no migration system; rely on idempotent DDL. |
| Add a prepared statement | `src/lib/db.ts` — append a new `db.prepare<[...]>(\`...\`)` export below existing ones |
| Tweak the magic-link TTL | `src/lib/token.ts:4` — change `TTL_SECONDS` |
| Tweak rate-limit window/cap | `src/lib/rate-limit.ts:1-2` — `WINDOW_MS` and `MAX_PER_WINDOW` |
| Change the email body | `src/lib/email.ts:16-40` — the `text` and `html` strings are inlined |
| Change a page's CSS | inline `<style is:global>` block at the bottom of each `.astro` file (no shared stylesheet) |
| Add a security header | `deploy/Caddyfile:24-32` (edge) — prefer this over node-side headers |
| Add a deploy step | `.github/workflows/deploy.yml` |
| Document a Day 2 op | `DEPLOY.md` Day 2 table |
| Add an env var | `deploy/oddlympics.env.example` (template) + `src/lib/<consumer>.ts` reader |

## Naming conventions

**Files**
- `kebab-case` for multi-word source files: `rate-limit.ts`, `oddlympics.service`,
  `oddlympics.env.example`.
- Single-word lib modules: `db.ts`, `email.ts`, `token.ts`.
- Pages match the URL path: `index.astro` → `/`, `pending.astro` → `/pending`.
- API handlers under `src/pages/api/`.

**Identifiers**
- `camelCase` for functions and locals: `mintToken`, `checkRateLimit`,
  `clientIp`, `originOk`.
- `SCREAMING_SNAKE_CASE` for module-scoped constants:
  `TTL_SECONDS`, `WINDOW_MS`, `MAX_PER_WINDOW`, `EMAIL_RE`, `VALID_SPORTS`,
  `DEFAULT_PATH`, `SITE_URL`.
- `PascalCase` for types: `VipSignup` (`src/lib/db.ts:28`), `Payload`
  (`src/lib/token.ts:12`).
- Prepared statements named for the operation, exported as named bindings:
  `upsertVipSignup`, `markConfirmed`, `getByEmail`.

**Error codes (URL slugs)**
Short kebab-case slugs returned via `?error=<slug>` and `?status=<slug>`:
`bad-email`, `bad-form`, `bad-origin`, `bad-token`, `rate-limited`, `email`,
`server`, `ok`, `already`, `unknown`. The slug → human copy mapping lives
client-side in inline scripts (e.g. `src/pages/index.astro:63-70`).

## Module boundaries

`src/lib/*` modules are independent of each other. Cross-references:
- `src/pages/api/signup.ts` imports from `db`, `token`, `email`, `rate-limit`.
- `src/pages/api/confirm.ts` imports from `db`, `token`.
- `src/lib/email.ts` imports `token` indirectly (it just receives a token string).
- No `lib/*` module imports another `lib/*` module — each is leaf.

This means a refactor to swap (e.g.) `better-sqlite3` for Postgres only touches
`db.ts` and the route handlers, not the email or token modules.

## Routing summary

| Path | Method | Handler | Prerender? |
|---|---|---|---|
| `/` | GET | `src/pages/index.astro` | yes |
| `/pending` | GET | `src/pages/pending.astro` | yes |
| `/confirmed` | GET | `src/pages/confirmed.astro` | yes (but reads URL param at build time — see CONCERNS.md) |
| `/api/signup` | POST | `src/pages/api/signup.ts` | no (server) |
| `/api/confirm` | GET | `src/pages/api/confirm.ts` | no (server) |
| `/_astro/*`, `/favicon.svg` | GET | static (Caddy serves directly with 1-year cache) | n/a |

## Things that intentionally don't exist

- **No `src/components/`** — three pages doesn't justify shared layouts.
  CLAUDE.md says: "Refactor to a shared layout when a 4th page lands."
- **No `src/styles/`** — CSS is inlined per page.
- **No `src/middleware/`** — no Astro middleware file. Origin check and rate
  limiting live inside the route handler.
- **No `tests/` or `__tests__/`** — see TESTING.md.
- **No `migrations/`** — schema lives in `src/lib/db.ts` as `CREATE IF NOT EXISTS`.
- **No `scripts/`** — there are no maintenance scripts checked in. Day 2 ops
  are one-liners in `DEPLOY.md`.
