# Followups — Refator Reagentes v2

> **Status:** registrado em 2026-04-27
> **Origem:** auditoria de dominio §4.3 + qa-review §6 (gaps G-03 a G-10) + recomendacao do backend-engineer
> **Tipo:** issues paralelas, nao-bloqueantes para o release atual
> **Owner:** orchestrator deve abrir tickets correspondentes em ferramenta de tracking (Linear/Jira/GitHub Issues) usando o conteudo abaixo

Cada item esta em formato pronto para colar como descricao de issue.

---

## Issue 1 — KPI de consumo derivado de StockMovement (audit §1.11 + §4.3.3)

**Titulo:** Reintroduzir KPI de consumo de reagentes derivado de StockMovement
**Severidade:** MEDIUM
**Origem:** auditoria de dominio refator-reagentes-v2 ressalva 1.11 + bloqueante §4.3.3

**Contexto:**
A refatoracao v2 dropou a coluna `estimated_consumption` (preenchida manualmente pelo usuario) e removeu a secao "Consumo estimado por categoria" do PDF `ReagentesRastreabilidadeGenerator`. Auditores externos (ANVISA RDC 302) podem solicitar projecao de duracao de estoque vs validade em inspecoes futuras.

**Objetivo:**
Substituir o KPI antigo (manual) por um KPI derivado e auditavel: agregar `StockMovement` com `type='SAIDA'` por categoria/janela (30, 60, 90 dias), calcular `consumo_diario_medio = total_saidas / dias`, projetar `dias_restantes_em_estoque = current_stock / consumo_diario_medio`. Exibir no dashboard de Reagentes e no PDF de Rastreabilidade.

**Aceite:**
- [ ] Service novo `ReagentConsumptionService` com metodo `computeConsumption(category, window)`.
- [ ] Endpoint `GET /api/reagents/consumption?category={c}&window={30|60|90}` retornando `ReagentConsumptionResponse`.
- [ ] Card no dashboard frontend mostrando "Consumo medio (30d)" por categoria.
- [ ] Secao de PDF reabilitada em `ReagentesRastreabilidadeGenerator` lendo do novo service.
- [ ] Teste regulatorio: lote com 5 SAIDAs em 30d -> consumo = soma/30.

**Prazo sugerido:** antes da proxima inspecao formal ANVISA (acompanhar calendario regulatorio).

**Arquivos relevantes:**
- `biodiagnostico-api/src/main/java/com/biodiagnostico/service/reports/v2/generator/impl/ReagentesRastreabilidadeGenerator.java:200-205` (comentario inline TODO)
- `biodiagnostico-api/src/main/java/com/biodiagnostico/entity/StockMovement.java`
- `biodiagnostico-api/src/main/java/com/biodiagnostico/repository/StockMovementRepository.java`

---

## Issue 2 — Endpoints de catalogo unico (categorias e temperaturas)

**Titulo:** Eliminar drift estrutural com `GET /api/reagents/categories` e `/storage-temps`
**Severidade:** MEDIUM
**Origem:** sugestao do backend-engineer apos resolver G-01 e G-02

**Contexto:**
G-01 e G-02 do qa-review foram corrigidos alinhando 3 fontes manualmente (`ReagentService.ALLOWED_CATEGORIES`, `ReportDefinitionRegistry.REAGENT_CATEGORIES`, `biodiagnostico-web/src/components/proin/reagentes/constants.ts`). Mantem-se risco de drift futuro: alguem adiciona categoria em uma das 3 listas e esquece das outras.

**Objetivo:**
Adicionar 2 endpoints que retornem a lista canonica do backend, e ter o frontend consumir via hook (`useReagentCategories`, `useReagentTemps`) com cache. `ReportDefinitionRegistry.REAGENT_CATEGORIES` passa a derivar de `ReagentService.ALLOWED_CATEGORIES`.

