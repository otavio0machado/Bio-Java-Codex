# Domain Audit — Refatoracao Reagentes v2

> **Status:** APROVADO_COM_RESSALVAS
> **Insumos auditados:** `00-context-pack.md`, `01-contract.md` (CONGELADO pelo `architect`)
> **Auditor:** `domain-auditor`
> **Data:** 2026-04-27
> **Regulamentos referenciados:** ANVISA RDC 302/2005 (arts. 49 e 60), ISO 15189:2022 (§5.3.2.7, §5.7, §6.2), CLAUDE.md (lote, status de CQ, registro de medicao)

Este parecer NAO reescreve o contrato do `architect`. Apenas valida invariantes regulatorios, sinaliza ressalvas e exige acoes corretivas concretas onde necessario.

---

## 1. Veredito por bloqueante

### 1.6 — Absorcao do conceito `inativo` por `vencido + estoque=0` e `fora_de_estoque`
**Veredito: APROVADO_COM_RESSALVAS.**

A composicao `(status='vencido' AND currentStock=0)` preserva a semantica do antigo `inativo` (terminal/historico) sem perda de informacao operacional. A trilha auditavel continua intacta porque:

1. ANVISA RDC 302 art. 49 (registro de descarte de reagentes vencidos): atendido. O lote vencido continua identificavel via `expiry_date < today AND currentStock IN (0, >0)`. O movimento de SAIDA que zera o estoque continua exigindo `reason` (decisao 4.7 — `ReagentService.java:336-343` mantida) e gera `StockMovement` com `previousStock` para reconstruir o descarte.
2. ISO 15189 §5.3.2.7 (controle de insumos criticos com estoque esgotado): atendido. `fora_de_estoque` e um estado distinto e consultavel; o auditor pode listar `WHERE status='fora_de_estoque'` ou `WHERE status='vencido' AND currentStock=0`.
3. CLAUDE.md "lote": preservado. O `lot_number` permanece imutavel; somente o enum de classificacao mudou.

**Ressalva critica (acao corretiva exigida):** o conjunto de auditorias historicas em `audit_log` tem `details->>'to' = 'inativo'` para registros pre-V13. Auditores externos que consultem audit_log com filtro literal `to='inativo'` deixam de encontrar lotes que migraram para `fora_de_estoque` apos V13. Mitigacao OBRIGATORIA: o `release-engineer` deve documentar em `dry-run.sql` (e no changelog do PR-1) a equivalencia operacional `inativo (legado) = vencido AND stock=0 (vigente) UNION fora_de_estoque (vigente sem CQ recente)`. Sem essa nota, a interpretacao de relatorios historicos cruzados fica ambigua.

### 1.7 — `openedDate` setado em UPDATE quando admin marcar `em_uso` com `openedDate=null`
**Veredito: APROVADO_COM_RESSALVAS.**

Do ponto de vista regulatorio, e aceitavel desde que a operacao seja **rastreavel separadamente** das outras transicoes. ISO 15189 §5.7 (registros de processos preanaliticos) e ANVISA RDC 302 art. 60 exigem que a data de abertura de um insumo critico seja registrada ou justificavel. Um backfill silencioso via update administrativo viola a expectativa de "abertura = evento operacional real".

**Acao corretiva OBRIGATORIA (bloqueante para PR-1):** quando `applyOpenedDateOnUseTransition` (decisao 5.2) gravar `openedDate=today` em UPDATE (e nao em CREATE nem em movimento de ENTRADA), DEVE registrar audit_log com action **distinta** — sugestao: nova constante `AUDIT_ACTION_OPENED_DATE_BACKFILLED` (string `REAGENT_OPENED_DATE_BACKFILLED`). Detalhes minimos: `{ openedDate, fromStatus, toStatus, trigger:'updateLot' }`. Razao: separar "abertura natural" (CREATE com status=em_uso, ou ENTRADA em fora_de_estoque) de "abertura administrativa" (admin editou status, sem evidencia operacional) — auditor pode quantificar o segundo caso.

