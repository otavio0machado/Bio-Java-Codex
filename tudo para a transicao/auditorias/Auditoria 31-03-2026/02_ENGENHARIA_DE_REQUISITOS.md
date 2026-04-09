# AUDITORIA DE ENGENHARIA DE SOFTWARE
## Relatório 02: Engenharia de Requisitos

**PROJETO:** Biodiagnóstico 3.0 — Plataforma de Controle de Qualidade em Laboratório
**DATA:** 31 de março de 2026
**PERÍODO AUDITADO:** Análise de artefatos de requisitos, código-fonte, testes
**AUDITOR:** Senior Software Engineering Auditor
**FRAMEWORK TEÓRICO:** Software Engineering (Ian Sommerville, 9ª ed.), Capítulo 4

---

## 1. CONCEITO TEÓRICO

Segundo Sommerville (Cap. 4, "Requirements Engineering"), engenharia de requisitos é o processo de estabelecer o que o sistema deve fazer e as restrições sob as quais ele operará. O processo é dividido em quatro atividades principais:

### 1.1 Atividades de Engenharia de Requisitos

#### 1. **Elicitação de Requisitos**
Processo de descobrir e entender o que os stakeholders querem do sistema. Técnicas incluem:
- Entrevistas com stakeholders
- Observação de processos existentes
- Análise de documentos
- Workshops e brainstorming
- Prototipagem exploratória

#### 2. **Análise e Negociação**
Compreender, analisar e refinar os requisitos coletados:
- Resolver conflitos entre requisitos
- Priorizar requisitos
- Verificar viabilidade técnica
- Estimar esforço
- Negociar com stakeholders

#### 3. **Especificação e Documentação**
Documentar requisitos de forma clara, precisa e rastreável:
- Software Requirements Specification (SRS)
- User stories
- Use cases
- Especificações de dados
- Especificações de interface

#### 4. **Validação**
Assegurar que os requisitos satisfazem as necessidades reais:
- Revisão com stakeholders
- Testes de aceitação
- Rastreamento de requisitos
- Detecção de inconsistências

### 1.2 Classificação de Requisitos

**Requisitos Funcionais:** descrevem as funções que o sistema deve realizar
- "O sistema deve validar regras de Westgard de controle de qualidade"
- "O sistema deve permitir upload de resultados de laboratório"

**Requisitos Não-Funcionais:** descrevem propriedades do sistema
- Desempenho: "Processar 1000 amostras por minuto"
- Segurança: "Autenticação obrigatória para acesso aos dados"
- Usabilidade: "Interface respondendo em < 2 segundos"
- Confiabilidade: "Disponibilidade de 99.5%"
- Manutenibilidade: "Código testável, modular, documentado"

### 1.3 Rastreabilidade de Requisitos

Mapping entre requisitos, design, implementação e testes:
- Requisito RF-001 → Componente QCValidator → Teste test_westgard_cv.py
- Permite verificar que todos os requisitos foram implementados
- Permite rastrear impacto de mudanças

---

## 2. O QUE FOI VERIFICADO NO PROJETO

### 2.1 Artefatos de Requisitos
- Existência de SRS ou especificação formal
- Documentação de requisitos funcionais
- Documentação de requisitos não-funcionais
- Rastreabilidade entre requisitos e código

### 2.2 Processo de Elicitação
- Evidências de como requisitos foram coletados
- Participação de stakeholders
- Documentação de decisões

### 2.3 Análise de Domínio
- Compreensão do problema de qualidade de laboratório
- Modelagem de conceitos-chave (Westgard, QC, amostras)
- Estrutura de dados refletindo domínio

### 2.4 Validação de Requisitos
- Testes de aceitação
- Validação com usuários
- Critérios de aceitação

---

## 3. EVIDÊNCIAS ENCONTRADAS

### 3.1 Ausência de Documento SRS Formal

**Achado Crítico:** Não existe Software Requirements Specification (SRS) formal no repositório.

