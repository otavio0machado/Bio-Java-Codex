# Domain Audit — Refatoracao Reagentes v3

> **Status:** APROVADO_COM_RESSALVAS
> **Insumos auditados:** `00-context-pack.md`, `01-contract.md` (CONGELADO pelo `architect`), `refactor-reagentes-v2/02-domain-audit.md` (heranca de invariantes)
> **Auditor:** `domain-auditor`
> **Data:** 2026-04-27
> **Regulamentos referenciados:** ANVISA RDC 302/2005 (arts. 49 e 60), ISO 15189:2022 (§5.3.2.7, §5.7, §6.2, §6.3, §7.3), CFR 21 part 11 (audit trail integrity), CLAUDE.md (lote, status de CQ, registro de medicao, historico)

Este parecer NAO reescreve o contrato do `architect`. Auditoria valida invariantes regulatorios da v3 incremental sobre v2 mergeada. Heranca de v2 reaplicada onde pertinente. Bloqueios concretos, nao cosmeticos.

---

## 1. Veredito por bloqueante

### 1.1 — Combobox responsavel acessivel a FUNCIONARIO (decisao 1.5)

**Veredito: APROVADO_COM_RESSALVAS.**

Validacao regulatoria do shape `{id, name, username, role}` filtrado por `role IN (ADMIN, FUNCIONARIO) AND isActive=true`:

1. **LGPD art. 7º, §5º (legitimo interesse intra-organizacional):** atendido. O endpoint expoe apenas dados estritamente necessarios para registrar autoria operacional. NAO inclui `email`, `passwordHash`, `permissions`, `createdAt`, `lastLoginAt` — todos campos que excederiam o proposito declarado. Vinculo trabalhista entre funcionarios do mesmo laboratorio (Biodiagnostico, unidade unica) caracteriza legitimo interesse.
2. **ISO 15189 §6.2.2 (rastreabilidade do operador):** atendido. A norma exige identificacao auditavel de quem realizou cada ato critico. Combobox forca selecao de usuario ativo do pool, eliminando string-livre nao-rastreavel.
3. **ANVISA RDC 302 art. 60 + CFR 21 part 11:** atendido. Audit trail pode reconstruir "quem arquivou o lote X em data Y" via `archived_by` + `audit_log REAGENT_LOT_ARCHIVED.details.archivedBy` cruzado com snapshot do user no momento.

**Ressalva critica (acao corretiva exigida — bloqueante para `backend-engineer`):**

O contrato 5.4 (`archiveLot`) determina que `existsActiveResponsible(archivedBy)` busca por `username`. Isso e correto, mas o contrato 4.2 (`POST /archive` body) define `archivedBy: String @NotBlank @Size(max=128)` sem semantica clara — frontend envia `option.username` (estavel) por convencao do contrato 6.3 ("Item selecionado envia `archivedBy = option.username`"). **Acao corretiva OBRIGATORIA:** o `backend-engineer` deve validar `archivedBy` interpretando-o **explicitamente como username** (nao name), e o teste regulatorio 7.1 deve cobrir o caso "mesmo nome em dois usernames distintos" para evitar colisao silenciosa. Se 2 usuarios com `name='Joao Silva'` mas `username='jsilva'` e `username='jsilva2'`, a chave de identidade tem que ser inequivoca.

Adicionalmente, **o campo armazenado em `reagent_lots.archived_by` deve ser o `username`** — nao o `name` (display). Contrato menciona "username/nome" em 2.1; auditor exige decisao deterministica: **username** (estavel mesmo se o usuario mudar `name` no perfil). Frontend exibe o `name` via lookup contra `users` (cache) ou re-derivacao. Sem essa regra, audit trail apodrece se admin renomear um usuario.

---

### 1.2 — DELETE bloqueado por `usedInQcRecently` (decisao 1.11)

**Veredito: APROVADO_COM_RESSALVAS.**

Validacao regulatoria:

1. **ANVISA RDC 302 art. 49 (registro permanente de descarte):** atendido **com a invariante v3.7** (audit `REAGENT_LOT_DELETED` capturando snapshot completo *antes* do delete fisico). O JPA cascade ALL + orphanRemoval=true em `ReagentLot.movements` (`entity/ReagentLot.java:94`) apaga as linhas filhas em `stock_movements`, mas o snapshot pre-delete em `audit_log` preserva `movementsCount` e estado terminal do lote. **Compliance condicional:** o snapshot precisa preservar tambem **a lista enumerada dos movements** (nao so a contagem) para reconstruir descartes, ENTRADAS historicas e CONSUMOs. Snapshot de `movementsCount: integer` insuficiente.

2. **ISO 15189 §7.3 (registros de equipamentos e insumos — preservacao):** parcialmente atendido. A norma exige reter registros pelo periodo regulamentado (geralmente 5 anos ANVISA). Hard delete cascade dos `stock_movements` viola se nao houver snapshot dos movimentos no audit. Bloqueio v3 por `usedInQcRecently` reduz o risco mas NAO o elimina — lote sem CQ recente mas com 3 anos de movimentos pode ser apagado e perde-se rastreabilidade da movimentacao.

3. **CFR 21 part 11.10(c):** "protection of records to enable their accurate and ready retrieval throughout the records retention period" — exige que o registro seja recuperavel. Snapshot somente do lote (sem movements) nao e recuperacao precisa.

**Acao corretiva CRITICA (bloqueante para `backend-engineer`):** o contrato 5.6 (`deleteLot`) e 1.11 prescrevem snapshot do lote em audit `REAGENT_LOT_DELETED`. **Estender** o snapshot para incluir array completo de `movements` com `{id, type, quantity, responsible, reason, createdAt, previousStock?, previousUnitsInStock?, previousUnitsInUse?}`. Isso cabe em `audit_log.details` (`json`). Volume: lote com historico de 200 movements = ~30KB JSON, aceitavel. Sem isso, ANVISA pode reabrir auditoria contra o lab.

**Sobre a recomendacao do orchestrator de "estender `usedInQcRecently` para qualquer movement registrado":** auditor **APROVA a extensao** mas **NAO como bloqueio dentro de v3**. Justificativa: lote com apenas 1 ENTRADA registrada (e nada mais) caracteriza erro de cadastro e merece o hard delete — bloquear seria UX-hostil. **Caminho alternativo recomendado:** UI permite hard delete quando `movementsCount <= 1 AND !usedInQcRecently`. Para movimentos > 1, exigir arquivar. Issue separada — nao bloqueia v3.