A frase ambigua do contrato 5.2 ("Aplicada apos derivacao quando o status final sera 'em_uso' E openedDate ainda eh null") cobre os 3 caminhos com a mesma logica. O `backend-engineer` precisa **diferenciar** o caminho de UPDATE administrativo dos demais. Se o codigo for unificado, perde o sinal de auditoria.

### 1.11 — Remocao da secao "Consumo estimado por categoria" no PDF de Reagentes Rastreabilidade
**Veredito: APROVADO_COM_RESSALVAS.**

PDFs ja assinados (com SHA-256 + `report_runs.report_number`) sao imutaveis e permanecem como historico — OK. Mas o **template novo** perde uma metrica que auditores externos podem solicitar em inspecao ANVISA RDC 302 (para projetar duracao de estoque vs validade). O architect ja documentou o TODO de produto.

**Acao corretiva RECOMENDADA (nao-bloqueante):** o `backend-engineer` deve, junto a remocao da secao, adicionar **comentario inline** no `ReagentesRastreabilidadeGenerator` dizendo: "Secao removida em refator-v2. Para regenerar consumo, derive de `StockMovement` agregando SAIDA por categoria/janela 30/60/90 dias — issue separada." Isso evita que a remocao seja interpretada como "metrica nunca existiu" em revisao futura.

Auditor recomenda fortemente abrir issue paralela para reintroducao do KPI de consumo derivado, antes da proxima inspecao formal. **Nao bloqueia o PR-1**, mas e item de followup com prazo.

---

## 2. Achados adicionais (A–G)

### A. Migracao V13 — DROP COLUMN, dependencias, ordem de constraints
**Veredito: APROVADO_COM_RESSALVAS.**

Validacoes feitas:
1. Nao ha trigger, view, ou stored procedure dependendo das colunas a serem dropadas. `grep` em `db/migration/*.sql` nao retornou nada.
2. Reports v2 historicos nao serao regenerados — OK por design.
3. **Ordem das operacoes em V13 (contrato 3.2) esta CORRETA**: passo 2 (UPDATE) precede passo 5 (ADD CHECK CONSTRAINT). Lotes em status legado sao reescritos para o novo dominio antes do CHECK ser plantado, evitando erro `value violates check constraint`.

**Ressalvas:**

- **Tipo de coluna `audit_log.details` e `json`, NAO `jsonb`** (`V1__baseline_schema.sql:46`, `AuditLog.java:51`). O contrato V13 (3.2 passo 1) usa `jsonb_build_object(...)` para construir o JSON. Postgres faz cast implicito de `jsonb → json` na insercao, entao **funciona**, mas e fragil. **Acao corretiva:** o `release-engineer` deve testar explicitamente em staging a insercao via V13 com `jsonb_build_object` na coluna `json`. Alternativa segura: usar `json_build_object(...)` (mesmo shape, sem cast) — recomendado.
- **Idx `idx_reagent_lots_status` e `idx_reagent_lots_name`**: bem-vindos. `idx_reagent_lots_expiry_date` ja seria util mesmo sem essa refatoracao. Ganho de leitura claro, custo de write desprezivel.
- **DROP COLUMN em Postgres adquire AccessExclusiveLock** (ja registrado em 9.1 do contrato como risco). Ressalva: V13 envolve 6 DROP COLUMN + 2 ALTER COLUMN SET NOT NULL + 1 ADD CONSTRAINT + 3 CREATE INDEX dentro de um BEGIN/COMMIT. Em base com volume real de Biodiagnostico (laboratorio unico, dezenas de lotes), tempo de lock e desprezivel. **Sem mitigacao adicional necessaria** alem da janela noturna ja prevista.
- **CRITICO — passo 1 (INSERT audit_log) referencia colunas que serao dropadas no passo 3**. Como ambas estao no mesmo BEGIN/COMMIT, isso esta OK (passo 1 le `r.expiry_date` e `r.current_stock` que sobrevivem). Mas o INSERT cita literais `r.status` que mudarao no passo 2 — isso OK porque o passo 1 e EXECUTADO ANTES do passo 2. Confirmacao registrada.

