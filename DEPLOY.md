# Deploy

The teaser ships as a single Node process behind Caddy on a DigitalOcean droplet.
SQLite for storage, systemd for process management, GitHub Actions for CI/CD.

## One-time droplet setup

### 1. Create the droplet

DigitalOcean → **Ubuntu 24.04**, smallest plan ($6/mo, 1 GB / 1 vCPU is plenty for v1).
Add your personal SSH key during creation.

### 2. Point DNS

In your domain registrar (or Cloudflare DNS):

```
A     oddlympics.app        <droplet-ip>
A     www.oddlympics.app    <droplet-ip>
```

If using Cloudflare, set the proxy to **DNS-only** (gray cloud) so Caddy can issue
its own Let's Encrypt cert without conflicting with Cloudflare's edge cert.

### 3. Run the bootstrap

From your local machine, copy the deploy directory and run it as root on the droplet:

```bash
# Clean any prior partial run (scp -r merges into existing dirs and you'll
# end up running a stale bootstrap from the first scp). Safe to skip on a
# truly fresh droplet.
ssh root@<droplet-ip> 'rm -rf /tmp/oddlympics-deploy'

scp -r deploy root@<droplet-ip>:/tmp/oddlympics-deploy
ssh root@<droplet-ip> 'sudo bash /tmp/oddlympics-deploy/bootstrap.sh'
```

The script installs Node 22, Caddy, ufw, creates the `oddlympics` and `deploy`
users, drops the systemd unit and Caddyfile in place, configures the firewall
(22, 80, 443), and writes a sudoers rule that lets `deploy` restart the
service without a password. The script is **idempotent** — re-run safely if
something fails partway through. Look for `Bootstrap complete.` at the end.

### 4. Fill in production env

```bash
sudo nano /etc/oddlympics.env
```

Set:
- `RESEND_API_KEY` — your real Resend key
- `EMAIL_FROM` — e.g. `oddlympics <hello@oddlympics.app>` (your verified Resend sender)
- `MAGIC_LINK_SECRET` — generate fresh with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
  ```
- `PUBLIC_SITE_URL=https://oddlympics.app`
- `DATABASE_PATH=/var/lib/oddlympics/oddlympics.db` (default; leave alone)

### 5. Add the GitHub Actions deploy key

On your local machine:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/oddlympics_deploy -C 'github-actions-deploy' -N ''
```

Copy the **public** key onto the droplet (this command pipes your local public
key into a remote shell that appends it to the deploy user's `authorized_keys`):

```bash
ssh root@<droplet-ip> 'install -d -m 700 -o deploy -g deploy ~deploy/.ssh && tee -a ~deploy/.ssh/authorized_keys && chmod 600 ~deploy/.ssh/authorized_keys && chown deploy:deploy ~deploy/.ssh/authorized_keys' < ~/.ssh/oddlympics_deploy.pub
```

Verify it works:

```bash
ssh -i ~/.ssh/oddlympics_deploy deploy@<droplet-ip> 'whoami && ls -la /opt/oddlympics'
```

Then in GitHub → repo → Settings → Secrets and variables → Actions:

- `DROPLET_HOST` = `oddlympics.app` (or the droplet IP)
- `DROPLET_SSH_KEY` = the **private** key (`cat ~/.ssh/oddlympics_deploy`)

### 6. First deploy

Push to `main` (or trigger manually from the Actions tab). The workflow will:

1. `npm ci` + `npm run build` on the runner
2. `rsync` `dist/`, `package.json`, `package-lock.json` to the droplet
3. SSH in, `npm ci --omit=dev`, rebuild the better-sqlite3 native binding
4. `sudo systemctl restart oddlympics`
5. Smoke-test `https://oddlympics.app/` returns 200

If everything works, https://oddlympics.app shows the teaser.

## Day 2

### On the droplet (`ssh root@oddlympics.app`)

