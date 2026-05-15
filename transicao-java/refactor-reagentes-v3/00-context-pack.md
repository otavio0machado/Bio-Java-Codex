# Context Pack — Refator Reagentes v3

Pacote de contexto para o `architect`. Pos-merge dos commits `06d32c5` (refator-reagentes-v2 padrao-ouro) e `42f5b71` (combobox em Fabricante/Localizacao/Fornecedor). NAO inclui solucao — apenas contrato vigente, atritos e mapas.

## Resumo do problema

Refator v3 amarra tres mudancas interligadas no dominio de Reagentes:

1. **Status redefinido** — drop `fora_de_estoque`, add `inativo` como **estado terminal manual**. Status final: `em_estoque, em_uso, vencido, inativo`.
2. **Estoque per-unit** — `currentStock: Double` substituido por `unitsInStock: Integer` + `unitsInUse: Integer`. Novos tipos de movimento: `ABERTURA` (move 1 unidade fechada -> aberta), `FECHAMENTO` (reverter abertura), `CONSUMO` (decrementa unidades abertas). `SAIDA` sai do dominio de escrita.
3. **Arquivar vs Apagar separados** — DELETE vira hard delete real (cascade `stock_movements`, **so ADMIN**, com confirmacao por digitacao do `lotNumber`). Novos endpoints `POST /api/reagents/{id}/archive` (vira `inativo`) e `POST /api/reagents/{id}/unarchive` (re-deriva status).

## Classificacao

- **Tamanho:** grande
- **Criticidade:** critica (toca status canonico, contrato HTTP, schema, audit_log, scheduler, generators de PDF, frontend inteiro da aba)

## Fonte de verdade

1. Codigo ativo Java/React (pos commits `06d32c5` + `42f5b71`).
2. `transicao-java/refactor-reagentes-v2/01-contract.md` — contrato da v2 que serve de baseline (regra ternaria, audit actions).
3. `transicao-java/refactor-reagentes-v2/04-followup-issues.md` — itens nao resolvidos em v2 que o v3 absorve (especialmente o badge "Arquivado" / separacao archive vs delete).

Conflitos abertos sao listados em "Pontos de atrito".

## Primary context (max 8 arquivos)

1. `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/main/java/com/biodiagnostico/service/ReagentService.java` — fonte unica do `deriveStatus` ternario, fluxo de `createLot/updateLot/deleteLot/createMovement/deleteMovement` com auditoria. **Centro do refator.**
2. `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/main/java/com/biodiagnostico/entity/ReagentLot.java` — entidade hoje (`currentStock: Double`, `status: String` default `em_estoque`, OneToMany para movimentos). Local onde entram `unitsInStock`, `unitsInUse`, `archivedAt`, `archivedBy`, `needsStockReview`.
3. `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/main/java/com/biodiagnostico/entity/ReagentStatus.java` — enum-de-strings. Refator troca `FORA_DE_ESTOQUE` por `INATIVO` no `Set ALL` e em `humanList()`. Comentario de bloqueio anti-status-legado precisa atualizar.
4. `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/main/java/com/biodiagnostico/entity/MovementType.java` + `entity/StockMovement.java` — tipos vigentes: `ENTRADA, SAIDA, AJUSTE`. Adicionar `ABERTURA, FECHAMENTO, CONSUMO`. Avaliar `Set ALL_WRITE` vs `Set ALL_READ` (legados em SAIDA continuam visiveis).
5. `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/main/java/com/biodiagnostico/controller/ReagentController.java` — endpoints atuais. v3 adiciona `POST /{id}/archive`, `POST /{id}/unarchive`, e re-anota `DELETE` com `@PreAuthorize("hasRole('ADMIN')")`. Header CSV muda.
6. `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/main/resources/db/migration/V13__reagent_status_v2.sql` — referencia obrigatoria de estilo para a nova V14 (audit-log antes de UPDATE, CASE deterministico, CHECK constraint trocada).
7. `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-web/src/components/proin/reagentes/utils.ts` — `DashFilter`, `ReagentStats`, `buildReagentStats`, `getLotVisualState`, `canReceiveEntry`. Cinco contagens canonicas viram quatro (drop `foraDeEstoque`) + `inativos`. Filtros idem.
8. `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-web/src/components/proin/reagentes/ReagentsContent.tsx` — onde sai a logica `lot.status === 'fora_de_estoque' ? 'Excluir' : 'Arquivar'` (linhas 466-475 e 627-636). v3 separa: dois botoes (`Arquivar` quando ativo, `Excluir` so quando ADMIN). Adicionar botoes diretos "Abrir unidade" / "Voltar ao estoque" no card.

## Secondary context

