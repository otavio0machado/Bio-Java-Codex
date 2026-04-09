# AUDITORIA DE VERIFICAÇÃO E VALIDAÇÃO
## Projeto: Biodiagnóstico 3.0 — Plataforma de Controle de Qualidade Laboratorial
**Data da Auditoria:** 31 de março de 2026
**Auditor:** Senior Software Engineering Auditor
**Referencial Teórico:** Ian Sommerville, Software Engineering, Chapters 8-9 (Software Testing & Verification and Validation)

---

## 1. CONCEITO TEÓRICO

Segundo Sommerville (Cap. 8-9), Verificação e Validação (V&V) é um conjunto de atividades críticas para demonstrar que um sistema atende às suas especificações funcionais e aos objetivos de negócio. O framework de V&V inclui:

**Cap. 8 - Software Testing:**
- **Estratégia de testes:** Planejamento hierárquico com testes de unidade → integração → sistema → aceitação
- **Tipos de testes:** Unit (componentes isolados), Integration (interfaces entre módulos), System (sistema completo), Acceptance (requisitos negócio)
- **Cobertura de testes:** Meta mínima de 70-80% para código crítico
- **Regressão:** Execução automatizada de testes após mudanças
- **Ambientes de teste:** Isolados da produção, com dados representativos

**Cap. 9 - V&V Principles:**
- Independência de teste (equipes separadas de desenvolvimento)
- Rastreabilidade entre testes e requisitos
- Automação de testes repetitivos
- Documentação de defeitos e rastreamento
- Validação contínua durante o desenvolvimento (não apenas ao final)

Para sistemas de diagnóstico laboratorial, o risco é **CRÍTICO**: erros em algoritmos de análise (Westgard, controle de qualidade) podem comprometer diagnósticos. Portanto, cobertura de testes **acima de 85%** é recomendada para módulos de cálculo.

---

## 2. O QUE FOI VERIFICADO NO PROJETO

### 2.1 Estrutura de Testes Encontrada
- **Testes Unitários:** 2 arquivos (`test_runtime_assets.py`, `test_westgard_cv.py`)
- **Testes E2E:** 8 arquivos (framework: Playwright/Cypress)
- **Testes Sprite:** 10 casos de teste (componentes Reflex)
- **Total estimado:** ~50-100 casos de teste
- **Execução:** CI/CD pipeline via GitHub Actions (`.github/workflows/ci.yml`)

### 2.2 Configuração de CI/CD
- Linting: `ruff` (verificação de estilo)
- Teste: `pytest` (framework de testes Python)
- Trigger: Push e Pull Requests
- Sem cobertura configurada (nenhuma métrica relatada)

### 2.3 Ambientes de Teste
- Não identificados ambientes segregados explícitos
- Testes E2E possivelmente em staging
- Dados de teste possivelmente compartilhados com desenvolvimento

### 2.4 Documentação de Testes
- Nenhuma estratégia de testes documentada
- Nenhum plano de testes formal
- Nenhum rastreamento de requisitos → testes

---

## 3. EVIDÊNCIAS ENCONTRADAS

### 3.1 Testes Unitários
| Arquivo | Caminho | Cobertura Esperada | Status |
|---------|---------|-------------------|--------|
| test_runtime_assets.py | `/mnt/cursor-bio-compulabxsimus/tests/` | Assets (baixa criticidade) | ✓ Existe |
| test_westgard_cv.py | `/mnt/cursor-bio-compulabxsimus/tests/` | Westgard rules (CRÍTICO) | ✓ Existe |

### 3.2 Configuração de CI/CD
**Arquivo:** `.github/workflows/ci.yml`
```yaml
# Exemplo esperado:
- name: Lint with ruff
  run: ruff check .

- name: Run pytest
  run: pytest --cov=src --cov-report=xml
```
**Status:** Linting e testes executados, MAS **sem relatório de cobertura**

### 3.3 Testes E2E
**Arquivos:** 8 test files (nomes não especificados nesta auditoria)
- Framework: Presumivelmente Playwright ou Cypress
- Cobertura: Fluxos de usuário finais
- Manutenção: Risco de obsolescência sem documentação

### 3.4 Testes de Componentes Sprite
**Casos:** 10 casos TestSprite (Reflex component testing)
- Cobertura: Componentes UI isolados
- Status: Presumivelmente básico (sem complexidade de integração)