**Ressalva adicional sobre invariante v3.7:** o teste regulatorio 7.1 do contrato menciona apenas "snapshot completo em audit `REAGENT_LOT_DELETED` ANTES do delete fisico". O `qa-engineer` deve incluir teste dedicado validando que **`details->>'movements'` e array nao-vazio** quando o lote tinha movements, e que cada movement preserva `id, type, quantity, responsible, createdAt`.

---

### 1.3 — Unarchive pode resultar em `vencido` (decisao 1.7)

**Veredito: APROVADO.**

Validacao regulatoria:

1. **Regra ternaria do CLAUDE.md (validade > estoque > abertura):** preservada. Unarchive nao pode contornar validade — seria criar excecao silenciosa que viola "regra mais forte que tudo". A re-derivacao normal aplicada apos unarchive e a unica leitura coerente com a v2.

2. **ANVISA RDC 302 art. 49:** atendido. Lote vencido apos unarchive permanece classificado como vencido — operacionalmente o usuario nao opera com ele (apenas CONSUMO de descarte e AJUSTE permitidos pelo `allowedMovementTypes` de 5.7). O audit `REAGENT_LOT_UNARCHIVED` registra a transicao explicita para `vencido`, criando trilha rastreavel de "lote foi desarquivado e classificou como vencido em data X".

3. **ISO 15189 §6.3.4 (controle de insumos vencidos — segregacao fisica):** o LIMS preserva o sinal de vencimento mesmo em fluxo nao convencional (arquivar -> reativar). Defesa em profundidade.

**Sobre a sugestao do orchestrator de bloquear unarchive de lote ja vencido com mensagem "lote ja vencido, mantenha arquivado":** auditor **REJEITA o bloqueio**. Justificativa: existe cenario legitimo de "auditor pediu para ver o lote no fluxo ativo para inspecao visual sem ter que abrir filtro de inativos". Bloquear forcaria o usuario a tirar print do detalhe e re-arquivar — friccao operacional sem ganho regulatorio. A re-derivacao para `vencido` ja sinaliza inequivocamente o estado terminal de validade.

**Acao corretiva RECOMENDADA (nao-bloqueante):** UI deve apresentar **alerta amarelo destacado** quando o resultado do unarchive for `vencido` — "Lote reativado e ja esta vencido. Apenas descarte (CONSUMO) e correcao (AJUSTE) sao permitidos." Audit `REAGENT_LOT_UNARCHIVED` ja registra `toStatus='vencido'` em details — frontend pode ler isso direto da response e exibir o alerta. Confirmacao registrada — UI obrigada a alertar mas nao a bloquear.

---

### 1.4 — Limpeza de `needsStockReview` (decisao 1.12)

**Veredito: APROVADO_COM_RESSALVAS.**

Validacao regulatoria:

1. **ISO 15189 §7.3 (controle de inventario com integridade conhecida):** a flag `needsStockReview` e mecanismo defensivo — sinaliza linhas com estoque ambiguo pos-V14. Limpeza so apos revisao explicita preserva integridade.

2. **Regras de limpeza do contrato 5.x:**
   - `archiveLot` limpa (`needsStockReview=false`) — APROVADO. Arquivar e revisao implicita: usuario assumiu que lote nao opera mais.
   - `AJUSTE` limpa — APROVADO. Operacao explicitamente recolhe contagem nova; e a forma canonica de resolver a ambiguidade.
   - `ABERTURA` limpa — **APROVADO_COM_RESSALVAS** (ver abaixo).
   - `ENTRADA`, `CONSUMO`, `FECHAMENTO` NAO limpam — APROVADO. Justificativa: nao corrigem a ambiguidade do count migrado (decisao 1.12 do contrato).

**Concordancia parcial com a recomendacao do orchestrator de "zerar em qualquer movement EXCETO CONSUMO":**
- Auditor **CONCORDA** que CONSUMO nao deve limpar (CONSUMO mascara o problema — usuario poderia consumir o estoque migrado sem saber se estava certa a contagem inicial).
- Auditor **DISCORDA** parcialmente sobre ENTRADA: ENTRADA adiciona unidades novas a um pool ambiguo. Usuario que recebe nova caixa nao revisou as unidades pre-existentes. Manter `needsStockReview=true` apos ENTRADA forca o usuario a fazer AJUSTE explicito antes de "fechar" o sinal — correto.
- Auditor **DISCORDA** parcialmente sobre FECHAMENTO: FECHAMENTO reverte uma ABERTURA. Operacao mecanica sobre unidades ja em uso — nao revisa o pool fechado. Manter `needsStockReview=true` e correto.
- **Sobre ABERTURA limpar a flag:** discutivel. Argumento favoravel (contrato 1.12): ABERTURA implica que o usuario olhou para o lote e tomou acao deliberada de abrir uma unidade — pelo menos confirmou que ha unidades fechadas. Argumento contrario: o usuario pode ter olhado so para o sub-conjunto fechado, sem revisar a contagem migrada. Auditor **APROVA com ressalva** — ABERTURA limpa a flag *desde que* a UI mostre na confirmacao "Esta acao tambem marcara o lote como revisado. Confirmar?". Sem essa confirmacao, ha risco de o usuario "limpar" sem saber.

**Sobre a sugestao do orchestrator de adicionar `stock_review_resolved_at`/`stock_review_resolved_by`:** auditor **APROVA mas como NAO-bloqueante para v3**. Razao: `audit_log` ja registra quem fez o AJUSTE/ABERTURA/archive (via `userId` da operacao); a transicao `needsStockReview=true → false` pode ser reconstruida via query no audit. Adicionar colunas dedicadas e refinement opcional, nao requisito ANVISA. Issue separada.

