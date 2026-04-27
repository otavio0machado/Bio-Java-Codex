# QA Review — Refator Reagentes v2 (PR-1 + PR-2)

> **Status:** APROVADO_COM_RESSALVAS
> **Auditor:** `qa-engineer`
> **Data:** 2026-04-27
> **Insumos:** `00-context-pack.md`, `01-contract.md`, `02-domain-audit.md`
> **Resultado dos comandos automatizados:** todos verdes (ver §5)
> **Decisao final:** BLOQUEADO ate resolver gaps critical (G-01 e G-02). Demais gaps sao followups nao-bloqueantes.

---

## 1. Veredito por area

### A. Backend (PR-1)
**APROVADO_COM_RESSALVAS.**

`mvn test` retorna 360 testes, 0 falhas, 0 erros, BUILD SUCCESS. Cobertura de regra ternaria, audit trail e bloqueios alinhada ao contrato. `ReagentService` aplica trim defensivo em `label` (linhas 192, 241), implementa `applyOpenedDateOnUseTransition` com action `REAGENT_OPENED_DATE_BACKFILLED` para trigger `updateLot` (linhas 661-674), e força `vencido` em `createLot`/`updateLot` (linhas 211-216 e 265-271). Migracao V13 usa `json_build_object` (audit-aprovado), respeita ordem (audit -> update -> drop -> NOT NULL -> CHECK -> indices). Generator `ReagentesRastreabilidadeGenerator` usa literais novos (em_estoque, em_uso, fora_de_estoque, vencido — sem `"ativo"`/`"inativo"` cru, apenas comentario inline §1.11 documentando remocao da secao de consumo).

Ressalvas: `ReagentMigrationV13Test` valida apenas o mapping em Java (NAO usa `@SpringBootTest`+Flyway real) — gap conhecido §3.3 da audit; e ha drift de categorias entre `ReagentService.ALLOWED_CATEGORIES` e `ReportDefinitionRegistry.REAGENT_CATEGORIES` (ver G-01).

### B. Frontend (PR-2)
**APROVADO_COM_RESSALVAS.**

`tsc --noEmit` exit 0. `vitest run` retorna 7 test files, 44 passed, 0 failed (incluindo 9 testes do `ReagentesTab.test.tsx`). `npm run build` compila em 270ms sem erros. Default `viewMode='tags'` ativo (`ReagentesTab.tsx:72`); `useReagentLabels` integrado (`ReagentesTab.tsx:83`); `sanitizeLotRequest` com trim em label/lotNumber/manufacturer/location/supplier (`reagentService.ts:18-29`); `canReceiveEntry` fallback agora `status !== 'vencido'` (`utils.ts:131`); banner amarelo expiry<hoje (`ReagentModals.tsx:189-197`); ENTRADA/SAIDA com lockType separados (`ReagentesTab.tsx:152-171`); combobox com `+ Criar nova etiqueta` (`ReagentModals.tsx:108-120`); modal enxuto + colapsavel "Detalhes adicionais" (`ReagentModals.tsx:227-283`).

Ressalvas: drift de TEMPS frontend vs backend (ver G-02); `getTagSummaries` deprecated mas sem aviso runtime visivel; falta teste de regressao na visao etiquetas para o caso de label com whitespace antes do match com label canonica do backend (decisao 1.4 do contrato).

### C. Regressoes cross-camada e contrato HTTP
**APROVADO_COM_RESSALVAS.**

`ReagentLotResponse.label` populado via `lot.getName()` no boundary (`ResponseMapper.java:181`) — sem quebra. `/api/reagents/tags` mantem shape antigo + headers `Deprecation: true` e `Link: rel="successor-version"` (`ReagentController.java:120-126`). CSV header bate exato com decisao 1.5 (`ReagentController.java:137`). Frontend manda `currentStock` como `Number` (`ReagentModals.tsx:163`). Combobox tem `emptyText="Nenhuma etiqueta cadastrada"` (`ReagentModals.tsx:119`).