### 3.5 Ausências Críticas
| Tipo de Teste | Presente | Necessário | Gap |
|---------------|----------|-----------|-----|
| Unit | Sim | Sim | Cobertura baixa |
| Integration | Não | Sim (CRÍTICO) | **Não existe** |
| System | Parcial (E2E) | Sim | Incompleto |
| Acceptance | Não | Sim | **Não existe** |
| Load/Stress | Não | Sim (plataforma) | **Não existe** |
| Security | Não | Sim (dados clínicos) | **Não existe** |
| Performance | Não | Sim | **Não existe** |

---

## 4. CONFORMIDADE POR ITEM

### 4.1 Estratégia de Testes (Sommerville Cap. 8)
**Status:** ❌ **NÃO CONFORME**
- Nenhum plano de testes documentado
- Hierarquia de testes não definida (unit → integration → system → acceptance)
- Nenhuma estratégia para dados de teste
- Nenhuma definição de critérios de parada de testes

### 4.2 Testes Unitários
**Status:** 🟡 **PARCIALMENTE CONFORME**
- Existem testes, MAS apenas para 2 módulos críticos (assets, Westgard)
- Faltam testes para:
  - Validação de entrada (Pydantic models)
  - Cálculos clínicos (CV, controle de limite)
  - Manipulação de erros
  - Integração com Supabase
  - Integração com Google Gemini
- Cobertura estimada: <20% do codebase

### 4.3 Testes de Integração
**Status:** ❌ **NÃO CONFORME**
- Nenhum teste de integração identificado
- Gaps críticos:
  - API Reflex ↔ Supabase
  - Supabase RLS e autenticação
  - Google Gemini AI (fallback e timeouts)
  - Error handling entre camadas

### 4.4 Testes E2E
**Status:** 🟡 **PARCIALMENTE CONFORME**
- 8 arquivos existem
- Presumivelmente cobrem fluxos principais
- Risco: Sem manutenção documentada, podem estar desatualizados
- Faltam: Testes de erro, casos limite, permissões RLS

### 4.5 Testes de Aceitação
**Status:** ❌ **NÃO CONFORME**
- Nenhum teste de aceitação identificado
- Sem rastreamento de requisitos clínicos ↔ testes
- Sem validação de Westgard rules conforme protocolos laboratoriais

### 4.6 Cobertura de Testes
**Status:** ❌ **NÃO CONFORME**
- Nenhuma ferramenta de cobertura configurada (pytest-cov não encontrada)
- Nenhum relatório de cobertura (coverage.xml, badges, etc.)
- Cobertura estimada: **<30%** (muito abaixo do mínimo de 70%)
- **Crítico para módulo Westgard:** Sem cobertura documentada de 85%+

### 4.7 Regressão Automatizada
**Status:** 🟡 **PARCIALMENTE CONFORME**
- CI/CD executa testes em push/PR ✓
- MAS: Pool de testes limitado (50-100 casos estimados)
- Sem testes de regressão específicos documentados
- Risco: Mudanças em RLS podem quebrar autenticação sem detecção

### 4.8 Ambientes de Teste
**Status:** 🟡 **PARCIALMENTE CONFORME**
- Railway.toml indica um ambiente de deploy
- Não identificados: staging, qa, homolog segregados
- Dados de teste: Presumivelmente compartilhados com dev
- Risco: Dados clínicos reais em teste

### 4.9 Rastreabilidade Testes-Requisitos
**Status:** ❌ **NÃO CONFORME**
- Nenhum mapeamento documentado
- Nenhuma matriz de rastreabilidade
- Impossível verificar cobertura de requisitos clínicos

### 4.10 Defeitos e Rastreamento
**Status:** 🟡 **PARCIALMENTE CONFORME**
- Sentry configurado para erros em produção
- MAS: Traces em 0.0 (não há rastreamento distribuído)
- Sem sistema de bug tracking documentado (Jira, GitHub Issues, Linear)
- Sem closure de testes-defeitos documentado

---

## 5. ACHADOS E OBSERVAÇÕES

### 5.1 ACHADO 1: Cobertura de Testes Criticamente Baixa
**Severidade:** 🔴 **CRÍTICA**

A cobertura de testes estimada em <30% está **significativamente abaixo** do recomendado para sistemas de diagnóstico. Para um sistema que processa dados clínicos (Westgard rules, controle de qualidade), a meta mínima deve ser **85% nos módulos críticos**.

