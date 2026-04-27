# Context Pack — Refatoracao Reagentes v2

Pacote de contexto enxuto para o `architect` desenhar o contrato. Sem solucao, sem codigo, sem SQL final — apenas mapa do que existe e onde dolera mexer.

---

## Resumo do problema

Refatorar a aba de Reagentes para um modelo padrao-ouro de cadastro de lote:
- Substituir o campo livre `name` pelo conceito de **etiqueta** (combobox de etiquetas existentes + opcao "+ Criar nova etiqueta").
- Reduzir o cadastro obrigatorio a 9 campos canonicos (etiqueta, lote, fabricante, categoria, quantidade, status, validade, localizacao, temperatura). Demais campos viram opcionais ou sao removidos.
- Substituir o conjunto de status `{ativo, em_uso, inativo, vencido, quarentena}` pelo conjunto novo `{em_estoque, em_uso, fora_de_estoque, vencido}`, com regras de transicao redefinidas.
- Tornar a visao **etiquetas** o modo padrao da aba (substituindo a lista atual como secundaria).
- Cada card identifica o lote por `Lote {n} . {fabricante}` (substituindo o uso atual de `name` como cabecalho).
- Remover dashboard de baixo estoque/risco de ruptura, simplificando a tela.

Conceitos protegidos pelo CLAUDE.md envolvidos: **lote**, **status de CQ**, **registro de medicao** (rastreabilidade ANVISA RDC 302 / ISO 15189). Toda transicao automatica de status precisa continuar gerando trilha de auditoria.

---

## Classificacao

- Tamanho: **grande** (toca entidade, DB, DTOs, mapper, service, scheduler, reports v2, frontend completo da aba, voice modal, csv export, testes Java + RTL).
- Criticidade: **critica** (status de lote alimenta scheduler diario, reports regulatorios e politica `canReceiveEntry`; alterar enum sem mapeamento determinístico quebra historico).

---

## Fonte de verdade (precedencia)

1. Codigo ativo em Java/React no commit atual `5dfbf87 reagente`. Esse commit modificou o conjunto reagentes mais recentemente; e referencia para todo simbolo citado abaixo.
2. `transicao-java/DECISOES-REAGENTES.md` (REAG-ADR-001, datado 2026-04-26) — congela invariantes de `inativo`, `vencido`, `quarentena` e politica `canReceiveEntry`. Esta refatoracao **substitui parcialmente** este ADR (precisa ser explicitado pelo architect; nao excluir o doc — citar como historico).
3. Migracoes Flyway aplicadas (V1, V5, V7) — definem o estado atual da tabela.

Nao ha referencia em `tudo para a transicao/` ou `cursor-bio-compulabxsimus/` que conflite com o cenario aprovado.

---

## Primary context (max 8 arquivos, ordem de leitura)

1. `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/main/java/com/biodiagnostico/entity/ReagentLot.java` — entidade ativa, todas as colunas (incluindo as que vao sair); ground truth do modelo Java.
2. `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/main/java/com/biodiagnostico/entity/ReagentStatus.java` — enum-like com os 5 valores atuais; sera substituido (ou semanticamente remapeado) pelo novo conjunto de 4.
3. `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/main/java/com/biodiagnostico/service/ReagentService.java` — contem `createLot` (linhas 142-181), `updateLot` (183-232), `deleteLot` (234-269), `createMovement` (283-368), `deriveStatus` (466-483), `applyDerivedStatus` (501-516) e `applyDerivedStatusFromScheduler` (527-540). Toda regra de transicao automatica vive aqui.
4. `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/main/java/com/biodiagnostico/repository/ReagentLotRepository.java` — `findTagSummaries` (linhas 110-122 — agrega por `name`), `findExpiredNeedingReclassification`, `findExpiredWithStock`, `findByLotNumberAndManufacturer`. Projection inline `ReagentTagSummaryProjection` cita `ativos/emUso/inativos/vencidos`.
5. `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/main/java/com/biodiagnostico/util/ResponseMapper.java` — `toReagentLotResponse` (linhas 149-208) preenche `daysLeft`, `stockPct`, `daysToRupture`, `nearExpiry`, `traceabilityIssues`, `canReceiveEntry`, `allowedMovementTypes`, `movementWarning`. Pega cada campo da entidade que sera removido (`quantityValue`, `stockUnit`, `estimatedConsumption`, `startDate`, `endDate`, `alertThresholdDays`).
6. `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-web/src/components/proin/ReagentesTab.tsx` — orquestra a aba inteira. `handleOpenEdit` (120-143) carrega o form atual; `viewMode` default `list` (62) precisa virar `tags`. Inclui mapa do `dashFilter` com os tipos `lowStock` e `ruptureRisk` que saem.
7. `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-web/src/components/proin/reagentes/ReagentModals.tsx` — form de cadastro. Hoje tem 4 secoes (Identificacao, Estoque, Validade e Datas, Rastreabilidade) que serao refeitas para se alinhar com os 9 campos obrigatorios + colapsavel "Detalhes adicionais".
8. `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/test/java/com/biodiagnostico/service/ReagentServiceTest.java` — bateria de 50+ testes que codifica o comportamento atual de derivacao, audit trail e bloqueios; serve de baseline regressivo para o backend novo.