Ressalva: as 3 fontes de categoria (backend service, backend report registry, frontend constants) estao desalinhadas em valores **operacionais** — bug funcional G-01.

### D. Riscos nao cobertos
**APROVADO_COM_RESSALVAS.**

V13 em produção foi documentada com pre-checks no `dry-run/V13_dry_run.sql` (cobertos NOT NULL e UNKNOWN target). `chartRenderer` confirmado nao usado (3 referencias = constructor + field + parametro construtor — zero uso em `renderPdf`). `getTagSummaries` no frontend marcado `@deprecated` no JSDoc (`reagentService.ts:74-78`) mas sem `console.warn` no runtime. Drift de categorias e TEMPS sera bug operacional silencioso.

### E. Edge cases de regra de status
**APROVADO_COM_RESSALVAS.**

E.1 (em_uso recebe AJUSTE 0 → fora_de_estoque): coberto implicitamente pelo `deriveStatus` (estoque=0 → fora_de_estoque); `applyOpenedDateOnUseTransition` so dispara para final=em_uso, entao `openedDate` NAO e apagada. **OK** (decisao 1.7 reciproca). Falta teste explicito.

E.2 (em_estoque [opened=null] recebe SAIDA total → fora_de_estoque, openedDate=null): coberto e correto. `saidaTotal_emEstoque_viraForaDeEstoque` (`ReagentServiceTest.java:471`) valida o caminho. Sem bug — `openedDate=null + status=fora_de_estoque` e estado canonico documentado pelo contrato.

E.3 (createLot com `status='em_uso'` + `openedDate` preenchido pelo usuario): backend respeita o valor enviado (linha 213 do service so seta openedDate=today **se nulo**). **OK.** Falta teste explicito.

E.4 (filtro `dashFilter='foraDeEstoque'` exibe lotes arquivados via `deleteLot`): **gap UX/semantico G-04** — frontend nao distingue "esgotado vivo" de "arquivado". Auditor externo precisa correlacionar com `audit_log` (action `REAGENT_LOT_ARCHIVED`).

---

## 2. Gaps encontrados

### G-01 — Drift de categorias entre frontend, backend service e report registry
**Severidade: CRITICAL.**
**Bloqueante para release? SIM.**

Tres fontes divergentes:

| Fonte | Valores |
|---|---|
| `biodiagnostico-web/src/components/proin/reagentes/constants.ts:16-27` | `Bioquímica, Hematologia, Imunologia, Parasitologia, Microbiologia, Uroanálise, Kit Diagnóstico, Controle CQ, Calibrador, Geral` |
| `biodiagnostico-api/src/main/java/com/biodiagnostico/service/ReagentService.java:47-56` | `Bioquimica/Bioquímica, Hematologia, Imunologia, Microbiologia, Parasitologia, Uroanalise/Uroanálise, Coagulacao/Coagulação, Outros` |
| `biodiagnostico-api/src/main/java/com/biodiagnostico/service/reports/v2/catalog/ReportDefinitionRegistry.java:29-33` | `Bioquimica, Hematologia, Imunologia, Parasitologia, Microbiologia, Uroanalise, Kit Diagnostico, Controle CQ, Calibrador, Geral` |

Impacto operacional: usuario seleciona "Kit Diagnóstico" no dropdown da UI, frontend manda `category="Kit Diagnóstico"`, `ReagentService.validateCategoryAndTemp` rejeita com `BusinessException("Categoria invalida...")`. **Cadastro real quebra** para 4 das 10 categorias da UI (Kit Diagnóstico, Controle CQ, Calibrador, Geral) e `Coagulação/Outros` do service nao aparecem na UI — **regressao funcional inegavel**. Os testes Java/RTL passam porque os fixtures usam apenas `Bioquímica`.

**Acao corretiva:** frontend-engineer ou backend-engineer alinha as 3 listas em uma fonte unica (preferencia: fonte canonica via endpoint `GET /api/reagents/categories` retornando a lista validada por `ReagentService`, consumida via `useReagentCategories`). Em quanto isso, **bloqueador minimo:** alinhar `ReagentService.ALLOWED_CATEGORIES` com `constants.ts` (acentos + Kit Diagnóstico, Controle CQ, Calibrador, Geral) e remover `Coagulação`/`Outros` ou adiciona-las no frontend. Corrigir tambem `REAGENT_CATEGORIES` no registry (sem acentos hoje).

