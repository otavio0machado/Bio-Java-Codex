# Auditoria 00 — Mapeamento Geral do Sistema

**Data:** 2026-03-30
**Auditor:** Claude (Staff Engineer / Software Architect / Product Analyst)
**Solicitante:** Otávio Machado
**Status:** Concluído — Documento de referência para auditorias subsequentes

---

## Escopo

Radiografia completa do sistema Biodiagnóstico em produção. O objetivo é produzir uma fotografia fiel do estado atual da engenharia e do produto antes de qualquer intervenção, servindo como base documental para uma revisão geral profissional.

**Inclui:** estrutura de código, arquitetura, banco de dados, integrações, infraestrutura, CI/CD, fluxos de negócio, riscos técnicos.
**Exclui:** correções, refatorações, melhorias ou qualquer alteração no sistema.

---

## Metodologia

1. Leitura exaustiva de todos os arquivos-fonte Python (excluindo .venv e __pycache__).
2. Análise de todas as migrações SQL, scripts de setup e RLS policies.
3. Análise da infraestrutura (Docker, Nginx, Railway, CI/CD, scripts de start).
4. Mapeamento de integrações externas (Supabase, Gemini, Sentry, n8n).
5. Análise de componentes, services, states, pages, utils e modelos.
6. Cruzamento de informações entre camadas para identificar inconsistências.
7. Registro factual de achados — sem sugestões de correção.

---

## 1. Visão Geral do Sistema

### Propósito

O Biodiagnóstico é uma plataforma web para gestão laboratorial focada em:

1. **Controle de Qualidade (CQ)** — módulo completo de gestão da qualidade analítica com regras de Westgard, gráficos de Levey-Jennings, gestão de reagentes, manutenção de equipamentos e geração de relatórios PDF.

### Stack Tecnológica

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Framework full-stack | Reflex | 0.8.27 |
| Linguagem | Python | 3.11 (Docker) / 3.12 (venv local) |
| Banco de dados | Supabase (PostgreSQL) | SaaS |
| IA Generativa | Google Gemini 2.5 Flash | via google-genai 1.67.0 |
| Processamento de dados | Pandas | 3.0.1 |
| Geração de PDF | ReportLab | 4.4.10 |
| Extração de PDF | PDFPlumber | (implícito, referenciado na documentação) |
| Manipulação Excel | openpyxl | 3.1.5 |
| HTTP Client | httpx | 0.28.1 |
| Validação de dados | Pydantic | 2.12.5 |
| Monitoramento de erros | Sentry SDK | 2.56.0 |
| Automação de workflows | n8n | Externo (self-hosted) |
| Deploy | Railway + Docker | Multi-stage |
| Proxy reverso | Nginx | Runtime container |
| CSS Framework | Tailwind CSS v4 | Via plugin Reflex |

### Tipo de Arquitetura

**Monolito full-stack Python com Reflex.** O Reflex gera um frontend React automaticamente a partir de componentes Python, e o backend roda como um servidor Python com WebSocket para reatividade. O Nginx atua como proxy reverso na frente, servindo assets estáticos e encaminhando chamadas de API e WebSocket ao Reflex.

A persistência é inteiramente no Supabase (PostgreSQL + Auth + RLS). Não há ORM — as queries são feitas via SDK Python do Supabase (PostgREST). Lógica de negócio complexa (validação de medições QC) roda como funções RPC no banco de dados.

### Módulos Centrais

1. **Autenticação** — Login via Supabase Auth com cookies JWT (access + refresh token).
2. **Dashboard** — KPIs em tempo real (taxa de aprovação, alertas, registros recentes).
3. **ProIn (Controle de Qualidade)** — Hub principal com sub-módulos:
   - Registro de medições QC (Bioquímica)
   - Valores de referência
   - Gestão de reagentes/lotes
   - Manutenção de equipamentos
   - Relatórios PDF
   - Importação de planilhas
   - Hematologia, Imunologia, Parasitologia, Microbiologia, Uroanálise
4. **Voice AI** — Voice-to-form no frontend para entrada de dados.

---

## 2. Estrutura do Projeto

### Organização de Pastas (Raiz)

