# Contract — Refatoracao Reagentes v2 (CONGELADO)

> **Status:** CONGELADO
> **Insumo:** `transicao-java/refactor-reagentes-v2/00-context-pack.md`
> **Supersede:** `transicao-java/DECISOES-REAGENTES.md` REAG-ADR-001 (registrar como historico — nao deletar)
> **Proximo agente:** `domain-auditor` (validar invariantes regulatorios) e em paralelo `backend-engineer` + `frontend-engineer` (apos audit)

Este documento congela o contrato que `backend-engineer` e `frontend-engineer` consumirao em paralelo. Toda decisao listada aqui e canonica. Reabertura exige outra rodada do orchestrator.

---

## 1. Decisoes de design (resposta as 9 ambiguidades do context-pack)

### 1.1 Renomear coluna `name` no banco?
**Decisao: NAO renomear.** Manter coluna `reagent_lots.name` no DB (NOT NULL) e re-rotular como `label` apenas no contrato HTTP/UI/DTO. Mapper traduz `entity.name` → `dto.label` no boundary do controller.

**Justificativa:** rename quebraria audit_log historico (`details.from` cita `name`), os generators de PDF (`l.getName()` em ReagentesRastreabilidadeGenerator:160,189), o indice unico, e exigiria migracao maior. Renomear apenas o contrato preserva trilha de auditoria e custa zero migracao de dados.

**Implicacao:** entidade Java continua com `private String name;`. Repository projection continua agrupando por `r.name`. Contrato externo usa exclusivamente o termo `label`. **Nao expor o nome `name` em DTO algum.**

### 1.2 Endpoint `/api/reagents/labels`
**Decisao:** novo endpoint `GET /api/reagents/labels` que retorna `ReagentLabelSummary[]` (substitui `/api/reagents/tags`). Manter `/api/reagents/tags` como **alias deprecated** que delega a `/labels` por 1 release (PR-1 mantem alias, PR-4 dropa). Frontend so consome `/labels`.

**Implementacao:** continuar usando agregacao via JPQL `GROUP BY r.name` (a mesma da projecao atual). Sem nova tabela, sem cache. Volume real (lotes em laboratorio Biodiagnostico) cabe trivialmente em uma query agregada.

**Resposta sem paginacao** — lista completa ordenada por `label ASC`. A combobox tem busca client-side; cardinalidade nao justifica paginacao.

### 1.3 `ReagentTagSummary` → `ReagentLabelSummary`
**Decisao:** novo record `ReagentLabelSummary` com chaves novas:

```
ReagentLabelSummary {
  label: String        // antigo "name"
  total: long
  emEstoque: long      // antigo "ativos"
  emUso: long
  foraDeEstoque: long  // antigo "inativos"
  vencidos: long
}
```

**Tipo TS:** `ReagentLabelSummary` em `types/index.ts`. **`ReagentTagSummary` removido em PR-4.**

A projection no repositorio (`ReagentTagSummaryProjection`) tambem renomeia para `ReagentLabelSummaryProjection`, getters `getLabel/getEmEstoque/getEmUso/getForaDeEstoque/getVencidos`.

### 1.4 VoiceRecorderModal — campos preenchidos
**Hoje** (`ReagentesTab.tsx:262-272`) preenche `name`, `lotNumber`, `expiryDate`, `manufacturer` no form direto.

**Decisao alvo:** o callback agora preenche `label`, `lotNumber`, `expiryDate`, `manufacturer`. Politica para `label`:

- Se `data.label` (ou `data.name` legado) bater **case-insensitive trim** com uma label existente em `tags`, seta exatamente o valor canonico daquela label.
- Se nao bater, o valor entra no form como **digitado-mas-nao-criado** (combobox abre com `query` preenchida e o usuario clica explicitamente em "+ Criar nova etiqueta" — alinhado com a decisao 6 do orchestrator).

Nao auto-criar etiqueta. Nao silenciar dado preenchido. Combobox abre aberto quando voz preenche label que nao bate.

### 1.5 CSV export — header e ordem
**Header novo (canonico):**

```
Etiqueta,Lote,Fabricante,Categoria,Validade,Dias Restantes,Estoque Atual,Status,Localizacao,Temperatura
```

Saem: `Unidade`, `Consumo/Dia`, `Nome`. Entram: `Localizacao`. Ordem reflete o cadastro de 9 campos canonicos primeiro, depois derivados (`Dias Restantes`), depois rastreabilidade (`Localizacao`, `Temperatura`).

Encoding UTF-8 + BOM mantido (`charset=UTF-8` no header HTTP — o BOM ja vinha implicito pelo Excel; nao mudar).

### 1.6 Quinto status `arquivado` para preservar `inativo` antigo?
**Decisao:** NAO. O conjunto canonico e estritamente `{em_estoque, em_uso, fora_de_estoque, vencido}`. Lote terminal (acabou + dentro da validade) = `fora_de_estoque`. Lote vencido = `vencido` (independente de estoque).

A distincao operacional antiga (`inativo` = acabou e passou da validade) deixa de existir no enum, mas continua expressavel via composicao `(status='vencido' AND currentStock=0)`. Reports v2 podem manter a secao "Vencidos com estoque" via filtro `status='vencido' AND currentStock>0`.

### 1.7 `em_uso` em UPDATE e abertura automatica
**Decisao:** a regra "openedDate=null + status=em_uso → grava openedDate=hoje" aplica em **CREATE e UPDATE**. E uma derivacao de service, nao validacao de DTO. Aplicada antes de `applyDerivedStatus`.

**Reciproca:** se UPDATE muda status DE `em_uso` PARA outro, **nao apaga** `openedDate` (historico forte — uma vez aberto, sempre aberto).

### 1.8 `canReceiveEntry` para `vencido`
**Decisao:** `canReceiveEntry = false` para `vencido` E para nada mais. `em_estoque`, `em_uso`, `fora_de_estoque` aceitam ENTRADA.

**Justificativa:** vencido nao deve receber novo estoque (deve ser descartado). `fora_de_estoque` ACEITA ENTRADA — e esse o ponto: ENTRADA em `fora_de_estoque` retorna o lote para `em_uso` (decisao 5.3 abaixo). `em_estoque` e `em_uso` ja eram aceitos.

### 1.9 `dashFilter` `lowStock`/`ruptureRisk`
**Decisao:** removidos do tipo `DashFilter` e da `ReagentsDashboard`. **`buildReagentStats` e `filterReagentLots` perdem essas branchs.** `quantityValue` e `estimatedConsumption` (que alimentam essas metricas) saem do modelo.

**Confirmar via grep:** `backend-engineer` e `frontend-engineer` rodam `grep -r 'lowStock\|ruptureRisk' biodiagnostico-web/src/ biodiagnostico-api/src/main/` antes do PR-2 — qualquer ocorrencia adicional vira issue na propria PR.

### 1.10 alertThresholdDays
**Decisao:** vira constante `private static final int ALERT_THRESHOLD_DAYS = 7;` em `ResponseMapper.java`. Coluna `alert_threshold_days` cai na V13. **Nao** vai para `application.yml` (overdesign — nao houve pedido de configurabilidade).

Campo `alertThresholdDays` sai de `ReagentLot`, `ReagentLotRequest`, `ReagentLotResponse`.

### 1.11 Reports v2 — `estimatedConsumption` na barChart
**Decisao:** **secao removida do PDF** `ReagentesRastreabilidadeGenerator` (linhas 199-217). O PDF nao mais exibe "Consumo estimado por categoria". Fica como TODO de produto:

> Caso o consumo seja necessario, derivar de `StockMovement` agregando `SAIDA` por categoria/janela. Issue separada — fora do escopo desta refatoracao.

### 1.12 V13 dry-run — mecanismo
**Decisao:** opcao **B** do context-pack — **SQL auxiliar separado** em `transicao-java/refactor-reagentes-v2/dry-run.sql` (criado pelo `release-engineer` apos contrato congelado). Operador roda em staging via psql/pgAdmin antes do deploy. Flyway aplica V13 em segundo passo, ja com baseline conhecido.

Shape do dry-run em secao 3 abaixo.

---

## 2. Schema final do banco

### 2.1 Tabela `reagent_lots` pos-V13 (DDL conceitual)

