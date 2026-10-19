#!/usr/bin/env bash
# Ship the working tree (tracked + new, non-ignored files) to the server and rebuild.
#   scripts/deploy.sh ubuntu@<server-ip>
# The server keeps its own .env (secrets); it is never overwritten. See deploy/README.md.
set -euo pipefail
HOST=${1:?usage: scripts/deploy.sh user@host}
KEY=${TRAWLER_SSH_KEY:-$HOME/.ssh/trawler_lightsail}
cd "$(dirname "$0")/.."

git ls-files -co --exclude-standard -z \
  | tar --null --no-mac-metadata -czf - -T - \
  | ssh -i "$KEY" "$HOST" 'mkdir -p ~/trawler && tar -xzf - -C ~/trawler'
ssh -i "$KEY" "$HOST" 'cd ~/trawler && docker compose -f docker-compose.prod.yml up -d --build && docker image prune -f >/dev/null'
