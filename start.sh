#!/usr/bin/env bash
set -euo pipefail

if (( $# > 1 )) || { (( $# == 1 )) && [[ ! $1 =~ ^[a-zA-Z0-9_][a-zA-Z0-9_.-]{0,127}$ ]]; }; then
    printf '사용법  %s [이미지 태그]\n' "$0" >&2
    exit 1
fi

cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
compose=(docker compose -f docker-compose-deployment.yaml)

if (( $# == 1 )); then
    export IMAGE_TAG="$1"
    "${compose[@]}" pull
fi

"${compose[@]}" up -d --wait --wait-timeout 60
address=$("${compose[@]}" exec -T frontend cat /run/homefix-frontend-url)
printf '접속 주소 %s\n' "$address"