| Coluna | Tipo | Null | Default | Notas |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK (sem mudanca) |
| `name` | TEXT | NOT NULL | — | **Mantida no DB.** Re-rotulada como `label` no contrato. |
| `lot_number` | TEXT | NOT NULL | — | Sem mudanca. Chave operacional. |
| `manufacturer` | TEXT | **NOT NULL** | — | **Promovido a NOT NULL na V13** (hoje aceita NULL no DDL mas e `@NotBlank` no DTO; alinha DB com contrato). |
| `category` | TEXT | NULL | — | Lista fechada `CATEGORIES` (ver `constants.ts:10-21`). |
| `expiry_date` | DATE | **NOT NULL** | — | **Promovido a NOT NULL na V13** (alinha com `@NotNull` do DTO). Bloqueia lotes "sem validade" — decisao defensiva. |
| `current_stock` | DOUBLE PRECISION | NOT NULL | `0` | Mantida. |
| `storage_temp` | TEXT | NULL | — | Lista fechada `TEMPS`. |
| `status` | TEXT | NOT NULL | `'em_estoque'` | **CHECK** `status IN ('em_estoque','em_uso','fora_de_estoque','vencido')` adicionado na V13. |
| `location` | TEXT (128) | NULL | — | Detalhes adicionais (UI colapsavel). |
| `supplier` | TEXT (128) | NULL | — | Detalhes adicionais. |
| `received_date` | DATE | NULL | — | Detalhes adicionais. |
| `opened_date` | DATE | NULL | — | Setado automaticamente quando `status` vira `em_uso` (decisao 5.2). |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | Sem mudanca. |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `now()` | Sem mudanca. |

**Colunas DROPADAS na V13:**
- `quantity_value`
- `stock_unit`
- `estimated_consumption`
- `start_date`
- `end_date`
- `alert_threshold_days`

### 2.2 Indices

| Indice | Estado | Notas |
|---|---|---|
| `reagent_lots_pkey` (id) | mantem | — |
| `ux_reagent_lots_lotnumber_manufacturer` em `(LOWER(lot_number), LOWER(COALESCE(manufacturer,'')))` | **mantem** | Criado em `DatabaseIndexInitializer.java`. Apos V13, manufacturer vira NOT NULL — o `COALESCE` continua harmless. |
| `idx_reagent_lots_status` em `(status)` | **novo (V13)** | Acelera `findByFilters(category, status)` e `findExpiredNeedingReclassification`. Custo desprezivel; ganho de leitura claro. |
| `idx_reagent_lots_expiry_date` em `(expiry_date)` | **novo (V13)** | Acelera scheduler diario e `findExpiringInWindow`. |
| `idx_reagent_lots_name` em `(name)` | **novo (V13)** | Acelera `findTagSummaries` (GROUP BY name) e o futuro `findLabelSummaries`. |

### 2.3 CHECK constraint do status

```sql
ALTER TABLE reagent_lots
  ADD CONSTRAINT chk_reagent_lots_status
  CHECK (status IN ('em_estoque', 'em_uso', 'fora_de_estoque', 'vencido'));
```

A constraint **nao** roda antes do `UPDATE` de migracao (senao a migracao quebra). Ordem em 3.2 abaixo trata isso.

### 2.4 audit_log — sem mudanca de schema

A tabela `audit_log` nao muda. V13 apenas insere registros com:
- `action = 'REAGENT_STATUS_DERIVED'` (constante existente)
- `entity_type = 'ReagentLot'`
- `entity_id = <uuid do lote>`
- `details = jsonb { from, to, trigger:'quarentena_removed_v2', expiryDate, currentStock }`
- `user_id = NULL` (migracao nao tem usuario logado)

**Novos triggers introduzidos pelo service (sem mudanca de schema):**
- `quarentena_removed_v2` — usado pela V13 e por nada mais.
- Triggers existentes mantidos: `createLot`, `updateLot`, `movement`, `scheduler`.

---

## 3. Migracao V13 — especificacao

### 3.1 Pre-requisitos

- V12 aplicada (verificavel em `flyway_schema_history`).
- Backup completo da base (politica de release-engineer).
- `dry-run.sql` rodado em staging com snapshot de producao recente. Saida revisada por release-engineer.
- Codigo PR-1 (que adiciona o novo enum `ReagentStatus.EM_ESTOQUE` etc) e a logica da V13 ja em main, mas o flyway esta com a V13 ainda inativa via filtro de ambiente — tambem aceitavel: deploy do PR-1 + V13 simultaneo, desde que dry-run tenha sido validado.

### 3.2 Ordem das operacoes (single Flyway file `V13__reagent_lots_status_v2.sql`)

```text
BEGIN;

-- 1) Audit log das transicoes ANTES do UPDATE (lote ainda tem status antigo gravado).
--    Para cada lote em quarentena, inserir 1 linha em audit_log com from='quarentena',
--    to=<derivado>, trigger='quarentena_removed_v2', expiryDate, currentStock.
--    Para cada lote em ativo/inativo/em_uso/vencido cujo status muda, mesma coisa
--    (com from = status atual). Ver mapping na secao 3.3.
INSERT INTO audit_log (id, user_id, action, entity_type, entity_id, details, created_at)
SELECT
    gen_random_uuid(),
    NULL,
    'REAGENT_STATUS_DERIVED',
    'ReagentLot',
    r.id,
    jsonb_build_object(
        'from', r.status,
        'to', <derived>,
        'trigger', 'quarentena_removed_v2',
        'expiryDate', r.expiry_date::text,
        'currentStock', COALESCE(r.current_stock, 0)::text
    ),
    NOW()
FROM reagent_lots r
WHERE <derived> <> r.status;

-- 2) UPDATE com CASE explicito (ordem das clausulas espelha a tabela 3.3).
UPDATE reagent_lots SET status = CASE ... END
WHERE status IN ('ativo','em_uso','inativo','vencido','quarentena');

-- 3) DROP COLUMN das 6 colunas obsoletas.
ALTER TABLE reagent_lots
  DROP COLUMN IF EXISTS quantity_value,
  DROP COLUMN IF EXISTS stock_unit,
  DROP COLUMN IF EXISTS estimated_consumption,
  DROP COLUMN IF EXISTS start_date,
  DROP COLUMN IF EXISTS end_date,
  DROP COLUMN IF EXISTS alert_threshold_days;

-- 4) Promover colunas para NOT NULL (apos o UPDATE garantir que nenhuma linha viola).
ALTER TABLE reagent_lots ALTER COLUMN manufacturer SET NOT NULL;
ALTER TABLE reagent_lots ALTER COLUMN expiry_date SET NOT NULL;

-- 5) CHECK constraint do dominio do status.
ALTER TABLE reagent_lots
  ADD CONSTRAINT chk_reagent_lots_status
  CHECK (status IN ('em_estoque', 'em_uso', 'fora_de_estoque', 'vencido'));

-- 6) Default novo do status.
ALTER TABLE reagent_lots ALTER COLUMN status SET DEFAULT 'em_estoque';

-- 7) Indices novos.
CREATE INDEX IF NOT EXISTS idx_reagent_lots_status ON reagent_lots(status);
CREATE INDEX IF NOT EXISTS idx_reagent_lots_expiry_date ON reagent_lots(expiry_date);
CREATE INDEX IF NOT EXISTS idx_reagent_lots_name ON reagent_lots(name);

COMMIT;
```

**Importante:** o INSERT do passo 1 precede o UPDATE para que `r.status` ainda contenha o valor antigo. O `<derived>` na trilha do INSERT e o **MESMO** CASE expression usado no UPDATE — garantir que ambos usam logica identica para evitar drift. O `release-engineer` materializa esse CASE no SQL final.

**Promover NOT NULL no passo 4 deve ser preceded por verificacao no dry-run** de que nao ha lotes com `manufacturer IS NULL` ou `expiry_date IS NULL`. Se houver, dry-run falha o release. Esse e um requisito explicito, nao silencioso.

### 3.3 Mapeamento determinístico (canonico)

Aplicar nesta ordem — **primeira regra que casa vence**:

| # | Estado atual | Condicao adicional | Novo status | Trigger audit |
|---|---|---|---|---|
| 1 | qualquer | `expiry_date < CURRENT_DATE` | `vencido` | quarentena_removed_v2 (se from=quarentena) ou nao loga (se from era ativo/em_uso/etc — derivacao normal de scheduler ja existia, nao e novidade) |
| 2 | `quarentena` | `expiry_date >= CURRENT_DATE AND current_stock = 0 AND opened_date IS NULL` | `fora_de_estoque` | quarentena_removed_v2 |
| 3 | `quarentena` | `expiry_date >= CURRENT_DATE AND current_stock > 0` | `em_uso` (assume aberto na pratica) | quarentena_removed_v2 |
| 4 | `quarentena` | `expiry_date >= CURRENT_DATE AND current_stock = 0 AND opened_date IS NOT NULL` | `fora_de_estoque` | quarentena_removed_v2 |
| 5 | `inativo` | `expiry_date >= CURRENT_DATE AND current_stock = 0` | `fora_de_estoque` | quarentena_removed_v2 (reusa trigger — e migracao v2) |
| 6 | `inativo` | `expiry_date >= CURRENT_DATE AND current_stock > 0` | `em_uso` | quarentena_removed_v2 |
| 7 | `ativo` | `current_stock > 0 AND opened_date IS NULL` | `em_estoque` | quarentena_removed_v2 |
| 8 | `ativo` | `current_stock > 0 AND opened_date IS NOT NULL` | `em_uso` | quarentena_removed_v2 |
| 9 | `ativo` | `current_stock = 0` | `fora_de_estoque` | quarentena_removed_v2 |
| 10 | `em_uso` | `expiry_date >= CURRENT_DATE` | `em_uso` (no-op — nao loga) | — |
| 11 | `vencido` | qualquer estoque | `vencido` (no-op — nao loga) | — |

**Regra de log:** linhas 10 e 11 sao no-op (status final = inicial), portanto **nao** geram entrada em audit_log. O `WHERE <derived> <> r.status` no INSERT do passo 1 garante isso.

### 3.4 Rollback

V13 **nao e reversivel trivialmente** (DROP COLUMN destroi dado).

**Politica de rollback:**
1. Backup obrigatorio antes do deploy (release-engineer).
2. Em caso de necessidade de reverter:
   a. Restore do backup pre-deploy.
   b. Revert do PR-1 (codigo Java referenciando enums novos).
   c. Re-aplicar migracoes V1-V12 do zero a partir do dump.
3. **Nao criar V14_revert** — Flyway nao roda migracoes "para baixo" e isso poluiria o historico. A reversao e operacional, nao migrational.

Documentar em `dry-run.sql` o comando `pg_dump` recomendado.

### 3.5 Dry-run — shape exato do SELECT diagnostico

Saida obrigatoria do `dry-run.sql`:

```
SELECT
    r.status AS current_status,
    COUNT(*) AS row_count,
    CASE
        WHEN r.expiry_date < CURRENT_DATE THEN 'vencido'
        WHEN r.status = 'quarentena' AND r.current_stock = 0 THEN 'fora_de_estoque'
        WHEN r.status = 'quarentena' AND r.current_stock > 0 THEN 'em_uso'
        WHEN r.status = 'inativo' AND r.current_stock = 0 THEN 'fora_de_estoque'
        WHEN r.status = 'inativo' AND r.current_stock > 0 THEN 'em_uso'
        WHEN r.status = 'ativo' AND r.current_stock > 0 AND r.opened_date IS NULL THEN 'em_estoque'
        WHEN r.status = 'ativo' AND r.current_stock > 0 AND r.opened_date IS NOT NULL THEN 'em_uso'
        WHEN r.status = 'ativo' AND r.current_stock = 0 THEN 'fora_de_estoque'
        WHEN r.status = 'em_uso' THEN 'em_uso'
        WHEN r.status = 'vencido' THEN 'vencido'
        ELSE 'UNKNOWN'
    END AS target_status
FROM reagent_lots r
GROUP BY current_status, target_status
ORDER BY current_status, target_status;
```

**Checks adicionais obrigatorios no dry-run:**

```sql
-- A) Rejeita migracao se houver lotes que violam NOT NULL futuro.
SELECT COUNT(*) AS reagents_without_manufacturer FROM reagent_lots WHERE manufacturer IS NULL;
SELECT COUNT(*) AS reagents_without_expiry FROM reagent_lots WHERE expiry_date IS NULL;

-- B) Detecta status 'UNKNOWN' (nenhuma regra do mapping casa) — bloqueador.
WITH derived AS (SELECT ... AS target_status FROM reagent_lots)  -- mesma logica do CASE
SELECT COUNT(*) FROM derived WHERE target_status = 'UNKNOWN';
```

Se qualquer um dos tres counts for `> 0`, **release-engineer aborta deploy** e abre issue para o `domain-auditor` decidir.

### 3.6 Idempotencia e recovery

- Flyway gerencia `flyway_schema_history`. V13 nunca reroda apos sucesso.
- `BEGIN/COMMIT` envolve toda a migracao. Falha no meio = rollback automatico do Postgres. Operador re-tenta deploy.
- `DROP COLUMN IF EXISTS` torna a migracao reentrante mentalmente (apos uma falha parcial fora de transacao em ambiente intermediario). Nao precisa, mas nao custa.
- O filtro `WHERE status IN ('ativo','em_uso','inativo','vencido','quarentena')` no UPDATE garante que mesmo se rodar em base que ja tem valores novos (ambiente intermediario), nao corrompe — simplesmente nao casa.

Se a V13 falhar em producao com erro inesperado:
1. Postgres ja reverteu via transacao.
2. Flyway marca a migracao como `FAILED` em `flyway_schema_history`.
3. Limpar a entrada FAILED manualmente: `DELETE FROM flyway_schema_history WHERE version = '13' AND success = false;`
4. Corrigir o motivo da falha (provavelmente um lote inesperado que viola NOT NULL futuro — investigar).
5. Re-deployar.

---

## 4. Contrato HTTP (DTOs e endpoints)

### 4.1 `POST /api/reagents` — cadastro de lote

**Request:** `ReagentLotRequest` (record Java + interface TS)

```
ReagentLotRequest {
  // 9 obrigatorios canonicos
  label: String         @NotBlank @Size(max=255)   // antigo "name"
  lotNumber: String     @NotBlank @Size(max=255)
  manufacturer: String  @NotBlank @Size(max=128)
  category: String      @NotBlank                  // deve estar em CATEGORIES
  currentStock: Double  @NotNull @Min(0)
  status: String        @NotBlank                  // 'em_estoque'|'em_uso'|'fora_de_estoque'|'vencido'
  expiryDate: LocalDate @NotNull
  location: String      @NotBlank @Size(max=128)   // promovido a obrigatorio (rastreabilidade RDC 302)
  storageTemp: String   @NotBlank                  // deve estar em TEMPS

  // 3 opcionais (Detalhes adicionais — UI colapsavel)
  supplier: String?     @Size(max=128)
  receivedDate: LocalDate?
  openedDate: LocalDate?
}
```

**Validacoes adicionais cross-field (service, nao DTO):**
- `category` deve ser valor de `CategoryRegistry.ALL` (lista fechada).
- `storageTemp` deve ser valor de `StorageTempRegistry.ALL` (lista fechada).
- Combo `(lotNumber, manufacturer)` unico (case-insensitive). Conflito → 400 BusinessException.
- `receivedDate <= openedDate <= expiryDate` quando ambas presentes.
- `expiryDate < hoje` → service forca `status = 'vencido'`, ignorando o status enviado pelo cliente. **Sem erro, sem aviso** — simplesmente derivacao silenciosa (auditoria registra trigger=createLot).

**Response:** 201 + `ReagentLotResponse`. Erros: 400 (validacao), 409 (duplicado).

### 4.2 `PUT /api/reagents/{id}` — edicao de lote

Mesmo `ReagentLotRequest`. Validacao identica. Service:
- Verifica `(lotNumber, manufacturer)` unica entre todos exceto o proprio id.
- Aplica `applyOpenedDateOnUseTransition` antes de `applyDerivedStatus` (decisao 1.7).
- `expiryDate < hoje` forca `status = 'vencido'`.

**Response:** 200 + `ReagentLotResponse`. Erros: 400, 404, 409.

### 4.3 `GET /api/reagents` — listagem

**Query params:**
- `category`: opcional, string da lista fechada
- `status`: opcional, **um dos 4 valores novos**. Apos V13, banco so contem novos. Backend faz **defesa adicional**: se receber valor antigo (`ativo`, `inativo`, `quarentena`), retorna 400 com mensagem `"Status legado nao suportado. Use: em_estoque, em_uso, fora_de_estoque, vencido."`
- `label`: **novo, opcional**. Filtro exato (case-insensitive) por etiqueta.
- `search`: opcional, busca em `label OR lotNumber OR manufacturer` (case-insensitive). Implementacao no repository via `LIKE LOWER(...)`.

