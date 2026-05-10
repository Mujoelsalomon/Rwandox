#!/usr/bin/env bash
set -euo pipefail

# Copy repository nginx config into WSL's /etc/nginx/conf.d and restart nginx
# Usage: run from project root in WSL (may require sudo):
#   sudo ./scripts/run-nginx-wsl.sh

SRC="$(pwd)/backend/nginx/default.conf"
DST="/etc/nginx/conf.d/default.conf"

if [ ! -f "$SRC" ]; then
  echo "error: source config not found: $SRC" >&2
  exit 2
fi

echo "Copying $SRC -> $DST"
sudo mkdir -p /etc/nginx/conf.d
sudo cp "$SRC" "$DST"
sudo chown root:root "$DST"
sudo chmod 644 "$DST"

echo "Testing nginx configuration..."
sudo nginx -t

echo "Reloading nginx service..."
if command -v systemctl >/dev/null 2>&1; then
  sudo systemctl restart nginx
  sudo systemctl status nginx --no-pager --full | sed -n '1,120p'
else
  sudo service nginx restart
fi

echo "Done. Visit http://localhost to verify proxying to frontend/backend."
