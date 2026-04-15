# RealSynk Consignado

Repositorio de evolucao do CRM comercial (consignado).

## O que ja existe

### 1) Prototipo operacional local

- `index.html`
- `styles.css`
- `app.js`

Esse prototipo permite acompanhar pedidos em aberto e registrar atendimento/follow-up por pedido.

### 2) Foundation da Fase 1 (arquitetura e banco)

- `docs/fase1-arquitetura.md`: proposta tecnica da arquitetura
- `backend/prisma/schema.prisma`: modelo de dados inicial multiusuario
- `frontend/src/sidebar-config.ts`: configuracao dos modulos da sidebar
- `BACKLOG_FASE1.md`: backlog tecnico priorizado

## Proximo passo sugerido

Implementar o scaffold executavel completo com:

1. NestJS + Prisma no backend
2. React + rotas protegidas no frontend
3. Auth + RBAC
4. CRUD de Leads, Oportunidades e Pedidos

## Fase 1.2 entregue

Foi adicionada a base executavel em arquivos para:

- `backend/package.json` + `src/main.ts` + modulos iniciais
- `backend/prisma/schema.prisma` (modelo robusto)
- `frontend/package.json` + app React com sidebar e rotas base
- `docker-compose.yml` (PostgreSQL + Redis)

## Como rodar localmente

1. Instalar Node.js 20+ (com npm) na maquina.
2. Subir infraestrutura:
   - `docker compose up -d`
3. Backend:
   - copiar `backend/.env.example` para `.env`
   - `cd backend`
   - `npm install`
   - `npx prisma generate`
   - `npx prisma migrate dev --name init`
   - `npm run prisma:seed`
   - `npm run dev`
4. Frontend:
   - `cd frontend`
   - `npm install`
   - `npm run dev`

## Login padrao (seed)

- usuario: `admin@kato.com`
- senha: `Admin@123`