```
/
├── .agent/                        # Skills do agente Cursor (11 domínios, 40 scripts)
│   ├── skills/                    # UI/UX, código limpo, testes, dados, IA, prompts
│   └── workflows/                 # Fluxos automatizados
├── .github/workflows/ci.yml       # CI: Ruff + pytest
├── biodiagnostico_app/            # APLICAÇÃO PRINCIPAL
│   ├── biodiagnostico_app/        # Código-fonte Python
│   │   ├── components/            # Componentes UI
│   │   │   ├── proin/             # 13 arquivos: tabs, modals, helpers
│   │   │   ├── navbar.py          # Barra de navegação
│   │   │   └── ui.py              # Biblioteca de componentes reutilizáveis
│   │   ├── data/                  # (vazio ou dados estáticos)
│   │   ├── pages/                 # 3 páginas: login, dashboard, proin
│   │   ├── services/              # 15 services: QC, reagentes, Westgard, IA, etc.
│   │   ├── states/                # 12 arquivos de estado Reflex
│   │   ├── utils/                 # 3 utilitários: numeric, qc_pdf, reagent_pdf
│   │   ├── biodiagnostico_app.py  # Entry point (app + rotas)
│   │   ├── config.py              # Configuração via env vars
│   │   ├── models.py              # Modelos Pydantic
│   │   ├── state.py               # State raiz (herança de QCState)
│   │   ├── styles.py              # Design system (cores, tipografia, espaçamento)
│   │   ├── logging_utils.py       # Configuração de logging
│   │   ├── monitoring.py          # Sentry integration
│   │   └── runtime_assets.py      # SEO (robots.txt, sitemap)
│   ├── migrations/                # 10 migrações SQL numeradas (002–011)
│   ├── assets/                    # Imagens, CSS customizado
│   ├── .web/                      # Build do frontend React (gerado pelo Reflex)
│   ├── uploaded_files/            # Arquivos enviados por usuários
│   ├── nginx.conf                 # Configuração do proxy reverso
│   ├── start.sh                   # Script de inicialização (Reflex + Nginx)
│   ├── Dockerfile                 # Multi-stage build
│   ├── requirements.txt           # Dependências Python
│   ├── rxconfig.py                # Configuração do Reflex
│   ├── *.sql                      # Migrações avulsas (hematologia, outras áreas, etc.)
│   └── .env.example               # Template de variáveis de ambiente
├── tests/                         # Testes
│   ├── unit/                      # test_runtime_assets.py
│   └── e2e/                       # Testes Playwright (login, dashboard, modals, etc.)
├── testsprite_tests/              # Test cases QA
├── docs/                          # Documentação adicional
├── pyproject.toml                 # Config: pytest, ruff
├── railway.toml                   # Config Railway deploy
└── *.md                           # ~20 documentos de referência (README, guias, etc.)
```

### Áreas Principais do Código

| Diretório | Arquivos .py | Responsabilidade |
|-----------|-------------|------------------|
| pages/ | 3 | Páginas e layout (login, dashboard, proin) |
| states/ | 12 | Gerenciamento de estado reativo (auth, QC, dashboard, operações) |
| services/ | 15 | Camada de negócio e acesso a dados (Supabase, Westgard, IA) |
| components/ | 2 + 13 (proin/) | UI reutilizável e tabs do ProIn |
| utils/ | 3 | Geração de PDF, parsing numérico |

### Páginas, Rotas e Fluxos

| Rota | Página | Descrição |
|------|--------|-----------|
| `/` | index (login ou dashboard) | Condicional: se autenticado → layout autenticado; senão → login |
| `/dashboard` | dashboard_page | KPIs, alertas, registros recentes, atalhos rápidos |
| `/proin` | proin_page | Hub de controle de qualidade com sub-tabs por área |

**Sub-navegação do ProIn (Bioquímica):**

| Tab | Componente | Descrição |
|-----|-----------|-----------|
| dashboard | dashboard_tab.py | Visão geral do CQ |
| registro | registro_tab.py | Formulário de registro de medição QC |
| referencias | referencias_tab.py | Gestão de valores de referência |
| reagentes | reagentes_tab.py | Gestão de reagentes e lotes |
| manutencao | manutencao_tab.py | Registros de manutenção de equipamentos |
| relatorios | relatorios_tab.py | Geração de relatórios PDF |
| importar | importar_tab.py | Importação de planilhas Excel |

**Outras áreas (seletor de topo):** Hematologia, Imunologia, Parasitologia, Microbiologia, Uroanálise — cada uma com conteúdo próprio via components/proin.

### Componentes Compartilhados

