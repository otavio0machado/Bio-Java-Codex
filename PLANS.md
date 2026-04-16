# Plano Inicial de Migração

## Objetivo

Concluir a migração principal do Biodiagnóstico de Python para Java/React com qualidade de produção, preservando comportamento crítico do laboratório e reduzindo risco lógico nos módulos de CQ.

## Escopo atual

Dentro deste workspace, a migração precisa ser conduzida com base nos seguintes artefatos:

- `biodiagnostico-api`: backend Java/Spring Boot com serviços de CQ, áreas laboratoriais, relatórios, autenticação e integrações já em evolução.
- `biodiagnostico-web`: frontend React/TypeScript com páginas e componentes operacionais de CQ.
- `transicao-java`: desenho da migração, schema e sequência macro de implementação.
- `tudo para a transicao` e `cursor-bio-compulabxsimus`: referência funcional e auditorias do sistema anterior.

## Fora do escopo deste plano inicial

- Redesenhar o produto.
- Criar novas regras laboratoriais sem origem no domínio atual.
- Tratar esta fase como simples reescrita visual.

## Módulos críticos de foco

1. CQ bioquímica e motor de Westgard.
2. referências, registros de medição e lookup por histórico e por lote.
3. reagentes, lotes e rastreabilidade operacional.
4. CQ por área e CQ hematologia.
5. pós-calibração, relatórios e fechamento operacional.

## Fontes de verdade por tipo de análise

- Implementação alvo atual:
  - `biodiagnostico-api/src/main/java/com/biodiagnostico`
  - `biodiagnostico-web/src`
- Migração planejada:
  - `transicao-java/00-VISAO-GERAL.md`
  - `transicao-java/01-SCHEMA-SQL.md`
  - `transicao-java/02-BACKEND-JAVA.md`
  - `transicao-java/03-FRONTEND-REACT.md`
- Referência funcional e auditoria:
  - `tudo para a transicao/auditorias/00-mapeamento-geral.md`
  - `transicao-java/prompts/04-westgard-engine.md`
  - `transicao-java/prompts/05-services-qc.md`
  - `transicao-java/prompts/14-pagina-proin-cq.md`

## Mapa Técnico e Funcional Oficial do Módulo de CQ

### Objetivo do mapa

Consolidar a visão oficial do módulo de Controle de Qualidade laboratorial para guiar a sprint de migração, reduzir ambiguidade e alinhar backend, frontend, domínio e validação.

### Estado atual

#### Estrutura técnica atual

- Núcleo de CQ bioquímico no backend:
  - `QcRecordController`
  - `QcService`
  - `WestgardEngine`
  - `QcReferenceService`
  - `QcExamService`
  - `PostCalibrationService`
- CQ por áreas laboratoriais no backend:
  - `AreaQcController`
  - `AreaQcService`
- CQ hematologia no backend:
  - `HematologyController`
  - `HematologyQcService`
- Saídas operacionais ligadas ao CQ:
  - `DashboardService`
  - `PdfReportService`
- Estrutura principal no frontend:
  - `RegistroTab`
  - `ReferenciasTab`
  - `AreaQcModule`
  - `HematologiaArea`
  - `DashboardTab`
  - `RelatoriosTab`
  - `PostCalibrationModal`
  - `LeveyJenningsModal`
  - `qcService`
  - `areaQcService`
  - `hematologyService`
  - `useQcRecords`
  - `useAreaQc`
  - `useHematology`

#### Funcionalidade atual consolidada

- Bioquímica:
  - cadastro de exames;
  - cadastro de referências;
  - registro de medições;
  - avaliação de Westgard;
  - cálculo de `cv`, `zScore`, `status` e `needsCalibration`;
  - pós-calibração por registro;
  - gráficos Levey-Jennings;
  - relatórios PDF;
  - indicadores e alertas.
- Outras áreas:
  - parâmetros por área;
  - medições com aprovação por intervalo ou percentual.
- Hematologia:
  - parâmetros próprios;
  - medições próprias;
  - rotina Bio x Controle Interno.

#### Cobertura de testes atual

- Backend com testes relevantes para:
  - `WestgardEngine`
  - `QcService`
  - `QcRecordController`
- Backend sem cobertura suficiente para:
  - `QcReferenceService`
  - `PostCalibrationService`
  - `AreaQcService`
  - `HematologyQcService`
  - integração completa entre contrato e decisão de domínio
- Frontend:
  - não há suíte de testes operacional exposta no projeto atual.

#### Lacunas arquiteturais do estado atual

- resolução de referência ainda não está formalizada como política canônica por exame, nível, lote e vigência;
- o frontend assume a primeira referência ou parâmetro em alguns fluxos, o que pode divergir da intenção do domínio;
- há contratos diferentes entre bioquímica, áreas genéricas e hematologia, sem mapa unificado do módulo;
- parte das listagens e filtros importantes ainda ocorre em memória;
- alguns controladores devolvem entidades diretamente, sem DTO canônico;
- semântica de pós-calibração ainda não está consolidada como regra oficial de negócio;
- dashboard e relatórios dependem de dados do CQ, mas o módulo ainda não explicita claramente quais estados são canônicos para saída operacional.

### Estado alvo

#### Arquitetura-alvo do módulo

O módulo de CQ deve ser tratado como um conjunto de submódulos coordenados, com fronteiras explícitas:

1. `Core QC Decision`
   - decide resultado do CQ bioquímico;
   - calcula `cv`, `zScore`, `status`;
   - aplica Westgard;
   - decide necessidade de calibração.

2. `Reference Resolution and Validity`
   - resolve a referência aplicável;
   - considera exame, área, nível, lote, vigência e eventual seleção explícita;
   - impede uso implícito de referência ambígua.

3. `Specialized QC`
   - concentra áreas laboratoriais específicas e hematologia;
   - mantém lógica própria de aprovação;
   - segue os mesmos princípios de rastreabilidade e contrato do núcleo.

4. `Operational Outputs`
   - gera dashboard, alertas, PDFs e gráficos;
   - consome somente estados e decisões já canonizados pelo backend.

5. `CQ UI Contract`
   - frontend coleta entrada, apresenta contexto e exibe decisão;
   - frontend não define regra crítica;
   - frontend deve refletir ambiguidades reais em vez de escondê-las.

#### Características obrigatórias do estado alvo

- uma fonte única de decisão por fluxo crítico;
- política explícita de seleção de referência;
- contrato claro entre backend e frontend;
- rastreabilidade entre medição, referência, histórico, violação, decisão de calibração e pós-calibração;
- relatórios e indicadores derivados do mesmo modelo canônico;
- cobertura de testes compatível com o risco clínico e operacional.

### Entidades necessárias

#### Núcleo bioquímico

- `QcExam`
- `QcReferenceValue`
- `QcRecord`
- `WestgardViolation`
- `PostCalibrationRecord`

#### Áreas laboratoriais especializadas

- `AreaQcParameter`
- `AreaQcMeasurement`

#### Hematologia

- `HematologyQcParameter`
- `HematologyQcMeasurement`
- `HematologyBioRecord`

#### Entidades de apoio operacional ligadas ao CQ

- `ReagentLot`
- `MaintenanceRecord`

### Serviços necessários

#### Serviços de domínio essenciais

- `QcExamService`
- `QcReferenceService`
- `QcService`
- `WestgardEngine`
- `PostCalibrationService`
- `AreaQcService`
- `HematologyQcService`

#### Capacidades que precisam ficar explícitas no desenho-alvo

- resolução canônica de referência;
- montagem de histórico aplicável para Westgard;
- decisão canônica de aprovação, alerta e reprovação;
- decisão canônica de calibração e pós-calibração;
- consolidação de saídas operacionais do módulo.

#### Serviços de saída operacional

- `DashboardService`
- `PdfReportService`

#### Superfícies de integração do frontend

- `qcService`
- `areaQcService`
- `hematologyService`
- `useQcRecords`
- `useAreaQc`
- `useHematology`

### Regras de negócio críticas

1. Uma medição de CQ só pode ser avaliada se houver exame válido no contexto correto.
2. A referência aplicada precisa obedecer política explícita de seleção.
3. O cálculo de `cv` e `zScore` deve ser determinístico e auditável.
4. A decisão de `status` no núcleo bioquímico depende da avaliação de Westgard:
   - `REPROVADO` quando houver violação de rejeição;
   - `ALERTA` quando houver apenas warning;
   - `APROVADO` quando não houver violação.
