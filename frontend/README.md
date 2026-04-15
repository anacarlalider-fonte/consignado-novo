# Frontend (Fase 2+)

Aplicacao React do RealSynk Consignado com login, RBAC na navegacao e modulos operacionais.

## Sidebar

Configurada em `src/sidebar-config.ts` com os modulos:

- Dashboard
- Leads
- Pipeline
- Atendimentos
- Agenda/Follow-up
- Tarefas
- Clientes
- Pedidos
- Relatorios
- Integracoes
- Administracao

## Ja implementado

1. Login com token JWT e sessao local
2. Sidebar filtrada por permissao do usuario
3. Rotas protegidas por permissao
4. Modulos funcionais:
   - Dashboard
   - Leads (filtro e criacao)
   - Pipeline (kanban + mudanca de etapa)
   - Pedidos (atualizacao de etapa e follow-up)
   - Relatorios (summary da API)
   - Integracoes (import Google Sheets + automacao follow-up)
   - Atendimentos (fila operacional)
   - Agenda/Follow-up (retornos por data)
   - Tarefas (gestao diaria da equipe)
   - Clientes (visao consolidada)
   - Administracao (sessao e permissoes do usuario)

## Proximo passo tecnico

1. Conectar telas restantes (`Atendimentos`, `Agenda`, `Tarefas`, `Clientes`, `Admin`) na API
2. Criar toasts/feedback global de erro/sucesso
3. Adicionar testes de integracao de fluxo comercial