---

## Secondary context

- `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/main/java/com/biodiagnostico/dto/request/ReagentLotRequest.java` — payload de entrada (15 campos, varios sairao).
- `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/main/java/com/biodiagnostico/dto/response/ReagentLotResponse.java` — response com 25+ campos derivados.
- `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/main/java/com/biodiagnostico/dto/response/ReagentTagSummary.java` — projection consumida pelo frontend e pelo generator de reagentes; campos `ativos/emUso/inativos/vencidos` serao renomeados.
- `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/main/java/com/biodiagnostico/scheduler/ReagentExpiryScheduler.java` — depende de `applyDerivedStatusFromScheduler` e de `findExpiredNeedingReclassification`.
- `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/main/java/com/biodiagnostico/controller/ReagentController.java` — define endpoints atuais; `/api/reagents/tags` vira candidato a `/labels`; `/export/csv` (linhas 109-134) imprime colunas obsoletas (`stockUnit`, `estimatedConsumption`, `quantityValue`).
- `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/main/java/com/biodiagnostico/service/AuditService.java` — `log(action, entityType, entityId, details)` (38) ja usado por `ReagentService.recordStatusTransition`. A migracao V13 deve emitir audit_log usando esta mesma estrutura ou inserir registros direto via SQL.
- `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/main/java/com/biodiagnostico/service/reports/v2/generator/impl/ReagentesRastreabilidadeGenerator.java` — gera PDF assinado (rastreabilidade). Usa `lot.getStatus()` cru (linhas 129-133) e contagens `ativo/inativo/vencido com estoque`.
- `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/main/java/com/biodiagnostico/service/reports/v2/generator/impl/MultiAreaConsolidadoGenerator.java` — usa `reagentLotRepository.countExpiredWithStock(today)` (144) — KPI vai sobreviver porque o conceito "vencido com estoque" continua valido.
- `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/main/java/com/biodiagnostico/service/reports/v2/generator/ai/ReportAiPrompts.java` — prompts citam "reagentes vencidos" — texto literal nao precisa mudar, mas vale revalidar.
- `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/main/java/com/biodiagnostico/service/PdfReportService.java` — gera PDF v1 (`generateReagentsReport`, linha 121); cabecalhos `Etiqueta, Lote, Fabricante, Status, Validade, Estoque, Dias` ja citam "Etiqueta", entao só precisa revalidar enum de status.
- `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/main/java/com/biodiagnostico/service/DashboardService.java` — `expiringReagents` (linhas 82-85) e `countExpiringLots` (112) — sobrevivem.
- `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/main/java/com/biodiagnostico/repository/QcRecordRepository.java` linhas 133, 144 — `findActiveLotNumbersSince` e `existsByLotNumberOperational`. Continuam usando `lot_number`, nao `name`. Precisa explicitamente sobreviver a refatoracao.
- `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/main/java/com/biodiagnostico/config/DatabaseIndexInitializer.java` — cria index unico em `(lot_number, COALESCE(manufacturer,''))`. Sem impacto direto, mas o architect deve confirmar que continua valido.
- `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/main/resources/db/migration/V1__baseline_schema.sql` (203-222), `V5__reagent_traceability_fields.sql`, `V7__reclassify_expired_empty_lots_to_inativo.sql`, `V2__add_previous_stock_column.sql` — historia da tabela.
- `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-web/src/types/index.ts` linhas 206-261, 337-344 — `ReagentLot`, `ReagentLotRequest`, `ReagentTagSummary`. Precisa enxugar.
- `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-web/src/services/reagentService.ts` — chamada de `getTagSummaries` (linhas 45-48) consumindo `/api/reagents/tags`. Eventual rota nova precisa de retrocompatibilidade ou cliente novo.
- `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-web/src/hooks/useReagents.ts` — `queryKey ['reagents', category, status]` (linha 7). Filtro por `status` precisa aceitar valores novos.
- `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-web/src/components/proin/reagentes/constants.ts` — `MOVEMENT_REASONS`, `CATEGORIES`, `UNITS`, `TEMPS`, `TAG_STATUS_TABS` (linha 27 — abas de etiqueta usando os status antigos). `UNITS` fica orfa apos remover `stockUnit`.
- `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-web/src/components/proin/reagentes/utils.ts` — `createEmptyLotForm`, `buildReagentStats` (linhas 106-122 — incluem `lowStock`, `noTraceability`, `expired==='vencido'`), `filterReagentLots` (142-218 — varias regras dependem de `quantityValue`, `daysToRupture`, `dashFilter='lowStock'/'ruptureRisk'`).
- `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-web/src/components/proin/reagentes/schemas.ts` — validacao zod do form atual (linha 33: `name` ainda obrigatorio).
- `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-web/src/components/proin/reagentes/ReagentsContent.tsx` — header de card usa `<h4>{lot.name}</h4>` (linhas 331, 505) — sera substituido por `Lote {n} . {fabricante}`.
- `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-web/src/components/proin/reagentes/ReagentsDashboard.tsx` — cartoes `lowStock` e `ruptureRisk` (linhas 95-102, 39-47).
- `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-web/src/components/proin/reagentes/ReagentsFilters.tsx` — select de status (88-99) com 5 opcoes antigas; combobox de fabricantes ja existente (uso de `Combobox`) sera reutilizado para etiqueta.
- `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-web/src/components/proin/VoiceRecorderModal.tsx` — `setLotForm` no callback de `onApply` mapeia `data.name`, `data.lot_number`, `data.expiry_date`, `data.manufacturer`. Como `name` vira etiqueta combobox, o mapeamento muda (auto-criar etiqueta? ou ignorar?).
- `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/test/java/com/biodiagnostico/controller/ReagentControllerTest.java`, `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/test/java/com/biodiagnostico/scheduler/ReagentExpirySchedulerTest.java`, `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/test/java/com/biodiagnostico/service/reports/v2/generator/impl/ReagentesRastreabilidadeGeneratorTest.java`, `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-web/src/components/proin/ReagentesTab.test.tsx` — bateria que precisa ser ajustada simetricamente.