- **navbar.py** — Barra de navegação sticky com links, logo, avatar, menu mobile, logout.
- **ui.py** — Biblioteca de componentes: heading, text, card, button (primary/secondary/ghost/danger), empty_state, stat_card, form_field, input, animated_heading.
- **components/proin/helpers.py** — format_cv(), qc_status_label(), qc_status_kind(), area_tab_button(), tab_button().
- **components/proin/modals.py** — 7+ modais: post-calibração, deleção, adicionar exame/nome, voice recording, gráfico Levey-Jennings.

---

## 3. Inventário Funcional

### Features Principais

1. **Registro de medições QC (Bioquímica)** — Formulário completo com exame, nível, lote, valor, alvo, DP, CV%, equipamento, analista, data, nome de registro. Validação automática de Westgard. Voice-to-form via IA.
2. **Regras de Westgard** — Implementação de 6 regras: 1-2s, 1-3s, 2-2s, R-4s, 4-1s, 10x. Z-score calculado. Retorna lista de violações com nome e severidade.
3. **Gráficos de Levey-Jennings** — Visualização interativa dos últimos 30 dias de medições por exame.
4. **Gestão de valores de referência** — CRUD com períodos de validade (valid_from, valid_until). Lookup temporal automático.
5. **Gestão de reagentes/lotes** — CRUD com tracking de estoque, vencimento, consumo diário, movimentações de estoque. Alertas para lotes vencendo (7/30 dias) e risco de ruptura.
6. **Manutenção de equipamentos** — Registro de manutenções preventivas, corretivas e calibrações. Próxima data de manutenção.
7. **Pós-calibração** — Registro de medições corretivas após falhas QC, vinculadas ao registro original.
8. **Relatórios PDF** — QC (landscape A4 com tabela de 11 colunas), reagentes (agrupados por categoria com status colorido), áreas específicas (hematologia com Bio x CI).
9. **Importação de planilhas** — Upload de Excel, detecção de colunas, preview, mapeamento, importação em batch.
10. **Dashboard executivo** — Taxa de aprovação, alertas ativos, registros hoje/mês, violações Westgard, registros recentes com status.
11. **CQ Hematologia** — Sistema de dois modos (INTERVALO e PERCENTUAL), view calculada, RPC para validação complexa, Bio x Controle Interno (41 colunas).
12. **CQ Outras Áreas** — Imunologia, Parasitologia, Microbiologia, Uroanálise com parâmetros e medições via serviço genérico e RPCs por área.
13. **Voice-to-Form (IA)** — Captura de áudio, transcrição via Gemini 2.5 Flash, extração de campos JSON, preenchimento automático de formulários.
14. **Autenticação** — Login por e-mail/senha via Supabase Auth, cookies JWT com refresh, recuperação de senha por e-mail.

### Features Secundárias

1. **Conversor PDF → Excel** — Referenciado na documentação mas implementação não localizada como página/tab separada.
2. **SEO** — robots.txt e sitemap.xml gerados dinamicamente no deploy.
3. **Monitoramento Sentry** — Integração opcional para captura de erros em produção.
4. **Design System centralizado** — Cores, tipografia (Space Grotesk + DM Sans), espaçamento, sombras, z-index.

### Integrações Externas

| Integração | Propósito | Como se conecta |
|-----------|----------|-----------------|
| **Supabase** | Banco de dados, autenticação, RLS | SDK Python (supabase 2.28.2), PostgREST, RPC |
| **Google Gemini** | Voice-to-form, análise de dados | google-genai SDK, modelo gemini-2.5-flash |
| **Sentry** | Monitoramento de erros | sentry-sdk 2.56.0, DSN via env var |
| **Railway** | Deploy em produção | Docker, health check /ping |

### Áreas Incompletas, Ambíguas ou Improvisadas

1. **Página 404** — Existe rota no .web/app/routes mas sem implementação visível no código Python.
6. **Diretório `data/`** — Existe dentro do código-fonte mas conteúdo não determinado durante análise.
7. **Múltiplas migrações SQL avulsas** — Além das numeradas em `migrations/`, há 4+ arquivos SQL avulsos no diretório `biodiagnostico_app/` sem controle de versionamento claro.
8. **.venv commitado** — Há um .venv dentro de `biodiagnostico_app/biodiagnostico_app/`, indicando que o ambiente virtual foi incluído no repositório (provável acidente).
9. **Campos DEPRECATED em QCRecord** — value1, value2, mean, sd, z_score, cv_max_threshold marcados como deprecated mas ainda presentes no modelo.