**Aceite:**
- [ ] `GET /api/reagents/categories` retornando `string[]` em ordem canonica.
- [ ] `GET /api/reagents/storage-temps` retornando `string[]`.
- [ ] Frontend hooks `useReagentCategories` e `useReagentTemps` com `staleTime: Infinity`.
- [ ] `constants.ts:CATEGORIES` e `TEMPS` removidos (consumidores migram para hook).
- [ ] `ReportDefinitionRegistry.REAGENT_CATEGORIES` deriva via expressao Java de `ReagentService.ALLOWED_CATEGORIES`.
- [ ] Teste E2E: dropdown da UI sempre tem o mesmo conjunto que o validador do backend.

**Arquivos relevantes:**
- `biodiagnostico-api/src/main/java/com/biodiagnostico/service/ReagentService.java:54-65, 76-81`
- `biodiagnostico-api/src/main/java/com/biodiagnostico/service/reports/v2/catalog/ReportDefinitionRegistry.java:37-48`
- `biodiagnostico-web/src/components/proin/reagentes/constants.ts:16-33`
- `biodiagnostico-web/src/services/reagentService.ts`

---

## Issue 3 — Remover dead code: chartRenderer em ReagentesRastreabilidadeGenerator

**Titulo:** Remover injecao de `ChartRenderer` orfao em `ReagentesRastreabilidadeGenerator`
**Severidade:** LOW
**Origem:** qa-review G-07 + audit §1.11

**Contexto:**
A secao "Consumo estimado por categoria" foi removida na refatoracao v2 mas a dependencia `ChartRenderer chartRenderer` continua declarada como campo final, recebida no construtor (linhas 60, 68, 75), e atribuida em `this.chartRenderer = chartRenderer`. Spring resolve a dependencia mas nada chama metodos dela em `renderPdf`.

**Decisao:** remover apenas se a Issue 1 (KPI consumo derivado) for cancelada permanentemente. Se Issue 1 esta no roadmap, **manter** o chartRenderer (ele sera necessario para regenerar a secao). Avaliar trimestralmente.

**Aceite (caso confirmado para remocao):**
- [ ] Remover `private final ChartRenderer chartRenderer;` (linha 60).
- [ ] Remover parametro do construtor (linha 68) e atribuicao (linha 75).
- [ ] Atualizar testes que mockam o construtor.
- [ ] `mvn test` passa.

**Arquivos relevantes:**
- `biodiagnostico-api/src/main/java/com/biodiagnostico/service/reports/v2/generator/impl/ReagentesRastreabilidadeGenerator.java:60, 68, 75`
- `biodiagnostico-api/src/test/java/com/biodiagnostico/service/reports/v2/generator/impl/ReagentesRastreabilidadeGeneratorTest.java`

---

## Issue 4 — Aviso runtime de `getTagSummaries` deprecated

**Titulo:** Adicionar `console.warn` runtime em `reagentService.getTagSummaries()` deprecated
**Severidade:** LOW
**Origem:** qa-review G-08

**Contexto:**
`reagentService.ts:74-82` marca o metodo com `@deprecated` em JSDoc, mas nao emite aviso quando chamado em runtime. Algum dev pode adicionar nova chamada ao alias por engano (especialmente em codigo gerado por IA).

**Objetivo:**
Adicionar `console.warn` na primeira linha do metodo, alertando que deve usar `getLabelSummaries`. Adicionalmente, considerar regra ESLint custom (`no-deprecated-api`) que sinalize chamadas a metodos com `@deprecated` em projeto.

**Aceite:**
- [ ] `console.warn('[Biodiagnostico] reagentService.getTagSummaries() esta deprecated. Use getLabelSummaries() em vez disso. Removido em PR-4.')` na linha 1 do metodo.
- [ ] Teste vitest verificando que console.warn e chamado.
- [ ] Issue follow-up para regra ESLint (opcional).

**Arquivos relevantes:**
- `biodiagnostico-web/src/services/reagentService.ts:74-82`

---