**Acao corretiva OBRIGATORIA (bloqueante para `frontend-engineer`):** o modal de ABERTURA disparado a partir do botao direto "Abrir unidade" (contrato 6.2) **NAO existe** — o contrato 6.2 explicitamente disse "sem abrir modal". O frontend nao tera oportunidade de pedir confirmacao. **Acao:** quando o lote tiver `needsStockReview=true`, o botao "Abrir unidade" deve abrir uma confirmacao simples com a frase "Esta abertura tambem marcara o lote como revisado pos-migracao." antes de chamar `POST /movements`. Botao confirma, prossegue. Se `needsStockReview=false`, comportamento original (sem modal).

**Acao corretiva ADICIONAL (audit trail):** quando ABERTURA/AJUSTE limparem `needsStockReview`, o audit_log do movimento (`REAGENT_STATUS_DERIVED` ou audit equivalente do movement) **deve incluir** `details->>'needsStockReviewClearedFromTrue': true` para que auditor externo possa filtrar pelas resolucoes.

---

### 1.5 — Drop `/api/reagents/tags` simultaneo a V14 (decisao 1.10)

**Veredito: APROVADO.**

Validacao operacional:

1. **Sem consumidores externos conhecidos.** Confirmacao: o context-pack v3 (linha 408) registra que o frontend nao consome `getTagSummaries` — apenas `getLabelSummaries`. Backend integra com sistemas externos via `ReportRunRepository` e endpoints de admin — nada consome `/tags`. Drop direto seguro.

2. **Heranca v2:** o PR-4 da v2 era para deprecar `/tags` e nunca rodou. v3 absorve corretamente.

3. **Comunicacao operacional:** o release notes do `release-engineer` deve documentar como breaking change explicito. Recomendacao: bloco "BREAKING CHANGES" no topo do release notes com:
   - `GET /api/reagents/tags` removido.
   - Quem chamar recebe 404.
   - Equivalencia funcional: `GET /api/reagents/labels` (shape diferente, mesmo proposito).

**Acao corretiva NAO-BLOQUEANTE (recomendacao):** monitorar logs de acesso 404 nas primeiras 48h pos-deploy. Se algum sistema interno desconhecido tentar consumir `/tags`, sera capturado.

---

## 2. Achados adicionais (A–H)

### A. Migracao V14 — DROP `current_stock` sem deprecated period

**Veredito: APROVADO_COM_RESSALVAS.**

Validacoes:

1. **Heranca v2 audit secao A:** V13 dropou 6 colunas de uma vez sem deprecated period. Precedente estabelecido. v3 mantem o padrao.

2. **Pre-condicoes do dry-run (contrato 3.5):** queries A/B/C/D cobrem corretamente os bloqueadores. Dry-run aborta deploy se `reagents_with_null_stock > 0`, `reagents_with_negative_stock > 0`, `reagents_unknown_status > 0`, ou `type` fora do conjunto. **Acao corretiva NAO-BLOQUEANTE:** o `release-engineer` deve rodar o dry-run em snapshot **recente** de producao (nao staging artificial). Padrao herdado de v2 ressalva 4.3.4.

3. **Tipo de coluna `audit_log.details = json` (nao jsonb)** — risco herdado de v2 audit ressalva A. O contrato 3.2 V14 usa `json_build_object(...)` (sem cast), o que e correto. **Confirmado em 235-251 do contrato.** Sem ressalva nova.

**Sobre quebra de operadores externos consumindo `current_stock`:** auditor **APROVA aceitar a quebra**. Razao alinhada com orchestrator: cliente externo acoplado a campo de schema interno e dependencia ilegitima. Release notes documenta. Janela noturna obrigatoria.

**Sobre criar campo derivado read-only que calcula `unitsInStock + unitsInUse`:** auditor **REJEITA**. Justificativa: introduz divida tecnica (campo virtual confundivel com persistido); duplicacao de fonte de verdade. Frontend e backend devem migrar para `totalUnits` derivado em response.

**Acao corretiva CRITICA herdada de v2 audit ressalva A (RE-VALIDADA):** o INSERT em `audit_log` no passo 1 do contrato 3.2 referencia `r.current_stock` que ainda existe no momento da execucao (DROP COLUMN e passo 8). Ordem correta confirmada — sem bloqueio.

**Ressalva sobre reordenacao do contrato 3.2 (passos 4 e 5):** o proprio contrato registra (linha 333-336) que os passos `1, 2, 3, 5(DROP CHECK), 4(UPDATE), 5(ADD CHECK NOVO), 6, 7, 8, 9` e a ordem real correta. **Acao corretiva OBRIGATORIA:** o `release-engineer` deve materializar o SQL final com a ordem reordenada e o teste `ReagentMigrationV14Test` deve assertar que `chk_reagent_lots_status` permite `'inativo'` *e rejeita `'fora_de_estoque'`* apos a migracao. Sem essa ordem, UPDATE para `'inativo'` quebra contra CHECK antigo.

---

### B. `SAIDA` no enum mantida so para leitura

**Veredito: APROVADO.**

1. **Mensagem de excecao do contrato 4.1 (`POST /movements` com type=SAIDA):** `"Movimento SAIDA descontinuado — use CONSUMO."`. **Auditor recomenda enriquecer:** `"Tipo SAIDA descontinuado em v3. Use CONSUMO para registrar uso/descarte ou AJUSTE para correcao de inventario."`. Inclui a alternativa correta para correcao (AJUSTE), evitando que o operador escolha CONSUMO indevidamente para corrigir um erro de cadastro.

2. **Compatibilidade de leitura:** `MovementType.ALL_READ` inclui SAIDA — confirmado em contrato 1.3. Listagem historica e `deleteMovement` (reversao) preservados.

3. **Teste regulatorio:** `ReagentControllerTest.shouldReject_POST_movements_when_type_SAIDA` — coberto em 7.1 do contrato.

**Acao corretiva OBRIGATORIA (bloqueante para `qa-engineer`):** teste E2E (frontend) que tente criar movimento SAIDA via UI (cenario impossivel pos-v3 mas defensivo) e confirme que falha de forma legivel. Tambem cobrir o caso em que o backend retorna a movimento legado SAIDA via `GET /movements` e o frontend renderiza corretamente sem quebrar — `StockMovement.type` permite SAIDA na leitura (contrato 6.8 tipos TS).

---

### C. `previousStock` legacy em `StockMovementResponse`

**Veredito: APROVADO_COM_RESSALVAS.**

