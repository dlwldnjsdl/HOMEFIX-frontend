#!/usr/bin/env bash
set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."

image=eagleindesert/homefix-frontend
tags_url="https://hub.docker.com/v2/namespaces/${image%/*}/repositories/${image#*/}/tags"
workdir=$(mktemp -d "${TMPDIR:-/tmp}/homefix-buildx.XXXXXXXX")
builder=

cleanup() {
    if [[ -n $builder ]]; then
        docker buildx rm "$builder" >/dev/null || true
    fi
    rm -rf -- "$workdir"
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

hub_headers() {
    printf 'Accept: application/json\n'
    if [[ -n ${DOCKER_HUB_TOKEN:-} ]]; then
        printf 'Authorization: Bearer %s\n' "$DOCKER_HUB_TOKEN"
    fi
}

page=1
: > "$workdir/tags"
while true; do
    status=$(hub_headers | curl --disable --silent --show-error --connect-timeout 10 \
        --max-time 30 --header @- --output "$workdir/page.json" \
        --write-out '%{http_code}' "$tags_url?page_size=100&page=$page")

    if [[ $status == 404 && $page == 1 ]]; then
        break
    fi
    if [[ $status != 200 ]]; then
        printf 'Docker Hub 태그 조회에 실패했습니다 (HTTP %s).\n' "$status" >&2
        exit 1
    fi

    jq -r '.results[] | [(.tag_last_pushed // .last_updated // ""), .name] | @tsv' \
        "$workdir/page.json" >> "$workdir/tags"
    next=$(jq -r '.next // empty' "$workdir/page.json")
    if [[ -z $next ]]; then
        break
    fi
    page=$((page + 1))
done

tags=$(LC_ALL=C sort -r "$workdir/tags" | cut -f2)
previous=없음
if [[ -n $tags ]]; then
    previous=${tags%%$'\n'*}
    printf 'Docker Hub 태그 (%s)\n%s\n' "$image" "$tags"
else
    printf 'Docker Hub에 푸시된 이미지가 없습니다 (%s).\n' "$image"
fi

printf '빌드하고 푸시할 태그를 입력하세요.\n'
if ! IFS= read -r tag || [[ ! $tag =~ ^[a-zA-Z0-9_][a-zA-Z0-9_.-]{0,127}$ ]]; then
    printf '유효한 Docker 이미지 태그를 입력해 주세요.\n' >&2
    exit 1
fi

suffix=${workdir##*.}
builder="homefix-arm64-${suffix,,}"
docker buildx create --name "$builder" --driver docker-container --driver-opt restart-policy=no >/dev/null
docker buildx build --builder "$builder" --platform linux/arm64 --push --tag "$image:$tag" .

cleanup
trap - EXIT
printf '이전 버전 %s · 현재 푸시 버전 %s\n' "$previous" "$tag"
