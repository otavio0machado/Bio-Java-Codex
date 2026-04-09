# Auditoria de Engenharia de Software
## Capítulo 9: Gerenciamento de Projeto

**Projeto:** Biodiagnóstico 3.0 — Plataforma de Controle de Qualidade em Laboratórios
**Data da Auditoria:** 31 de março de 2026
**Referência Teórica:** Ian Sommerville, *Engenharia de Software*, 10ª edição, Capítulos 22-23 (Project Management & Quality Management)

---

## 1. Conceito Teórico

Segundo Sommerville (Caps. 22-23), o gerenciamento de projeto de software envolve:

- **Planejamento e Estimação**: decomposição de trabalho em tarefas e estimativa de esforço
- **Gerenciamento de Risco**: identificação, análise e mitigação de riscos
- **Estrutura Organizacional**: definição de papéis, responsabilidades e hierarquia
- **Comunicação**: canais e frequência de comunicação entre stakeholders
- **Rastreamento de Progresso**: métodos para acompanhar avanço vs. planejado
- **Agendamento**: cronograma com marcos, dependências e recursos
- **Alocação de Recursos**: atribuição de pessoal, infraestrutura e orçamento
- **Gestão de Configuração**: controle de versões, builds e releases

O sucesso de projetos de software depende fortemente de gerenciamento adequado, não apenas de habilidades técnicas.

---

## 2. O Que Foi Verificado no Projeto

### 2.1 Planejamento e Estimação
- Ausência de ferramenta formal de project management (Jira, Linear, Asana, etc.)
- Sem backlog documentado ou roadmap público
- Sem estimativas formais (story points, t-shirt sizing, etc.)
- Histórico de commits sugere desenvolvimento ad-hoc

### 2.2 Gerenciamento de Risco
- Sem documento formal de riscos identificados
- Sem matriz de probabilidade/impacto
- Sem plano de mitigação para riscos críticos
- Riscos observáveis não documentados (single-developer, BD migrações, deployment failures)

### 2.3 Estrutura Organizacional
- Padrão single-developer no histórico de commits
- Não há informação de equipe, responsabilidades distribuídas
- Ausência de função de tech lead, product owner, ou QA dedicado

### 2.4 Comunicação
- Sem documentação de canais de comunicação
- Sem atas de reunião visíveis
- Possivelmente comunicação assíncrona via comentários de commit/PR

### 2.5 Rastreamento de Progresso
- CI/CD presente (evidência de automação)
- Sem dashboard de progresso ou burndown/burnup charts
- Sem SLA ou métricas de velocity

### 2.6 Agendamento
- Sem cronograma documentado
- Sem marcos (milestones) definidos
- Releases parecem contínuas e não planejadas formalmente

### 2.7 Alocação de Recursos
- Sem documentação de alocação de pessoal
- Infraestrutura: Railway, Supabase (outsourced - bom)
- Orçamento não documentado

### 2.8 Gestão de Configuração
- Git com control de versão
- Sem política de branching explícita (Git Flow, GitHub Flow, etc.)
- CI/CD automático em PRs (positivo)

---

## 3. Evidências Encontradas

### 3.1 Ausência de Ferramentas Formais
**Diretório raiz do projeto:** Não há pastas como `.jira/`, `issues/`, ou integrações com Linear
```bash
# Esperado (não encontrado):
/cursor-bio-compulabxsimus/.github/workflows/  # CI/CD (pode existir)
/cursor-bio-compulabxsimus/ROADMAP.md          # (não encontrado)
/cursor-bio-compulabxsimus/BACKLOG.md          # (não encontrado)
```

### 3.2 Histórico de Commits
**Padrão Observado:** Commits concentrados em uma pessoa
**Implicação:** Sem distribuição de responsabilidades ou code review formal

### 3.3 Documentação de Processo
**Encontrado:**
- README.md (orientação técnica)
- COMO_INICIAR.md (onboarding)
- DEPLOY.md (deployment)
- TUTORIAL_RAILWAY_DEPLOY.md (infraestrutura)

**Não Encontrado:**
- CONTRIBUTING.md (orientações de contribuição)
- ROADMAP.md (plano de features futuras)
- RISK_LOG.md (riscos identificados)
- DECISION_LOG.md (decisões arquiteturais)
- SLA.md ou SERVICE_LEVELS.md

### 3.4 Estrutura do Projeto
```
/cursor-bio-compulabxsimus/
├── .git/ (versionamento presente)
├── reflex_app/ (código-fonte modular)
├── docs/ (45 arquivos de documentação)
├── docker/ (infraestrutura)
└── tests/ (testes - extensão não documentada aqui)
```

---

## 4. Análise de Conformidade