- `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/main/java/com/biodiagnostico/dto/request/ReagentLotRequest.java` — drop `currentStock`, add `unitsInStock`, `unitsInUse`. Validacao `status='inativo'` recusada em CREATE.
- `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/main/java/com/biodiagnostico/dto/request/StockMovementRequest.java` — adicionar `unitsInStock?`, `unitsInUse?` opcionais para AJUSTE.
- `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/main/java/com/biodiagnostico/dto/response/ReagentLotResponse.java` — drop `currentStock`, add `unitsInStock`, `unitsInUse`, `totalStock` (derivado), `archivedAt`, `archivedBy`, `needsStockReview`.
- `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/main/java/com/biodiagnostico/dto/response/StockMovementResponse.java` — `previousStock: Double` precisa virar `previousUnitsInStock: Integer` + `previousUnitsInUse: Integer`. Auditoria muda.
- `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/main/java/com/biodiagnostico/repository/ReagentLotRepository.java` — toda query que filtra `r.status = 'fora_de_estoque'` ou `r.status NOT IN ('vencido', 'fora_de_estoque')` precisa atualizacao. JPQL `findLabelSummaries` muda colunas. `findExpiringLots`, `findExpiringInWindow`, `countExpiringLots`, `findExpiredWithStock`, `countExpiredWithStock` impactados.
- `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/main/java/com/biodiagnostico/scheduler/ReagentExpiryScheduler.java` — `findExpiredNeedingReclassification` continua filtrando por `status <> 'vencido'`. v3 deve continuar pulando lotes `inativo` (terminal manual) — comentario `WHERE r.expiry_date < :today AND r.status NOT IN ('vencido', 'inativo')` provavelmente.
- `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/main/java/com/biodiagnostico/service/reports/v2/generator/impl/ReagentesRastreabilidadeGenerator.java` — KPI cards (linhas 128-145) trocam `foraDeEstoque` por `inativos`. Tabela "vencidos com estoque" usa `currentStock > 0`; passa a usar `(unitsInStock + unitsInUse) > 0`. Filtro `includeInactive` agora bate em `inativo` (era `fora_de_estoque`).
- `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/main/java/com/biodiagnostico/service/reports/v2/generator/ai/ReportAiPrompts.java` — `REAGENTES_RASTREABILIDADE` (linhas 49-55): texto nao cita "fora de estoque" explicitamente; a substituicao se aplica se architect quiser reforcar terminologia "inativo" no prompt.
- `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/main/java/com/biodiagnostico/controller/AdminController.java` — `GET /api/admin/users` retorna `UserResponse` com `role` e `isActive`. Esta sob `@PreAuthorize("hasRole('ADMIN')")` na classe inteira — **bloqueador para combobox de responsavel acessivel a FUNCIONARIO** (vide atrito 7).
- `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-api/src/main/java/com/biodiagnostico/dto/response/UserResponse.java` + `entity/User.java` + `entity/Role.java` — modelo de usuario; roles: `ADMIN, FUNCIONARIO, VIGILANCIA_SANITARIA, VISUALIZADOR`. Combobox v3 filtra `role IN (ADMIN, FUNCIONARIO) AND isActive=true`.
- `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-web/src/types/index.ts` (linhas 206-358) — `ReagentStatus`, `ReagentLot`, `ReagentLotRequest`, `StockMovement`, `StockMovementRequest`, `ReagentLabelSummary`, `ReagentTagSummary` (deprecated).
- `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-web/src/components/proin/reagentes/constants.ts` — `REAGENT_STATUS_OPTIONS`, `TAG_STATUS_TABS`, `REAGENT_STATUS_LABELS`. `MOVEMENT_REASONS` precisa novo `REVERSAO_ABERTURA` (atrito 4).
- `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-web/src/components/proin/reagentes/schemas.ts` — `lotSchema.currentStock` vira `unitsInStock`/`unitsInUse`. `movementSchema.type` enum cresce para 6 valores; AJUSTE valida pelos dois novos campos.
- `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-web/src/services/reagentService.ts` — adiciona `archiveLot`, `unarchiveLot`, `getResponsibles`. `exportCsv` herda novo header.
- `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-web/src/hooks/useReagents.ts` — adicionar `useArchiveReagentLot`, `useUnarchiveReagentLot`, `useResponsibles`.
- `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-web/src/components/proin/ReagentesTab.tsx` — `handleArchiveLot` (linhas 232-252) atualmente delega para `deleteLot.mutateAsync`; v3 separa em `handleArchiveLot` e `handleDeleteLot` (com confirmacao por digitacao).
- `/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-web/src/components/proin/reagentes/ReagentModals.tsx` — modal de movimento ganha 3 novos `<option>`s e UI condicional para AJUSTE com dois inputs.

## Symbol map

### Backend — entidades, enums, DTOs

| Simbolo | Arquivo:linha | Mudanca v3 |
|---|---|---|
| `ReagentLot.currentStock: Double` | `entity/ReagentLot.java:60-61` | DROP, substituido por `unitsInStock`+`unitsInUse` |
| `ReagentLot.status: String` default `EM_ESTOQUE` | `entity/ReagentLot.java:67-68` | mantem nome, dominio muda |
| (novo) `ReagentLot.unitsInStock: Integer` | n/a | NEW, NOT NULL default 0 |
| (novo) `ReagentLot.unitsInUse: Integer` | n/a | NEW, NOT NULL default 0 |
| (novo) `ReagentLot.archivedAt: Instant` | n/a | NEW, nullable |
| (novo) `ReagentLot.archivedBy: String` | n/a | NEW, nullable, tamanho ~128 |
| (novo) `ReagentLot.needsStockReview: Boolean` | n/a | NEW, NOT NULL default false |
| `ReagentStatus.FORA_DE_ESTOQUE` | `entity/ReagentStatus.java:25` | DROP do `ALL` |
| `ReagentStatus.INATIVO` | n/a | NEW |
| `MovementType.ALL = {ENTRADA,SAIDA,AJUSTE}` | `entity/MovementType.java:17` | substituir por `ALL_READ` (todos legados) e `ALL_WRITE` (sem SAIDA) |
| (novo) `MovementType.ABERTURA, FECHAMENTO, CONSUMO` | n/a | NEW |
| `StockMovement.previousStock: Double` | `entity/StockMovement.java:50` | substituir por `previousUnitsInStock: Integer` + `previousUnitsInUse: Integer` |
| `MovementReason.REVERSAO_ABERTURA` | `entity/MovementReason.java:14-19` | NEW (justificativa default para FECHAMENTO) |
| `ReagentLotRequest.currentStock` | `dto/request/ReagentLotRequest.java:27` | substituir por `unitsInStock`+`unitsInUse` |
| `ReagentLotResponse.currentStock` | `dto/response/ReagentLotResponse.java:23` | substituir por `unitsInStock`+`unitsInUse`+`totalStock` derivado |
| (novo) `ReagentLotResponse.archivedAt`, `archivedBy`, `needsStockReview` | n/a | NEW |
| `ReagentLabelSummary.foraDeEstoque` | `dto/response/ReagentLabelSummary.java:14` | renomear para `inativos` |
| `StockMovementRequest.{unitsInStock, unitsInUse}: Integer?` | n/a | NEW (so AJUSTE) |
| `ReagentTagSummary` | `dto/response/ReagentTagSummary.java` (todo) | DROP — followup nao executado em v2 (PR-4 nunca aconteceu) |

### Backend — service e controller