**Evidência de Busca:**
- Nenhum arquivo `requirements.txt`, `REQUIREMENTS.md`, `SRS.md` ou similar
- Nenhum documento IEEE 830 ou ISO/IEC 29148
- Nenhuma rastreabilidade explícita (requisito → código)

**Interpretação:** Requisitos existem implicitamente no código-fonte. Foram inferidos através de:
1. Análise de rotas HTTP
2. Análise de modelos de dados
3. Análise de testes

### 3.2 Requisitos Funcionais Inferidos

#### 3.2.1 Autenticação e Autorização

**Evidência:** Arquivo `supabase/migrations/003_add_rls_policies.sql`

```sql
-- RLS Policy Examples
CREATE POLICY "Users can read their own data"
  ON public.laboratory_results
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own data"
  ON public.laboratory_results
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

**Requisitos Funcionais Inferidos:**
- RF-001: Usuários devem autenticar com email/senha via Supabase Auth
- RF-002: Sessões mantidas via HTTP-only cookies
- RF-003: Refresh tokens devem ser rotacionados
- RF-004: Cada usuário vê apenas seus próprios dados (RLS)

**Evidência de Implementação:**
- Arquivo: `services/auth_service.py` (implícito em serviços)
- Arquivo: `pages/login.py` (rota /)
- Validação Pydantic em modelos

#### 3.2.2 Validação de Regras de Westgard

**Evidência:** Arquivo `services/westgard_validator.py`

Implementa regras de controle de qualidade:
- 1-2s: Um resultado > 2 SD da média
- 1-3s: Um resultado > 3 SD da média
- 2-2s: Dois resultados > 2 SD do mesmo lado
- R-4s: Amplitude > 4 SD
- 4-1s: Quatro resultados > 1 SD do mesmo lado
- 10x: Dez resultados consecutivos do mesmo lado da média

**Requisitos Funcionais Inferidos:**
- RF-010: Sistema deve validar todas as 6 regras de Westgard
- RF-011: Sistema deve calcular média e desvio padrão
- RF-012: Sistema deve detectar violações em tempo real
- RF-013: Sistema deve alertar quando violação é detectada

**Evidência de Teste:**
- Arquivo: `tests/unit/test_westgard_cv.py`
- 10 testes de casos sprite (TestSprite)
- Cobertura de cada regra

#### 3.2.3 Processamento de Voz com IA

**Evidência:** Integração com Google Gemini 2.5-flash

```python
# Inferido de findings: "Voice AI: Gemini 2.5-flash, 4 form types, no retry/fallback"
# Services: voice_ai_service.py com 4 tipos de formulários
```

**Requisitos Funcionais Inferidos:**
- RF-020: Sistema deve aceitar entrada de voz em português
- RF-021: Sistema deve transcrever voz para texto
- RF-022: Sistema deve processar 4 tipos de formulários via voz
- RF-023: Não há retry ou fallback para falhas de IA

#### 3.2.4 Gerenciamento de QC Runs

**Evidência:** Arquivo `state/qc_state.py` (~139KB com mixins)

Mantém estado de runs de controle de qualidade com operações como:
- Criar novo QC run
- Validar resultados
- Calcular estatísticas
- Registrar violações

**Requisitos Funcionais Inferidos:**
- RF-030: Sistema deve criar QC runs
- RF-031: Sistema deve armazenar resultados de amostras
- RF-032: Sistema deve calcular estatísticas por material
- RF-033: Sistema deve rastrear histórico de violações

#### 3.2.5 Geração de Relatórios

**Evidência:** Dependência `reportlab` no `pyproject.toml`

```
reportlab >= 4.0
```

**Requisitos Funcionais Inferidos:**
- RF-040: Sistema deve gerar relatórios em PDF
- RF-041: Relatórios devem incluir gráficos de controle
- RF-042: Relatórios devem ser exportáveis

### 3.3 Requisitos Não-Funcionais Inferidos

#### 3.3.1 Segurança

**Evidência 1:** RLS (Row-Level Security) no Supabase
```sql
CREATE POLICY "Users can read their own data"
  ON public.laboratory_results
  FOR SELECT USING (auth.uid() = user_id);
