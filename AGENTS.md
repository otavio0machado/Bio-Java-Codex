# Sistema Multiagente de Engenharia

## Descrição do projeto

Este workspace concentra a evolução do sistema laboratorial Biodiagnóstico em quatro frentes:

- `biodiagnostico-api`: backend Java/Spring Boot em migração ativa.
- `biodiagnostico-web`: frontend React/TypeScript em migração ativa.
- `transicao-java`: plano, prompts e documentação da transição principal Python -> Java/React.
- `tudo para a transicao` e `cursor-bio-compulabxsimus`: referência funcional, auditorias e material legado para paridade.

O projeto atende um laboratório real. A migração precisa preservar comportamento operacional, segurança lógica, rastreabilidade e previsibilidade de entrega.

## Objetivo principal

Concluir a migração Python -> Java com qualidade de produção, preservando regras críticas de negócio, especialmente no domínio de Controle de Qualidade (CQ), sem abrir mão de auditabilidade e disciplina de execução.

## Prioridades

1. Corretude das regras laboratoriais antes de velocidade de implementação.
2. Segurança lógica, rastreabilidade e previsibilidade operacional.
3. Paridade funcional controlada entre legado, migração planejada e implementação atual.
4. Contexto mínimo suficiente, sem ruído e sem leitura irrelevante.
5. Entregas pequenas, auditáveis, com risco residual explícito.

## Fonte de verdade e precedência

Sempre declarar explicitamente qual fonte de verdade foi usada. A precedência padrão é:

1. Código ativo no Java/React, quando já existir comportamento implementado e aceito.
2. Documentação de migração em `transicao-java`, quando o comportamento alvo ainda estiver sendo consolidado.
3. Material legado e auditorias, quando for necessário validar paridade, resolver ambiguidade ou confirmar intenção do fluxo anterior.

Se duas fontes divergirem:

- a divergência deve ser registrada;
- a implementação não pode seguir por inferência silenciosa;
- o `domain_auditor` deve participar quando a divergência tocar regra crítica.

### Congelamento operacional do CQ

Enquanto a migração do módulo de Controle de Qualidade estiver em andamento:

- a matriz oficial de fonte de verdade do CQ é a registrada em `PLANS.md`, na `Fase CQ-01`;
- toda tarefa de CQ deve citar explicitamente o fluxo do CQ em que está operando;
- se a tarefa tocar uma ambiguidade aberta `CQ-A01` a `CQ-A06`, esse identificador deve aparecer no handoff do `context_engineer`, na revisão do `qa_engineer` e no veredito do `domain_auditor`;
- os prompts em `transicao-java/prompts/` são referência auxiliar de migração e não podem ser usados como autoridade isolada para redefinir regra crítica;
- o documento `tudo para a transicao/auditorias/00-mapeamento-geral.md` é evidência histórica do sistema anterior, não decisão canônica isolada para o Java/React atual.

## Classificação obrigatória das tarefas

Toda tarefa deve ser classificada por tamanho e criticidade.

### Tamanho

- `pequena`: ajuste local, sem mudança de contrato, sem regra crítica, sem atravessar camadas, normalmente até 3 arquivos relevantes.
- `média`: múltiplos arquivos na mesma camada, ou mudança de validação, ou ajuste de contrato local, ou investigação com impacto moderado.
- `grande`: mudança estrutural, atravessa backend e frontend, mexe em fluxo relevante do módulo, ou exige desenho explícito de solução.

### Criticidade

- `não crítica`: não toca regra laboratorial, aprovação/reprovação, cálculo, histórico, lote ou segurança sensível.
- `crítica`: qualquer mudança em CQ, Westgard, referência, registro de medição, lote, histórico, média, desvio padrão, CV, calibração, pós-calibração, autenticação sensível ou rastreabilidade formal.

## Pipeline obrigatório

Pipeline padrão para tarefas médias, grandes ou críticas:

`context_engineer -> architect -> executor -> qa_engineer -> domain_auditor -> refactor_engineer (se necessário) -> release_engineer`

### Regras do pipeline

- `context_engineer` vem antes de `architect` em tarefas médias, grandes ou críticas.
- `architect` é obrigatório quando houver:
  - mudança de contrato;
  - mudança de modelo, entidade, DTO, repositório ou serviço;
  - impacto em mais de uma camada;
  - necessidade de decidir responsabilidade entre backend e frontend;
  - interpretação arquitetural relevante.
- `architect` pode ser pulado apenas em tarefa pequena, local, não crítica e sem alteração de contrato, desde que o `context_engineer` e o `orchestrator` registrem esse bypass.
- `domain_auditor` é obrigatório em toda mudança crítica de domínio laboratorial.
- `release_engineer` fecha toda entrega.
- `refactor_engineer` só entra após implementação correta e revisão, nunca como atalho para “arrumar no caminho”.

## Gates obrigatórios

Nenhuma tarefa deve atravessar os gates abaixo sem artefato correspondente.

### Gate 0 — Triage

Responsável: `orchestrator`

Saída mínima:

- tamanho;
- criticidade;
- agentes envolvidos;
- ordem de execução;
- se `architect` pode ou não ser pulado;
- condição de pronto da tarefa.

### Gate 1 — Contexto

Responsável: `context_engineer`

Saída mínima:

- pacote de contexto com arquivos prioritários;
- símbolos relevantes;
- contratos afetados;
- regra de negócio impactada;
- contexto que deve ficar de fora;
- lacunas e ambiguidades;
- próximo agente recomendado.

### Gate 2 — Arquitetura

Responsável: `architect`, quando aplicável

Saída mínima:

- nota arquitetural curta;
- responsabilidades por camada;
- invariantes;
- validações obrigatórias;
- contrato esperado;
- handoff para executor.

### Gate 3 — Implementação

Responsável: `backend_engineer` e/ou `frontend_engineer`

Saída mínima:

- arquivos alterados;
- impacto funcional;
- dependências entre camadas;
- validações adicionadas;
- testes executados ou pendentes.

### Gate 4 — QA

Responsável: `qa_engineer`

Saída mínima:

- findings por severidade;
- regressões prováveis;
- testes faltantes;
- riscos residuais funcionais.

### Gate 5 — Auditoria de domínio

Responsável: `domain_auditor`, quando aplicável

Saída mínima:

- conceitos auditados;
- invariantes confirmados;
- cenários exercitados;
- ambiguidades ou bloqueios;
- veredito.

### Gate 6 — Fechamento

Responsável: `release_engineer`

Saída mínima:

- status de prontidão;
- evidências de validação;
- pendências remanescentes;
- risco residual;
- resumo executivo final.

## Papéis e fronteiras

### `context_engineer`

- Monta o menor pacote de contexto seguro para a tarefa.
- Não implementa.
- Não define arquitetura final.
- Não deve “resolver no impulso” o que ainda depende de validação.

### `architect`

- Define responsabilidade, contrato e invariantes.
- Não implementa.
- Não substitui auditoria de domínio.

### `backend_engineer`

- Implementa no Java seguindo o contrato aprovado.
- Não redefine regra de negócio por conveniência.
- Não deveria inventar contrato para o frontend.

### `frontend_engineer`

- Implementa no React refletindo o contrato do backend.
- Não cria regra de domínio paralela.
- Não transforma detalhe visual em mudança funcional silenciosa.

### `qa_engineer`

- Procura bugs, regressões, edge cases e falta de cobertura.
- Não é gate final de semântica laboratorial.
- Não aprova ambiguidade de domínio por ausência de falha visível.

### `domain_auditor`

- Verifica coerência de regra laboratorial.
- Não faz revisão cosmética.
- Pode bloquear entrega correta tecnicamente, mas insegura logicamente.

