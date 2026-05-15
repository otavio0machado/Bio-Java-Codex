# Contract — Refatoracao Reagentes v3 (CONGELADO)

> **Status:** CONGELADO
> **Insumo:** `transicao-java/refactor-reagentes-v3/00-context-pack.md`
> **Baseline herdado:** `transicao-java/refactor-reagentes-v2/01-contract.md` (CONGELADO) + `02-domain-audit.md` (APROVADO_COM_RESSALVAS)
> **Supersede:** `transicao-java/DECISOES-REAGENTES.md` REAG-ADR-001/002 (registrar como historico — nao deletar)
> **Proximo agente:** `domain-auditor` (validar invariantes regulatorios da v3) e em paralelo `backend-engineer` + `frontend-engineer` (apos audit)

Este documento congela o contrato que `backend-engineer` e `frontend-engineer` consumirao em paralelo. Reabertura exige outra rodada do orchestrator. v3 incrementa v2 — v2 permanece como historico imutavel para auditoria.

---

## 1. Decisoes de design (12 questoes + 6 blockers)

As 12 decisoes vieram pre-resolvidas pelo orchestrator no inicio do `00-context-pack.md`. Os 6 blockers que o `context-engineer` levantou tambem chegaram resolvidos pelo orchestrator (cabecalho do prompt). Esta secao congela tudo numerado.

### 1.1 Domínio do enum de status — drop `fora_de_estoque`, add `inativo`
**Decisao: CONGELADO.** Conjunto canonico: `{ em_estoque, em_uso, vencido, inativo }`. `inativo` e **estado terminal manual** — nao auto-derivado. Estoque zero sem validade vencida NAO vira mais terminal automatico; o lote permanece `em_estoque` com `unitsInStock=0` (defesa: continua aparecendo na listagem ate ENTRADA, AJUSTE ou arquivamento manual).

### 1.2 Estoque per-unit — drop `currentStock: Double`, add `unitsInStock` + `unitsInUse`
**Decisao: CONGELADO.** Inteiros nao-negativos. Total derivado: `totalUnits = unitsInStock + unitsInUse`. Tipo `Integer` (nao `int`) na entidade para defesa NPE — mas DTO valida `@NotNull @Min(0)`.

### 1.3 Novos `MovementType` — ABERTURA, FECHAMENTO, CONSUMO, AJUSTE, ENTRADA
**Decisao: CONGELADO.** Particionamento:
- `MovementType.ALL_WRITE = { ENTRADA, ABERTURA, FECHAMENTO, CONSUMO, AJUSTE }` — aceitos em `POST /movements`.
- `MovementType.ALL_READ = { ENTRADA, SAIDA, AJUSTE, ABERTURA, FECHAMENTO, CONSUMO }` — incluir SAIDA legacy nas listagens/historico para preservar movimentos pre-V14.
- `SAIDA` permanece no enum (nao apagar valor) e em `stock_movements.type` historicos. Backend recusa SAIDA em `createMovement` com 400 explicito ("tipo SAIDA descontinuado — use CONSUMO").

### 1.4 Separacao Arquivar vs Apagar
**Decisao: CONGELADO.** Operacoes distintas:
- Arquivar (soft) → `POST /api/reagents/{id}/archive` → status=`inativo`, set `archivedAt`/`archivedBy`. Permissao: ADMIN ou FUNCIONARIO. Audit `REAGENT_LOT_ARCHIVED`.
- Reativar → `POST /api/reagents/{id}/unarchive` → re-deriva status pela regra ternaria (validade × estoque × abertura). `archivedAt`/`archivedBy` permanecem (historico). Permissao: ADMIN ou FUNCIONARIO. Audit `REAGENT_LOT_UNARCHIVED`.
- Apagar (hard) → `DELETE /api/reagents/{id}` → cascade `stock_movements`. **Permissao: ADMIN.** Confirmacao por digitacao do `lotNumber` no body. Audit `REAGENT_LOT_DELETED`.

### 1.5 Combobox de responsavel — endpoint dedicado
**Decisao: CONGELADO (blocker 2 do orchestrator).** Novo endpoint `GET /api/users/responsibles`. RBAC: qualquer autenticado (ADMIN ou FUNCIONARIO). Retorna apenas `[{id, name, username, role}]` filtrando `role IN (ADMIN, FUNCIONARIO) AND isActive=true`. NAO expor `email`, `passwordHash`, `permissions`, `createdAt`. Endpoint separado existe pra que FUNCIONARIO possa arquivar sem ganhar permissao sobre `/api/admin/users`.

**Justificativa:** abrir `AdminController.listUsers` violaria escopo (controller inteiro tem `@PreAuthorize("hasRole('ADMIN')")`). Endpoint novo, payload minimo, RBAC aderente.

### 1.6 AJUSTE — DTO com dois alvos explicitos
**Decisao: CONGELADO (blocker 3 do orchestrator).** `StockMovementRequest` ganha:
- `targetUnitsInStock: Integer?` (NotNull + Min 0 quando `type=AJUSTE`; ignorado nos demais)
- `targetUnitsInUse: Integer?` (idem)

`quantity: Double` permanece — usado por ENTRADA (delta a adicionar em `unitsInStock`) e CONSUMO (delta a subtrair de `unitsInUse`). ABERTURA e FECHAMENTO **ignoram quantity** (sempre `q=1`, semantica unitaria — backend forca `q=1` mesmo se cliente enviar valor diferente, com audit nota).

**Reason** continua obrigatorio em AJUSTE (mantem invariante v2). FECHAMENTO usa default `REVERSAO_ABERTURA` quando reason nao enviado.

### 1.7 Unarchive — status final
**Decisao: CONGELADO (blocker 1 do orchestrator).** Re-derivacao normal pela regra ternaria:
- Se `expiry < hoje` → `vencido`.
- Senao se `unitsInUse > 0` → `em_uso`.
- Senao se `unitsInStock > 0` → `em_estoque`.
- Senao (zero/zero) → `em_estoque` (estoque zero deixou de ser terminal automatico).

`archivedAt` e `archivedBy` PRESERVADOS (historico imutavel). Audit `REAGENT_LOT_UNARCHIVED` registra `{ reason?, fromStatus:'inativo', toStatus, archivedAtPreserved, archivedByPreserved }`.

### 1.8 Migracao V14 — vencido legacy
**Decisao: CONGELADO (blocker 5 do orchestrator).** Lotes pre-V14 em `vencido` migram com:
- `unitsInStock = COALESCE(currentStock, 0)`
- `unitsInUse = 0`
- `status` mantido como `vencido`
- `needsStockReview = FALSE` (vencido nao opera, nao precisa revisar)

Justificativa: preserva relatorio "vencidos com estoque" do `ReagentesRastreabilidadeGenerator` apos V14. Vencido nao opera, mas nao se pode descartar a contagem.

### 1.9 `StockMovementResponse` — retroatividade
**Decisao: CONGELADO (blocker 6 do orchestrator).** Coexistencia:
- `previousStock: Double?` permanece preenchido em movimentos pre-V14, **NULL** em movimentos pos-V14.
- `previousUnitsInStock: Integer?` e `previousUnitsInUse: Integer?` sao NULL em movimentos pre-V14, preenchidos em movimentos pos-V14.

Frontend escolhe qual exibir pelo `createdAt` do movimento ou pelo tipo (movimentos com type=SAIDA sempre legacy). NAO retroagir — preencher `previousUnitsInStock = ROUND(previousStock)` para movimentos antigos quebraria reconstrucao auditavel (perderia o `unitsInUse=0` implicito que e fisicamente errado para SAIDA antiga).

### 1.10 `ReagentTagSummary` — drop absorvido em v3
**Decisao: CONGELADO (blocker 4 do orchestrator).** Absorver no v3:
- DROP DTO `dto/response/ReagentTagSummary.java`.
- DROP endpoint `GET /api/reagents/tags` (alias deprecated do v2 PR-4 nunca executado).
- DROP service method `ReagentService.getTagSummaries()`.
- DROP TS type `ReagentTagSummary`.
- DROP function `reagentService.getTagSummaries()` em `services/reagentService.ts`.
- Quem ainda chama `/api/reagents/tags` recebe **404**. Documentar como breaking change no release notes (mesma janela do refator v3 — blast radius unico).

### 1.11 DELETE — permissao ADMIN-only e confirmacao
**Decisao: CONGELADO.** `@PreAuthorize("hasRole('ADMIN')")`. Body opcional `{ confirmLotNumber: String }` (NotBlank). Service compara `request.confirmLotNumber.trim()` com `lot.lotNumber.trim()` (case-insensitive false — matching exato, ANVISA-grade). Mismatch → 400. Audit `REAGENT_LOT_DELETED` com snapshot completo do lote (`{ id, label, lotNumber, manufacturer, category, expiryDate, unitsInStock, unitsInUse, status, archivedAt, archivedBy, movementsCount }`).

### 1.12 `needsStockReview` — flag tecnica persistida
**Decisao: CONGELADO.** Coluna boolean `reagent_lots.needs_stock_review` (NOT NULL DEFAULT FALSE). V14 seta `TRUE` para todo lote ex-`em_uso` (estoque ambiguo — nao se sabe se ja tinha unidade aberta). Banner UI lista esses lotes no topo da aba. Limpa para FALSE quando:
- Service `archiveLot` arquiva o lote (ato de arquivar resolve a revisao pendente).
- Service `createMovement` aplica AJUSTE ou ABERTURA no lote (revisao explicita).

CONSUMO/ENTRADA/FECHAMENTO **nao limpam** a flag (porque nao corrigem a ambiguidade da migracao). PUT do lote tambem nao limpa — flag e tecnica, nao editavel direto.

### Resumo dos 6 blockers (todos CONGELADOS)

1. ✅ Unarchive → re-derivacao ternaria (decisao 1.7).
2. ✅ Combobox responsavel → `GET /api/users/responsibles` (decisao 1.5).
3. ✅ AJUSTE DTO → `targetUnitsInStock?`/`targetUnitsInUse?` (decisao 1.6).
4. ✅ `ReagentTagSummary` removal absorvido em v3 (decisao 1.10).
5. ✅ V14 vencido legacy → `unitsInStock=COALESCE(currentStock,0)` (decisao 1.8).
6. ✅ `StockMovementResponse` retroatividade → coexistencia, sem backfill (decisao 1.9).

---

## 2. Schema final pos-V14

### 2.1 Tabela `reagent_lots` pos-V14 (DDL conceitual)