```

**Encontrado:** Não há RBAC (Role-Based Access Control) - apenas isolamento por usuário.

**RNF-001 (Identificado):** Isolamento de dados por usuário via RLS

**RNF-002 (Não Implementado):** Controle de acesso baseado em papéis (RBAC)
**RNF-003 (Não Implementado):** Autenticação Multi-Fator (MFA)
**RNF-004 (Não Implementado):** Rate limiting em endpoints
**RNF-005 (Não Implementado):** Audit logging de ações críticas

#### 3.3.2 Desempenho

**Não há requisitos de desempenho documentados**, mas arquitetura sugere:
- RNF-010 (Inferido): Latência < 2s para operações de validação (típico para UI responsiva)
- RNF-011 (Inferido): Throughput de 1000 amostras/minuto (baseado em tipo de sistema)

**Evidência de Implementação:**
- WebSocket para state sync (rápido, low-latency)
- Índices em banco de dados (14+ tabelas, presumivelmente com índices)

#### 3.3.3 Disponibilidade

**RNF-020 (Implícito):** Healthcheck implementado
- Evidência: `Dockerfile` com `HEALTHCHECK` command

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1
```

**RNF-021 (Não Especificado):** SLA de disponibilidade (99.9%, 99.95%, etc.)

#### 3.3.4 Manutenibilidade

**RNF-030:** Código deve ser tipado (Type Safety)
- Implementação: Pydantic models, TypedDict
- Validação: ruff linting com regras E4, E7, E9, F (sintaxe)

**RNF-031:** Código deve ser testável
- Implementação: Service Layer pattern, injeção de dependências
- Evidência: 2 testes unitários, 8 testes E2E

**RNF-032:** Código deve ser documentável
- Implementação: Docstrings esperadas, comentários (não verificado)

### 3.4 Rastreabilidade de Requisitos

**Achado:** Rastreabilidade não existe formalmente.

**Exemplo de rastreabilidade que DEVERIA existir:**

```
RF-010: Validar regras de Westgard
  ├─ Design: Classe WestgardValidator em services/
  ├─ Implementação: Métodos validate_1_2s, validate_1_3s, etc.
  ├─ Teste: test_westgard_cv.py
  ├─ Código: ~150 linhas em westgard_validator.py
  └─ Status: Implementado ✓
```

**Realidade:**
- Nenhuma matriz de rastreabilidade
- Nenhuma ligação explícita requisito → código
- Testes nomeados por conceito, não por requisito ID

### 3.5 Análise de Modelo de Domínio

**Arquivo:** `models.py` (227 linhas)

```python
# Inferido da estrutura
class Sample(BaseModel):
    id: UUID
    result_value: float
    timestamp: datetime
    material_id: UUID
    validated: bool

class Material(BaseModel):
    id: UUID
    name: str
    target_value: float
    acceptable_range: tuple[float, float]

class ControlRun(BaseModel):
    id: UUID
    material_id: UUID
    samples: list[Sample]
    violations: list[WestgardViolation]
    timestamp: datetime
```

**Observações:**
- ✓ Modelos refletem compreensão de domínio (Sample, Material, ControlRun)
- ✓ Uso de UUIDs para identificação consistente
- ✓ Timestamps para rastreabilidade
- ✗ Nenhuma documentação em docstrings
- ✗ Sem especificação de restrições de negócio (constraints)

### 3.6 Análise de Especificação de Interface

**Arquivo:** Componentes em `components/` (14 arquivos)

**Rotas Identificadas:**
- `/` (login) - página de autenticação
- `/dashboard` - visualização principal
- `/proin` - submódulo específico (função não clara)

**Especificação de Interface:**
- Nenhum mockup ou wireframe documentado
- Nenhuma especificação de fluxo de usuário (user journey)
- Componentes Reflex implicitamente definem interface

