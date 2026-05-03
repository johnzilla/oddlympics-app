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

SSH in and copy the deploy directory:

```bash
ssh root@<droplet-ip>
# from your local machine in another tab:
scp -r deploy root@<droplet-ip>:/tmp/oddlympics-deploy
# back on the droplet:
sudo bash /tmp/oddlympics-deploy/bootstrap.sh
```

The script installs Node 22, Caddy, ufw, creates the `oddlympics` and `deploy`
users, drops the systemd unit and Caddyfile in place, and configures the
firewall (22, 80, 443).

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

Copy the **public** key onto the droplet:

```bash
ssh root@<droplet-ip> 'mkdir -p ~deploy/.ssh && cat >> ~deploy/.ssh/authorized_keys && chown -R deploy:deploy ~deploy/.ssh && chmod 700 ~deploy/.ssh && chmod 600 ~deploy/.ssh/authorized_keys' < ~/.ssh/oddlympics_deploy.pub
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

| Want to... | Run on the droplet |
|---|---|
| See live logs | `journalctl -u oddlympics -f` |
| Restart manually | `sudo systemctl restart oddlympics` |
| Inspect the SQLite DB | `sudo -u oddlympics sqlite3 /var/lib/oddlympics/oddlympics.db` |
| Export the email list | `sudo -u oddlympics sqlite3 -csv /var/lib/oddlympics/oddlympics.db 'SELECT email, requested_sport, datetime(confirmed_at, "unixepoch") FROM vip_signups WHERE confirmed_at IS NOT NULL'` |
| Roll Caddy config | edit `/etc/caddy/Caddyfile`, then `sudo systemctl reload caddy` |
| Back up the DB | `sudo -u oddlympics sqlite3 /var/lib/oddlympics/oddlympics.db ".backup /tmp/oddlympics-$(date +%F).db"` |

## What is NOT in v1 (deferred)

- **DB backups** to off-droplet storage. Add a daily cron + `rclone` to S3/B2 before launch.
- **A2P 10DLC SMS registration.** Start it in parallel if you still want SMS for v1.2.
- **Custom Resend domain.** v1 uses the shared `onboarding@resend.dev` (or whatever you've verified). DKIM + DMARC for `oddlympics.app` is v1.1.
- **Plausible analytics.** Add the script tag in `index.astro` after first deploy.
- **Lightning tip jar.** Out of scope until v1 ships and the `vaultwarden` integration shape is confirmed.