Validacao da decisao 1.9 (coexistencia sem backfill):

1. **Frontend escolha:** contrato 1.9 e 6.8 declaram que UI escolhe via `isLegacy: boolean = (previousStock != null AND previousUnitsInStock == null)`. **APROVADO** — semanticamente claro.

2. **Risco de UI exibir os dois:** real. O contrato 6.8 deixa o tipo TS expondo todos os tres campos sem indicacao de qual exibir. Auditor recomenda regra explicita.

**Acao corretiva OBRIGATORIA (bloqueante para `frontend-engineer`):** no historico de movimentos (modal de historico), aplicar regra deterministica:
- Se `isLegacy === true`: exibir apenas "Estoque anterior: X" (Double com 1 decimal).
- Se `isLegacy === false` e ambos `previousUnitsInStock`/`previousUnitsInUse` nao-null: exibir "Em estoque: X · Em uso: Y · Total: X+Y".
- Se ambos null (cenario impossivel mas defensivo): exibir "—" sem crash.

Documentar em comentario inline do componente que exibe o historico (`ReagentModals.tsx` na secao de historico).

3. **Reports v2 — PDFs novos vs antigos:** PDFs antigos sao imutaveis (heranca v2 invariante 2). PDFs novos pos-V14 usam o par novo. **APROVADO** sem ressalva nova.

4. **Heranca v2 de `notes` campo `PREVIOUS_STOCK=`:** o context-pack v3 (atrito 10) registra que o codigo do `extractPreviousStock` deve ser limpo. **Acao corretiva NAO-BLOQUEANTE:** `backend-engineer` deve remover o uso de `notes` para reconstruir `previousStock` em AJUSTE — o campo dedicado `previousStock` (legacy) ou `previousUnitsInStock`/`Use` (pos-V14) substitui completamente.

---

### D. AJUSTE bloqueia movements com `unitsInStock < 0` ou `unitsInUse < 0`

**Veredito: APROVADO.**

Validacao defensiva (defesa em profundidade):

1. **Bean Validation no DTO** (`@Min(0)` em `targetUnitsInStock` e `targetUnitsInUse` quando `type=AJUSTE`) — captura no controller (400 com mensagem clara).
2. **DB CHECK constraint** (`chk_reagent_lots_units_in_stock_nonneg`, `chk_reagent_lots_units_in_use_nonneg`) — captura caso o codigo de service tente burlar (defesa contra refator futuro mal-intencionado ou bug).
3. **Service-level validacao** (contrato 5.3 case AJUSTE: `if request.targetUnitsInStock < 0 OR request.targetUnitsInUse < 0: throw BusinessException`) — captura inconsistencia cross-field.

**Tres camadas de defesa.** Heranca v2 (que tinha apenas 2 camadas — DTO + service) APROVADA com a adicao da CHECK constraint na V14.

**Sem ressalva.** Recomendacao implicita: testes em 7.1 do contrato cobrem cada camada.

---

### E. ABERTURA / FECHAMENTO sem `quantity` parametro — sempre q=1

**Veredito: APROVADO_COM_RESSALVAS.**

Validacao do contrato 5.3 (cases ABERTURA e FECHAMENTO):

1. **Forca quantity=1 mesmo se cliente enviar diferente** (linha 780 e 791 do contrato 5.3). **Auditor REJEITA o "silently ignore"** — viola principio de feedback loud. Cliente que envia `quantity=5` em ABERTURA precisa ser notificado de que a operacao foi ajustada para `q=1`, **OU** receber 400.

**Acao corretiva CRITICA (bloqueante para `backend-engineer`):** decisao deterministica. **Recomendacao do auditor:** **400 com mensagem explicita** quando `request.quantity != 1` em ABERTURA/FECHAMENTO. Mensagem: `"ABERTURA e FECHAMENTO operam unitariamente (q=1 implicito). Envie quantity=1 ou omita o campo."`. Justificativa: se a UI dispara `q=5` por bug, o operador precisa saber. Silenciar seria mascarar bug. Mais coerente com a politica defensiva v3 (rejeita `status='inativo'` em CREATE, rejeita SAIDA, etc).

**Alternativa rejeitada do orchestrator ("400 com mensagem"):** **CONFIRMADA** como caminho correto. Acao corretiva e adotar 400 — corrigir o contrato 5.3 nesse ponto.

2. **Audit nota quando o usuario pede q!=1:** o contrato 5.3 menciona "audit nota" mas se a recomendacao acima for adotada (400), nao ha mutacao para auditar. APROVADO.

3. **Quantidade armazenada em `stock_movements.quantity` para historico legivel:** contrato 2.4 nota recomenda `quantity=1` para ABERTURA/FECHAMENTO (e `0` para AJUSTE). APROVADO — facilita inspecao visual.

---

### F. CONSUMO permitido em `vencido` — descarte de aberto vencido

**Veredito: APROVADO.**

Validacao regulatoria:

1. **ANVISA RDC 302 art. 49:** atendido. Descarte de reagente vencido aberto e ato regulamentar — exige registro permanente. CONSUMO em vencido com `previousUnitsInStock`/`previousUnitsInUse` preservados em `stock_movements` reconstroi o descarte auditavel.

2. **Heranca v2:** v2 ja permitia SAIDA em vencido (heranca audit B.2). v3 substitui SAIDA por CONSUMO mantendo a semantica.

3. **`reason` obrigatorio:** o contrato 5.3 case CONSUMO nao exige `reason`. **Auditor recomenda exigencia condicional:** quando `lot.status == 'vencido'`, `request.reason` deve ser NotBlank. Razao: descarte de vencido sempre tem motivo (calibrador expirou, aliquota descartada, etc) e o auditor ANVISA pede esse detalhe.

**Acao corretiva RECOMENDADA (NAO-bloqueante):** validacao cross-field no `createMovement` — quando `type=CONSUMO AND lot.status='vencido'`, exigir `reason` obrigatorio. Frontend pre-popula opcoes ("descarte_validade_expirada", "descarte_contaminacao", etc). Issue paralela aceitavel.

---

### G. `REAGENT_OPENED_DATE_DERIVED` ainda e o action correto vs `REAGENT_OPENED_DATE_BACKFILLED`

**Veredito: BLOQUEADO.**