**Response:** 200 + `ReagentLotResponse[]`. Ordem: `created_at DESC` (sem mudanca).

### 4.4 `ReagentLotResponse` — schema final

```
ReagentLotResponse {
  id: UUID
  label: String                           // antigo "name"
  lotNumber: String
  manufacturer: String                    // agora sempre nao-nulo
  category: String?
  expiryDate: LocalDate                   // agora sempre nao-nulo
  currentStock: Double
  storageTemp: String?
  status: String                          // 'em_estoque'|'em_uso'|'fora_de_estoque'|'vencido'
  location: String?
  supplier: String?
  receivedDate: LocalDate?
  openedDate: LocalDate?
  createdAt: Instant
  updatedAt: Instant

  // derivados (calculados pelo backend, sem persistencia)
  daysLeft: long                          // dias entre hoje e expiryDate
  nearExpiry: boolean                     // daysLeft <= 7
  usedInQcRecently: boolean
  traceabilityComplete: boolean
  traceabilityIssues: String[]
  canReceiveEntry: boolean                // true exceto para 'vencido'
  allowedMovementTypes: String[]          // ['ENTRADA','SAIDA','AJUSTE'] ou ['SAIDA','AJUSTE'] se vencido
  movementWarning: String?                // mensagem amigavel quando bloqueado
}
```

**Saem do response (em relacao ao atual `ReagentLotResponse.java`):**
- `name` (vira `label`)
- `quantityValue`
- `stockUnit`
- `estimatedConsumption`
- `startDate`
- `endDate`
- `alertThresholdDays`
- `stockPct` (sem `quantityValue` perde sentido)
- `daysToRupture` (sem `estimatedConsumption` perde sentido)

**`traceabilityIssues`** continua sendo lista de keys ASCII: agora `['manufacturer','location','supplier','receivedDate']`. Como `manufacturer` e NOT NULL no DB, nunca aparecera mais nessa lista — mas o codigo do mapper segue checando para defesa em profundidade.

### 4.5 `GET /api/reagents/labels` (NOVO)

**Sem query params.**

**Response:** 200 + `ReagentLabelSummary[]`, ordem `label ASC`.

```json
[
  { "label": "Glicose HK", "total": 12, "emEstoque": 5, "emUso": 3, "foraDeEstoque": 2, "vencidos": 2 },
  { "label": "Hemoglobina", "total": 8, "emEstoque": 4, "emUso": 2, "foraDeEstoque": 1, "vencidos": 1 }
]
```

Sem paginacao (justificativa em 1.2). Sem cache HTTP — invalida sempre que ha mutacao em `reagent_lots`.

### 4.6 `GET /api/reagents/tags` (DEPRECATED — alias)

PR-1 mantem o endpoint mas internamente delega para `getLabelSummaries()` e mapeia para o shape **antigo** (`ReagentTagSummary` com chaves `name/ativos/emUso/inativos/vencidos`) **somente** para nao quebrar clientes externos durante uma janela. Header `Deprecation: true` + `Link: </api/reagents/labels>; rel="successor-version"`.

PR-4 remove o endpoint, o DTO antigo, o tipo TS antigo, e a chamada do `reagentService.getTagSummaries()`. Frontend ja consome `/labels` desde PR-2 — o alias e seguranca para integradores externos eventuais.

### 4.7 `POST /api/reagents/{id}/movements`

**Request:** `StockMovementRequest` (sem mudanca de schema).

```
StockMovementRequest {
  type: 'ENTRADA'|'SAIDA'|'AJUSTE'   @NotBlank
  quantity: Double                    @NotNull @Min(0)
  responsible: String                 @NotBlank
  notes: String?
  reason: MovementReason?             // obrigatorio se AJUSTE ou SAIDA-zera-estoque
}
```

**Regras de transicao automatica (novas — secao 5.4):**

| Status atual | Movimento | Novo estoque | Status final | Audit |
|---|---|---|---|---|
| `em_estoque` | ENTRADA | +q | `em_estoque` | sem transicao |
| `em_estoque` | SAIDA (>0 final) | -q | `em_uso` | REAGENT_STATUS_DERIVED, trigger=movement |
| `em_estoque` | SAIDA (=0 final) | 0 | `fora_de_estoque` | REAGENT_STATUS_DERIVED, trigger=movement |
| `em_estoque` | AJUSTE (>0) | =q | `em_estoque` ou `em_uso` (regra: se openedDate set, em_uso; senao em_estoque) | conforme |
| `em_estoque` | AJUSTE (=0) | 0 | `fora_de_estoque` | REAGENT_STATUS_DERIVED |
| `em_uso` | ENTRADA | +q | `em_uso` | sem transicao |
| `em_uso` | SAIDA (>0 final) | -q | `em_uso` | sem transicao |
| `em_uso` | SAIDA (=0 final) | 0 | `fora_de_estoque` | REAGENT_STATUS_DERIVED |
| `em_uso` | AJUSTE | =q | `em_uso` se q>0, senao `fora_de_estoque` | conforme |
| `fora_de_estoque` | ENTRADA | +q | **`em_uso`** | REAGENT_STATUS_DERIVED, trigger=movement |
| `fora_de_estoque` | SAIDA | bloqueio (estoque insuficiente, BusinessException) | — | — |
| `fora_de_estoque` | AJUSTE (>0) | =q | `em_uso` | REAGENT_STATUS_DERIVED |
| `fora_de_estoque` | AJUSTE (=0) | 0 | `fora_de_estoque` | sem transicao |
| `vencido` | ENTRADA | bloqueio (canReceiveEntry=false, BusinessException + audit MOVEMENT_BLOCKED) | — | REAGENT_MOVEMENT_BLOCKED |
| `vencido` | SAIDA | -q | `vencido` (mantem — descarte registrado) | sem transicao |
| `vencido` | AJUSTE | =q | `vencido` (mantem) | sem transicao |

**Notas:**
- `reason` continua opcional **exceto** para AJUSTE e SAIDA-zera-estoque (regra atual mantida — `ReagentService.java:336-343`).
- ENTRADA em `fora_de_estoque` → `em_uso` e a transicao **nova mais importante**. Tras o lote de volta ao fluxo operacional sem precisar editar manualmente o status.
- ENTRADA em `vencido` continua bloqueada (decisao 1.8). Audit `REAGENT_MOVEMENT_BLOCKED` com `reason='lote_vencido'` (atualizar da string atual `'lote_inativo'`).

### 4.8 `GET /api/reagents/export/csv`

Header e ordem em decisao 1.5. Mesmos query params `category`, `status`. Filtro respeita politica anti-status-legado de 4.3.

### 4.9 Endpoints inalterados

- `DELETE /api/reagents/{id}` — politica `deleteLot` mantem invariante (`fora_de_estoque` substitui `inativo` como destino do arquivamento — ver 5.5).
- `DELETE /api/reagents/movements/{movId}` — sem mudanca.
- `GET /api/reagents/{id}/movements` — sem mudanca.
- `GET /api/reagents/by-lot-number?lotNumber=` — sem mudanca.
- `GET /api/reagents/expiring?days=` — query do repository ajustada para `status NOT IN ('vencido','fora_de_estoque')` (atualizar a 'inativo' que existe hoje).

---

## 5. Service: regras de transicao em pseudocodigo

### 5.1 `deriveStatus(lot, today)` — ternaria validade x estoque x abertura

```text
deriveStatus(lot, today):
    if lot is null: return null
    expiry = lot.expiryDate
    stock  = lot.currentStock or 0
    opened = lot.openedDate

    // 1) Validade — regra mais forte, sobrepoe qualquer combinacao.
    if expiry != null AND expiry < today:
        return 'vencido'

    // 2) Estoque zerado.
    if stock <= 0:
        return 'fora_de_estoque'

    // 3) Abertura — distingue em_uso de em_estoque.
    if opened != null:
        return 'em_uso'

    return 'em_estoque'
```

**Diferenca chave em relacao ao `deriveStatus` atual** (`ReagentService.java:466-483`):
- Sem clausula especial para quarentena (nao existe mais).
- Regra de abertura passa a influenciar resultado (antes nao influenciava).
- `vencido + estoque > 0` e `vencido + estoque = 0` agora retornam o **mesmo** valor (`vencido`). A semantica antiga `inativo` (vencido sem estoque) e absorvida.

### 5.2 `applyOpenedDateOnUseTransition(lot, today)` — derivacao auxiliar