### B. Regra ternaria validade × estoque × abertura — casos de canto
**Veredito: APROVADO.**

Validacao caso a caso:

1. Lote cadastrado com `expiry < hoje AND currentStock = 0 AND openedDate = null` ("registrar historico depois") → `vencido` (regra 1 do `deriveStatus` em 5.1, e tambem a primeira clausula do CASE em 3.3). **Force-vencido e unconditional, OK.**
2. Lote `vencido` com `currentStock > 0` — bloqueio de ENTRADA mantido (decisao 1.8). **SAIDA permitida** (linha 485 da matriz 4.7: `vencido + SAIDA → -q → vencido (mantem — descarte registrado)`). Isso preserva ANVISA RDC 302 art. 49 — descarte e registro com lote ainda visivel. **OK.**
3. Lote `fora_de_estoque` recebendo ENTRADA → `em_uso` (linha 480 da matriz 4.7). **Caso `openedDate=null`:** a decisao 5.2 garante que `applyOpenedDateOnUseTransition` dispara apos a derivacao apontar para `em_uso`, gravando `openedDate=today`. O fluxo do `createMovement` (5.6) chama `applyDerivedStatus(lot, today, 'movement')` que internamente chama `applyOpenedDateOnUseTransition`. **Consistente, OK.**

**Ressalva (defesa em profundidade, nao-bloqueante):** o teste regulatorio 7.1 nao cobre explicitamente o caso "ENTRADA em fora_de_estoque com openedDate=null grava openedDate=today". O `qa-engineer` deve adicionar esse cenario na bateria — exigencia formalizada em secao 3.

### C. Combobox de etiqueta — variantes de capitalizacao
**Veredito: APROVADO_COM_RESSALVAS.**

A decisao 1.4 (case-insensitive trim para match com label existente) ja mitiga o problema de "Glicose" vs "GLICOSE" no callback de voz. Mas a combobox HTML (`Combobox.tsx:167`) faz `onChange(raw.trim())` sem normalizacao adicional ao montar o request final. Logo o usuario pode digitar "  Glicose - Wama  " e isso virara a label canonica salva, enquanto outro lote ja tem "Glicose Wama" cadastrado.

**Acao corretiva OBRIGATORIA (bloqueante para PR-2):** `frontend-engineer` deve aplicar normalizacao `String.trim()` no `request.label` antes de enviar para o backend (em `useCreateReagentLot` ou diretamente no submit do `ReagentLotModal`). Backend ja deveria, defensivamente, fazer o mesmo trim no service. A questao de UNIQUE em `LOWER(name)` **nao** e exigida — preserva intencao do usuario (variantes deliberadas continuam validas).

**Por que nao UNIQUE em LOWER(name):** etiquetas livres servem para agrupar lotes. Se "Glicose" e "Glicose - Wama" forem etiquetas distintas intencionais, o medico/quimico pode querer separa-los. UNIQUE em LOWER bloquearia isso. **Decisao:** apenas trim defensivo, sem UNIQUE adicional. Frontend mostra na busca da combobox os duplicados aproximados (ja faz isso com `filter` client-side).

### D. `usedInQcRecently` via `lot_number` — politica conservadora em colisao
**Veredito: APROVADO.**

Confirmado no codigo (`ReagentService.java:85-95` + `lotNumbersWithCollision:125-139`):
- A flag `usedInQcRecently` so e marcada `true` quando `inQc && !ambiguous`.
- Em colisao (mesmo `lot_number` em 2+ lotes de fabricantes diferentes), nenhum dos lotes recebe a flag.
- Politica conservadora protege o auditor: nunca afirma "este lote foi usado em CQ recente" sem certeza absoluta de identidade.