| Simbolo | Arquivo:linha | Mudanca v3 |
|---|---|---|
| `ReagentService.deriveStatus(lot, today)` | `service/ReagentService.java:593-612` | substituir regra: 1) inativo manual respeita; 2) expiry < hoje -> vencido; 3) total=0 -> mantem em_estoque (estoque zero NAO vira terminal automatico); 4) unitsInUse>0 -> em_uso; 5) caso contrario em_estoque |
| `ReagentService.applyDerivedStatus` | `service/ReagentService.java:630-647` | nao tocar lote `inativo` (terminal manual); resto idem |
| `ReagentService.applyOpenedDateOnUseTransition` | `service/ReagentService.java:658-694` | aciona quando ABERTURA cria primeira unidade aberta (idem audit `OPENED_DATE_BACKFILLED`) |
| `ReagentService.deleteLot(id)` | `service/ReagentService.java:299-336` | re-significar para hard delete: validar role ADMIN, validar `lotNumber` confirmado, cascade `StockMovement`, audit `REAGENT_LOT_DELETED` |
| (novo) `ReagentService.archiveLot(id, archivedBy)` | n/a | NEW: status='inativo', set archivedAt/archivedBy, audit `REAGENT_LOT_ARCHIVED` (mantem nome legado v2) |
| (novo) `ReagentService.unarchiveLot(id)` | n/a | NEW: re-deriva status (pode virar `vencido` se passou prazo enquanto arquivado), preserva `archivedAt/archivedBy` historicos, audit `REAGENT_LOT_UNARCHIVED` |
| `ReagentService.createMovement(lotId, request)` | `service/ReagentService.java:351-443` | ramificar switch para 6 tipos. Bloquear ENTRADA quando `inativo` (decisao 1). Aceitar AJUSTE em `inativo`. CONSUMO suga `unitsInUse`; toast cliente sugere arquivar quando zera (decisao 6). |
| `ReagentService.deleteMovement(movementId)` | `service/ReagentService.java:445-477` | reverter precisa cobrir 6 tipos; ABERTURA reverter desfaz pulo de unidade; FECHAMENTO reverter desfaz pulo inverso |
| `ReagentService.getLabelSummaries()` | `service/ReagentService.java:494-506` | trocar `foraDeEstoque` por `inativos` no projection |
| `ReagentService.getTagSummaries()` (deprecated) | `service/ReagentService.java:514-530` | DROP junto com endpoint |
| `ReagentController.@DeleteMapping("/{id}")` | `controller/ReagentController.java:59-64` | adicionar `@PreAuthorize("hasRole('ADMIN')")` (hoje aceita FUNCIONARIO) e exigir confirm header/body |
| (novo) `ReagentController.@PostMapping("/{id}/archive")` | n/a | NEW, body `{ archivedBy: String }` (ADMIN ou FUNCIONARIO) |
| (novo) `ReagentController.@PostMapping("/{id}/unarchive")` | n/a | NEW (ADMIN ou FUNCIONARIO) |
| `ReagentController.exportCsv` header | `controller/ReagentController.java:137` | "Estoque Atual" -> "Em estoque,Em uso,Total" + "Arquivado em" + "Arquivado por" (vide atrito 9) |
| `ReagentController.@GetMapping("/tags")` | `controller/ReagentController.java:120-126` | DROP — fechar o followup nunca executado de v2 |
| (novo) `UserController.@GetMapping("/api/users/responsibles")` ou expor sub-endpoint | n/a | NEW — OU mudar `@PreAuthorize` do `AdminController.listUsers` para aceitar FUNCIONARIO em modo filtrado (atrito 7) |

### Backend — repository, scheduler

| Simbolo | Arquivo:linha | Mudanca v3 |
|---|---|---|
| `ReagentLotRepository.findExpiringLots` | `repository/ReagentLotRepository.java:64-70` | filtro `NOT IN ('vencido', 'fora_de_estoque')` -> `NOT IN ('vencido', 'inativo')` |
| `ReagentLotRepository.findExpiredNeedingReclassification` | `repository/ReagentLotRepository.java:61-62` | continuar `status <> 'vencido'`; reavaliar se deve excluir `inativo` (terminal manual NAO deve ser auto-reclassificado) |
| `ReagentLotRepository.findLabelSummaries` | `repository/ReagentLotRepository.java:120-133` | trocar `WHEN r.status = 'fora_de_estoque'` por `'inativo'`; renomear alias |
| `ReagentLotRepository.countExpiringLots` | `repository/ReagentLotRepository.java:109-114` | mesma troca de status |
| `ReagentLotRepository.findExpiredWithStock` | `repository/ReagentLotRepository.java:87-94` | `currentStock > 0` -> `(unitsInStock + unitsInUse) > 0` |
| `ReagentLotRepository.countExpiredWithStock` | `repository/ReagentLotRepository.java:100-107` | mesma troca |
| `ReagentExpiryScheduler.markExpiredLots` | `scheduler/ReagentExpiryScheduler.java:45-71` | nao precisa codigo novo — derivado do novo `deriveStatus`; mas garantir que scheduler NAO mexe em lote `inativo` |

### Backend — generators e prompts

| Simbolo | Arquivo:linha | Mudanca v3 |
|---|---|---|
| `ReagentesRastreabilidadeGenerator.renderPdf` cards | `service/reports/v2/generator/impl/ReagentesRastreabilidadeGenerator.java:128-145` | KPI `foraDeEstoque` -> `inativos`; sumario passa a 5 cards (Total, Em estoque, Em uso, Inativos, Vencidos) |
| `ReagentesRastreabilidadeGenerator.filteredLots` | `service/reports/v2/generator/impl/ReagentesRastreabilidadeGenerator.java:231-242` | `includeInactive` filtra `inativo` em vez de `fora_de_estoque` |
| `ReagentesRastreabilidadeGenerator` linha "vencidos com estoque" | linhas 132-134, 187-198 | `currentStock > 0` -> `(unitsInStock + unitsInUse) > 0`; coluna "Estoque" substitui por "Em estoque/Em uso" |
| `ReportAiPrompts.promptFor(REAGENTES_RASTREABILIDADE)` | `service/reports/v2/generator/ai/ReportAiPrompts.java:49-55` | nao cita "fora de estoque" hoje; reforco terminologico opcional para incluir "lotes arquivados (inativo)" |
| (testes) `ReagentMigrationV13Test`, `ReagentServiceTest`, `ReagentControllerTest`, `ReagentExpirySchedulerTest`, `ReagentesRastreabilidadeGeneratorTest` | sob `src/test/java/com/biodiagnostico/...` | todos consomem `ReagentStatus.FORA_DE_ESTOQUE` — recompilam, varios asserts mudam de literal |

### Frontend — types, hooks, services

| Simbolo | Arquivo:linha | Mudanca v3 |
|---|---|---|
| `types/index.ts: ReagentStatus` | `types/index.ts:212` | `'em_estoque' \| 'em_uso' \| 'fora_de_estoque' \| 'vencido'` -> `'em_estoque' \| 'em_uso' \| 'vencido' \| 'inativo'` |
| `types/index.ts: ReagentLot.currentStock: number` | `types/index.ts:222` | DROP, add `unitsInStock`, `unitsInUse`, `totalStock` |
| `types/index.ts: ReagentLot.{archivedAt, archivedBy, needsStockReview}` | n/a | NEW |
| `types/index.ts: ReagentLotRequest.currentStock` | `types/index.ts:248` | substituir |
| `types/index.ts: StockMovement.type` | `types/index.ts:316` | enum cresce para 6 (ler), 5 (escrever — sem SAIDA) |
| `types/index.ts: StockMovementRequest.type` | `types/index.ts:326` | `'ENTRADA' \| 'AJUSTE' \| 'ABERTURA' \| 'FECHAMENTO' \| 'CONSUMO'` |
| `types/index.ts: StockMovement.previousStock` | `types/index.ts:320` | DROP — substituir por previousUnitsInStock/Use |
| `types/index.ts: ReagentLabelSummary.foraDeEstoque` | `types/index.ts:342` | renomear `inativos` |
| `types/index.ts: ReagentTagSummary` | `types/index.ts:351-358` | DROP |
| `services/reagentService.ts: getTagSummaries` | linha 79-82 | DROP |
| `services/reagentService.ts: archiveLot, unarchiveLot, deleteLot` | linhas 44-46 | refatorar — `deleteLot` muda contrato (passa lotNumber confirmado), 2 funcoes novas |
| (novo) `services/reagentService.ts: getResponsibles()` | n/a | NEW — chama `/api/users/responsibles` ou similar |
| `hooks/useReagents.ts: useDeleteReagentLot` | linhas 54-65 | semantica muda (hard delete) — invalidations identicas |
| (novo) `hooks/useReagents.ts: useArchiveReagentLot, useUnarchiveReagentLot, useResponsibles` | n/a | NEW |

