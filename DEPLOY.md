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
| Export the confirmed email list | `sqlite3 -csv /var/lib/oddlympics/oddlympics.db 'SELECT email, requested_sport, datetime(confirmed_at, "unixepoch") FROM vip_signups WHERE confirmed_at IS NOT NULL'` |
| Roll Caddy config | edit `/etc/caddy/Caddyfile`, then `systemctl reload caddy` |
| Back up the DB | `sqlite3 /var/lib/oddlympics/oddlympics.db ".backup /tmp/oddlympics-$(date +%F).db"` |

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

## Backups and restore

The droplet runs `oddlympics-backup.timer` daily at **03:00 UTC**, firing
`oddlympics-backup.service` (a systemd oneshot) which:

1. Takes a SQLite snapshot via `sqlite3 .backup` (atomic, WAL-safe).
2. Runs `PRAGMA integrity_check` — aborts on failure.
3. Uploads the snapshot to `b2:$B2_BUCKET/daily/oddlympics-<timestamp>.db`.
4. Keeps the last 7 snapshots locally in `/var/cache/oddlympics-backup` for fast emergency restore.

**Retention policy** (configured as B2 lifecycle rules in the bucket settings):

- `daily/` — keep last **30 days**
- `weekly/` — keep last **12 weeks** (84 days)

**Credentials** live in `/etc/oddlympics-backup.env` (mode 640, root:oddlympics).
Separate from `/etc/oddlympics.env` so the app process cannot read the B2 key.
The B2 application key is scoped to the single `oddlympics-backups` bucket
(no list-buckets, no admin) — least privilege.

### Day 2 backup ops

| Want to... | Command |
|---|---|
| See last backup run | `journalctl -u oddlympics-backup -n 50 --no-pager` |
| Trigger a manual backup | `sudo systemctl start oddlympics-backup.service && journalctl -u oddlympics-backup -f` |
| List all timers | `systemctl list-timers` |
| List local snapshots | `ls -lh /var/cache/oddlympics-backup/` |
| List B2 snapshots | `rclone ls b2:$B2_BUCKET/daily/` (run as oddlympics user, env loaded) |

### Restore from B2

If the droplet's DB is lost or corrupted, restore from the most recent good snapshot.

```bash
# 1. SSH into the droplet (or any machine with rclone + the B2 key configured)
ssh root@oddlympics.app

# 2. Pick a snapshot
ls /var/cache/oddlympics-backup/                # local recent (last 7)
sudo -u oddlympics bash -c 'set -a; . /etc/oddlympics-backup.env; set +a; \
  export RCLONE_CONFIG_B2_TYPE=b2 RCLONE_CONFIG_B2_ACCOUNT="$B2_ACCOUNT_ID" RCLONE_CONFIG_B2_KEY="$B2_APPLICATION_KEY"; \
  rclone ls b2:$B2_BUCKET/daily/'              # full off-droplet history

# 3. Download a specific snapshot (example: 2026-05-08T03:00:00Z)
sudo -u oddlympics bash -c 'set -a; . /etc/oddlympics-backup.env; set +a; \
  export RCLONE_CONFIG_B2_TYPE=b2 RCLONE_CONFIG_B2_ACCOUNT="$B2_ACCOUNT_ID" RCLONE_CONFIG_B2_KEY="$B2_APPLICATION_KEY"; \
  rclone copyto b2:$B2_BUCKET/daily/oddlympics-2026-05-08T03-00-00Z.db /tmp/restore.db'

# 4. Verify integrity BEFORE swapping into prod
sqlite3 /tmp/restore.db "PRAGMA integrity_check"          # must print 'ok'
sqlite3 /tmp/restore.db "SELECT COUNT(*) FROM vip_signups"
sqlite3 /tmp/restore.db "SELECT email, datetime(confirmed_at,'unixepoch') \
  FROM vip_signups WHERE confirmed_at IS NOT NULL ORDER BY confirmed_at DESC LIMIT 5"

# 5. Stop the app, swap the DB, start the app (causes ~2s downtime)
systemctl stop oddlympics
cp /var/lib/oddlympics/oddlympics.db /var/lib/oddlympics/oddlympics.db.before-restore
mv /tmp/restore.db /var/lib/oddlympics/oddlympics.db
chown oddlympics:oddlympics /var/lib/oddlympics/oddlympics.db
systemctl start oddlympics
journalctl -u oddlympics -n 20 --no-pager     # confirm clean startup
```

### Restore drill (D-14 acceptance — must be performed before HARDEN-05 closes)

Run the above flow on a **scratch host** (not prod) to confirm the procedure end to end:

1. Fresh Ubuntu container or a separate droplet with rclone installed.
2. Install rclone, populate /tmp/oddlympics-backup.env with the read-scoped key (or reuse the prod key for a one-time drill).
3. Download yesterday's snapshot from B2.
4. Run the integrity check + count + last-5-confirmed queries — record the output.
5. Confirm the row count matches a contemporaneous `sqlite3 /var/lib/oddlympics/oddlympics.db "SELECT COUNT(*) FROM vip_signups"` taken on prod (within ±1 row, accounting for the time delta since the snapshot).

## What's in v1 today

- Hero + email capture + magic-link confirm flow (Astro + SQLite + Resend)
- Caddy with auto Let's Encrypt; HSTS + frame-deny + nosniff + referrer policy
- Plausible analytics on `/`, `/pending`, `/confirmed`
- GitHub Actions auto-deploy on push to `main`

## What is NOT in v1 (deferred)

- **A2P 10DLC SMS registration.** Start it in parallel if you still want SMS for v1.2.
- **Custom Resend domain.** v1 uses your verified Resend sender. DKIM + DMARC for `oddlympics.app` is v1.1.
- **Lightning tip jar.** Out of scope until v1 ships and the `vaultwarden` integration shape is confirmed.