A refatoracao **nao toca** essa logica (PR-1 preserva exatamente — confirmado no contrato secao 9.3 — invariante 3 da lista). **OK.**

### E. `audit_log` — performance de inserts em massa na V13
**Veredito: APROVADO_COM_RESSALVAS.**

Validacoes feitas:
1. `audit_log` tem PK em `id` (UUID) e FK em `user_id`. **Sem cascata circular** — nao ha trigger em audit_log que escreve em reagent_lots ou vice-versa (`grep` em V1-V12 confirmou).
2. **Sem indices no audit_log alem do PK e FK.** Inserts em massa nao terao penalidade de manutencao de indice — OK do ponto de vista de performance.
3. **Volume real:** considerando que o laboratorio tem dezenas a poucas centenas de lotes ativos, a V13 inserira no maximo algumas centenas de linhas em audit_log no momento da migracao. Trivial.

**Ressalva (nao-bloqueante, mas importante):** a falta de indice em `(entity_type, entity_id)` em `audit_log` ja e um debito documentado implicitamente — `findByEntityTypeAndEntityId` em `AuditLogRepository.java` faria seq scan. Esse e um problema pre-existente, **nao** causado por esta refatoracao. **Recomendacao:** o `release-engineer` registre issue paralela para criar `idx_audit_log_entity` em release proximo. Nao bloqueia V13.

### F. Reports v2 generators — retrocompatibilidade com status legados
**Veredito: APROVADO_COM_RESSALVAS.**

Auditoria de leitura de status nos generators:
- `ReagentesRastreabilidadeGenerator.java:129-130, 247`: usa literais `"ativo"` e `"inativo"` em filtros e contadores. **Apos V13, esses literais nao casam com NENHUMA linha** — todas as linhas tem status novo. Os contadores `ativos`, `inativos` zeram falsamente.
- `MultiAreaConsolidadoGenerator.java`: usa `countExpiredWithStock` — preservado, OK.
- `CqOperationalV2Generator.java`: status de QcRecord (APROVADO/ALERTA/REPROVADO) — nao afetado pela refatoracao.

**Acao corretiva CRITICA (bloqueante para PR-1 e PR-3):** o contrato 8 ja prescreve que PR-1 atualiza generators para "labels novas" e PR-3 e dedicado a reports v2. Mas o contrato nao explicita que `ReagentesRastreabilidadeGenerator` precisa **continuar lendo PDFs historicos com labels antigas em registros agregados** — isso e impossivel porque PDFs historicos sao imutaveis e ja contem strings. O que o backend-engineer DEVE garantir e:

1. Os generators **so geram PDFs novos com labels novas** (em_estoque, em_uso, fora_de_estoque, vencido).
2. Os contadores e filtros internos do generator NAO usam mais os literais `"ativo"` e `"inativo"`. Devem usar `"em_estoque"`, `"em_uso"`, `"fora_de_estoque"`, `"vencido"`.
3. A logica `vencidos com estoque` (filtro `status='vencido' AND currentStock>0`) **substitui** semanticamente a antiga "Inativos" (decisao 1.6) e tambem a antiga "Vencidos com estoque". Ambos passam a ser contados pelo mesmo filtro. **OK.**
4. Leitura de PDFs historicos: nao acontece. Eles sao binarios assinados.

`ReportAiPrompts.java`: tem a string "reagentes vencidos" — nao precisa mudar. **OK.** Conferir manualmente em PR-3 que nenhum prompt cita literalmente "lote ativo" ou "lote inativo" — `grep -n "ativo\|inativo" ReportAiPrompts.java` em PR-3.

### G. `ReagentExpiryScheduler` — primeira execucao pos-V13
**Veredito: APROVADO_COM_RESSALVAS.**

