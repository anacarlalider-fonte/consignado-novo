# Backlog Fase 1.1 (aprovado)

## EPIC A - Plataforma

- [ ] A1. Criar estrutura monorepo (`frontend`, `backend`, `docs`)
- [ ] A2. Subir `docker-compose` com `postgres` e `redis`
- [ ] A3. Configurar variaveis de ambiente e secrets
- [ ] A4. Definir padrao de logs e tratamento de erro

## EPIC B - Banco e dominio

- [x] B1. Modelar schema inicial Prisma
- [ ] B2. Gerar primeira migration
- [ ] B3. Criar seed de roles e permissoes base
- [ ] B4. Criar seed de pipeline padrao comercial
- [ ] B5. Criar seed inicial de usuarios por perfil

## EPIC C - Seguranca e acesso

- [ ] C1. Implementar login e refresh token
- [ ] C2. Implementar RBAC por endpoint
- [ ] C3. Implementar trilha de auditoria em alteracoes sensiveis

## EPIC D - Navegacao e UX base

- [x] D1. Definir modulos da sidebar
- [ ] D2. Implementar layout shell no frontend
- [ ] D3. Configurar roteamento protegido
- [ ] D4. Criar estado global de sessao do usuario

## EPIC E - Entidades core

- [ ] E1. CRUD Leads
- [ ] E2. CRUD Oportunidades + Etapas
- [ ] E3. CRUD Atividades
- [ ] E4. CRUD Tarefas/Follow-up
- [ ] E5. CRUD Pedidos

## Definicao de pronto da Fase 1

- [ ] Banco com migration aplicada
- [ ] Auth e RBAC operacionais
- [ ] Modulos core criados (API)
- [ ] Sidebar e navegacao base funcionando