### Frontend — UI

| Simbolo | Arquivo:linha | Mudanca v3 |
|---|---|---|
| `ReagentesTab.handleArchiveLot` | `components/proin/ReagentesTab.tsx:232-252` | dividir em `handleArchive` (combobox responsavel) e `handleDelete` (modal com digitacao do lotNumber, so visivel para ADMIN) |
| `ReagentesTab.handleOpenEntry` / `handleOpenExit` | `components/proin/ReagentesTab.tsx:161-175` | `handleOpenExit` (SAIDA) vai embora; novos `handleOpenAbertura`, `handleOpenFechamento`, `handleOpenConsumo` |
| `ReagentsContent` botao "Arquivar/Excluir" | `components/proin/reagentes/ReagentsContent.tsx:466-475`, `627-636` | dois botoes separados: "Arquivar" sempre (se status != inativo) e "Excluir" so para ADMIN |
| `ReagentsContent` botoes diretos | `components/proin/reagentes/ReagentsContent.tsx` (cards ~338, 515) | adicionar "Abrir unidade" (ABERTURA q=1) e "Voltar ao estoque" (FECHAMENTO q=1) sem abrir modal (decisao 4) |
| `ReagentsDashboard` cards | `components/proin/reagentes/ReagentsDashboard.tsx:122-126` | trocar card `foraDeEstoque` por `inativos`; adicionar banner amarelo de `needsStockReview` |
| `utils.ts: DashFilter` | `components/proin/reagentes/utils.ts:12-20` | drop `'foraDeEstoque'`, add `'inativos'` |
| `utils.ts: ReagentStats.foraDeEstoque` | `utils.ts:30` | renomear `inativos` |
| `utils.ts: buildReagentStats` | `utils.ts:138-154` | filtra por `status === 'inativo'` |
| `utils.ts: getLotVisualState.archived` | `utils.ts:281` | `lot.status === 'fora_de_estoque'` -> `lot.status === 'inativo'` |
| `constants.ts: REAGENT_STATUS_OPTIONS` | linha 39-44 | substituir entrada |
| `constants.ts: TAG_STATUS_TABS` | linha 49-55 | substituir |
| `constants.ts: REAGENT_STATUS_LABELS` | linha 57-62 | substituir |
| `constants.ts: MOVEMENT_REASONS` | linha 3-10 | adicionar `REVERSAO_ABERTURA` (atrito 4) |
| `schemas.ts: lotSchema.currentStock` | linha 31-33 | dois campos novos com regra `unitsInStock + unitsInUse` >= 0 |
| `schemas.ts: movementSchema.type` enum | linha 77 | crescer para 5 valores de escrita |

## Contract surfaces

### HTTP

- `GET /api/reagents` — response `ReagentLotResponse` muda (drop `currentStock`, add `unitsInStock/unitsInUse/totalStock/archivedAt/archivedBy/needsStockReview`)
- `POST /api/reagents` — body `ReagentLotRequest` muda; `status='inativo'` recusado em CREATE (decisao 2)
- `PUT /api/reagents/{id}` — idem create; tambem recusa `status='inativo'` direto (forca via `/archive`)
- `DELETE /api/reagents/{id}` — **muda autorizacao para ADMIN-only**; body novo `{ confirmLotNumber: string }` ou query param; cascade `stock_movements` real
- (novo) `POST /api/reagents/{id}/archive` — body `{ archivedBy: string }`, autoriza ADMIN+FUNCIONARIO
- (novo) `POST /api/reagents/{id}/unarchive` — autoriza ADMIN+FUNCIONARIO; re-deriva
- `POST /api/reagents/{id}/movements` — body `StockMovementRequest` ganha `unitsInStock?, unitsInUse?` para AJUSTE; `type` aceita 5 valores de escrita
- `GET /api/reagents/{id}/movements` — response inclui movimentos legados de SAIDA (read-only)
- `GET /api/reagents/labels` — projection ja muda colunas (drop `foraDeEstoque`, add `inativos`)
- `DELETE /api/reagents/tags` (legacy) — DROP
- `GET /api/reagents/export/csv` — header CSV muda
- (novo) `GET /api/users/responsibles` (ou `/api/admin/users` reaberto) — atrito 7

### SQL — schema reagent_lots

- DROP `current_stock`
- ADD `units_in_stock INTEGER NOT NULL DEFAULT 0`
- ADD `units_in_use INTEGER NOT NULL DEFAULT 0`
- ADD `archived_at TIMESTAMP WITH TIME ZONE NULL`
- ADD `archived_by VARCHAR(128) NULL`
- ADD `needs_stock_review BOOLEAN NOT NULL DEFAULT FALSE`
- ALTER `chk_reagent_lots_status` -> `IN ('em_estoque','em_uso','vencido','inativo')`
- INDEX `idx_reagent_lots_archived_at` (parcial WHERE `archived_at IS NOT NULL`)

### SQL — schema stock_movements

- ALTER `previous_stock` -> renomear/adicionar `previous_units_in_stock INTEGER`, `previous_units_in_use INTEGER`. Decidir se mantem `previous_stock` para auditoria de movimentos legados ou drop. Recomendado mantem como nullable read-only.
- DROP `quantity` ou redefinir como Double porque CONSUMO/AJUSTE em unidades agora.

### Audit log (imutavel — only adicao)

- Action existente `REAGENT_LOT_ARCHIVED` mantem nome (compat). `details->>'to'` muda de `'fora_de_estoque'` para `'inativo'`.
- Nova action `REAGENT_LOT_UNARCHIVED`.
- Nova action `REAGENT_LOT_DELETED` (hard delete).
- Action `REAGENT_STATUS_DERIVED` mantida; trigger novo `migration_v14`.
- Registros historicos com `details->>'to'='fora_de_estoque'` ou `'inativo'` (legado pre-v2) **PRESERVADOS — nao mexer**.

## Business rules and invariants

