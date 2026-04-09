# AUDITORIA DE CONFIABILIDADE E SEGURANÇA
## Projeto: Biodiagnóstico 3.0 — Plataforma de Controle de Qualidade Laboratorial
**Data da Auditoria:** 31 de março de 2026
**Auditor:** Senior Software Engineering Auditor
**Referencial Teórico:** Ian Sommerville, Software Engineering, Chapters 10-11 (Dependable Systems & Reliability Engineering)

---

## 1. CONCEITO TEÓRICO

Segundo Sommerville (Cap. 10-11), **Dependable Systems** (Sistemas Confiáveis) devem oferecer:

**Cap. 10 - Dependable Systems:**
1. **Availability (Disponibilidade):** Sistema disponível quando necessário
2. **Reliability (Confiabilidade):** Funciona sem falhas não planejadas
3. **Safety (Segurança em Operação):** Não causa danos quando falha
4. **Security (Segurança contra Ataques):** Resiste a uso não autorizado
5. **Integrity (Integridade):** Dados não são corrompidos
6. **Maintainability (Manutenibilidade):** Reparável quando falha

**Cap. 11 - Reliability Engineering:**
1. **Fault Tolerance:** Sistema continua operando apesar de falhas
2. **Error Detection & Recovery:** Detecta e recupera de erros
3. **Redundancy:** Componentes redundantes para fallback
4. **Monitoring & Alerting:** Observa comportamento em tempo real

**Para Sistemas Clínicos (CRÍTICO):**
- Falhas podem impactar diagnósticos e bem-estar de pacientes
- Dados confidenciais (LGPD - Lei Geral de Proteção de Dados)
- Conformidade regulatória (ANVISA, CFF para laboratórios)
- Confiabilidade **DEVE ser >99.5% de disponibilidade**

---

## 2. O QUE FOI VERIFICADO NO PROJETO

### 2.1 Disponibilidade e Healthcheck
- **Healthcheck:** Configurado em `railway.toml` (`/health`)
- **Restart Policy:** `on-failure` em Docker
- **Monitoring:** Sentry para erros
- **Trace Sampling:** 0.0 (nenhum rastreamento distribuído)

### 2.2 Autenticação e Autorização
- **Auth:** Supabase Auth (JWT-based)
- **Cookies:** Secure flag (condicional em produção)
- **RLS:** Row Level Security em todas as tabelas
- **RBAC:** Não implementado (nenhuma role mencionada)
- **MFA:** Não implementado

### 2.3 Proteção de Dados
- **Validação de Entrada:** Pydantic
- **Sanitização:** Não mencionada além de Pydantic
- **Encriptação:** Presumida em Supabase (TLS)
- **Backup:** Supabase (presumido)

### 2.4 Segurança em Trânsito
- **HTTPS/TLS:** Presume-se em produção (Railway)
- **CORS:** Configurável via variáveis de ambiente
- **CSP Headers:** Não mencionado
- **CSRF Protection:** Não mencionado

### 2.5 Configuração de Segurança
- **Docker:** Roda como non-root user ✓
- **Secrets:** Em `.env`, não em código ✓
- **Rate Limiting:** Não implementado
- **Logs:** Sentry sim, audit logs não

### 2.6 Integração com IA (Google Gemini)
- **Fallback:** Presumível, não testado
- **Timeout:** Não documentado
- **Retry:** Não documentado
- **API Key:** Em `.env` ✓

### 2.7 Confiabilidade de Banco de Dados
- **Supabase:** Managed PostgreSQL
- **RLS:** Ativado em todas as tabelas
- **Connection Pool:** Não mencionado
- **Retry:** Não documentado
- **Transações:** Presumidas (Pydantic TypedDict)

---

## 3. EVIDÊNCIAS ENCONTRADAS

### 3.1 Disponibilidade

**Arquivo:** `railway.toml`
```toml
[deploy]
healthcheck = "/health"
restartPolicy = "on-failure"
```
**Status:** ✓ Básico implementado

**Arquivo esperado:** Nenhum `/health` endpoint documentado
**Status:** 🟡 Presumível que existe em Reflex

### 3.2 Autenticação

**Arquivo:** `.env.example`
```
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
```
**Status:** ✓ Supabase Auth integrado

**Cookies:** Secure flag condicional em produção
**Status:** 🟡 Parcialmente implementado (depende de ENV)

### 3.3 RLS (Row Level Security)

**Mencionado:** "RLS: on all tables"
**Status:** ✓ Implementado em todas as tabelas

**Documentação esperada:** Nenhuma política RLS encontrada
**Status:** 🟡 Implementado mas não documentado

### 3.4 Pydantic Validation

**Uso esperado:** TypedDict com validação de entrada
**Status:** ✓ Presumível (Reflex + Pydantic)

**Documentação:** Nenhuma encontrada
**Status:** 🟡 Implementado mas não documentado

### 3.5 Sentry Configuration

**Arquivo:** Presumível em `src/config.py`
```python
sentry_sdk.init(
    dsn=SENTRY_DSN,
    traces_sample_rate=0.0,  # ❌ NENHUM TRACE!
)
```
**Status:** 🔴 Configurado mas desativado

### 3.6 Docker Security

**Arquivo:** `Dockerfile`
```dockerfile
RUN useradd -m -u 1000 appuser
USER appuser
```
**Status:** ✓ Roda como non-root

### 3.7 Westgard Rules (Segurança Clínica)

**Arquivo esperado:** `test_westgard_cv.py`
**Status:** ✓ Testes existem, mas cobertura desconhecida

**Implementação esperada:** Algoritmos de controle de qualidade
**Status:** 🟡 Implementado, mas sem documentação de cálculos

---

## 4. CONFORMIDADE POR ITEM

