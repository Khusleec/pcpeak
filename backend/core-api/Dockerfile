# ─── Rigup · core-api ───────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

# install deps first for better layer caching
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

# copy source
COPY . .

ENV NODE_ENV=production
EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --retries=5 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/api/health || exit 1

CMD ["node", "src/index.js"]
