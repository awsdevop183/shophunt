# ShopHunt frontend (intentionally vulnerable training target — lab use only).
# Phase 1: serves a static placeholder. Phase 2 replaces this with a Vite React
# SPA build (multi-stage: node build -> nginx serve, keeping source maps for the
# info-disclosure recon lab).
FROM nginx:alpine

# Build args are accepted now so docker-compose stays valid; the Phase 2 build
# will consume VITE_API_BASE / VITE_ANALYTICS_KEY.
ARG VITE_API_BASE
ARG VITE_ANALYTICS_KEY

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/index.html

EXPOSE 80