Cenario: dia D+1 apos V13. Scheduler roda `0 0 1 * * *` e:
- Pega todos os lotes com `expiry < today` que nao estao em `vencido` (hoje filtro: `NOT IN ('inativo','quarentena')`; pos-refator deve ser apenas `<> 'vencido'` — confirmar em PR-1).
- Aplica `deriveStatus` novo. Como a V13 ja fez UPDATE coerente, **a maioria das linhas vai retornar no-op** (status atual = derivado).

**Ressalva:** se a V13 fechou em momento `t0` e o scheduler roda `t0+1h`, lotes que **expiraram entre t0 e t0+1h** apareceriam como transicao falsa. Volume desprezivel (1 ou 2 lotes no maximo), gerando audit_log entries com `trigger='scheduler'`. **Aceitavel** — e o comportamento normal e correto do scheduler.

**Acao corretiva (mitigacao opcional):** rodar V13 em janela noturna **antes** do horario de cron do scheduler (`01:00`). Se V13 e deployada `00:30`, scheduler `01:00` nao tera nada a fazer — confirmacao adicional de saude do sistema.

**Outro caso:** lotes que migraram para `fora_de_estoque` na V13 mas que tem `expiry < today` (cenario impossivel pelo mapping 3.3 — regra 1 do CASE captura todos os vencidos primeiro). Confirmado: **nao ha estado intermediario inconsistente.**

---

## 3. Lista de testes regulatorios obrigatorios

Esta lista e canonica e DEVE ser implementada pelo `qa-engineer` (e estendida em `ReagentServiceTest.java`, `ReagentControllerTest.java`, e novo `ReagentMigrationV13Test.java`).

### 3.1. Auditoria de transicao automatica
- [ ] Cada chamada de `applyDerivedStatus` que muda o status DEVE inserir 1 linha em `audit_log` com:
  - `action = 'REAGENT_STATUS_DERIVED'`
  - `entity_type = 'ReagentLot'`
  - `entity_id` = UUID do lote
  - `details->>'from'`, `details->>'to'`, `details->>'trigger'`, `details->>'expiryDate'`, `details->>'currentStock'` presentes e nao-nulos
- [ ] Validar via `AuditLogRepository.findByEntityTypeAndEntityId(...)` em `@SpringBootTest` JPA, ou via mock de `AuditService` em teste de unidade.
- [ ] No-op (status atual = derivado) NAO deve inserir nada — confirmar contagem zero.

### 3.2. Backfill de `openedDate` em UPDATE administrativo (BLOQUEANTE — gerado pela ressalva 1.7)
- [ ] Quando `updateLot` recebe request com `status='em_uso'` E `openedDate=null` E lote atual nao tem `openedDate`, o servico DEVE:
  - Setar `lot.openedDate = today`
  - Inserir audit_log com action **distinta** (`REAGENT_OPENED_DATE_BACKFILLED`) e `details = { openedDate, fromStatus, toStatus, trigger:'updateLot' }`
- [ ] CASO 1: Lote `em_estoque` com `openedDate=null` → request muda para `em_uso` → openedDate setado E audit BACKFILLED.
- [ ] CASO 2: Lote `em_uso` com `openedDate=null` (anomalia possivel) → mesma regra dispara.
- [ ] CASO 3: Lote `em_uso` com `openedDate` ja setada → request mantem `em_uso` → **nao** insere BACKFILLED (idempotencia).

### 3.3. Migracao V13 — snapshot pre/pos
- [ ] `ReagentMigrationV13Test.java` (novo, `@SpringBootTest` com Flyway real ou Testcontainers) faz seed pre-V13 com mix dos 5 status legados, executa Flyway, confere:
  - `SELECT COUNT(*) FROM reagent_lots WHERE status NOT IN ('em_estoque','em_uso','fora_de_estoque','vencido')` retorna 0
  - `chk_reagent_lots_status` rejeita INSERT com status legado
  - Colunas `quantity_value`, `stock_unit`, `estimated_consumption`, `start_date`, `end_date`, `alert_threshold_days` nao existem no schema pos-V13
  - Audit entries para lotes que mudaram tem `details->>'trigger' = 'quarentena_removed_v2'`
  - **Soma de contagens pre = soma de contagens pos** (nenhum lote sumiu).