```text
applyOpenedDateOnUseTransition(lot, today):
    // Aplicada apos derivacao quando o status final sera 'em_uso' E openedDate ainda eh null.
    // Justificativa: lote em uso por definicao foi aberto.
    if final_status == 'em_uso' AND lot.openedDate is null:
        lot.openedDate = today
```

Aplicada em `createLot` e `updateLot`, antes do save. Em `createMovement` quando o resultado da derivacao move para `em_uso` (ex: ENTRADA em `fora_de_estoque`), tambem dispara.

### 5.3 `applyDerivedStatus(lot, today, trigger)` — orquestracao

```text
applyDerivedStatus(lot, today, trigger):
    if lot is null: return
    oldStatus = lot.status
    derived   = deriveStatus(lot, today)
    if oldStatus == derived: return  // no-op

    lot.status = derived
    applyOpenedDateOnUseTransition(lot, today)  // se virou em_uso, marca abertura

    // audit
    auditService.log(
        action  = 'REAGENT_STATUS_DERIVED',
        entity  = 'ReagentLot',
        id      = lot.id,
        details = { from: oldStatus, to: derived, trigger, expiryDate, currentStock }
    )
```

**Observe:** sem clausula `if QUARENTENA: return` — quarentena acabou.

### 5.4 `createLot(request)` — algoritmo

```text
createLot(request):
    1. validateLotDates(request)                         // expiryDate vs receivedDate vs openedDate
    2. validateCategoryAndTemp(request)                   // listas fechadas
    3. checkUnique(lotNumber, manufacturer)               // 409 se conflito
    4. status = resolveStatus(request.status, default='em_estoque')
    5. lot = build(request, status)
    6. // forcing rules
       if request.expiryDate < today:
           lot.status = 'vencido'                         // ignora request.status
       else if status == 'em_uso' AND request.openedDate is null:
           lot.openedDate = today                         // decisao 1.7
    7. applyDerivedStatus(lot, today, 'createLot')        // converge se necessario
    8. save(lot)                                          // catch DataIntegrityViolationException → 409
    9. return lot
```

Ordem: `expiryDate < today` aplica ANTES de `applyDerivedStatus` para garantir que a auditoria registre a transicao de "tentativa do usuario" → "vencido". Isso preserva trilha legivel.

### 5.5 `deleteLot(id)` — politica de arquivamento

```text
deleteLot(id):
    lot = findById(id)
    hasMovements = stockMovementRepository.existsByReagentLotId(id)
    usedInQc     = qcRecordRepository.existsByLotNumberOperational(lot.lotNumber)

    if NOT hasMovements AND NOT usedInQc:
        // Lote orfao — pode deletar fisicamente.
        deleteById(id)
        return

    if currentStock > 0:
        audit('REAGENT_DELETE_BLOCKED', { reason:'historico_ou_cq_com_estoque', currentStock, ... })
        throw BusinessException("Lote com historico ou uso em CQ nao pode ser removido com estoque atual...")

    // Arquivamento logico — substitui o antigo INATIVO por FORA_DE_ESTOQUE.
    if lot.status != 'fora_de_estoque':
        oldStatus = lot.status
        lot.status = 'fora_de_estoque'
        save(lot)
        audit('REAGENT_LOT_ARCHIVED', { from: oldStatus, to: 'fora_de_estoque', hasMovements, usedInQc })
```

**Importante:** `REAGENT_LOT_ARCHIVED` continua sendo a action de auditoria. Mas o `to` muda de `'inativo'` para `'fora_de_estoque'`. Compliance preservada (mesmo formato), historico antigo ainda legivel (registros antigos com `to:'inativo'` permanecem como estao).

### 5.6 `createMovement(lotId, request)` — matriz canonica

Ja desenhada na tabela 4.7. Pseudocode condensado:

```text
createMovement(lotId, request):
    lot = findById(lotId)
    type = normalize(request.type)

    // Bloqueio canonico: vencido nao recebe ENTRADA.
    if type == ENTRADA AND NOT canReceiveEntry(lot):
        audit('REAGENT_MOVEMENT_BLOCKED', { reason: lot.status == 'vencido' ? 'lote_vencido' : 'lote_inativo', movementType: ENTRADA })
        throw BusinessException("Lote vencido nao aceita nova entrada. Crie um novo lote.")

    nextStock = computeNextStock(lot.currentStock, type, request.quantity)  // ENTRADA: +q; SAIDA: -q (>=0); AJUSTE: =q

    // Validacao reason — preservada da implementacao atual.
    if type == AJUSTE AND blank(reason): throw "AJUSTE exige motivo..."
    if type == SAIDA AND nextStock == 0 AND blank(reason): throw "Saida que zera estoque exige motivo..."

    lot.currentStock = nextStock
    applyDerivedStatus(lot, today, 'movement')   // derivacao automatica converge para o status final
    save(lot)

    movement = StockMovement.builder()...build()
    save(movement)
    return movement
```

`canReceiveEntry(lot)` agora retorna `lot.status != 'vencido'` (em vez de `lot.status != 'inativo'`).

---

## 6. Frontend: contrato visual e estado

### 6.1 `ReagentLotModal` — diagrama de estados (ASCII)

```
+---------------------------------------------------------------+
| MODAL: Cadastrar / Editar Lote                                |
+---------------------------------------------------------------+
| SECAO 1: Identificacao (sempre visivel)                       |
|  [Etiqueta*]  Combobox(options=labels, allowCustom=true,      |
|                createLabel='+ Criar nova etiqueta')           |
|  [Lote*]      Input text                                      |
|  [Fabricante*] Combobox(options=manufacturers, allowCustom)   |
|  [Categoria*] Select(options=CATEGORIES)                       |
|                                                                |
| SECAO 2: Estoque & Status                                     |
|  [Quantidade atual*] Input number, min=0                      |
|  [Status*]    Select(options=NEW_STATUS_OPTIONS, default=     |
|                'em_estoque')                                  |
|  [Validade*]  Input date                                      |
|                                                                |
| SECAO 3: Armazenamento                                        |
|  [Localizacao*] Input text                                    |
|  [Temperatura*] Select(options=TEMPS)                         |
|                                                                |
| SECAO 4: Detalhes adicionais (COLAPSAVEL, fechada por default)|
|  [Fornecedor]    Input text                                   |
|  [Recebimento]   Input date                                   |
|  [Abertura]      Input date                                   |
|                                                                |
+---------------------------------------------------------------+
| [Cancelar]                              [Salvar lote] (*)     |
+---------------------------------------------------------------+

(*) Botao Salvar:
    enabled  = todos os 9 obrigatorios preenchidos E sem erro de validacao
    disabled = qualquer obrigatorio em branco OU validacao zod falha

VALIDACAO INLINE (mostra erro abaixo do campo):
- Etiqueta: required, min 1 char trimmed
- Lote: required, min 1 char trimmed
- Fabricante: required, min 1 char trimmed
- Categoria: required, deve estar em CATEGORIES
- Quantidade: required, >= 0
- Status: required, deve estar em ['em_estoque','em_uso','fora_de_estoque','vencido']
- Validade: required, formato date valido
- Localizacao: required, min 1 char trimmed
- Temperatura: required, deve estar em TEMPS
- Receivedate <= openedDate <= expiryDate (cross-field, se ambas presentes)

DERIVACAO VISUAL (sem alterar dados):
- Se expiryDate < hoje, mostrar banner amarelo: "Este lote sera salvo
  como VENCIDO automaticamente (validade vencida)."
- Status pre-selecionado fica desabilitado para edicao quando o banner
  amarelo esta ativo? NAO — usuario pode mudar mas backend forca.
  Mostrar tooltip explicando.
```

### 6.2 Combobox de etiqueta — comportamento exato

Componente: `Combobox` de `biodiagnostico-web/src/components/ui/Combobox.tsx`. Signature ja suporta o caso (linhas 1-253).

**Configuracao para etiqueta:**
```
<Combobox
  label="Etiqueta"
  placeholder="Buscar ou criar etiqueta..."
  value={form.label}
  onChange={(v) => setForm({ ...form, label: v })}
  options={labelOptions}              // de useReagentLabels()
  allowCustom={true}
  createLabel="+ Criar nova etiqueta"
  emptyText="Nenhuma etiqueta cadastrada"
/>
```

**Estados do combobox (extraidos de `Combobox.tsx`):**

