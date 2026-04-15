# Checklist — continuar configuração (Vercel + Render)

Use nesta ordem. Repo GitHub: **`anacarlalider-fonte/consignado-novo`** (já pode estar ligado na Vercel).

---

## A — API e banco (Render) — faça primeiro

1. Acesse [dashboard.render.com](https://dashboard.render.com) e faça login.

2. **PostgreSQL** (se ainda não tiver):
   - **New → PostgreSQL** → crie a instância → copie **Internal Database URL** ou **External** (connection string).
   - Essa string vai na variável **`DATABASE_URL`** do serviço web.

3. **Web Service** (API Nest):
   - **New → Web Service** → conecte o repositório **`consignado-novo`**.
   - **Root Directory:** `backend`
   - **Build Command:**
     ```text
     npm install && npx prisma generate && npm run build && npx prisma migrate deploy
     ```
   - **Start Command:** `npm run start`

4. **Environment** (Environment → Environment Variables) do Web Service:

   | Variável | Valor |
   |----------|--------|
   | `DATABASE_URL` | Cole a connection string do Postgres (Render ou Neon). |
   | `JWT_SECRET` | String longa aleatória (pode gerar com `PUBLICAR-NUVEM.bat`). |
   | `JWT_REFRESH_SECRET` | Outra string longa, diferente da anterior. |
   | `NODE_ENV` | `production` |
   | `CORS_ORIGINS` | Por enquanto: `https://project-consignado.vercel.app` (ajuste para a URL **exata** que a Vercel mostrar no projeto, incluindo `https://`). Se tiver mais de um domínio, separe com vírgula **sem espaço**. |

   Não defina `PORT` manualmente no Render (eles injetam).

5. Salve e espere o deploy terminar.

6. **Shell** do Web Service (aba **Shell** no painel) — **uma vez**, com banco vazio:
   ```text
   npx prisma db seed
   ```
   Login padrão do seed: **admin@kato.com** / **Admin@123** (troque depois em produção).

7. **Teste no navegador** (troque pelo host real da API):
   ```text
   https://SEU-SERVICO.onrender.com/api/health
   ```
   Deve aparecer JSON com `"status":"ok"`.

   Anote a URL base do serviço, por exemplo: `https://crm-consignado-api.onrender.com`

---

## B — Frontend (Vercel) — depois que a API responder `/api/health`

1. Projeto **project-consignado** → **Settings → General**:
   - **Root Directory:** `frontend`  
     (obrigatório neste monorepo.)

2. **Settings → Environment Variables** (ambiente **Production**):

   | Nome | Valor |
   |------|--------|
   | `VITE_API_BASE_URL` | `https://SEU-SERVICO.onrender.com` **ou** `https://SEU-SERVICO.onrender.com/api` (os dois funcionam; o app completa `/api` se faltar). |
   | `VITE_AUTH_ENABLED` | `true` |

3. **Deployments** → nos três pontinhos do último deploy → **Redeploy** (marque **Use existing Build Cache** desmarcado / “rebuild” se existir), para o Vite pegar as variáveis.

4. Abra a URL do site (ex.: `https://project-consignado.vercel.app`), faça login com **admin@kato.com** / **Admin@123**.

---

## C — Ajuste final de CORS

Se o login ou as listagens derem erro de rede / CORS:

1. Copie a URL **exata** do site na barra do navegador (com `https://`, sem barra no final).
2. No Render, no Web Service da API, edite **`CORS_ORIGINS`** com essa URL (e a de Preview da Vercel, se usar).
3. **Manual Deploy** da API de novo.

---

## D — Atualizações no dia a dia

- **Só código front:** `git push` → a Vercel faz deploy automático.
- **Só código API:** `git push` → o Render rebuilda; migrações rodam no **Build Command** (`migrate deploy`).
- Dados no **Postgres** não somem com deploy do front.

---

## Problemas comuns

| Sintoma | O que conferir |
|---------|----------------|
| Tela branca ou 404 em rotas | Root Directory na Vercel = **`frontend`**. |
| Login não chama a API | `VITE_API_BASE_URL` e **Redeploy** após salvar env. |
| CORS no console | `CORS_ORIGINS` na API = URL exata do front. |
| API 502 / sleep (plano grátis) | Primeiro acesso após inatividade pode demorar ~1 min. |

Mais detalhes: `DEPLOY.md`.