| Coluna | Tipo | Null | Default | Notas |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK (sem mudanca) |
| `name` | TEXT | NOT NULL | — | Mantida no DB. Re-rotulada como `label` no contrato (heranca v2). |
| `lot_number` | TEXT | NOT NULL | — | Sem mudanca. Chave operacional. |
| `manufacturer` | TEXT | NOT NULL | — | NOT NULL desde V13. Sem mudanca. |
| `category` | TEXT | NULL | — | Sem mudanca. |
| `expiry_date` | DATE | NOT NULL | — | NOT NULL desde V13. Sem mudanca. |
| `current_stock` | DOUBLE PRECISION | — | — | **DROP na V14.** Sem deprecated period (segue precedente da V13). |
| `units_in_stock` | INTEGER | NOT NULL | `0` | **NEW.** Quantidade fechada em estoque. |
| `units_in_use` | INTEGER | NOT NULL | `0` | **NEW.** Quantidade aberta em uso. |
| `archived_at` | DATE | NULL | — | **NEW.** Data do arquivamento (quando `status='inativo'`). Histórico — preservada mesmo apos unarchive. |
| `archived_by` | VARCHAR(128) | NULL | — | **NEW.** Username/nome do responsavel pelo arquivamento. Histórico — preservado mesmo apos unarchive. |
| `needs_stock_review` | BOOLEAN | NOT NULL | `FALSE` | **NEW.** Flag tecnica pos-migracao V14. |
| `storage_temp` | TEXT | NULL | — | Sem mudanca. |
| `status` | TEXT | NOT NULL | `'em_estoque'` | **CHECK substituido na V14** — ver 2.3. |
| `location` | TEXT | NULL | — | Sem mudanca. |
| `supplier` | TEXT | NULL | — | Sem mudanca. |
| `received_date` | DATE | NULL | — | Sem mudanca. |
| `opened_date` | DATE | NULL | — | Sem mudanca. Setado por ABERTURA quando primeira unidade abre (decisao 1.6 herdada de v2). |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | Sem mudanca. |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `now()` | Sem mudanca. |

**Tipo de `archived_at`:** `DATE` (nao `TIMESTAMPTZ`). Justificativa: o usuario informa data calendario no modal de arquivamento (`max=today`, `default=today`). Hora exata do clique nao tem valor regulatorio — auditoria fina vai em `audit_log.created_at` que e TIMESTAMPTZ.

### 2.2 Indices

| Indice | Estado | Notas |
|---|---|---|
| `reagent_lots_pkey` (id) | mantem | — |
| `idx_reagent_lot_natural_key` em `(LOWER(TRIM(lot_number)), LOWER(TRIM(COALESCE(manufacturer,''))), LOWER(TRIM(name)))` | **V16 / hotfix 2026-05-15** | Substitui a unicidade antiga por lote+fabricante. `name` e a etiqueta exposta como `label`; lotes com mesmo numero podem coexistir quando fabricante ou etiqueta diferem. |
| `idx_reagent_lots_status` em `(status)` | mantem | Continua util com novo dominio. |
| `idx_reagent_lots_expiry_date` em `(expiry_date)` | mantem | Inalterado. |
| `idx_reagent_lots_name` em `(name)` | mantem | Inalterado. |
| `idx_reagent_lots_archived_at` em `(archived_at)` WHERE `archived_at IS NOT NULL` | **novo (V14)** | Indice parcial — acelera filtro "lotes arquivados" sem custo em lotes ativos. |
| `idx_reagent_lots_needs_stock_review` em `(needs_stock_review)` WHERE `needs_stock_review = TRUE` | **novo (V14)** | Indice parcial — acelera banner "pendencias de revisao" no frontend. Some apos migracao ser sanada (todas as flags zeradas). |

### 2.3 CHECK constraints

```sql
-- DROP constraint do v2 (status com 'fora_de_estoque')
ALTER TABLE reagent_lots DROP CONSTRAINT chk_reagent_lots_status;

-- ADD constraint nova (status v3)
ALTER TABLE reagent_lots
  ADD CONSTRAINT chk_reagent_lots_status
  CHECK (status IN ('em_estoque', 'em_uso', 'vencido', 'inativo'));

-- ADD constraints de unidades (defesa em profundidade alem do @Min(0) do DTO)
ALTER TABLE reagent_lots
  ADD CONSTRAINT chk_reagent_lots_units_in_stock_nonneg
  CHECK (units_in_stock >= 0);
ALTER TABLE reagent_lots
  ADD CONSTRAINT chk_reagent_lots_units_in_use_nonneg
  CHECK (units_in_use >= 0);
```

A constraint nova de status **nao** roda antes do UPDATE de migracao (senao quebra). Ordem em 3.2 trata isso.

### 2.4 Tabela `stock_movements` pos-V14

| Coluna | Tipo | Null | Default | Notas |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK |
| `reagent_lot_id` | UUID | NOT NULL | — | FK → reagent_lots(id). FK SQL **sem ON DELETE CASCADE** (V1 baseline) — JPA cascade ALL + orphanRemoval=true cobre o hard delete via service. |
| `type` | TEXT | NOT NULL | — | **CHECK substituido na V14** — ver abaixo. |
| `quantity` | DOUBLE PRECISION | NOT NULL | `0` | Mantido (compat). Para AJUSTE/ABERTURA/FECHAMENTO `quantity` e ignorado — recomendado gravar `0` (AJUSTE) ou `1` (ABERTURA/FECHAMENTO) para historico legivel. |
| `responsible` | TEXT | NOT NULL | — | Sem mudanca. |
| `notes` | TEXT | NULL | — | Sem mudanca. |
| `reason` | TEXT | NULL | — | Sem mudanca. |
| `previous_stock` | DOUBLE PRECISION | NULL | — | **MANTEM** como deprecated read-only. NULL para movimentos pos-V14. Preenchido em movimentos pre-V14 (audit historico). |
| `previous_units_in_stock` | INTEGER | NULL | — | **NEW.** NULL para movimentos pre-V14. Preenchido em movimentos pos-V14. |
| `previous_units_in_use` | INTEGER | NULL | — | **NEW.** NULL para movimentos pre-V14. Preenchido em movimentos pos-V14. |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | Sem mudanca. |

**CHECK constraint nova em type:**
```sql
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS chk_stock_movements_type;  -- se existir
ALTER TABLE stock_movements
  ADD CONSTRAINT chk_stock_movements_type
  CHECK (type IN ('ENTRADA','SAIDA','AJUSTE','ABERTURA','FECHAMENTO','CONSUMO'));
```

`SAIDA` mantido para legados — nunca produzido pos-V14, mas ainda aceito em SELECT.

### 2.5 audit_log — sem mudanca de schema

Apenas novas actions e novos triggers:

**Actions novas:**
- `REAGENT_LOT_DELETED` (hard delete) — details: snapshot completo do lote.
- `REAGENT_LOT_UNARCHIVED` (re-deriva apos arquivamento).
- `REAGENT_OPENED_DATE_DERIVED` (renomeacao do `REAGENT_OPENED_DATE_BACKFILLED` da v2 — `domain-auditor` v2 ressalva 1.7 mantida; trigger especifico `abertura`).

**Actions reaproveitadas:**
- `REAGENT_LOT_ARCHIVED` — mesmo nome canonico desde v2. Em v3 `details->>'to'` passa a ser `'inativo'` em vez de `'fora_de_estoque'`. Registros historicos com `'inativo'` (pre-v2) ou `'fora_de_estoque'` (v2) PRESERVADOS — sem retroacao.
- `REAGENT_STATUS_DERIVED` — continua para transicoes automaticas. Triggers ampliados: agora pode ser `abertura`, `fechamento`, `consumo`, `entrada`, `ajuste`, `unarchive`, `migration_v14`.
- `REAGENT_MOVEMENT_BLOCKED` — continua. `reason` agora pode ser `'lote_inativo'` (ENTRADA, ABERTURA, FECHAMENTO em inativo) ou `'lote_vencido'` (ENTRADA em vencido).

**Action especial de migracao:**
- `REAGENT_STATUS_TRANSITION_V3` (analoga a `REAGENT_STATUS_DERIVED` mas com nome especifico para isolar V14 em queries de auditoria) — usada apenas pela V14, com `trigger='migration_v14'`. Detalhes: `{ from, to, fromUnitsInStock, fromUnitsInUse, expiryDate }`.

---

## 3. Migracao V14 — especificacao

### 3.1 Pre-requisitos

- V13 aplicada (verificavel em `flyway_schema_history`).
- Backup completo da base.
- `dry-run.sql` em `db/migration/dry-run/V14_dry_run.sql` rodado em staging com snapshot recente. Saida revisada por `release-engineer`.
- Sem linhas com `current_stock IS NULL` (V13 nao garantiu — verificar no dry-run).
- Sem linhas com `current_stock < 0` (CHECK V13 nao cobre — verificar no dry-run).
- Sem linhas com `status NOT IN ('em_estoque','em_uso','fora_de_estoque','vencido')` (CHECK V13 garante por construcao).

### 3.2 Ordem das operacoes (single Flyway file `V14__reagent_units_and_archive_v3.sql`)

