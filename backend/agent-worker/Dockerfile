# ─── Rigup · agent-worker ───────────────────────────────────
FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 8090

HEALTHCHECK --interval=15s --timeout=5s --retries=5 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8090/health || exit 1

CMD ["node", "src/index.js"]