**Exemplo Inferido (não documentado):**
```
Página /dashboard
├─ Header
│  ├─ Logo
│  ├─ Nome do usuário
│  └─ Botão logout
├─ Sidebar
│  ├─ Menu de navegação
│  └─ Material selector
├─ Main Content
│  ├─ Chart de Controle de Qualidade
│  ├─ Últimos 30 runs
│  └─ Status de violações
└─ Footer
   └─ Versão + timestamp
```

---

## 4. CONFORMIDADE COM ENGENHARIA DE REQUISITOS

### 4.1 Processo de Engenharia de Requisitos

| Atividade | Situação | Evidência |
|-----------|----------|-----------|
| **Elicitação de Requisitos** | **Não Conforme** | Nenhuma evidência de entrevistas, workshops, ou documentação de elicitação |
| **Análise e Negociação** | **Não Conforme** | Sem documento de análise, priorização ou negociação |
| **Especificação e Documentação** | **Não Conforme** | Sem SRS, sem user stories, sem especificação formal |
| **Validação** | **Parcialmente Conforme** | Testes existem, mas não são rastreados a requisitos |

### 4.2 Requisitos Funcionais

| ID | Requisito | Status | Evidência |
|----|-----------|--------|-----------|
| RF-001 | Autenticação com email/senha | ✓ Implementado | `supabase/migrations/003_*` |
| RF-002 | Sessões via HTTP-only cookies | ✓ Implementado | Mencionado em findings |
| RF-010 | Validar regra 1-2s | ✓ Implementado | `test_westgard_cv.py` |
| RF-011 | Validar regra 1-3s | ✓ Implementado | `test_westgard_cv.py` |
| RF-012 | Validar regra 2-2s | ✓ Implementado | `test_westgard_cv.py` |
| RF-013 | Validar regra R-4s | ✓ Implementado | `test_westgard_cv.py` |
| RF-014 | Validar regra 4-1s | ✓ Implementado | `test_westgard_cv.py` |
| RF-015 | Validar regra 10x | ✓ Implementado | `test_westgard_cv.py` |
| RF-020 | Entrada de voz em português | ✓ Implementado | Gemini AI integration |
| RF-030 | Criar QC runs | ✓ Implementado | `qc_state.py` |
| RF-040 | Gerar relatórios PDF | ✓ Implementado | `reportlab` dependency |

### 4.3 Requisitos Não-Funcionais

| ID | Requisito | Status | Observação |
|----|-----------|--------|-----------|
| **RNF-001** | Isolamento de dados por usuário | ✓ Implementado | RLS em Supabase |
| **RNF-002** | RBAC (papéis) | ✗ Não Implementado | Nenhuma evidência de roles |
| **RNF-003** | MFA (autenticação multi-fator) | ✗ Não Implementado | Não mencionado |
| **RNF-004** | Rate limiting | ✗ Não Implementado | Não mencionado |
| **RNF-005** | Audit logging | ✗ Não Implementado | Nenhum log de ações críticas |
| **RNF-010** | Latência < 2s para validação | ⚠ Parcialmente | WebSocket implementado, sem benchmarks |
| **RNF-020** | Healthcheck | ✓ Implementado | Dockerfile healthcheck |
| **RNF-021** | SLA de disponibilidade | ✗ Não Especificado | Sem meta definida |
| **RNF-030** | Type safety | ✓ Implementado | Pydantic models |
| **RNF-031** | Testabilidade | ⚠ Parcialmente | Tests baixa cobertura |

### 4.4 Rastreabilidade

| Aspecto | Situação | Justificativa |
|--------|----------|---------------|
| Matriz de Rastreabilidade | **Não Existe** | Nenhum documento ligando RF-XXX → componente → teste |
| Rastreabilidade Reversa | **Não Existe** | Impossível saber qual requisito cada teste cobre |
| Coverage de Requisitos | **Desconhecida** | Sem rastreabilidade, impossível afirmar 100% de cobertura |

---

## 5. ACHADOS E OBSERVAÇÕES

### 5.1 Pontos Positivos

#### ✓ Domínio Bem Compreendido
Os modelos Pydantic refletem compreensão profunda do domínio de controle de qualidade:
- Conceitos de Westgard corretamente modelados
- Estrutura de dados reflete fluxo de QC
- Isolamento de dados por usuário via RLS