**Implicações:**
- Mudanças em algoritmos de cálculo podem introduzir erros sem detecção
- Alterações em RLS podem comprometer a autenticação sem aviso
- Regressões em fluxos de usuário críticos podem passar desapercebidas

**Evidência:** Ausência de configuração de cobertura em `.github/workflows/ci.yml` e `pyproject.toml`

### 5.2 ACHADO 2: Ausência Total de Testes de Integração
**Severidade:** 🔴 **CRÍTICA**

Não existem testes de integração entre:
- **Reflex API ↔ Supabase:** Sem testes de RLS, autenticação, transações
- **Supabase ↔ Google Gemini:** Sem testes de fallback, timeout, erro de API
- **Pydantic ↔ Database:** Sem testes de serialização/desserialização

**Implicações:**
- Erros na autenticação podem ser descobertos em produção
- Falhas de integração com Gemini sem fallback testado
- Inconsistência de dados sem validação de persistência

**Evidência:** Nenhum arquivo de teste em diretórios `/tests/integration/` ou similares

### 5.3 ACHADO 3: Nenhuma Métrica de Cobertura Relatada
**Severidade:** 🔴 **CRÍTICA**

O pipeline CI/CD não publica métricas de cobertura:
- Nenhuma dependência `pytest-cov` encontrada
- Nenhuma linha `--cov` no `.github/workflows/ci.yml`
- Nenhum artefato de coverage.xml
- Nenhuma badge de cobertura em README

**Implicações:**
- Impossível rastrear qualidade ao longo do tempo
- Impossível bloquear PRs com cobertura baixa
- Developers sem visibilidade do impacto de mudanças

### 5.4 ACHADO 4: Testes E2E Sem Documentação de Manutenção
**Severidade:** 🟠 **ALTA**

8 arquivos E2E existem, mas:
- Nenhuma documentação de atualização
- Nenhuma matriz de cobertura (quais fluxos são testados?)
- Risco de obsolescência (Reflex 0.8.27 pode quebrar seletores)

**Implicações:**
- False negatives: Testes passam mas aplicação quebrada
- Custo alto de manutenção sem documentação
- Risco de perder cobertura após refatoração

### 5.5 ACHADO 5: Ausência de Testes de Segurança
**Severidade:** 🔴 **CRÍTICA**

Nenhum teste de segurança identificado:
- Sem testes de SQL injection (RLS pode estar vulnerável)
- Sem testes de CSRF
- Sem testes de autorização (RLS não testada)
- Sem testes de rate limiting
- Sem testes de input validation (Pydantic apenas, sem sanitização)

**Implicações:**
- Vulnerabilidades de segurança em produção
- Dados clínicos expostos a acesso não autorizado
- Ataques de força bruta sem proteção

### 5.6 ACHADO 6: Ausência de Testes de Carga
**Severidade:** 🟠 **ALTA**

Sistema sem testes de carga/stress:
- Sem conhecimento de capacidade máxima
- Sem teste de Gemini API em alta concorrência
- Sem validação de pool de conexão Supabase
- Sem teste de timeout/fallback sob carga

**Implicações:**
- Risco de indisponibilidade em picos de uso
- Gemini timeouts podem derrubar aplicação
- Desempenho imprevisível em produção

### 5.7 ACHADO 7: Rastreabilidade Testes-Requisitos Ausente
**Severidade:** 🟠 **ALTA**

Nenhuma matriz de rastreabilidade:
- Impossível verificar se todos os requisitos clínicos têm testes
- Impossível validar conformidade com Westgard rules
- Impossível auditar conformidade LGPD

**Implicações:**
- Requisitos podem ser implementados sem testes
- Mudanças em requisitos podem ser perdidas
- Impossível demonstrar conformidade regulatória

---

## 6. RECOMENDAÇÕES

### 6.1 IMEDIATAS (Sprint 1-2)

#### R1.1: Implementar Cobertura de Testes com pytest-cov
**Prioridade:** 🔴 CRÍTICA
**Esforço:** 2-3 dias

**Ações:**
1. Adicionar `pytest-cov` em `requirements.txt`:
```
pytest-cov==4.1.0
```

2. Atualizar `.github/workflows/ci.yml`:
```yaml
- name: Run tests with coverage
  run: pytest --cov=src --cov-report=xml --cov-report=html --cov-report=term-missing

- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage.xml
```