### G-02 — Drift de temperaturas (TEMPS) entre frontend e backend
**Severidade: CRITICAL.**
**Bloqueante para release? SIM.**

| Fonte | Valores |
|---|---|
| `biodiagnostico-web/src/components/proin/reagentes/constants.ts:33` | `2-8°C, 15-25°C (Ambiente), -20°C, -80°C` (com graus, com parenteses) |
| `biodiagnostico-api/src/main/java/com/biodiagnostico/service/ReagentService.java:58-63` | `2-8C, Ambiente, -20C, -80C` (sem graus, palavra simples) |

Impacto: usuario seleciona "2-8°C" na UI, frontend manda `storageTemp="2-8°C"`, `ReagentService.validateCategoryAndTemp` rejeita. **TODO o cadastro novo de lote quebra** — a regressao e ainda mais severa que G-01 (porque temperatura e obrigatoria nos 9 campos canonicos).

**Acao corretiva:** alinhar para uma das duas convencoes — recomendado o frontend (com graus, mais legivel para o usuario do laboratorio). Backend deve aceitar `2-8°C, 15-25°C (Ambiente), -20°C, -80°C`. Mesma logica de fonte unica futura via endpoint.

### G-03 — `ReagentMigrationV13Test` nao usa Flyway real (gap conhecido §3.3 do audit)
**Severidade: HIGH.**
**Bloqueante para release? NAO** (ressalva ja anotada na audit, mitigada pelo `dry-run/V13_dry_run.sql`).

`ReagentMigrationV13Test.java:36-55` reimplementa o CASE da V13 em Java puro e valida 13 cenarios com `assertThat`. NAO sobe Postgres via Testcontainers. Resultado: drift entre o SQL real da V13 e a funcao `v13Target()` em Java pode passar despercebido. O teste `mapping_equivaleDeriveStatus` (linha 165) tenta cruzar com `deriveStatus` mas so valida 1 caso.

**Acao corretiva:** `release-engineer` deve rodar `dry-run/V13_dry_run.sql` em staging com `pg_dump` recente da producao (audit §4.3). Adicionar comentario inline em `ReagentMigrationV13Test.java` explicando o tradeoff (testcontainers nao no pom). Issue paralela: introduzir testcontainers no proximo release.

### G-04 — `dashFilter='foraDeEstoque'` mistura "esgotado vivo" e "arquivado"
**Severidade: MEDIUM.**
**Bloqueante para release? NAO** (gap UX/semantico, sem perda de dado — auditor pode reconstruir via `audit_log`).

`deleteLot` (`ReagentService.java:307-317`) arquiva lote como `fora_de_estoque` com action `REAGENT_LOT_ARCHIVED`. Movimento de `SAIDA` total tambem coloca em `fora_de_estoque` mas com action `REAGENT_STATUS_DERIVED` trigger=movement. Ambos aparecem misturados ao usuario quando filtra `dashFilter='foraDeEstoque'`. Operador nao distingue lote em uso ativo (apenas zerado) de lote arquivado intencionalmente.

**Acao corretiva (followup):** frontend-engineer adiciona badge "Arquivado" no card quando o ultimo audit_log do lote for `REAGENT_LOT_ARCHIVED`. Requer endpoint novo ou flag no `ReagentLotResponse` (ex: `archived: boolean`). Alternativa: usuario filtra apenas via `audit_log` (auditor externo).

### G-05 — Falta teste explicito para Edge case E.1 (em_uso + AJUSTE 0)
**Severidade: LOW.**
**Bloqueante para release? NAO.**

