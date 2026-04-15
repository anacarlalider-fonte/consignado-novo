# Backend (Fase 1 Foundation)

Base arquitetural para API do RealSynk Consignado.

## Estrutura prevista

- `src/modules/auth`
- `src/modules/users`
- `src/modules/roles`
- `src/modules/leads`
- `src/modules/opportunities`
- `src/modules/activities`
- `src/modules/tasks`
- `src/modules/orders`
- `src/modules/reports`
- `src/modules/integrations`

## Banco

O schema inicial esta em `prisma/schema.prisma`, com suporte a:

- multi-tenant (`tenantId`)
- RBAC (`roles` e `permissions`)
- funil comercial (`pipeline_stages`, `opportunities`)
- atendimento e follow-up (`activities`, `tasks`)
- pedidos em aberto (`orders`)
- auditoria e logs de integracao

## Proximo passo tecnico

1. Inicializar projeto NestJS
2. Configurar Prisma Client e migrations
3. Criar modulo Auth + Guards de permissao
4. Entregar endpoints CRUD de `leads`, `opportunities` e `orders`

## Endpoints ja disponiveis (Fase 2)

- `GET /api/health`
- `POST /api/auth/login`
- `GET /api/crm/leads`
- `POST /api/crm/leads`
- `GET /api/crm/opportunities`
- `POST /api/crm/opportunities`
- `PATCH /api/crm/opportunities/:id/stage`
- `GET /api/crm/orders`
- `PATCH /api/crm/orders/:pedido`
- `GET /api/reports/summary`
- `POST /api/integrations/google-sheets/import-orders`
- `POST /api/automation/followups/run`

Observacao: os endpoints CRM estao persistindo em PostgreSQL via Prisma.

## Atualizacao

Os endpoints CRM agora usam persistencia Prisma nas tabelas:

- `CrmLead`
- `CrmOpportunity`
- `CrmOrder`

## RBAC e JWT

- `POST /api/auth/login` gera token JWT
- Endpoints `/api/crm/*` exigem token Bearer
- Permissoes verificadas por `PermissionsGuard`

Permissoes usadas:

- `leads:read`, `leads:create`
- `opportunities:read`, `opportunities:create`, `opportunities:update`
- `orders:read`, `orders:update`
- `reports:read`
- `integrations:write`

Para uso inicial, crie usuario/roles/permissoes no banco e associe no relacionamento de RBAC.

## Seed rapido

Depois de aplicar migrations:

- `npm run prisma:seed`

Credenciais criadas:

- email: `admin@kato.com`
- senha: `Admin@123`