```text
BEGIN;

-- 1) Audit log das transicoes ANTES do UPDATE.
--    Para cada lote com status que mudara (apenas 'fora_de_estoque' -> 'inativo'),
--    inserir 1 linha em audit_log com action='REAGENT_STATUS_TRANSITION_V3',
--    trigger='migration_v14', from=lot.status, to=<derived>.
--    Para lotes que nao mudam de status (em_estoque, em_uso, vencido), NAO loga
--    transicao (no-op de status), mas a transicao de SCHEMA (currentStock -> units)
--    e implicita e nao precisa entry por linha — o release notes documenta.
INSERT INTO audit_log (id, user_id, action, entity_type, entity_id, details, created_at)
SELECT
    gen_random_uuid(),
    NULL,
    'REAGENT_STATUS_TRANSITION_V3',
    'ReagentLot',
    r.id,
    json_build_object(
        'from', r.status,
        'to', 'inativo',
        'trigger', 'migration_v14',
        'fromCurrentStock', COALESCE(r.current_stock, 0)::text,
        'toUnitsInStock', '0',
        'toUnitsInUse', '0',
        'expiryDate', r.expiry_date::text
    ),
    NOW()
FROM reagent_lots r
WHERE r.status = 'fora_de_estoque';

-- 2) ALTER TABLE add columns (com DEFAULT para popular linhas existentes).
ALTER TABLE reagent_lots
  ADD COLUMN units_in_stock INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN units_in_use INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN archived_at DATE NULL,
  ADD COLUMN archived_by VARCHAR(128) NULL,
  ADD COLUMN needs_stock_review BOOLEAN NOT NULL DEFAULT FALSE;

-- 3) ALTER TABLE add columns em stock_movements.
ALTER TABLE stock_movements
  ADD COLUMN previous_units_in_stock INTEGER NULL,
  ADD COLUMN previous_units_in_use INTEGER NULL;

-- 4) UPDATE deterministico (mapping decisao 3 do orchestrator).
--    Ordem das clausulas espelha a tabela 3.3.
UPDATE reagent_lots SET
    units_in_stock = CASE
        WHEN status = 'em_estoque'      THEN COALESCE(current_stock, 0)::INTEGER
        WHEN status = 'em_uso'          THEN COALESCE(current_stock, 0)::INTEGER
        WHEN status = 'fora_de_estoque' THEN 0
        WHEN status = 'vencido'         THEN COALESCE(current_stock, 0)::INTEGER
        ELSE 0
    END,
    units_in_use = 0,
    needs_stock_review = CASE
        WHEN status = 'em_uso' THEN TRUE
        ELSE FALSE
    END,
    archived_at = CASE
        WHEN status = 'fora_de_estoque' THEN CURRENT_DATE
        ELSE NULL
    END,
    archived_by = CASE
        WHEN status = 'fora_de_estoque' THEN 'sistema-migracao-v14'
        ELSE NULL
    END,
    status = CASE
        WHEN status = 'fora_de_estoque' THEN 'inativo'
        ELSE status
    END
WHERE status IN ('em_estoque','em_uso','fora_de_estoque','vencido');

-- 5) Trocar CHECK constraint de status.
ALTER TABLE reagent_lots DROP CONSTRAINT chk_reagent_lots_status;
ALTER TABLE reagent_lots
  ADD CONSTRAINT chk_reagent_lots_status
  CHECK (status IN ('em_estoque','em_uso','vencido','inativo'));

-- 6) Add CHECK constraints de unidades nao-negativas.
ALTER TABLE reagent_lots
  ADD CONSTRAINT chk_reagent_lots_units_in_stock_nonneg
  CHECK (units_in_stock >= 0);
ALTER TABLE reagent_lots
  ADD CONSTRAINT chk_reagent_lots_units_in_use_nonneg
  CHECK (units_in_use >= 0);

-- 7) Add CHECK constraint do type de movement (substitui qualquer constraint anterior).
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS chk_stock_movements_type;
ALTER TABLE stock_movements
  ADD CONSTRAINT chk_stock_movements_type
  CHECK (type IN ('ENTRADA','SAIDA','AJUSTE','ABERTURA','FECHAMENTO','CONSUMO'));

-- 8) DROP COLUMN current_stock (sem deprecated period — segue precedente V13).
ALTER TABLE reagent_lots DROP COLUMN current_stock;

-- 9) Indices novos.
CREATE INDEX IF NOT EXISTS idx_reagent_lots_archived_at
  ON reagent_lots(archived_at) WHERE archived_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reagent_lots_needs_stock_review
  ON reagent_lots(needs_stock_review) WHERE needs_stock_review = TRUE;

COMMIT;
```

**Notas de ordem:**

- INSERT audit (passo 1) precede UPDATE (passo 4) e DROP COLUMN (passo 8) — referencia `r.current_stock` que ainda existe.
- ADD COLUMN (passo 2) precede UPDATE (passo 4) — colunas precisam existir antes do SET.
- DROP CHECK status (passo 5) precede UPDATE de status para `'inativo'` (passo 4)? **NAO — a ordem correta e:** UPDATE primeiro (passo 4) escreve `'inativo'`. Mas `'inativo'` ainda nao esta no CHECK antigo (v2 tinha `'fora_de_estoque'`, nao `'inativo'`). Ordem real correta:
  - Passo 5 deve vir ANTES do passo 4 (DROP CHECK antigo, depois UPDATE livre, depois ADD CHECK novo)
  - Reordenacao: passos `1, 2, 3, 5(DROP CHECK), 4(UPDATE), 5(ADD CHECK NOVO), 6, 7, 8, 9`.
- `release-engineer` materializa o SQL final respeitando essa reordenacao. O dry-run executa identicamente com `BEGIN/ROLLBACK` para validar antes do deploy.

### 3.3 Mapeamento determinístico (canonico)

Aplicar dentro do UPDATE — **uma regra por linha**:

| # | Status atual | unitsInStock | unitsInUse | needsStockReview | archivedAt | archivedBy | status final | Audit |
|---|---|---|---|---|---|---|---|---|
| 1 | `em_estoque` | `COALESCE(current_stock,0)::INTEGER` | 0 | FALSE | NULL | NULL | `em_estoque` | (no-op de status — sem audit por linha; release notes documenta migracao schema) |
| 2 | `em_uso` | `COALESCE(current_stock,0)::INTEGER` | 0 | **TRUE** | NULL | NULL | `em_uso` | (no-op de status — sem audit por linha) |
| 3 | `fora_de_estoque` | 0 | 0 | FALSE | `CURRENT_DATE` | `'sistema-migracao-v14'` | **`inativo`** | `REAGENT_STATUS_TRANSITION_V3`, trigger=migration_v14 |
| 4 | `vencido` | `COALESCE(current_stock,0)::INTEGER` | 0 | FALSE | NULL | NULL | `vencido` | (no-op de status — sem audit por linha) |

**Justificativa por linha:**
- Linha 1: lote fechado em estoque. `unitsInUse=0` por construcao (nunca foi aberto).
- Linha 2: lote em uso, mas estoque ambiguo (cliente nao distinguia fechado vs aberto). Toda quantidade vai para `unitsInStock` (defensivo), e `needsStockReview=TRUE` para forcar revisao manual via AJUSTE/ABERTURA. Justificativa: quando usuario primeiro abrir o modal pos-V14, o banner amarelo lista todos esses lotes para reclassificacao.
- Linha 3: `fora_de_estoque` no v2 era estado terminal (estoque zero sem validade vencida). v3 absorve isso em `inativo` (terminal manual). `archivedBy='sistema-migracao-v14'` documenta a origem da transicao.
- Linha 4: vencido nao opera, mas preservar contagem para "vencidos com estoque" (decisao 1.8).

### 3.4 Drop de `current_stock` — sem janela depreciada

Igual precedente V13 (que dropou 6 colunas em uma migracao). Operadores externos consumindo o campo recebem 500 — comunicado obrigatorio no release notes.

### 3.5 Dry-run — shape exato

Arquivo: `db/migration/dry-run/V14_dry_run.sql`. Padrao identico ao `V13_dry_run.sql`.

```sql
BEGIN;

-- A) Distribuicao por status -> destino V14.
SELECT
    r.status AS current_status,
    COUNT(*) AS row_count,
    CASE
        WHEN r.status = 'em_estoque'      THEN 'em_estoque'
        WHEN r.status = 'em_uso'          THEN 'em_uso'
        WHEN r.status = 'fora_de_estoque' THEN 'inativo'
        WHEN r.status = 'vencido'         THEN 'vencido'
        ELSE 'UNKNOWN'
    END AS target_status,
    SUM(CASE WHEN r.status = 'em_uso' THEN 1 ELSE 0 END) AS will_have_needs_stock_review_true
FROM reagent_lots r
GROUP BY current_status, target_status
ORDER BY current_status;

-- B) Reagentes com current_stock NULL ou negativo (bloqueador).
SELECT COUNT(*) AS reagents_with_null_stock
FROM reagent_lots WHERE current_stock IS NULL;

SELECT COUNT(*) AS reagents_with_negative_stock
FROM reagent_lots WHERE current_stock < 0;

-- C) Reagentes com status fora do dominio v2 (bloqueador — V13 deveria ter cuidado).
SELECT COUNT(*) AS reagents_unknown_status
FROM reagent_lots
WHERE status NOT IN ('em_estoque','em_uso','fora_de_estoque','vencido');

-- D) Stock_movements com type fora do dominio (deve ser 0 ou apenas 'SAIDA' historicos).
SELECT type, COUNT(*) AS movement_count
FROM stock_movements
GROUP BY type
ORDER BY type;

ROLLBACK;
```

**Bloqueadores de deploy — release-engineer aborta se:**
- (B) `reagents_with_null_stock > 0` ou `reagents_with_negative_stock > 0`.
- (C) `reagents_unknown_status > 0`.
- (D) Qualquer `type` fora do conjunto `{ ENTRADA, SAIDA, AJUSTE, ABERTURA, FECHAMENTO, CONSUMO }`.

### 3.6 Idempotencia e recovery

- Flyway gerencia `flyway_schema_history`. V14 nunca reroda apos sucesso.
- BEGIN/COMMIT envolve toda a migracao — falha no meio = rollback automatico Postgres.
- Apos falha, limpar entrada FAILED: `DELETE FROM flyway_schema_history WHERE version = '14' AND success = false;`. Re-deployar.
- DROP COLUMN nao e reversivel trivialmente. Politica de rollback: restore do backup pre-deploy + revert do PR consolidado v3.

---

## 4. Contrato HTTP (DTOs e endpoints)

### 4.1 Endpoints MODIFICADOS

#### `POST /api/reagents` — cadastro de lote

**Request:** `ReagentLotRequest` (drop `currentStock`, add `unitsInStock` + `unitsInUse`).

```
ReagentLotRequest {
  // 9 obrigatorios canonicos — mantidos da v2
  label: String         @NotBlank @Size(max=255)
  lotNumber: String     @NotBlank @Size(max=255)
  manufacturer: String  @NotBlank @Size(max=128)
  category: String      @NotBlank
  expiryDate: LocalDate @NotNull
  status: String        @NotBlank   // 'em_estoque'|'em_uso'|'vencido'  (NAO aceita 'inativo')
  location: String      @NotBlank @Size(max=128)
  storageTemp: String   @NotBlank

  // mudanca v3: drop currentStock
  unitsInStock: Integer @NotNull @Min(0)
  unitsInUse: Integer   @NotNull @Min(0)

  // 3 opcionais — mantidos
  supplier: String?     @Size(max=128)
  receivedDate: LocalDate?
  openedDate: LocalDate?
}
```

**Validacoes adicionais cross-field (service):**
- `category` em `CategoryRegistry.ALL`.
- `storageTemp` em `StorageTempRegistry.ALL`.
- `(lotNumber, manufacturer, label)` unico — 400/409 conforme handler; duplicidade so quando numero do lote, fabricante e etiqueta coincidirem.
- `receivedDate <= openedDate <= expiryDate` quando ambas presentes.
- `expiryDate < hoje` → service forca `status='vencido'` (preserva semantica v2).
- **NOVO v3:** `request.status == 'inativo'` → 400 com mensagem `"Status 'inativo' nao pode ser definido em CREATE/UPDATE — use POST /archive."`.
- **NOVO v3:** se `unitsInUse > 0 AND openedDate IS NULL` → service grava `openedDate=today` antes do save (semantica de abertura, mantem audit `REAGENT_OPENED_DATE_DERIVED` com trigger `createLot`).

**Response:** 201 + `ReagentLotResponse`. Erros: 400, 409.

#### `PUT /api/reagents/{id}` — edicao de lote

Mesmo `ReagentLotRequest`. Mesmas validacoes do CREATE. Adicionalmente:
- **NOVO v3:** `request.status == 'inativo'` → 400 (mesma mensagem do CREATE). Forca uso de `POST /archive`.
- Se lote estava `inativo` e o request muda status → 400 (`"Lote arquivado nao pode ser editado diretamente — reative com POST /unarchive"`).
- `applyOpenedDateOnUseTransition` mantido. Audit `REAGENT_OPENED_DATE_DERIVED` com trigger=`updateLot`.