`createMovement` cobre `em_estoque + AJUSTE 0` indiretamente, mas nao ha cenario explicito para `em_uso + AJUSTE 0 → fora_de_estoque + openedDate preservada`. A logica esta correta (decisao 1.7 reciproca), mas defesa em profundidade pede teste. `qa-engineer` final ou `backend-engineer` em PR seguinte.

### G-06 — Falta teste explicito para Edge case E.3 (createLot em_uso + openedDate preenchido pelo usuario)
**Severidade: LOW.**
**Bloqueante para release? NAO.**

`createLot_emUso_semOpenedDate_setaToday` (linha 170 do ReagentServiceTest) cobre o caminho com openedDate=null. Falta o caminho `openedDate != null` (usuario preencheu) para confirmar que o service NAO sobrescreve. O codigo esta correto (linha 213 `else if openedDate==null`), mas teste explicito e barato.

### G-07 — `chartRenderer` injetado mas nao usado em `ReagentesRastreabilidadeGenerator`
**Severidade: LOW.**
**Bloqueante para release? NAO** (limpeza para `refactor-engineer`).

`ReagentesRastreabilidadeGenerator.java:60,67,75` declara/atribui `chartRenderer` como dependencia mas o metodo `renderPdf` nao chama nenhum metodo dele (secao de consumo foi removida). Spring continua resolvendo a dependencia mas e dead code.

**Acao corretiva:** `refactor-engineer` remove o parametro do construtor e o campo apos PR-1 estavel. Ou adicionar TODO se a issue de "consumo derivado de StockMovement" (audit §1.11) for retomada — mas hoje a dependencia esta morta.

### G-08 — `getTagSummaries` no frontend deprecated apenas via JSDoc
**Severidade: LOW.**
**Bloqueante para release? NAO.**

`reagentService.ts:74-82` marca o metodo com `@deprecated` em JSDoc, mas nao emite `console.warn` quando chamado em runtime. Como o frontend interno ja consome `getLabelSummaries`, isso so acionaria se algum dev adicionasse chamada nova ao alias. **Risco baixo** mas a defesa e barata.

**Acao corretiva (followup):** adicionar `console.warn('reagentService.getTagSummaries() esta deprecated. Use getLabelSummaries().')` na 1a linha do metodo. PR-4 remove o metodo de fato.

### G-09 — Cliente externo de `/api/reagents/export/csv` sem aviso de breaking change
**Severidade: MEDIUM.**
**Bloqueante para release? NAO** (registrar no changelog).

CSV header mudou (`Etiqueta,...,Localizacao,Temperatura` em vez de `Nome,...,Unidade,Consumo/Dia,Temperatura,Status`). Sem versionamento de endpoint nem header `Deprecation`. Algum integrador externo (laboratorio) pode estar parseando o header antigo.

**Acao corretiva:** `release-engineer` registra nota explicita no changelog do release que inclui PR-1, alertando equipes operacionais. Audit nao listou isso explicitamente, mas o contrato 9.3 cita o risco.

### G-10 — Falta teste para Combobox label com whitespace antes do match canonical (decisao 1.4)
**Severidade: LOW.**
**Bloqueante para release? NAO.**

Decisao 1.4 do contrato pede que o callback do `VoiceRecorderModal` faça match `case-insensitive trim` com label existente. O frontend ja faz trim no submit (`ReagentesTab.tsx:177`). Falta teste cobrindo:
- Voice manda `"  Glicose  "`, frontend tem label `"Glicose"` cadastrada → form deveria abrir com `label="Glicose"` selecionado, nao `"  Glicose  "` digitado.

Hoje a logica trima no submit, mas o form intermediario (que o usuario ve) mostra o valor cru. Edge case raro mas vale teste.

---

## 3. Cobertura dos 10 testes regulatorios (audit §3)