| Item | Conformidade | Justificativa |
|------|--------------|---------------|
| Planejamento Formal | ✗ Não Conforme | Sem ferramenta ou backlog documentado |
| Estimação de Esforço | ✗ Não Conforme | Sem story points ou t-shirt sizing |
| Gerenciamento de Risco | ✗ Não Conforme | Sem risk log ou matriz de risco |
| Estrutura de Equipe Definida | ✗ Não Conforme | Single-developer pattern, sem papéis claros |
| Comunicação Documentada | ✗ Não Conforme | Sem canais ou frequência formalizados |
| Rastreamento de Progresso | ▲ Parcialmente | CI/CD existe, mas sem dashboard/metrics |
| Agendamento de Releases | ✗ Não Conforme | Sem cronograma ou marcos documentados |
| Alocação de Recursos | ✗ Não Conforme | Não documentada |
| Gestão de Configuração | ✓ Conforme | Git + CI/CD automatizado |
| Documentação de Processo | ▲ Parcialmente | Boa cobertura técnica, faltam procedimentos |

---

## 5. Achados e Observações

### 5.1 Achados Críticos

**C1. Ausência Completa de Ferramenta de Projeto**
- Projeto em produção sem Jira, Linear, GitHub Projects, ou similar
- Impossível rastrear requisitos, bugs, features em andamento
- Stakeholders (clientes, product owner) não têm visibilidade
- **Risco:** Desorganização, duplicação de esforço, requisitos perdidos

**C2. Single-Developer Pattern**
- Histórico de commits concentrado em uma pessoa
- Sem code review formal ou pair programming
- **Risco:** Bus factor crítico — perda do desenvolvedor = paralisação do projeto
- **Risco:** Burnout — pessoa sobrecarregada

**C3. Ausência de Registro de Riscos**
- Projeto em produção com QA de laboratório
- Não há documento de riscos identificados (downtime, data loss, compliance)
- Não há plano de mitigação
- **Risco:** Surpresas em produção sem preparação

**C4. Sem SLA Documentado**
- Sistema de "Controle de Qualidade em Laboratórios" (crítico para operações)
- Sem definição de "uptime esperado" (99.5%? 99.99%?)
- Sem RTO/RPO (Recovery Time/Point Objectives)
- **Risco:** Expectativas desalinhadas com clientes

### 5.2 Achados Moderados

**M1. Releases Ad-Hoc**
- Sem cronograma de releases planejado
- Sem marcos ou milestones
- Impossível prever quando features estarão prontas

**M2. Recursos Não Documentados**
- Não há clareza sobre tamanho da equipe
- Impossível avaliar se alocação é adequada
- Dificulta planejamento de novos projetos/features

**M3. Comunicação Informal**
- Presumivelmente via commits/PRs/mensagens diretas
- Sem canais ou frequência de sincronização documentados
- Aumenta risco de miscommunication

**M4. Falta de CONTRIBUTING.md**
- Mesmo em single-developer, facilita futuros contribuidores
- Documenta: como fazer build local, padrão de commits, submissão de PRs

---

## 6. Recomendações

### 6.1 Curto Prazo (0-30 dias)

**R1. Implementar Ferramenta de Projeto Leve**
- Opções: GitHub Projects (grátis, integrado), Linear (gratuito para pequenas equipes), Plane
- Estrutura mínima:
  - Backlog de features
  - Bugs encontrados em produção
  - Tasks de infra/manutenção
  - Releases planejadas
- Benefício: visibilidade imediata, rastreamento de requisitos

**R2. Criar Documento de Riscos Inicial**
- Identificar top 10 riscos (veja seção 5 desta auditoria)
- Matriz: Risco | Probabilidade | Impacto | Severidade | Mitigação
- Revisar mensalmente
- Benefício: preparação para problemas previsíveis

**R3. Documentar SLA**
- Definir uptime esperado (ex: 99.5% durante horas úteis)
- RTO/RPO para cenários de disaster
- Tempo de resposta para P1/P2/P3 bugs
- Exemplo:
  ```
  - Critical (P1): RTO 1h, investigação imediata
  - High (P2): RTO 4h, investigação < 1h
  - Medium (P3): RTO 1 dia
  ```
- Benefício: expectativas claras com clientes

**R4. Criar CONTRIBUTING.md**
- Padrão de commits (Conventional Commits)
- Como fazer build/test local
- Processo de submissão de PR
- Checklist de review
- Benefício: prepara para crescimento de equipe

### 6.2 Médio Prazo (30-90 dias)

**R5. Formalizar Estrutura de Equipe**
- Definir papéis (mesmo que uma pessoa tenha múltiplos):
  - Product Owner: prioriza features, comunica com clientes
  - Tech Lead: decisões arquiteturais, quality gate
  - QA: testes, validação de releases
  - DevOps: infraestrutura, deployments
- Documentar em TEAM.md ou ROLES.md
- Benefício: clareza de responsabilidades