**Achado critico — divergencia entre contrato e codigo vivo.**

Validacao do codigo vivo:
- `ReagentService.java:102`: `public static final String AUDIT_ACTION_OPENED_DATE_BACKFILLED = "REAGENT_OPENED_DATE_BACKFILLED";`
- `ReagentService.java:687`: usa `AUDIT_ACTION_OPENED_DATE_BACKFILLED` na chamada `auditService.log(...)`.
- `ReagentServiceTest.java:291, 319, 538`: testes consomem `AUDIT_ACTION_OPENED_DATE_BACKFILLED`.

Contrato v3 secao 2.5 lista action nova `REAGENT_OPENED_DATE_DERIVED` ("renomeacao do `REAGENT_OPENED_DATE_BACKFILLED` da v2"). Contrato v3 secao 5.2 (pseudocodigo) instrui `auditService.log('REAGENT_OPENED_DATE_DERIVED', ...)`.

**Problema regulatorio:** renomear action de audit_log em deploy unico **viola integridade de audit trail**. Auditor externo que filtre `WHERE action = 'REAGENT_OPENED_DATE_BACKFILLED'` nao encontra entries pos-V14. Cruzamento historico fica quebrado. CFR 21 part 11.10(c) exige preservacao de retrievability.

**Heranca v2 audit ressalva 1.7:** v2 estabeleceu o nome `REAGENT_OPENED_DATE_BACKFILLED` justamente para separar "abertura administrativa" de "abertura natural". Contrato v3 quer renomear para `_DERIVED` — perde a distincao semantica.

**Acao corretiva OBRIGATORIA — BLOQUEIO ATE RESOLUCAO:** o `architect` deve esclarecer um dos dois caminhos:

**Caminho A (recomendado pelo auditor):** **MANTER** o nome `REAGENT_OPENED_DATE_BACKFILLED` em v3. Atualizar contrato secao 2.5 e 5.2 para `REAGENT_OPENED_DATE_BACKFILLED`. Justificativas:
- Nao quebra continuidade de audit trail.
- Preserva semantica de "backfill = preencher campo retroativamente em UPDATE administrativo" — `_DERIVED` seria incorreto porque a action e disparada SO em UPDATE, nao em CREATE/movement onde o openedDate nasce com o `REAGENT_STATUS_DERIVED` principal.
- Codigo vivo nao precisa ser alterado nesse ponto.

**Caminho B (aceitavel mas com mitigacao):** **manter ambos os nomes** em paralelo. Codigo vivo continua emitindo `REAGENT_OPENED_DATE_BACKFILLED` para UPDATE administrativo. Contrato corrige a secao 2.5 indicando que `_DERIVED` NAO e nome novo — e o nome canonico ja existente para a transicao acompanhada do `REAGENT_STATUS_DERIVED` (CREATE/movement). Em outras palavras: `_BACKFILLED` so para UPDATE; transicao em CREATE/movement nao tem audit dedicado, vai junto do `REAGENT_STATUS_DERIVED` (heranca v2).

**Auditor recomenda fortemente caminho A.** Bloqueio formalizado em secao 4.

---

### H. Hard delete cascade movements

**Veredito: APROVADO_COM_RESSALVAS.**

Validacao do esquema fisico:

1. **`V1__baseline_schema.sql:236-237`:**
   ```
   CONSTRAINT fk_stock_movements_reagent_lot FOREIGN KEY (reagent_lot_id)
       REFERENCES reagent_lots (id)
   ```
   **CONFIRMADO: SEM `ON DELETE CASCADE` no SQL.**

2. **`ReagentLot.java:94`:** `@OneToMany(mappedBy = "reagentLot", cascade = CascadeType.ALL, orphanRemoval = true)`.
   **JPA garante o cascade via service** quando `reagentLotRepository.deleteById(id)` (que e o que `ReagentService.deleteLot` faz no contrato 5.6).

3. **Risco operacional:** delete via SQL direto (sem JPA) **deixa orfaos**. Cenario raro (administrador via psql), mas auditavel.

**Acao corretiva NAO-BLOQUEANTE (recomendacao para `release-engineer`):** documentar em runbook de DBA que delete manual em `reagent_lots` deve ser precedido por `DELETE FROM stock_movements WHERE reagent_lot_id = ?` para evitar orfaos. Alternativa robusta — issue paralela: V15 adiciona `ON DELETE CASCADE` ao FK SQL. Nao bloqueia v3.

**Acao corretiva CRITICA (bloqueante — INTERLIGADA com bloqueante 1.2):** o snapshot em `audit_log` antes do `deleteById` (contrato 5.6) **deve carregar** a lista enumerada de movements (nao so a contagem), porque apos o cascade JPA os movements somem. Sem snapshot enumerativo, hard delete viola CFR 21 part 11.10(c) e ANVISA RDC 302 art. 49. **Mesma acao corretiva ja registrada em bloqueante 1.2** — re-validada aqui pelo angulo do schema.

---

## 3. Lista de testes regulatorios obrigatorios

Lista canonica e DEVE ser implementada pelo `qa-engineer`. Estende e supera os 10 do v2.

### 3.1. Cada transicao automatica gera audit_log com shape esperado
- [ ] `applyDerivedStatus` que muda status → 1 entry com `action='REAGENT_STATUS_DERIVED'`, `entity_type='ReagentLot'`, `entity_id`, `details->>{from,to,trigger,unitsInStock,unitsInUse,expiryDate}`. Validar via `AuditLogRepository.findByEntityTypeAndEntityId` em `@SpringBootTest`.
- [ ] No-op (derivado == atual) NAO insere.

### 3.2. Migracao V14 — mapping pre/pos
- [ ] `ReagentMigrationV14Test` cobre os 4 status legados (`em_estoque`, `em_uso`, `fora_de_estoque`, `vencido`) com snapshots pre/pos conforme tabela 3.3 do contrato.
- [ ] Asserta que `chk_reagent_lots_status` rejeita `'fora_de_estoque'` apos V14 e aceita `'inativo'`.
- [ ] Asserta que `current_stock` nao existe.
- [ ] Asserta que `units_in_stock`, `units_in_use`, `archived_at`, `archived_by`, `needs_stock_review` existem com tipos corretos.
- [ ] Asserta que **soma de `unitsInStock+unitsInUse` pos-V14 = soma de `currentStock` pre-V14** para todos os lotes (preserva total).
- [ ] Asserta que `chk_stock_movements_type` permite os 6 valores.
- [ ] Asserta que cada lote ex-`fora_de_estoque` recebeu 1 entry `REAGENT_STATUS_TRANSITION_V3` em audit_log com `trigger='migration_v14'`, `from='fora_de_estoque'`, `to='inativo'`.