---

## Symbol map

### Backend Java
- Entidade: `ReagentLot` (campos relevantes: `id`, `name`, `lotNumber`, `manufacturer`, `category`, `expiryDate`, `quantityValue`, `stockUnit`, `currentStock`, `estimatedConsumption`, `storageTemp`, `startDate`, `endDate`, `status`, `alertThresholdDays`, `location`, `supplier`, `receivedDate`, `openedDate`).
- Constantes: `ReagentStatus.{ATIVO, EM_USO, INATIVO, VENCIDO, QUARENTENA}` + `ReagentStatus.normalize`, `isValid`, `humanList`.
- DTOs: `ReagentLotRequest` (record), `ReagentLotResponse` (record), `ReagentTagSummary` (record com `name, total, ativos, emUso, inativos, vencidos`).
- Repository: `ReagentLotRepository.findTagSummaries`, `findByLotNumberAndManufacturer`, `findExpiredNeedingReclassification`, `findExpiringLots`, `findExpiringInWindow`, `findExpiredWithStock`, `countExpiredWithStock`, `countExpiringLots`.
- Repository auxiliar: `QcRecordRepository.findActiveLotNumbersSince`, `existsByLotNumberOperational` (key: ambos usam **lotNumber**, nao `name`).
- Service: `ReagentService.{getLots, createLot, updateLot, deleteLot, createMovement, deleteMovement, getMovements, getByLotNumber, getExpiringLots, getTagSummaries, deriveStatus, applyDerivedStatus(*)}`. Constantes de auditoria: `AUDIT_ACTION_STATUS_DERIVED`, `AUDIT_ACTION_MOVEMENT_BLOCKED`, `AUDIT_ACTION_LOT_ARCHIVED`, `AUDIT_ACTION_DELETE_BLOCKED`. Triggers: `createLot`, `updateLot`, `movement`, `scheduler`. Para a refatoracao, novo trigger sera `quarentena_removed_v2` (e potencialmente `migration_v13`).
- Mapper: `ResponseMapper.toReagentLotResponse(ReagentLot, boolean)`, `reagentTraceabilityIssues`.
- Scheduler: `ReagentExpiryScheduler.markExpiredLots` (cron diario `0 0 1 * * *`).
- Controller: `ReagentController` rotas `/api/reagents`, `/api/reagents/{id}`, `/api/reagents/{id}/movements`, `/api/reagents/movements/{movId}`, `/api/reagents/by-lot-number`, `/api/reagents/expiring`, `/api/reagents/tags`, `/api/reagents/export/csv`. Endpoint novo previsto: `/api/reagents/labels` (GET para combobox).
- Reports v2: `ReagentesRastreabilidadeGenerator`, `MultiAreaConsolidadoGenerator` (KPI `countExpiredWithStock`), `RegulatorioPacoteGenerator` (validar — `grep` nao encontrou referencia direta a status), `ReportDefinitionRegistry.REAGENT_CATEGORIES` (linhas 29-33), `ReportAiPrompts` (prompts textuais).
- AuditService: `log(action, entityType, entityId, Map<String,Object>)`. AuditLog table consumida com `details` JSON.

