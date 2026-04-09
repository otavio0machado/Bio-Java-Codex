# Biodiagnostico Lab Migration

## Projeto

Migracao Python -> Java/React de sistema laboratorial real (Biodiagnostico), com foco em Controle de Qualidade (CQ).

## Estrutura

- `biodiagnostico-api/` — Backend Java/Spring Boot
- `biodiagnostico-web/` — Frontend React/TypeScript
- `transicao-java/` — Documentacao de migracao
- `tudo para a transicao/` e `cursor-bio-compulabxsimus/` — Legado e auditorias

## Documentos de governo

- `PLANS.md` — Plano oficial com fases CQ-01 a CQ-11, ambiguidades e fontes de verdade
- `AGENTS.md` — Pipeline multiagente e regras operacionais

## Pipeline multiagente

Eu (conversa principal) opero como `orchestrator`. Os agentes especializados estao em `.claude/agents/`:

```
context-engineer -> architect -> backend-engineer / frontend-engineer -> qa-engineer -> domain-auditor -> release-engineer
```

### Quando usar cada agente

- `context-engineer`: SEMPRE antes de implementar tarefas medias, grandes ou criticas
- `architect`: quando houver mudanca de contrato, entidade, DTO, cross-layer ou regra critica
- `backend-engineer`: implementacao Java no `biodiagnostico-api/`
- `frontend-engineer`: implementacao React no `biodiagnostico-web/`
- `qa-engineer`: apos implementacao, antes de auditoria de dominio
- `domain-auditor`: obrigatorio para qualquer mudanca em CQ, Westgard, referencia, medicao, lote, historico, media, DP, CV, calibracao ou pos-calibracao
- `refactor-engineer`: somente apos funcionalidade correta e revisada
- `release-engineer`: fecha toda entrega

### Regra de paralelismo

Backend e frontend NAO implementam em paralelo sem contrato congelado.

## Fonte de verdade (precedencia)

1. Codigo ativo em Java/React
2. Documentacao de migracao em `transicao-java/`
3. Material legado e auditorias

Se duas fontes divergirem, registrar a divergencia e nao seguir por inferencia silenciosa.

## Comandos de validacao

- Backend: `cd biodiagnostico-api && ./mvnw test`
- Frontend build: `cd biodiagnostico-web && npm run build`

## Conceitos que NUNCA podem ser tratados superficialmente

referencia, registro de medicao, lote, historico, media, desvio padrao, CV, status de CQ, calibracao, pos-calibracao

## Caminhos protegidos (nao modificar)

- `biodiagnostico-web/node_modules/`
- `biodiagnostico-web/dist/`
- `biodiagnostico-api/target/`
- `cursor-bio-compulabxsimus/.git/`