| # | Cenario regulatorio | Status | Arquivo do teste | Linha aprox |
|---|---|---|---|---|
| 3.1 | Auditoria de transicao automatica (action, entity_type, entity_id, details com from/to/trigger/expiryDate/currentStock) | **COBERTO** | `ReagentServiceTest.java` | 471-491 (saidaTotal_emEstoque_viraForaDeEstoque), 511-540 (entradaForaDeEstoque) |
| 3.2 | Backfill de openedDate em UPDATE administrativo (action distinta `REAGENT_OPENED_DATE_BACKFILLED`) | **COBERTO** | `ReagentServiceTest.java` | 268-298 (caso 1), 301-320 (idempotencia caso 3) — falta caso 2 (em_uso com opened=null nao-anomalia, gap minimo) |
| 3.3 | Migracao V13 — snapshot pre/pos com Flyway real | **PARCIAL** | `ReagentMigrationV13Test.java` (todos os 13 testes) | Nao usa Flyway real; gap conhecido (G-03), mitigado por `dry-run/V13_dry_run.sql` |
| 3.4 | `usedInQcRecently` bloqueia descarte (deleteLot bloqueia ou arquiva) | **COBERTO** | `ReagentServiceTest.java` | 893-960 (3 testes — sem historico/com movimento+estoque/usado em CQ+estoque zero) |
| 3.5 | Status `vencido` forçado em cadastro (createLot com expiry < hoje) | **COBERTO** | `ReagentServiceTest.java` | 142-167 (createLot_expiryPassada_forcaVencido) |
| 3.6 | ENTRADA em `fora_de_estoque` com openedDate=null grava openedDate=today (audit ressalva 3.6) | **COBERTO** | `ReagentServiceTest.java` | 511-540 (entradaForaDeEstoque_semOpenedDate_viraEmUso) e 542-558 (com openedDate ja setada) |
| 3.7 | ENTRADA em `vencido` bloqueada com BusinessException + audit MOVEMENT_BLOCKED | **COBERTO** | `ReagentServiceTest.java` | 560-582 (entradaEmVencido_bloqueiaComAudit) |
| 3.8 | CSV header canonico | **COBERTO** | `ReagentControllerTest.java` | 196-212 (exportCsv_header_canonico) |
| 3.9 | Endpoint `/api/reagents/labels` retorna `ReagentLabelSummary[]`; alias `/tags` mantem shape antigo + Deprecation | **COBERTO** | `ReagentControllerTest.java` | 158-194 (getLabels + getTags) |
| 3.10 | Generators de Reports v2 sem literais antigos; PDF com cards "Em estoque/Em uso/Fora de estoque/Vencidos"; sem secao "Consumo estimado" | **COBERTO** | `ReagentesRastreabilidadeGeneratorTest.java` | 53-129 (4 testes — definition, PDF, vencidos com estoque, AI commentary) |

Resumo: 9 dos 10 cenarios totalmente cobertos. §3.3 e PARCIAL com gap reconhecido e mitigacao operacional.

---

## 4. Bug suspeitos e regressoes

Lista de coisas que podem estar quebradas mesmo com testes verdes:

1. **G-01 e G-02** (CRITICAL) — drift de categorias e temperaturas garante que o cadastro real de lote falha em producao para a maioria das opcoes da UI. Os fixtures de teste usam `Bioquímica` + `2-8C` (que coincidem nos dois conjuntos) — por isso passam. Em producao, qualquer outra escolha quebra com `BusinessException`. **Esse e o bug mais grave da review.**

2. **Race condition no `applyOpenedDateOnUseTransition` em `updateLot`** (LOW): o codigo chama `applyOpenedDateOnUseTransition` (linha 270) ANTES de `applyDerivedStatus` (linha 273). Se `applyOpenedDateOnUseTransition` setar `openedDate=today`, `deriveStatus` na chamada seguinte retornara `em_uso` (porque opened != null) — comportamento esperado. Sem race em codigo single-thread, mas quando concorrencia entrar em cena (req simultaneo no mesmo lote), o ultimo `save` ganha. Provavel nao-issue porque o `findById`+`save` esta dentro de `@Transactional`, mas um teste de concorrencia seria robusto.