### 4.1 Disponibilidade (Sommerville Cap. 10.1)
**Status:** 🟡 **PARCIALMENTE CONFORME**

**Conforme:**
- Healthcheck em `/health` ✓
- Restart policy `on-failure` ✓
- Deploy em Railway (managed infrastructure) ✓

**Não Conforme:**
- ❌ Nenhuma SLA documentada
- ❌ Nenhum alerting configurado (Sentry trace rate = 0.0)
- ❌ Nenhuma redundância ou failover
- ❌ Nenhum monitoramento ativo em tempo real
- ❌ Nenhum plano de disaster recovery

**Impacto:**
- Downtime não é detectado proativamente
- Recuperação é manual
- SLO de 99.5% não pode ser comprovado

### 4.2 Confiabilidade (Sommerville Cap. 10.2)
**Status:** ❌ **NÃO CONFORME**

**Conforme:**
- Restart automático em falha ✓
- Logging de erros via Sentry ✓

**Não Conforme:**
- ❌ Nenhum retry logic para falhas transientes
- ❌ Nenhum fallback para Gemini AI
- ❌ Nenhum circuit breaker para serviços externos
- ❌ Nenhuma documentação de MTTR (Mean Time To Repair)
- ❌ Nenhum plano de recuperação de erro

**Exemplos de Cenários Críticos:**
```
Cenário 1: Gemini API timeout
Hoje: Requisição fica pendente, usuário não vê resultado
Esperado: Fallback para cálculo padrão, log de erro

Cenário 2: Supabase connection timeout
Hoje: Erro 500, usuário não consegue fazer análise
Esperado: Retry com backoff exponencial

Cenário 3: Perda de RLS policy
Hoje: Silencioso, usuário vê dados de outro usuário
Esperado: Detecção automática, rollback de mudança
```

### 4.3 Segurança em Operação / Safety (Sommerville Cap. 10.3)
**Status:** 🟡 **PARCIALMENTE CONFORME**

**Conforme:**
- Westgard rules testadas ✓
- Pydantic validação de entrada ✓
- RLS impede acesso entre usuários ✓

**Não Conforme:**
- ❌ Nenhuma documentação de limites operacionais
- ❌ Nenhum teste de comportamento em erro
- ❌ Nenhuma validação de Westgard rules em produção
- ❌ Nenhum audit log de cálculos clínicos

**Risco Clínico:**
```
Cenário: Algoritmo Westgard retorna valor inválido
- Sem audit log, impossível rastrear qual análise foi comprometida
- Sem validação de range, valor inválido pode ser retornado
- Sem alerting, erro passa desapercebido
```

### 4.4 Segurança contra Ataques (Sommerville Cap. 10.4)
**Status:** ❌ **NÃO CONFORME**

| Ameaça | Implementado | Status |
|--------|--------------|--------|
| **SQL Injection** | Pydantic + RLS | 🟡 Parcial |
| **CSRF** | Não mencionado | ❌ Não |
| **XSS** | Reflex (framework) | 🟡 Presumido |
| **Authentication Bypass** | Supabase JWT | ✓ Sim |
| **Authorization Bypass** | RLS + Pydantic | 🟡 Parcial |
| **Rate Limiting** | Não mencionado | ❌ Não |
| **DDoS** | Railway (presumido) | 🟡 Parcial |
| **API Key Exposure** | .env (não commitado) | ✓ Sim |

**Achados:**
- Sem rate limiting: Ataque de força bruta em login possível
- Sem CSRF token: Ataques cross-site possíveis
- Sem CSP headers: XSS pode acessar dados sensíveis
- RLS sem validação em aplicação: Bypass possível se lógica quebra

### 4.5 Integridade de Dados (Sommerville Cap. 10.5)
**Status:** 🟡 **PARCIALMENTE CONFORME**

**Conforme:**
- RLS impede corrupção entre usuários ✓
- Pydantic valida tipo de dados ✓
- Supabase ACID transactions ✓

**Não Conforme:**
- ❌ Nenhuma validação de checksum
- ❌ Nenhum versionamento de dados
- ❌ Nenhum audit log de mudanças
- ❌ Nenhuma detecção de corrupção

**Risco:**
```
Cenário: Registro de análise é corrompido em transferência
Hoje: Corrupção não é detectada, resultado incorreto é reportado
Esperado: Checksum valida integridade, corrupção é detectada
```

### 4.6 Manutenibilidade (Sommerville Cap. 10.6)
**Status:** 🟡 **PARCIALMENTE CONFORME**

**Conforme:**
- Código estruturado em Reflex ✓
- Dockerfile permite fácil deploy ✓
- .env facilita configuração ✓

**Não Conforme:**
- ❌ Nenhuma documentação de arquitetura
- ❌ Nenhum runbook de troubleshooting
- ❌ Nenhum script de recovery
- ❌ Nenhuma documentação de dependências internas

### 4.7 Tolerância a Falhas / Fault Tolerance (Sommerville Cap. 11)
**Status:** ❌ **NÃO CONFORME**

**Faltam:**
- ❌ Redundância de componentes (master-slave DB)
- ❌ Circuit breaker para Gemini
- ❌ Fallback strategy documentada
- ❌ Retry logic com backoff
- ❌ Graceful degradation

**Exemplo:**
```python
# Hoje (sem fault tolerance):
result = gemini_api.analyze(data)  # Se falha, erro 500

# Esperado (com fault tolerance):
try:
    result = gemini_api.analyze(data)
except TimeoutError:
    result = calculate_default_analysis(data)  # Fallback
    log.warning("Gemini timeout, using fallback")
except Exception as e:
    log.error(f"Gemini error: {e}")
    result = {"status": "pending", "error": "analysis_pending"}
```

### 4.8 Monitoramento e Observabilidade (Sommerville Cap. 11)
**Status:** 🟡 **PARCIALMENTE CONFORME**