### Frontend
- Types: `ReagentLot`, `ReagentLotRequest`, `ReagentTagSummary`, `StockMovementRequest`, `MovementReason`.
- Service: `reagentService.{getLots, createLot, updateLot, deleteLot, getMovements, createMovement, deleteMovement, getByLotNumber, getExpiring, getTagSummaries, exportCsv}` + `getLabels` (novo).
- Hooks: `useReagentLots`, `useCreateReagentLot`, `useUpdateReagentLot`, `useDeleteReagentLot`, `useReagentMovements`, `useCreateStockMovement`. queryKey `['reagents', category, status]`. Considerar `['reagent-labels']`.
- Componentes: `ReagentesTab`, `ReagentsDashboard`, `ReagentsFilters`, `ReagentsContent`, `ReagentLotModal`, `ReagentMovementModal`, `VoiceRecorderModal`.
- Utilitarios: `createEmptyLotForm`, `buildReagentStats`, `filterReagentLots`, `getLotVisualState`, `getTraceabilityIssues`, `getTraceabilityIssueLabels`, `canReceiveEntry`, `buildManufacturerOptions`. `DashFilter`, `ReagentSortMode`, `ReagentViewMode`.
- Constantes: `MOVEMENT_REASONS`, `CATEGORIES`, `UNITS` (orfa pos-refatoracao), `TEMPS`, `TAG_STATUS_TABS`.
- Validacao: `validateLotForm`, `validateMovementForm` (zod).
- Testes: `ReagentesTab.test.tsx` cobre busca, validacao de fabricante, motivo em saida zerada, bloqueio de saida acima do estoque, lote inativo em modo ajuste, arquivamento via lista, alternancia para visao etiquetas.

### Banco de dados
- Tabela `reagent_lots` (V1 + V5 + V7 atual). Indice unico em `(lot_number, COALESCE(manufacturer, ''))` (criado por `DatabaseIndexInitializer`).
- Tabela `audit_log` (consumida via `AuditService`).
- Tabela `qc_records` — coluna `lot_number` (NAO `reagent_lot_id`); o vinculo entre QC e reagente e via string. **Nao tocar.**

---

## Contract surfaces

- **HTTP/JSON**:
  - `POST /api/reagents` body `ReagentLotRequest` — campos atuais hoje obrigatorios pelo bean validation: `name`, `lotNumber`, `manufacturer`, `expiryDate`. Vai virar contrato novo.
  - `PUT /api/reagents/{id}` mesmo body.
  - `GET /api/reagents` query `category`, `status` (status filtra por valor cru — precisa aceitar novos valores).
  - `GET /api/reagents/tags` retorna `ReagentTagSummary[]`. **Renomear para `/api/reagents/labels` ou manter alias?** — ver "Pontos de atrito".
  - `GET /api/reagents/by-lot-number?lotNumber=` — sobrevive.
  - `GET /api/reagents/expiring?days=` — sobrevive.
  - `GET /api/reagents/export/csv` — colunas mudam (perde `Estoque`/`Unidade`/`Consumo/Dia`, ganha `Localizacao`).
  - **Novo provavel**: `GET /api/reagents/labels` para popular combobox de etiqueta no cadastro (lista de strings unicas, possivelmente com contagem).

- **Tipos TS**: `ReagentLot.status` muda para `'em_estoque' | 'em_uso' | 'fora_de_estoque' | 'vencido' | string`. `ReagentLotRequest` perde `quantityValue`, `stockUnit`, `estimatedConsumption`, `startDate`, `endDate`, `alertThresholdDays`. `ReagentTagSummary` muda chaves agregadas.

- **Entidade JPA**: colunas `quantity_value`, `stock_unit`, `estimated_consumption`, `start_date`, `end_date`, `alert_threshold_days` saem. Nova migracao V13 droppa colunas + reclassifica statuses + grava audit_log. **Atencao**: drop de coluna em Postgres em producao pode bloquear leitura concorrente; politica precisa ser validada.

- **Audit log**: `details` JSON usa chaves `from`, `to`, `trigger`, `expiryDate`, `currentStock` (formato definido em `ReagentService.recordStatusTransition`). V13 deve seguir o mesmo shape para nao quebrar consultas existentes.

- **Reports v2 ja gerados**: PDFs com SHA-256 assinados pelo `ReportNumberingService` referenciam labels `Ativos`, `Vencidos c/ estoque`, `Inativos`. **Sao imutaveis** — nao retroagir; novos PDFs usarao labels novas (`Em estoque`, `Em uso`, `Fora de estoque`, `Vencido`).

- **CSV export**: header atual `"Nome,Lote,Categoria,Fabricante,Validade,Dias Restantes,Estoque Atual,Unidade,Consumo/Dia,Temperatura,Status"` (ReagentController:116). Vai mudar.

---

## Business rules and invariants

Que NAO podem quebrar (CLAUDE.md: lote, status de CQ, registro de medicao):