---

## 4. Fluxo Técnico

### Como Frontend e Backend se Conectam

O Reflex opera como framework full-stack. O frontend React é gerado a partir dos componentes Python e se comunica com o backend Python via WebSocket (porta 8000). Em produção, o Nginx na porta 8080 faz proxy:

```
Browser → Nginx (8080)
  ├── GET /assets/* → Arquivos estáticos (.web/build/client)
  ├── WS /_event → Reflex WebSocket (8000) — estado reativo
  ├── POST /_upload → Reflex upload handler (8000)
  ├── POST /api/* → Reflex API endpoints (8000)
  └── GET /* → index.html (SPA fallback)
```

### Como o Estado é Gerenciado

**Hierarquia de herança de Estado Reflex:**

```
rx.State (base Reflex)
  └── AuthState (autenticação, cookies, sessão)
      └── DashboardState (KPIs, alertas, métricas via @rx.var)
          └── QCState + OutrasAreasQCMixin (toda lógica de negócio QC)
              └── State (state.py — routing, navegação)
```

- **AuthState** mantém `is_authenticated`, `_user_id`, tokens JWT em cookies.
- **DashboardState** usa computed vars (@rx.var) que recalculam automaticamente quando dados mudam.
- **QCState** é a classe mais complexa (centenas de variáveis) com todas as operações QC, reagentes, manutenção, referências, importação, voz.
- O **State** final (state.py) adiciona apenas navegação (current_page, set_page, navigate_to).
- Operações são extraídas em mixins: `_import_ops.py`, `_reagent_ops.py`, `_maintenance_ops.py`, `_reference_ops.py`, `_report_ops.py`, `_voice_ops.py`, `_post_calibration_ops.py`.

### Como os Dados Fluem

```
1. Login → Supabase Auth → JWT cookies
2. on_load → restore_session() → load_data_from_db()
3. load_data_from_db() → asyncio.gather() paralelo:
   - QC records
   - Reagent lots
   - Maintenance records
   - Post-calibration records
   - QC exam names
   - Registry names
4. Dados transformados → Modelos Pydantic (QCRecord, ReagentLot, etc.)
5. Computed vars (@rx.var) → Dashboard recalcula automaticamente
6. Cache TTL de 30 segundos para evitar re-fetch excessivo
```

### Como Autenticação Funciona

1. **Tentativa de login**: email + senha → `supabase.auth.sign_in_with_password()`.
2. **Tokens**: access_token e refresh_token armazenados em cookies HTTP-only (7 dias, SameSite=strict, Secure em produção).
3. **Restauração de sessão**: on_load lê cookie → `supabase.auth.get_user(token)` → se expirado, tenta refresh.
4. **Guard**: Todas as páginas verificam `State.is_authenticated` com `rx.cond()`. Não autenticado = tela de login.
5. **Logout**: limpa cookies → `supabase.auth.sign_out()` → `self.reset()` → redirect `/`.
6. **Recuperação de senha**: `supabase.auth.reset_password_email()` envia link externo.

### Como Persistência Funciona

- **Supabase (PostgreSQL)** é o único banco de dados.
- Dois tipos de client: **anon** (respeita RLS) e **admin** (service_role, bypassa RLS).
- Queries via PostgREST SDK: `.select()`, `.eq()`, `.insert()`, `.update()`, `.delete()`, `.rpc()`.
- Lógica complexa (validação de medições QC) roda como **funções RPC** (SECURITY DEFINER) no banco.
- **RLS** restrito a `authenticated` users desde migration 006.
- CV% e status de QC records são colunas **geradas no banco**, não calculadas no serviço.
- Migration 010 preparou user_id em todas as tabelas para futuro multi-tenant.

### Como a Lógica de Negócio está Distribuída

| Camada | Responsabilidade |
|--------|-----------------|
| **Database (RPC functions)** | Validação de medições QC (hematologia, outras áreas), cálculo de min/max, aprovação/reprovação, CV% e status de qc_records |
| **Services (Python)** | CRUD, regras de Westgard, validação de inputs, geração de PDF, integração Gemini |
| **States (Python)** | Orquestração, transformação de dados, cache, binding com UI |
| **Components (Python/React)** | Apresentação, formulários, navegação |