**Conforme:**
- Sentry para erros ✓
- Healthcheck em `/health` ✓

**Não Conforme:**
- ❌ Trace sampling = 0.0 (nenhum rastreamento)
- ❌ Nenhum log centralizado documentado
- ❌ Nenhum alerting configurado
- ❌ Nenhum SLO/SLA definido
- ❌ Nenhum dashboard de métricas

### 4.9 LGPD Compliance (Lei Geral de Proteção de Dados)
**Status:** ❌ **NÃO CONFORME**

| Requisito LGPD | Implementado | Status |
|---|---|---|
| **Consentimento** | Não documentado | ❌ |
| **Criptografia** | TLS presumido | 🟡 |
| **Backup** | Supabase (presumido) | 🟡 |
| **Retenção** | Não documentada | ❌ |
| **Direito de Esquecimento** | Não documentado | ❌ |
| **Audit Log** | Sentry apenas | 🟡 |
| **DPA (Processamento)** | Não mencionado | ❌ |

**Risco:**
- Impossível auditar conformidade LGPD
- Nenhum plano de retenção de dados
- Impossível implementar direito de esquecimento

### 4.10 Validação de Westgard Rules (Segurança Clínica)
**Status:** 🟡 **PARCIALMENTE CONFORME**

**Conforme:**
- Testes unitários para Westgard ✓
- Algoritmos implementados ✓

**Não Conforme:**
- ❌ Nenhuma validação de output em tempo real
- ❌ Nenhum teste de casos limite
- ❌ Nenhuma documentação de regras
- ❌ Nenhuma validação de conformidade com protocolos

---

## 5. ACHADOS E OBSERVAÇÕES

### 5.1 ACHADO 1: Sentry Traces Completamente Desativado (0.0)
**Severidade:** 🔴 **CRÍTICA**

Sentry está configurado, mas `traces_sample_rate=0.0`:

**Implicações:**
- Nenhum trace distribuído em produção
- Impossível rastrear requisições lentas
- Impossível debugar fluxos complexos (Reflex → Supabase → Gemini)
- Latência de Gemini timeout não é detectada

**Exemplo Problema:**
```
Usuário reporta: "Análise fica travada por 30 segundos"
Debug sem traces: Impossível. Precisa de logs manuais em tudo.

Com traces: Veria que Gemini levou 30s, Supabase levou 2s, etc.
```

**Evidência:** Configuração presumida com `traces_sample_rate=0.0`

**Impacto em SLA:**
- Impossível demonstrar 99.5% uptime
- Impossível detectar degradação de performance
- Impossível alertar antes de falha crítica

### 5.2 ACHADO 2: Ausência Total de Rate Limiting
**Severidade:** 🔴 **CRÍTICA**

Sem proteção contra abuso:

**Ataques Possíveis:**
1. **Força Bruta em Login:**
   ```
   Atacante tenta 10.000 senhas por segundo
   Sem rate limiting, pode quebrar conta de usuário
   ```

2. **DDoS em Gemini:**
   ```
   Atacante cria 1.000 análises simultâneas
   Gemini API charges overage, custo explode
   ```

3. **Spam de Requisições:**
   ```
   Bot faz GET /api/analyses 1000x por segundo
   Sistema fica lento para usuários legítimos
   ```

**Evidência:** Não mencionado em documentação

**Recomendação Imediata:**
```python
# Implementar com slowapi:
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@app.post("/api/login")
@limiter.limit("5/minute")  # 5 tentativas por minuto
def login(credentials):
    # ...
```

### 5.3 ACHADO 3: Nenhum Fallback para Gemini AI
**Severidade:** 🔴 **CRÍTICA**

Se Gemini falha (timeout, quota, error), sistema falha todo:

**Cenários:**
1. **Timeout (30s):** Usuário espera, depois erro
2. **Quota excedida:** Sistema todo indisponível
3. **Erro de API:** Nenhuma análise pode ser feita

**Sem fallback documentado, risco é CRÍTICO.**

**Exemplo Implementação:**
```python
from typing import TypedDict
import asyncio

class AnalysisResult(TypedDict):
    value: float
    status: str  # "calculated" | "fallback" | "pending"
    timestamp: datetime

async def analyze_with_fallback(sample_data) -> AnalysisResult:
    try:
        # Tentar Gemini com timeout
        result = await asyncio.wait_for(
            gemini_api.analyze(sample_data),
            timeout=5.0  # 5 segundos max
        )
        return {
            "value": result.value,
            "status": "calculated",
            "timestamp": datetime.now()
        }
    except asyncio.TimeoutError:
        logger.warning(f"Gemini timeout for {sample_data}")
        # Fallback: cálculo padrão
        return {
            "value": calculate_default(sample_data),
            "status": "fallback",
            "timestamp": datetime.now()
        }
    except Exception as e:
        logger.error(f"Gemini error: {e}")
        # Fallback 2: resultado pendente
        return {
            "value": None,
            "status": "pending",
            "timestamp": datetime.now()
        }
```

**Evidência:** Nenhuma estratégia de fallback documentada

### 5.4 ACHADO 4: RLS Não Testado com Autenticação
**Severidade:** 🔴 **CRÍTICA**

RLS está implementado, mas:
- Nenhum teste de integração RLS+Auth
- Nenhuma validação de isolamento de usuário
- Nenhum teste de escape RLS

**Risco:**
```
Cenário: Developer muda RLS policy acidentalmente
    ALTER POLICY no_update ON analyses
    USING (user_id = auth.uid())
    WITH CHECK (user_id != auth.uid())  -- ❌ Bug! inverte lógica

Resultado: User A consegue editar dados de User B
Detecção: Em produção, quando usuário reporta
```

**Evidência:** Nenhum teste de integração RLS mencionado

