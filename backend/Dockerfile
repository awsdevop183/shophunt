# ShopHunt backend (intentionally vulnerable training target — lab use only).
FROM node:20-alpine
WORKDIR /app

# Install deps first for layer caching.
COPY package.json ./
RUN npm install --omit=dev

# App source.
COPY . .

# Runtime upload dir (mounted as a volume in docker-compose).
RUN mkdir -p /app/uploads

EXPOSE 4000
CMD ["npm", "start"]