**Response:** 200 + `ReagentLotResponse`. Erros: 400, 404, 409.

#### `GET /api/reagents` — listagem

Query params `category`, `status`, `label`, `search` mantidos. **Mudanca v3:** `status` aceita `{ em_estoque, em_uso, vencido, inativo }`. Defesa: se receber `fora_de_estoque` (legado v2), retorna 400 com mensagem `"Status legado 'fora_de_estoque' descontinuado — use 'inativo'."`.

**Response:** 200 + `ReagentLotResponse[]`.

#### `ReagentLotResponse` — schema final v3

```
ReagentLotResponse {
  id: UUID
  label: String
  lotNumber: String
  manufacturer: String
  category: String?
  expiryDate: LocalDate
  storageTemp: String?
  status: String                          // 'em_estoque'|'em_uso'|'vencido'|'inativo'
  location: String?
  supplier: String?
  receivedDate: LocalDate?
  openedDate: LocalDate?
  createdAt: Instant
  updatedAt: Instant

  // mudanca v3: drop currentStock, add tres campos
  unitsInStock: Integer
  unitsInUse: Integer
  totalUnits: Integer                     // derivado: unitsInStock + unitsInUse

  // novos v3
  archivedAt: LocalDate?
  archivedBy: String?
  needsStockReview: Boolean

  // derivados — mantidos da v2 com ajustes
  daysLeft: long
  nearExpiry: boolean
  usedInQcRecently: boolean
  traceabilityComplete: boolean
  traceabilityIssues: String[]
  canReceiveEntry: boolean                // false em vencido E em inativo
  allowedMovementTypes: String[]          // depende de status — ver tabela 5.x
  movementWarning: String?
}
```

**Saem:** `currentStock`, `stockPct`, `daysToRupture` (esse ultimo ja saiu em v2).

#### `POST /api/reagents/{id}/movements` — criar movimento

**Request:** `StockMovementRequest` (modificado).

```
StockMovementRequest {
  type: 'ENTRADA'|'AJUSTE'|'ABERTURA'|'FECHAMENTO'|'CONSUMO'   @NotBlank
  quantity: Double                 @NotNull @Min(0)   // ignorado em ABERTURA/FECHAMENTO/AJUSTE; usado em ENTRADA/CONSUMO
  responsible: String              @NotBlank
  notes: String?
  reason: String?                  // obrigatorio em AJUSTE; default REVERSAO_ABERTURA em FECHAMENTO

  // novos campos v3 — obrigatorios apenas em AJUSTE
  targetUnitsInStock: Integer?     @Min(0)   // @NotNull (cross-field) quando type=AJUSTE
  targetUnitsInUse: Integer?       @Min(0)   // @NotNull (cross-field) quando type=AJUSTE
}
```

`SAIDA` **nao aceito** em CREATE — request com `type=SAIDA` retorna 400 com mensagem `"Movimento SAIDA descontinuado — use CONSUMO."`. Mas `SAIDA` ainda lido em GET (legados).

**Response:** 201 + `StockMovementResponse`. Erros: 400 (validacao + bloqueio status), 404, 409.

#### `GET /api/reagents/{id}/movements` — listagem de movimentos

**Response:** `StockMovementResponse[]` com novo shape.

```
StockMovementResponse {
  id: UUID
  reagentLotId: UUID
  type: String                       // pode ser ENTRADA, SAIDA(legado), AJUSTE, ABERTURA, FECHAMENTO, CONSUMO
  quantity: Double
  responsible: String
  notes: String?
  reason: String?
  createdAt: Instant

  // mudanca v3: tres campos com regra de coexistencia
  previousStock: Double?             // preenchido em movimentos pre-V14, NULL pos-V14
  previousUnitsInStock: Integer?     // NULL pre-V14, preenchido pos-V14
  previousUnitsInUse: Integer?       // NULL pre-V14, preenchido pos-V14

  // derivado pelo response mapper para o frontend usar facil
  isLegacy: Boolean                  // = (previousStock != null AND previousUnitsInStock == null)
}
```

#### `GET /api/reagents/export/csv` — header novo

Header v3 (ordem canonica):
```
Etiqueta,Lote,Fabricante,Categoria,Validade,Dias Restantes,Em Estoque,Em Uso,Total,Status,Localizacao,Temperatura,Arquivado em,Arquivado por
```

Saem: `Estoque Atual` (substituido por `Em Estoque,Em Uso,Total`).
Entram: `Em Estoque`, `Em Uso`, `Total`, `Arquivado em`, `Arquivado por`.

`Status` mantem nome canonico em portugues amigavel: `Em estoque`, `Em uso`, `Vencido`, `Inativo`. UTF-8 + BOM mantido.

#### `DELETE /api/reagents/{id}` — permissao + confirmacao

**Permissao:** `@PreAuthorize("hasRole('ADMIN')")`. Nao aceita FUNCIONARIO.

**Body:**
```
DeleteReagentLotRequest {
  confirmLotNumber: String   @NotBlank @Size(max=255)
}
```

**Service:**
- Comparar `request.confirmLotNumber.trim() == lot.lotNumber.trim()` (matching exato, case-sensitive). Mismatch → 400.
- **Bloqueio:** se `usedInQcRecently == true` → 400 com mensagem `"Lote utilizado em CQ recente nao pode ser apagado. Use POST /archive em vez disso."` (NOVA regra de seguranca v3 — protege auditoria CQ).
- Cascade `stock_movements` via JPA cascade ALL + orphanRemoval=true.
- Audit `REAGENT_LOT_DELETED` com snapshot completo.

**Response:** 204. Erros: 400 (mismatch ou usedInQcRecently), 403 (nao-ADMIN), 404.

### 4.2 Endpoints NOVOS

#### `POST /api/reagents/{id}/archive` — arquivar lote

**Permissao:** `@PreAuthorize("hasRole('ADMIN') or hasRole('FUNCIONARIO')")`.

**Body:**
```
ArchiveReagentLotRequest {
  archivedAt: LocalDate     @NotNull   // service valida <= hoje
  archivedBy: String        @NotBlank @Size(max=128)
}
```

**Validacoes service:**
- `archivedAt <= today` (nao aceita data futura).
- `archivedBy` deve existir em `users` ativo com role ∈ {ADMIN, FUNCIONARIO}. Mismatch → 400.
- Lote ja `inativo` → 400 (`"Lote ja arquivado em <archivedAt>"`).

**Mutacoes:**
- `lot.status = 'inativo'`
- `lot.archivedAt = request.archivedAt`
- `lot.archivedBy = request.archivedBy`
- `lot.needsStockReview = false` (ato de arquivar resolve a revisao pendente — decisao 1.12)

**Audit:** `REAGENT_LOT_ARCHIVED` com `details = { archivedAt, archivedBy, fromStatus: <old>, toStatus: 'inativo', unitsInStockAtArchive, unitsInUseAtArchive }`.

**Response:** 200 + `ReagentLotResponse` (status='inativo'). Erros: 400, 403, 404.

#### `POST /api/reagents/{id}/unarchive` — reativar lote

**Permissao:** `@PreAuthorize("hasRole('ADMIN') or hasRole('FUNCIONARIO')")`.

**Body (opcional):**
```
UnarchiveReagentLotRequest {
  reason: String?   @Size(max=256)
}
```

**Validacoes service:**
- Lote deve estar `inativo` → mismatch → 400 (`"Lote nao esta arquivado"`).

**Mutacoes:**
- `lot.status = deriveStatus(lot, today)` — re-aplica regra ternaria (decisao 1.7).
- `lot.archivedAt` PRESERVADO (nao zera).
- `lot.archivedBy` PRESERVADO (nao zera).
- `lot.needsStockReview` permanece igual (provavelmente FALSE pos-archive).

**Audit:** `REAGENT_LOT_UNARCHIVED` com `details = { reason, fromStatus:'inativo', toStatus, archivedAtPreserved: lot.archivedAt, archivedByPreserved: lot.archivedBy, unitsInStock, unitsInUse, expiryDate }`.

**Response:** 200 + `ReagentLotResponse` (status novo). Erros: 400, 403, 404.

#### `GET /api/users/responsibles` — combobox de responsavel

**Permissao:** `@PreAuthorize("isAuthenticated()")` (qualquer usuario logado, ADMIN ou FUNCIONARIO).

**Sem query params.**

**Response:** 200 + `ResponsibleSummary[]` ordenado por `name ASC`.

```
ResponsibleSummary {
  id: UUID
  name: String
  username: String
  role: String        // 'ADMIN' | 'FUNCIONARIO'
}
```

Filtro repository: `role IN (ADMIN, FUNCIONARIO) AND isActive = TRUE`. **NAO expor:** `email`, `passwordHash`, `permissions`, `createdAt`, `lastLoginAt`.

Sem cache HTTP — invalida sempre que ha mutacao em `users`.

### 4.3 Endpoints REMOVIDOS

- `GET /api/reagents/tags` — alias deprecated do v2 PR-4 que nunca aconteceu. v3 dropa. Quem chamar recebe **404**. Documentar no release notes como breaking change.

### 4.4 Endpoints com PERMISSAO MODIFICADA

- `DELETE /api/reagents/{id}` — passa de `hasRole('ADMIN') or hasRole('FUNCIONARIO')` para `hasRole('ADMIN')`. FUNCIONARIO que tentar deletar recebe 403.

### 4.5 Endpoints inalterados

- `POST /api/reagents/{id}/movements` — formato muda (4.1) mas endpoint URL/method igual.
- `GET /api/reagents/labels` — sem mudanca (continua retornando `ReagentLabelSummary[]`).
- `GET /api/reagents/by-lot-number?lotNumber=` — sem mudanca.
- `GET /api/reagents/expiring?days=` — query do repository ajustada para `status NOT IN ('vencido','inativo')` (era `('vencido','fora_de_estoque')`).

---

## 5. Service: regras de transicao em pseudocodigo

### 5.1 `deriveStatus(lot, today)` — regra ternaria atualizada

```text
deriveStatus(lot, today):
    if lot is null: return null

    // 1) Inativo e terminal manual — nunca auto-deriva.
    if lot.status == 'inativo':
        return 'inativo'

    // 2) Validade — regra mais forte que estoque.
    if lot.expiryDate != null AND lot.expiryDate < today:
        return 'vencido'

    // 3) Em uso tem precedencia sobre em_estoque (alguem ja abriu unidade).
    if lot.unitsInUse > 0:
        return 'em_uso'

    // 4) Tem estoque fechado, nao ha unidade aberta.
    if lot.unitsInStock > 0:
        return 'em_estoque'

    // 5) Caso esquisito: zero/zero. Nao vira terminal automatico.
    //    Mantem o status anterior (provavelmente em_estoque). UI mostra
    //    com unidades zeradas e usuario decide arquivar manualmente.
    return lot.status  // tipicamente 'em_estoque'
```