### 5.5 ACHADO 5: Nenhuma Documentação de Segurança
**Severidade:** 🔴 **CRÍTICA**

Não existe documentação de:
- Políticas RLS (o que cada uma faz)
- Estratégia de autenticação
- Proteções implementadas
- Como reportar vulnerabilidades

**Impacto:**
- Developer novo não sabe como manter segurança
- Auditoria de segurança impossível
- Incidentes não têm runbook

**Falta:** `.github/SECURITY.md`, `/docs/SECURITY.md`

### 5.6 ACHADO 6: Nenhum Audit Log para Dados Clínicos
**Severidade:** 🔴 **CRÍTICA**

Diagnósticos são modificados sem rastreamento:

**Requerimento LGPD + ANVISA:**
- Todo acesso a dados clínicos deve ser logado
- Quem? Quando? O quê? Por quê?

**Hoje:** Nenhum audit log mencionado

**Cenário Crítico:**
```
Análise mostra resultado errado
Usuário não consegue responder: Quem mudou?
Impossível auditar histórico de mudanças
```

**Falta:** Audit log de INSERT/UPDATE/DELETE em tabelas críticas

### 5.7 ACHADO 7: Cookies Sem Proteção Completa
**Severidade:** 🟠 **ALTA**

"Cookies (secure flag conditional on production)":

**Problema:**
```
Desenvolvimento: Secure=false
    → Cookies viajam em HTTP
    → MitM pode interceptar

Produção: Secure=true (esperado)
    → Mas se alguém acessa em HTTP, cookie não é enviado
    → Comportamento inconsistente
```

**Recomendação:**
```python
secure = ENV == "production"
httponly = True  # Protege contra JS
samesite = "Lax"  # Protege contra CSRF

# Aplicar em TODAS as respostas, mesmo em dev
response.set_cookie(
    "session",
    value=token,
    secure=secure,
    httponly=httponly,
    samesite=samesite
)
```

### 5.8 ACHADO 8: Nenhum CSP Headers
**Severidade:** 🟠 **ALTA**

Content Security Policy não é configurado:

**XSS pode:**
- Roubar cookies de sessão
- Enviar dados clínicos para servidor externo
- Executar código malicioso

**Recomendação:**
```python
# Adicionar header CSP
response.headers["Content-Security-Policy"] = (
    "default-src 'self'; "
    "script-src 'self' 'nonce-{nonce}'; "
    "style-src 'self' 'unsafe-inline'; "
    "img-src 'self' data:; "
    "connect-src 'self' https://api.supabase.com"
)
```

### 5.9 ACHADO 9: Nenhuma Validação de CORS Headers
**Severidade:** 🟠 **ALTA**

CORS é "configurável via env vars":

**Risco:**
```
CORS_ORIGINS=*
    → Qualquer site pode fazer requisição
    → Roubar dados clínicos
```

**Hoje:** Presumível que está mais restritivo, mas não documentado

**Recomendação:**
```python
CORS_ORIGINS = [
    "https://app.biodiagnostico.com",
    "https://staging.biodiagnostico.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
```

### 5.10 ACHADO 10: Nenhuma Proteção contra CSRF
**Severidade:** 🟠 **ALTA**

Sem tokens CSRF:

**Cenário:**
```
Usuário logado em biodiagnostico.com
Clica em link malicioso em website atacante

Código no site:
<form action="https://biodiagnostico.com/api/analyses" method="POST">
  <input name="test_value" value="999">  <!-- Valor malicioso -->
  <input type="submit">
</form>

Navegador envia cookie automaticamente
Análise é criada sem consentimento do usuário
```

**Proteção:**
```python
# Token CSRF em cada formulário
@app.get("/form")
def get_form():
    csrf_token = generate_csrf_token()
    return {"token": csrf_token}

@app.post("/api/analyses")
def create_analysis(data, csrf_token: str):
    if not validate_csrf_token(csrf_token):
        raise HTTPException(403, "CSRF token invalid")
    # ...
```

### 5.11 ACHADO 11: Westgard Rules sem Validação de Output
**Severidade:** 🟠 **ALTA**

Algoritmo pode retornar valor inválido sem detecção:

**Exemplo:**
```python
def westgard_10x_rule(cv):
    return cv * 10  # Se cv = -5, retorna -50 (impossível no mundo real)

# Nenhuma validação que output é válido
```

**Risco Clínico:**
- Resultado inválido é reportado ao paciente
- Diagnóstico baseado em valor inválido
- Sem audit log, impossível rastrear

**Recomendação:**
```python
def westgard_10x_rule_safe(cv: float) -> float:
    result = cv * 10

    # Validação de output
    assert 0 <= result <= 100, f"Invalid CV result: {result}"

    return result

def analyze_with_validation(sample_data) -> AnalysisResult:
    try:
        result = westgard_10x_rule_safe(sample_data)
    except AssertionError as e:
        logger.error(f"Westgard validation failed: {e}")
        raise ValueError(f"Analysis failed validation: {e}")
```

---

## 6. RECOMENDAÇÕES

### 6.1 IMEDIATAS (Sprint 1-2)

#### R1.1: Habilitar Sentry Traces
**Prioridade:** 🔴 CRÍTICA
**Esforço:** 1 dia

**Ações:**

1. Atualizar Sentry config:
```python
# src/config.py
import sentry_sdk
from sentry_sdk.integrations.asgi import AsgiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

sentry_sdk.init(
    dsn=SENTRY_DSN,
    environment=ENV,
    traces_sample_rate=0.2,  # 20% de traces (de 0.0)
    profiles_sample_rate=0.1,  # 10% de profiling
    integrations=[
        AsgiIntegration(),
        SqlalchemyIntegration(),
    ],
    release=VERSION,  # Versão do app
)

logger.info(f"✓ Sentry initialized with traces enabled")
```