5. O histórico usado em Westgard precisa respeitar o recorte correto do domínio.
6. A decisão de calibração não pode ser derivada de forma divergente entre backend e frontend.
7. Pós-calibração precisa ter semântica oficial:
   - o que corrige;
   - o que apenas registra;
   - como impacta o estado do registro original.
8. CQ por áreas e hematologia podem ter regra própria de aprovação, mas precisam manter rastreabilidade equivalente ao núcleo.
9. Dashboard, gráfico e PDF devem refletir o mesmo estado canônico do backend.

### Riscos da migração

1. Divergência entre documentação de transição, código atual e comportamento esperado do legado.
2. Seleção incorreta de referência por ausência de política formal de vigência e lote.
3. Divergência entre a decisão exibida no frontend e a decisão real do backend.
4. Duplicação de lógica de aprovação entre bioquímica, áreas e hematologia.
5. Ambiguidade semântica em pós-calibração.
6. Falta de cobertura de testes em referências, áreas, hematologia e frontend.
7. Retorno direto de entidades em partes do módulo, dificultando estabilização contratual.
8. Crescimento de consultas em memória e impacto de performance na sprint final.

### Fases de implementação do módulo de CQ

As macrofases anteriores ficam desdobradas nas fases pequenas abaixo. A regra operacional é simples: executar uma fase por vez, fechar `qa_engineer` e `domain_auditor`, registrar risco residual e só então abrir a próxima.

#### Fase CQ-01 — Congelar fonte de verdade e ambiguidades abertas

Objetivo:

- fechar a base documental e técnica que vai governar a migração do módulo;
- impedir interpretação silenciosa entre código atual, documentação de transição e legado.

Status oficial da fase:

- concluída em 2026-04-03;
- vigente como gate documental obrigatório para todas as próximas fases do CQ.

Arquivos prováveis afetados:

- `PLANS.md`
- `AGENTS.md`
- `transicao-java/prompts/04-westgard-engine.md`
- `transicao-java/prompts/05-services-qc.md`
- `transicao-java/prompts/14-pagina-proin-cq.md`
- `tudo para a transicao/auditorias/00-mapeamento-geral.md`

Riscos:

- falsa sensação de alinhamento sem evidência no código;
- ambiguidade crítica ficar implícita e contaminar fases seguintes.

Critérios de aceite:

- fontes de verdade por fluxo registradas;
- ambiguidades críticas listadas nominalmente;
- nenhuma fase posterior depende de premissa oculta.

Validação obrigatória:

- `qa_engineer`: confirma rastreabilidade entre plano e código atual;
- `domain_auditor`: confirma que referência, histórico, lote, Westgard e calibração estão explicitamente tratados.

#### Resultado oficial da Fase CQ-01

##### Matriz de fontes de verdade por fluxo do CQ

| Fluxo | Fonte primária | Fonte secundária | Fonte terciária | Divergência aberta |
|---|---|---|---|---|
| Cadastro e listagem de exames CQ | Código ativo em `QcExamController`, `QcExamService`, `QcExamRepository`, `QcExam` | `transicao-java/prompts/05-services-qc.md` e `transicao-java/prompts/14-pagina-proin-cq.md` | `tudo para a transicao/auditorias/00-mapeamento-geral.md` | baixa |
| Cadastro e listagem de referências | Código ativo em `QcReferenceController`, `QcReferenceService`, `QcReferenceValueRepository`, `QcReferenceValue` | `transicao-java/prompts/05-services-qc.md` e `transicao-java/prompts/14-pagina-proin-cq.md` | `tudo para a transicao/auditorias/00-mapeamento-geral.md` | alta: `CQ-A01` |
| Registro bioquímico, cálculo e decisão Westgard | Código ativo em `QcRecordController`, `QcService`, `WestgardEngine`, `QcRecordRepository`, `WestgardViolation` | `transicao-java/prompts/04-westgard-engine.md` e `transicao-java/prompts/05-services-qc.md` | `tudo para a transicao/auditorias/00-mapeamento-geral.md` | média: `CQ-A02` |
| Pós-calibração | Código ativo em `PostCalibrationService`, `PostCalibrationRecordRepository`, `QcRecordController`, `PostCalibrationRecord` | `transicao-java/prompts/05-services-qc.md` e `transicao-java/prompts/14-pagina-proin-cq.md` | `tudo para a transicao/auditorias/00-mapeamento-geral.md` | alta: `CQ-A03` |
| Interface bioquímica do CQ | Código ativo em `RegistroTab`, `ReferenciasTab`, `PostCalibrationModal`, `qcService`, `useQcRecords` | `transicao-java/prompts/14-pagina-proin-cq.md` | `tudo para a transicao/auditorias/00-mapeamento-geral.md` | alta: `CQ-A04` |
| CQ por áreas laboratoriais | Código ativo em `AreaQcController`, `AreaQcService`, `AreaQcParameter`, `AreaQcMeasurement`, `AreaQcModule`, `areaQcService`, `useAreaQc` | `tudo para a transicao/auditorias/00-mapeamento-geral.md` | documentação de migração geral em `transicao-java/` | média: `CQ-A05` |
| CQ de hematologia | Código ativo em `HematologyController`, `HematologyQcService`, `HematologyQcParameter`, `HematologyQcMeasurement`, `HematologiaArea`, `hematologyService`, `useHematology` | `tudo para a transicao/auditorias/00-mapeamento-geral.md` | documentação de migração geral em `transicao-java/` | média: `CQ-A05` |
| Dashboard, gráficos e relatórios do CQ | Código ativo em `DashboardController`, `DashboardService`, `PdfReportService`, `DashboardTab`, `RelatoriosTab`, `LeveyJenningsModal` | `transicao-java/prompts/14-pagina-proin-cq.md` | `tudo para a transicao/auditorias/00-mapeamento-geral.md` | média: `CQ-A06` |

##### Registro oficial de ambiguidades críticas abertas

| ID | Ambiguidade | Impacto | Fases bloqueadas ou dependentes |
|---|---|---|---|
| `CQ-A01` | Política canônica de seleção de referência por exame, nível, lote, vigência e seleção explícita | Pode aplicar alvo, DP e CV incorretos ao registro | `CQ-02`, `CQ-03`, `CQ-05`, `CQ-10` |
| `CQ-A02` | Recorte canônico do histórico usado no Westgard e na decisão bioquímica | Pode gerar alerta ou reprovação com base em histórico inadequado | `CQ-04`, `CQ-05`, `CQ-10` |
| `CQ-A03` | Semântica oficial do pós-calibração sobre registro original, histórico e estado operacional | Pode mascarar não conformidade ou reescrever histórico silenciosamente | `CQ-06`, `CQ-07`, `CQ-10` |
| `CQ-A04` | Forma correta de expor no frontend ambiguidades de referência e decisão sem criar regra paralela | Pode induzir o operador a uma seleção silenciosa e não auditável | `CQ-03`, `CQ-07` |
| `CQ-A05` | Contrato mínimo comum de rastreabilidade entre bioquímica, áreas laboratoriais e hematologia | Pode fragmentar o módulo em regras sem evidência comparável | `CQ-08`, `CQ-09`, `CQ-11` |
| `CQ-A06` | Estado canônico que alimenta dashboard, gráfico e PDF em cenários limítrofes | Pode produzir saída operacional diferente da decisão real do backend | `CQ-10`, `CQ-11` |

##### Regras operacionais enquanto este congelamento estiver vigente

- toda tarefa de CQ deve citar explicitamente qual linha da matriz de fonte de verdade está sendo usada;
- toda tarefa que tocar `CQ-A01` a `CQ-A06` deve carregar o identificador da ambiguidade no `context_packet`, no `qa_review` e no `domain_audit_verdict`;
- `transicao-java/prompts/*.md` são artefatos auxiliares de migração e não podem, sozinhos, vencer o código ativo nem o registro oficial de ambiguidades;
- `tudo para a transicao/auditorias/00-mapeamento-geral.md` continua sendo documento histórico de paridade e fotografia do legado, não decisão canônica isolada para o Java/React atual;
- nenhuma fase posterior do CQ pode ser considerada pronta se depender de resolução tácita de uma ambiguidade aberta desta lista.

#### Fase CQ-02 — Formalizar política de seleção de referência no backend

Objetivo:

- tornar determinística a escolha da referência aplicável no núcleo bioquímico.

