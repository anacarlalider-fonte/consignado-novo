# Runbook de Operacao - RealSynk Consignado

## 1. Objetivo

Padronizar a operacao do CRM para garantir continuidade comercial, qualidade do atendimento e rastreabilidade.

## 2. Perfis e responsabilidades

- **Admin CRM**
  - gerir usuarios, perfis e permissoes
  - validar backups e ambiente
  - atuar em incidentes tecnicos
- **Gestor Comercial**
  - acompanhar KPIs e funil
  - priorizar pedidos criticos
  - cobrar execucao das rotinas
- **Atendimento/Vendas**
  - atualizar etapas e follow-ups
  - registrar andamento dos casos
  - executar rotina diaria de contato

## 3. Startup do ambiente

1. Subir infraestrutura:
   - `docker compose up -d`
2. Backend:
   - `cd backend`
   - `npm install`
   - `npx prisma generate`
   - `npx prisma migrate dev --name init`
   - `npm run prisma:seed`
   - `npm run dev`
3. Frontend:
   - `cd frontend`
   - `npm install`
   - `npm run dev`
4. Validar API:
   - `GET /api/health`
5. Login inicial:
   - usuario: `admin@kato.com`
   - senha: `Admin@123`
   - **trocar imediatamente**

## 4. Checklist de abertura (inicio do dia)

- verificar acesso ao sistema (frontend + backend)
- conferir dashboard:
  - pedidos criticos
  - valor a faturar
  - follow-ups pendentes
- revisar agenda de follow-up do dia
- distribuir prioridade por responsavel

## 5. Rotina operacional diaria

### 5.1 Leads
- registrar novos leads
- preencher origem, responsavel e score
- qualificar leads com criterios comerciais

### 5.2 Pipeline
- criar oportunidades qualificadas
- atualizar etapa em cada contato relevante
- registrar evolucao do funil ao longo do dia

### 5.3 Pedidos e Atendimentos
- priorizar urgencia `CRITICO`
- atualizar `Etapa CRM` e `Proximo follow-up`
- evitar registros sem data de retorno

### 5.4 Agenda e Tarefas
- executar retornos programados
- concluir/reabrir tarefas conforme andamento
- manter fila limpa no fechamento do dia

## 6. Automacoes e integracoes

### 6.1 Importacao Google Sheets
- usar modulo `Integracoes`
- informar URL CSV publica da planilha
- executar importacao e validar volume importado

### 6.2 Automacao de follow-up
- executar `Rodar automacao de follow-up` 1 vez ao dia
- revisar pedidos sinalizados e redistribuir

## 7. Fechamento diario

- validar que casos criticos receberam tratativa
- exportar CSV de `Pedidos` e `Relatorios`
- revisar pendencias para o dia seguinte
- registrar observacoes de operacao (se houver)

## 8. Seguranca e acesso

- nunca manter senha padrao em producao
- revisar permissoes por perfil semanalmente
- remover acesso de usuarios inativos
- manter segredos (`JWT_SECRET`, `JWT_REFRESH_SECRET`) atualizados

## 9. Backup e recuperacao

- backup diario do PostgreSQL
- teste de restauracao quinzenal
- manter ultimo backup validado e documentado

## 10. Resposta a incidentes

### 10.1 Sistema indisponivel
- verificar containers (`postgres`, `redis`)
- validar backend (`/api/health`)
- validar frontend
- acionar Admin CRM

### 10.2 Erro de login generalizado
- confirmar expiracao/segredo JWT
- validar status de usuarios no banco
- testar com conta admin

### 10.3 Falha de importacao
- validar URL CSV publica
- conferir formato das colunas
- consultar logs de integracao no banco (`integrationSyncLog`)

## 11. Indicadores minimos de governanca

- taxa de follow-up em dia
- quantidade de pedidos criticos sem contato
- conversao por etapa do pipeline
- tempo medio de resposta por vendedor

## 12. Cadencia de revisao

- **Diaria:** operacao e fila critica
- **Semanal:** performance comercial e permissoes
- **Mensal:** qualidade de dados, melhorias e backlog