### 3.3. `usedInQcRecently` continua bloqueando descarte E hard delete
- [ ] Lote com `usedInQcRecently=true` E ADMIN faz DELETE com `confirmLotNumber` correto → 400 ("Lote utilizado em CQ recente nao pode ser apagado") + audit `REAGENT_DELETE_BLOCKED` com `details->>'reason'='used_in_qc_recently'`.
- [ ] Lote com `usedInQcRecently=true` E `archive` chamado → 200 (archive sempre permitido — bloqueio so afeta DELETE).
- [ ] Lote com `usedInQcRecently=false` E ADMIN faz DELETE com `confirmLotNumber` correto → 204.

### 3.4. Hard delete cascade movements deixa snapshot enumerativo em audit_log
- [ ] Lote com 3 movements registrados E ADMIN faz DELETE valido → audit `REAGENT_LOT_DELETED` ANTES do delete fisico, `details->>'movements'` e array de 3 elementos com `{id, type, quantity, responsible, createdAt, previousStock?, previousUnitsInStock?, previousUnitsInUse?}`.
- [ ] Apos delete, `stockMovementRepository.countByReagentLotId(id) == 0`.
- [ ] Audit_log entry sobrevive (nao tem FK em reagent_lots).
- [ ] **NOVO bloqueante 1.2:** snapshot inclui movimentos legados (com `previousStock != null`) corretamente.

### 3.5. Status `vencido` forcado em cadastro
- [ ] CREATE com `expiryDate < today AND status='em_estoque'` → lote salvo com `status='vencido'` E audit `REAGENT_STATUS_DERIVED` com `from='em_estoque', to='vencido', trigger='createLot'`.
- [ ] CREATE com `expiryDate < today AND status='em_uso'` → lote salvo com `status='vencido'`. **`openedDate` nao deve ser setada** (heranca v2 audit teste 3.5).

### 3.6. Cadastro com `status='inativo'` rejeitado com 400
- [ ] CREATE com `status='inativo'` → 400 com mensagem `"Status 'inativo' nao pode ser definido em CREATE/UPDATE — use POST /archive."`.
- [ ] PUT com `status='inativo'` em lote ativo → 400.
- [ ] PUT em lote ja `inativo` (qualquer mudanca) → 400 (`"Lote arquivado nao pode ser editado diretamente — reative com POST /unarchive"`).

### 3.7. Backfill openedDate em UPDATE registra auditoria distinta (heranca v2)
- [ ] UPDATE com `status='em_uso' + openedDate=null + lote em_estoque com openedDate=null` → openedDate=today set + audit `REAGENT_OPENED_DATE_BACKFILLED` (NAO `_DERIVED` — ver bloqueio achado G).
- [ ] UPDATE em lote `em_uso` com `openedDate` ja setada → mantem, NAO emite `_BACKFILLED` (idempotencia).
- [ ] **Acao bloqueante achado G:** apos resolucao do nome canonico, ajustar este teste.

### 3.8. ABERTURA grava openedDate quando null + audit
- [ ] Lote `em_estoque` com `openedDate=null` E ABERTURA q=1 → unitsInStock-=1, unitsInUse=1, status='em_uso', openedDate=today + audit `REAGENT_OPENED_DATE_DERIVED` ou companheiro do `REAGENT_STATUS_DERIVED` (depende do caminho A vs B do achado G).

### 3.9. CONSUMO em vencido permitido (descarte) + audit
- [ ] Lote `vencido` com `unitsInUse=2` E CONSUMO q=1 → unitsInUse=1, status='vencido' (mantem), audit `REAGENT_STATUS_DERIVED` no-op.
- [ ] CONSUMO em vencido sem reason → **(achado F):** validar 400 se decisao final exigir reason; senao 200.

### 3.10. AJUSTE em inativo permitido com reason
- [ ] Lote `inativo` E AJUSTE com `targetUnitsInStock=5, targetUnitsInUse=0, reason='correcao_contagem'` → 200, status mantem `inativo`, `unitsInStock=5`, `unitsInUse=0`, `needsStockReview=false`.
- [ ] Sem reason → 400.
- [ ] Sem targetUnitsInStock → 400.
- [ ] AJUSTE em inativo emite `REAGENT_STATUS_DERIVED` no-op com `from='inativo' to='inativo' trigger='ajuste'` (heranca risco 6 do contrato 9).

### 3.11. archive valida archivedBy exists em users ativos
- [ ] archive com `archivedBy='username_inexistente'` → 400 (`"Responsavel '...' nao encontrado ou inativo"`).
- [ ] archive com `archivedBy='admin_role_VISUALIZADOR'` → 400 (filtro `role IN (ADMIN, FUNCIONARIO)`).
- [ ] archive com `archivedBy='funcionario_inativo'` (`isActive=false`) → 400.
- [ ] archive com `archivedBy='funcionario_valido'` → 200 + lot.archivedBy=username (NAO display name — bloqueante 1.1).

### 3.12. unarchive preserva archivedAt/archivedBy
- [ ] Arquivar lote → archivedAt=D1, archivedBy='joao'.
- [ ] Unarchive → status re-derivado, archivedAt=D1 PRESERVADO, archivedBy='joao' PRESERVADO. Audit `REAGENT_LOT_UNARCHIVED` com `details->>'archivedAtPreserved'=D1`, `details->>'archivedByPreserved'='joao'`.
- [ ] Unarchive de lote nao-inativo → 400.

### 3.13. ENTRADA em inativo bloqueada + audit (heranca v2 + nova action)
- [ ] ENTRADA em lote `inativo` → 400 + audit `REAGENT_MOVEMENT_BLOCKED` com `details->>'reason'='lote_inativo'`.
- [ ] ABERTURA em inativo → 400 + audit `REAGENT_MOVEMENT_BLOCKED` reason='lote_inativo'.
- [ ] FECHAMENTO em inativo → 400 + audit reason='lote_inativo'.
- [ ] CONSUMO em inativo → 400 + audit reason='lote_inativo'.