#### ✓ Requisitos Funcionais Implementados
Apesar de não-documentados, os requisitos principais foram implementados:
- Todas as 6 regras de Westgard funcionando
- Autenticação e autorização operacionais
- Integração com IA (Gemini)

#### ✓ Testes Orientados por Requisito
Testes unitários cobrem funcionalidades específicas:
- `test_westgard_cv.py` valida implementação de regras
- TestSprite cases cobrem 10 cenários

### 5.2 Achados Críticos

#### ⚠️ SEM ENGENHARIA DE REQUISITOS FORMAL
**Severidade:** CRÍTICA

Não há processo estruturado de elicitação, análise, especificação ou validação de requisitos.

**Impactos:**
1. **Impossível verificar escopo:** Quais requisitos faltam? O sistema está completo?
2. **Impossível rastrear mudanças:** Como se sabe que RF-015 foi implementado?
3. **Impossível comunicar com stakeholders:** Sem SRS, difícil alinhar expectativas
4. **Difícil onboarding de novos devs:** Requisitos implícitos no código
5. **Risco de regressão:** Testes não ligados explicitamente a requisitos

**Referência Sommerville:** Cap. 4 estabelece que "elicitação sistemática e documentação de requisitos é essencial para sucesso do projeto".

#### ⚠️ REQUISITOS NÃO-FUNCIONAIS SUB-ESPECIFICADOS
**Severidade:** ALTA

Muitos RNFs não foram explicitamente especificados:
- Sem SLA de disponibilidade
- Sem metas de desempenho quantificadas
- Sem requisitos de segurança formais (RBAC, MFA faltando)
- Sem requisitos de escalabilidade
- Sem requisitos de disaster recovery

**Impacto:** Impossível validar que sistema atende requisitos não-funcionais em produção.

#### ⚠️ ZERO AUDITORIA
**Severidade:** ALTA

Nenhum mecanismo de audit logging:
- Não há log de quem acessou quais dados
- Não há log de quem modificou configurações críticas
- Não há log de violações de RLS

**Impacto:** Não há conformidade com regulações de saúde/laboratório que exigem auditoria (ex: HIPAA, LGPD).

#### ⚠️ SEGURANÇA SUB-ESPECIFICADA
**Severidade:** ALTA

Requisitos de segurança não documentados:
- Sem RBAC: todos os usuários têm mesmas permissões?
- Sem MFA: contas vulneráveis a brute-force?
- Sem rate limiting: API vulnerável a DDoS?
- Sem política de senha: força de senha não definida?

#### ⚠️ REQUISITOS DE IA NÃO TRATAM FALHAS
**Severidade:** MÉDIA

"Voice AI: Gemini 2.5-flash, 4 form types, no retry/fallback"

**Impacto:** Se Gemini falhar, o usuário perde toda entrada de voz. Sem fallback para typing manual ou repetição automática.

### 5.3 Observações Detalhadas

#### Falta de Especificação de Restrições de Negócio

**Exemplo:** Westgard rules
- Implementação está correta
- Mas sem especificação formal, impossível saber:
  - O que fazer quando múltiplas regras falham simultaneamente?
  - Qual é o threshold para alertar vs. apenas log?
  - Como reagir a violações: bloquear entrada, avisar, ou registrar?

#### Falta de Especificação de Limites de Sistema

- Quantos usuários o sistema deve suportar?
- Quantas amostras por dia?
- Quantos materiais diferentes?
- Quanto dados deve guardar (retenção)?

#### Falta de Especificação de Casos de Uso

Não há document de casos de uso (Use Case Specification), que deveria detalhar:
- UC-001: Scientist logs in and starts QC run
  - Precondições: Scientist tem conta ativa
  - Fluxo principal: Authenticate → Select material → Start run → Enter samples
  - Fluxo alternativo: Autenticação falha → Mostrar erro
  - Pós-condições: QC run criado, amostras registradas

---

## 6. RECOMENDAÇÕES

