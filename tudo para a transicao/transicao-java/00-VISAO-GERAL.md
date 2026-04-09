# Biodiagnóstico 4.0 — Visão Geral da Transição

## O Que Estamos Fazendo

Reconstruindo o Biodiagnóstico do zero usando Java (backend) + React (frontend), mantendo o **mesmo visual, mesma experiência e mesmas funcionalidades** que o cliente já conhece. O cliente não vai perceber a diferença — só vai ficar mais rápido e robusto.

## Stack Nova

| Camada | Tecnologia | Onde roda |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS | **Vercel** (grátis) |
| Backend | Java 21 + Spring Boot 3 + Spring Security | **Railway** |
| Banco de Dados | PostgreSQL (schema novo, limpo) | **Supabase** (mesmo provider, banco novo) |
| IA | Google Gemini via SDK Java | Dentro do backend |
| Relatórios PDF | iText 7 ou JasperReports | Dentro do backend |

## Arquitetura

```
┌──────────────────┐     HTTP/JSON      ┌──────────────────┐      JPA       ┌──────────────┐
│   React + TS     │ ◄────────────────► │  Spring Boot 3   │ ◄────────────► │  PostgreSQL   │
│   (Vercel)       │                    │  (Railway)       │               │  (Supabase)   │
└──────────────────┘                    └────────┬─────────┘               └──────────────┘
                                                 │
                                            Gemini SDK
                                                 │
                                        ┌────────▼─────────┐
                                        │  Google Gemini    │
                                        └──────────────────┘
```

## Ordem de Execução (Fases)

### Fase 1 — Banco de Dados (1-2 dias)
📄 Arquivo: `01-SCHEMA-SQL.md`
- Criar novo projeto no Supabase
- Executar o schema SQL novo
- Verificar tabelas criadas

### Fase 2 — Backend Java (2-3 semanas)
📄 Arquivo: `02-BACKEND-JAVA.md`
- Criar projeto Spring Boot
- Entities JPA
- Repositories
- Services (Westgard, QC, Reagentes, Manutenção, IA)
- Controllers REST
- Testes

### Fase 3 — Autenticação (3-4 dias)
📄 Arquivo: `04-AUTH-SEGURANCA.md`
- Spring Security + JWT
- Login/Logout/Refresh
- Proteção de rotas no React

### Fase 4 — Frontend React (2-3 semanas)
📄 Arquivo: `03-FRONTEND-REACT.md`
- Projeto React + TypeScript + Vite
- Design System (mesmos tokens visuais)
- Páginas: Login, Dashboard, ProIn (CQ)
- Hooks para cada funcionalidade
- Gráficos Levey-Jennings

### Fase 5 — Design System
📄 Arquivo: `06-DESIGN-SYSTEM.md`
- Cores, tipografia, espaçamentos
- Componentes base (botões, cards, inputs)
- Garantir que fica idêntico ao atual

### Fase 6 — Deploy (1-2 dias)
📄 Arquivo: `05-DEPLOY.md`
- Backend no Railway
- Frontend na Vercel
- Variáveis de ambiente
- Domínio customizado

## Pasta de Prompts

📁 `prompts/` — Contém prompts prontos para colar no Claude e gerar cada parte do projeto. Cada prompt é auto-contido e tem todo o contexto necessário.

| # | Prompt | O Que Gera |
|---|---|---|
| 01 | `01-criar-projeto-spring.md` | Projeto Spring Boot inicial com configs |
| 02 | `02-entities-jpa.md` | Todas as entities JPA mapeadas |
| 03 | `03-repositories.md` | Spring Data JPA Repositories |
| 04 | `04-westgard-engine.md` | Motor de regras de Westgard completo |
| 05 | `05-services-qc.md` | Services de Controle de Qualidade |
| 06 | `06-services-reagentes-manutencao.md` | Services de reagentes e manutenção |
| 07 | `07-controllers-rest.md` | Todos os endpoints REST |
| 08 | `08-auth-jwt.md` | Autenticação Spring Security + JWT |
| 09 | `09-testes-backend.md` | Testes JUnit + Mockito + Testcontainers |
| 10 | `10-projeto-react.md` | Projeto React + TS + Vite + Tailwind |
| 11 | `11-design-system-react.md` | Componentes UI base do React |
| 12 | `12-pagina-login.md` | Página de Login idêntica à atual |
| 13 | `13-pagina-dashboard.md` | Dashboard com KPIs e alertas |
| 14 | `14-pagina-proin-cq.md` | Página principal de CQ (todas as abas) |
| 15 | `15-graficos-levey-jennings.md` | Gráficos interativos de CQ |
| 16 | `16-integracao-gemini.md` | Integração com Google Gemini |
| 17 | `17-deploy-railway-vercel.md` | Deploy completo |

## Regra de Ouro

> **O cliente não pode perceber que mudou a tecnologia.**
> Mesmas cores, mesmos botões, mesma navegação, mesmos gráficos.
> A diferença está por baixo: mais rápido, mais seguro, mais escalável.