3. **`SAIDA total em `vencido`** (`saidaEmVencido_devePermitir`, linha 584) confirma que `vencido` mantem status mesmo apos zerar estoque. Mas semanticamente isso significa que o estado `vencido + currentStock=0` (que substitui o antigo `inativo`) nao e diferenciavel via `audit_log` recente — apenas via `expiry_date < today` + estoque=0. Audit explicita esse cenario na ressalva 1.6 (equivalencia operacional). **OK** porque o `dry-run/V13_dry_run.sql` documenta a equivalencia, mas operadores externos precisam ler o doc.

4. **Combobox `Combobox.tsx:167` faz `onChange(raw.trim())` em cada keystroke** — isso e citado no contrato 6.2 como "criacao explicita" via clique em Salvar. Funcionalmente nao auto-cria o lote (so via POST), mas o estado do form pode parecer "criado prematuramente" para o desenvolvedor. **Sem bug operacional**, apenas armadilha de manutencao. Documentado.

5. **`ReagentLotResponse.label` e populado por `lot.getName()`** (`ResponseMapper.java:181`). Banco continua com coluna `name`; contrato externo expoe `label`. Auditor que ler `audit_log` historico vera `from='quarentena'`, mas reports v2 antigos em PDF imutavel ainda referenciam "Nome". Audit ressalva 1.6 ja cobre isso via documentacao no `dry-run`.

6. **Categoria com acento `Coagulação` e palavra `Outros`** estao em `ALLOWED_CATEGORIES` mas nao no frontend — isso significa que se algum lote legado tem `category='Outros'`, ele aparece na lista mas o filtro `category=Outros` nao esta na UI. Bug latente: usuario nao consegue filtrar por essas categorias.

---

## 5. Resultado dos comandos automatizados

| Comando | Status | Sumario |
|---|---|---|
| `cd biodiagnostico-api && ./mvnw test` | OK | `Tests run: 360, Failures: 0, Errors: 0, Skipped: 0` — `BUILD SUCCESS` |
| `cd biodiagnostico-web && npx tsc --noEmit` | OK | exit 0, sem output (sem erros de tipo) |
| `cd biodiagnostico-web && npx vitest run` | OK | `Test Files 7 passed (7), Tests 44 passed (44)` em 2.40s — inclui 9/9 do `ReagentesTab.test.tsx` |
| `cd biodiagnostico-web && npm run build` | OK | `built in 270ms`, dist completo gerado |

---

## 6. Decisao final

**BLOQUEADO ate resolver:**
- **G-01** (drift de categorias entre 3 fontes — quebra cadastro real)
- **G-02** (drift de TEMPS entre frontend e backend — quebra TODO cadastro)

**Apos resolver G-01 e G-02 → LIBERADO para `domain-auditor` final e em seguida `release-engineer`.**

Demais gaps (G-03, G-04, G-05, G-06, G-07, G-08, G-09, G-10) sao followups documentados, nao bloqueantes para release.

---

## Sumario para orchestrator

- **A. Backend:** APROVADO_COM_RESSALVAS (mvn 360 verdes, todas regras-canonicas implementadas).
- **B. Frontend:** APROVADO_COM_RESSALVAS (tsc 0, vitest 44 verdes, build 270ms).
- **C. Cross-camada:** APROVADO_COM_RESSALVAS (contrato HTTP intacto + drift de listas — G-01/G-02 quebra prod).
- **D. Riscos nao cobertos:** APROVADO_COM_RESSALVAS (chartRenderer dead code, getTagSummaries sem warn).
- **E. Edge cases:** APROVADO_COM_RESSALVAS (E.1/E.3 sem teste explicito; E.4 mistura arquivado vs esgotado).
- **Cobertura regulatoria:** 9/10 COBERTO + 1/10 PARCIAL (V13 sem Flyway real, mitigado por dry-run).
- **Bloqueante para release:** SIM (G-01 e G-02 — drift quebra cadastro funcional).

**Proximo agente:** `backend-engineer` ou `frontend-engineer` para aplicar a correcao de G-01 e G-02 (alinhar listas de categorias e temperaturas). Apos correcao, retornar para `qa-engineer` (validacao final) e prosseguir para `domain-auditor` (revisita) e `release-engineer`.