1. **lot_number imutavel como chave operacional**: `usedInQcRecently` consome `lot_number` (via `findActiveLotNumbersSince`). Permanece como esta. **Importante**: `qc_records.lot_number` e `reagent_lots.lot_number` sao independentes (string), nao FK. Refatoracao nao toca.
2. **Indice unico (lot_number, manufacturer)**: deduplicacao no cadastro continua valida (`findByLotNumberAndManufacturer`).
3. **Auditoria de transicao de status**: toda transicao (manual ou derivada) escreve em `audit_log` com `action=REAGENT_STATUS_DERIVED` e `details.trigger`. Migracao V13 deve emitir audit_log para cada lote em quarentena reclassificado, com `trigger=quarentena_removed_v2`.
4. **Politica `canReceiveEntry`**: hoje, `inativo` nao aceita ENTRADA; bloqueio gera `AUDIT_ACTION_MOVEMENT_BLOCKED`. No modelo novo, `vencido` (validade < hoje) nao deveria aceitar ENTRADA tampouco — precisa validar com architect. `fora_de_estoque` ACEITA ENTRADA (transiciona para `em_uso`).
5. **Quarentena removida**: lotes esquisitos (`quarentena + estoque=0 + openedDate=null + dentro da validade`) viram `fora_de_estoque` (escolha conservadora descrita no cenario aprovado).
6. **deleteLot preserva historico**: lotes com movimentacao ou uso em CQ nunca sao apagados fisicamente; vai virar `fora_de_estoque` ou status terminal equivalente — politica precisa ser revista (porque `inativo` deixa de existir).
7. **Reports v2 assinados sao imutaveis**: nao retroagir em PDFs ja gerados — novo `report_run` carrega labels novas.
8. **Trigger automatica vencido por validade**: a regra `expiry < hoje => vencido (independente de estoque/abertura)` e mais agressiva que a atual (que separa vencido com estoque vs inativo sem estoque). Isso simplifica mas elimina o conceito de "lote terminal/historico" — architect precisa decidir se mantemos um sub-status ou se `vencido + estoque=0` substitui a antiga `inativo`.
9. **Cadastro com expiry < hoje => status=vencido forcado**: independentemente da escolha do usuario.
10. **Cadastro com status=`em_uso` e openedDate null => grava openedDate=hoje**: regra nova explicita.
11. **applyDerivedStatusFromScheduler**: scheduler cron diario depende dele — a logica nova deve ter equivalente claro.

---

## Unknowns and assumptions

Itens de validacao para o architect:

1. **Renomear coluna `name`?** — opcoes:
   - A) Renomear `reagent_lots.name` para `label` (rename + view de retro-compat). Quebra `findTagSummaries`, audit_log antigo (que cita `name`), e todos generators que usam `lot.getName()`.
   - B) Manter coluna `name` no DB e re-rotular apenas no UI/DTO (`label` mapeia para `name`). Simples, mas confunde leitor.
   - **Recomendacao para discussao**: opcao B (manter coluna, refatorar contrato como `label`) — minimiza migracao, preserva `audit_log` historico.

2. **Endpoint de etiquetas** — `GET /api/reagents/labels`:
   - Backend pode usar `SELECT DISTINCT name FROM reagent_lots ORDER BY name` (resultado em segundos para tabelas pequenas) ou criar tabela `reagent_labels` (id, name, created_at) com FK em `reagent_lots`. **Recomendacao para discussao**: comecar com `DISTINCT` (sem nova tabela); promover a tabela quando volume justificar.

3. **`vencido` e `fora_de_estoque` simultaneos**: hoje `vencido` separa de `inativo` por estoque. No modelo novo, `vencido = expiry < hoje` independente de estoque. Lote `vencido + currentStock=0` perde a distincao do antigo `inativo`. Architect deve confirmar que isso esta OK regulatoriamente (relatorios continuam mostrando "vencidos com estoque" como secao vermelha critica?).

4. **Politica de bloqueio em `vencido`**: `canReceiveEntry` em vencido deve continuar `false`? Espirito atual: vencido nao recebe entrada porque deve ser descartado.

5. **Migracao V13 dry-run**: tres opcoes:
   - A) Flag `application.yml` `reagent.migration.v13.dryRun=true` que loga e nao altera (mas Flyway ja registra a migracao, dificultando reaplicar).
   - B) SQL `SELECT` separado (script auxiliar) executado manualmente em staging antes do deploy.
   - C) Migracao callback que dump-a contagens em `migration_v13_audit` antes do `ALTER`.
   - **Recomendacao para discussao**: B (SQL auxiliar em `transicao-java/refactor-reagentes-v2/dry-run.sql`), porque Flyway garante one-shot e tornar idempotente em meio a UPDATE+DROP e arriscado.

6. **VoiceRecorderModal `data.name`**: o callback hoje preenche `name` direto. No modelo novo, `name` e selecao em combobox. Politica para o agente de voz:
   - A) Auto-criar etiqueta se nao existir (UX simples mas pode poluir).
   - B) Mostrar combobox aberto com valor pre-preenchido para o usuario decidir.
   - C) Ignorar `data.name` se nao houver match exato.

7. **Status `em_uso` exige `openedDate`?** — cenario aprovado diz: "Cadastro com status=`em_uso` e openedDate=null grava openedDate=hoje". Mas nao define o que acontece em UPDATE quando muda para `em_uso`. Architect precisa fechar.

8. **dashFilter `lowStock` e `ruptureRisk`**: cenario aprovado pede para sair do dashboard. Mas `dashFilter` ainda pode ser referenciado por test/preset/url query string. Validar com `grep` (nao foi feito profundamente neste pacote).