## Issue 5 — Migracao V14 condicional para normalizar `storage_temp` legado

**Titulo:** V14 condicional — normalizar `storage_temp` para formato com graus + parenteses
**Severidade:** MEDIUM (depende de saida do dry-run)
**Origem:** sugestao gerada pelo dry-run; arquivo `dry-run/V14_normalize_storage_temp_dry_run.sql` ja preparado

**Contexto:**
Refator v2 alinhou `ALLOWED_STORAGE_TEMPS` com formato com graus (`2-8°C`). Lotes pre-existentes podem ter sido inseridos com formato legado (`2-8C` sem graus, `Ambiente` sem range). Validador atual rejeita lotes com formato legado em UPDATE — entao um lote pre-existente em formato legado nao pode ser editado sem corrigir manualmente o `storage_temp`.

**Decisao operacional:**
1. Rodar `V14_normalize_storage_temp_dry_run.sql` em staging com `pg_dump` recente.
2. Se a saida indicar `count = 0` -> nenhuma acao, fechar issue.
3. Se a saida indicar `count > 0` -> criar `V14__normalize_storage_temp.sql` Flyway-versionado com `UPDATE` mapeando formatos legados para canonicos. **Executar em janela noturna** apos comunicar operadores.

**Mapping sugerido:**
```
'2-8C'           -> '2-8°C'
'15-25C'         -> '15-25°C (Ambiente)'
'Ambiente'       -> '15-25°C (Ambiente)'
'-20C'           -> '-20°C'
'-80C'           -> '-80°C'
```

**Aceite (condicional ao dry-run):**
- [ ] Dry-run `V14_normalize_storage_temp_dry_run.sql` rodado em staging.
- [ ] Se count > 0: criar `V14__normalize_storage_temp.sql` com UPDATE + audit_log entries.
- [ ] Validacao pos-V14: `SELECT DISTINCT storage_temp FROM reagent_lots` so retorna valores em `ALLOWED_STORAGE_TEMPS`.
- [ ] Audit_log com `action='REAGENT_STORAGE_TEMP_NORMALIZED'`, `from=<legado>`, `to=<canonico>`, `trigger='v14_normalize'`.

**Arquivos relevantes:**
- `biodiagnostico-api/src/main/resources/db/migration/dry-run/V14_normalize_storage_temp_dry_run.sql`
- `biodiagnostico-api/src/main/java/com/biodiagnostico/service/ReagentService.java:76-81` (lista canonica)

---

## Issue 6 — Diferenciacao "esgotado vivo" vs "arquivado" no dashboard (G-04)

**Titulo:** Badge visual "Arquivado" para lotes em `fora_de_estoque` via `deleteLot`
**Severidade:** MEDIUM
**Origem:** qa-review G-04

**Contexto:**
Tanto `deleteLot` (acao administrativa) quanto SAIDA total (movimento operacional) deixam o lote em `status='fora_de_estoque'`. O dashboard (`dashFilter='foraDeEstoque'`) mostra ambos misturados. Operador nao distingue lote em uso ativo (apenas zerado) de lote arquivado intencionalmente.

**Objetivo:**
Adicionar campo `archived: boolean` no `ReagentLotResponse`, populado pelo backend a partir de `audit_log` (presenca de `REAGENT_LOT_ARCHIVED` apos a ultima ENTRADA). Frontend exibe badge "Arquivado" amarelo no card.

**Aceite:**
- [ ] `ReagentLotResponse.archived: boolean` (computado no `ResponseMapper`).
- [ ] Logica: `archived = exists(audit_log WHERE entity_id = lot.id AND action = 'REAGENT_LOT_ARCHIVED' AND created_at > lastEntradaAt)`.
- [ ] Badge "Arquivado" no `ReagentLotCard` quando `archived=true`.
- [ ] Filtro adicional `dashFilter='archived'` mostra apenas arquivados.
- [ ] Teste backend e frontend.

