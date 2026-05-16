# Integrations

**Last mapped:** 2026-05-08

External services this app talks to in production. Each entry includes where
the integration lives in the code, what auth it uses, and what failure mode
the app currently has.

## Resend (transactional email)

- **What it does:** Sends the magic-link confirmation email on POST `/api/signup`.
- **SDK:** `resend@^6.12.2`
- **Code path:** `src/lib/email.ts:1` — `Resend` instance, `sendMagicLink(email, token)`
- **Auth:** API key via `RESEND_API_KEY` env var (read at module load time, line 3).
- **From address:** `EMAIL_FROM` env var, defaults to `oddlympics <onboarding@resend.dev>` (Resend's shared sandbox sender).
- **Error handling:** If `resend.emails.send` returns an `error`, the lib throws
  `Error('Resend error: ${msg}')` (`src/lib/email.ts:51`). The signup route catches
  it and 303-redirects to `/?error=email` (`src/pages/api/signup.ts:89-92`).
- **Dev fallback:** If `RESEND_API_KEY` is unset and `NODE_ENV !== 'production'`,
  the magic link is logged to stdout instead of sent
  (`src/lib/email.ts:42-48`). In production the missing key throws on boot
  (`src/lib/email.ts:8-10`).
- **Email content:** Hardcoded plaintext + HTML in `sendMagicLink`
  (`src/lib/email.ts:16-40`). No templating engine; subject is fixed to
  "Confirm your spot — oddlympics".
- **Domain status:** Production sends from the verified custom domain
  `hello@oddlympics.app` (DKIM/DMARC for `oddlympics.app`) since v2.0 Phase 10
  (10/10 Mail-Tester), set via `/etc/oddlympics.env` `EMAIL_FROM`. The
  `onboarding@resend.dev` sandbox sender is the dev/fallback default only.

## SQLite (local datastore)

Not strictly an "external" integration but the only persistence layer.

- **Driver:** `better-sqlite3@^12.9.0` (synchronous; no connection pool needed)
- **Code path:** `src/lib/db.ts`
- **DB file:** `process.env.DATABASE_PATH ?? './data/oddlympics.db'`
  (`src/lib/db.ts:5-6`); on the droplet this resolves to
  `/var/lib/oddlympics/oddlympics.db` (writable per
  `deploy/oddlympics.service:31`).
- **Schema:** Single table `vip_signups` with auto-migrating `CREATE TABLE IF NOT EXISTS`
  on module load (`src/lib/db.ts:15-26`). One index on `confirmed_at`.
- **Pragmas:** WAL journal mode + foreign keys ON (`src/lib/db.ts:12-13`).
- **Prepared statements exported:** `upsertVipSignup`, `markConfirmed`, `getByEmail`.
- **Backups:** None automated. `DEPLOY.md:110` documents the manual
  `sqlite3 .backup` command. Off-droplet backup is deferred (`DEPLOY.md:133`).

## Caddy (TLS + reverse proxy)

- **Where:** `deploy/Caddyfile` on the droplet at `/etc/caddy/Caddyfile`
- **Provisions Let's Encrypt certificates** automatically on first request
  (`deploy/Caddyfile:7`). DNS A records for `oddlympics.app` and
  `www.oddlympics.app` must point at the droplet first (`DEPLOY.md:13-20`).
- **Reverse-proxies** `oddlympics.app` and `www.oddlympics.app` to
  `127.0.0.1:4321` (`deploy/Caddyfile:17`).
- **Forwards real client IP** via `X-Real-IP`, `X-Forwarded-For`, and
  `X-Forwarded-Proto` headers (`deploy/Caddyfile:18-21`); the signup route
  reads these in `clientIp()` (`src/pages/api/signup.ts:12-16`) for rate-limit keys.
- **Security headers added at the edge:** HSTS (1 year), `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`,
  and removes `Server: Caddy` (`deploy/Caddyfile:24-32`).
- **Static asset caching:** `/_astro/*` and `/favicon.svg` get
  `Cache-Control: public, max-age=31536000, immutable` (`deploy/Caddyfile:11-14`).
- **Redirects** `www.oddlympics.app` → `https://oddlympics.app{uri}`
  (`deploy/Caddyfile:35-36`).

## Plausible Analytics

- **What:** Privacy-friendly page-view analytics, no cookies.
- **How:** Inline `<script async src="https://plausible.io/js/pa-...js">` in
  every prerendered page (`src/pages/index.astro:20`,
  `src/pages/pending.astro:13`, `src/pages/confirmed.astro:39`).
- **Tracker ID:** `pa-wRAab3seDWDDBnGbRbe0K` (hardcoded; not env-driven).
- **No server-side integration.** Pure client-side beacon to `plausible.io`.

## DigitalOcean droplet (host)

- **Spec:** Ubuntu 24.04, $6/mo plan (1 GB / 1 vCPU per `DEPLOY.md:11`).
- **Provisioned via:** `deploy/bootstrap.sh` (idempotent; installs Node 22,
  Caddy, ufw, creates `oddlympics` and `deploy` users, drops the systemd unit
  + Caddyfile + sudoers rule).
- **Process management:** `systemd` unit `oddlympics.service` runs
  `node ./dist/server/entry.mjs` as the unprivileged `oddlympics` user with
  hardening flags (see STACK.md for env vars and `deploy/oddlympics.service:33-46`).
- **No DigitalOcean API integration in code** — droplet is provisioned manually.

## GitHub Actions (CI/CD)

- **File:** `.github/workflows/deploy.yml`
- **Trigger:** push to `main` or manual `workflow_dispatch`
  (`.github/workflows/deploy.yml:3-6`).
- **Concurrency:** group `deploy`, no cancel-in-progress (queues sequential
  deploys, line 8-10).
- **Auth to droplet:** SSH key from `secrets.DROPLET_SSH_KEY`, host from
  `secrets.DROPLET_HOST`. Key written to `~/.ssh/id_ed25519` on the runner
  (line 35-40), host fingerprint added via `ssh-keyscan`.
- **Deploy user on droplet:** `deploy` (created by bootstrap), restricted by
  sudoers to `systemctl restart|status oddlympics` and `systemctl reload caddy`
  (`deploy/bootstrap.sh:90-95`).
- **What it does:** `npm ci` + `npm run build` on the runner → rsync `dist/`
  + `package.json` + `package-lock.json` → `ssh` into droplet → `npm ci --omit=dev`
  + `npm rebuild better-sqlite3` + `sudo systemctl restart oddlympics` →
  smoke-test `https://$DROPLET_HOST/` returns 200.
- **Smoke test note:** uses `curl -sk` (skips TLS verification) — currently
  fine because `DROPLET_HOST` is the apex domain with a valid Caddy-issued
  cert. Worth tightening if `DROPLET_HOST` is ever set to a raw IP.

## What's NOT integrated yet (deferred)

Per `DEPLOY.md:131-136` and `CLAUDE.md`:

- **No off-droplet DB backup** (rclone → S3/B2 planned before launch).
- **No SMS provider / A2P 10DLC** (deferred to v1.2).
- **No Lightning / BTCPay / Strike** integration (deferred until after launch).
- **No webhooks inbound** — there is no `/api/webhook/*` route.
- **No auth provider** — the only "auth" is the magic-link confirmation; there
  is no user login/session.
