#!/usr/bin/env bash
# Runs on the server as the forced command of the GitHub Actions deploy key (see deploy/README.md),
# so that key can do nothing but this.
#   stdin:                 a GHCR token valid for the calling workflow run (read:packages)
#   SSH_ORIGINAL_COMMAND:  the GitHub user that owns the token
# Wrapped in main() so bash has parsed everything before `git reset` rewrites this file.
set -euo pipefail

main() {
  local user=${SSH_ORIGINAL_COMMAND:-}
  [[ $user =~ ^[A-Za-z0-9-]+$ ]] || { echo "bad user: '$user'" >&2; exit 2; }

  cd "$(dirname "$(readlink -f "$0")")/.."
  git fetch -q origin main
  git reset -q --hard origin/main   # .env is gitignored, so it survives

  docker login ghcr.io -u "$user" --password-stdin >/dev/null
  trap 'docker logout ghcr.io >/dev/null' EXIT

  local compose=(docker compose -f docker-compose.prod.yml)
  "${compose[@]}" pull -q api web
  "${compose[@]}" up -d --no-build --remove-orphans
  # Caddyfile is a bind mount: `up -d` does not restart caddy when only that file changed, so reload it.
  "${compose[@]}" exec -T caddy caddy reload --config /etc/caddy/Caddyfile || echo "caddy reload failed (config unchanged?)" >&2
  docker image prune -f >/dev/null
  echo "deployed $(git rev-parse --short HEAD)"
}

main "$@"
exit