1. **Regra ternaria nao pode regredir** — `expiry < today` continua sendo regra mais forte que tudo. Lote `inativo` com expiry passada deve aparecer como `inativo` (terminal manual prevalece) OU como `vencido`? **Decidir explicitamente** (atrito 5).
2. **`inativo` e estado terminal manual** — scheduler NAO toca, ENTRADA bloqueada, AJUSTE permitido com reason. Decisao 1.
3. **Cadastrar lote ja `inativo` proibido** — `status='inativo'` no CREATE retorna 400. Decisao 2.
4. **Auditoria de transicao continua imutavel** — qualquer mutacao de status passa por `recordStatusTransition` (`ReagentService.java:721-734`). Detalhes mantem schema `{from, to, trigger, expiryDate, currentStock}` — vai precisar revisitar `currentStock` (passa a ser `unitsInStock`+`unitsInUse`).
5. **Cardinalidade UNIQUE** atualizada por hotfix 2026-05-15 para `(lotNumber, manufacturer, label)` — `label` e a etiqueta exposta no contrato HTTP/UI e armazenada como `reagent_lots.name`.
6. **Backfill de `openedDate`** — quando ABERTURA gera primeira unidade aberta, set `openedDate=today` se null (mantem semantica audit ressalva 1.7).
7. **`usedInQcRecently`** continua via `lot_number` (`ReagentService.java:160-174`); `qc_records.lot_number` nao muda.
8. **CONSUMO que zera** — apenas sugere arquivar via toast no client. Backend NAO arquiva sozinho (decisao 6 — terminal e manual).
9. **FECHAMENTO** — soma 1 em `unitsInStock`, subtrai 1 em `unitsInUse`. Se `unitsInUse == 0` antes, recusa com 400. Reason default `'reversao_abertura'` (atrito 4).
10. **AJUSTE** — exige `unitsInStock` E `unitsInUse` no payload (ambos >=0); ambos viram explicitamente os novos valores. Reason obrigatorio (mantem semantica). Permitido em `inativo`.
11. **Hard delete** — DELETE so ADMIN; cascade `stock_movements`; audit `REAGENT_LOT_DELETED` capturando snapshot completo do lote. Confirmacao por digitacao do `lotNumber` no body (`{ confirmLotNumber }`).
12. **Reativacao (unarchive)** — preserva `archivedAt`/`archivedBy` historicamente (sem zerar). Re-deriva status com regra normal — pode resultar em `vencido` se passou prazo enquanto arquivado (atrito 5).
13. **Migracao V14 mantem audit-trail** — todas as transicoes legadas geram `audit_log` com `trigger='migration_v14'` antes do UPDATE (espelho V13).
14. **`needsStockReview`** — flag tecnica, nao status. Se setada apos V14, banner UI lista lotes; usuario faz AJUSTE para zerar. Limpa quando primeiro AJUSTE acontece OU permanece ate intervencao explicita (decidir).

## Unknowns and assumptions

### Pontos de atrito ou ambiguidade (numerados como pediu o briefing)

1. **Migracao V14 — lote `vencido` legacy:** Recomendar `unitsInStock = currentStock`, `unitsInUse = 0`. Justificativa: vencido nao opera nada, mas perder a contagem inviabiliza relatorio "vencidos com estoque" do generator (`ReagentLotRepository.findExpiredWithStock`). Mapeamento simetrico ao `em_estoque`/`em_uso` reduz ramos.

2. **`stock_movements` legados com `type='SAIDA'`:** Recomendar `MovementType.ALL_READ` (todos os 6 + SAIDA) consumido por `getMovements` e `deleteMovement` (este precisa continuar revertendo SAIDA antiga); `MovementType.ALL_WRITE` (5 sem SAIDA) consumido por `createMovement`. `StockMovementRequest.type` valida apenas contra `ALL_WRITE`. Service ja tem switch — adicionar branches `ABERTURA/FECHAMENTO/CONSUMO` em `createMovement` e branches `ABERTURA/FECHAMENTO/CONSUMO/SAIDA` em `deleteMovement`.

3. **`needsStockReview`:** Recomendar **coluna no banco** (BOOLEAN NOT NULL DEFAULT FALSE). Heuristica client-side e fragil: precisaria deduzir de `audit_log` ou diferenciar lote criado-pos-V14 vs criado-pre-V14 (impraticavel sem timestamp). Coluna explicita permite limpar via PATCH/AJUSTE. Migracao V14 seta `needsStockReview = TRUE` para todo lote ex-`em_uso`.

4. **`FECHAMENTO` reason default:** Recomendar adicionar `MovementReason.REVERSAO_ABERTURA` ao enum e usar como default *quando o cliente nao envia*. NAO obrigatorio no DTO (assim diferencia "engano operacional" de "intencao explicita"). Cliente UI pre-popula com `REVERSAO_ABERTURA` no toast/botao direto.

5. **Reativar (unarchive) — status final:** Recomendar **re-derivacao normal**. Ou seja: se expiry passou enquanto arquivado, `unarchive` aplica regra ternaria e resulta em `vencido`. Coerente com decisao 1 — `inativo` e separado da regra de validade. Codigo reusa `applyDerivedStatus` (`ReagentService.java:630-647`) com trigger `unarchive`. **Bloqueante para architect:** decidir se pode existir uma regra "se total > 0, reativa como `em_estoque`/`em_uso`; senao mantem `vencido`/zera". Recomendado: `total=0` apos unarchive resulta em `em_estoque` (estoque zero NAO e mais terminal automatico).

6. **DELETE ADMIN-only:** Backend `@PreAuthorize("hasRole('ADMIN')")` no controller. Frontend precisa esconder botao quando `useAuth().user.role !== 'ADMIN'`. `ReagentsContent.tsx` linha ~466 e ~627 ganha guard. Decisao 1.

7. **Combobox responsavel — endpoint:** Tradeoff:
   - **Opcao A** — abrir `AdminController.listUsers` para FUNCIONARIO em modo filtrado: viola escopo (`AdminController` inteiro tem `@PreAuthorize("hasRole('ADMIN')")` na linha 30). Romperia separation-of-concerns.
   - **Opcao B (recomendado)** — criar `UserController.@GetMapping("/api/users/responsibles")` retornando shape minimo `{id, name, username}` filtrado por `role IN (ADMIN, FUNCIONARIO) AND isActive=true`. `@PreAuthorize("hasRole('ADMIN') or hasRole('FUNCIONARIO')")`. Sem expor `email`/`permissions`/`createdAt`. Reusa `UserRepository`. **Bloqueador security minor:** confirmar com architect que listar nomes de funcionarios para outro funcionario e aceitavel (provavel sim — mesmo pool LIMS).

