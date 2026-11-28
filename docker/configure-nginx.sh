#!/bin/sh
set -eu

endpoint=${NGINX_ENDPOINT:-/test}
public_url=${PUBLIC_ORIGIN:-http://127.0.0.1}
upstream=${DOCKER_API_UPSTREAM:-https://torysv.kro.kr/fixmyhome/api/v1}

invalid_config() {
    printf '%s\n' 'NGINX_ENDPOINT, PUBLIC_ORIGIN, DOCKER_API_UPSTREAM의 형식을 확인해 주세요.' >&2
    exit 1
}

# Validate the inputs before inserting them into Nginx directives.
case "$endpoint$public_url$upstream" in
    *[!a-zA-Z0-9._~:/-]*) invalid_config ;;
esac

url_origin='https?://[a-zA-Z0-9][a-zA-Z0-9.-]*(:[0-9]{1,5})?'
path='(/[a-zA-Z0-9._~-]+)*'
printf '%s\n' "$endpoint" | grep -Eq "^${path}/?$" || invalid_config
printf '%s\n' "$public_url" | grep -Eq "^${url_origin}${path}/?$" || invalid_config
printf '%s\n' "$upstream" | grep -Eq "^${url_origin}${path}/?$" || invalid_config

base="${endpoint%/}/"
public_url=${public_url%/}
# Use the container path when only the public host is configured.
case "${public_url#*://}" in
    */*) public_url="${public_url}/" ;;
    *) public_url="${public_url}${base}" ;;
esac
case "$base $public_url" in
    */./*|*/../*) invalid_config ;;
esac

{
    cat <<EOF
server {
    listen 80;
    server_name _;
    absolute_redirect off;
    client_max_body_size 64m;

    location ${base} {
        alias /usr/share/nginx/homefix/;
        index index.html;
    }

    location ^~ ${base}api/v1/ {
        proxy_pass ${upstream%/}/;
        proxy_ssl_server_name on;
        proxy_ssl_verify on;
        proxy_ssl_trusted_certificate /etc/ssl/certs/ca-certificates.crt;
        proxy_ssl_verify_depth 3;
        proxy_set_header Origin "";
        proxy_set_header Referer "";
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_cookie_domain ~.+ \$host;
        proxy_cookie_path ~^/.*\$ ${base};
    }
EOF

    if [ "$base" != / ]; then
        cat <<EOF

    location = ${base%/} {
        return 308 ${base}\$is_args\$args;
    }

    location / {
        return 404;
    }
EOF
    fi

    printf '}\n'
} > /etc/nginx/conf.d/default.conf

printf '%s\n' "$public_url" > /run/homefix-frontend-url
