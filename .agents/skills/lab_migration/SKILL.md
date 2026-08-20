---
name: lab-migration
description: Fluxo multiagente para migração e evolução Python -> Java/React no Biodiagnóstico, com foco em CQ laboratorial, regras críticas, contexto mínimo, handoffs disciplinados e validação forte de domínio.
---

# Lab Migration — Biodiagnóstico

## Quando usar

Use esta skill em qualquer tarefa ligada a:
- migração e expansão de módulos no `biodiagnostico-api` (Java 21 / Spring Boot 3);
- telas e componentes no `biodiagnostico-web` (React / TypeScript / Vite);
- paridade funcional com `transicao-java` ou com o legado;
- CQ laboratorial, Westgard, referência, medição, lote, histórico, média, desvio padrão, CV, calibração e pós-calibração;
- revisão de regressão funcional e auditoria de regras clínicas/laboratoriais;
- preparação e fechamento de entregas de módulos.

## Fonte de Verdade e Precedência

1. **Implementação ativa em Java/React**: quando já existir comportamento validado;
2. **Documentação de migração em `transicao-java/`**: quando o alvo ainda estiver sendo consolidado;
3. **Legado e auditorias**: quando for necessário provar paridade ou resolver ambiguidade.

## Modos de Uso

### 1. Implementar Módulo ou Funcionalidade
`orchestrator -> context_engineer -> architect (se aplicável) -> backend_engineer/frontend_engineer -> qa_engineer -> domain_auditor (se crítica) -> release_engineer`

### 2. Auditar Regra Crítica de CQ
`orchestrator -> context_engineer -> domain_auditor -> executor -> qa_engineer -> domain_auditor -> release_engineer`

### 3. Preparar Entrega e Fechamento
`release_engineer` consolida build, testes, evidências e riscos residuais.