| Want to... | Command |
|---|---|
| See live logs | `journalctl -u oddlympics -f` |
| Restart manually | `systemctl restart oddlympics` |
| Inspect the SQLite DB | `sqlite3 /var/lib/oddlympics/oddlympics.db` |
| Export the confirmed email list | `sqlite3 -csv /var/lib/oddlympics/oddlympics.db 'SELECT email, team, timezone, requested_sport, datetime(confirmed_at, "unixepoch") FROM vip_signups WHERE confirmed_at IS NOT NULL'` |
| Export demand-capture requests (demand triage) | `sqlite3 -csv /var/lib/oddlympics/oddlympics.db 'SELECT email, request_text, datetime(created_at, "unixepoch") FROM feature_requests ORDER BY created_at DESC'` |
| See team distribution (post-Phase-5) | `sqlite3 -column -header /var/lib/oddlympics/oddlympics.db 'SELECT COALESCE(team, "(unset)") AS team, COUNT(*) AS n FROM vip_signups WHERE confirmed_at IS NOT NULL AND unsubscribed_at IS NULL GROUP BY team ORDER BY n DESC'` |
| Referral attribution (Phase 13 — signups by referrer, direct vs referred, % referred) | see [Referral-counting SQL recipe](#referral-counting-sql-recipe-phase-13) below |
| Rate-limit hits in the last hour (quick-s40) | `sqlite3 -column -header /var/lib/oddlympics/oddlympics.db "SELECT key, COUNT(*) AS hits FROM rate_limit_hits WHERE ts > strftime('%s','now') - 3600 GROUP BY key ORDER BY hits DESC LIMIT 20"` — IP keys appear as `ip:<16-char-base64url>` (HMAC-hashed; raw IPs are never persisted per quick-s40 D-02). Email keys show as `email:<address>` (already plaintext in `vip_signups`). |
| Consumed manage-tokens in the last 24h (quick-r1x) | `sqlite3 -column -header /var/lib/oddlympics/oddlympics.db "SELECT COUNT(*) AS consumed_last_24h FROM consumed_tokens WHERE consumed_at > strftime('%s','now') - 86400"` — operator sanity check that the single-use enforcement is active. Boot-time prune trims rows older than 24h on every process restart. |
| Verify team→slug coverage against the LIVE feed (pre-launch / after editing `references/teams.json`) | `cd /opt/oddlympics && sudo -u oddlympics bash -c 'set -a; . /etc/oddlympics.env; set +a; node scripts/audit-team-coverage.mjs'` — read-only (one GET, no DB writes). Exit 0 = every live WC team name resolves to a catalog slug AND all 48 catalog slugs appear in the feed. Exit 1 = it prints the exact unmapped names / missing teams to fix. This is the check that caught the 2026-06-08 launch blockers (missing `references/` deploy + 8 wrong pre-draw guesses in `teams.json`). |
| Manually run the schedule ingest (normally the daily `oddlympics-ingest.timer` does this) | `cd /opt/oddlympics && sudo -u oddlympics bash -c 'set -a; . /etc/oddlympics.env; set +a; node scripts/ingest-schedule.mjs'` — idempotent upserts of WC teams + matches from football-data.org; logs any `no-slug` team name. Run as the `oddlympics` user so the DB keeps correct ownership. **Requires `references/teams.json` to exist on the droplet** (shipped by the deploy rsync since 2026-06-08). |
| Roll Caddy config | edit `/etc/caddy/Caddyfile`, then `systemctl reload caddy` |
| Back up the DB | `sqlite3 /var/lib/oddlympics/oddlympics.db ".backup /tmp/oddlympics-$(date +%F).db"` |
| Pre-Phase-5-deploy backup (one-shot) | see [Pre-deploy SQLite backup (Phase 5 / v2.0)](#pre-deploy-sqlite-backup-phase-5--v20) below |
| Plausible custom-goal management (on-demand, when adding new custom events; Phase 6 added `Signup Submit`) | Visit `https://plausible.io/oddlympics.app/settings/goals` → "+ Add goal" → "Custom event" → name = exact event name (case-sensitive) → Save. Verify the goal appears in the list. The custom event name in the goal MUST match the string passed to `window.plausible('<name>', ...)` in source. Per CONTEXT D-10 / Phase 11 AC11. Required before merging any phase that adds a new Plausible custom event. |
| Regenerate per-team OG PNGs (Phase 15 — after editing `references/teams.json` or `references/og-image-team.svg`) | From a dev checkout, `npm run og:render-teams` (writes 48 PNGs into `public/og/<slug>.png`, exits 1 on any per-team 6-check FAIL). Commit the regenerated PNGs and push — GitHub Actions rsyncs them on the next deploy. Render is deterministic (`loadSystemFonts: false`) so re-running on unchanged inputs produces byte-identical output. |
| Verify per-team OG unfurl on production (Phase 15 — post-deploy human-UAT item) | Paste a real `https://oddlympics.app/r/<code>` URL (pull a `referral_code` from the DB via the SQL recipes above) into Twitter/X Card Validator (`https://cards-dev.twitter.com/validator`), LinkedIn Post Inspector (`https://www.linkedin.com/post-inspector/`), Facebook Sharing Debugger (`https://developers.facebook.com/tools/debug/`), and Slack. Expected: card title `Following <Team> · oddlympics`, preview image `/og/<slug>.png` (NOT `/og-image.png`), 1200×630. Logged in `.planning/phases/15-personalized-open-graph/15-HUMAN-UAT.md`. |

### From your laptop (one-shot signal pull)

```bash
ssh root@oddlympics.app 'sqlite3 /var/lib/oddlympics/oddlympics.db <<SQL
.mode column
.headers on
SELECT "TOTALS" AS section, COUNT(*) AS total, SUM(confirmed_at IS NOT NULL) AS confirmed FROM vip_signups;
SELECT requested_sport, COUNT(*) AS n FROM vip_signups GROUP BY requested_sport;
SELECT date(created_at, "unixepoch") AS day, COUNT(*) AS signups, SUM(confirmed_at IS NOT NULL) AS confirmed FROM vip_signups WHERE created_at > strftime("%s","now","-14 days") GROUP BY day ORDER BY day;
SQL'
```

### Referral-counting SQL recipe (Phase 13)

Phase 13 referral-attribution measurement path (REQUIREMENTS.md REF-01/REF-03). Reports confirmed
signups grouped by `referred_by` (top referral codes), total referred vs. direct, and % of each.

```bash
ssh root@oddlympics.app 'sqlite3 /var/lib/oddlympics/oddlympics.db <<SQL
.mode column
.headers on
SELECT COALESCE(referred_by, "(direct)") AS referrer,
       COUNT(*) AS signups,
       ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM vip_signups WHERE confirmed_at IS NOT NULL), 1) AS pct
FROM vip_signups
WHERE confirmed_at IS NOT NULL AND unsubscribed_at IS NULL
GROUP BY referred_by
ORDER BY signups DESC;
SQL'
```

## Backups

Use **DigitalOcean Backups** (Droplet → Backups tab → Enable). Weekly snapshots, ~$1.20/mo for this droplet. Restore by spinning a new droplet from the snapshot.

## Schedule data refresh (Phase 2 — DATA-02)

A systemd timer fires `scripts/ingest-schedule.mjs` once a day at **03:00** server-local (UTC on the droplet). The script pulls World Cup 2026 teams + matches from football-data.org and upserts into local SQLite. Idempotent (upserts on `id` conflict); a re-run just costs an extra ~2 API calls. Free-tier rate limit is 10 req/min — 2 calls per run is fine.

### One-time install on existing droplet

After the next deploy lands `deploy/oddlympics-ingest.{service,timer}` in `/opt/oddlympics/deploy/`:

```bash
ssh root@oddlympics.app
sudo cp /opt/oddlympics/deploy/oddlympics-ingest.service /etc/systemd/system/
sudo cp /opt/oddlympics/deploy/oddlympics-ingest.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now oddlympics-ingest.timer
sudo systemctl list-timers oddlympics-ingest.timer    # confirm scheduled
```

(Fresh droplets get this automatically via `bootstrap.sh`.)

### Run an ad-hoc refresh

The timer ticks once a day; if you need to refresh sooner (e.g. after a fixture change), trigger the service directly:

```bash
sudo systemctl start oddlympics-ingest
journalctl -u oddlympics-ingest -n 50
```

Or run the script by hand:

```bash
sudo -u oddlympics bash -c \
  'set -a; . /etc/oddlympics.env; set +a; \
   cd /opt/oddlympics && node scripts/ingest-schedule.mjs'
```

### Tail the journal

```bash
journalctl -u oddlympics-ingest -f
```

## Kickoff notifications (Phase 3)

A systemd timer fires `scripts/send-kickoff-notifications.mjs` every 5 minutes. The script finds matches kicking off in the next 55-65 minutes that involve a team some user has selected, and sends each user one email per match. Idempotent (unique constraint on `user_email + match_id + channel`).

**Safety switch.** The script runs in **dry-run** mode unless `KICKOFF_NOTIFICATIONS_ENABLED=true` is set in `/etc/oddlympics.env`. Dry-run logs what would have been sent without calling Resend.

### One-time install on existing droplet

After the next deploy lands `deploy/oddlympics-notify.{service,timer}` in `/opt/oddlympics/deploy/`:

```bash
ssh root@oddlympics.app
sudo cp /opt/oddlympics/deploy/oddlympics-notify.service /etc/systemd/system/
sudo cp /opt/oddlympics/deploy/oddlympics-notify.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now oddlympics-notify.timer
sudo systemctl list-timers oddlympics-notify.timer    # confirm scheduled
```

(Fresh droplets get this automatically via `bootstrap.sh`.)

### Tail the journal

```bash
journalctl -u oddlympics-notify -f
```

You'll see one entry per timer firing. While `KICKOFF_NOTIFICATIONS_ENABLED=false`, lines look like:
```
[notify] mode=dry-run matches-in-window=0
```
or, when a match is in scope:
```
[notify] mode=dry-run matches-in-window=1
  match 537333 CAN vs BIH: 1 subscriber(s)
    (dry-run) you@example.com
```

### Flip the switch when ready

Edit `/etc/oddlympics.env` and set:
```
KICKOFF_NOTIFICATIONS_ENABLED=true
```
No restart needed — the next 5-minute timer firing picks up the new value (the script reads env on each invocation).

## Pre-deploy SQLite backup (Phase 5 / v2.0)

The Phase 5 migration is the **first non-additive change** in project history
— it drops the `vip_signups.selected_teams` column. Re-runs are a no-op
(idempotent via `has('selected_teams')` probe), but the drop itself is
destructive. Always snapshot the live DB once on the droplet immediately
before the deploy that lands the Phase 5 commits.

```bash
ssh root@oddlympics.app 'sudo -u oddlympics bash -c \
  "set -a; . /etc/oddlympics.env; set +a; \
   cd /opt/oddlympics && node scripts/backup-pre-05.mjs"'
```

Expected output:
```
[backup] copying /var/lib/oddlympics/oddlympics.db -> /var/lib/oddlympics/oddlympics.db.pre-05.bak
[backup] done size=NNNNN
```

The script uses `better-sqlite3`'s online-backup API (WAL-safe, won't tear)
and **refuses to overwrite** an existing `.pre-05.bak` file — re-running it
exits 1 with `[backup] refusing to overwrite ...`. If you need to redo the
backup, rename or delete the existing file explicitly first.

After the deploy lands and you've confirmed `/api/signup` accepts team +
timezone (see "Phase 5 post-deploy smoke" below) and the operator's team
selection is set via `/manage` (`/schedule` 301-redirects there), the
`.pre-05.bak` file can be removed
(~1 week post-deploy). DigitalOcean Backups remain as the DR floor.

## Phase 5 post-deploy smoke (v2.0)

After the Phase 5 deploy completes (and ideally before flipping the kickoff
cron live), run the end-to-end smoke against production. The script defaults
to `http://localhost:4321` for safety — point it at production explicitly:

```bash
# From the droplet (uses prod DB readonly to assert side effects)
ssh root@oddlympics.app 'sudo -u oddlympics bash -c \
  "set -a; . /etc/oddlympics.env; set +a; \
   cd /opt/oddlympics && SMOKE_BASE_URL=http://127.0.0.1:4321 \
   DATABASE_PATH=/var/lib/oddlympics/oddlympics.db \
   node scripts/smoke-signup.mjs"'
```

Expect exit 0. (The smoke has grown to 19 cases as of Phase 15 —
Phase 5 signup/team/tz, Phase 13 `REF-*` referral attribution, Phase 14 +
Phase 15 `SHARE-*` / `SHARE-r-*`. The cleanup below clears the synthetic
`smoke-*@example.com` rows; quick-s40 `smoke-rate-limit.mjs` and quick-r1x
`smoke-manage.mjs` add their own `smoke-s40-*` / `smoke-m*-*` keys which
self-prune on the next process boot for the TTL-bound tables.) HTTP cases
use `smoke-*@example.com` emails — clean them up with:

```bash
sudo -u oddlympics sqlite3 /var/lib/oddlympics/oddlympics.db \
  "DELETE FROM vip_signups WHERE email LIKE 'smoke-%@example.com'"
```

## Launch blast

`scripts/launch-blast.mjs` sends a "pick your teams" magic-link email to every confirmed-and-not-unsubscribed row in `vip_signups` that hasn't already been blasted. Idempotent (tracked via `vip_signups.manage_blast_sent_at`).

**Defaults to dry-run.** Always preview before sending.

```bash
# Dry-run — lists eligible recipients, sends nothing
ssh root@oddlympics.app 'sudo -u oddlympics bash -c \
  "set -a; . /etc/oddlympics.env; set +a; \
   cd /opt/oddlympics && node scripts/launch-blast.mjs"'

# Send to one email (smoke test)
ssh root@oddlympics.app 'sudo -u oddlympics bash -c \
  "set -a; . /etc/oddlympics.env; set +a; \
   cd /opt/oddlympics && node scripts/launch-blast.mjs --send --only=you@example.com"'

# Real send to all eligible
ssh root@oddlympics.app 'sudo -u oddlympics bash -c \
  "set -a; . /etc/oddlympics.env; set +a; \
   cd /opt/oddlympics && node scripts/launch-blast.mjs --send"'
```

Throttles 1.5s between sends. Resend free tier is 100/day, 10/sec — well inside.

## What's in v1 today

- Hero + email capture + magic-link confirm flow (Astro + SQLite + Resend)
- Caddy with auto Let's Encrypt; HSTS + frame-deny + nosniff + referrer policy
- Plausible analytics on `/`, `/pending`, `/confirmed`
- GitHub Actions auto-deploy on push to `main`

## What is NOT in v1 (deferred)

- **A2P 10DLC SMS registration.** Start it in parallel if you still want SMS for v1.2.
- **Custom Resend domain.** Live — production sends from the verified custom domain `hello@oddlympics.app` (DKIM + DMARC for `oddlympics.app`), set via `/etc/oddlympics.env` `EMAIL_FROM`, 10/10 Mail-Tester. The `onboarding@resend.dev` sandbox sender remains the dev/fallback default only.
- **Lightning tip jar.** Out of scope until v1 ships and the `vaultwarden` integration shape is confirmed.
