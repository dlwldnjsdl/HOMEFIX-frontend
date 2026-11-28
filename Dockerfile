# syntax=docker/dockerfile:1
FROM --platform=$BUILDPLATFORM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json vite.config.ts index.html ./
COPY src/ ./src/
COPY public/ ./public/
RUN npm run build -- --base=./

# Buildx selects the target architecture. This stage runs no build commands.
FROM nginx:stable-alpine
ENV NGINX_ENDPOINT=/test
COPY --from=build /app/dist/ /usr/share/nginx/homefix/
COPY --chmod=755 docker/configure-nginx.sh /docker-entrypoint.d/40-configure-homefix.sh

HEALTHCHECK --interval=5s --timeout=3s --start-period=5s --retries=3 \
    CMD endpoint="${NGINX_ENDPOINT:-/test}"; wget -q -O /dev/null "http://127.0.0.1${endpoint%/}/"