Status oficial da fase:

- concluída em 2026-04-03;
- vigente no backend bioquímico, com resolução canônica por exame, área, nível, vigência, lote e referência explícita;
- conflitos e ausência de referência válida ficam bloqueados antes do cálculo crítico.

Arquivos prováveis afetados:

- `biodiagnostico-api/src/main/java/com/biodiagnostico/service/QcReferenceService.java`
- `biodiagnostico-api/src/main/java/com/biodiagnostico/service/QcService.java`
- `biodiagnostico-api/src/main/java/com/biodiagnostico/repository/QcReferenceValueRepository.java`
- `biodiagnostico-api/src/main/java/com/biodiagnostico/entity/QcReferenceValue.java`
- `biodiagnostico-api/src/main/java/com/biodiagnostico/controller/QcReferenceController.java`

Riscos:

- aplicar média, desvio padrão e CV de referência incorreta;
- regressão em registros que hoje dependem de seleção implícita.

Critérios de aceite:

- regra de seleção cobre exame, nível, lote, vigência e seleção explícita;
- conflito entre referências candidatas não é resolvido por heurística silenciosa;
- cenários sem referência válida ficam explicitamente bloqueados.

Validação obrigatória:

- `qa_engineer`: cobre cenários nominal, conflito, vigência expirada e ausência de referência;
- `domain_auditor`: valida coerência laboratorial de lote, data e aplicabilidade da referência.

#### Fase CQ-03 — Refletir seleção de referência no contrato e na UI

Objetivo:

- remover a escolha implícita da primeira referência no frontend;
- alinhar a interface ao contrato canônico do backend.

Status oficial da fase:

- concluída em 2026-04-03;
- vigente no fluxo de registro bioquímico, com seleção explícita ou automática rastreável de referência;
- dependência direta atendida: `CQ-02` já fornece a política canônica de resolução no backend.

Arquivos prováveis afetados:

- `biodiagnostico-web/src/components/proin/RegistroTab.tsx`
- `biodiagnostico-web/src/components/proin/ReferenciasTab.tsx`
- `biodiagnostico-web/src/services/qcService.ts`
- `biodiagnostico-web/src/hooks/useQcRecords.ts`

Riscos:

- quebrar fluxo operacional do usuário se o estado de ambiguidade não ficar claro;
- interface continuar mascarando conflito real de referência.

Critérios de aceite:

- frontend não escolhe referência silenciosamente;
- ambiguidade aparece como escolha explícita, bloqueio ou mensagem controlada;
- payload enviado ao backend preserva rastreabilidade da referência usada.

Validação obrigatória:

- `qa_engineer`: verifica múltiplas candidatas, nenhuma candidata e referência manual;
- `domain_auditor`: confirma que a experiência do operador não cria regra paralela à do backend.

#### Fase CQ-04 — Formalizar recorte de histórico para decisão de CQ

Objetivo:

- definir exatamente quais registros entram no histórico usado em cálculo e Westgard.

Status oficial da fase:

- concluída em 2026-04-04;
- vigente no núcleo bioquímico com recorte explícito por `referenceId` resolvida, `examName`, `area`, `level` e `date <= data da medição`;
- quando o registro atual informar lote, o histórico passa a ser restrito ao mesmo lote;
- atualização de registro exclui o próprio `id` do histórico e ignora entradas do mesmo dia criadas depois do registro em edição;
- validada com cobertura automatizada de serviço para data futura, lote divergente, mesmo lote e fronteira temporal no update.

Resultado oficial da fase:

- `QcService` deixou de usar histórico amplo por `examName + level + area` e passou a carregar histórico compatível com a referência resolvida;
- o recorte temporal do Westgard ficou explícito no backend e auditável no código;
- a fase não alterou as regras do `WestgardEngine`, apenas o conjunto de registros elegíveis que chega ao motor.

Pendências e riscos residuais:

- registros legados sem `reference_id` continuam fora do histórico canônico e podem reduzir profundidade histórica até saneamento;
- `Levey-Jennings`, dashboard e PDF ainda não consomem este mesmo recorte canônico; o alinhamento segue para `CQ-10`;
- a semântica final de `status`, `violations` e `needsCalibration` continua pertencendo à `CQ-05`.

Próxima fase recomendada:

- `CQ-05 — Estabilizar a decisão canônica do núcleo bioquímico`.

Arquivos prováveis afetados:

- `biodiagnostico-api/src/main/java/com/biodiagnostico/service/QcService.java`
- `biodiagnostico-api/src/main/java/com/biodiagnostico/service/WestgardEngine.java`
- `biodiagnostico-api/src/main/java/com/biodiagnostico/repository/QcRecordRepository.java`
- `biodiagnostico-api/src/main/java/com/biodiagnostico/entity/QcRecord.java`

Riscos:

- falso alerta ou falsa reprovação por histórico errado;
- inconsistência entre histórico esperado pelo domínio e histórico realmente consultado.

Critérios de aceite:

- recorte do histórico está explícito e auditável;
- Westgard recebe histórico consistente com exame, referência, lote, nível e janela temporal aplicável;
- edge cases de fronteira temporal ficam definidos.

Validação obrigatória:

- `qa_engineer`: testa histórico vazio, incompleto, limítrofe e conflitante;
- `domain_auditor`: valida se o recorte histórico é coerente com a prática de CQ do laboratório.

#### Fase CQ-05 — Estabilizar a decisão canônica do núcleo bioquímico

Objetivo:

- consolidar a decisão oficial do backend para `cv`, `zScore`, `status`, violações e `needsCalibration`.

Status oficial da fase:

- concluída em 2026-04-04;
- vigente no backend bioquímico, com `cv` e `zScore` recalculados a partir do registro final, `status` derivado exclusivamente da severidade das violações Westgard e `needsCalibration` governado por `cv > cvLimit`;
- validada com testes cobrindo `APROVADO`, `ALERTA`, `REPROVADO`, limiar de calibração, `SD=0`, preservação do `cvLimit` informado e rastreabilidade das violações.

Arquivos prováveis afetados:

- `biodiagnostico-api/src/main/java/com/biodiagnostico/service/QcService.java`
- `biodiagnostico-api/src/main/java/com/biodiagnostico/service/WestgardEngine.java`
- `biodiagnostico-api/src/main/java/com/biodiagnostico/controller/QcRecordController.java`
- `biodiagnostico-api/src/main/java/com/biodiagnostico/entity/QcRecord.java`
- `biodiagnostico-api/src/main/java/com/biodiagnostico/entity/WestgardViolation.java`
- `biodiagnostico-api/src/test/java/com/biodiagnostico/service/QcServiceTest.java`
- `biodiagnostico-api/src/test/java/com/biodiagnostico/service/WestgardEngineTest.java`
- `biodiagnostico-api/src/test/java/com/biodiagnostico/controller/QcRecordControllerTest.java`

Riscos:

- divergência entre o que o backend decide e o que o frontend interpreta;
- mudança acidental no significado de `ALERTA`, `REPROVADO` e `APROVADO`.

Critérios de aceite:

- saída do backend para decisão de CQ fica estável e rastreável;
- status e necessidade de calibração seguem regra única;
- testes cobrem happy path, warning, rejection e transições de status.

Validação obrigatória:

- `qa_engineer`: executa matriz de regressão do núcleo bioquímico;
- `domain_auditor`: confirma coerência entre resultado, violação e decisão operacional.

#### Fase CQ-06 — Definir semântica oficial de pós-calibração

Objetivo:

- formalizar como o pós-calibração se relaciona com o registro original, o histórico e o status operacional.

Status oficial da fase:

- concluída em 2026-04-04;
- semântica oficial consolidada: o endpoint atual de pós-calibração é **exclusivamente um fluxo corretivo 1:1**, vinculado ao registro original;
- o registro original continua sendo a evidência analítica canônica do evento de CQ;
- a única mutação permitida no registro original é `needsCalibration -> false`, significando **pendência corretiva encerrada**, e não aprovação retroativa do evento;
- `status`, `violations`, `cv`, `zScore`, `value`, referência, lote e histórico canônico permanecem imutáveis após o corretivo;
- frontend e backend passam a tratar o corretivo como informação vinculada ao evento original, nunca como substituição silenciosa do resultado.

Decisão consolidada da fase:

| Pergunta | Decisão oficial | Observação |
|---|---|---|
| O pós-calibração cria uma nova medição canônica de CQ? | não | permanece fora do histórico principal |
| O pós-calibração altera `status`, `violations`, `cv`, `zScore` ou `value` do original? | não | preserva a rastreabilidade do evento analítico |
| O pós-calibração pode alterar `needsCalibration` do original? | sim, apenas para `false` | significa apenas que a pendência corretiva foi registrada |
| O endpoint aceita pós-calibração quando `needsCalibration` é `false`? | não | o fluxo atual é exclusivamente corretivo |
| Pode haver mais de um `PostCalibrationRecord` por `QcRecord`? | não | vínculo 1:1 obrigatório nesta fase |
| O corretivo entra no Westgard ou no Levey-Jennings? | não | fica fora do histórico canônico do núcleo bioquímico |
| UI, PDF e dashboard podem exibir o corretivo? | sim, como informação auxiliar | nunca substituindo o estado original |

Arquivos prováveis afetados:

- `biodiagnostico-api/src/main/java/com/biodiagnostico/service/PostCalibrationService.java`
- `biodiagnostico-api/src/test/java/com/biodiagnostico/service/PostCalibrationServiceTest.java`
- `biodiagnostico-api/src/test/java/com/biodiagnostico/controller/QcRecordControllerTest.java`
- `biodiagnostico-web/src/components/proin/PostCalibrationModal.tsx`
- `biodiagnostico-web/src/components/proin/RegistroTab.tsx`

Riscos:

- operadores interpretarem `needsCalibration = false` como “evento aprovado”, quando o significado oficial é apenas “corretivo registrado”;
- dashboard e relatórios ainda precisarem explicitar esse estado auxiliar em fases posteriores;
- inexistência, por ora, de um modo separado para uso meramente registral do endpoint.

Critérios de aceite:

- o efeito do pós-calibração sobre o registro original fica explícito;
- o endpoint passa a operar apenas como fluxo corretivo 1:1 e bloqueia usos fora dessa semântica;
- rastreabilidade entre evento original e pós-calibração fica preservada.

Validação obrigatória:

- `qa_engineer`: cobre cenários com e sem necessidade de calibração prévia;
- `domain_auditor`: aprova a semântica do corretivo e o impacto histórico permitido.

Evidência de conclusão:

- backend endurecido para bloquear criação sem pendência corretiva ativa e para bloquear duplicidade por `QcRecord`;
- cobertura automatizada de serviço e contrato HTTP para sucesso, ausência de pendência, duplicidade e não encontrado;
- frontend alinhado para abrir o fluxo por `needsCalibration`, exibir semântica corretiva explícita e refletir o encerramento da pendência sem reclassificar o evento original;
- build e lint do frontend validados após os ajustes da fase.

Pendências pós-fase:

- explicitar esse estado auxiliar em dashboard e relatórios na `CQ-10`;
- manter proibida qualquer reclassificação automática de `status` até decisão posterior de domínio;
- continuar sem modo “meramente registral” para o endpoint atual.

#### Fase CQ-07 — Alinhar o frontend bioquímico ao contrato canônico

Objetivo:

- fazer o frontend consumir e apresentar a decisão oficial sem reproduzir regra crítica.

Status oficial da fase:

- concluída em 2026-04-04;
- o frontend bioquímico passou a exibir de forma explícita a decisão canônica retornada pelo backend para o último registro salvo;
- erros de contrato vindos da API deixaram de existir apenas como toast transitório e passaram a ficar visíveis na tela;
- o fluxo de pós-calibração continua subordinado a `needsCalibration`, sem reclassificar `status` nem recalcular regra crítica no React;
- o Levey-Jennings deixou de oferecer um filtro de período não suportado pelo contrato e agora explicita a janela real consumida da API.

Arquivos prováveis afetados:

- `biodiagnostico-web/src/components/proin/RegistroTab.tsx`
- `biodiagnostico-web/src/components/charts/LeveyJenningsModal.tsx`
- `biodiagnostico-web/src/components/proin/PostCalibrationModal.tsx`
- `biodiagnostico-web/src/hooks/useQcRecords.ts`
- `biodiagnostico-web/src/services/qcService.ts`

Arquivos efetivamente afetados:

- `biodiagnostico-web/src/components/proin/RegistroTab.tsx`
- `biodiagnostico-web/src/components/charts/LeveyJenningsModal.tsx`
- `biodiagnostico-web/src/components/charts/LeveyJenningsChart.tsx`

Riscos:

- operadores ainda dependerem de interpretação incorreta de `needsCalibration = false`, sem considerar se houve ou não corretivo registrado;
- a superfície de dashboard e relatórios ainda não refletir esse mesmo detalhamento, o que permanece para a `CQ-10`;
- o frontend continuar oferecendo ajuda local de referência, ainda que subordinada ao backend, exigindo disciplina para não virar nova fonte de regra.

Critérios de aceite:

- frontend apenas coleta dados, chama contrato e exibe decisão;
- estados de erro, bloqueio, ambiguidade e calibração ficam explícitos;
- não sobra lógica crítica duplicada na camada React.

Validação obrigatória:

- `qa_engineer`: verifica renderização, fluxos de erro e consistência do contrato;
- `domain_auditor`: confirma que a tela não altera a semântica do processo de CQ.

Evidência de conclusão:

- `RegistroTab` agora mostra o último resultado confirmado pelo backend, com `status`, violações, métricas devolvidas e estado de pendência corretiva;
- o envio bloqueado pela API fica explícito na tela, além do toast;
- a pós-calibração continua apresentada como evento auxiliar vinculado ao registro original;
- o modal e o gráfico de Levey-Jennings passaram a declarar que consomem a janela fixa dos últimos 30 registros canônicos e que pós-calibração não entra como novo ponto;
- build e lint do frontend foram validados após os ajustes da fase.

Pendências pós-fase:

- consolidar essa mesma semântica em dashboard e relatórios na `CQ-10`;
- manter a UI de referência sob vigilância para que continue sendo ajuda operacional e não decisão concorrente ao backend;
- avaliar testes automatizados de interface para os estados explícitos de decisão, erro e pendência corretiva em uma etapa de endurecimento posterior.

#### Fase CQ-08 — Alinhar CQ por áreas laboratoriais

Objetivo:

- estabilizar o submódulo de áreas especializadas com contrato explícito e rastreável.

Status oficial da fase:

- concluída em 2026-04-04;
- a seleção de parâmetro por área ficou rastreável no contrato de medição;
- ambiguidades reais entre parâmetros compatíveis passam a ser bloqueadas no backend, em vez de resolvidas silenciosamente;
- o frontend deixou de depender de um parâmetro implícito por analito e passou a expor candidatos e seleção explícita quando necessário;
- histórico e tela de medição passaram a exibir o parâmetro efetivamente usado na decisão.

Arquivos prováveis afetados:

- `biodiagnostico-api/src/main/java/com/biodiagnostico/service/AreaQcService.java`
- `biodiagnostico-api/src/main/java/com/biodiagnostico/controller/AreaQcController.java`
- `biodiagnostico-api/src/main/java/com/biodiagnostico/entity/AreaQcParameter.java`
- `biodiagnostico-api/src/main/java/com/biodiagnostico/entity/AreaQcMeasurement.java`
- `biodiagnostico-api/src/main/java/com/biodiagnostico/repository/AreaQcParameterRepository.java`
- `biodiagnostico-api/src/main/java/com/biodiagnostico/repository/AreaQcMeasurementRepository.java`
- `biodiagnostico-web/src/components/proin/AreaQcModule.tsx`
- `biodiagnostico-web/src/services/areaQcService.ts`
- `biodiagnostico-web/src/hooks/useAreaQc.ts`

Arquivos efetivamente afetados:

- `biodiagnostico-api/src/main/java/com/biodiagnostico/service/AreaQcService.java`
- `biodiagnostico-api/src/main/java/com/biodiagnostico/dto/request/AreaQcMeasurementRequest.java`
- `biodiagnostico-api/src/main/java/com/biodiagnostico/dto/response/AreaQcMeasurementResponse.java`
- `biodiagnostico-api/src/test/java/com/biodiagnostico/service/AreaQcServiceTest.java`
- `biodiagnostico-api/src/test/java/com/biodiagnostico/controller/AreaQcControllerTest.java`
- `biodiagnostico-web/src/components/proin/AreaQcModule.tsx`

Riscos:

- parâmetros genéricos demais ainda exigirem saneamento operacional para evitar conflitos frequentes;
- submódulos de hematologia e saídas operacionais ainda não refletirem esse mesmo padrão;
- a equipe depender de contexto incompleto e forçar bloqueios legítimos de ambiguidade até os parâmetros ficarem melhor organizados.

Critérios de aceite:

- regra de aprovação por área fica explícita;
- parâmetro usado na decisão fica rastreável;
- frontend não escolhe silenciosamente parâmetro incompatível.

Validação obrigatória:

- `qa_engineer`: testa casos nominais, fora de faixa e conflitos de parâmetro;
- `domain_auditor`: valida coerência das regras especializadas por área.

Evidência de conclusão:

- testes automatizados cobrem seleção explícita de parâmetro, resolução por contexto, reprovação fora da faixa e bloqueio de ambiguidade;
- contrato HTTP da área passa a ter cobertura para medição com parâmetro rastreável e erro de conflito;
- a UI das áreas passou a mostrar candidatos de parâmetro, mensagem operacional de resolução e dados do parâmetro aplicado no histórico;
- build e lint do frontend foram validados após os ajustes da fase.

Pendências pós-fase:

- manter observação operacional sobre parâmetros genéricos ou duplicados para evitar conflitos recorrentes;
- aplicar disciplina semelhante ao fluxo de hematologia na `CQ-09`;
- consolidar o consumo desse estado rastreável em dashboard e relatórios na `CQ-10`.

#### Fase CQ-09 — Alinhar CQ de hematologia

Objetivo:

- consolidar a rotina de hematologia com contrato estável e evidência de rastreabilidade.

Status oficial da fase:

- concluída em 2026-04-04;
- o controller de hematologia deixou de devolver entidades cruas e passou a usar DTOs com rastreabilidade do parâmetro aplicado;
- cada medição agora inclui `parameterId`, `parameterEquipamento`, `parameterLoteControle` e `parameterNivelControle` no response;
- a UI passou a exibir equipamento, lote e nível do parâmetro no histórico de medições;
- a regra de cálculo e aprovação (INTERVALO e PERCENTUAL) não foi alterada;
- a rotina Bio x Controle Interno não foi alterada (sem drift contratual).

Arquivos prováveis afetados:

- `biodiagnostico-api/src/main/java/com/biodiagnostico/service/HematologyQcService.java`
- `biodiagnostico-api/src/main/java/com/biodiagnostico/controller/HematologyController.java`
- `biodiagnostico-api/src/main/java/com/biodiagnostico/entity/HematologyQcParameter.java`
- `biodiagnostico-api/src/main/java/com/biodiagnostico/entity/HematologyQcMeasurement.java`
- `biodiagnostico-api/src/main/java/com/biodiagnostico/entity/HematologyBioRecord.java`
- `biodiagnostico-api/src/main/java/com/biodiagnostico/repository/HematologyQcParameterRepository.java`
- `biodiagnostico-api/src/main/java/com/biodiagnostico/repository/HematologyQcMeasurementRepository.java`
- `biodiagnostico-api/src/main/java/com/biodiagnostico/repository/HematologyBioRecordRepository.java`
- `biodiagnostico-web/src/components/proin/HematologiaArea.tsx`
- `biodiagnostico-web/src/services/hematologyService.ts`
- `biodiagnostico-web/src/hooks/useHematology.ts`

Arquivos efetivamente afetados:

- `biodiagnostico-api/src/main/java/com/biodiagnostico/dto/response/HematologyParameterResponse.java` (criado)
- `biodiagnostico-api/src/main/java/com/biodiagnostico/dto/response/HematologyMeasurementResponse.java` (criado)
- `biodiagnostico-api/src/main/java/com/biodiagnostico/service/HematologyQcService.java`
- `biodiagnostico-api/src/main/java/com/biodiagnostico/controller/HematologyController.java`
- `biodiagnostico-api/src/test/java/com/biodiagnostico/service/HematologyQcServiceTest.java` (criado)
- `biodiagnostico-web/src/types/index.ts`
- `biodiagnostico-web/src/components/proin/HematologiaArea.tsx`

Riscos:

- fluxo Bio x Controle Interno divergir entre backend e interface;
- decisões de hematologia ficarem semanticamente desconectadas do restante do módulo.

Critérios de aceite:

- fluxos de hematologia ficam explicitados no contrato;
- entidades e medições mantêm rastreabilidade suficiente;
- comportamento crítico fica coberto por cenários centrais.

Validação obrigatória:

- `qa_engineer`: cobre rotinas principais, erros de entrada e consistência de resposta;
- `domain_auditor`: valida coerência laboratorial da rotina de hematologia.

Evidência de conclusão:

- testes unitários cobrem criação de medição APROVADA e REPROVADA, modo INTERVALO e PERCENTUAL, parâmetro inexistente e rastreabilidade de campos do parâmetro no response;
- contrato HTTP de hematologia passou a devolver DTOs com rastreabilidade em vez de entidades cruas;
- a UI de medições passou a exibir equipamento, lote e nível do parâmetro aplicado no histórico;
- build do frontend validado sem erros após os ajustes da fase.

Pendências pós-fase:

- criar `HematologyControllerTest` (teste de integração HTTP) para completar cobertura na `CQ-11`;
- `HematologyBioRecord` ainda retorna entidade direta — sem drift contratual, mas pode ser endurecido em fase futura;
- observação operacional sobre parâmetros duplicados na hematologia (mesmo padrão da CQ-08);
- consolidar consumo desse estado rastreável em dashboard e relatórios na `CQ-10`.

#### Fase CQ-10 — Consolidar saídas operacionais do módulo

Objetivo:

- garantir que dashboard, gráficos e relatórios consumam apenas estado canônico do CQ.

Status oficial da fase:

- concluída em 2026-04-04;
- os PDFs de hematologia e áreas laboratoriais passaram a incluir rastreabilidade do parâmetro aplicado (equipamento, lote controle, nível controle);
- o `PdfReportService` recebeu `@Transactional(readOnly = true)` para garantir acesso correto ao parâmetro via lazy loading;
- verificação completa confirmou que todas as saídas operacionais (dashboard, gráficos, PDFs) consomem estado canônico: leem `status`, `cv`, `zScore`, `needsCalibration` e `violations` que foram definidos pelos serviços canônicos (`QcService`, `AreaQcService`, `HematologyQcService`) no momento da criação dos registros;
- nenhuma saída operacional recalcula decisão de aprovação/reprovação ou Westgard.

Arquivos prováveis afetados:

- `biodiagnostico-api/src/main/java/com/biodiagnostico/service/DashboardService.java`
- `biodiagnostico-api/src/main/java/com/biodiagnostico/service/PdfReportService.java`
- `biodiagnostico-api/src/main/java/com/biodiagnostico/controller/DashboardController.java`
- `biodiagnostico-web/src/components/proin/DashboardTab.tsx`
- `biodiagnostico-web/src/components/proin/RelatoriosTab.tsx`
- `biodiagnostico-web/src/components/charts/LeveyJenningsModal.tsx`

Arquivos efetivamente afetados:

- `biodiagnostico-api/src/main/java/com/biodiagnostico/service/PdfReportService.java`

Riscos:

- indicador, gráfico ou PDF refletir estado diferente da decisão real do backend;
- consolidação operacional mascarar ambiguidade de domínio ainda aberta.

Critérios de aceite:

- as saídas operacionais usam o mesmo estado canônico do módulo;
- alertas, gráficos e relatórios são consistentes com os registros e decisões;
- qualquer limitação residual fica documentada.

Validação obrigatória:

- `qa_engineer`: compara saída operacional contra cenários conhecidos do módulo;
- `domain_auditor`: confirma que o conteúdo operacional preserva o significado laboratorial correto.

Evidência de conclusão:

- análise completa de `DashboardService` e `PdfReportService` confirmou que ambos leem estado canônico pré-computado (`status`, `violations`, `needsCalibration`, `cv`) — nenhum recalcula decisão;
- PDFs de hematologia e áreas genéricas agora incluem colunas de equipamento, lote controle e nível controle do parâmetro aplicado;
- `PdfReportService` recebeu `@Transactional(readOnly = true)` para acesso seguro ao parâmetro via JPA lazy loading;
- `LeveyJenningsChart` consome `zScore`, `target`, `sd`, `upper2sd`, `lower2sd`, `upper3sd`, `lower3sd` diretamente do backend — sem recálculo no frontend;
- build do frontend verificado sem erros.