9. **`quantityValue`, `stockUnit`, `estimatedConsumption`**: removidos no modelo, mas `ReagentesRastreabilidadeGenerator` (linhas 200-210) usa `getEstimatedConsumption()` para grafico de consumo por categoria. Ou o grafico sai do PDF, ou o consumo e derivado de outra fonte (StockMovement). Architect decide.

10. **`alertThresholdDays`**: cenario aprovado fala "vira constante = 7 no backend". Architect confirma: hardcoded em `ResponseMapper.toReagentLotResponse` (substitui `lot.getAlertThresholdDays() == null ? 7 : lot.getAlertThresholdDays()` por constante)?

11. **Idempotencia da V13**: Flyway nao reroda migracao concluida. Se o operador rodar V13 em ambiente que ja teve script SQL ad-hoc executado (dev/staging), pode dar conflito. Politica: `UPDATE ... WHERE status IN ('quarentena','ativo','inativo','vencido','em_uso')` ainda funciona porque o filtro ja exclui valores novos.

12. **Filtro `?status=` no GET**: hoje aceita 5 valores antigos. Apos V13, banco so guardara os 4 novos. Periodo de transicao? Ou clean break + invalidacao de cache no client?

---

## Out of scope

Nao incluir no pacote — sao caminhos protegidos ou intocaveis para esta refatoracao:
- `biodiagnostico-web/node_modules/`, `biodiagnostico-web/dist/`, `biodiagnostico-api/target/`, `cursor-bio-compulabxsimus/.git/` (CLAUDE.md).
- PDFs ja gerados em `report_runs` (imutaveis por SHA-256 assinada).
- Tabela `qc_records` e seus repositorios — apenas LEITURA de `lot_number` permanece.
- Tabela `audit_log` historica — sem reescrita (compliance).
- `tudo para a transicao/`, `cursor-bio-compulabxsimus/` — material legado nao alterado por esta refatoracao.
- HematologyBioRecord, MaintenanceRecord, ImportRun, sistemas paralelos — nao tocados.
- `RegistroTab.tsx` — nao depende de Reagentes diretamente.

---

## Estrategia de migracao V13 (esboco — sem SQL final)

### Pre-condicoes
- Capturar baseline antes da migracao: `SELECT status, COUNT(*) FROM reagent_lots GROUP BY status`.
- Capturar lista exata de lotes em `quarentena` (para auditoria pre-migracao): `SELECT id, lot_number, manufacturer, expiry_date, current_stock, opened_date FROM reagent_lots WHERE status='quarentena'`.
- Salvar dry-run SQL em `transicao-java/refactor-reagentes-v2/dry-run.sql` para o release-engineer rodar em staging e validar contagens antes do deploy.

### Mapeamento determinístico (regras canonicas)
Aplicar nesta ordem (primeira regra que casar vence):

| Estado atual | Condicao | Novo status |
|---|---|---|
| `expiry < hoje` (qualquer status, qualquer estoque) | sempre | `vencido` |
| `quarentena` + dentro validade + estoque=0 + opened=null | conservador | `fora_de_estoque` |
| `quarentena` + dentro validade + estoque>0 | conservador | `em_uso` (assume aberto) |
| `quarentena` + dentro validade + estoque=0 + opened nao-null | conservador | `fora_de_estoque` |
| `inativo` + dentro validade + estoque=0 | mapear pra novo terminal | `fora_de_estoque` |
| `inativo` + dentro validade + estoque>0 | edge | `em_uso` (auto-derive) |
| `ativo` + estoque>0 + opened=null | linhas tipicas | `em_estoque` |
| `ativo` + estoque>0 + opened nao-null | linhas tipicas | `em_uso` |
| `ativo` + estoque=0 | edge | `fora_de_estoque` |
| `em_uso` (qualquer condicao dentro validade) | direto | `em_uso` |
| `vencido` (qualquer estoque) | direto | `vencido` |

### Operacoes
1. `UPDATE reagent_lots SET status = <derivado>` (varias clausulas WHEN).
2. `INSERT INTO audit_log (action, entity_type, entity_id, details, ...)` para cada linha alterada de `quarentena` (ou `inativo` quando muda) com `details = jsonb_build_object('from', <old>, 'to', <new>, 'trigger', 'quarentena_removed_v2', 'expiryDate', expiry_date, 'currentStock', current_stock)`.
3. `ALTER TABLE reagent_lots DROP COLUMN quantity_value, DROP COLUMN stock_unit, DROP COLUMN estimated_consumption, DROP COLUMN start_date, DROP COLUMN end_date, DROP COLUMN alert_threshold_days`.
4. **Nao remover** `name` neste passo (renomeacao desligada — opcao B em "Unknowns").
5. (Opcional) `ALTER TABLE reagent_lots ALTER COLUMN current_stock SET NOT NULL DEFAULT 0` se ainda nao for.