**Arquivos relevantes:**
- `biodiagnostico-api/src/main/java/com/biodiagnostico/util/ResponseMapper.java:181`
- `biodiagnostico-api/src/main/java/com/biodiagnostico/service/ReagentService.java:307-317` (deleteLot)
- `biodiagnostico-web/src/components/proin/reagentes/ReagentsContent.tsx`

---

## Issue 7 — Testcontainers para `ReagentMigrationV13Test` (G-03)

**Titulo:** Adicionar Testcontainers + Postgres para teste real da V13
**Severidade:** MEDIUM
**Origem:** qa-review G-03 + audit §3.3

**Contexto:**
`ReagentMigrationV13Test.java:36-55` reimplementa o CASE da V13 em Java puro. NAO sobe Postgres real. Drift entre o SQL real e a funcao `v13Target()` pode passar despercebido.

**Objetivo:**
Adicionar dependencia Testcontainers ao `pom.xml`, fazer o teste subir Postgres efemero, aplicar Flyway, fazer seed pre-V13 com mix dos 5 status legados, executar Flyway, conferir invariantes pos-V13.

**Aceite:**
- [ ] `pom.xml` com `testcontainers-postgres` (escopo test).
- [ ] `@Testcontainers` em `ReagentMigrationV13Test`.
- [ ] Test seed com 1 lote em cada status legado + 1 vencido.
- [ ] Apos `flyway.migrate()`, validar:
  - `SELECT COUNT(*) WHERE status NOT IN (4 novos)` = 0.
  - `chk_reagent_lots_status` rejeita INSERT com status legado.
  - 6 colunas dropadas.
  - audit_log com `trigger='quarentena_removed_v2'` para cada transicao.
- [ ] Tempo de execucao do test suite nao aumenta > 30s.

**Arquivos relevantes:**
- `biodiagnostico-api/pom.xml`
- `biodiagnostico-api/src/test/java/com/biodiagnostico/service/ReagentMigrationV13Test.java`

---

## Issue 8 — Indice em `audit_log(entity_type, entity_id)` (audit ressalva E)

**Titulo:** Criar `idx_audit_log_entity` para acelerar `findByEntityTypeAndEntityId`
**Severidade:** LOW
**Origem:** auditoria de dominio refator-reagentes-v2 ressalva E (debito pre-existente)

**Contexto:**
`AuditLogRepository.findByEntityTypeAndEntityId(...)` faz seq scan na tabela `audit_log`. Volume hoje e baixo, mas cresce monotonicamente. Refator v2 nao causa o problema mas chama atencao para ele.

**Aceite:**
- [ ] Migracao Flyway `Vxx__index_audit_log_entity.sql` com `CREATE INDEX CONCURRENTLY idx_audit_log_entity ON audit_log(entity_type, entity_id)`.
- [ ] Validar via `EXPLAIN ANALYZE` que a query passa a usar o indice.

**Arquivos relevantes:**
- `biodiagnostico-api/src/main/java/com/biodiagnostico/repository/AuditLogRepository.java`
- `biodiagnostico-api/src/main/resources/db/migration/`

---

## Resumo

| # | Titulo | Severidade | Bloqueante prox. inspecao? |
|---|---|---|---|
| 1 | KPI consumo derivado | MEDIUM | SIM (ANVISA RDC 302) |
| 2 | Endpoints de catalogo unico | MEDIUM | nao |
| 3 | Remover chartRenderer dead code | LOW | nao |
| 4 | Console.warn para getTagSummaries | LOW | nao |
| 5 | V14 condicional storage_temp | MEDIUM | depende do dry-run |
| 6 | Badge "Arquivado" | MEDIUM | nao |
| 7 | Testcontainers V13 | MEDIUM | nao (defesa em profundidade) |
| 8 | Indice audit_log entity | LOW | nao |

Issues 1, 5 e 7 tem prazo regulatorio ou tecnico mais curto. Issues 3, 4 e 8 sao limpeza/melhoria que podem aguardar refactor-engineer.
