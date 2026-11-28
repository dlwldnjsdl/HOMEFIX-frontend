#!/usr/bin/env bash
set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
compose=(docker compose -f docker-compose.yaml)

"${compose[@]}" up -d --build --wait --wait-timeout 60
address=$("${compose[@]}" exec -T frontend cat /run/homefix-frontend-url)
printf '접속 주소 %s\n' "$address"