### Idempotencia
- Flyway gerencia `flyway_schema_history` — V13 nao reroda.
- Em ambientes intermediarios (dev/staging) onde alguem possa ter rodado script ad-hoc, o `UPDATE` com filtro por status antigo (`WHERE status IN ('ativo','em_uso','inativo','quarentena')`) e seguro: nao atualiza linhas ja com valor novo.
- DROP COLUMN com `IF EXISTS` torna o ALTER seguro para reexecucao mental, mas Flyway nao precisa.

### Recomendacao de dry-run
Opcao **B** (do "Unknowns #5"): script SQL `dry-run.sql` separado executado manualmente em staging com pgAdmin/psql, gerando relatorio de contagem por novo status e listagem de transicoes esperadas. Documento `transicao-java/refactor-reagentes-v2/dry-run.sql` (a criar — nao agora).

---

## Lista de arquivos que VAO ser tocados

### Backend Java (modificar = M, deletar = D, criar = N)

- (M) `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/main/java/com/biodiagnostico/entity/ReagentLot.java`
- (M) `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/main/java/com/biodiagnostico/entity/ReagentStatus.java`
- (M) `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/main/java/com/biodiagnostico/dto/request/ReagentLotRequest.java`
- (M) `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/main/java/com/biodiagnostico/dto/response/ReagentLotResponse.java`
- (M) `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/main/java/com/biodiagnostico/dto/response/ReagentTagSummary.java`
- (M) `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/main/java/com/biodiagnostico/repository/ReagentLotRepository.java` (ajustar projection + revisar queries com `'inativo'`/`'quarentena'`/`'ativo'`)
- (M) `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/main/java/com/biodiagnostico/service/ReagentService.java` (regras de derivacao + audit triggers)
- (M) `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/main/java/com/biodiagnostico/scheduler/ReagentExpiryScheduler.java`
- (M) `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/main/java/com/biodiagnostico/util/ResponseMapper.java`
- (M) `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/main/java/com/biodiagnostico/controller/ReagentController.java` (csv columns + provavel novo endpoint `/labels`)
- (M) `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/main/java/com/biodiagnostico/service/PdfReportService.java` (cabecalhos CSV/PDF v1)
- (M) `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/main/java/com/biodiagnostico/service/DashboardService.java` (verificar se contagens ainda fazem sentido apos os novos statuses)
- (M) `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/main/java/com/biodiagnostico/service/reports/v2/generator/impl/ReagentesRastreabilidadeGenerator.java` (resumo `Ativos/Inativos`, secoes do PDF)
- (M) `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/main/java/com/biodiagnostico/service/reports/v2/generator/impl/MultiAreaConsolidadoGenerator.java` (revisar KPI)
- (M) `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/main/java/com/biodiagnostico/service/reports/v2/generator/ai/ReportAiPrompts.java` (validar texto)
- (N) `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/main/resources/db/migration/V13__reagent_lots_status_v2.sql`
- (M) Eventualmente: `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/main/java/com/biodiagnostico/config/DatabaseIndexInitializer.java` (revalidar — nao ha mudanca aparente, mas deve ser confirmado)

### Backend testes (M)

- `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/test/java/com/biodiagnostico/service/ReagentServiceTest.java`
- `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/test/java/com/biodiagnostico/controller/ReagentControllerTest.java`
- `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/test/java/com/biodiagnostico/scheduler/ReagentExpirySchedulerTest.java`
- `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/test/java/com/biodiagnostico/service/reports/v2/generator/impl/ReagentesRastreabilidadeGeneratorTest.java`

### Frontend

- (M) `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-web/src/types/index.ts`
- (M) `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-web/src/services/reagentService.ts`
- (M) `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-web/src/hooks/useReagents.ts`
- (M) `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-web/src/components/proin/ReagentesTab.tsx`
- (M) `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-web/src/components/proin/reagentes/ReagentModals.tsx`
- (M) `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-web/src/components/proin/reagentes/ReagentsContent.tsx`
- (M) `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-web/src/components/proin/reagentes/ReagentsDashboard.tsx`
- (M) `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-web/src/components/proin/reagentes/ReagentsFilters.tsx`
- (M) `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-web/src/components/proin/reagentes/constants.ts`
- (M) `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-web/src/components/proin/reagentes/utils.ts`
- (M) `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-web/src/components/proin/reagentes/schemas.ts`
- (M) `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-web/src/components/proin/VoiceRecorderModal.tsx` (mapping `data.name` -> nova combobox de etiqueta)
- (M) `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-web/src/components/proin/ReagentesTab.test.tsx`

### Documentacao

- (M) `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/transicao-java/DECISOES-REAGENTES.md` (registrar superseder/atualizacao do REAG-ADR-001 com novo conjunto de status)
- (N) `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/transicao-java/refactor-reagentes-v2/00-context-pack.md` (este arquivo — ja existe)
- (N) `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/transicao-java/refactor-reagentes-v2/01-contract.md` (architect entrega)
- (N) `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/transicao-java/refactor-reagentes-v2/dry-run.sql` (release-engineer cria depois)

---