### 3.4. `usedInQcRecently` continua bloqueando descarte de lote em CQ
- [ ] Lote com `lotNumber='X'` E existente em `qc_records` com `created_at >= today - 60d` E `currentStock > 0` → `deleteLot(id)` lanca `BusinessException` com mensagem "...com estoque atual..." E grava audit `REAGENT_DELETE_BLOCKED`.
- [ ] Mesmo lote com `currentStock = 0` → `deleteLot(id)` arquivava (status novo: `fora_de_estoque`) E grava audit `REAGENT_LOT_ARCHIVED` com `details->>'to' = 'fora_de_estoque'`.

### 3.5. Status `vencido` forcado em cadastro
- [ ] `createLot` com `request.expiryDate < today AND request.status='em_estoque'` → lote salvo com `status='vencido'` (nao com `em_estoque`) E audit_log com `from='em_estoque', to='vencido', trigger='createLot'`.
- [ ] Mesmo cenario com `request.status='em_uso'` → lote salvo com `status='vencido'`. **`openedDate` nao deve ser setada** (regra `applyOpenedDateOnUseTransition` so dispara quando final = em_uso, e neste caso final = vencido).

### 3.6. ENTRADA em `fora_de_estoque` grava `openedDate=today` se null (gerado pela ressalva B)
- [ ] Lote `fora_de_estoque` com `openedDate=null` → ENTRADA com q=10 → status novo `em_uso` E `openedDate=today` E audit `STATUS_DERIVED` com `trigger='movement'`.
- [ ] Mesmo cenario com `openedDate` ja setada → status novo `em_uso` E `openedDate` mantido (decisao 1.7 reciproca).

### 3.7. ENTRADA em `vencido` continua bloqueada (decisao 1.8)
- [ ] Lote `vencido` com qualquer estoque → ENTRADA dispara `BusinessException` "Lote vencido nao aceita nova entrada" E audit `REAGENT_MOVEMENT_BLOCKED` com `details->>'reason' = 'lote_vencido'` (atualizado da string atual `lote_inativo`).
- [ ] SAIDA continua permitida em `vencido` (descarte) — confirmar nao-bloqueio.

### 3.8. CSV header e colunas (decisao 1.5)
- [ ] `GET /api/reagents/export/csv` retorna primeira linha exatamente: `Etiqueta,Lote,Fabricante,Categoria,Validade,Dias Restantes,Estoque Atual,Status,Localizacao,Temperatura`
- [ ] Cada linha de dados na ordem correspondente.

### 3.9. Endpoint `/api/reagents/labels`
- [ ] Schema do response bate com `ReagentLabelSummary[]` (chaves `label`, `total`, `emEstoque`, `emUso`, `foraDeEstoque`, `vencidos`).
- [ ] Ordem `label ASC`.
- [ ] `/api/reagents/tags` (alias deprecated em PR-1) retorna shape antigo `ReagentTagSummary` E header `Deprecation: true`.

### 3.10. Generators de Reports v2
- [ ] PDF gerado pelo `ReagentesRastreabilidadeGenerator` contem cards "Em estoque", "Em uso", "Fora de estoque", "Vencidos" — NUNCA "Ativos" ou "Inativos".
- [ ] PDF nao contem secao "Consumo estimado por categoria".
- [ ] Secao "Vencidos com estoque" continua presente quando `status='vencido' AND currentStock > 0` existe.

---

## 4. Decisao final

**LIBERADO para `backend-engineer` + `frontend-engineer` em paralelo, com as ressalvas anotadas.**

