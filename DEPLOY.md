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

## Backups

Use **DigitalOcean Backups** (Droplet → Backups tab → Enable). Weekly snapshots, ~$1.20/mo for this droplet. Restore by spinning a new droplet from the snapshot.

## What's in v1 today

- Hero + email capture + magic-link confirm flow (Astro + SQLite + Resend)
- Caddy with auto Let's Encrypt; HSTS + frame-deny + nosniff + referrer policy
- Plausible analytics on `/`, `/pending`, `/confirmed`
- GitHub Actions auto-deploy on push to `main`

## What is NOT in v1 (deferred)

- **A2P 10DLC SMS registration.** Start it in parallel if you still want SMS for v1.2.
- **Custom Resend domain.** v1 uses your verified Resend sender. DKIM + DMARC for `oddlympics.app` is v1.1.
- **Lightning tip jar.** Out of scope until v1 ships and the `vaultwarden` integration shape is confirmed.
