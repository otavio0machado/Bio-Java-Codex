# Transição Biodiagnóstico 3.0 → 4.0

## De Python/Reflex para Java/React

Esta pasta contém **TUDO** que você precisa para reconstruir o Biodiagnóstico em Java + React, mantendo o visual idêntico ao sistema atual.

---

## Estrutura da Pasta

```
transicao-java/
├── README.md                    ← Você está aqui
├── 00-VISAO-GERAL.md           ← Roadmap e arquitetura
├── 01-SCHEMA-SQL.md            ← Schema PostgreSQL novo (copiar e colar no Supabase)
├── 02-BACKEND-JAVA.md          ← Guia do backend Spring Boot
├── 03-FRONTEND-REACT.md        ← Guia do frontend React + TypeScript
├── 04-AUTH-SEGURANCA.md        ← Autenticação JWT
├── 05-DEPLOY.md                ← Deploy Railway + Railway
├── 06-DESIGN-SYSTEM.md         ← Tokens visuais e componentes
└── prompts/                    ← Prompts prontos para o Claude
    ├── 01-criar-projeto-spring.md
    ├── 02-entities-jpa.md
    ├── 03-repositories.md
    ├── 04-westgard-engine.md
    ├── 05-services-qc.md
    ├── 06-services-reagentes-manutencao.md
    ├── 07-controllers-rest.md
    ├── 08-auth-jwt.md
    ├── 09-testes-backend.md
    ├── 10-projeto-react.md
    ├── 11-design-system-react.md
    ├── 12-pagina-login.md
    ├── 13-pagina-dashboard.md
    ├── 14-pagina-proin-cq.md
    ├── 15-graficos-levey-jennings.md
    ├── 16-integracao-gemini.md
    ├── 17-deploy-railway.md
    └── 18-navbar-react.md
```

## Como Usar

### Passo 1: Leia a visão geral
Abra `00-VISAO-GERAL.md` para entender a arquitetura e a ordem das fases.

### Passo 2: Crie o banco de dados
Abra `01-SCHEMA-SQL.md`, crie um novo projeto no Supabase, e execute o SQL.

### Passo 3: Use os prompts na ordem
Abra cada prompt em `prompts/` e cole inteiro no Claude. O Claude vai gerar o código completo para aquela parte.

**Ordem recomendada:**

| Ordem | Prompt | O que gera |
|-------|--------|-----------|
| 1º | `01-criar-projeto-spring.md` | Projeto base |
| 2º | `02-entities-jpa.md` | Models do banco |
| 3º | `03-repositories.md` | Acesso ao banco |
| 4º | `04-westgard-engine.md` | Regras de Westgard |
| 5º | `05-services-qc.md` | Lógica de CQ |
| 6º | `06-services-reagentes-manutencao.md` | Reagentes, manutenção, dashboard |
| 7º | `07-controllers-rest.md` | Endpoints da API |
| 8º | `08-auth-jwt.md` | Login/Autenticação |
| 9º | `09-testes-backend.md` | Testes do backend |
| 10º | `10-projeto-react.md` | Projeto frontend |
| 11º | `11-design-system-react.md` | Componentes visuais |
| 12º | `18-navbar-react.md` | Barra de navegação |
| 13º | `12-pagina-login.md` | Tela de login |
| 14º | `13-pagina-dashboard.md` | Dashboard |
| 15º | `14-pagina-proin-cq.md` | Página de CQ (principal) |
| 16º | `15-graficos-levey-jennings.md` | Gráficos |
| 17º | `16-integracao-gemini.md` | IA assistente |
| 18º | `17-deploy-railway.md` | Deploy |

### Passo 4: Teste e Deploy
Siga `05-DEPLOY.md` para colocar em produção.

---

## Regra de Ouro

> O cliente não pode perceber que mudou a tecnologia.
> Mesmas cores, mesmos botões, mesma navegação, mesmos gráficos.
