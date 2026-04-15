# Fase 1 - Arquitetura e Banco

## Objetivo

Estabelecer a fundacao tecnica do CRM multiusuario RealSynk Consignado para operacao comercial, prospeccao ativa, atendimento e gestao de pedidos.

## Stack recomendada

- Frontend: React + TypeScript + Vite
- Backend: NestJS (Node.js + TypeScript)
- Banco: PostgreSQL
- ORM: Prisma
- Auth: JWT + Refresh Token
- Jobs: Redis + BullMQ
- Deploy: Docker Compose (dev) e cloud (producao)

## Modulos de dominio

- Auth e Sessao
- Usuarios, Times e Permissoes (RBAC)
- Leads e Prospeccao
- Contas e Contatos
- Oportunidades e Pipeline
- Atividades e Atendimentos
- Tarefas e Follow-up
- Pedidos
- Dashboard e Relatorios
- Integracoes (Google Sheets)

## Sidebar alvo

1. Dashboard
2. Leads
3. Pipeline
4. Atendimentos
5. Agenda/Follow-up
6. Tarefas
7. Clientes
8. Pedidos
9. Relatorios
10. Administracao

## Decisoes tecnicas

- Arquitetura modular para reduzir acoplamento.
- Multi-tenant por `tenant_id` em todas as tabelas de negocio.
- Soft delete em entidades comerciais importantes.
- Auditoria de alteracoes sensiveis via `audit_logs`.
- Permissoes por acao (ex: `orders:update`, `reports:read`).

## Seguranca

- Senhas com hash bcrypt.
- JWT curto + refresh token com rotacao.
- Rate limit em login e endpoints sensiveis.
- Trilha de acesso por usuario.

## Nao funcionais

- API p95 < 500ms para consultas de lista.
- Paginação padrão em todos os endpoints de listagem.
- Observabilidade com logs estruturados.
- Migrations versionadas e replicaveis.

## Entregaveis da Fase 1

- Schema de banco inicial no Prisma.
- Estrutura de modulos backend.
- Estrutura de navegacao do frontend com sidebar.
- Backlog tecnico priorizado para Fase 2 em diante.