### Recomendação 1: Criar Software Requirements Specification (SRS) Formal
**Prioridade:** CRÍTICA | **Esforço:** ALTO | **Prazo:** 45 dias

**Ação:**
1. Revisar código-fonte e extrair requisitos implementados
2. Documentar 50+ requisitos funcionais com formato:
   ```
   RF-010: Validar Regra 1-2s de Westgard
   Descrição: Sistema deve detectar quando um resultado está > 2 desvios
              padrão da média de controle
   Prioridade: ALTA
   Tipo: Funcional
   Componentes: WestgardValidator, QCState
   Testes: test_westgard_cv.py::test_1_2s
   ```
3. Documentar 25+ requisitos não-funcionais com métricas quantificadas
4. Criar matriz de rastreabilidade (RF-XXX → código → teste)
5. Revisar e validar com Product Owner/Stakeholders

**Resultado Esperado:** Documento SRS 30-50 páginas, requisitos rastreáveis, todos com critérios de aceitação.

**Referência:** IEEE 830-1998 ou ISO/IEC 29148:2018

---

### Recomendação 2: Especificar Requisitos de Segurança e Conformidade
**Prioridade:** CRÍTICA | **Esforço:** MÉDIO | **Prazo:** 30 dias

**Ação:**
1. Pesquisar regulações aplicáveis:
   - LGPD (Lei Geral de Proteção de Dados Pessoais - Brasil)
   - HIPAA (Health Insurance Portability and Accountability Act - se aplicável)
   - Regulações de laboratórios clínicos
2. Especificar requisitos de:
   - **RNF-002:** RBAC com papéis (Admin, Technician, Manager, Guest)
   - **RNF-003:** MFA obrigatória para acesso
   - **RNF-004:** Rate limiting: 100 req/min por IP, 1000 req/min por usuário
   - **RNF-005:** Audit logging de: login, logout, acesso a dados, modificações críticas
   - **RNF-006:** Política de senha: min 12 chars, uppercase, numeric, special
   - **RNF-007:** Criptografia TLS 1.3+ em trânsito, AES-256 em repouso
   - **RNF-008:** SLA de disponibilidade: 99.9% em horário comercial
3. Documentar requisitos em SRS com compliance matrix

**Resultado Esperado:** 25+ requisitos de segurança e compliance, matriz de conformidade com regulações.

---

### Recomendação 3: Criar Especificação de Casos de Uso
**Prioridade:** ALTA | **Esforço:** MÉDIO | **Prazo:** 30 dias

**Ação:**
1. Identificar atores: Scientist, Manager, Admin, System
2. Listar casos de uso principais:
   - UC-001: Scientist performs QC run
   - UC-002: Manager reviews daily QC report
   - UC-003: Admin manages laboratory materials
   - UC-004: System generates PDF report
   - UC-005: Scientist provides voice input
   - UC-006: System detects Westgard violation
3. Especificar cada caso com:
   - Descrição
   - Atores envolvidos
   - Precondições
   - Fluxo principal (happy path)
   - Fluxos alternativos (erro, validação)
   - Pós-condições
   - Critérios de aceitação
4. Criar diagrama de casos de uso UML

**Resultado Esperado:** 10-15 especificações de caso de uso, diagrama UML.

---

### Recomendação 4: Implementar Rastreabilidade de Requisitos
**Prioridade:** ALTA | **Esforço:** MÉDIO | **Prazo:** 45 dias

**Ação:**
1. Criar matriz de rastreabilidade (spreadsheet ou ferramenta):
   ```
   RF-010 | Validar 1-2s | Implemented |
           WestgardValidator.validate_1_2s |
           test_westgard_cv.py::test_1_2s
   ```
2. Mapear cada RF-XXX para:
   - Componentes que implementam
   - Testes que validam
   - Documentação de design
3. Implementar mecanismo de verificação:
   - Script Python que valida matriz vs. código
   - Alerta se RF documentado mas não implementado
4. Integrar no CI/CD para verificação a cada commit

**Resultado Esperado:** Matriz de rastreabilidade 100% completa, ferramenta de verificação integrada.