Limitações conhecidas documentadas:

- dashboard global (`DashboardService` / `DashboardPage`) mostra apenas KPIs de bioquímica — hematologia e áreas especializadas não aparecem nos indicadores globais (requer feature nova, fora do escopo desta fase);
- `DashboardTab` no frontend calcula `approvalRate` client-side a partir de registros filtrados — pode divergir do backend em cenários onde a contagem SQL inclui registros diferentes dos carregados no front; divergência é baixa em operação normal;
- gráficos Levey-Jennings disponíveis apenas para bioquímica — hematologia e áreas especializadas não têm gráfico equivalente (requer feature nova).

Pendências pós-fase:

- testes de integração HTTP para `ReportController` e `DashboardController` na CQ-11;
- avaliar necessidade de dashboard multi-área como feature futura pós-migração.

#### Fase CQ-11 — Fechamento de regressão e prontidão do módulo

Objetivo:

- fechar a migração do CQ com evidência de validação, pendências explícitas e risco residual controlado.

Status oficial da fase:

- concluída em 2026-04-04;
- suíte completa de 106 testes executada com 0 falhas;
- `HematologyControllerTest` criado para fechar a lacuna de cobertura HTTP da CQ-09;
- matriz de evidências produzida cobrindo todos os submódulos;
- veredito de domínio: APROVADO_COM_RESSALVAS.

Arquivos prováveis afetados:

- `biodiagnostico-api/src/test/java/com/biodiagnostico/service/QcServiceTest.java`
- `biodiagnostico-api/src/test/java/com/biodiagnostico/service/WestgardEngineTest.java`
- `biodiagnostico-api/src/test/java/com/biodiagnostico/controller/QcRecordControllerTest.java`
- `PLANS.md`

Arquivos efetivamente afetados:

- `biodiagnostico-api/src/test/java/com/biodiagnostico/controller/HematologyControllerTest.java` (criado)
- `PLANS.md`

Riscos:

- regressões atravessarem a sprint por falta de validação integrada;
- área crítica ser considerada pronta sem matriz mínima de evidências.

Critérios de aceite:

- regressão essencial do CQ executada e registrada;
- pendências remanescentes classificadas por impacto;
- release readiness do módulo fica explícita como pronta, pronta com ressalvas ou bloqueada.

Validação obrigatória:

- `qa_engineer`: produz findings finais e matriz de lacunas restantes;
- `domain_auditor`: emite veredito final sobre segurança lógica do módulo.

Evidência de conclusão:

- 106 testes executados, 0 falhas, BUILD SUCCESS;
- cobertura de testes por módulo: WestgardEngine (13), QcService (24), QcRecordController (7), QcReferenceService (6), PostCalibrationService (4), AreaQcService (4), AreaQcController (3), HematologyQcService (11), HematologyController (5), ReportController (3), AuthService (8), AuthController (7), ReagentService (6), QcRecordRepository (2), SupabaseConfig (3);
- build do frontend verificado sem erros;
- todas as fases CQ-01 a CQ-10 revisadas com evidência registrada no PLANS.md.

Release readiness do módulo de CQ:

- **PRONTO_COM_RESSALVAS**

Ressalvas:

- suíte de testes de frontend inexistente — limitação estrutural do projeto, não introduzida nesta sprint;
- `PdfReportService` sem teste unitário próprio — risco de LazyInitializationException em caso de mudança futura no fetch mode;
- `HematologyBioRecord` retorna entidade direta sem DTO — sem drift contratual, mas fora do padrão DTO das demais medições;
- dashboard global mostra apenas KPIs de bioquímica — requer feature nova pós-migração;
- gráficos Levey-Jennings disponíveis apenas para bioquímica — requer feature nova pós-migração.

Pendências pós-módulo (classificadas):

- P2: adicionar suíte de testes frontend (vitest/jest) quando infraestrutura permitir;
- P2: teste unitário para `PdfReportService` com mock de lazy loading;
- P3: DTO para `HematologyBioRecord` (sem urgência — sem drift contratual);
- P3: dashboard multi-área (feature nova, pós-migração);
- P3: Levey-Jennings para hematologia e áreas (feature nova, pós-migração).

## Fase 4 — Módulos adjacentes e rastreabilidade

Status oficial da fase: concluída em 2026-04-04.

### Módulos implementados

#### Módulo 4.1 — Reagentes e lotes

Status: PRONTO_COM_RESSALVAS

Implementação:

- `StockMovementResponse` DTO criado; todos os endpoints retornam DTOs (não mais entidade JPA)
- Validação de estoque negativo em SAIDA; validação de AJUSTE >= 0
- Validação de exclusão de movimentação (impede estoque negativo por reversão)
- Auto-vencimento lazy on-read no service
- UniqueConstraint composta (lotNumber + manufacturer)
- Campo `nearExpiry` no ReagentLotResponse
- Filtragem via JPQL (eliminado filtro em memória)
- Novo endpoint GET /api/reagents/by-lot-number (lookup informativo)
- Frontend: modo edição de lotes, badge visual nearExpiry, reset de form
- 20 testes (16 unitários + 4 integração controller)

Decisão arquitetural: QcRecord.lotNumber permanece STRING LIVRE sem FK para reagent_lots (decisão aditiva, preserva invariantes CQ-01 a CQ-11).

Ressalvas:

- Rastreabilidade QcRecord <-> ReagentLot é textual (risco operacional aceito)
- Reagente vencido não bloqueia uso em CQ
- UniqueConstraint ineficaz com manufacturer NULL (PostgreSQL trata NULLs como distintos)
- Auto-vencimento como side-effect em GET

Veredito domain-auditor: APROVADO_COM_RESSALVAS

#### Módulo 4.2 — Manutenção

Status: PRONTO_COM_RESSALVAS

Implementação:

- `MaintenanceResponse` DTO criado; todos os endpoints retornam DTOs
- DashboardAlertsResponse atualizado para MaintenanceResponse
- Validação nextDate > date no service
- Frontend: modo edição e exclusão (com confirmação) nos registros
- 11 testes unitários

Ressalvas:

- Feedback de validação de nextDate no frontend pendente (erro genérico no catch)

#### Módulo 4.3 — Dashboard geral

Status: PRONTO_COM_RESSALVAS

Implementação:

- Limite defensivo no parâmetro limit (max 50)
- Unbox defensivo de calculateApprovalRate (previne NPE)
- 4 testes unitários para DashboardService

Ressalvas:

- Dashboard global mostra apenas KPIs de bioquímica (hematologia/áreas ausentes — feature nova)
- DashboardTab recalcula approvalRate client-side (pode divergir do backend)
- getAlertsCount e getAlerts executam queries duplicadas (otimização futura)

#### Módulo 4.4 — Relatórios PDF

Status: PRONTO_COM_RESSALVAS

Implementação:

- Validação de month (1-12) e year (2000-2100) no ReportController
- PdfReportService inclui rastreabilidade de parâmetro em hematologia e áreas

Ressalvas:

- PdfReportService usa findAll + filtro em memória (performance com base grande)
- Sem teste unitário para geração real de PDF
- RelatoriosTab sem estado de loading no botão

#### Módulo 4.5 — Importação

Status: PRONTO_COM_RESSALVAS

Implementação:

- Texto de drag-and-drop corrigido (funcionalidade não implementada, texto ajustado)
- Batch endpoint funcional com limite de 1000 registros

Ressalvas:

- @Valid em List não cascata validação individual (validação coberta pelo service)
- Batch falha atômica sem listar todas as falhas individuais
- cvLimit default 10 aplicado silenciosamente

### Evidência de validação da Fase 4

- Backend: 135 testes, 0 falhas, BUILD SUCCESS
- Frontend: TypeScript 0 erros, Vite build sem warnings
- Pipeline multiagente cumprido para módulos 4.1 e 4.2 (context → architect → backend → frontend → QA → domain-auditor → release)
- Revisão consolidada de QA para módulos 4.3, 4.4 e 4.5

## Fase 5 — Endurecimento e liberação

Status oficial da fase: concluída em 2026-04-04.

### Objetivo

Fechar a migração dos módulos adjacentes com evidência de regressão, pendências explícitas e risco residual controlado.

### Regressão final