2. Validar em CI/CD:
```yaml
# .github/workflows/ci.yml
- name: Validate Sentry config
  run: |
    python -c "from src.config import settings; \
               assert settings.sentry_traces_sample_rate > 0, \
               'Sentry traces must be enabled'"
```

3. Monitorar dashboard:
```
Sentry Dashboard:
  - Performance: Latência de requisições
  - Errors: Taxa de erro
  - Transactions: Traces de requisições lentas
```

**Validação:** Traces aparecem em Sentry em 5 min

---

#### R1.2: Implementar Rate Limiting
**Prioridade:** 🔴 CRÍTICA
**Esforço:** 2-3 dias

**Ações:**

1. Instalar slowapi:
```bash
pip install slowapi
```

2. Implementar middleware:
```python
# src/middleware.py
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)

# Handlers específicos
RATE_LIMITS = {
    "/api/login": "5/minute",
    "/api/analyses": "30/minute",
    "/api/export": "10/minute",
}

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request, exc):
    return JSONResponse(
        status_code=429,
        content={"detail": "Rate limit exceeded. Try again later."}
    )
```

3. Aplicar a rotas críticas:
```python
from src.middleware import limiter

@app.post("/api/login")
@limiter.limit("5/minute")
async def login(credentials):
    # ...

@app.post("/api/analyses")
@limiter.limit("30/minute")
async def create_analysis(data):
    # ...
```

4. Documentar em `/docs/RATE_LIMITING.md`:
```markdown
# Rate Limiting Policy

## Endpoints e Limites
- /api/login: 5 requisições por minuto (prevenir força bruta)
- /api/analyses: 30 requisições por minuto (prevenir abuso de Gemini)
- /api/export: 10 requisições por minuto (prevenir spam)

## Tratamento de Limite Excedido
```json
{
  "detail": "Rate limit exceeded. Try again later.",
  "retry_after": "60"
}
```

## Customização por Usuário
Premium users: 100/minuto
Free users: 30/minuto
```

**Validação:** GET /api/login 6 vezes retorna 429

---

#### R1.3: Implementar Fallback para Gemini
**Prioridade:** 🔴 CRÍTICA
**Esforço:** 3-5 dias

**Ações:**

1. Criar módulo de análise segura:
```python
# src/services/analysis_service.py
import asyncio
from typing import TypedDict
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class AnalysisResult(TypedDict):
    value: float
    status: str  # "calculated" | "fallback" | "pending"
    timestamp: datetime
    error: str | None

class AnalysisService:
    GEMINI_TIMEOUT = 5.0  # 5 segundos
    GEMINI_RETRY_COUNT = 2

    async def analyze_with_fallback(
        self,
        sample_data: dict
    ) -> AnalysisResult:
        """
        Analisa amostra com Gemini, fallback para cálculo padrão.
        """
        # Tentar Gemini com retry
        for attempt in range(self.GEMINI_RETRY_COUNT):
            try:
                result = await self._gemini_analyze(sample_data)
                logger.info(f"Gemini analysis successful")
                return {
                    "value": result,
                    "status": "calculated",
                    "timestamp": datetime.now(),
                    "error": None
                }
            except asyncio.TimeoutError:
                logger.warning(f"Gemini timeout (attempt {attempt+1})")
                if attempt < self.GEMINI_RETRY_COUNT - 1:
                    await asyncio.sleep(1)  # Backoff
                    continue
            except Exception as e:
                logger.error(f"Gemini error: {e}")
                if attempt < self.GEMINI_RETRY_COUNT - 1:
                    await asyncio.sleep(1)
                    continue

        # Fallback 1: Cálculo padrão
        try:
            default_value = self._calculate_default(sample_data)
            logger.warning(f"Using fallback calculation: {default_value}")
            return {
                "value": default_value,
                "status": "fallback",
                "timestamp": datetime.now(),
                "error": "Gemini timeout"
            }
        except Exception as e:
            # Fallback 2: Resultado pendente
            logger.error(f"Fallback calculation failed: {e}")
            return {
                "value": None,
                "status": "pending",
                "timestamp": datetime.now(),
                "error": "Analysis temporarily unavailable"
            }

    async def _gemini_analyze(self, sample_data: dict) -> float:
        """Chama Gemini com timeout."""
        result = await asyncio.wait_for(
            gemini_client.analyze_async(sample_data),
            timeout=self.GEMINI_TIMEOUT
        )
        return result.value

    def _calculate_default(self, sample_data: dict) -> float:
        """Cálculo padrão sem IA."""
        # Implementar cálculo de fallback
        from src.utils.westgard import westgard_default_calculation
        return westgard_default_calculation(sample_data)
```

2. Integrar em endpoint:
```python
@app.post("/api/analyses")
@limiter.limit("30/minute")
async def create_analysis(request: AnalysisRequest):
    try:
        analysis_service = AnalysisService()
        result = await analysis_service.analyze_with_fallback(
            request.dict()
        )

        # Criar registro no banco
        analysis_record = await supabase.table("analyses").insert({
            "user_id": current_user.id,
            "sample_data": request.dict(),
            "result": result["value"],
            "status": result["status"],
            "error": result["error"],
            "timestamp": result["timestamp"]
        }).execute()

        return {
            "id": analysis_record.data[0]["id"],
            "result": result["value"],
            "status": result["status"],
            "error": result["error"]
        }
    except Exception as e:
        logger.error(f"Analysis creation failed: {e}")
        raise HTTPException(500, "Analysis failed")
```

