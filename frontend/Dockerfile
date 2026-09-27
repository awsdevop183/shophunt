# ShopHunt frontend — Vite React SPA (intentionally vulnerable target, lab only).
# Multi-stage: build with Node, serve static with nginx.
# NOTE: source maps ARE emitted and shipped (recon lab in a later phase).

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
# Build-time public config baked into the bundle.
ARG VITE_API_BASE=http://localhost:4000
ARG VITE_ANALYTICS_KEY=sh_live_pk_dev
ENV VITE_API_BASE=$VITE_API_BASE
ENV VITE_ANALYTICS_KEY=$VITE_ANALYTICS_KEY
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
