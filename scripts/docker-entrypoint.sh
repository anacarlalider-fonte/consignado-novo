#!/bin/sh
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "ERRO: DATABASE_URL nao definida."
  echo "No Render: Web Service -> Environment -> crie DATABASE_URL com a URL INTERNA do Postgres (Conectar)."
  exit 1
fi

# URLs externas *.render.com costumam precisar de SSL explicito para o Prisma
append_sslmode() {
  url="$1"
  case "$url" in *sslmode=*|*ssl=true*) printf '%s' "$url"; return ;; esac
  case "$url" in
    *\?*) printf '%s' "${url}&sslmode=require" ;;
    *) printf '%s' "${url}?sslmode=require" ;;
  esac
}

case "$DATABASE_URL" in
  *.render.com*) export DATABASE_URL="$(append_sslmode "$DATABASE_URL")" ;;
esac

echo "Executando prisma migrate deploy..."
npx prisma migrate deploy

echo "Iniciando API na porta ${PORT:-3001}..."
exec node dist/main.js