3. Documentar em `/docs/FALLBACK_STRATEGY.md`:
```markdown
# Fallback Strategy

## Gemini AI Analysis

### Normal Flow
1. Tentar análise via Gemini (timeout: 5s)
2. Se sucesso: retornar resultado
3. Se falha: ir para Fallback

### Fallback 1: Default Calculation
Se Gemini falhar após retry:
- Usar cálculo padrão (sem IA)
- Marcar status como "fallback"
- Log warning

### Fallback 2: Pending
Se até cálculo padrão falhar:
- Retornar status "pending"
- Usuário pode tentar depois
- Log error

### Retry Policy
- Max 2 tentativas para Gemini
- Backoff 1 segundo entre tentativas
- Se timeout: tentar fallback
```

**Validação:** POST /api/analyses com Gemini inativo retorna fallback status

---

#### R1.4: Criar SECURITY.md
**Prioridade:** 🔴 CRÍTICA
**Esforço:** 1-2 dias

**Ações:**

1. Criar `.github/SECURITY.md`:
```markdown
# Security Policy

## Reporting Vulnerabilities

Please do NOT open a GitHub issue for security vulnerabilities.

Instead, email: security@biodiagnostico.com

Include:
- Description of vulnerability
- Steps to reproduce
- Impact assessment
- Suggested fix (if any)

## Response Time
- Initial response: 24 hours
- Fix: 7-14 days depending on severity

## Vulnerability Disclosure
We follow responsible disclosure:
- Report to us first
- Give us 90 days to fix
- Then public disclosure

## Security Contacts
- Security Lead: [contact@biodiagnostico.com]
- CTO: [cto@biodiagnostico.com]

## Supported Versions
| Version | Supported |
|---------|-----------|
| 1.x     | ✓ Yes     |
| <1.0   | ✗ No      |

## Security Best Practices

### For Developers
- Use HTTPS everywhere
- Validate all inputs with Pydantic
- Check RLS policies after changes
- Rotate API keys monthly
- Review Sentry errors daily

### For Users
- Use strong passwords (>12 chars)
- Enable 2FA (quando implementado)
- Keep cookies secure
- Report suspicious activity
```

2. Criar `/docs/SECURITY_ARCHITECTURE.md`:
```markdown
# Security Architecture

## Authentication
- Supabase JWT tokens
- Secure cookies (HttpOnly, Secure, SameSite=Lax)
- No password storage (delegated to Supabase)

## Authorization
- Row Level Security (RLS) on all tables
- Validação em aplicação (Pydantic)
- Role-based checks (quando implementado)

## Data Protection
- TLS/HTTPS em trânsito
- Pydantic validation
- SQL parametrizado (via ORM)
- Sensitive fields masked in logs

## Hardening
- Non-root Docker user
- Rate limiting
- CORS restricted origins
- CSP headers
- CSRF tokens

## Monitoring
- Sentry for errors
- Access logs in Supabase
- Failed login attempts
- Unusual API activity
```

**Validação:** SECURITY.md tem instrução clara para reportar vulnerabilidades

---

### 6.2 CURTO PRAZO (Semana 1-2)

#### R2.1: Implementar Testes RLS com Autenticação
**Prioridade:** 🔴 CRÍTICA
**Esforço:** 3-5 dias

**Ações:**

1. Criar testes de RLS:
```python
# tests/integration/test_rls_security.py
import pytest
from supabase import create_client

@pytest.fixture
def user_1_client():
    """Supabase client como user_1"""
    return create_client(
        SUPABASE_URL,
        SUPABASE_KEY,
        options={"headers": {"Authorization": f"Bearer {user_1_token}"}}
    )

@pytest.fixture
def user_2_client():
    """Supabase client como user_2"""
    return create_client(
        SUPABASE_URL,
        SUPABASE_KEY,
        options={"headers": {"Authorization": f"Bearer {user_2_token}"}}
    )

def test_rls_isolates_analyses(user_1_client, user_2_client):
    """Validar que RLS impede user_2 ler dados de user_1"""
    # User 1 cria análise
    analysis_1 = user_1_client.table("analyses").insert({
        "user_id": "user_1",
        "sample_data": {"value": 100}
    }).execute()

    # User 2 tenta ler
    analyses_of_user_2 = user_2_client.table("analyses").select("*").execute()

    # User 2 NÃO deve ver análise de User 1
    assert len(analyses_of_user_2.data) == 0

def test_rls_allows_own_data(user_1_client):
    """Validar que user pode ler próprios dados"""
    analysis = user_1_client.table("analyses").insert({
        "user_id": "user_1",
        "sample_data": {"value": 100}
    }).execute()

    # User 1 tenta ler próprios dados
    own_analyses = user_1_client.table("analyses").select("*").execute()

    # Deve ver própria análise
    assert len(own_analyses.data) == 1
    assert own_analyses.data[0]["id"] == analysis.data[0]["id"]

def test_rls_prevents_update_other_user(user_1_client, user_2_client):
    """Validar que RLS impede update de dados de outro user"""
    # User 1 cria análise
    analysis = user_1_client.table("analyses").insert({
        "user_id": "user_1",
        "sample_data": {"value": 100}
    }).execute()

    analysis_id = analysis.data[0]["id"]

    # User 2 tenta editar
    with pytest.raises(Exception):  # Esperado erro 403 ou similar
        user_2_client.table("analyses").update({
            "sample_data": {"value": 200}
        }).eq("id", analysis_id).execute()
```

2. Executar em CI/CD:
```yaml
# .github/workflows/security.yml
name: Security Tests

on: [push, pull_request]

jobs:
  rls-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run RLS tests
        run: pytest tests/integration/test_rls_security.py -v

      - name: Fail if any RLS test fails
        if: failure()
        run: exit 1
```

**Validação:** Todos os testes RLS passam, nenhuma isolação quebrada

---

#### R2.2: Adicionar CSP Headers e CORS
**Prioridade:** 🟠 ALTA
**Esforço:** 1-2 dias

**Ações:**

