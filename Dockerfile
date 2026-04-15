# Raiz do repo — Render (Docker) costuma procurar aqui.
# O código da API está na pasta backend/.
FROM node:20-bookworm-slim

RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/package*.json ./
COPY backend/prisma ./prisma/

RUN npm ci
RUN npx prisma generate

COPY backend/ ./

RUN npm run build

ENV NODE_ENV=production

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