- 135 testes backend executados, 0 falhas, 0 erros
- Build frontend sem erros de TypeScript nem warnings de Vite
- Nenhuma regressão detectada nas fases CQ-01 a CQ-11

### Cobertura de testes por módulo (estado final)

| Classe de teste | Testes |
|---|---|
| WestgardEngineTest | 13 |
| QcServiceTest | 24 |
| QcRecordControllerTest | 7 |
| QcReferenceServiceTest | 6 |
| PostCalibrationServiceTest | 4 |
| AreaQcServiceTest | 4 |
| AreaQcControllerTest | 3 |
| HematologyQcServiceTest | 11 |
| HematologyControllerTest | 5 |
| ReportControllerTest | 3 |
| AuthServiceTest | 8 |
| AuthControllerTest | 7 |
| ReagentServiceTest | 16 |
| ReagentControllerTest | 4 |
| MaintenanceServiceTest | 11 |
| DashboardServiceTest | 4 |
| QcRecordRepositoryTest | 2 |
| SupabaseDatabaseSettingsTest | 3 |
| PdfReportServiceTest | 4 |
| **TOTAL** | **139** |

### Pendências resolvidas após Fase 5

Todas as pendências P1, P2 e P3 foram endereçadas em 2026-04-04:

P1 — antes de produção (RESOLVIDAS):

- ✅ PdfReportService refatorado com queries JPQL parametrizadas (eliminado findAll + filtro em memória)
- ✅ DashboardTab agora consome KPIs do backend via `/dashboard/kpis?area=X` (eliminado cálculo client-side)
- ✅ PdfReportServiceTest criado com 4 testes unitários

P2 — curto prazo (RESOLVIDAS):

- ✅ HematologyBioRecordResponse DTO criado; controller atualizado
- ✅ Dashboard multi-área: endpoint `/dashboard/kpis` aceita parâmetro `area` opcional
- ⏳ Levey-Jennings para hematologia e áreas: documentado como feature futura (requer design próprio)
- ✅ Partial index `idx_reagent_lot_manufacturer` criado via COALESCE no startup
- ✅ ReagentExpiryScheduler: job @Scheduled diário às 1h marca lotes vencidos
- ⏳ Suíte de testes frontend (vitest): pendente — requer configuração de infraestrutura
- ⏳ Migrations versionadas (Flyway/Liquibase): pendente — requer decisão de governança de deploy

P3 — melhoria contínua (RESOLVIDAS):

- ✅ Drag-and-drop real no ImportarTab com estado visual
- ✅ Loading state no botão de gerar PDF do RelatoriosTab
- ✅ Validação de nextDate no frontend de Manutenção com toast informativo
- ✅ Batch import refatorado para coletar todas as falhas antes de lançar exceção

### Pendências remanescentes (pós-resolução)

P2 — ainda pendentes:

- Suíte de testes frontend (vitest/jest) — requer configuração de infraestrutura
- Levey-Jennings para hematologia e áreas — feature nova, requer design
- Migrations versionadas (Flyway/Liquibase) — requer decisão de governança

### Release readiness

**PRONTO**

A migração dos módulos adjacentes e de CQ está completa com:
- 139 testes backend, 0 falhas
- Build frontend sem erros
- Todas as pendências P1 resolvidas
- Maioria das P2 e P3 resolvidas
- Nenhuma regressão no módulo de CQ (invariantes CQ-01 a CQ-11 preservados)
- Dashboard multi-área funcional
- PdfReportService com queries parametrizadas
- Auto-vencimento de lotes via scheduler + fallback lazy
- Partial index para unicidade de reagentes
- Batch import com feedback completo de erros
- Drag-and-drop, loading states e validações de UX implementados

As 3 pendências remanescentes (testes frontend, Levey-Jennings multi-área, Flyway) são de infraestrutura ou feature nova, não de corretude funcional.

## Modelo operacional do mês de sprint

Cada unidade de trabalho da sprint deve seguir este trilho:

1. mapear módulo ou problema;
2. congelar contexto mínimo;
3. decidir arquitetura quando aplicável;
4. implementar em escopo estreito;
5. revisar regressão;
6. auditar domínio quando for crítico;
7. fechar com release.

Meta operacional:

- evitar tarefas grandes demais;
- manter contratos estáveis enquanto backend e frontend trabalham;
- reduzir retrabalho por ambiguidade;
- acumular evidência de validação continuamente, e não só no final do mês.

## Pacotes padrão de trabalho

### Pacote A — Mapeamento de módulo

Quando usar:

- descoberta inicial;
- módulo com ambiguidade;
- preparação antes de fase relevante da migração.

Saída esperada:

- pacote de contexto;
- fonte de verdade;
- lacunas;
- risco inicial;
- recomendação de próxima etapa.

### Pacote B — Implementação de fase

Quando usar:

- evolução de backend ou frontend;
- fechamento de fatia funcional com contrato claro.

Saída esperada:

- nota arquitetural quando aplicável;
- implementação em escopo definido;
- validações executadas;
- revisão de QA;
- auditoria de domínio se crítica.

### Pacote C — Revisão de regressão

Quando usar:

- antes de merge importante;
- após refactor;
- após mudança em fluxos de CQ.

Saída esperada:

- findings priorizados;
- testes faltantes;
- riscos residuais;
- condição de avanço.

### Pacote D — Auditoria de regra crítica

Quando usar:

- mudança em Westgard;
- referência, lote, histórico, CV, média, desvio padrão;
- aprovação, reprovação, calibração ou pós-calibração.

Saída esperada:

- invariantes;
- cenários verificados;
- divergências;
- veredito.

### Pacote E — Preparação de entrega

Quando usar:

- fechamento de módulo;
- fechamento de fase;
- consolidação da sprint.

Saída esperada:

- evidências de validação;
- pendências abertas;
- risco residual;
- readiness final.

## Fases iniciais

### Fase 0 — Governança da migração

Objetivo:

- consolidar fluxo multiagente;
- padronizar handoffs;
- deixar critérios de aprovação explícitos.

Saídas mínimas:

- `AGENTS.md`
- `.codex/config.toml`
- `.codex/agents/*.toml`
- `.codex/skills/lab_migration/SKILL.md`

Critério de aceite:

- pipeline obrigatório documentado;
- papéis sem sobreposição desnecessária;
- validação de domínio obrigatória para regras laboratoriais.

### Fase 1 — Mapeamento de paridade funcional

Objetivo:

- mapear regra por regra do domínio crítico entre legado, documentação de transição e implementação Java/React.

Foco:

- Westgard
- cálculo e uso de média, desvio padrão e CV
- referência por exame, nível, lote e validade
- histórico por data e por lote
- decisão de calibração e pós-calibração

Critério de aceite:

- matriz de paridade por módulo crítico;
- lacunas e ambiguidades registradas;
- nenhuma implementação crítica sem origem rastreável.

### Fase 2 — Backend CQ de produção

Objetivo:

- estabilizar o backend Java como fonte principal do comportamento de CQ.

Foco inicial:

- `WestgardEngine`
- `QcService`
- `QcReferenceService`
- `PostCalibrationService`
- `AreaQcService`
- `HematologyQcService`

Critério de aceite:

- contratos claros entre entidades, DTOs, serviços e controladores;
- validações explícitas para entradas inválidas;
- testes relevantes cobrindo happy path e edge cases críticos.

### Fase 3 — Frontend React com paridade operacional

Objetivo:

- refletir fielmente as regras já aprovadas no backend, sem criar lógica paralela.

Foco inicial:

- `AreaQcModule`
- `ReferenciasTab`
- `RegistroTab`
- `ReagentesTab`
- `LeveyJenningsChart`
- hooks e services de CQ

Critério de aceite:

- formulários e estados aderentes aos contratos da API;
- mensagens de erro e status coerentes com a operação;
- zero invenção de regra de negócio no frontend.

### Fase 4 — Módulos adjacentes e rastreabilidade

Objetivo:

- fechar áreas que sustentam a operação do laboratório e a auditabilidade da entrega.

Foco:

- reagentes e lotes
- manutenção
- relatórios PDF
- dashboard
- importação
- voz e IA somente após estabilização do core

Critério de aceite:

- rastreabilidade consistente entre dados, relatórios e tela;
- riscos operacionais conhecidos documentados.

### Fase 5 — Endurecimento e liberação

Objetivo:

- preparar entrega segura para uso real.

Foco:

- build e testes relevantes
- checagem de regressão funcional
- revisão de riscos residuais
- readiness de release