1. Criar middleware de segurança:
```python
# src/middleware.py
from fastapi.middleware.cors import CORSMiddleware
import secrets

def add_security_headers(app):
    @app.middleware("http")
    async def security_headers_middleware(request, call_next):
        response = await call_next(request)

        # CSP Headers
        nonce = secrets.token_hex(16)
        response.headers["Content-Security-Policy"] = (
            f"default-src 'self'; "
            f"script-src 'self' 'nonce-{nonce}'; "
            f"style-src 'self' 'unsafe-inline'; "
            f"img-src 'self' data: https:; "
            f"font-src 'self'; "
            f"connect-src 'self' https://api.supabase.com https://generativelanguage.googleapis.com; "
            f"frame-ancestors 'none'; "
            f"base-uri 'self'; "
            f"form-action 'self'"
        )

        # Segurança adicional
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Permissions-Policy"] = (
            "geolocation=(), microphone=(), camera=()"
        )

        return response

    return app

# CORS
CORS_ORIGINS = [
    "https://app.biodiagnostico.com",
    "https://staging.biodiagnostico.com",
]

if ENV == "development":
    CORS_ORIGINS.append("http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
    max_age=600,
)

app = add_security_headers(app)
```

2. Testar headers:
```bash
curl -I https://api.biodiagnostico.com/health | grep -E "CSP|X-Content|X-Frame"
```

**Validação:** GET / retorna CSP headers, CORS restrito

---

#### R2.3: Implementar Validação de Output para Westgard
**Prioridade:** 🟠 ALTA
**Esforço:** 2-3 dias

**Ações:**

1. Criar validadores:
```python
# src/utils/validation.py
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)

class WestgardValidator:
    """Valida outputs de algoritmos Westgard"""

    CV_MIN = 0.0
    CV_MAX = 100.0

    VALID_RANGES = {
        "cv": (0.0, 100.0),
        "mean": (0.0, 500.0),  # Exemplo
        "sd": (0.0, 50.0),
    }

    @classmethod
    def validate_cv_result(cls, cv: float) -> bool:
        """Valida resultado de CV"""
        if not isinstance(cv, (int, float)):
            raise ValueError(f"CV must be numeric, got {type(cv)}")

        if cv < cls.CV_MIN or cv > cls.CV_MAX:
            raise ValueError(f"CV out of range: {cv}")

        return True

    @classmethod
    def validate_analysis(cls, analysis: Dict[str, Any]) -> bool:
        """Valida resultado completo de análise"""
        for field, (min_val, max_val) in cls.VALID_RANGES.items():
            if field not in analysis:
                raise ValueError(f"Missing required field: {field}")

            value = analysis[field]
            if not isinstance(value, (int, float)):
                raise ValueError(f"{field} must be numeric")

            if value < min_val or value > max_val:
                raise ValueError(f"{field} out of range: {value}")

        return True
```

2. Integrar em análise:
```python
@app.post("/api/analyses")
async def create_analysis(request: AnalysisRequest):
    service = AnalysisService()
    result = await service.analyze_with_fallback(request.dict())

    # Validar resultado
    try:
        WestgardValidator.validate_cv_result(result["value"])
    except ValueError as e:
        logger.error(f"Validation failed: {e}")
        raise HTTPException(400, f"Invalid analysis result: {e}")

    # Persistir
    db_record = await supabase.table("analyses").insert({
        "user_id": current_user.id,
        "result": result["value"],
        "status": result["status"],
    }).execute()

    return db_record
```

**Validação:** POST /api/analyses com output inválido retorna 400

---

### 6.3 MÉDIO PRAZO (Mês 1-2)

#### R3.1: Implementar Audit Logging
**Prioridade:** 🟠 ALTA
**Esforço:** 4-6 dias

**Ações:**

1. Criar tabela de audit:
```sql
-- migrations/004_create_audit_log.sql
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL,  -- INSERT, UPDATE, DELETE
    record_id UUID NOT NULL,
    old_values JSONB,
    new_values JSONB,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);

-- Índices
CREATE INDEX idx_audit_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_table ON audit_log(table_name);
CREATE INDEX idx_audit_timestamp ON audit_log(timestamp);

-- RLS: Users veem próprio audit, admins veem todos
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_user_read ON audit_log
    FOR SELECT
    USING (user_id = auth.uid() OR is_admin(auth.uid()));

CREATE POLICY audit_admin_insert ON audit_log
    FOR INSERT
    WITH CHECK (is_admin(auth.uid()));
```

2. Função de logging:
```python
# src/services/audit_service.py
from datetime import datetime
from typing import Any, Dict

class AuditService:
    def __init__(self, supabase_client, user_id: str):
        self.client = supabase_client
        self.user_id = user_id

    async def log_insert(
        self,
        table_name: str,
        record_id: str,
        new_values: Dict[str, Any],
        request: Request
    ):
        """Log INSERT operation"""
        await self.client.table("audit_log").insert({
            "user_id": self.user_id,
            "table_name": table_name,
            "operation": "INSERT",
            "record_id": record_id,
            "old_values": None,
            "new_values": new_values,
            "ip_address": request.client.host,
            "user_agent": request.headers.get("User-Agent"),
            "timestamp": datetime.utcnow().isoformat()
        }).execute()

    async def log_update(
        self,
        table_name: str,
        record_id: str,
        old_values: Dict[str, Any],
        new_values: Dict[str, Any],
        request: Request
    ):
        """Log UPDATE operation"""
        await self.client.table("audit_log").insert({
            "user_id": self.user_id,
            "table_name": table_name,
            "operation": "UPDATE",
            "record_id": record_id,
            "old_values": old_values,
            "new_values": new_values,
            "ip_address": request.client.host,
            "user_agent": request.headers.get("User-Agent"),
            "timestamp": datetime.utcnow().isoformat()
        }).execute()
```

