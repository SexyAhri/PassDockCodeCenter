#!/usr/bin/env bash
set -euo pipefail

APP_PATH="${1:-$(pwd)}"

echo "[passdock] bootstrap path: $APP_PATH"
mkdir -p "$APP_PATH"
cd "$APP_PATH"

mkdir -p data storage newapi-adapter-data

if [[ ! -f passdock.env ]]; then
  cat <<'EOF'
[passdock] passdock.env is missing.
Place your production env file at:
  <repo-root>/passdock.env
EOF
else
  echo "[passdock] found passdock.env"
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "[passdock] docker is not installed" >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "[passdock] docker compose plugin is not available" >&2
  exit 1
fi

echo "[passdock] directories ready:"
echo "  - $APP_PATH/data"
echo "  - $APP_PATH/storage"
echo "  - $APP_PATH/newapi-adapter-data"

if [[ -f deploy/passdock-docker-compose.sqlite.pull.yml ]]; then
  echo "[passdock] validating pull compose"
  docker compose -f deploy/passdock-docker-compose.sqlite.pull.yml config >/dev/null
  echo "[passdock] pull compose config check passed"
else
  echo "[passdock] deploy/passdock-docker-compose.sqlite.pull.yml not found yet"
fi

cat <<'EOF'
[passdock] next steps:
1. log in to GHCR on the server if your images are private
2. trigger the GitHub Actions deploy workflow
3. or run:
   docker compose -f deploy/passdock-docker-compose.sqlite.pull.yml pull
   docker compose -f deploy/passdock-docker-compose.sqlite.pull.yml up -d
EOF
