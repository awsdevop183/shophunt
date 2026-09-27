# Mock cloud metadata service — tiny, dependency-free Node HTTP server.
# See server.js for the full isolation/safety rationale.
FROM node:20-alpine
WORKDIR /app
COPY server.js ./
# Listens on :80 inside the isolated metadata_net (not published to host).
EXPOSE 80
USER node
CMD ["node", "server.js"]