**Diferencas chave em relacao ao v2:**
- Sem clausula `if estoque == 0 then 'fora_de_estoque'`. Estoque zero NAO e mais terminal automatico.
- Nova clausula 1: `inativo` e respeitado (terminal manual prevalece).
- `unitsInUse > 0` substitui `openedDate != null` como sinal de "em uso" — mais preciso e diretamente observavel.

### 5.2 `applyDerivedStatus(lot, today, trigger)` — orquestracao

```text
applyDerivedStatus(lot, today, trigger):
    if lot is null: return
    if lot.status == 'inativo': return   // terminal manual — nao toca

    oldStatus = lot.status
    derived   = deriveStatus(lot, today)

    if derived == 'em_uso' AND lot.openedDate is null:
        lot.openedDate = today
        auditService.log('REAGENT_OPENED_DATE_DERIVED', lot.id,
            { openedDate: today, trigger, fromStatus: oldStatus, toStatus: 'em_uso' })

    if oldStatus == derived: return   // no-op

    lot.status = derived
    auditService.log('REAGENT_STATUS_DERIVED', lot.id,
        { from: oldStatus, to: derived, trigger,
          unitsInStock: lot.unitsInStock, unitsInUse: lot.unitsInUse,
          expiryDate: lot.expiryDate })
```

### 5.3 `createMovement(lotId, request)` — branches por tipo

Validacoes comuns antes do switch:
- `lot = findById(lotId)` — 404 se nao existir.
- `request.type` em `MovementType.ALL_WRITE`. SAIDA → 400.
- `request.responsible` NotBlank.
- AJUSTE: `targetUnitsInStock != null AND targetUnitsInUse != null AND reason NotBlank`.

```text
createMovement(lotId, request):
    lot = findById(lotId)
    type = request.type
    prevStock = lot.unitsInStock
    prevUse   = lot.unitsInUse

    switch (type):
        case ENTRADA:
            if lot.status == 'inativo' OR lot.status == 'vencido':
                audit('REAGENT_MOVEMENT_BLOCKED',
                    { reason: lot.status == 'inativo' ? 'lote_inativo' : 'lote_vencido',
                      movementType: 'ENTRADA' })
                throw BusinessException("Lote " + lot.status + " nao aceita ENTRADA.")
            if request.quantity <= 0:
                throw BusinessException("ENTRADA exige quantity > 0.")
            lot.unitsInStock = lot.unitsInStock + (int) request.quantity

        case ABERTURA:
            if lot.status == 'inativo' OR lot.status == 'vencido':
                audit('REAGENT_MOVEMENT_BLOCKED', { reason, movementType: 'ABERTURA' })
                throw BusinessException("Lote " + lot.status + " nao aceita ABERTURA.")
            if lot.unitsInStock < 1:
                throw BusinessException("Sem unidades fechadas para abrir.")
            lot.unitsInStock = lot.unitsInStock - 1
            lot.unitsInUse   = lot.unitsInUse   + 1
            // Forca quantity=1 para historico
            request.quantity = 1.0
            // openedDate gravado por applyDerivedStatus se virou em_uso

        case FECHAMENTO:
            if lot.status == 'inativo' OR lot.status == 'vencido':
                audit('REAGENT_MOVEMENT_BLOCKED', { reason, movementType: 'FECHAMENTO' })
                throw BusinessException("Lote " + lot.status + " nao aceita FECHAMENTO.")
            if lot.unitsInUse < 1:
                throw BusinessException("Sem unidades em uso para retornar ao estoque.")
            lot.unitsInUse   = lot.unitsInUse   - 1
            lot.unitsInStock = lot.unitsInStock + 1
            request.quantity = 1.0
            if blank(request.reason):
                request.reason = 'REVERSAO_ABERTURA'   // default sem prompt
            // openedDate NAO mexido — fechamento e reversao de engano, lote ja estava aberto

        case CONSUMO:
            if lot.status == 'inativo':
                audit('REAGENT_MOVEMENT_BLOCKED',
                    { reason: 'lote_inativo', movementType: 'CONSUMO' })
                throw BusinessException("Lote inativo nao aceita CONSUMO.")
            // VENCIDO permite CONSUMO (descarte registrado).
            if request.quantity <= 0:
                throw BusinessException("CONSUMO exige quantity > 0.")
            if lot.unitsInUse < (int) request.quantity:
                throw BusinessException("Estoque em uso insuficiente para CONSUMO.")
            lot.unitsInUse = lot.unitsInUse - (int) request.quantity
            // Se zera, NAO arquiva. Frontend exibe toast sugerindo POST /archive.
            // needsStockReview NAO e limpo em CONSUMO.

        case AJUSTE:
            // permitido em todos os status, INCLUSIVE inativo
            if blank(request.reason):
                throw BusinessException("AJUSTE exige reason.")
            if request.targetUnitsInStock == null OR request.targetUnitsInUse == null:
                throw BusinessException("AJUSTE exige targetUnitsInStock e targetUnitsInUse.")
            if request.targetUnitsInStock < 0 OR request.targetUnitsInUse < 0:
                throw BusinessException("AJUSTE exige unidades >= 0.")
            lot.unitsInStock = request.targetUnitsInStock
            lot.unitsInUse   = request.targetUnitsInUse
            // AJUSTE limpa needsStockReview (revisao explicita).
            lot.needsStockReview = false
            request.quantity = 0.0   // historico legivel

    // Apos switch:
    if lot.status != 'inativo':
        applyDerivedStatus(lot, today, type.toLowerCase())  // 'entrada','abertura',etc

    save(lot)

    movement = StockMovement.builder()
        .reagentLot(lot)
        .type(type)
        .quantity(request.quantity)
        .responsible(request.responsible)
        .notes(request.notes)
        .reason(request.reason)
        .previousStock(null)                       // pos-V14 sempre NULL
        .previousUnitsInStock(prevStock)
        .previousUnitsInUse(prevUse)
        .build()
    save(movement)
    return movement
```

**Notas:**
- ABERTURA/FECHAMENTO/AJUSTE em `inativo` → ABERTURA e FECHAMENTO bloqueados; **AJUSTE permitido**. Justificativa: AJUSTE pode ser correcao posterior sem reativar (ex: erro de contagem antes do arquivamento). UI alerta mas nao bloqueia.
- Apos `archive`, lote `inativo` nao deriva status automatico (`applyDerivedStatus` faz early return).

### 5.4 `archiveLot(id, archivedAt, archivedBy)`

```text
archiveLot(id, archivedAt, archivedBy):
    lot = findById(id)
    if lot.status == 'inativo':
        throw BusinessException("Lote ja arquivado em " + lot.archivedAt)

    if archivedAt > today:
        throw BusinessException("archivedAt nao pode ser data futura")

    if NOT userRepository.existsActiveResponsible(archivedBy):
        throw BusinessException("Responsavel '" + archivedBy + "' nao encontrado ou inativo")

    fromStatus = lot.status
    lot.status = 'inativo'
    lot.archivedAt = archivedAt
    lot.archivedBy = archivedBy
    lot.needsStockReview = false   // ato de arquivar resolve revisao pendente
    save(lot)

    audit('REAGENT_LOT_ARCHIVED', lot.id,
        { archivedAt, archivedBy, fromStatus, toStatus: 'inativo',
          unitsInStockAtArchive: lot.unitsInStock,
          unitsInUseAtArchive: lot.unitsInUse,
          expiryDate: lot.expiryDate })

    return lot
```

`userRepository.existsActiveResponsible(archivedBy)` busca por `username` (se for o caso) ou `name`. Convencao: aceitar `username` como input (mais estavel que `name`). Backend mapeia para nome canonico ao gravar (campo armazenado e o que o usuario digitou — preserva trilha; mas o existence check e por username).

### 5.5 `unarchiveLot(id, reason)`

```text
unarchiveLot(id, reason):
    lot = findById(id)
    if lot.status != 'inativo':
        throw BusinessException("Lote nao esta arquivado")

    fromStatus = 'inativo'
    // Re-deriva sem chamar applyDerivedStatus (que tem early return em inativo).
    // Aplica regra ternaria explicitamente.
    if lot.expiryDate != null AND lot.expiryDate < today:
        derived = 'vencido'
    else if lot.unitsInUse > 0:
        derived = 'em_uso'
    else if lot.unitsInStock > 0:
        derived = 'em_estoque'
    else:
        derived = 'em_estoque'   // zero/zero — nao volta para terminal

    lot.status = derived
    // archivedAt e archivedBy PRESERVADOS — nao zera (historico imutavel)
    save(lot)

    audit('REAGENT_LOT_UNARCHIVED', lot.id,
        { reason, fromStatus, toStatus: derived,
          archivedAtPreserved: lot.archivedAt,
          archivedByPreserved: lot.archivedBy,
          unitsInStock: lot.unitsInStock,
          unitsInUse: lot.unitsInUse,
          expiryDate: lot.expiryDate })

    return lot
```

### 5.6 `deleteLot(id, confirmLotNumber)` — hard delete

```text
deleteLot(id, confirmLotNumber):
    lot = findById(id)

    if confirmLotNumber.trim() != lot.lotNumber.trim():
        throw BusinessException("Confirmacao do lote nao confere")

    usedInQc = qcRecordRepository.existsByLotNumberOperational(lot.lotNumber)
    if usedInQc:
        // Bloqueio v3 — nao deixa apagar lote com historico CQ
        audit('REAGENT_DELETE_BLOCKED', lot.id,
            { reason: 'used_in_qc_recently', lotNumber: lot.lotNumber })
        throw BusinessException("Lote utilizado em CQ recente nao pode ser apagado. Use POST /archive em vez disso.")

    movementsCount = stockMovementRepository.countByReagentLotId(id)

    snapshot = {
        id: lot.id, label: lot.name, lotNumber: lot.lotNumber,
        manufacturer: lot.manufacturer, category: lot.category,
        expiryDate: lot.expiryDate, unitsInStock: lot.unitsInStock,
        unitsInUse: lot.unitsInUse, status: lot.status,
        archivedAt: lot.archivedAt, archivedBy: lot.archivedBy,
        movementsCount, deletedAt: now
    }

    audit('REAGENT_LOT_DELETED', lot.id, snapshot)   // ANTES do delete fisico

    deleteById(id)   // JPA cascade ALL + orphanRemoval=true → stock_movements removidos

    return void
```

**Importante:** audit ocorre **antes** do delete fisico para garantir que o registro de auditoria sobreviva mesmo se o delete falhar (audit_log nao tem FK em reagent_lots por design).

### 5.7 Helpers derivados — `canReceiveEntry` e `allowedMovementTypes`