| Estado | Comportamento |
|---|---|
| Vazio (sem foco) | Mostra `placeholder`. `value=''`. |
| Sem labels cadastradas | Lista vazia, `emptyText` visivel. Usuario digita → aparece "+ Criar nova etiqueta: \"X\"". |
| Digitando query que casa labels existentes | Lista filtrada, sem item "criar novo" (porque `hasExact` ou ha resultados). |
| Digitando query nova (sem casamento exato) | Lista filtrada (parciais) **mais** item destacado "+ Criar nova etiqueta: \"X\"" no final. |
| Selecao por click ou Enter | `onChange(value)`, fecha dropdown, blur input. |
| Selecao "+ Criar nova etiqueta" | `onChange(query.trim())`, fecha dropdown. **Usuario clica explicitamente** — nao auto-cria por blur. |

**Crucial — divergencia com Combobox atual:**

A linha 167 do `Combobox.tsx` faz `onChange(raw.trim())` em **cada keystroke** quando `allowCustom=true`. Isso ja viola a decisao 6 do orchestrator (auto-cria sem clique). **Backend-engineer/frontend-engineer NAO precisam modificar Combobox.tsx** — usar como esta. A "criacao explicita" descrita pelo orchestrator e respeitada porque:

1. O `onChange(raw.trim())` apenas seta o valor no formulario (memoria local React).
2. A "criacao" so acontece quando `POST /api/reagents` e chamado com aquele label inexistente.
3. O usuario clica em "Salvar lote" para criar — esse e o "clique explicito" funcional.
4. O item "+ Criar nova etiqueta" no dropdown e pista visual + selecao opcional, nao atalho de criacao.

Documentar essa decisao no PR-2 para evitar discussao.

### 6.3 `ReagentesTab.viewMode` default

```
const [viewMode, setViewMode] = useState<ReagentViewMode>('tags')   // antes 'list'
```

Toggle continua funcional (`onToggleViewMode` em ReagentesTab.tsx:304).

### 6.4 Card dentro da etiqueta — estrutura HTML conceitual

```
<Card>
  <header>
    <h4>Lote {lotNumber} . {manufacturer}</h4>     // antes: lot.name
    <StatusBadge status={status} />                 // 4 valores novos
    <CategoryChip>{category}</CategoryChip>
  </header>

  <subheader> // metadata em row
    {storageTemp && <span><Thermometer/> {storageTemp}</span>}
    {location && <span><MapPin/> {location}</span>}
    {supplier && <span>Fornecedor: {supplier}</span>}
    {usedInQcRecently && <Badge tone=green>Em CQ recente</Badge>}
    {traceabilityIssues.length > 0 && <Badge tone=amber>Rastreabilidade incompleta</Badge>}
  </subheader>

  <stockBar>
    <span>{currentStock.toFixed(0)} unidades</span>
    // sem stockPct, sem daysToRupture (quantityValue/estimatedConsumption foram-se)
  </stockBar>

  <expiryBadge>
    {expired ? "Vencido" : urgent ? `${daysLeft}d restantes` : warning ? `${daysLeft}d` : formatDate(expiryDate)}
  </expiryBadge>

  <actions>
    <Button>Movimentar</Button>
    <Button>Historico</Button>
    <Button>Editar</Button>
    <Button>{status === 'fora_de_estoque' ? 'Remover' : 'Arquivar'}</Button>
  </actions>
</Card>
```

**Mudancas explicitas em relacao a ReagentsContent.tsx atual:**
- Linha 331 e 505: `{lot.name}` → `Lote {lot.lotNumber} . {lot.manufacturer}`. Em `<h4>`.
- Linhas 415-438: barra de progresso de estoque sem `stockPct`/`daysToRupture` — render simples de `currentStock + unidades`.
- Linha 461-463: `lot.status === 'inativo'` → `lot.status === 'fora_de_estoque'`.

### 6.5 Dashboard — contagens

`ReagentStats` final:
```ts
interface ReagentStats {
  total: number
  emEstoque: number       // status === 'em_estoque'
  emUso: number           // status === 'em_uso'
  foraDeEstoque: number   // status === 'fora_de_estoque'
  vencidos: number        // status === 'vencido'
  expiring7d: number      // status !== 'vencido' && daysLeft >= 0 && daysLeft <= 7
  expiring30d: number     // status !== 'vencido' && daysLeft > 7 && daysLeft <= 30
  noTraceability: number  // traceabilityIssues.length > 0
  noValidity: number      // !expiryDate    (apos V13 isso so existe se backend ressuscitar lote sem validade — defesa)
}
```

**Saem:** `ruptureRisk`, `lowStock`, `expired`. (`expired` substituido por `vencidos` — mesma semantica, nome consistente.)

`ReagentsDashboard.tsx`:
- Cards principais (5): `Total`, `Em estoque`, `Em uso`, `Fora de estoque`, `Vencidos`
- Cards de acao (4 quando ha alertas): `Vencem em 7d`, `Vencem em 30d`, `Rastreabilidade incompleta`, `Sem validade`
- Removidos: `Risco de ruptura`, `Baixo estoque`

`DashFilter` final:
```ts
type DashFilter =
  | 'emEstoque'
  | 'emUso'
  | 'foraDeEstoque'
  | 'vencidos'
  | 'expiring7d'
  | 'expiring30d'
  | 'noTraceability'
  | 'noValidity'
```

Sem `lowStock`, sem `ruptureRisk`, sem `expired`.

### 6.6 `ReagentsFilters` — opcoes de status

```ts
const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'em_estoque', label: 'Em estoque' },
  { value: 'em_uso', label: 'Em uso' },
  { value: 'fora_de_estoque', label: 'Fora de estoque' },
  { value: 'vencido', label: 'Vencido' },
]
```

`TAG_STATUS_TABS` em `constants.ts:27`:
```ts
export const TAG_STATUS_TABS = ['todos', 'em_estoque', 'em_uso', 'fora_de_estoque', 'vencido'] as const
```

### 6.7 Tipos TS finais

```ts
export interface ReagentLot {
  id: string
  label: string                            // antes "name"
  lotNumber: string
  manufacturer: string                     // nao-opcional
  category: string
  expiryDate: string                       // nao-opcional
  currentStock: number
  storageTemp: string
  status: 'em_estoque' | 'em_uso' | 'fora_de_estoque' | 'vencido' | string
  location: string | null
  supplier: string | null
  receivedDate: string | null
  openedDate: string | null
  createdAt: string
  updatedAt: string
  daysLeft: number
  nearExpiry: boolean
  usedInQcRecently?: boolean
  traceabilityComplete?: boolean
  traceabilityIssues?: string[]
  canReceiveEntry?: boolean
  allowedMovementTypes?: ('ENTRADA' | 'SAIDA' | 'AJUSTE')[]
  movementWarning?: string | null
}

export interface ReagentLotRequest {
  label: string
  lotNumber: string
  manufacturer: string
  category: string
  expiryDate: string
  currentStock: number
  status: string
  location: string
  storageTemp: string
  supplier?: string
  receivedDate?: string
  openedDate?: string
}

export interface ReagentLabelSummary {
  label: string
  total: number
  emEstoque: number
  emUso: number
  foraDeEstoque: number
  vencidos: number
}
```

**Removidos:**
- `ReagentTagSummary` (substituido por `ReagentLabelSummary`)
- Em `ReagentLot`: `name`, `quantityValue`, `stockUnit`, `estimatedConsumption`, `startDate`, `endDate`, `alertThresholdDays`, `stockPct`, `daysToRupture`
- Em `ReagentLotRequest`: idem

### 6.8 VoiceRecorderModal — mapeamento

```ts
onApply={(data) => {
  setLotForm((current) => ({
    ...current,
    label: typeof data.label === 'string'
      ? data.label
      : typeof data.name === 'string'      // legado
        ? data.name
        : current.label,
    lotNumber: typeof data.lot_number === 'string' ? data.lot_number : current.lotNumber,
    expiryDate: typeof data.expiry_date === 'string' ? data.expiry_date : current.expiryDate,
    manufacturer: typeof data.manufacturer === 'string' ? data.manufacturer : current.manufacturer,
  }))
  setIsLotModalOpen(true)
}}
```

Aceita `data.label` e `data.name` como fallback (compatibilidade com prompt antigo do agente de voz). Nao auto-cria etiqueta — combobox abre e usuario decide (decisao 1.4).

---

## 7. Criterios de aceite (testes minimos)

### 7.1 Backend

**`ReagentServiceTest.java`** (substitui/expande os atuais):

