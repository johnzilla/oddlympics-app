# Architecture

**Last mapped:** 2026-05-08

## Pattern

**Hybrid static + server SSR** on a single Node process. Three pages prerender
to static HTML; two API routes run server-side. Everything fronted by Caddy.

There is **no application framework above Astro** — no Express, no Fastify, no
Hono. Astro's adapter is the HTTP server. There is also no DI container, no ORM,
no service layer abstraction; route handlers call `src/lib/*` modules directly.

## Layers

```
            ┌────────────────────────────────────────┐
            │            Caddy (TLS edge)            │
            │  static asset cache, security headers  │
            └────────────────┬───────────────────────┘
                             │ reverse proxy
                             ▼
            ┌────────────────────────────────────────┐
            │     Astro standalone Node server       │
            │       (dist/server/entry.mjs)          │
            │                                        │
            │  ┌──────────────┐   ┌──────────────┐   │
            │  │ Prerendered  │   │  API routes  │   │
            │  │ pages (HTML) │   │ (.ts handlers)│  │
            │  └──────────────┘   └──────┬───────┘   │
            │                            │           │
            │                ┌───────────▼─────────┐ │
            │                │     src/lib/*       │ │
            │                │ db, token, email,   │ │
            │                │     rate-limit      │ │
            │                └─────┬───────┬───────┘ │
            └──────────────────────┼───────┼─────────┘
                                   │       │
                                   ▼       ▼
                        ┌──────────────┐ ┌────────────┐
                        │  SQLite      │ │  Resend    │
                        │  (local FS)  │ │  (HTTPS)   │
                        └──────────────┘ └────────────┘
```

**Three layers in the app process:**

1. **Pages / API routes** (`src/pages/*`) — HTTP entry points. Validate input,
   call lib functions, return Response objects (typically 303 redirects).
2. **Lib modules** (`src/lib/*`) — pure, single-responsibility utilities. No
   cross-imports between lib modules except `email.ts` reading the same env
   prefix. Each module owns one concern: db, token, email, rate-limit.
3. **External services** — SQLite on the local filesystem, Resend over HTTPS.

## Entry points

- **HTTP entrypoint (prod):** `dist/server/entry.mjs` — built by Astro from the
  Node adapter. Bound to `127.0.0.1:4321` via `HOST`/`PORT` env vars in
  `deploy/oddlympics.service:19-20`.
- **HTTP entrypoint (dev):** `astro dev` (port 4321 by default), no build step.
- **Static page prerender targets:** `src/pages/index.astro`, `pending.astro`,
  `confirmed.astro` (all set `export const prerender = true`).
- **Server route handlers:** `src/pages/api/signup.ts`, `src/pages/api/confirm.ts`
  (`export const prerender = false`).
- **Module-load side effects:** Importing `src/lib/db.ts` runs the schema
  migration synchronously (line 15-26). Importing `src/lib/email.ts` or
  `src/lib/token.ts` evaluates the `if (!KEY && isProd) throw` guards
  (`src/lib/email.ts:8-10`, `src/lib/token.ts:6-8`).

## Data flow — signup happy path

1. User submits the form on `/` (POST `/api/signup`).
2. `signup.ts` runs `originOk(request, site)` — blocks cross-origin POSTs,
   allows missing `Origin`, allows `localhost`/`127.0.0.1`.
3. Reads `formData()`, returns `bad-form` redirect on parse failure.
4. **Honeypot check:** non-empty `website` field → silent 303 to `/pending`
   (no DB write, bot is none the wiser).
5. Validates email regex + length; coerces unknown `requested_sport` → `'other'`.
6. Calls `checkRateLimit('ip:<ip>')` then `checkRateLimit('email:<email>')`.
   Either over the limit → 303 `/?error=rate-limited`.