**Observação crítica:** Há lógica de negócio significativa no banco de dados (RPCs, colunas geradas) o que cria acoplamento e dificulta testes unitários dessa lógica.

---

## 5. Mapa de Risco Inicial

### Áreas Complexas

| # | Área | Complexidade | Motivo |
|---|------|-------------|--------|
| 1 | QCState + mixins | Muito Alta | Centenas de variáveis de estado, 12 arquivos de operações, única cadeia de herança |
| 2 | Hematologia QC (Bio x CI) | Alta | Tabela de 41 colunas, dois modos de validação, view calculada, RPC com lógica complexa |
| 3 | Westgard rules | Média-Alta | 6 regras com dependência histórica, side-effect no objeto de input (z_score) |
| 4 | Importação de planilhas | Média | Parsing de Excel, mapeamento de colunas, batch insert sem transação |
| 5 | Voice-to-Form (Gemini) | Média | Processamento de áudio, parsing de JSON, risco de prompt injection |

### Áreas Frágeis

| # | Risco | Severidade | Evidência |
|---|-------|-----------|-----------|
| 1 | **Sem transações em operações batch** | Alta | qc_service.create_qc_records_batch() faz loop de inserts individuais — falha parcial possível |
| 2 | **Uso inconsistente de admin vs anon client** | Alta | ReagentService usa admin=True; MaintenanceService usa anon. Sem justificativa documentada |
| 3 | **Estratégia de delete inconsistente** | Média | Alguns serviços fazem soft-delete, outros hard-delete. Reagent movement delete não verifica |
| 4 | **Logging inconsistente** | Média | Mistura de print(), logging, e ServiceError sem hierarquia de exceções |
| 5 | **Cache simples de 30s** | Média | Sem invalidação por evento — dados podem ficar stale em cenários de uso concorrente |
| 6 | **Sem RBAC** | Média | Todos os usuários autenticados têm as mesmas permissões |
| 7 | **Sem rate limiting no serviço** | Média | Upload e importação sem limitação server-side (Nginx limita mas não a lógica) |
| 8 | **TypedDicts com total=False** | Baixa-Média | Todos os campos são opcionais — validação fraca na camada de serviço |
| 9 | **Migrações SQL avulsas fora de controle** | Média | 4+ arquivos SQL no diretório raiz sem numeração ou controle de versão |
| 10 | **.venv commitado no repositório** | Baixa | Aumento desnecessário do tamanho do repo, potencial conflito de plataforma |
| 11 | **Campos deprecated mantidos** | Baixa | 6+ campos deprecated em QCRecord sem plano de remoção visível |
| 12 | **Fallback exams hardcoded** | Baixa | _FALLBACK_EXAMS usado quando carregamento de exames falha — comportamento frágil |

### Áreas Críticas para o Produto

1. **Registro de medições QC** — Core do produto. Qualquer bug aqui invalida o controle de qualidade do laboratório.
2. **Regras de Westgard** — Decisão de aprovar/rejeitar medição depende da corretude da implementação.
3. **Autenticação** — Sistema em produção com dados sensíveis de laboratório.
4. **Geração de relatórios PDF** — Saída formal que pode ser auditada por órgãos reguladores.
5. **Gestão de reagentes/vencimentos** — Alertas de vencimento são críticos para segurança laboratorial.

### Hipóteses Iniciais de Problemas

1. **Lógica de negócio dividida entre banco e serviço** — CV% e status calculados no banco; Westgard calculado no serviço. Dificulta testes e gera acoplamento.
2. **Cadeia de herança de estado muito longa** — AuthState → DashboardState → QCState → State. Mudança em qualquer nível pode ter efeitos cascata.
3. **Auditoria Financeira pode estar órfã** — Tabelas existem no banco mas não há UI correspondente na aplicação Reflex atual.
4. **Performance sob carga** — Sem paginação server-side em várias queries (limite fixo de 100-200 registros).
5. **Segurança da integração IA** — Áudio de voz processado sem sanitização contra prompt injection.

---

## 6. Mapa Completo do Sistema

### Diagrama de Componentes