8. **Literais `fora_de_estoque` em codigo vivo (drop scope):**
   - `entity/ReagentStatus.java:25-28, 43` (constante + Set + humanList)
   - `repository/ReagentLotRepository.java:67, 112, 125-128` (4 queries JPQL)
   - `controller/ReagentController.java` — comentarios em `ReagentLotResponse.java:48` e em service
   - `service/ReagentService.java:325-334, 412-432, 502, 522-528` (deleteLot arquivamento + reativacao via ENTRADA + projections)
   - `service/reports/v2/generator/impl/ReagentesRastreabilidadeGenerator.java:130, 143, 232-242` (KPI + filtro `includeInactive`)
   - `dto/response/ReagentLabelSummary.java:14` (`foraDeEstoque` field)
   - `dto/response/ReagentTagSummary.java:8` (`inativos` ja era nome legado — vai embora junto)
   - `frontend constants.ts:42, 53, 60` (3 referencias)
   - `frontend types/index.ts:212, 342` (2 ref)
   - `frontend utils.ts:9, 15, 30, 120, 143, 235-236, 281` (7 ref)
   - `frontend ReagentsContent.tsx:238, 240, 468, 475, 629, 636` (6 ref)
   - `frontend ReagentsDashboard.tsx:122, 125, 126` (3 ref)
   - `frontend ReagentesTab.tsx:233` (1 ref)
   - `frontend StatusBadge.tsx:11, 27, 38` (3 ref)
   - `frontend services/reagentService.ts:68` (comment)
   - **Tests:** `ReagentControllerTest.java:137`, `ReagentMigrationV13Test.java` (multiplos), `ReagentServiceTest.java` (multiplos), `ReagentExpirySchedulerTest.java:114-116`, `ReagentesRastreabilidadeGeneratorTest.java:67`, `ReagentesTab.test.tsx:71, 347`
   - **Migration V13** — historica, nao tocar SQL ja aplicada; manter no repositorio como auditoria.

9. **CSV export — header pos-v2:** Hoje `Etiqueta,Lote,Fabricante,Categoria,Validade,Dias Restantes,Estoque Atual,Status,Localizacao,Temperatura` (`ReagentController.java:137`). v3 quebra `Estoque Atual` em duas: `Em estoque,Em uso`. Recomendar tambem adicionar `Total` (derivado), `Arquivado em`, `Arquivado por`. Header final sugerido: `Etiqueta,Lote,Fabricante,Categoria,Validade,Dias Restantes,Em estoque,Em uso,Total,Status,Localizacao,Temperatura,Arquivado em,Arquivado por`.

10. **`StockMovementResponse.previousStock`:** Substituir por `previousUnitsInStock: Integer` + `previousUnitsInUse: Integer` (`dto/response/StockMovementResponse.java:13`). Movimentos legados (pre-V14) precisam fallback: backend mapeia `previousStock` legacy -> `previousUnitsInStock` (perdendo `unitsInUse=0`) ou retorna ambos null com flag `isLegacy: boolean`. Recomendar **fallback retroativo** (preencher `previousUnitsInStock` com `previousStock` round-down e marcar legacy=true). Audit `notes` campo `PREVIOUS_STOCK=` (`ReagentService.java:37`) NAO precisa mais ser usado para AJUSTE — limpar codigo do `extractPreviousStock`.

11. **AJUSTE com dois campos:** `StockMovementRequest` ganha `unitsInStock?: Integer` e `unitsInUse?: Integer`. Validacao: quando `type='AJUSTE'`, ambos obrigatorios e >=0. Quando `type` outro, ambos devem ser null. `quantity` ainda existe (mantem retro-compat de payload e usado por ENTRADA/CONSUMO/ABERTURA/FECHAMENTO). Documentar contrato: `quantity` nao se aplica a AJUSTE.

12. **Reports v2 — colunas:** Tabela "vencimentos proximos" (`ReagentesRastreabilidadeGenerator.java:157-171`) hoje tem coluna `Estoque` (`formatDecimal(currentStock)`). v3 substitui por duas colunas `Em estoque`/`Em uso`. Tabela "vencidos com estoque" (linhas 184-198) idem. PDFs antigos assinados sao imutaveis (decisao do v2) — apenas geracoes futuras mudam. CSV de rastreabilidade (se existir alem do `/api/reagents/export/csv` — verificar) idem.

### Assumptions a validar

- `UserRepository` ja consegue filtrar `role IN (...)` e `isActive` — confirmacao trivial mas precisa do architect. (Pode-se usar `findAllByIsActiveTrue` ou `@Query`.)
- `Permission` enum (`User.java:60`) nao tem entrada especifica para "delete reagent lot"; v3 reusa `Role.ADMIN` puro (decisao 1 do briefing). NAO criar nova permissao granular sem alinhar.
- `audit_log.details` continua sendo `json` (nao `jsonb`) conforme V13 ressalva.
- `ReagentLot.movements` cascade ALL + orphanRemoval=true (`entity/ReagentLot.java:94`) ja garante hard delete por padrao do JPA — confirmar com architect.

## Out of scope

- Mudancas em `qc_records.lot_number` (continua via lotNumber, sem FK).
- Alterar `LabSettings` ou `ReportConfiguration`.
- Mexer em PDFs assinados antigos (imutaveis — decisao v2).
- Reescrever `ReagentExpiryScheduler` — mudanca e contida em `deriveStatus`.
- Audit logs historicos com `to:'inativo'` (pre-v2) ou `to:'fora_de_estoque'` (v2) — preservados.
- `Permission` enum (nao criar nova permissao — usar `Role.ADMIN` para gate de DELETE).
- Migracao V13 — nao reescrever; v3 e V14 incremental.
- Combobox de fabricante/localizacao/fornecedor — ja virou pos `42f5b71`. Apenas garantir que nao quebra com novos campos.
- `ReagentTagSummary` removal isolado: o briefing sugere absorver no v3, mas pode ser PR separado dentro do mesmo refator. Decidir com architect (recomendo absorver — mesmo blast radius).
- Reorganizar tabs/UX da `ReagentesTab.tsx` — refator-UX e separado (vide `MEMORY.md` UX Refactor).

## Estrategia de migracao V14 (esboco — NAO SQL final)

Segue padrao da V13. Fases:

**0. Pre-condicoes (asseradas no inicio do BEGIN ou em dry-run):**
- Sem linhas com `current_stock IS NULL` (V13 nao garantiu — verificar).
- Sem linhas com `status NOT IN ('em_estoque','em_uso','fora_de_estoque','vencido')` (CHECK V13 garante).
- Sem linhas com `current_stock < 0`.

**1. Audit-log antes do UPDATE** (mesmo padrao V13:29-72) — INSERT em `audit_log` com `action='REAGENT_STATUS_TRANSITION_V3'`, `trigger='migration_v14'`, capturando `from`/`to`/`unitsInStock`/`unitsInUse` resultantes. Filtra no-op via `WHERE` final.

**2. ALTER TABLE add columns** (NULL temp, default 0/false):
- `units_in_stock INTEGER NOT NULL DEFAULT 0`
- `units_in_use INTEGER NOT NULL DEFAULT 0`
- `archived_at TIMESTAMP WITH TIME ZONE NULL`
- `archived_by VARCHAR(128) NULL`
- `needs_stock_review BOOLEAN NOT NULL DEFAULT FALSE`

**3. UPDATE deterministico (mapping da decisao 3):**
```
em_estoque  -> units_in_stock = COALESCE(current_stock,0), units_in_use = 0, status preservado
em_uso      -> units_in_stock = COALESCE(current_stock,0), units_in_use = 0, status preservado, needs_stock_review = TRUE
fora_de_estoque -> units_in_stock = 0, units_in_use = 0, status = 'inativo', archived_at = NOW(), archived_by = 'sistema-migracao-v14'
vencido     -> units_in_stock = COALESCE(current_stock,0) (recomendacao atrito 1), units_in_use = 0, status preservado
```

