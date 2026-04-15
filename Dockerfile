# Raiz do repo — Render (Docker) costuma procurar aqui.
# O código da API está na pasta backend/.
FROM node:20-bookworm-slim

RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/package*.json ./
COPY backend/prisma ./prisma/

RUN npm ci
# Prisma valida o schema no build e exige a variável existir (Render só injeta no runtime)
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public"
RUN npx prisma generate

COPY backend/ ./

RUN npm run build

ENV NODE_ENV=production

COPY scripts/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]