### 4.1 Bloqueantes para PR-1 (backend)
1. **`AUDIT_ACTION_OPENED_DATE_BACKFILLED`** (gerado pela ressalva 1.7) — adicionar nova constante de audit action e diferenciar UPDATE administrativo dos demais caminhos de derivacao.
2. **Verificar tipo `json` vs `jsonb` em V13** — testar em staging insercao via `jsonb_build_object` em coluna `json`. Alternativa preferida: usar `json_build_object` no SQL.
3. **Generators de Reports v2** — substituir literais `"ativo"` e `"inativo"` por novos status (achado F).

### 4.2 Bloqueantes para PR-2 (frontend)
1. **Trim defensivo no `request.label`** antes do submit — evita variantes de capitalizacao acidentais (achado C).
2. **Atualizar fallback `canReceiveEntry`** em `utils.ts:103` de `lot.status !== 'inativo'` para `lot.status !== 'vencido'` (ja registrado no contrato 9.5).

### 4.3 Bloqueantes para PR-3 / release-engineer
1. **Comentario inline** em `ReagentesRastreabilidadeGenerator` documentando remocao da secao de consumo (ressalva 1.11).
2. **Documentar equivalencia** `inativo (legado) = vencido AND stock=0 (vigente) UNION fora_de_estoque (vigente sem CQ recente)` no changelog da V13 e em `dry-run.sql` (ressalva 1.6).
3. **Issue paralela** para reintroducao de KPI de consumo derivado (`StockMovement`-based) — nao bloqueia release atual mas formaliza compromisso para auditoria ANVISA seguinte.
4. **Testar V13 em staging com pg_dump recente da producao** — nao com seed limpo (ja registrado em risco 9.2 do contrato).

### 4.4 Acoes corretivas adicionais para `qa-engineer`
1. **Cobrir os 10 testes regulatorios da secao 3 acima.** Testes existentes em `ReagentServiceTest.java` precisam ser ajustados ou estendidos.
2. Validar que **soma de contagens pre-V13 = soma de contagens pos-V13** no teste de migracao (3.3).
3. Cobrir caso ENTRADA em `fora_de_estoque` com `openedDate=null` → `em_uso + openedDate=today` (3.6).

### 4.5 Sumario regulatorio

| Conceito CLAUDE.md | Status apos refatoracao |
|---|---|
| Lote (`lot_number` imutavel) | Preservado integralmente |
| Status de CQ (auditoria) | Preservado + nova action `REAGENT_OPENED_DATE_BACKFILLED` exigida |
| Registro de medicao (rastreabilidade) | Preservado (qc_records intocado) |
| ANVISA RDC 302 art. 49 (descarte de vencidos) | Preservado via `vencido` + SAIDA com reason |
| ANVISA RDC 302 art. 60 (registro de abertura) | Preservado se ressalva 1.7 for atendida |
| ISO 15189 §5.3.2.7 (insumo critico esgotado) | Preservado via `fora_de_estoque` |
| ISO 15189 §6.2 (rastreabilidade) | Preservado (PDFs historicos imutaveis + audit_log) |

---

**Veredito final:** APROVADO_COM_RESSALVAS.

Os tres pontos bloqueantes (1.6, 1.7, 1.11) sao **aceitaveis com mitigacoes definidas**. Nenhuma decisao do `architect` viola CLAUDE.md ou regulamentos referenciados, desde que as 4 acoes corretivas bloqueantes para PR-1 e as 2 para PR-2 sejam executadas. PR-3 e release-engineer tem 4 acoes nao-bloqueantes mas obrigatorias em escopo.

**Proximo agente:** `backend-engineer` (PR-1, com bloqueantes 4.1) e `frontend-engineer` (PR-2, com bloqueantes 4.2) podem trabalhar em paralelo. Apos PR-1 e PR-2 mergeados, `qa-engineer` valida a bateria da secao 3, e `release-engineer` fecha PR-3 + V13 deploy com as acoes 4.3.