- `deriveStatus`:
  - `expiryDate < today AND stock > 0` → `vencido`
  - `expiryDate < today AND stock = 0` → `vencido` (decisao 6 — sem `inativo`)
  - `expiryDate >= today AND stock = 0` → `fora_de_estoque`
  - `expiryDate >= today AND stock > 0 AND opened = null` → `em_estoque`
  - `expiryDate >= today AND stock > 0 AND opened != null` → `em_uso`
  - `expiryDate IS NULL` → mantem status atual (defesa — nao pode acontecer apos V13 mas teste protege)

- `createLot`:
  - request com `expiryDate < today AND status='em_estoque'` → lote sai com `status='vencido'` E audit_log entry com from='em_estoque', to='vencido', trigger='createLot'
  - request com `status='em_uso' AND openedDate=null` → openedDate setado para today
  - request com `(lotNumber, manufacturer)` ja existente → BusinessException "ja existe..."
  - request com category fora de CATEGORIES → BusinessException
  - request com storageTemp fora de TEMPS → BusinessException
  - request com manufacturer blank (apos V13) → @NotBlank rejeita no DTO

- `updateLot`:
  - lote `em_estoque` → request muda `status='em_uso'` E openedDate=null → openedDate setado para today
  - lote `em_uso` → request muda `status='fora_de_estoque'` → openedDate **mantido** (nao apagado)

- `createMovement`:
  - `em_estoque` + SAIDA parcial (>0 final) → status passa a `em_uso` + audit
  - `em_estoque` + SAIDA total → status passa a `fora_de_estoque` + audit
  - `fora_de_estoque` + ENTRADA → status passa a `em_uso` + audit
  - `fora_de_estoque` + AJUSTE > 0 → status passa a `em_uso` + audit
  - `vencido` + ENTRADA → BusinessException "Lote vencido nao aceita nova entrada" + audit MOVEMENT_BLOCKED
  - `em_uso` + SAIDA total → status passa a `fora_de_estoque` + audit (continua precisando de reason — saida que zera)

- `deleteLot`:
  - lote sem movimentos e sem CQ → delete fisico
  - lote com movimentos e estoque > 0 → BusinessException + audit DELETE_BLOCKED
  - lote com movimentos e estoque = 0 e status != `fora_de_estoque` → status vira `fora_de_estoque` + audit LOT_ARCHIVED

- `getLabelSummaries`:
  - 3 lotes com mesma label, status diversos → retorna 1 entry com counts corretos por estado novo

**`ReagentControllerTest.java`:**

- `GET /api/reagents?status=ativo` → 400 com mensagem "Status legado nao suportado..."
- `GET /api/reagents?status=em_estoque` → 200
- `GET /api/reagents/labels` → 200 + array com shape `ReagentLabelSummary`
- `GET /api/reagents/tags` → 200 + array com shape `ReagentTagSummary` (alias) E header `Deprecation: true`
- `POST /api/reagents` com label nova + 9 campos canonicos → 201
- `POST /api/reagents` sem `location` → 400
- `POST /api/reagents` com `category` fora de lista → 400
- CSV header bate exatamente com decisao 1.5

**`ReagentMigrationV13Test.java` (NOVO — `@SpringBootTest` com Flyway real ou Testcontainers):**

- Seed pre-V13 com mix de status antigos:
  - 1 lote `quarentena` + dentro validade + estoque 0 + opened null → apos migracao: `fora_de_estoque` + audit entry com trigger='quarentena_removed_v2'
  - 1 lote `quarentena` + dentro validade + estoque 5 → `em_uso`
  - 1 lote `inativo` + dentro validade + estoque 0 → `fora_de_estoque`
  - 1 lote `ativo` + estoque > 0 + opened null → `em_estoque`
  - 1 lote `ativo` + estoque > 0 + opened != null → `em_uso`
  - 1 lote `ativo` + estoque = 0 → `fora_de_estoque`
  - 1 lote `vencido` (qualquer estoque) → `vencido` (no-op, **sem** entry em audit)
  - 1 lote `em_uso` (dentro validade) → `em_uso` (no-op, **sem** audit)
- Apos V13:
  - `SELECT COUNT(*) FROM reagent_lots WHERE status NOT IN ('em_estoque','em_uso','fora_de_estoque','vencido')` retorna 0
  - Constraint `chk_reagent_lots_status` existe e rejeita `INSERT ... status='quarentena'`
  - Colunas `quantity_value`, `stock_unit`, `estimated_consumption`, `start_date`, `end_date`, `alert_threshold_days` nao existem
  - Audit entries para os lotes que mudaram tem `details->>'trigger' = 'quarentena_removed_v2'`

**`ReagentExpirySchedulerTest.java`:**

- Lote `em_uso` com `expiry_date < today` → scheduler marca como `vencido` + audit trigger='scheduler'
- Lote `em_estoque` com `expiry_date = today + 1` → scheduler nao mexe

**`ReagentesRastreabilidadeGeneratorTest.java`:**

- PDF gerado contem cards "Em estoque", "Em uso", "Fora de estoque", "Vencidos" (labels novas)
- PDF nao contem secao "Consumo estimado por categoria"
- Secao "Vencidos com estoque" continua presente quando `status='vencido' AND currentStock > 0` existe

### 7.2 Frontend

**`ReagentesTab.test.tsx`:**

- Mount inicial → `viewMode === 'tags'` (padrao novo)
- Toggle para list e volta para tags
- `ReagentLotModal`:
  - Renderiza 4 secoes: Identificacao, Estoque & Status, Armazenamento, Detalhes adicionais (collapsible, fechado)
  - Salvar com etiqueta nova (digitada na combobox sem clicar em "+") e os 9 campos preenchidos → chama `createLot.mutateAsync` com `request.label` igual ao digitado
  - Salvar com `expiryDate < today` selecionado → mostra banner amarelo
- Combobox de etiqueta:
  - Render labels existentes
  - Digitar query → mostra "+ Criar nova etiqueta: \"X\""
  - Click no item → seta valor no form
- Filtros:
  - Selecionar `status='em_estoque'` → query refetch com novo valor
- Card dentro de etiqueta exibe `Lote {n} . {fabricante}` no `<h4>`
- Dashboard exibe 5 cards principais + 4 cards de acao quando ha alertas
- Sem cards `Risco de ruptura` ou `Baixo estoque` no DOM

**`Combobox.test.tsx`** (existente — nao precisa alterar): apenas validar que continua funcional.

### 7.3 Migracao — dry-run

O `dry-run.sql` produz exatamente:
- Tabela com `current_status, row_count, target_status` para todas as combinacoes presentes
- 0 linhas com `target_status = 'UNKNOWN'`
- 0 linhas com `manufacturer IS NULL`
- 0 linhas com `expiry_date IS NULL`

Caso contrario, deploy abortado. Issue para `domain-auditor`.

### 7.4 Auditoria — invariantes

Para cada cenario de transicao automatica testado em 7.1, validar que `audit_log` recebeu entry com:
- `action = 'REAGENT_STATUS_DERIVED'` (ou `'REAGENT_MOVEMENT_BLOCKED'` em bloqueios)
- `entity_type = 'ReagentLot'`
- `entity_id = <uuid esperado>`
- `details->>'from'`, `details->>'to'`, `details->>'trigger'` presentes e corretos

---

## 8. Plano de implementacao paralelizavel

### Sequencia de PRs (recomendada)

**PR-1 — Backend base (bloqueante):**
- Atualiza `ReagentStatus` (enum-like) com 4 constantes novas
- Atualiza `ReagentLot` entity (remove campos obsoletos, mantem `name`)
- Atualiza `ReagentLotRequest`, `ReagentLotResponse`, cria `ReagentLabelSummary`
- Atualiza `ReagentService` (deriveStatus, applyDerivedStatus, applyOpenedDateOnUseTransition, createLot, updateLot, createMovement, deleteLot, getLabelSummaries)
- Atualiza `ReagentLotRepository` (projection nova, queries com novos status)
- Atualiza `ResponseMapper.toReagentLotResponse` (mapeia `name`→`label`)
- Atualiza `ReagentExpiryScheduler` (mensagens log)
- Cria migracao `V13__reagent_lots_status_v2.sql`
- Mantem `/api/reagents/tags` como **alias deprecated** que delega para `getLabelSummaries` mapeando shape antigo
- Atualiza `ReagentController` (endpoint `/labels`, csv novo, validacao status legado)
- Atualiza `DashboardService.findExpiringLots` (status NOT IN ('vencido','fora_de_estoque'))
- Atualiza generators de reports v2 (labels novas, sem barChart de consumo)
- Bateria de testes em 7.1 toda verde