```text
canReceiveEntry(lot):
    return lot.status NOT IN ('vencido', 'inativo')

allowedMovementTypes(lot):
    if lot.status == 'inativo': return ['AJUSTE']                          // so ajuste
    if lot.status == 'vencido':
        return ['CONSUMO', 'AJUSTE']                                       // descarte + ajuste
    if lot.unitsInStock > 0 AND lot.unitsInUse > 0:
        return ['ENTRADA', 'ABERTURA', 'FECHAMENTO', 'CONSUMO', 'AJUSTE']
    if lot.unitsInStock > 0:
        return ['ENTRADA', 'ABERTURA', 'AJUSTE']                           // sem unidade aberta — nao pode FECHAR/CONSUMIR
    if lot.unitsInUse > 0:
        return ['ENTRADA', 'FECHAMENTO', 'CONSUMO', 'AJUSTE']              // sem unidade fechada — nao pode ABRIR
    // zero/zero
    return ['ENTRADA', 'AJUSTE']
```

`movementWarning` derivado em paralelo: se `lot.status == 'vencido'`, `"Lote vencido — apenas CONSUMO (descarte) e AJUSTE permitidos."`. Se `inativo`, `"Lote arquivado — apenas AJUSTE permitido."`. Senao `null`.

---

## 6. Frontend: contrato visual e estado

### 6.1 Modal de Cadastro/Editar — campos de estoque

`ReagentModals.tsx`. O campo unico "Quantidade atual" da v2 vira **dois inputs** lado a lado:

```
+------------------------------------------------------------+
| SECAO 2: Estoque & Status                                  |
|  +-----------------------+  +------------------------+     |
|  | [Em estoque*]         |  | [Em uso*]              |     |
|  | Input number, min=0   |  | Input number, min=0    |     |
|  +-----------------------+  +------------------------+     |
|     Total: <calculado>  (read-only, abaixo dos dois)       |
|                                                             |
|  [Status*]   Select(em_estoque|em_uso|vencido)             |
|              (NUNCA mostra opcao 'inativo')                |
|  [Validade*] Input date                                     |
+------------------------------------------------------------+
```

Validacao zod: `unitsInStock: z.number().int().min(0)`, `unitsInUse: z.number().int().min(0)`.

### 6.2 Card do lote — botoes diretos

`ReagentsContent.tsx`. Linha de estoque:
```
📦 Em estoque: <X>  ·  🔓 Em uso: <Y>  ·  Total: <Z>
```

Botoes diretos no card (sem abrir modal de movimento):
- **"🔓 Abrir unidade"** — chama `POST /movements` com `{ type: 'ABERTURA', quantity: 1 }`. Habilitado se `unitsInStock >= 1` E status NOT IN (vencido, inativo). Sucesso: toast "Unidade aberta."
- **"🔒 Voltar ao estoque"** — chama `POST /movements` com `{ type: 'FECHAMENTO', quantity: 1, reason: 'REVERSAO_ABERTURA' }`. Habilitado se `unitsInUse >= 1` E status NOT IN (vencido, inativo). Sucesso: toast "Unidade retornada ao estoque."

Botoes grandes — design proposital para evitar acidentes.

Botoes secundarios (mantidos do v2):
- **"Movimentar"** — abre modal completo com 5 tipos.
- **"Historico"** — modal de movimentos.
- **"Editar"** — modal de edicao (nao mostra `inativo` no select).

Botoes condicionais:
- **"Arquivar"** — visivel quando `status != 'inativo'`. Abre modal arquivar (6.3).
- **"Reativar lote"** — visivel quando `status == 'inativo'`. Abre confirmacao simples + chamada `POST /unarchive` com reason opcional.
- **"Apagar"** — visivel APENAS para `useAuth().user.role === 'ADMIN'` E `usedInQcRecently == false`. Abre modal apagar (6.4).

### 6.3 Modal Arquivar Lote (NOVO)

```
+----------------------------------------------------+
| Arquivar lote {lotNumber}                          |
+----------------------------------------------------+
| [Data de arquivamento*]  Date input                |
|                          max=today, default=today  |
|                                                    |
| [Responsavel*]           Combobox                  |
|                          options=GET /api/users/   |
|                                  responsibles      |
|                          busca por name/username   |
|                          allowCustom=false         |
|                                                    |
| Aviso: lotes arquivados nao recebem entrada,       |
|        abertura ou fechamento. Apenas AJUSTE.      |
|                                                    |
| [Cancelar]              [Arquivar lote] (*)        |
+----------------------------------------------------+

(*) Botao Arquivar:
    enabled = data preenchida E responsavel selecionado
    disabled = qualquer um em branco
```

Combobox de responsavel popula via `useResponsibles()` (novo hook). Item selecionado envia `archivedBy = option.username` (estavel) — payload final tem `{ archivedAt, archivedBy }`.

### 6.4 Modal Apagar Lote (NOVO)

```
+----------------------------------------------------+
| ⚠️ Apagar lote {lotNumber} — DEFINITIVO            |
+----------------------------------------------------+
| Esta acao apaga o lote E todo o historico de       |
| movimentos. Nao pode ser desfeita.                 |
|                                                    |
| [Banner se usedInQcRecently — bloqueia botao]      |
|   "Este lote foi usado em CQ recente.              |
|    Use 'Arquivar' em vez de apagar."               |
|                                                    |
| Para confirmar, digite o numero do lote:           |
| [Confirmacao]   Input text                         |
|                 placeholder="Ex: ABC-123"           |
|                                                    |
| [Cancelar]              [Apagar definitivamente] (*)|
+----------------------------------------------------+

(*) Botao Apagar:
    enabled = match exato (trim, case-sensitive) com lotNumber E !usedInQcRecently
    disabled = mismatch OU usedInQcRecently
```

Botao envia `DELETE /api/reagents/{id}` com body `{ confirmLotNumber: input }`.

### 6.5 Card inativo

Quando `status == 'inativo'`:
- Toda a card recebe filtro visual sutil (opacity 0.7, borda cinza).
- Header mostra badge "Arquivado" em destaque.
- Linha extra exibida:
  ```
  📦 Arquivado em {archivedAt} por {archivedBy}
  ```
- Botoes ENTRADA/ABERTURA/FECHAMENTO/CONSUMO **escondidos** (apenas AJUSTE e Reativar).

### 6.6 Banner de pendencias (`needsStockReview`)

No topo da aba, antes da listagem:

```
+---------------------------------------------------------+
| ⚠️ Os seguintes lotes vieram da migracao v14 com        |
|    estoque nao classificado. Use AJUSTE ou abra         |
|    unidades para revisar.                                |
|                                                          |
|  • Glicose HK · Lote ABC-123 · Wama  → [Revisar lote]   |
|  • Hemoglobina · Lote XYZ-789 · Bio  → [Revisar lote]   |
|  • ... (limita a 10 + "Ver mais N pendencias")          |
|                                                          |
|    [Ocultar banner] (apenas sessao — nao persiste)      |
+---------------------------------------------------------+
```

Filtro: `lots.filter(lot => lot.needsStockReview === true)`. Limite de 10 visiveis com expansao client-side. **Banner some quando lista vazia** — apos todos os lotes serem revisados (AJUSTE/ABERTURA/archive).

### 6.7 Filtros e Dashboard — 4 valores de status

`STATUS_OPTIONS`:
```ts
const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'em_estoque', label: 'Em estoque' },
  { value: 'em_uso', label: 'Em uso' },
  { value: 'vencido', label: 'Vencido' },
  { value: 'inativo', label: 'Inativo' },
]
```

`TAG_STATUS_TABS`:
```ts
export const TAG_STATUS_TABS = ['todos', 'em_estoque', 'em_uso', 'vencido', 'inativo'] as const
```

`DashFilter`:
```ts
type DashFilter =
  | 'emEstoque'
  | 'emUso'
  | 'vencidos'
  | 'inativos'        // NOVO
  | 'expiring7d'
  | 'expiring30d'
  | 'noTraceability'
  | 'noValidity'
```

Drop `'foraDeEstoque'`.

`ReagentsDashboard.tsx` — 5 cards principais:
- Total
- Em estoque
- Em uso
- Vencidos
- **Inativos** (substitui "Fora de estoque")

Cards de acao mantidos do v2: Vencem em 7d, Vencem em 30d, Rastreabilidade incompleta, Sem validade.

`ReagentStats`:
```ts
interface ReagentStats {
  total: number
  emEstoque: number       // status === 'em_estoque'
  emUso: number           // status === 'em_uso'
  vencidos: number        // status === 'vencido'
  inativos: number        // status === 'inativo'   (NOVO)
  expiring7d: number
  expiring30d: number
  noTraceability: number
  noValidity: number
  pendingReview: number   // needsStockReview === true   (NOVO — alimenta banner)
}
```

### 6.8 Tipos TS finais

```ts
export type ReagentStatus = 'em_estoque' | 'em_uso' | 'vencido' | 'inativo'

export interface ReagentLot {
  id: string
  label: string
  lotNumber: string
  manufacturer: string
  category: string
  expiryDate: string
  storageTemp: string
  status: ReagentStatus | string
  location: string | null
  supplier: string | null
  receivedDate: string | null
  openedDate: string | null
  createdAt: string
  updatedAt: string

  // mudanca v3
  unitsInStock: number
  unitsInUse: number
  totalUnits: number

  // novos v3
  archivedAt: string | null
  archivedBy: string | null
  needsStockReview: boolean

  daysLeft: number
  nearExpiry: boolean
  usedInQcRecently?: boolean
  traceabilityComplete?: boolean
  traceabilityIssues?: string[]
  canReceiveEntry?: boolean
  allowedMovementTypes?: ('ENTRADA'|'ABERTURA'|'FECHAMENTO'|'CONSUMO'|'AJUSTE'|'SAIDA')[]
  movementWarning?: string | null
}

export interface ReagentLotRequest {
  label: string
  lotNumber: string
  manufacturer: string
  category: string
  expiryDate: string
  status: 'em_estoque' | 'em_uso' | 'vencido'   // sem 'inativo'
  location: string
  storageTemp: string
  unitsInStock: number
  unitsInUse: number
  supplier?: string
  receivedDate?: string
  openedDate?: string
}

export interface ArchiveReagentLotRequest {
  archivedAt: string         // YYYY-MM-DD
  archivedBy: string
}

export interface UnarchiveReagentLotRequest {
  reason?: string
}

export interface DeleteReagentLotRequest {
  confirmLotNumber: string
}

export interface StockMovementRequest {
  type: 'ENTRADA'|'ABERTURA'|'FECHAMENTO'|'CONSUMO'|'AJUSTE'
  quantity: number
  responsible: string
  notes?: string
  reason?: string
  targetUnitsInStock?: number   // obrigatorio em AJUSTE
  targetUnitsInUse?: number     // obrigatorio em AJUSTE
}

export interface StockMovement {
  id: string
  reagentLotId: string
  type: 'ENTRADA'|'SAIDA'|'AJUSTE'|'ABERTURA'|'FECHAMENTO'|'CONSUMO'
  quantity: number
  responsible: string
  notes?: string
  reason?: string
  createdAt: string
  previousStock: number | null            // legacy pre-V14
  previousUnitsInStock: number | null     // pos-V14
  previousUnitsInUse: number | null       // pos-V14
  isLegacy: boolean
}

export interface ResponsibleSummary {
  id: string
  name: string
  username: string
  role: 'ADMIN' | 'FUNCIONARIO'
}
```