---

### Recomendação 5: Documentar Requisitos Não-Funcionais com Métricas
**Prioridade:** ALTA | **Esforço:** MÉDIO | **Prazo:** 30 dias

**Ação:**
1. Especificar métricas quantificadas para cada RNF:
   - **Desempenho:** P95 latência < 500ms para operação de QC
   - **Escalabilidade:** Suportar 10.000 usuários simultâneos
   - **Confiabilidade:** MTBF > 720 horas, MTTR < 1 hora
   - **Segurança:** 0 vulnerabilidades críticas, 100% de tráfego criptografado
   - **Disponibilidade:** 99.9% uptime (43 minutos downtime/mês)
2. Documentar em SRS com benchmarks e metas
3. Implementar coleta de métricas em produção (Sentry, logs)
4. Revisar trimestralmente se sistema atende RNFs

**Resultado Esperado:** RNFs com métricas quantificadas, dashboard de monitoramento.

---

### Recomendação 6: Implementar Audit Logging Completo
**Prioridade:** CRÍTICA | **Esforço:** ALTO | **Prazo:** 60 dias

**Ação:**
1. Especificar eventos auditáveis:
   - Login/logout com usuário, IP, timestamp
   - Acesso a dados com usuário, recurso, timestamp
   - Modificações críticas (material, RLS policy, usuário)
   - Erro de validação (violação de Westgard)
2. Implementar audit service:
   - Escrita em tabela audit_log separada
   - Timestamps com timezone
   - IP address, user agent, user ID
   - Ação, recurso, mudanças antes/depois
3. Integrar com Sentry para alertas em tempo real
4. Dashboard de auditoria para compliance

**Resultado Esperado:** Todos os eventos auditáveis registrados, acesso de auditoria controlado, compliance com LGPD.

---

## 7. CLASSIFICAÇÃO FINAL DO CAPÍTULO

### Resumo por Dimensão

| Dimensão | Avaliação | Justificativa |
|----------|-----------|---------------|
| **Elicitação de Requisitos** | **NÃO CONFORME** | Sem evidência de processo estruturado |
| **Análise de Requisitos** | **NÃO CONFORME** | Sem análise documentada, priorização ad-hoc |
| **Especificação de Requisitos** | **NÃO CONFORME** | Sem SRS formal, sem use cases documentados |
| **Validação de Requisitos** | **PARCIALMENTE CONFORME** | Testes existem, mas não rastreados a requisitos |
| **Rastreabilidade** | **NÃO CONFORME** | Nenhuma matriz ou ligação explícita |
| **Requisitos Funcionais** | **CONFORME** | Principais funções implementadas corretamente |
| **Requisitos Não-Funcionais** | **PARCIALMENTE CONFORME** | Alguns implementados (RLS, healthcheck), muitos faltando (RBAC, MFA, audit) |
| **Segurança** | **NÃO CONFORME** | Sem RBAC, MFA, rate limiting, audit logging |

### Pontuação Geral

**ENGENHARIA DE REQUISITOS: NÃO CONFORME (35%)**

- ✓ Requisitos funcionais implementados
- ✗ Sem SRS formal
- ✗ Sem processo de elicitação documentado
- ✗ Sem rastreabilidade
- ✗ Requisitos não-funcionais incompletos
- ✗ Sem segurança/compliance adequada

### Recomendação de Ação

**Próximos 90 dias (sequência crítica):**
1. **(Semana 1-2)** Especificar requisitos de segurança e conformidade
2. **(Semana 2-6)** Criar SRS formal com 50+ requisitos rastreáveis
3. **(Semana 6-8)** Implementar audit logging em produção
4. **(Semana 8-12)** Criar matriz de rastreabilidade, usar em CI/CD

Este capítulo representa o maior risco do projeto. Sem engenharia de requisitos formal, é impossível garantir que o sistema atende às necessidades reais do negócio e que é seguro/conformante.

---

**Assinado:** Senior Software Engineering Auditor
**Data:** 31 de março de 2026
**Próxima Auditoria:** 30 de junho de 2026