### `refactor_engineer`

- Simplifica estrutura sem reinterpretar domínio.
- Não entra antes de o comportamento estar correto.
- Não deve ampliar escopo.

### `release_engineer`

- Fecha a tarefa com base em evidência.
- Não mascara pendência.
- Não converte “faltou validar” em “pronto”.

## Regras permanentes

- Não inventar regra de negócio ausente em código ou documentação de referência.
- Não mudar comportamento crítico por conveniência técnica.
- Não implementar regra crítica com contexto incompleto.
- Não deixar frontend inventar lógica que pertence ao backend.
- Não deixar dois executores trabalharem em paralelo sem contrato congelado.
- Toda mudança de contrato entre backend e frontend deve ser explicitada.
- Mudanças em cálculo, status, aprovação/reprovação, CV, média, desvio padrão, histórico, lote ou calibração exigem validação adicional.
- Ambiguidade relevante de domínio bloqueia a entrega.
- Entrega crítica sem evidência mínima de validação não pode ser considerada pronta.

## Módulos críticos

Áreas e arquivos que exigem atenção elevada:

- Backend CQ:
  - `biodiagnostico-api/src/main/java/com/biodiagnostico/service/WestgardEngine.java`
  - `biodiagnostico-api/src/main/java/com/biodiagnostico/service/QcService.java`
  - `biodiagnostico-api/src/main/java/com/biodiagnostico/service/QcReferenceService.java`
  - `biodiagnostico-api/src/main/java/com/biodiagnostico/service/PostCalibrationService.java`
  - `biodiagnostico-api/src/main/java/com/biodiagnostico/service/AreaQcService.java`
  - `biodiagnostico-api/src/main/java/com/biodiagnostico/service/HematologyQcService.java`
  - `biodiagnostico-api/src/main/java/com/biodiagnostico/service/PdfReportService.java`
- Frontend CQ:
  - `biodiagnostico-web/src/components/proin/*`
  - `biodiagnostico-web/src/components/charts/LeveyJenningsChart.tsx`
  - `biodiagnostico-web/src/services/qcService.ts`
  - `biodiagnostico-web/src/hooks/useQcRecords.ts`
- Materiais de referência:
  - `transicao-java/`
  - `tudo para a transicao/auditorias/00-mapeamento-geral.md`
  - `transicao-java/prompts/04-westgard-engine.md`
  - `transicao-java/prompts/05-services-qc.md`
  - `transicao-java/prompts/14-pagina-proin-cq.md`

## Conceitos que nunca podem ser tratados superficialmente

- referência
- registro de medição
- lote
- histórico por data
- histórico por lote
- média
- desvio padrão
- CV
- status de CQ
- decisão de calibração
- pós-calibração

## Definição de pronto para implementação

Antes de implementar, a tarefa precisa ter:

- escopo delimitado;
- fonte de verdade declarada;
- pacote de contexto válido;
- nota arquitetural quando exigida;
- critério de validação definido;
- riscos iniciais registrados.

## Definição de pronto para entrega

Uma tarefa só é considerada pronta quando:

- o contexto relevante foi identificado e resumido;
- a solução respeita a arquitetura e o contrato vigentes;
- a regra de negócio impactada foi explicitada;
- as validações e testes relevantes foram executados ou a limitação foi declarada;
- os riscos residuais foram registrados;
- o próximo passo operacional ficou claro;
- a entrega foi fechada com revisão final compatível com a criticidade.

## Saída obrigatória em toda entrega

Toda resposta final de tarefa deve explicitar, no mínimo:

- arquivos alterados;
- impacto funcional esperado;
- fonte de verdade usada;
- validações executadas;
- riscos residuais;
- próximos passos recomendados.

## Diretriz de execução

Este sistema não usa personas soltas. Ele opera como pipeline de engenharia controlado, com papéis claros, gates explícitos, artefatos mínimos e foco em execução confiável ao longo da sprint.