**Critical path:** sem PR-1, frontend nao tem como consumir contrato novo. PR-2 espera PR-1 estar mergeado em `main`.

**PR-2 — Frontend base:**
- Atualiza `types/index.ts` (`ReagentLot`, `ReagentLotRequest`, `ReagentLabelSummary` — `ReagentTagSummary` ainda exportado para nao quebrar build apos PR-1, mas marcado @deprecated)
- Atualiza `reagentService.ts` (`getLabels()` substitui `getTagSummaries`)
- Atualiza `useReagents.ts` hooks
- Atualiza `constants.ts` (`TAG_STATUS_TABS`, novas listas)
- Atualiza `utils.ts` (`buildReagentStats`, `filterReagentLots`, `createEmptyLotForm`, `getLotVisualState`)
- Atualiza `schemas.ts` (validacao com `label` em vez de `name`, 9 campos obrigatorios)
- Atualiza `ReagentModals.tsx` (4 secoes novas, combobox de etiqueta, status novo)
- Atualiza `ReagentsContent.tsx` (header de card `Lote {n} . {fabricante}`, sem stockPct/daysToRupture, action labels)
- Atualiza `ReagentsDashboard.tsx` (5 cards principais novos, 4 de acao, sem ruptureRisk/lowStock)
- Atualiza `ReagentsFilters.tsx` (`STATUS_OPTIONS` novo)
- Atualiza `ReagentesTab.tsx` (`viewMode='tags'` default, voiceModal mapeando `label`)
- Atualiza `VoiceRecorderModal.tsx` (mapping label/name)
- Bateria de testes em 7.2 toda verde

**Fallback de transicao:** em PR-2, codigo le `lot.label ?? lot.name` por uma branch de seguranca caso algum cliente fique stale durante o deploy. PR-4 dropa o fallback.

**PR-3 — Reports v2 (cross):**
- Pode ir junto com PR-1 ou separado. Atualiza `ReagentesRastreabilidadeGenerator`, `MultiAreaConsolidadoGenerator`, `ReportAiPrompts` para labels novas e remocao da secao de consumo. Compatibilidade com runs antigos: ler PDFs ja gerados nao e tocado (sao imutaveis por design).

**PR-4 — Cleanup (apos PR-1, PR-2, PR-3 estaveis em prod por 1 semana):**
- Remove endpoint `/api/reagents/tags` e DTO `ReagentTagSummary`
- Remove tipo TS `ReagentTagSummary`
- Remove fallback `lot.label ?? lot.name` no frontend
- Drop `dry-run.sql` ou move para arquivo historico

### Tradeoff: PR unico vs sequencia

**Recomendacao: sequencia de 4 PRs.**

Justificativa: PR-1 sozinho e enorme (entidade, service, repository, mapper, scheduler, controller, migracao, 4+ generators, 50+ testes ajustados). PR unico junto com frontend dificultaria revisao e abriria janelas de quebra (build do frontend dependendo de fields que so existem em outro commit). A sequencia permite que cada PR seja revisado isoladamente. O alias temporario `/tags` em PR-1 garante que durante a janela entre PR-1 mergeado e PR-2 mergeado, frontend antigo continua funcional (PR-1 nao quebra prod).

---

## 9. Riscos e invariantes

### Invariantes — NAO podem quebrar

1. **Auditoria historica imutavel.** Audit_log entries pre-V13 com `details.from='quarentena'` ou `details.to='inativo'` permanecem como estao. V13 **insere novos** registros, nunca **edita** existentes.

2. **PDFs reports v2 ja assinados.** Imutaveis por SHA-256 + `report_runs.report_number`. Nao retroagir, nao regenerar. Reports gerados apos PR-3 usarao labels novas; reports antigos sao historico vivo.

3. **`usedInQcRecently` continua funcional.** Implementacao em `ReagentService.lotNumbersUsedInQcRecently` (linhas 104-118) e `QcRecordRepository.findActiveLotNumbersSince` (linha 133) **nao mudam**. Continua usando `lot_number` (string), nao FK. PR-1 toca em `getLots` mas preserva exatamente essa logica.

4. **Cardinalidade unica `(lot_number, manufacturer)` preservada.** Indice criado por `DatabaseIndexInitializer.java` continua. Manufacturer NOT NULL apos V13 nao quebra (o COALESCE no LOWER continua harmless).

5. **Reports v2 antigos parseaveis.** Backends que lerem `report_runs` antigos vao ver `lot.status` em campos como `'ativo'`, `'inativo'`, `'quarentena'`. Codigo que processa reports antigos (raro — eles sao PDFs autonomos) precisa aceitar a uniao `OldStatus | NewStatus`. Isso afeta `ReportAiPrompts` se ele referenciar status especifico — revalidar literalmente em PR-3.

6. **Politica de `deleteLot` preservada.** Lote com movimentos ou uso em CQ **nao** pode ser deletado fisicamente. Apenas arquivado logicamente. So muda o destino: `inativo` → `fora_de_estoque`. Compliance ANVISA RDC 302 / ISO 15189 respeitada (nenhum dado historico se perde).

7. **Quarentena removida sem perda de informacao.** Cada transicao da migracao V13 grava em audit_log. Auditor pode reconstruir 100% do estado pre-V13 a partir dos registros (`from='quarentena'` em algum momento → estado original).

8. **Scheduler diario continua funcional.** `ReagentExpiryScheduler.markExpiredLots` nao muda assinatura. Apenas a logica interna de derivacao do status muda (atraves do novo `deriveStatus`).

### Riscos

1. **DROP COLUMN com transacao concorrente.** Postgres em DROP COLUMN adquire AccessExclusiveLock. Em janela de manutencao isso e OK; em deploy "quente" pode bloquear queries por segundos. **Mitigacao:** rodar V13 em janela noturna.

2. **Teste de seed real.** Bug recorrente em migracoes: `dry-run` em base limpa de staging que nao espelha producao. **Mitigacao:** dry-run sobre `pg_dump` recente da producao restaurado em staging.

3. **Cliente externo de CSV.** Algum integrador externo pode estar consumindo `/api/reagents/export/csv` com header antigo. **Mitigacao:** changelog formal antes do deploy. Sem versao do endpoint — quebra unica.

4. **Combobox auto-cria por engano.** O componente atual seta o form em cada keystroke. Se algum lugar do codigo dispara salvamento em onBlur ou onChange (fora de onClick em "Salvar"), o lote pode ser criado prematuramente. **Mitigacao:** revisao de PR-2 explicita para confirmar que `onSave` so dispara em click do botao.

5. **`canReceiveEntry` propagado corretamente.** Backend retorna `canReceiveEntry: false` para `vencido`. Frontend tem fallback em `utils.ts:103` que usa `lot.status !== 'inativo'`. Apos PR-1, esse fallback fica errado (deveria ser `!== 'vencido'`). **Mitigacao:** PR-2 atualiza o fallback simetricamente.

---

## 10. Perguntas remanescentes

**Nenhuma.** Todas as 9 ambiguidades do context-pack receberam decisao em secao 1. As 8 decisoes prevalentes do orchestrator foram respeitadas integralmente.

**Notas de aprovacao para `domain-auditor`:**

- Confirmar que decisao 1.6 (sem `arquivado` separado) nao quebra invariante regulatorio. O conceito antigo `inativo` (terminal) e absorvido por `vencido + currentStock=0` e `fora_de_estoque + sem CQ recente`. Risco: relatorios regulatorios externos podem ter referencias literais a "inativo" que precisem ser remapeadas. **Domain auditor valida.**

- Confirmar que decisao 1.7 (openedDate gravado em UPDATE quando status vira em_uso) e aceitavel para auditoria. Alternativa rejeitada: openedDate so em CREATE e usuario sempre seta manualmente em UPDATE. Razao da rejeicao: aumenta carga manual sem ganho regulatorio.

- Confirmar que decisao 1.11 (remocao da secao "Consumo estimado por categoria" do PDF) e aceitavel para reports v2. Se for, contrato congelado.

---

## Status

**CONGELADO.** Backend e frontend podem implementar em paralelo apos audit do `domain-auditor`. Em caso de bloqueio, voltar ao orchestrator.

**Proximo agente:** `domain-auditor`.