**4. CHECK constraint nova:**
- `DROP CONSTRAINT chk_reagent_lots_status` (V13:108)
- `ADD CONSTRAINT chk_reagent_lots_status CHECK (status IN ('em_estoque','em_uso','vencido','inativo'))`

**5. DROP COLUMN `current_stock`** ou MANTEM por 1 release? Recomendar **DROP na V14** — segue precedente da V13 (que dropou 6 colunas de uma vez). Manter coluna depreciada gera divergencia de auditoria. Janela noturna (`AccessExclusiveLock`).

**6. Indices novos:**
- `CREATE INDEX idx_reagent_lots_archived_at ON reagent_lots(archived_at) WHERE archived_at IS NOT NULL`
- `CREATE INDEX idx_reagent_lots_needs_stock_review ON reagent_lots(needs_stock_review) WHERE needs_stock_review = TRUE`

**7. ALTER `stock_movements`:**
- ADD `previous_units_in_stock INTEGER NULL`, `previous_units_in_use INTEGER NULL`
- Backfill: `UPDATE stock_movements SET previous_units_in_stock = ROUND(previous_stock)::INTEGER, previous_units_in_use = 0 WHERE previous_stock IS NOT NULL`
- DROP `previous_stock`? Recomendar **MANTER** como deprecated read-only por 1 release para compat de relatorios em PDF assinados antigos.

**8. COMMIT.** Dry-run em `db/migration/dry-run/V14_dry_run.sql` (precedente em `V13_dry_run.sql`, `V14_normalize_storage_temp_dry_run.sql`).

## Lista exata de arquivos a tocar

Marcadores: (M) modificar, (D) deletar, (N) novo.

### Backend

- (M) `biodiagnostico-api/src/main/java/com/biodiagnostico/entity/ReagentLot.java`
- (M) `biodiagnostico-api/src/main/java/com/biodiagnostico/entity/ReagentStatus.java`
- (M) `biodiagnostico-api/src/main/java/com/biodiagnostico/entity/MovementType.java`
- (M) `biodiagnostico-api/src/main/java/com/biodiagnostico/entity/MovementReason.java`
- (M) `biodiagnostico-api/src/main/java/com/biodiagnostico/entity/StockMovement.java`
- (M) `biodiagnostico-api/src/main/java/com/biodiagnostico/dto/request/ReagentLotRequest.java`
- (M) `biodiagnostico-api/src/main/java/com/biodiagnostico/dto/request/StockMovementRequest.java`
- (N) `biodiagnostico-api/src/main/java/com/biodiagnostico/dto/request/ArchiveReagentLotRequest.java` (record `{archivedBy}`)
- (N) `biodiagnostico-api/src/main/java/com/biodiagnostico/dto/request/DeleteReagentLotRequest.java` (record `{confirmLotNumber}`)
- (M) `biodiagnostico-api/src/main/java/com/biodiagnostico/dto/response/ReagentLotResponse.java`
- (M) `biodiagnostico-api/src/main/java/com/biodiagnostico/dto/response/ReagentLabelSummary.java`
- (M) `biodiagnostico-api/src/main/java/com/biodiagnostico/dto/response/StockMovementResponse.java`
- (D) `biodiagnostico-api/src/main/java/com/biodiagnostico/dto/response/ReagentTagSummary.java`
- (M) `biodiagnostico-api/src/main/java/com/biodiagnostico/repository/ReagentLotRepository.java`
- (M) `biodiagnostico-api/src/main/java/com/biodiagnostico/repository/StockMovementRepository.java` (cascade — verificar se precisa metodo extra)
- (M) `biodiagnostico-api/src/main/java/com/biodiagnostico/repository/UserRepository.java` (metodo `findActiveResponsibles()`)
- (M) `biodiagnostico-api/src/main/java/com/biodiagnostico/service/ReagentService.java`
- (M) `biodiagnostico-api/src/main/java/com/biodiagnostico/controller/ReagentController.java`
- (N) `biodiagnostico-api/src/main/java/com/biodiagnostico/controller/UserController.java` (endpoint `/api/users/responsibles`) — OU adicionar em controller existente apropriado
- (M) `biodiagnostico-api/src/main/java/com/biodiagnostico/scheduler/ReagentExpiryScheduler.java` (atualizar Javadoc; codigo provavel intacto)
- (M) `biodiagnostico-api/src/main/java/com/biodiagnostico/service/reports/v2/generator/impl/ReagentesRastreabilidadeGenerator.java`
- (M) `biodiagnostico-api/src/main/java/com/biodiagnostico/service/reports/v2/generator/ai/ReportAiPrompts.java` (opcional — terminologia)
- (M) `biodiagnostico-api/src/main/java/com/biodiagnostico/util/ResponseMapper.java` (cobre novos campos)

### Migrations

- (N) `biodiagnostico-api/src/main/resources/db/migration/V14__reagent_units_and_archive_v3.sql`
- (N) `biodiagnostico-api/src/main/resources/db/migration/dry-run/V14_dry_run.sql`

### Backend tests

- (M) `biodiagnostico-api/src/test/java/com/biodiagnostico/service/ReagentServiceTest.java`
- (M) `biodiagnostico-api/src/test/java/com/biodiagnostico/controller/ReagentControllerTest.java`
- (M) `biodiagnostico-api/src/test/java/com/biodiagnostico/scheduler/ReagentExpirySchedulerTest.java`
- (M) `biodiagnostico-api/src/test/java/com/biodiagnostico/service/ReagentMigrationV13Test.java` (atualizar contexto historico — testa V13, manter)
- (N) `biodiagnostico-api/src/test/java/com/biodiagnostico/service/ReagentMigrationV14Test.java` (mesmo padrao V13)
- (M) `biodiagnostico-api/src/test/java/com/biodiagnostico/service/reports/v2/generator/impl/ReagentesRastreabilidadeGeneratorTest.java`

### Frontend

- (M) `biodiagnostico-web/src/types/index.ts`
- (M) `biodiagnostico-web/src/components/proin/reagentes/constants.ts`
- (M) `biodiagnostico-web/src/components/proin/reagentes/schemas.ts`
- (M) `biodiagnostico-web/src/components/proin/reagentes/utils.ts`
- (M) `biodiagnostico-web/src/components/proin/reagentes/ReagentModals.tsx`
- (M) `biodiagnostico-web/src/components/proin/reagentes/ReagentsContent.tsx`
- (M) `biodiagnostico-web/src/components/proin/reagentes/ReagentsDashboard.tsx`
- (M) `biodiagnostico-web/src/components/proin/reagentes/ReagentsFilters.tsx` (status filter dropdown)
- (M) `biodiagnostico-web/src/components/proin/ReagentesTab.tsx`
- (M) `biodiagnostico-web/src/components/proin/ReagentesTab.test.tsx`
- (M) `biodiagnostico-web/src/components/ui/StatusBadge.tsx`
- (M) `biodiagnostico-web/src/services/reagentService.ts`
- (M) `biodiagnostico-web/src/hooks/useReagents.ts`
- (N) `biodiagnostico-web/src/services/userService.ts` (se nao existir — `getResponsibles`) ou (M) adicionar em `adminService.ts`
- (N) hook `useResponsibles` em `useReagents.ts` ou `useUsers.ts`