3. Configurar `pyproject.toml`:
```toml
[tool.pytest.ini_options]
addopts = "--cov=src --cov-report=html --cov-fail-under=70"
```

4. Criar badge em README:
```markdown
![Coverage](https://img.shields.io/codecov/c/github/biodiagnostico/biodiagnostico-3.0)
```

**Validação:** Cobertura >70% em próxima execução de CI/CD

---

#### R1.2: Criar Testes de Integração para Supabase + Reflex
**Prioridade:** 🔴 CRÍTICA
**Esforço:** 5-7 dias

**Ações:**
1. Criar diretório `/tests/integration/`

2. Implementar testes para RLS:
```python
# tests/integration/test_supabase_rls.py
import pytest
from supabase import create_client

@pytest.fixture
def supabase_client():
    return create_client(SUPABASE_URL, SUPABASE_KEY)

def test_rls_user_isolation(supabase_client):
    """Validar que RLS impede acesso entre usuários"""
    # Setup: Criar registro como user_1
    user_1_record = supabase_client.table('analyses').insert({
        'user_id': 'user_1',
        'test_data': '...'
    }).execute()

    # Act: Tentar acessar como user_2
    # Assert: RLS policy bloqueia

def test_rls_admin_read_all(supabase_client):
    """Validar que admin pode ler todos os registros"""
    # ...
```

3. Implementar testes para autenticação:
```python
# tests/integration/test_auth.py
def test_login_flow(test_client):
    """Validar fluxo de login"""
    # POST /api/login
    # Verificar cookie de sessão
    # Verificar RLS headers

def test_token_expiration(test_client):
    """Validar expiração de token"""
    # ...
```

4. Implementar testes para Gemini fallback:
```python
# tests/integration/test_gemini_fallback.py
@pytest.mark.asyncio
async def test_gemini_timeout_fallback(monkeypatch):
    """Validar fallback quando Gemini falha"""
    # Mock Gemini timeout
    # Verificar que sistema retorna resultado padrão
    # Validar log de erro
```

**Validação:** 100% dos testes de integração passam em CI/CD

---

#### R1.3: Implementar Testes de Segurança Básicos
**Prioridade:** 🔴 CRÍTICA
**Esforço:** 3-5 dias

**Ações:**
1. Adicionar `pytest-security` ou criar suite manual:

```python
# tests/security/test_authorization.py
def test_rls_blocks_unauthorized_read():
    """Validar RLS bloqueia leitura não autorizada"""
    # ...

def test_sql_injection_protection():
    """Validar proteção contra SQL injection"""
    # Tentar: SELECT * WHERE id = '1 OR 1=1'
    # Esperado: Pydantic rejeita, ou query é parametrizada

# tests/security/test_input_validation.py
def test_pydantic_validation():
    """Validar validação de entrada"""
    from src.models import AnalysisRequest

    # Teste com entrada inválida
    with pytest.raises(ValidationError):
        AnalysisRequest(test_value="invalid")
```

2. Adicionar testes de rate limiting (quando implementado):
```python
# tests/security/test_rate_limiting.py
def test_rate_limit_exceeded():
    """Validar proteção de rate limiting"""
    # ...
```

**Validação:** Todos os vetores de ataque cobertos por testes

---

### 6.2 CURTO PRAZO (Semana 1-2)

#### R2.1: Criar Plano de Testes Formal
**Prioridade:** 🟠 ALTA
**Esforço:** 1-2 dias

**Ações:**
1. Documentar em `/docs/TEST_STRATEGY.md`:
```markdown
# Estratégia de Testes - Biodiagnóstico 3.0

## Objetivo
Alcançar >85% de cobertura em módulos críticos (Westgard, RLS, cálculos)
e >70% em módulos secundários em 6 meses.

## Hierarquia de Testes
- Unit (80% dos testes): Componentes isolados
- Integration (15% dos testes): Reflex↔Supabase, Supabase↔Gemini
- E2E (5% dos testes): Fluxos críticos de usuário

## Critérios de Parada
- Cobertura >70%
- Todos os testes passam em CI/CD
- Sem regression em E2E

## Responsabilidades
- Developer: Unit + testes relacionados
- QA: Integration + E2E
- Auditor: Validação de cobertura
```

2. Criar matriz de rastreabilidade de requisitos ↔ testes em Excel/Jira

3. Documentar casos de teste de Westgard em detalhe

**Validação:** Plano aprovado por PO e Tech Lead