## Riscos cruzados

1. **Backend e frontend em paralelo sem contrato congelado**: AGENTS.md proibe. Architect tem que congelar `ReagentLotRequest`, `ReagentLotResponse`, `ReagentTagSummary`/`ReagentLabelSummary` e o endpoint `/api/reagents/labels` antes de dividir o trabalho.
2. **`audit_log` historico**: registros antigos contem `details.from='quarentena'` e `details.to='inativo'`. **Nao reescrever** — politica regulatoria. Apenas inserir novos registros V13.
3. **PDFs reports v2 ja assinados**: imutaveis por SHA-256 + `report_runs.report_number`. Se o pdf for regenerado, vira `report_run` novo, com novo numero. Nao tocar artefatos antigos.
4. **`usedInQcRecently` continua via `lot_number`**: refatoracao **nao pode** mudar a logica que consulta `qc_records.lot_number`. Confirmar em `ReagentService.lotNumbersUsedInQcRecently` (linhas 104-118) que continua intacta.
5. **Lotes em CQ recente protegem descarte**: `deleteLot` (linhas 234-269) bloqueia exclusao quando `usedInQc` ou `hasStockMovements`. Politica precisa sobreviver — substituir o status terminal `inativo` por `fora_de_estoque` mantendo o bloqueio.
6. **Scheduler diario depende do enum**: `ReagentExpiryScheduler.markExpiredLots` chama `applyDerivedStatusFromScheduler`. Refatoracao deve manter assinatura (ou ajustar scheduler simetricamente).
7. **dashboard global (`DashboardService.expiringReagents`)**: usa `findExpiringLots` filtro `status NOT IN ('vencido','inativo')`. Apos refatoracao precisa virar `NOT IN ('vencido','fora_de_estoque')`. Pode introduzir bug sutil em alertas.
8. **CSV export**: clientes externos (laboratorio) podem ter scripts esperando o header atual. Romper sem aviso e ruim — release-engineer registra changelog.
9. **VoiceRecorderModal**: prompts do agente de voz mapeiam para `name`/`lot_number`/`expiry_date`/`manufacturer`. Mudar `name` para combobox de etiqueta sem atualizar agente de voz quebra a UX (ou cria etiquetas duplicadas).
10. **Indice unico (lot_number, manufacturer)**: combobox de etiqueta + `manufacturer` continuam sendo a chave canonica. Cuidado para nao deixar UI permitir `manufacturer` em branco e o backend rejeitar (atualmente `@NotBlank` no DTO).

---

## Perguntas remanescentes (bloqueadores para o architect)

1. **Renomeacao de `name`**: opcao A (rename `label` no DB) ou B (manter `name`, re-rotular)? Recomendacao explicita como B mas precisa decisao formal.
2. **`vencido` como sumidouro**: o conceito antigo `inativo` (terminal/historico) e absorvido por `vencido + currentStock=0`? Ou criamos um quinto status `arquivado` para preservar a distincao operacional? Cenario aprovado nao tem.
3. **`em_uso` em UPDATE**: regra "openedDate=null + status=em_uso => grava openedDate=hoje" se aplica em CREATE e UPDATE ou so CREATE?
4. **`canReceiveEntry` para `vencido`**: bloqueia ENTRADA em vencido, igual a politica antiga de inativo? Hoje so inativo bloqueia.
5. **Endpoint `/api/reagents/labels`**: contrato exato — `string[]` simples ou `{name: string, count: number}[]`? Frontend precisa do count para exibir hint?
6. **REAG-ADR-001**: este ADR fica como historico e cria-se REAG-ADR-002, ou edita-se o REAG-ADR-001 com nota de superseder?
7. **`alertThresholdDays`**: vira constante `7` no `ResponseMapper`? Precisa virar configuravel via `application.yml`?
8. **Reports V2 — categoria de consumo**: o `barChart` em `ReagentesRastreabilidadeGenerator` (linha 200) usa `estimatedConsumption`. Sai do PDF ou e derivado de `StockMovement`?
9. **`dashFilter` removido**: confirmar via grep extra que `lowStock` e `ruptureRisk` nao sao referenciados por preset/url/teste-fora-do-arquivo.

---

## Architect required?

**Sim.** Esta e uma refatoracao grande, critica, que afeta entidade, banco, contrato HTTP, scheduler, reports v2 e frontend completo. AGENTS.md exige `architect` para mudancas de contrato + cross-layer + regras criticas. Sem contrato congelado, backend e frontend nao podem implementar em paralelo.

---

## Next agent

`architect` — entregavel: `transicao-java/refactor-reagentes-v2/01-contract.md` cobrindo:
- Decisao explicita das 9 perguntas remanescentes acima.
- Schema final da entidade + DTOs + projection.
- Esqueleto da migracao V13 (DDL + UPDATE + INSERT audit_log).
- Endpoints (contratos JSON novos e/ou alterados).
- Tabela de mapeamento de status final (forma definitiva).
- Criterios de aceite para `qa-engineer` e `domain-auditor`.