### Docs

- (N) `transicao-java/refactor-reagentes-v3/01-contract.md`
- (N) `transicao-java/refactor-reagentes-v3/02-domain-audit.md`
- (N) `transicao-java/refactor-reagentes-v3/03-qa-review.md`
- (N) `transicao-java/refactor-reagentes-v3/04-release-notes.md`
- (M) `transicao-java/DECISOES-REAGENTES.md` (apendice v3)

## Riscos cruzados

1. **`ReagentTagSummary` deprecated nunca removido** — followup do v2 PR-4 nao executado. Usado em:
   - Backend: `ReagentService.getTagSummaries()` (linhas 514-530), `ReagentController.@GetMapping("/tags")` (linhas 120-126), DTO inteiro `ReagentTagSummary.java`
   - Frontend: `types/index.ts:351-358`, `services/reagentService.ts:6, 79-82` (apenas import + funcao deprecated, nao usado em hooks ou UI)
   - **Risco:** integradores externos podem consumir `/api/reagents/tags`. Recomendar: v3 absorve a remocao com nota de breaking change. Mesma blast radius do refator de status — economiza um deploy. **Pedir confirmacao ao architect.**

2. **PDFs assinados imutaveis** — relatorios v2 ja gerados (com termo "fora de estoque") permanecem corretos historicamente. SO a partir do deploy v3 PDFs novos usam "inativo". `ReportRunRepository`/SHA chain nao impactado.

3. **`audit_log` historico** — registros com `details->>'to'='fora_de_estoque'` ou literal `'inativo'` (pre-v2) preservados. Auditor externo precisa reconhecer ambos os termos.

4. **Cardinalidade `(lotNumber, manufacturer, label)` UNIQUE** — hotfix 2026-05-15. Hard delete + recadastro do mesmo trio permite reaproveitar a chave natural; mesmo numero de lote pode coexistir quando fabricante ou etiqueta diferem.

5. **`usedInQcRecently` continua via `lot_number`** — sem mudanca em `qc_records`.

6. **Hard delete cascade `stock_movements`** — `ReagentLot.movements` ja tem `cascade=ALL, orphanRemoval=true` (`entity/ReagentLot.java:94`). JPA garante. Confirmar comportamento em FK SQL (`V1__baseline_schema.sql:236-237` nao tem `ON DELETE CASCADE` explicito — deletar via JPA funciona, deletar via SQL direto nao). Audit: `REAGENT_LOT_DELETED` deve carregar snapshot de `movements.size()` no `details`.

7. **Frontend `ReagentTagSummary` (TS) e `getTagSummaries()` (service)** — usar para varredura de codigo morto. Verificar `useReagents.ts` nao tem hook que consome `getTagSummaries` — confirmado **nao consome** (apenas `getLabelSummaries` em `useReagentLabels`). Limpeza segura.

8. **Banner `needsStockReview` UI** — primeiro acesso pos-deploy V14, todo lote ex-`em_uso` aparece com banner. UX risk: lista pode ser longa em laboratorio com 50+ lotes ativos. Recomendar limitar exibicao a 10 + "ver mais".

9. **Combobox responsavel para FUNCIONARIO** — confirmacao de privacy/security com architect. Hoje FUNCIONARIO nao ve lista de usuarios. Mudanca habilita.

10. **Toast de "sugerir arquivar"** apos CONSUMO zerar `unitsInUse` — UX simples, mas se backend tambem retornar `suggestArchive: true` no response do movimento, contrato cresce. Recomendar **client-only** (deduzir de `totalStock===0 && type==='CONSUMO'`).

## Architect required?

**Sim — obrigatorio.** Justificativas:

- Mudanca de contrato HTTP em 5 endpoints + 2 novos.
- Mudanca de schema (3 colunas novas, 1 dropada, 1 CHECK substituida, schema de movements).
- Mudanca em entidade canonica `ReagentLot` (drop campo numerico, add 5 campos).
- Mudanca em enum canonico de dominio (`ReagentStatus`, `MovementType`).
- Toca conceitos protegidos do `CLAUDE.md`: lote, historico, status de CQ (indireto via `usedInQcRecently`).
- Cross-layer: backend + frontend + migration + reports v2 + scheduler + audit_log.
- 7 ambiguidades nao resolvidas (atritos 1, 2, 3, 4, 5, 7, 11) que precisam decisao tecnica antes do `backend-engineer`/`frontend-engineer`.

## Next agent

`architect` — produzir `01-contract.md` com:
- Schema final V14 (resolve atritos 1, 3, 9).
- Contrato HTTP final (resolve atritos 2, 7, 9, 10, 11).
- Mapping table de mudanca de status (resolve atrito 5).
- Diagrama de transicoes (em_estoque <-> em_uso via ABERTURA/FECHAMENTO; * -> vencido por scheduler; * -> inativo manual; inativo -> {em_estoque,em_uso,vencido} via unarchive + re-derive).
- Politica de `MovementType` write vs read (atrito 2).
- Confirmacao de absorver remocao de `ReagentTagSummary` (risco 1).
- Decisao sobre endpoint de responsaveis (atrito 7).
- Decisao sobre `currentStock` deprecated drop imediato (V14) ou janela.

Apos `architect`, congelar contrato antes de paralelizar `backend-engineer` + `frontend-engineer` (regra de paralelismo do `CLAUDE.md`).

## Blockers para o architect

1. **Atrito 5 (unarchive — status final):** confirmar regra "re-derivacao normal incluindo `vencido` se prazo passou enquanto arquivado".
2. **Atrito 7 (combobox responsavel):** decidir entre criar `UserController` novo vs abrir `AdminController.listUsers` (recomendado: novo controller).
3. **Atrito 11 (AJUSTE com dois campos):** confirmar que `quantity` continua existindo no DTO mas e ignorado para AJUSTE.
4. **Risco 1 (`ReagentTagSummary` removal):** absorver no v3 ou empurrar para PR separado?
5. **Atrito 1 (V14 mapping de `vencido`):** confirmar `unitsInStock = COALESCE(currentStock,0)` para vencido (para preservar relatorio "vencidos com estoque").
6. **Atrito 10 (StockMovementResponse legacy):** politica de fallback para `previous_stock` legado — preencher `previous_units_in_stock` round-down ou retornar null com flag?
