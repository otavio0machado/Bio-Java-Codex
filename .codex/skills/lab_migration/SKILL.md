---
name: lab-migration
description: Fluxo multiagente para migracao Python -> Java/React no Biodiagnostico, com foco em CQ laboratorial, regras criticas, contexto minimo, handoffs disciplinados e validacao forte de dominio.
---

# Lab Migration

## Quando usar

Use esta skill em qualquer tarefa ligada a:

- migração Python -> Java no `biodiagnostico-api`;
- migração ou alinhamento React no `biodiagnostico-web`;
- paridade funcional com `transicao-java` ou com o legado;
- CQ laboratorial, Westgard, referência, medição, lote, histórico, média, desvio padrão, CV, calibração e pós-calibração;
- revisão de regressão funcional;
- auditoria de regra crítica;
- preparação de entrega de módulo ou fase.

## O que esta skill cobre

- classificação da demanda;
- seleção de contexto mínimo;
- decisão de quando chamar `architect`;
- fluxo de implementação por backend e frontend;
- revisão de QA;
- auditoria de domínio;
- fechamento de release.

## Fonte de verdade e precedência

Ao usar esta skill, sempre declarar a fonte de verdade nesta ordem:

1. implementação ativa em Java/React, quando já existir comportamento validado;
2. documentação de migração em `transicao-java`, quando o alvo ainda estiver sendo consolidado;
3. legado e auditorias, quando for necessário provar paridade ou resolver ambiguidade.

Se houver conflito entre fontes, a tarefa não deve seguir por inferência silenciosa.

## Modos de uso

### 1. Mapear módulo

Use quando:

- o módulo ainda está difuso;
- há ambiguidade entre legado, documentação e implementação atual;
- a sprint vai abrir uma frente nova.

Fluxo recomendado:

`orchestrator -> context_engineer -> architect (se necessário)`

Saída mínima:

- pacote de contexto;
- fonte de verdade;
- riscos;
- recomendação de próxima etapa.

### 2. Implementar fase

Use quando:

- a demanda já tem escopo funcional;
- há fatia de backend, frontend ou ambas para entregar.

Fluxo recomendado:

`orchestrator -> context_engineer -> architect (quando aplicável) -> backend_engineer/frontend_engineer -> qa_engineer -> domain_auditor (se crítica) -> release_engineer`

### 3. Revisar regressão

Use quando:

- houve mudança recente em CQ;
- um módulo precisa de checagem antes de merge;
- um refactor terminou.

Fluxo recomendado:

`orchestrator -> context_engineer -> qa_engineer -> domain_auditor (se crítica) -> release_engineer`

### 4. Auditar regra crítica

Use quando:

- a tarefa toca Westgard;
- mexe em referência, histórico, lote, média, desvio padrão, CV, status, calibração ou pós-calibração;
- há dúvida sobre coerência laboratorial.

Fluxo recomendado:

`orchestrator -> context_engineer -> architect (se houver decisão estrutural) -> domain_auditor -> executor -> qa_engineer -> domain_auditor -> release_engineer`

### 5. Preparar entrega

Use quando:

- a fase terminou;
- é preciso consolidar evidências, pendências e readiness.

Fluxo recomendado:

`orchestrator -> qa_engineer -> domain_auditor (se crítica) -> release_engineer`

## Regras obrigatórias

- contexto e regra de negócio vêm antes da implementação;
- nunca implementar lógica crítica com contexto incompleto;
- nunca deixar frontend inventar regra que deveria vir do backend;
- nunca tratar divergência em CV, média, desvio padrão, status, histórico ou calibração como detalhe pequeno;
- toda mudança crítica deve explicitar fonte de verdade, impacto funcional e evidência de validação;
- tarefas pequenas podem pular `architect` apenas quando forem locais, não críticas e sem alteração de contrato.

## Artefatos operacionais

Use os templates e checklists em [references/operational-artifacts.md](references/operational-artifacts.md) quando precisar montar:

- `context_packet`
- `architecture_note`
- `implementation_summary`
- `qa_review`
- `domain_audit_verdict`
- `release_summary`

## Critérios de qualidade

- escopo estreito;
- handoff objetivo;
- contrato explícito;
- validação compatível com o risco;
- risco residual declarado;
- nenhum fechamento crítico sem auditoria de domínio.

## Handoff mínimo esperado

Todo handoff desta skill deve incluir:

- objetivo da tarefa;
- classificação da tarefa;
- fonte de verdade;
- arquivos e símbolos relevantes;
- regra laboratorial impactada, se houver;
- contratos afetados;
- riscos e ambiguidades;
- próximo agente recomendado.
