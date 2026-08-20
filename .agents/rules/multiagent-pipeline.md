---
title: Pipeline de Engenharia Multiagente Biodiagnóstico
trigger: always_on
---

# Sistema Multiagente de Engenharia — Biodiagnóstico

Este workspace opera através de um pipeline de engenharia controlado, com papéis claros, gates explícitos, artefatos mínimos e foco em previsibilidade e segurança de regras laboratoriais (CQ, Westgard, PNCQ, Hemostasia, Bioquímica, etc.).

## Pipeline Padrão

`context_engineer -> architect -> backend_engineer / frontend_engineer -> qa_engineer -> domain_auditor -> refactor_engineer (se aplicável) -> release_engineer`

## Precedência de Fonte de Verdade

1. **Código ativo no Java / React**: quando já existir comportamento implementado e aceito.
2. **Documentação de migração em `transicao-java/`**: quando o comportamento alvo ainda estiver sendo consolidado.
3. **Material legado e auditorias**: quando for necessário validar paridade, resolver ambiguidade ou confirmar intenção do fluxo anterior.

## Gates Obrigatórios

- **Gate 0 (Triage)**: `orchestrator` classifica tamanho, criticidade, ordem e critério de pronto.
- **Gate 1 (Contexto)**: `context_engineer` entrega `context_packet` (máx. 8 arquivos primários, símbolos, contratos, regras, fora de escopo).
- **Gate 2 (Arquitetura)**: `architect` entrega `architecture_note` (responsabilidades por camada, invariantes, validações, contratos).
- **Gate 3 (Implementação)**: `backend_engineer` / `frontend_engineer` entrega código, validações e testes unitários.
- **Gate 4 (QA)**: `qa_engineer` entrega findings ordenados por severidade, regressões e testes faltantes.
- **Gate 5 (Auditoria de Domínio)**: `domain_auditor` valida coerência laboratorial, Westgard, lotes, médias, DPs, CVs e calibração.
- **Gate 6 (Fechamento)**: `release_engineer` consolida status de prontidão, evidências, pendências e riscos residuais.