### 3.14. Combobox responsavel — escopo e RBAC
- [ ] `GET /api/users/responsibles` como FUNCIONARIO → 200 + `ResponsibleSummary[]` filtrado.
- [ ] Response NAO contem `email`, `passwordHash`, `permissions`, `createdAt`, `lastLoginAt`.
- [ ] `isActive=false` exclui usuarios.
- [ ] `role='VISUALIZADOR'` ou `role='VIGILANCIA_SANITARIA'` excluidos.
- [ ] `GET /api/users/responsibles` como anonimo → 401.

### 3.15. CSV header pos-v3 (heranca v2 + 4 colunas novas)
- [ ] `GET /api/reagents/export/csv` retorna primeira linha exatamente: `Etiqueta,Lote,Fabricante,Categoria,Validade,Dias Restantes,Em Estoque,Em Uso,Total,Status,Localizacao,Temperatura,Arquivado em,Arquivado por`.
- [ ] Campo `Status` em portugues canonico (`Em estoque`, `Em uso`, `Vencido`, `Inativo`).
- [ ] UTF-8 + BOM mantido.

### 3.16. Banner `needsStockReview` resolucao (achado 1.4)
- [ ] AJUSTE em lote com `needsStockReview=true` → flag vai para false + audit do movement contem `details->>'needsStockReviewClearedFromTrue'=true`.
- [ ] ABERTURA em lote com `needsStockReview=true` → idem, com confirmacao UI.
- [ ] ENTRADA, CONSUMO, FECHAMENTO **NAO limpam** a flag.
- [ ] archive **limpa** a flag.

### 3.17. SAIDA em createMovement bloqueado (achado B)
- [ ] POST /movements com `type='SAIDA'` → 400 com mensagem incluindo "use CONSUMO" e "use AJUSTE para correcao".

### 3.18. ABERTURA/FECHAMENTO com `quantity != 1` rejeitado (achado E)
- [ ] POST /movements com `type='ABERTURA' quantity=5` → 400 (`"ABERTURA e FECHAMENTO operam unitariamente (q=1 implicito)..."`).
- [ ] POST /movements com `type='ABERTURA' quantity=1` → 200.
- [ ] POST /movements com `type='ABERTURA' quantity=null/omitido` → 200 (default unitario).

### 3.19. Reports v2 generators — labels novas
- [ ] PDF gerado contem cards "Em estoque", "Em uso", "Vencidos", "Inativos" (nao "Fora de estoque").
- [ ] Tabela "vencidos com estoque" usa `(unitsInStock + unitsInUse) > 0`.
- [ ] Coluna "Estoque" substituida por "Em estoque" e "Em uso".
- [ ] Filtro `includeInactive` bate em `'inativo'`.

### 3.20. Frontend — historico de movimentos com `isLegacy` (achado C)
- [ ] Movimento legacy (`isLegacy=true`) → exibe "Estoque anterior: X".
- [ ] Movimento pos-V14 (`isLegacy=false`) → exibe "Em estoque: X · Em uso: Y · Total: Z".
- [ ] Ambos null → exibe "—" sem crash.

### 3.21. Scheduler nao toca lote inativo (heranca decisao 1.1)
- [ ] Lote `inativo` com `expiry < today` → scheduler NAO altera status. Sem audit entry.
- [ ] Lote `em_uso` com `expiry < today` → scheduler vira `vencido`. Audit `REAGENT_STATUS_DERIVED` com `trigger='scheduler'`.

### 3.22. Frontend — botao "Apagar" invisivel para nao-ADMIN
- [ ] Render como FUNCIONARIO → botao "Apagar" NAO presente no DOM.
- [ ] Render como ADMIN → botao presente, click abre modal.
- [ ] Modal "Apagar" com banner se `usedInQcRecently=true` desabilita botao mesmo com confirmacao correta.

### 3.23. Frontend — modal Arquivar combobox responsavel
- [ ] Modal Arquivar carrega combobox via `useResponsibles()`.
- [ ] Combobox NAO permite valor custom (`allowCustom=false`).
- [ ] Submit envia `archivedBy = option.username` (NAO `name` — bloqueante 1.1).

### 3.24. Frontend — confirmacao de ABERTURA quando needsStockReview=true (achado 1.4)
- [ ] Click em "Abrir unidade" em lote com `needsStockReview=true` → exibe confirmacao "Esta abertura tambem marcara o lote como revisado".
- [ ] Confirmacao OK → chama POST /movements.
- [ ] Click em "Abrir unidade" em lote com `needsStockReview=false` → chama POST /movements direto (sem confirmacao).

---

## 4. Decisao final

**APROVADO_COM_RESSALVAS, com 1 BLOQUEIO formal sobre achado G (renomeacao audit action).**

### 4.1 BLOQUEADO ate resolver pelo `architect` ou `orchestrator`

1. **Achado G — `REAGENT_OPENED_DATE_DERIVED` vs `_BACKFILLED`.** Renomear viola integridade de audit trail (CFR 21 part 11). Decidir entre Caminho A (manter `_BACKFILLED`, recomendado) ou Caminho B (manter ambos com semantica clara). Ate resolucao, codigo vivo (`ReagentService.java:102`) e contrato divergem.

### 4.2 LIBERADO para `backend-engineer` (apos resolucao do bloqueio 4.1) — bloqueantes intra-paralelo

1. **Bloqueante 1.1:** validar `archivedBy` como `username` explicitamente; armazenar `username` em `reagent_lots.archived_by`.
2. **Bloqueante 1.2 (interligado com achado H):** estender snapshot em `REAGENT_LOT_DELETED` para incluir array enumerativo de `movements` antes do cascade JPA. Sem isso, ANVISA/CFR violadas.
3. **Achado A:** materializar SQL final da V14 com a reordenacao de passos (`1, 2, 3, 5(DROP CHECK), 4(UPDATE), 5(ADD CHECK NOVO), 6, 7, 8, 9`). Sem isso, UPDATE quebra contra CHECK antigo.
4. **Achado E:** rejeitar `quantity != 1` em ABERTURA/FECHAMENTO com 400 explicito. Atualizar contrato 5.3 nesse ponto.
5. **Achado F (recomendacao):** considerar exigir `reason` obrigatorio em CONSUMO quando `lot.status='vencido'`. NAO-bloqueante mas registrado.