7. `upsertVipSignup.get(...)` writes (or upserts) the row.
8. `mintToken(email)` creates a 7-day HMAC-signed token.
9. `sendMagicLink(email, token)` calls Resend (or logs to console in dev).
10. 303 → `/pending?email=<email>`. Client-side script on `/pending` reads
    the email from the URL and inserts it into the page (`pending.astro:28-35`).

## Data flow — confirmation

1. User clicks the magic link → GET `/api/confirm?token=...`.
2. `verifyToken(token)` runs HMAC verification with `timingSafeEqual` and
   checks expiry. Returns `{ email }` or `null`.
3. Null → 303 `/confirmed?status=bad-token`.
4. `markConfirmed.get(email)` runs the conditional UPDATE
   (`WHERE email = ? AND confirmed_at IS NULL`). If a row was returned, the
   row was newly confirmed → 303 `/confirmed?status=ok`.
5. If nothing was updated, `getByEmail.get(email)` checks if the row exists.
   Exists → already confirmed → 303 `/confirmed?status=already`. Doesn't exist
   → 303 `/confirmed?status=unknown`.

## Critical abstraction: prerendered pages reading URL params

Because the three HTML pages set `prerender = true`, `Astro.url.searchParams`
inside the `---` frontmatter returns **build-time** values (always empty). The
established pattern for displaying request-time data is a small inline
`<script is:inline>` that reads `new URL(location.href).searchParams.get(...)`
on the client.

**Working examples:**
- `src/pages/index.astro:61-78` — reads `?error=<code>` and renders message
- `src/pages/pending.astro:28-35` — reads `?email=<address>` and inlines it

**Broken example:** `src/pages/confirmed.astro:3` reads `searchParams.get('status')`
*in the frontmatter*, so the page is prerendered with `status === 'ok'` baked in.
All four redirect targets (`?status=ok|already|bad-token|unknown`) display the
same "Confirmed" copy. See CONCERNS.md.

**Rule of thumb when adding a page:** if the page needs request-time data,
either drop `prerender = true` (page becomes SSR, slower, no edge cache) or
hydrate it client-side (cheaper if the data isn't sensitive).

## API routing

Astro file-based: `src/pages/api/<name>.ts` exports named HTTP method handlers
(`POST`, `GET`). No router config, no middleware chain. Each handler is a
self-contained function with the `APIRoute` type signature
(`src/pages/api/signup.ts:43`, `src/pages/api/confirm.ts:7`).

Handlers always return a `Response` (Web API), almost always a 303 redirect.
Errors are communicated via the `?error=<slug>` query param convention; success
flows redirect to `/pending` or `/confirmed`. **No JSON API surface exists** —
this is a form-driven, redirect-driven app.

## State

- **Persistent:** SQLite `vip_signups` table on disk. One row per email.
- **In-memory (per process):** `src/lib/rate-limit.ts` — `Map<key, timestamp[]>`,
  resets on every restart/deploy.
- **No session state, no cookies, no JWT** — the magic-link token is the only
  bearer credential and is single-use-via-DB-flag (the HMAC itself stays valid
  for 7 days; the `confirmed_at IS NULL` clause in `markConfirmed` makes the
  *effect* idempotent).

## Deployment topology

- **Single process, single host.** No load balancer, no replicas.
- **CI/CD:** GitHub Actions on push to `main` rsyncs the build to the droplet
  and `sudo systemctl restart oddlympics` (`.github/workflows/deploy.yml`).
- **Restart cost:** brief 503 (~1-2 seconds, `RestartSec=2` in the unit) plus
  a flushed in-memory rate limiter. Acceptable for current scale.

## Why this shape

From `CLAUDE.md` conventions: "No framework JS … aesthetic is Bitcoin
minimalist on near-black." The architecture is deliberately the smallest thing
that can ship a double-opt-in form: one Node process, one SQLite file, one
SMTP provider, one CSS file per page. When/if v1.x adds personalization and
notifications, this footprint will need to grow — but for the teaser it's
exactly enough.