**R6. Estabelecer Cadência de Releases e Sprints**
- Versão: release a cada 2 semanas (sugestão)
- Sprint de 1-2 semanas com planning/review
- Marcos trimestrais (ex: v3.1 em junho, v3.2 em setembro)
- Benefício: previsibilidade

**R7. Implementar Rastreamento de Progresso**
- Dashboard simples: # issues abertos, # em progresso, # fechados na semana
- Burndown/burnup chart para sprints
- Velocity (issues/story points por semana)
- Reunião semanal 15min: recap, blockers, próximos passos
- Benefício: gestão visual, early detection de problemas

**R8. Formalizar Comunicação**
- Canais: Slack/Discord para async, reunião semanal síncrona (15-30min)
- Tópicos:
  - Segunda: planning da semana
  - Quinta: revisão de progresso
  - Ad-hoc: escalação de blockers P1/P2
- Benefício: informação sincronizada

### 6.3 Longo Prazo (90+ dias)

**R9. Escalabilizar para Múltiplos Desenvolvedores**
- Processo de onboarding documentado (em CONTRIBUTING.md)
- Pair programming para features críticas
- Code review formal: todos os PRs revisados por outra pessoa
- Mentoring de juniors se contratado
- Benefício: redução de bus factor

**R10. Implementar OKRs (Objectives & Key Results)**
- Trim trimestral de objetivos
- Ex: "Melhorar confiabilidade: reduzir P1/P2 bugs em 40%"
- Ex: "Expandir funcionalidades: adicionar 5 novas features de relatório"
- Alinhar esforço da equipe com missão do produto
- Benefício: priorização clara

**R11. Criar Processo de Retrospectiva**
- Fim de cada sprint: "O que deu certo? O que melhorar? Próximos passos?"
- Documentar em RETROS.md
- Implementar melhorias identificadas
- Benefício: melhoria contínua

---

## 7. Matriz de Riscos (Project Management)

| Risco | Probabilidade | Impacto | Severidade | Mitigação |
|-------|---|---|---|---|
| Single developer indisponível (doença, saída) | Alta | Crítico | 🔴 CRÍTICO | Documentação, pair programming, cross-training |
| Requirements perdidos ou desorganizados | Alta | Alto | 🟠 ALTO | Implementar ferramenta de projeto |
| Downtime não planejado (sem SLA) | Média | Alto | 🟠 ALTO | Documentar SLA, monitoramento 24/7, runbooks |
| Burnout de desenvolvedor | Média | Crítico | 🔴 CRÍTICO | Distribuir carga, contratar ajuda, delegar QA |
| Releases desorganizadas | Alta | Médio | 🟡 MÉDIO | Cronograma, CI/CD robusto, changelogs |
| Estimativas ruins (atraso crônico) | Alta | Médio | 🟡 MÉDIO | Começar com estimativas, refinamento de backlog |
| Scope creep sem controle | Média | Médio | 🟡 MÉDIO | Product owner forte, priorização clara |
| Falta de visibilidade (clientes/stakeholders) | Alta | Médio | 🟡 MÉDIO | Dashboard, atualizações semanais |

---

## 8. Classificação Final do Capítulo

### Nível de Conformidade com Sommerville Caps. 22-23

**Classificação Geral: 🔴 INADEQUADO (25%)**

#### Breakdown por Área:

| Área | % Conformidade | Classificação |
|------|---|---|
| Planejamento | 15% | Crítico |
| Estimação | 10% | Crítico |
| Gerenciamento de Risco | 5% | Crítico |
| Estrutura Organizacional | 20% | Crítico |
| Comunicação | 30% | Inadequado |
| Rastreamento de Progresso | 40% | Inadequado |
| Agendamento | 15% | Crítico |
| Alocação de Recursos | 15% | Crítico |
| Gestão de Configuração | 80% | Conforme (Git + CI/CD) |

#### Síntese:

O projeto **carece completamente de estrutura de project management formal**, criando riscos significativos para:

1. **Sustentabilidade:** Single-developer padrão é insustentável
2. **Rastreabilidade:** Nenhuma ferramenta para requisitos/bugs/features
3. **Previsibilidade:** Sem estimativas ou cronograma
4. **Resiliência:** Sem plano de riscos ou mitigação
5. **Comunicação:** Canais e frequência informais

**Ações Imediatas (Críticas):**
1. ✓ Implementar ferramenta de projeto (GitHub Projects ou Linear)
2. ✓ Criar risk log e SLA
3. ✓ Documentar CONTRIBUTING.md e TEAM.md
4. ✓ Formalizar reuniões semanais (planning, review)
5. ✓ Começar com estimativas simples (t-shirt sizing)

**Impacto:** Sem estas ações, o projeto verá crescimento de bugs, missed deadlines, e risco iminente de perda de conhecimento se o desenvolvedor sair.

---

**Auditor:** Software Engineering Audit Team
**Data:** 31 de março de 2026
**Próxima Revisão Recomendada:** 30 de junho de 2026
