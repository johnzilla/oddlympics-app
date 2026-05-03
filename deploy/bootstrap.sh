#!/usr/bin/env bash
# Bootstrap a fresh DigitalOcean Ubuntu 24.04 droplet for oddlympics.
# Run as root: sudo bash bootstrap.sh
# Idempotent — safe to re-run.
set -euo pipefail

APP_USER=oddlympics
APP_DIR=/opt/oddlympics
DATA_DIR=/var/lib/oddlympics
DEPLOY_USER=deploy
NODE_MAJOR=22
REPO_DIR=$(cd "$(dirname "$0")" && pwd)

if [[ "$EUID" -ne 0 ]]; then
  echo "Run as root (sudo bash bootstrap.sh)" >&2
  exit 1
fi

echo "==> apt update + base packages"
export DEBIAN_FRONTEND=noninteractive
# Recover from a previously-broken bootstrap run that left a malformed
# Caddy source file. Safe to run unconditionally — we re-create it below.
rm -f /etc/apt/sources.list.d/caddy-stable.list
apt-get update -y
apt-get install -y curl ca-certificates gnupg lsb-release ufw rsync build-essential python3

echo "==> Node.js ${NODE_MAJOR}.x via NodeSource"
if ! command -v node >/dev/null || [[ "$(node -v)" != v${NODE_MAJOR}.* ]]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi
node -v
npm -v

echo "==> Caddy via official repo"
# Always rewrite — the Cloudsmith deb.txt format has changed in the past and any
# stale /etc/apt/sources.list.d/caddy-stable.list breaks apt-get update.
rm -f /etc/apt/sources.list.d/caddy-stable.list
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | gpg --batch --yes --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/caddy-stable-archive-keyring.gpg] https://dl.cloudsmith.io/public/caddy/stable/deb/debian any-version main" \
  > /etc/apt/sources.list.d/caddy-stable.list
apt-get update -y
apt-get install -y caddy

echo "==> firewall"
ufw allow OpenSSH || true
ufw allow 80/tcp || true
ufw allow 443/tcp || true
yes | ufw enable || true

echo "==> app + deploy users"
id -u "$APP_USER"   >/dev/null 2>&1 || useradd --system --home-dir "$APP_DIR" --shell /usr/sbin/nologin "$APP_USER"
id -u "$DEPLOY_USER" >/dev/null 2>&1 || useradd --create-home --shell /bin/bash "$DEPLOY_USER"

echo "==> directories"
install -d -o "$APP_USER" -g "$APP_USER" -m 755 "$APP_DIR"
install -d -o "$APP_USER" -g "$APP_USER" -m 750 "$DATA_DIR"

# Deploy user owns the app dir for rsync; app user reads/executes it
chown -R "$DEPLOY_USER":"$APP_USER" "$APP_DIR"
chmod 750 "$APP_DIR"

echo "==> systemd unit"
install -m 644 "$REPO_DIR/oddlympics.service" /etc/systemd/system/oddlympics.service

echo "==> environment file (only if missing — never overwrite)"
if [[ ! -f /etc/oddlympics.env ]]; then
  install -m 640 -o root -g "$APP_USER" "$REPO_DIR/oddlympics.env.example" /etc/oddlympics.env
  echo "    Edit /etc/oddlympics.env BEFORE first deploy."
else
  echo "    /etc/oddlympics.env exists — leaving alone."
fi

echo "==> Caddyfile"
install -m 644 "$REPO_DIR/Caddyfile" /etc/caddy/Caddyfile

echo "==> sudoers: deploy user can restart oddlympics without password"
# List both /bin and /usr/bin paths because sudo doesn't follow symlinks when
# matching commands, and Ubuntu's usrmerge means systemctl is reachable at both.
cat > /etc/sudoers.d/oddlympics-deploy <<EOF
$DEPLOY_USER ALL=(root) NOPASSWD: /bin/systemctl restart oddlympics, /usr/bin/systemctl restart oddlympics, /bin/systemctl status oddlympics, /usr/bin/systemctl status oddlympics, /bin/systemctl reload caddy, /usr/bin/systemctl reload caddy
EOF
chmod 440 /etc/sudoers.d/oddlympics-deploy
visudo -cf /etc/sudoers.d/oddlympics-deploy

echo "==> reload services"
systemctl daemon-reload
systemctl enable oddlympics caddy
systemctl reload caddy || systemctl restart caddy

echo
echo "=========================================================="
echo "Bootstrap complete."
echo
echo "Next:"
echo "  1. Edit /etc/oddlympics.env and fill in real values."
echo "  2. Add ~deploy/.ssh/authorized_keys with the GitHub Actions deploy key."
echo "  3. Point DNS A records (oddlympics.app, www.oddlympics.app) at this droplet."
echo "  4. Push to main — GitHub Actions will rsync + restart."
echo
echo "After first deploy: systemctl start oddlympics && journalctl -u oddlympics -f"
echo "=========================================================="