```
┌──────────────────────────────────────────────────────────────────┐
│                        NGINX (porta 8080)                        │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │ Static  │  │ WebSocket│  │  Upload  │  │    API Proxy     │ │
│  │ Assets  │  │ /_event  │  │ /_upload │  │ /api/* /_backend │ │
│  └────┬────┘  └────┬─────┘  └────┬─────┘  └────────┬─────────┘ │
└───────┼────────────┼─────────────┼──────────────────┼───────────┘
        │            │             │                  │
        │            ▼             ▼                  ▼
        │  ┌─────────────────────────────────────────────┐
        │  │           REFLEX BACKEND (porta 8000)        │
        │  │                                              │
        │  │  ┌──────────────────────────────────────┐   │
        │  │  │              STATE LAYER               │   │
        │  │  │  State → QCState → DashboardState     │   │
        │  │  │       → AuthState → rx.State          │   │
        │  │  │                                        │   │
        │  │  │  Mixins: _import_ops, _reagent_ops,   │   │
        │  │  │  _maintenance_ops, _reference_ops,     │   │
        │  │  │  _report_ops, _voice_ops,              │   │
        │  │  │  _post_calibration_ops,                │   │
        │  │  │  _outras_areas_qc                      │   │
        │  │  └──────────────┬───────────────────────┘   │
        │  │                 │                            │
        │  │  ┌──────────────▼───────────────────────┐   │
        │  │  │           SERVICE LAYER               │   │
        │  │  │  qc_service, westgard_service,        │   │
        │  │  │  reagent_service, maintenance_service, │   │
        │  │  │  qc_reference_service, qc_exam_service,│  │
        │  │  │  hematology_qc_service,                │   │
        │  │  │  generic_qc_service,                   │   │
        │  │  │  post_calibration_service,             │   │
        │  │  │  voice_ai_service,                     │   │
        │  │  │  qc_registry_name_service              │   │
        │  │  └──────────────┬───────────────────────┘   │
        │  │                 │                            │
        │  │  ┌──────────────▼───────────────────────┐   │
        │  │  │         SUPABASE CLIENT               │   │
        │  │  │  Singleton (anon) + Singleton (admin) │   │
        │  │  │  Lazy initialization                  │   │
        │  │  └──────────────┬───────────────────────┘   │
        │  │                 │                            │
        │  └─────────────────┼────────────────────────────┘
        │                    │
        ▼                    ▼
┌──────────────┐   ┌──────────────────────────────────┐
│  .web/build/ │   │         SUPABASE (PaaS)           │
│  client/     │   │  ┌────────────────────────────┐  │
│  (React SPA) │   │  │  PostgreSQL + RLS + RPCs   │  │
│              │   │  │  18+ tabelas, 6 RPCs,      │  │
│              │   │  │  1 view, 2 ENUMs           │  │
│              │   │  └────────────────────────────┘  │
│              │   │  ┌────────────────────────────┐  │
│              │   │  │  Supabase Auth (JWT)        │  │
│              │   │  └────────────────────────────┘  │
│              │   └──────────────────────────────────┘
└──────────────┘

Integrações Externas:
  ┌────────────────┐   ┌──────────┐   ┌──────────┐
  │ Google Gemini  │   │  Sentry  │   │   n8n    │
  │ (voice-to-form)│   │ (erros)  │   │ (agente) │
  └────────────────┘   └──────────┘   └──────────┘
```

### Diagrama de Banco de Dados (Tabelas Principais)

```
┌──────────────────────┐     ┌──────────────────────────┐
│     qc_records       │     │   qc_reference_values    │
│ id, exam_name, level │◄────│ id, exam_name, level     │
│ value, target_value  │     │ target_value, target_sd   │
│ cv, cv_limit, status │     │ cv_max_threshold          │
│ equipment, analyst   │     │ valid_from, valid_until   │
│ user_id (nullable)   │     │ user_id (nullable)        │
└──────────┬───────────┘     └──────────────────────────┘
           │
           ▼
┌──────────────────────────┐
│ post_calibration_records │
│ id, qc_record_id (FK)   │
│ value, cv, analyst       │
│ user_id (nullable)       │
└──────────────────────────┘

┌──────────────────────┐     ┌──────────────────────────┐
│    reagent_lots      │     │ reagent_stock_movements  │
│ id, name, lot_number │◄────│ id, lot_id (FK)          │
│ expiry_date, stock   │     │ quantity, type            │
│ manufacturer, status │     │ responsible              │
│ user_id (nullable)   │     │ user_id (nullable)        │
└──────────────────────┘     └──────────────────────────┘

┌──────────────────────────────────────┐
│     hematology_qc_parameters         │
│ id, analito, modo (ENUM)             │
│ alvo_valor, min_valor, max_valor     │◄─── v_hematology_qc_parameters_resolved (VIEW)
│ tolerancia_percentual, equipamento   │
│ user_id (nullable)                   │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│    hematology_qc_measurements        │
│ id, parameter_id (FK), data_medicao  │
│ analito, valor_medido, status (ENUM) │
│ modo_usado, min_aplicado, max_aplicado│
│ user_id (nullable)                   │
└──────────────────────────────────────┘

┌────────────────────────────────────┐
│      hematology_bio_records        │
│ id, date, 41 colunas de analitos   │
│ (valor_bio + ci_min/max/pct por    │
│  cada analito)                     │
└────────────────────────────────────┘

Tabelas por Área (mesmo padrão):
  immunology_qc_parameters / immunology_qc_measurements
  parasitology_qc_parameters / parasitology_qc_measurements
  microbiology_qc_parameters / microbiology_qc_measurements
  urine_qc_parameters / urine_qc_measurements

Nota: Tabelas legadas da auditoria financeira (audit_summaries, saved_analyses, analysis_items, exam_mappings) foram descontinuadas e devem ser removidas do banco se ainda existirem.
```