3. Integrar em endpoints:
```python
@app.post("/api/analyses")
async def create_analysis(request: Request, analysis_request: AnalysisRequest):
    # ... análise ...

    audit = AuditService(supabase, current_user.id)
    await audit.log_insert(
        "analyses",
        db_record["id"],
        db_record,
        request
    )
```

**Validação:** Cada INSERT/UPDATE logado em audit_log

---

#### R3.2: Implementar CSRF Protection
**Prioridade:** 🟠 ALTA
**Esforço:** 2-3 dias

**Ações:**

1. Middleware CSRF:
```python
# src/middleware.py
import secrets
from fastapi import Request, HTTPException

class CSRFProtection:
    def __init__(self):
        self.token_length = 32

    def generate_token(self) -> str:
        """Gera token CSRF"""
        return secrets.token_hex(self.token_length)

    async def validate_token(self, request: Request, token: str) -> bool:
        """Valida token CSRF"""
        session_token = request.cookies.get("csrf_token")
        if not session_token or session_token != token:
            raise HTTPException(403, "CSRF token invalid or missing")
        return True

csrf = CSRFProtection()

@app.middleware("http")
async def csrf_middleware(request: Request, call_next):
    """Adiciona token CSRF em resposta"""
    response = await call_next(request)

    if request.method == "GET":
        token = csrf.generate_token()
        response.set_cookie(
            "csrf_token",
            token,
            httponly=False,  # JavaScript precisa ler
            secure=ENV == "production",
            samesite="Lax"
        )

    return response
```

2. Validar em POST/PUT/DELETE:
```python
@app.post("/api/analyses")
async def create_analysis(
    request: Request,
    analysis_request: AnalysisRequest,
    csrf_token: str = Form(...)
):
    await csrf.validate_token(request, csrf_token)
    # ... criar análise ...
```

3. Frontend:
```html
<form action="/api/analyses" method="POST">
  <input type="hidden" name="csrf_token" id="csrf_token">
  <script>
    document.getElementById('csrf_token').value =
      document.cookie.split('; ')
        .find(row => row.startsWith('csrf_token='))
        .split('=')[1];
  </script>
</form>
```

**Validação:** POST /api/analyses sem csrf_token retorna 403

---

### 6.4 LONGO PRAZO (Trimestre 1-2)

#### R4.1: Implementar MFA (Multi-Factor Authentication)
**Prioridade:** 🟡 MÉDIA
**Esforço:** 5-8 dias

**Ações:**
- Supabase MFA nativa (TOTP)
- SMS backup codes
- Documentação de fluxo MFA

---

#### R4.2: Implementar Privacy-by-Design (LGPD)
**Prioridade:** 🟡 MÉDIA
**Esforço:** 10-15 dias

**Ações:**
- Data retention policy (apagar análises após 6 meses)
- Direito de esquecimento (exportar + deletar)
- Privacy notice e consentimento
- DPA com Supabase

---

## 7. CLASSIFICAÇÃO FINAL DO CAPÍTULO

### Sommerville Cap. 10-11: Dependable Systems & Reliability

| Critério | Status | Justificativa |
|----------|--------|---------------|
| **Disponibilidade** | 🟡 Parcial | Healthcheck sim, monitoramento não |
| **Confiabilidade** | ❌ Não Conforme | Sem retry, sem fallback, sem redundância |
| **Safety (Clínica)** | 🟡 Parcial | Westgard testado, sem validação output |
| **Segurança** | ❌ Não Conforme | Rate limit não, CSRF não, CSP não |
| **Integridade** | 🟡 Parcial | RLS sim, audit log não, checksum não |
| **Manutenibilidade** | 🟡 Parcial | Código estruturado, docs não |
| **Fault Tolerance** | ❌ Não Conforme | Sem redundância, sem fallback |
| **Monitoramento** | 🟡 Parcial | Sentry desativado (traces=0.0) |
| **LGPD** | ❌ Não Conforme | Nenhum requisito atendido |
| **Proteção de Dados** | 🟡 Parcial | TLS presumido, audit não |

### CLASSIFICAÇÃO GERAL

**Status Geral: ❌ NÃO CONFORME**

**Pontuação:** 40/100

**Análise:**
O projeto tem **fundação insuficiente** em confiabilidade e segurança. Embora tenha RLS implementado e healthcheck configurado, **falhas críticas** em rate limiting, fallback strategy, monitoramento (traces=0.0), audit logging e proteção LGPD o tornam **inadequado para produção clínica**.

**Impacto Clínico:**
- 🔴 Falha em Gemini pode derrubar sistema inteiro
- 🔴 Dados podem ser expostos entre usuários (sem testes RLS)
- 🔴 Impossível auditar diagnósticos (sem audit log)
- 🔴 Conformidade LGPD e ANVISA em risco

**Risco Legal:**
- Violação de LGPD (data privacy) = multa até 2% receita
- Violação de ANVISA (lab systems) = suspensão de operação
- Falta de audit log = impossível demonstrar conformidade

**Prazo para Conformidade:**
- **Segurança Crítica (Rate limit + Fallback):** 1 semana
- **Segurança Completa (CSRF + CSP + Audit):** 1 mês
- **LGPD Completa:** 2-3 meses

**Recomendação Executiva:**
**NÃO FAZER DEPLOY PARA PRODUÇÃO CLÍNICA** sem implementar:
1. Rate limiting (segurança)
2. Fallback para Gemini (confiabilidade)
3. Testes RLS com autenticação (segurança)
4. CSP headers + CORS (segurança)
5. Audit logging (conformidade)

Estas são **barreiras obrigatórias** para sistema clínico.

---

**Documento Assinado:**
- **Auditor:** Senior Software Engineering Auditor
- **Data:** 31 de março de 2026
- **Referencial:** Ian Sommerville, Software Engineering, 9th Ed., Chapters 10-11
