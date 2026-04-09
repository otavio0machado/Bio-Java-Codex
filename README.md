# Bio Java Codex

Workspace principal da migracao do Biodiagnostico de Python para Java/React, com foco em corretude funcional, rastreabilidade e prontidao de producao para operacao laboratorial real.

## Estrutura

- `biodiagnostico-api`: backend Java/Spring Boot
- `biodiagnostico-web`: frontend React/TypeScript
- `transicao-java`: plano, roadmap e documentacao de migracao
- `tudo para a transicao`: materiais auxiliares e auditorias
- `cursor-bio-compulabxsimus`: referencia funcional e historico legado
- `PLANS.md`: plano oficial de execucao
- `AGENTS.md`: pipeline de engenharia e regras operacionais

## Estado Atual

- modulo de CQ consolidado no plano e tratado como area critica
- estrategia de deploy consolidada em Railway-only para backend e frontend
- banco alvo definido em Supabase

## Fontes de Verdade

Ordem de precedencia do workspace:

1. implementacao ativa em `biodiagnostico-api` e `biodiagnostico-web`
2. documentacao de migracao em `transicao-java`
3. legado e auditorias para prova de paridade e resolucao de ambiguidade

## Como Rodar Localmente

Backend:

```bash
cd biodiagnostico-api
./mvnw spring-boot:run
```

Frontend:

```bash
cd biodiagnostico-web
npm install
npm run dev
```

## Documentos Principais

- [PLANS.md](./PLANS.md)
- [AGENTS.md](./AGENTS.md)
- [Guia de Deploy](./transicao-java/05-DEPLOY.md)
- [Visao Geral da Transicao](./transicao-java/00-VISAO-GERAL.md)

## Observacoes para GitHub

- este workspace inclui material legado e de referencia, nao apenas a aplicacao final
- o diretorio `cursor-bio-compulabxsimus` ainda contem um repositorio Git embutido (`.git` proprio); se voce quiser publicar todo o workspace como um unico repositorio, precisa decidir se vai manter esse diretorio separado, transforma-lo em submodule ou remover o `.git` interno antes do primeiro commit

## Licenca

Uso restrito. Veja [LICENSE.md](./LICENSE.md).