---

## Conclusão

O sistema Biodiagnóstico é um produto de complexidade considerável que evoluiu de um script de comparação de PDFs para uma aplicação web full-stack de gestão laboratorial. A base técnica é sólida: o uso do Reflex como framework full-stack Python reduz a complexidade de manter dois codebases (Python + JavaScript), e a escolha do Supabase simplifica autenticação e persistência.

Os pontos fortes do sistema incluem: design system centralizado, separação em services, uso de Pydantic para modelos, implementação funcional das regras de Westgard, suporte a múltiplas áreas laboratoriais, e integração de IA para voice-to-form.

Os pontos de atenção incluem: distribuição de lógica de negócio entre banco e serviço, cadeia de herança de estado muito longa, ausência de transações em operações batch, inconsistências entre serviços (admin vs anon, soft vs hard delete, logging), e preparação incompleta para multi-tenant.

O sistema está funcional em produção, mas carece de maturidade em áreas como observabilidade, controle de acesso granular, e robustez de error handling para operações que suportam a decisão clínica.

---

## Próximos Passos — Auditorias Recomendadas

As seguintes auditorias devem ser executadas em ordem, usando este mapeamento como referência:

| # | Auditoria | Foco | Prioridade |
|---|----------|------|------------|
| 01 | **Auditoria de Segurança** | Autenticação, RLS, cookies, CORS, headers, API keys expostas, prompt injection, service_role usage | Crítica |
| 02 | **Auditoria de Arquitetura de Estado** | Cadeia de herança, tamanho do QCState, acoplamento entre states e services, computed vars | Alta |
| 03 | **Auditoria de Lógica de Negócio** | Westgard (corretude das 6 regras), CV% calculation, status determination, edge cases | Alta |
| 04 | **Auditoria de Banco de Dados** | Schema consistency, migrações avulsas vs numeradas, RLS coverage, RPCs, índices, performance | Alta |
| 05 | **Auditoria de Services** | Consistência CRUD, error handling, admin vs anon, transações, retry, caching | Média-Alta |
| 06 | **Auditoria de UI/UX e Componentes** | Acessibilidade, responsividade, consistência visual, modais, estados de loading/error | Média |
| 07 | **Auditoria de Performance** | Queries N+1, paginação, cache, bundle size, lazy loading, WebSocket overhead | Média |
| 08 | **Auditoria de Testes** | Cobertura real, testes unitários vs E2E, mocks, CI pipeline, edge cases não testados | Média |
| 09 | **Auditoria de Infraestrutura e Deploy** | Dockerfile, Nginx config, Railway, health checks, logs, monitoramento, backup | Média |
| 10 | **Auditoria de Código Legado e Dívida Técnica** | Campos deprecated, auditoria financeira órfã, .venv commitado, arquivos desnecessários | Baixa-Média |
| 11 | **Auditoria de Integrações (IA + n8n)** | Voice-to-form robustez, n8n workflows, Gemini prompt safety, fallbacks | Baixa-Média |
| 12 | **Auditoria de Produto** | Features vs necessidades reais, roadmap técnico, gap analysis funcional | Estratégica |

---

*Documento gerado automaticamente como parte do processo de revisão geral do sistema Biodiagnóstico.*
*Nenhuma alteração foi feita no código-fonte ou na infraestrutura.*