Critério de aceite:

- `release_engineer` aprova com evidências;
- pendências remanescentes classificadas;
- plano de acompanhamento pós-entrega definido.

### Fase 6 — Infraestrutura: Supabase + Railway

Objetivo:

- configurar o ambiente de produção do sistema migrado.

Decisão operacional consolidada em 2026-04-09:

- o deploy de produção do `biodiagnostico-api` e do `biodiagnostico-web` fica padronizado em **Railway-only**;
- referências anteriores a Vercel no material de transição passam a ser consideradas históricas e não operacionais;
- a fonte de verdade para entrada em produção continua sendo esta fase, complementada pelos artefatos operacionais atualizados no repositório.

Foco:

- Supabase: banco PostgreSQL, migração do schema, RLS, autenticação se aplicável
- Railway: deploy do `biodiagnostico-api` (Spring Boot) e do `biodiagnostico-web` (React)
- variáveis de ambiente e secrets
- conexão backend → Supabase
- CI/CD básico (deploy automático ou manual controlado)
- smoke test em ambiente real

Critério de aceite:

- schema do banco rodando no Supabase sem divergência com o local;
- backend respondendo no Railway com conexão ao Supabase;
- frontend acessível e consumindo a API em produção;
- fluxo crítico de CQ funcional end-to-end no ambiente real.

## Riscos já conhecidos que exigem atenção contínua

- regra de negócio distribuída entre código e banco legado;
- risco de divergência entre cálculo de CV e status e o comportamento esperado;
- dependência de histórico para Westgard e decisões de aprovação;
- tratamento inconsistente de deleção, batch e validações em fluxos de CQ;
- ambiguidade entre referência ativa, validade temporal e lote;
- possibilidade de frontend descolar do contrato backend durante a migração.

## Critérios de aceite transversais

Toda mudança crítica deve ter:

- contexto confirmado;
- regra impactada explicitada;
- validação funcional;
- revisão de QA;
- auditoria de domínio quando aplicável;
- fechamento do release.

## Estrutura para evolução futura

Ao atualizar este plano, registrar por fase:

- status: `não iniciado`, `em andamento`, `bloqueado`, `concluído`;
- pacote de trabalho usado;
- módulo alvo;
- evidência de validação;
- risco residual;
- próximo gate obrigatório.

## Sprint A–E (2026-04-16) — Sessao, Registro, Referencias, Manutencao, Reagentes F1/F2/F3, Relatorios V2, Importar V2

Status: **CONCLUIDO_COM_RESSALVAS** — auditor de dominio aprovou com ressalvas P0/P1/P2 registradas abaixo.

Entregas principais:
- Util `parseLocalDate` resolvendo bug de timezone em graficos e cards (Sprint A).
- Sessao JWT 60 min + refresh proativo em 80% do lifetime + single-flight no interceptor (Sprint A).
- Combobox reutilizavel + uso em Referencias e Manutencao; hiperlink de historico do exame em Registro (Sprint A/B).
- Manutencao V2: KPIs, filtros, Combobox equipamento/tecnico, undo delete, historico por equipamento (Sprint B).
- Reagentes F1 (UX): bloco "Acao hoje", filtros profissionais, ordenacao por urgencia, marcacao visual de rastreabilidade (Sprint C).
- Reagentes F2 (Contrato): enums canonicos `ReagentStatus`/`MovementType`/`MovementReason`, `manufacturer`+`expiryDate`+`responsible` obrigatorios, `reason` obrigatorio em AJUSTE e SAIDA que zera estoque, `previousStock` gravado em TODOS os movimentos, `updateLot` reverifica unicidade antes de salvar (Sprint C). Migrations V4 + Flyway.
- Reagentes F3 (Rastreabilidade forte): `location`, `supplier`, `receivedDate`, `openedDate` + flag derivada `usedInQcRecently` cruzando `qc_records` por janela de 30 dias (Sprint C). Migration V5.
- Relatorios V2: entity `ReportRun`, endpoint `/api/reports/history`, feedback detalhado de geracao (tamanho/duracao), tabela de historico no frontend (Sprint D). Migration V6.
- Importar V2: endpoint `/api/qc-records/batch-v2?mode=partial|atomic`, `BatchImportResult` linha-a-linha com `TransactionTemplate REQUIRES_NEW` por linha, entity `ImportRun` com estado `SUCCESS/PARTIAL/FAILURE`, template XLSX canonico no frontend, historico tabular (Sprint D). Migration V6.
- Setup `vitest` + `jsdom` + `@testing-library/react`; testes iniciais de `utils/date` (12) e `Combobox` (5) — 17 testes frontend passando (Sprint E).

Validacoes executadas:
- `./mvnw test` → **167 tests, 0 failures** (backend).
- `npm test` (vitest) → **17 tests, 0 failures** (frontend).
- `npm run build` → **BUILD SUCCESS** (frontend).
- `npx tsc --noEmit` → 0 erros.
- Smoke no preview: Login, Dashboard, Reagentes, Manutencao, Registro, Referencias, Relatorios, Importar → sem erros de console.

### Ressalvas do domain-auditor (pendentes para fase futura)

**P0-1 — RESOLVIDO** Match Reagente<->CQ: `QcRecord.lotNumber` nao carrega `manufacturer`, entao dois lotes com mesmo `lotNumber` e fabricantes distintos colidiam. Politica conservadora adotada em `ReagentService.getLots` (`lotNumbersWithCollision`): **quando ha colisao de `lotNumber` entre fabricantes, a flag `usedInQcRecently` fica false para ambos** para evitar falso positivo. Teste cobre o cenario (`ReagentServiceTest.usedInQcRecentlyConservadorQuandoColide`). Solucao definitiva (adicionar `manufacturer` a `qc_records`) fica para fase futura com migration e retrofit dos dados historicos.

**P1-2 — REGISTRADO** Divergencia Westgard entre modos ATOMIC e PARTIAL: em PARTIAL cada linha roda em transacao propria (REQUIRES_NEW), portanto `loadWestgardHistory` da linha N ja enxerga as linhas 1..N-1 commitadas; em ATOMIC todas rodam no mesmo snapshot inicial. **Mesma planilha pode produzir status diferentes entre modos**. Decisao registrada aqui: **PARTIAL e a fonte de verdade preferida** porque reproduz o comportamento de imports sequenciais reais (a decisao Westgard deve considerar o historico crescente). Frontend documenta isso no Select de modo. Teste comparativo entra no proximo sprint de cobertura.

**P1-3 — REGISTRADO** Janela `QC_ACTIVE_WINDOW_DAYS=30` em `ReagentService`: **constante fixa por ora**. Decisao registrada aqui — proximo sprint externaliza em `application.yml` como `reagents.qc-active-window-days` e documenta no frontend.

**P1-4 — REGISTRADO** Reversao de movimentos: `AJUSTE` usa `previousStock` (determinista); `ENTRADA/SAIDA` usam delta (pode driftar com movimentos intercalados). **Desde a Fase 2, `previousStock` e gravado em todos os movimentos**, mas a logica de `deleteMovement` ainda nao consome esse valor para `ENTRADA/SAIDA`. Decisao registrada: manter delta por ora (comportamento legado ja testado) e migrar para `previousStock` em proximo sprint com ADR + testes de drift.

**P2-5 — REGISTRADO** Semantica de `updateLot`: null sobrescreve `location/supplier/receivedDate/openedDate`. Frontend sempre envia o form inteiro, entao nao ha PATCH parcial hoje. Decisao registrada: **se for necessario PATCH no futuro, criar endpoint dedicado** — manter PUT puro no `updateLot` atual.

**P2-6 — REGISTRADO** `report_runs`/`import_runs` sem FK para `users`: decisao consciente (tabelas append-only de auditoria, que devem sobreviver a delete de usuario). `username` e `user_id` sao guardados como snapshots.

**P2-7 — RESOLVIDO** Obrigatoriedade de `reason` validada tambem no frontend (`ReagentesTab.handleMovement`), espelhando a regra do backend.

### Proximos gates obrigatorios

- **Fase 3.1 Reagentes** — resolver P0-1 em definitivo (adicionar `manufacturer` em `qc_records`).
- **Sprint F** — cobertura de testes frontend expandida (ManutencaoTab, ReagentesTab F3, ImportarTab) + fix P1-4 com ADR.
- **Release** — tag de versao + deploy em homologacao.
