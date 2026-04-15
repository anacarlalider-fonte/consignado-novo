# Imagem para Render quando o serviço está como "Docker" (Root Directory = backend)
FROM node:20-bookworm-slim

RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci
RUN npx prisma generate

COPY . .
RUN npm run build

ENV NODE_ENV=production

# Render define PORT; Nest usa process.env.PORT
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