**Removidos:**
- `ReagentTagSummary` (decisao 1.10).
- Em `ReagentLot`: `currentStock`.
- Em `ReagentLotRequest`: `currentStock`.
- Em `StockMovement`: nada removido (apenas `previousStock` ganha companheiros).

---

## 7. Criterios de aceite (testes minimos)

### 7.1 Backend

#### `ReagentMigrationV14Test.java` (NOVO — Testcontainers ou Spring Boot test com Flyway real)

Cobertura combinatorial dos 4 status legados:
- 1 lote `em_estoque` com `current_stock=10` → pos-V14: `unitsInStock=10, unitsInUse=0, status='em_estoque', needsStockReview=false`. Sem audit por linha.
- 1 lote `em_uso` com `current_stock=5` → pos-V14: `unitsInStock=5, unitsInUse=0, status='em_uso', needsStockReview=true`. Sem audit por linha (no-op de status).
- 1 lote `fora_de_estoque` com `current_stock=0` → pos-V14: `unitsInStock=0, unitsInUse=0, status='inativo', archivedAt=CURRENT_DATE, archivedBy='sistema-migracao-v14'`. **COM** audit `REAGENT_STATUS_TRANSITION_V3` trigger='migration_v14' from='fora_de_estoque' to='inativo'.
- 1 lote `vencido` com `current_stock=3` → pos-V14: `unitsInStock=3, unitsInUse=0, status='vencido', needsStockReview=false`. Sem audit por linha.

Asserts schema:
- Coluna `current_stock` nao existe.
- Colunas `units_in_stock`, `units_in_use`, `archived_at`, `archived_by`, `needs_stock_review` existem com tipos corretos.
- Constraint `chk_reagent_lots_status` permite `'inativo'` e rejeita `'fora_de_estoque'`.
- Constraints `chk_reagent_lots_units_in_stock_nonneg` e `chk_reagent_lots_units_in_use_nonneg` rejeitam INSERT com valor negativo.
- Constraint `chk_stock_movements_type` permite os 6 valores.
- Stock_movements ganharam `previous_units_in_stock` e `previous_units_in_use` (ambos NULL por default em rows existentes).

#### `ReagentServiceTest.java`

- `deriveStatus`:
  - `expiry < today` → 'vencido' (mesmo se inativo? NAO — inativo tem precedencia, retorna 'inativo')
  - `inativo` → 'inativo' (terminal)
  - `unitsInUse > 0` → 'em_uso'
  - `unitsInStock > 0 AND unitsInUse == 0` → 'em_estoque'
  - `0/0` (nao-inativo) → mantem status anterior (em_estoque tipico)

- `createMovement` happy paths e bloqueios:
  - ABERTURA q=1 com unitsInStock=5 → unitsInStock=4, unitsInUse=1, status='em_uso', openedDate=today, audit `REAGENT_OPENED_DATE_DERIVED` trigger='abertura'.
  - FECHAMENTO q=1 com unitsInUse=2 → unitsInUse=1, unitsInStock+=1. **openedDate NAO mexido.** Status pode passar para 'em_estoque' se unitsInUse virou 0.
  - CONSUMO q=2 com unitsInUse=2 → unitsInUse=0. Status mantem 'em_uso' (NAO arquiva auto). needsStockReview NAO limpo.
  - CONSUMO em vencido permitido (descarte) — 200.
  - AJUSTE em inativo permitido com reason — 200, status mantem 'inativo', needsStockReview=false.
  - ENTRADA em inativo bloqueia — 400 + audit `REAGENT_MOVEMENT_BLOCKED` reason='lote_inativo'.
  - ENTRADA em vencido bloqueia — 400 + audit `REAGENT_MOVEMENT_BLOCKED` reason='lote_vencido'.
  - ABERTURA em inativo bloqueia.
  - FECHAMENTO em vencido bloqueia.
  - ABERTURA com unitsInStock=0 → 400 ("Sem unidades fechadas para abrir").
  - FECHAMENTO com unitsInUse=0 → 400.
  - CONSUMO com q > unitsInUse → 400.
  - AJUSTE sem reason → 400.
  - AJUSTE sem targetUnitsInStock ou targetUnitsInUse → 400.
  - SAIDA em createMovement → 400 ("descontinuado").

- `archive` happy + falhas:
  - Happy: lote em_estoque → status=inativo, archivedAt set, archivedBy set, needsStockReview=false, audit `REAGENT_LOT_ARCHIVED`.
  - archivedAt > today → 400.
  - archivedBy nao existe em users ativos com role valido → 400.
  - lote ja inativo → 400.

- `unarchive`:
  - Inativo + expiry passou → status='vencido'.
  - Inativo + expiry futura + unitsInUse=0 + unitsInStock>0 → 'em_estoque'.
  - Inativo + expiry futura + unitsInUse>0 → 'em_uso'.
  - Inativo + zero/zero → 'em_estoque' (nao volta para inativo).
  - archivedAt e archivedBy permanecem preenchidos apos unarchive.
  - Audit `REAGENT_LOT_UNARCHIVED` com `archivedAtPreserved` e `archivedByPreserved`.

- `createLot`:
  - request com `status='inativo'` → 400.
  - request com `expiryDate < today AND status='em_estoque'` → forca vencido (heranca v2).
  - request com `unitsInUse > 0 AND openedDate=null` → openedDate=today + audit `REAGENT_OPENED_DATE_DERIVED` trigger='createLot'.

- `updateLot`:
  - request com `status='inativo'` → 400.
  - lote inativo + qualquer request → 400 ("Lote arquivado nao pode ser editado diretamente").

- `deleteLot`:
  - confirmLotNumber mismatch → 400.
  - usedInQcRecently=true → 400 + audit `REAGENT_DELETE_BLOCKED`.
  - Happy path: snapshot completo em audit `REAGENT_LOT_DELETED` ANTES do delete fisico, cascade movements limpos.

#### `ReagentControllerTest.java`

- `DELETE /api/reagents/{id}` como FUNCIONARIO → 403.
- `DELETE` como ADMIN sem `confirmLotNumber` → 400.
- `DELETE` como ADMIN com confirmLotNumber match e !usedInQcRecently → 204.
- `DELETE` como ADMIN com usedInQcRecently=true → 400.
- `POST /api/reagents/{id}/archive` payload completo → 200 + status='inativo'.
- `POST /api/reagents/{id}/archive` payload sem `archivedBy` → 400.
- `POST /api/reagents/{id}/archive` `archivedAt` futuro → 400.
- `POST /api/reagents/{id}/unarchive` happy path → 200 com status re-derivado.
- `POST /api/reagents/{id}/unarchive` em lote nao-inativo → 400.
- `GET /api/users/responsibles` como FUNCIONARIO → 200 com shape `ResponsibleSummary[]` filtrado.
- `GET /api/users/responsibles` filtra `isActive=false` (assert que inativos nao aparecem).
- `GET /api/users/responsibles` como anonimo → 401.
- `GET /api/reagents/tags` → 404 (foi removido).
- `GET /api/reagents/export/csv` header bate exatamente com 4.1.x (ordem nova com Em Estoque, Em Uso, Total, Arquivado em, Arquivado por).
- `POST /api/reagents/{id}/movements` com `type='SAIDA'` → 400.

#### `ReagentExpirySchedulerTest.java`

- Lote `em_uso` com expiry passou → vira `vencido` por scheduler. Audit trigger='scheduler'.
- Lote `inativo` com expiry passou → **scheduler NAO toca** (status terminal manual). Audit ausente.
- Lote `em_estoque` com expiry futura → no-op.

#### `ReagentesRastreabilidadeGeneratorTest.java`

- PDF gerado contem cards "Em estoque", "Em uso", "Vencidos", **"Inativos"** (label nova).
- Tabela "vencidos com estoque" usa filtro `(unitsInStock + unitsInUse) > 0` em vez de `currentStock > 0`.
- Coluna "Estoque" substituida por duas: "Em estoque" e "Em uso".
- Filtro `includeInactive` agora bate em `'inativo'` (era `'fora_de_estoque'`).

### 7.2 Frontend

#### `ReagentesTab.test.tsx`

- Mount inicial: card mostra dois contadores + total ("Em estoque: X · Em uso: Y · Total: Z").
- Botao "Abrir unidade" desabilitado quando `unitsInStock=0`.
- Botao "Voltar ao estoque" desabilitado quando `unitsInUse=0`.
- Botao "Abrir unidade" disparado → chama `POST /movements` com `{type:'ABERTURA', quantity:1}`.
- Botao "Voltar ao estoque" disparado → chama `POST /movements` com `{type:'FECHAMENTO', quantity:1, reason:'REVERSAO_ABERTURA'}`.
- Modal Arquivar:
  - Render dois campos (data + responsavel).
  - Botao "Arquivar" disabled enquanto data ou responsavel em branco.
  - Botao "Arquivar" enabled com ambos preenchidos.
  - Submit chama `POST /archive` com `{archivedAt, archivedBy}`.
- Modal Apagar:
  - Banner vermelho visivel se `usedInQcRecently=true`. Botao "Apagar" permanece disabled mesmo com confirmacao correta.
  - Input de confirmacao vazio → botao disabled.
  - Input com texto !== lotNumber → botao disabled.
  - Input com match exato + !usedInQcRecently → botao enabled.
  - Submit chama `DELETE /api/reagents/{id}` com `{confirmLotNumber}`.
- Botao "Apagar" **invisivel** quando `useAuth().user.role !== 'ADMIN'`.
- Card inativo:
  - Mostra "Arquivado em {archivedAt} por {archivedBy}".
  - Botoes ENTRADA/ABERTURA/FECHAMENTO/CONSUMO escondidos.
  - Botao "Reativar lote" presente. Click chama `POST /unarchive`.
- Banner `needsStockReview`:
  - Aparece quando algum lote tem `needsStockReview=true`.
  - Listagem limitada a 10 com "Ver mais".
  - Some quando lista vazia.
- Filtros: select status com 4 valores (em_estoque, em_uso, vencido, inativo).
- Dashboard: 5 cards (Total, Em estoque, Em uso, Vencidos, Inativos).
- VoiceRecorderModal: nao quebra com novos campos `unitsInStock`/`unitsInUse` (mantem mapping de `label, lotNumber, expiryDate, manufacturer`).

### 7.3 Migracao — dry-run

- Output da query A (distribuicao) tem 0 linhas com `target_status = 'UNKNOWN'`.
- Output da query B tem `reagents_with_null_stock = 0` E `reagents_with_negative_stock = 0`.
- Output da query C tem `reagents_unknown_status = 0`.
- Output da query D so contem types em `{ENTRADA, SAIDA, AJUSTE, ABERTURA, FECHAMENTO, CONSUMO}`.