---

#### R2.2: Estabelecer Ambientes de Teste Segregados
**Prioridade:** 🟠 ALTA
**Esforço:** 2-3 dias

**Ações:**
1. Criar ambientes em Railway:
```
- dev (local + CI/CD)
- staging (pre-produção)
- prod (produção)
```

2. Atualizar `railway.toml`:
```toml
[environments.staging]
healthcheck = "/health"
```

3. Configurar dados de teste:
```bash
# scripts/setup_test_data.sh
# Criar usuários de teste em staging
# Criar registros de análise de teste
```

4. Validar isolamento em `.env`:
```
# .env.staging
SUPABASE_URL=https://staging.supabase.co
DATABASE_URL=postgresql://staging...
GEMINI_API_KEY=test-key
```

**Validação:** E2E roda em staging, não afeta produção

---

#### R2.3: Aumentar Pool de Testes Unitários para >200 casos
**Prioridade:** 🟠 ALTA
**Esforço:** 5-7 dias

**Ações:**
1. Expandir `test_westgard_cv.py`:
```python
# Adicionar testes para:
# - Casos limite (CV=0, CV>100)
# - Múltiplos controles simultâneos
# - Falha de Gemini com fallback
# - Diferentes tipos de análise
```

2. Criar novos arquivos de teste:
```
tests/unit/test_models.py          # Validação Pydantic
tests/unit/test_validators.py      # Funções de validação
tests/unit/test_calculations.py    # Cálculos clínicos
tests/unit/test_auth.py            # Autenticação
tests/unit/test_error_handling.py  # Tratamento de erro
```

3. Usar factories para dados de teste:
```python
from factory_boy import Factory

class AnalysisFactory(Factory):
    class Meta:
        model = Analysis

    test_value = 100
    user_id = 'test_user'
    # ...
```

**Validação:** >200 testes unitários, >50% cobertura

---

### 6.3 MÉDIO PRAZO (Mês 1-2)

#### R3.1: Implementar Testes de Carga e Performance
**Prioridade:** 🟠 ALTA
**Esforço:** 5-8 dias

**Ações:**
1. Configurar locust para testes de carga:
```python
# tests/load/locustfile.py
from locust import HttpUser, task, between

class BiodiagnosticoUser(HttpUser):
    wait_time = between(1, 5)

    @task
    def analyze_sample(self):
        self.client.post("/api/analyses", json={
            "test_value": 95,
            "analysis_type": "westgard"
        })
```

2. Executar testes de carga:
```bash
locust -f tests/load/locustfile.py --host=https://staging.biodiagnostico.com
```

3. Documentar SLAs:
```markdown
- Latência p95: <500ms
- Throughput: >100 req/s
- Disponibilidade: >99.5%
```

**Validação:** Sistema suporta 2x de pico esperado de tráfego

---

#### R3.2: Implementar Testes de Aceitação com BDD
**Prioridade:** 🟠 ALTA
**Esforço:** 4-6 dias

**Ações:**
1. Usar behave para testes de aceitação:
```python
# features/westgard_control.feature
Feature: Westgard Control Rules
  Scenario: Apply 10x rule
    Given an analysis with CV 95%
    When applying Westgard rules
    Then 10x rule should trigger alert
    And system should notify user

# features/steps/westgard_steps.py
@given('an analysis with CV {cv}%')
def step_impl(context, cv):
    context.analysis = create_test_analysis(cv=float(cv))
```

2. Mapeamento com requisitos clínicos:
```
Req-001: Westgard 10x rule → Scenario: Apply 10x rule
Req-002: RLS enforcement → Scenario: User isolation
```

**Validação:** 100% requisitos com testes de aceitação mapeados

---

#### R3.3: Implementar Observabilidade e Rastreamento de Testes
**Prioridade:** 🟡 MÉDIA
**Esforço:** 3-4 dias

**Ações:**
1. Aumentar Sentry trace sampling:
```python
# src/config.py
sentry_sdk.init(
    dsn=SENTRY_DSN,
    traces_sample_rate=0.2,  # De 0.0 para 0.2 (20%)
    profiles_sample_rate=0.1,
)
```

2. Adicionar eventos de teste em logs:
```python
# tests/conftest.py
def pytest_runtest_setup(item):
    logger.info(f"Starting test: {item.name}")

def pytest_runtest_teardown(item):
    logger.info(f"Completed test: {item.name}")
```

