# Deploy na nuvem (Vercel + API + PostgreSQL)

## O que já está pronto no projeto

- `frontend/vercel.json`, `render.yaml`, `DEPLOY.md`, CI no GitHub (`.github/workflows/ci.yml`).
- Duplo-clique em **`PUBLICAR-NUVEM.bat`** na pasta do projeto: cria **Git + primeiro commit**, gera **JWT_SECRET** e **JWT_REFRESH_SECRET** para colar no Render e imprime os comandos `git remote` / `git push`.

**Ninguém pode logar na sua conta Vercel/Render por você** — falta só: criar repo no GitHub, conectar nos painéis e colar as variáveis (uns 10–15 minutos).

---

O **frontend** (Vite) fica na **Vercel**. A **API NestJS** e o **PostgreSQL** precisam de um serviço que rode Node de forma contínua — o modelo usual é **Render**, **Railway** ou **Fly.io**. Os dados da empresa ficam no **banco**; publicar uma nova versão do site **não apaga** o que está no PostgreSQL.

## O que já fica na nuvem hoje

Com login ativo (`VITE_AUTH_ENABLED=true`) e API configurada, o backend persiste **usuários, leads, oportunidades e pedidos** conforme o modelo Prisma. Partes do CRM que ainda usam **apenas o navegador** (localStorage) continuam só naquele computador até o produto passar a sincronizar tudo pela API — o deploy em si não remove dados do banco.

## 1. Banco PostgreSQL

1. Crie um banco gerenciado (ex.: **Render PostgreSQL**, **Neon**, **Supabase**).
2. Copie a connection string (`DATABASE_URL`).

## 2. API (exemplo Render)

1. **New → Web Service**, conecte o mesmo repositório Git.
2. **Root Directory:** `backend`
3. **Build Command:**

   `npm install && npx prisma generate && npm run build && npx prisma migrate deploy`

4. **Start Command:** `npm run start`
5. **Variáveis de ambiente:**

   | Chave | Valor |
   |--------|--------|
   | `DATABASE_URL` | string do Postgres |
   | `JWT_SECRET` | string longa e aleatória |
   | `JWT_REFRESH_SECRET` | outra string longa |
   | `PORT` | deixe vazio (Render define) |
   | `CORS_ORIGINS` | URLs do front, separadas por vírgula (ex.: `https://seu-projeto.vercel.app`) |

6. Após o primeiro deploy com banco vazio, abra **Shell** no serviço e execute:

   `npx prisma db seed`

   Isso cria o usuário de teste **admin@kato.com** / **Admin@123** (troque a senha em produção).

7. Teste no navegador: `https://SUA-API.onrender.com/api/health` → deve retornar JSON com `status: "ok"`.

## 3. Frontend na Vercel

1. **Import Project** no [Vercel](https://vercel.com), mesmo repositório.
2. **Root Directory:** `frontend`
3. **Environment Variables** (em *Settings → Environment Variables*), para **Production** (e Preview se quiser):

   | Nome | Valor |
   |------|--------|
   | `VITE_API_BASE_URL` | `https://SUA-API.onrender.com/api` (URL real da API, **com** `/api` no final) |
   | `VITE_AUTH_ENABLED` | `true` |

4. Faça um novo deploy após salvar as variáveis (elas entram no **build**).

O arquivo `frontend/vercel.json` já configura o roteamento SPA.

## 4. Atualizações sem perder dados

- **Novo deploy do frontend (Vercel):** só troca arquivos estáticos; **não** apaga o Postgres.
- **Novo deploy da API:** rode de novo `npx prisma migrate deploy` no build (como no comando acima) para aplicar migrações; dados existentes permanecem, salvo se uma migração explicitamente alterar/remover colunas (evite remover colunas em produção sem plano de migração de dados).

## 5. Domínio próprio (opcional)

- Vercel: *Project → Settings → Domains*.
- Render: domínio custom no Web Service.
- Atualize `CORS_ORIGINS` na API com o domínio exato do front (incluindo `https://`).

## Arquivo `render.yaml`

Na raiz do repositório há um blueprint de exemplo para Render. Você pode ajustar região/nomes e usar **Blueprints** no painel do Render para criar banco + API de uma vez; defina `JWT_SECRET`, `JWT_REFRESH_SECRET` e `CORS_ORIGINS` manualmente quando o painel pedir.