### 4.3 LIBERADO para `frontend-engineer` (apos resolucao do bloqueio 4.1) — bloqueantes intra-paralelo

1. **Bloqueante 1.4:** adicionar confirmacao na ABERTURA via botao direto quando `needsStockReview=true`. Sem confirmacao, viola defesa contra resolucao silenciosa de flag.
2. **Achado C:** regra deterministica para exibir `previousStock` legacy vs `previousUnitsInStock`/`previousUnitsInUse` pos-V14 no historico de movimentos (via `isLegacy`).
3. **Achado B:** UI nunca dispara movimento SAIDA (campo nao deve aparecer no select); teste E2E confirma falha legivel se backend retornar 400.
4. **Bloqueante 1.3 (recomendacao):** alerta amarelo destacado quando unarchive resultar em `vencido`.

### 4.4 LIBERADO para `qa-engineer`

Cobrir os 24 testes regulatorios da secao 3 (vs 10 do v2). Especialmente:
- 3.4 (snapshot enumerativo de movements em DELETE).
- 3.7 (audit BACKFILLED apos resolucao do bloqueio G).
- 3.11 (archivedBy = username, nao name).
- 3.16 (resolucao de needsStockReview com audit detail).
- 3.18 (ABERTURA/FECHAMENTO rejeita q!=1).
- 3.24 (UI confirma ABERTURA com needsStockReview=true).

### 4.5 LIBERADO para `release-engineer`

1. Documentar drop de `/api/reagents/tags` como BREAKING CHANGE em release notes (achado 1.5).
2. Monitorar logs 404 em `/api/reagents/tags` por 48h pos-deploy.
3. Documentar equivalencia historica `inativo (legado pre-v2) = vencido AND stock=0 (v2) UNION fora_de_estoque (v2) UNION inativo (v3)` no changelog V14 — auditor externo precisa decifrar audit_log de varias eras.
4. Issue paralela: V15 com `ON DELETE CASCADE` no FK `fk_stock_movements_reagent_lot` (achado H).
5. Issue paralela: indice em `audit_log(entity_type, entity_id)` (heranca v2 audit ressalva E).
6. Rodar dry-run V14 em snapshot **recente de producao** (nao staging artificial) — 4 queries do contrato 3.5.
7. Janela de deploy noturna obrigatoria.

### 4.6 Sumario regulatorio

| Conceito CLAUDE.md | Status apos refator v3 |
|---|---|
| Lote (`lot_number` imutavel) | Preservado integralmente. Hotfix 2026-05-15: UNIQUE operacional passa a ser `(lotNumber, manufacturer, label)` para permitir mesmo numero de lote em etiqueta/fabricante diferente. |
| Status de CQ | Preservado. `usedInQcRecently` via `lot_number` mantido. **Novo bloqueio v3:** DELETE rejeitado se usedInQc=true (forca arquivamento). |
| Registro de medicao | `qc_records` intocado. Cross-reference por `lot_number` operacional. |
| Historico (audit_log) | Preservado + 3 novas actions (`REAGENT_LOT_DELETED`, `REAGENT_LOT_UNARCHIVED`, `REAGENT_STATUS_TRANSITION_V3`). **BLOQUEIO:** achado G nao-resolvido sobre `_BACKFILLED` vs `_DERIVED`. |
| Media, DP, CV | Nao tocado por v3. |
| Calibracao, pos-calibracao | Nao tocado por v3. |
| ANVISA RDC 302 art. 49 (descarte) | Preservado via CONSUMO em vencido + audit. **Pendencia 1.2:** snapshot enumerativo em DELETE. |
| ANVISA RDC 302 art. 60 (registro de abertura) | Preservado via ABERTURA + openedDate. **Achado G:** action audit pendente. |
| ISO 15189 §5.3.2.7 | Preservado. `inativo` substitui `fora_de_estoque` como sinal de "nao operavel". |
| ISO 15189 §6.2.2 (rastreabilidade do operador) | Preservado + reforcado via combobox responsavel obrigatoria em arquivamento. |
| ISO 15189 §6.3.4 (segregacao de vencidos) | Preservado via `canReceiveEntry=false` para vencido + AJUSTE/CONSUMO permitidos. |
| ISO 15189 §7.3 (preservacao de registros) | **Pendencia 1.2 + achado H:** snapshot enumerativo em hard delete. |
| CFR 21 part 11.10(c) | **BLOQUEIO achado G:** audit retrievability ameacada se renomeacao for adotada. |
| LGPD art. 7º §5º (legitimo interesse) | Preservado via shape minimo do `ResponsibleSummary`. |

---

**Veredito final:** APROVADO_COM_RESSALVAS.

O contrato v3 esta solido em **11 das 12 decisoes principais**. O achado G (renomeacao de `REAGENT_OPENED_DATE_BACKFILLED` para `_DERIVED`) e o **unico bloqueio formal** — viola integridade de audit trail e nao foi mencionado pelo orchestrator. Bloqueio precisa ser resolvido pelo `architect` antes de `backend-engineer` comecar a tocar `ReagentService.java:102`.

Os bloqueantes 1.1 (archivedBy=username), 1.2 (snapshot enumerativo em DELETE), 1.4 (confirmacao UI em ABERTURA com needsStockReview=true), achado A (reordenacao SQL V14), achado E (q!=1 → 400), achado C (regra deterministica de exibicao isLegacy) sao bloqueantes intra-PR e devem ser absorvidos pelos engenheiros sem nova rodada do `architect`.

**Proximo agente:** `architect` — resolver bloqueio 4.1 (achado G). Apos resolucao, `backend-engineer` + `frontend-engineer` em paralelo (regra de paralelismo CLAUDE.md atendida — contrato congelado + audit aprovado com ressalvas absorviveis).

Em caso de duvida sobre escopo de qualquer ressalva, voltar ao `domain-auditor` antes de implementar.