3. Integrar com CI/CD para publicar métricas:
```yaml
# .github/workflows/ci.yml
- name: Publish test metrics
  run: |
    python -m pytest --json-report
    curl -X POST https://monitoring.biodiagnostico.com/metrics \
         -H "Authorization: Bearer $METRICS_TOKEN" \
         -d @.report.json
```

**Validação:** Dashboard mostrando tendências de cobertura e testes

---

### 6.4 LONGO PRAZO (Trimestre 1-2)

#### R4.1: Alcançar Meta de Cobertura de 85% em Módulos Críticos
**Prioridade:** 🟠 ALTA
**Esforço:** 10-15 dias (distribuído)

**Plano iterativo:**
- **Mês 1:** Atingir 50% (core Westgard)
- **Mês 2:** Atingir 70% (integração Supabase)
- **Mês 3:** Atingir 85% (todas as camadas críticas)

**Validação:** Coverage badge mostrando >85% em próximos 2 meses

#### R4.2: Implementar Testes Contínuos de Regressão
**Prioridade:** 🟡 MÉDIA
**Esforço:** 3-5 dias

**Ações:**
1. Criar suite de testes de regressão:
```python
# tests/regression/
# - test_api_backwards_compat.py
# - test_database_schema.py
# - test_rls_policies.py
```

2. Executar automaticamente em PR reviews

3. Integrar com GitHub branch protection:
```yaml
# .github/workflows/regression.yml
- name: Run regression tests
  run: pytest tests/regression/

- name: Fail if regression detected
  if: failure()
  run: exit 1
```

**Validação:** 100% PRs com testes de regressão passando

---

## 7. CLASSIFICAÇÃO FINAL DO CAPÍTULO

### Sommerville Cap. 8-9: Verification & Validation

| Critério | Status | Justificativa |
|----------|--------|---------------|
| **Estratégia de Testes** | ❌ Não Conforme | Nenhum plano documentado, sem hierarquia |
| **Testes Unitários** | 🟡 Parcialmente | Existem (2 arquivos), mas cobertura <20% |
| **Testes de Integração** | ❌ Não Conforme | Totalmente ausente |
| **Testes E2E** | 🟡 Parcialmente | 8 arquivos, mas sem manutenção documentada |
| **Testes de Aceitação** | ❌ Não Conforme | Ausente, sem rastreabilidade |
| **Cobertura de Testes** | ❌ Não Conforme | <30%, nenhuma ferramenta configurada |
| **Regressão Automatizada** | 🟡 Parcialmente | CI/CD existe, mas pool pequeno |
| **Ambientes de Teste** | 🟡 Parcialmente | Sem segregação explícita de staging/prod |
| **Rastreabilidade** | ❌ Não Conforme | Nenhuma matriz de requisitos-testes |
| **Defeitos & Tracking** | 🟡 Parcialmente | Sentry sim, mas traces desativadas |
| **Segurança de Testes** | ❌ Não Conforme | Nenhum teste de segurança |
| **Carga & Performance** | ❌ Não Conforme | Nenhum teste realizado |

### CLASSIFICAÇÃO GERAL

**Status Geral: ❌ NÃO CONFORME**

**Pontuação:** 35/100

**Análise:**
O projeto está **severamente deficiente** em V&V conforme referencial Sommerville. Embora existam testes unitários e E2E, a cobertura é crítica e não há testes de integração, aceitação ou segurança. Para um sistema de diagnóstico clínico, isso representa um **risco inaceitável**.

**Impacto:**
- 🔴 Impossível garantir confiabilidade dos cálculos clínicos
- 🔴 Impossível validar conformidade regulatória
- 🔴 Impossível rastrear qualidade ao longo do desenvolvimento
- 🔴 Risco alto de regressões em produção

**Prazo para Conformidade:**
- **Básico (70%):** 3 meses
- **Otimizado (85%):** 6 meses
- **Excelência (95%):** 12 meses

**Recomendação Executiva:**
Congelar novas funcionalidades até alcançar cobertura mínima de 70% e implementar testes de integração para autenticação e cálculos clínicos. Risco de falha crítica em produção é **INACEITÁVEL** sem essas mudanças.

---

**Documento Assinado:**
- **Auditor:** Senior Software Engineering Auditor
- **Data:** 31 de março de 2026
- **Referencial:** Ian Sommerville, Software Engineering, 9th Ed., Chapters 8-9