Caso contrario, deploy abortado. Issue para `domain-auditor`.

### 7.4 Auditoria — invariantes

Para cada cenario testado, validar `audit_log` recebeu entry com:
- `action ∈ { REAGENT_LOT_ARCHIVED, REAGENT_LOT_UNARCHIVED, REAGENT_LOT_DELETED, REAGENT_STATUS_DERIVED, REAGENT_OPENED_DATE_DERIVED, REAGENT_MOVEMENT_BLOCKED, REAGENT_DELETE_BLOCKED, REAGENT_STATUS_TRANSITION_V3 }`
- `entity_type = 'ReagentLot'`
- `entity_id = <uuid esperado>`
- `details->>` contem campos canonicos da action (ver secao 5).

---

## 8. Plano de implementacao paralelizavel

**Recomendacao do orchestrator: PR unico consolidado v3.** Justificativa:

- Reduz overhead de coordenacao (igual ao v2 que tambem foi PR-1+PR-2 sequenciais — em v3 ha menos espaco para alias deprecated, ja que `/api/reagents/tags` e dropado direto).
- Migracao V14 + drop `current_stock` + alteracao de DTOs forma um pacote indivisivel — nao ha alias seguro para "estoque per-unit pela metade".
- Mesma blast radius do refator (status enum + DTOs + schema + UI).

**Estrutura interna recomendada do PR (sub-passos para revisao):**

1. **Backend base** (sub-commit 1):
   - Atualiza `ReagentStatus` (drop FORA_DE_ESTOQUE, add INATIVO).
   - Atualiza `MovementType` (add ABERTURA, FECHAMENTO, CONSUMO; particiona ALL_WRITE / ALL_READ).
   - Atualiza `MovementReason` (add REVERSAO_ABERTURA).
   - Atualiza `ReagentLot` (drop currentStock, add 5 campos).
   - Atualiza DTOs (`ReagentLotRequest`, `ReagentLotResponse`, `StockMovementRequest`, `StockMovementResponse`, novos `ArchiveReagentLotRequest`, `DeleteReagentLotRequest`, `UnarchiveReagentLotRequest`, `ResponsibleSummary`).
   - Atualiza `ReagentService` com novas regras (deriveStatus, archiveLot, unarchiveLot, deleteLot, createMovement com 5 branches).
   - Cria `ReagentLotRepository` queries novas (`findExpiredWithStock` baseado em soma).
   - Cria `UserRepository.findActiveResponsibles`.
   - Cria `UserController` (ou adiciona em controller existente) endpoint `/api/users/responsibles`.
   - Atualiza `ReagentController` (3 endpoints novos + DELETE permission + DROP /tags).
   - Atualiza `ReagentExpiryScheduler` (filtro `NOT IN ('vencido','inativo')`).
   - Atualiza `ReagentesRastreabilidadeGenerator` (cards e tabelas).

2. **Migracao** (sub-commit 2):
   - Cria `V14__reagent_units_and_archive_v3.sql`.
   - Cria `db/migration/dry-run/V14_dry_run.sql`.
   - Atualiza `ResponseMapper` para novos campos.

3. **Backend tests** (sub-commit 3):
   - `ReagentMigrationV14Test`, `ReagentServiceTest`, `ReagentControllerTest`, `ReagentExpirySchedulerTest`, `ReagentesRastreabilidadeGeneratorTest`.

4. **Frontend** (sub-commit 4):
   - `types/index.ts`, `constants.ts`, `schemas.ts`, `utils.ts`.
   - `services/reagentService.ts` (drop getTagSummaries, add archiveLot/unarchiveLot/getResponsibles), novo `services/userService.ts` (ou append em adminService).
   - `hooks/useReagents.ts` (`useArchiveReagentLot`, `useUnarchiveReagentLot`, `useResponsibles`).
   - `ReagentModals.tsx` (campos duplos + 2 modais novos: arquivar e apagar).
   - `ReagentsContent.tsx` (botoes diretos, card inativo, ocultar Apagar para nao-ADMIN).
   - `ReagentsDashboard.tsx` (banner needsStockReview + card Inativos).
   - `ReagentsFilters.tsx` (4 valores).
   - `ReagentesTab.tsx` (handlers).
   - `StatusBadge.tsx`.
   - `ReagentesTab.test.tsx`.

**Ordem dentro do PR:** backend (1) → migracao (2) → tests (3) → frontend (4). CI valida tudo junto. Sem alias deprecated. Deploy unico.

**Janela de deploy:** noturna (DROP COLUMN com AccessExclusiveLock — heranca v2). Backup obrigatorio antes.

---

## 9. Riscos e invariantes

### Invariantes — NAO podem quebrar

1. **Auditoria historica imutavel.** Audit_log entries pre-V14 com `details->>'to'='fora_de_estoque'` (v2) ou `'inativo'` (pre-v2) PRESERVADOS sem reescrita. V14 insere novos registros com action `REAGENT_STATUS_TRANSITION_V3`, nunca edita existentes.

2. **PDFs reports v2 ja assinados.** Imutaveis por SHA-256 + `report_runs.report_number`. Reports v2 antigos ainda contem termo "fora de estoque" em PDF — historico vivo. PDFs novos (pos-V14) usam "Inativo".

3. **`usedInQcRecently` continua via `lot_number`.** Implementacao em `ReagentService.lotNumbersUsedInQcRecently` (linhas 104-118) NAO MUDA. Continua usando `lot_number` (string), nao FK. v3 reusa.

4. **Cardinalidade unica `(lot_number, manufacturer)` preservada.** Indice de v2 nao tocado.

5. **`previousStock` em movimentos legados imutavel.** v3 NAO faz backfill — UI escolhe qual exibir baseado em `isLegacy`. Compliance ANVISA RDC 302 art. 60 atendida (registros pre-V14 reconstruem fluxo via `previousStock`; pos-V14 reconstroem via `previousUnitsInStock + previousUnitsInUse`).

6. **`archivedAt` e `archivedBy` historicos preservados em unarchive.** Lote arquivado e depois reativado mantem trilha do arquivamento. Auditor pode reconstruir cada arquivamento via audit_log + colunas atuais (que apontam para o arquivamento mais recente).

7. **DELETE bloqueado em lote com CQ recente.** Nova invariante v3 — protege historico ANVISA. Lote utilizado em qc_records apenas pode ser arquivado, nunca apagado.

8. **`inativo` e estado terminal manual.** Scheduler NAO toca lote inativo. ENTRADA/ABERTURA/FECHAMENTO/CONSUMO bloqueados. AJUSTE permitido (correcao retroativa de contagem).

9. **`needsStockReview` nunca persiste em lotes criados pos-V14.** A flag e um indicador exclusivo da migracao — lotes criados via `POST /api/reagents` apos V14 saem com `needsStockReview=false` direto.

### Riscos

1. **DROP COLUMN current_stock com transacao concorrente.** Janela noturna obrigatoria. Mitigacao: backup + deploy noturno + validacao dry-run.

2. **`ResponsibleSummary` pode vazar nomes de funcionarios para outros funcionarios.** Politica de privacidade: aceitavel num laboratorio (mesma base operacional). Domain-auditor confirma.

3. **Banner de `needsStockReview` longo.** Em laboratorios com 50+ lotes ex-em_uso, lista pode ser overwhelming. Mitigacao: limite de 10 visiveis com "Ver mais" + comprometimento UX de revisar em lotes.

4. **CONSUMO que zera `unitsInUse` nao arquiva auto.** Frontend exibe toast sugerindo arquivar, mas usuario pode ignorar. Lote permanece visivel com estoque zero. Aceitavel (terminal e manual — decisao 1.1).

5. **Migracao V14 + drop /api/reagents/tags simultaneo.** Integradores externos consumindo `/tags` quebram. Comunicado obrigatorio no release notes.

6. **AJUSTE em inativo permitido.** Pode confundir auditor: "lote inativo recebeu mutacao". Mitigacao: AJUSTE em inativo gera audit `REAGENT_STATUS_DERIVED` trigger='ajuste' com from='inativo' to='inativo' (no-op de status mas movement existe). Audit registra que houve correcao de inventario sem reativar.

7. **`archivedBy` armazenado como string livre.** Nao e FK em `users`. Se username mudar depois, registro fica stale. Mitigacao: aceitavel (audit trail e snapshot histórico — username no momento do arquivamento e o que importa).

8. **`canReceiveEntry` derivado retroativamente.** Frontend tem fallback hardcoded em `utils.ts` que pode estar errado pos-PR. **Acao corretiva (qa-engineer):** confirmar que o fallback do utils.ts esta sincronizado com a regra `lot.status NOT IN ('vencido','inativo')`.

---

## 10. Perguntas remanescentes

**Nenhuma.** Todas as 12 decisoes do orchestrator + 6 blockers do context-engineer receberam decisao em secao 1. Invariantes regulatorios herdados de v2 + v3-novos consolidados em secao 9.

**Notas para `domain-auditor`:**

- Confirmar decisao 1.5 (combobox responsavel acessivel a FUNCIONARIO) nao viola privacidade de outros usuarios em ambiente LIMS multi-tenant. Em Biodiagnostico (laboratorio unico) e operacionalmente aceitavel; mas convencao deve ficar explicita em `02-domain-audit.md`.

- Confirmar decisao 1.11 (DELETE bloqueado por `usedInQcRecently=true`) atende ANVISA RDC 302 art. 49 + ISO 15189 §5.3.2.7 (rastreabilidade de insumos usados em CQ). Auditor deve aprovar a escolha de bloqueio total (em vez de "advertencia que ADMIN pode ignorar").

- Confirmar decisao 1.7 (unarchive re-deriva incluindo possivel `vencido` se prazo passou) e aceitavel para auditor — alternativa rejeitada era "unarchive sempre vai para em_estoque". Razao da rejeicao: violaria regra ternaria que e mais forte que historico.

- Confirmar decisao 1.12 (`needsStockReview` limpo em archive E em AJUSTE/ABERTURA, mas nao em ENTRADA/CONSUMO/FECHAMENTO). Logica: archivar resolve (lote nao opera mais); AJUSTE/ABERTURA implicam revisao explicita do estoque; ENTRADA adiciona sem revisar contagem ambigua existente; CONSUMO/FECHAMENTO sao operacoes em unidade ja em uso (nao revisam o fechado).

- Confirmar decisao 1.10 (drop `/api/reagents/tags` simultaneo a V14). Alternativa rejeitada era "manter alias deprecated em v3 e dropar em v4". Razao: PR-4 do v2 nunca rodou — alias virou debito permanente. v3 e a oportunidade.

---

## Status

**CONGELADO.** Backend e frontend podem implementar em paralelo apos audit do `domain-auditor`. Em caso de bloqueio regulatorio, voltar ao orchestrator.

**Proximo agente:** `domain-auditor`.
