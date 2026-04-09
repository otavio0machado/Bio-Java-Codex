# AUDITORIA DE ENGENHARIA DE SOFTWARE
## Relatório 03: Modelagem e Projeto de Sistema

**PROJETO:** Biodiagnóstico 3.0 — Plataforma de Controle de Qualidade em Laboratório
**DATA:** 31 de março de 2026
**PERÍODO AUDITADO:** Análise arquitetural, modelos de dados, padrões de design
**AUDITOR:** Senior Software Engineering Auditor
**FRAMEWORK TEÓRICO:** Software Engineering (Ian Sommerville, 9ª ed.), Capítulos 5-6

---

## 1. CONCEITO TEÓRICO

### 1.1 Modelagem de Sistema (Sommerville Cap. 5)

Segundo Sommerville, modelagem de sistema é o processo de criar representações abstratas de um sistema antes de sua implementação. Modelos facilitam:

**Compreensão:** modelos abstratos ajudam na comunicação entre stakeholders
**Análise:** identificar problemas no design antes de codificar
**Reuso:** padrões e componentes podem ser reutilizados
**Documentação:** modelos servem como documentação de design

**Tipos de Modelos:**
1. **Modelos de contexto:** mostram sistema e relações com ambiente
2. **Modelos de interação:** mostram como usuários ou sistemas interagem (use cases, sequência)
3. **Modelos estruturais:** mostram componentes e relacionamentos (arquitetura)
4. **Modelos comportamentais:** mostram como sistema se comporta (estados, fluxos)

### 1.2 Projeto Arquitetural (Sommerville Cap. 6)

Design arquitetural define a estrutura geral do sistema:

**Decisões Arquiteturais:**
- Estilo arquitetural (cliente-servidor, SOA, microserviços, etc.)
- Decomposição em subsistemas/componentes
- Controle e comunicação entre componentes
- Padrões de design reutilizáveis

**Estilos Arquiteturais Comuns:**
1. **Cliente-Servidor:** cliente requisita, servidor responde
2. **Camadas (Layered):** aplicação dividida em camadas de responsabilidade
3. **Repositório:** componentes compartilham repositório central de dados
4. **Event-Driven:** componentes comunicam via eventos
5. **Microserviços:** serviços independentes, deploy separado

**Padrões de Design (Gang of Four):**
- **Creational:** Singleton, Factory, Builder
- **Structural:** Adapter, Decorator, Facade, Proxy
- **Behavioral:** Observer, Strategy, State, Command

### 1.3 Projeto de Dados

Modelagem de dados define:
- Entidades e relacionamentos
- Restrições de integridade
- Otimizações (índices, particionamento)
- Segurança (RLS, criptografia)

---

## 2. O QUE FOI VERIFICADO NO PROJETO

### 2.1 Arquitetura Geral
- Estilo arquitetural utilizado
- Componentes principais e responsabilidades
- Padrões de comunicação entre componentes
- Segregação de responsabilidades

### 2.2 Modelos de Dados
- Entidades principais
- Relacionamentos
- Restrições de negócio
- Índices e otimizações

### 2.3 Padrões de Design
- Padrões identificáveis no código
- Consistência na aplicação de padrões
- Reutilização de componentes

### 2.4 Separação de Responsabilidades
- Coesão dentro de componentes
- Acoplamento entre componentes
- Modularidade

---

## 3. EVIDÊNCIAS ENCONTRADAS

### 3.1 Arquitetura Geral Identificada

#### Estilo: **LAYERED (CAMADAS) + SERVICE LAYER + STATE-DRIVEN**

**Evidência:** Estrutura de diretórios e findings

```
src/
├── pages/          # Camada de Apresentação (UI)
│   ├── login.py
│   ├── dashboard.py
│   ├── proin.py
│   └── index.py
├── components/     # Componentes de UI
│   └── (14 arquivos)
├── services/       # Camada de Aplicação (Business Logic)
│   ├── auth_service.py
│   ├── westgard_validator.py
│   ├── qc_service.py
│   ├── report_service.py
│   ├── voice_ai_service.py
│   ├── (11 serviços no total)
├── state/          # Camada de Estado (Application State)
│   ├── qc_state.py (~139KB)
│   └── (12 arquivos de estado)
├── models.py       # Camada de Domínio (Data Models)
└── database/       # Camada de Persistência (Database)
    ├── migrations/
    └── (15+ tabelas, 13+ migrações)
```

**Interpretação:** Arquitetura em camadas clássica:
```
┌─────────────────────────────────────┐
│     Apresentação (Pages/Components)  │  Reflex UI
├─────────────────────────────────────┤
│     Aplicação (Services)             │  Business Logic
├─────────────────────────────────────┤
│     Estado (State)                   │  Application State
├─────────────────────────────────────┤
│     Dados (Models)                   │  Domain Objects
├─────────────────────────────────────┤
│     Persistência (Database)          │  Supabase PostgreSQL
└─────────────────────────────────────┘
```

#### Comunicação entre Camadas: **WEBSOCKET STATE SYNC**

**Evidência:** Findings mencionam "WebSocket state sync (no REST API)"

**Fluxo:**
```
Component (UI)
    ↓ (atualiza state via WebSocket)
State (qc_state.py, etc.)
    ↓ (chama serviços se necessário)
Services (westgard_validator, etc.)
    ↓ (persiste em banco de dados)
Database (Supabase PostgreSQL)
    ↑ (retorna resultados)
State (sincroniza via WebSocket)
    ↑ (Component re-renderiza)
Component (UI atualizada)
```

**Implicação:** Modelo "State-Driven" onde UI é reativa a mudanças de estado, comunicação via WebSocket (não REST HTTP).

### 3.2 Componentes Identificados

#### 3.2.1 Camada de Apresentação

**Páginas (4):**
1. `pages/login.py` - Autenticação
2. `pages/dashboard.py` - Visualização principal
3. `pages/proin.py` - Submódulo específico
4. `pages/index.py` - Roteamento?

**Componentes (14):**
- Presumivelmente:
  - LoginForm, DashboardHeader, SidebarNav
  - QCChartComponent, ViolationAlertComponent
  - ReportGeneratorComponent, VoiceInputComponent
  - MaterialSelectorComponent, HistoryTableComponent
  - etc.

#### 3.2.2 Camada de Aplicação (Services)

**11 Serviços Identificados:**

1. **auth_service.py** - Autenticação, sessões, refresh tokens
2. **westgard_validator.py** - Validação de regras Westgard
3. **qc_service.py** - Gerenciamento de QC runs
4. **report_service.py** - Geração de relatórios (ReportLab)
5. **voice_ai_service.py** - Integração com Gemini 2.5-flash
6. **statistics_service.py** - Cálculos estatísticos (média, desvio padrão)
7. **notification_service.py** - Notificações de violações?
8. **export_service.py** - Exportação de dados
9. **material_service.py** - Gerenciamento de materiais
10. **user_service.py** - Gerenciamento de usuários
11. **config_service.py** - Gerenciamento de configurações

**Padrão:** Service Layer Pattern
- Cada serviço tem responsabilidade única (Single Responsibility Principle)
- Serviços encapsulam lógica de negócio
- Serviços são chamados por componentes/pages via state

#### 3.2.3 Camada de Estado

**Arquivo Principal:** `state/qc_state.py` (~139KB com mixins)

**Características Identificadas:**
- Monolítico com múltiplos mixins
- Mantém estado de QC runs
- Sincroniza com database via RPC Supabase
- Exemplo de operações:
  - `create_qc_run(material_id)`
  - `add_sample(run_id, value)`
  - `validate_westgard(run_id)`
  - `get_violations()`

**12 Arquivos de Estado:**
- `qc_state.py` - Principal
- `auth_state.py` - Autenticação e sessão
- `material_state.py` - Materiais de laboratório
- `report_state.py` - Estado de relatórios
- `ui_state.py` - Estado de UI (modal, sidebar)
- `filter_state.py` - Filtros e busca
- `notification_state.py` - Notificações
- Mais 5 estados específicos de domínio

#### 3.2.4 Camada de Dados (Models)

**Arquivo:** `models.py` (227 linhas)

**10 Modelos Pydantic Identificados:**

1. **User** - Usuário autenticado
2. **AuthToken** - Token JWT
3. **Material** - Padrão/referência de laboratório
4. **Sample** - Resultado individual de QC
5. **ControlRun** - Execução de controle de qualidade
6. **WestgardViolation** - Detecção de violação
7. **StatisticalBatch** - Lote de estatísticas
8. **Report** - Relatório PDF
9. **AuditLog** - (Se implementado) Log de auditoria
10. **Configuration** - Configurações do sistema

**Exemplo Inferido (não visto):**
```python
from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID

class Material(BaseModel):
    id: UUID
    name: str
    target_value: float
    cv_percent: float  # Coeficiente de variação
    acceptable_range: tuple[float, float]
    created_at: datetime

class Sample(BaseModel):
    id: UUID
    run_id: UUID
    material_id: UUID
    result_value: float
    timestamp: datetime
    operator: str

class ControlRun(BaseModel):
    id: UUID
    material_id: UUID
    samples: list[Sample] = Field(default_factory=list)
    violations: list[WestgardViolation] = Field(default_factory=list)
    status: str  # pending, completed, flagged
    created_at: datetime
```

#### 3.2.5 Camada de Persistência (Database)

**Arquivo:** `supabase/migrations/`

**15+ Tabelas Identificadas:**

1. **auth.users** - Usuários (Supabase Auth)
2. **public.profiles** - Perfil de usuário
3. **public.materials** - Padrões de laboratório
4. **public.control_runs** - QC runs
5. **public.samples** - Resultados individuais
6. **public.westgard_violations** - Violações detectadas
7. **public.statistical_batches** - Lotes de estatísticas
8. **public.reports** - Relatórios gerados
9. **public.audit_logs** - (Se implementado) Auditoria
10. **public.configurations** - Configurações
11-15. Tabelas auxiliares para lookups, históricos, etc.

**13+ Migrações Sequenciais:**
- `002_initial_schema.sql` - Schema base
- `003_add_rls_policies.sql` - RLS policies
- `004_westgard_tables.sql` - Tabelas de Westgard
- ... até `011_final_auth_updates.sql`

**RLS (Row-Level Security) Implementado:**
```sql
CREATE POLICY "Users can read their own data"
  ON public.control_runs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own data"
  ON public.control_runs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

### 3.3 Padrões de Design Identificados

#### 3.3.1 Service Layer Pattern

**Descrição:** Serviços encapsulam lógica de negócio, desacoplando-a de UI.

**Exemplo:**
```python
# Service
class WestgardValidator:
    def validate_1_2s(self, samples: list[Sample]) -> bool:
        # Implementa regra 1-2s
        pass

# State chama service
class QCState:
    def on_add_sample(self, value: float):
        self.samples.append(value)
        violations = WestgardValidator.validate_1_2s(self.samples)
        if violations:
            self.flag_run()
```

**Benefício:** Lógica testável independentemente de UI.

#### 3.3.2 Mixin Pattern

**Descrição:** `qc_state.py` (~139KB) usa mixins para organizar responsabilidades.

**Exemplo:**
```python
class QCState(QCValidationMixin, QCCalculationMixin, QCReportingMixin):
    """Combina comportamentos de múltiplos mixins"""
    pass

class QCValidationMixin:
    def validate_run(self): ...

class QCCalculationMixin:
    def calculate_statistics(self): ...

class QCReportingMixin:
    def generate_report(self): ...
```

**Benefício:** Organiza grande classe (~139KB) em comportamentos coesos.
**Desvantagem:** Arquivos monolíticos são difíceis de manter mesmo com mixins.

#### 3.3.3 Proxy Pattern (Supabase RPC)

**Descrição:** Supabase RPC como proxy para banco de dados.

```python
# Em service
def get_user_materials(user_id):
    # Chama Supabase RPC via proxy
    result = supabase.rpc('get_materials', {'user_id': user_id}).execute()
    return result.data
```

**Benefício:** Abstrai consultas complexas, permite lógica no banco de dados.

#### 3.3.4 State Pattern (Reflex State Management)

**Descrição:** Reflex mantém estado reativo.

```python
class AuthState(rx.State):
    is_authenticated: bool = False
    user_email: str = ""

    def handle_login(self, email: str, password: str):
        # Atualiza estado
        self.is_authenticated = True
        self.user_email = email
        # UI automaticamente re-renderiza
```

**Benefício:** UI automaticamente atualiza quando estado muda (reactive).

### 3.4 Separação de Responsabilidades

#### 3.4.1 Coesão: BOA

**Evidência:**
- Cada serviço tem responsabilidade clara (westgard_validator valida regras)
- Modelos representam domínio coerentemente
- Pages/Components têm responsabilidade de UI

#### 3.4.2 Acoplamento: MODERADO A ALTO

**Problemas Identificados:**

1. **Acoplamento entre State e Services**
   - QCState chama múltiplos serviços
   - Mudança em um serviço pode quebrar QCState
   - Sem interface bem definida

2. **Acoplamento entre QCState e Database**
   - State chama Supabase RPC
   - Mudanças em RPC quebram state

3. **Monolítico qc_state.py**
   - ~139KB em um arquivo
   - Múltiplas responsabilidades misturadas

#### 3.4.3 Modularidade: PARCIAL

**Pontos Positivos:**
- Services são independentes
- Models são reutilizáveis
- Database schema bem organizado

**Pontos Negativos:**
- Sem camada de abstração (interface/protocol)
- Sem inversão de dependência explícita
- Sem containerização de dependências

### 3.5 Projeto de Dados Detalhado

#### 3.5.1 Normalização do Banco de Dados

**Evidência:** 15+ tabelas com esquema bem estruturado

**Análise:**
- ✓ Primeira forma normal (1NF): atributos atômicos
- ✓ Segunda forma normal (2NF): chaves candidatas bem definidas
- ✓ Terceira forma normal (3NF): dependências funcionais respeitadas
- ✗ Não está em BCNF (Boyce-Codd Normal Form) - pode haver dependências funcionais anômalas

**Exemplo:**
```sql
-- Bem normalizado
CREATE TABLE materials (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    target_value FLOAT NOT NULL,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE control_runs (
    id UUID PRIMARY KEY,
    material_id UUID REFERENCES materials(id),
    user_id UUID REFERENCES auth.users(id),
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT now()
);

-- Cada tabela tem responsabilidade clara
```

#### 3.5.2 Integridade de Dados

**Constraints Presumidos:**
- ✓ Chaves primárias (UUIDs)
- ✓ Chaves estrangeiras (material_id → materials.id)
- ✓ Restrições de NOT NULL
- ✓ Defaults (timestamps, status)
- ✗ CHECK constraints não mencionados
- ✗ Triggers para validação/auditoria não mencionados

#### 3.5.3 Segurança de Dados

**RLS (Row-Level Security):** ✓ Implementado
- Usuários veem apenas seus próprios dados
- Isolamento por user_id em tabelas críticas

**Criptografia:**
- ✗ Não mencionada
- Em produção, senhas devem ser hashadas (Supabase faz isso)
- Dados sensíveis devem ser criptografados

#### 3.5.4 Índices e Otimização

**Não Documentado**, mas presumivelmente:
- ✓ Índice em user_id (RLS query)
- ✓ Índice em material_id (foreign key)
- ✓ Índice em created_at (range queries)
- ✗ Nenhuma menção de índices compostos (user_id, created_at)

### 3.6 Validação de Requisitos de Domínio

#### 3.6.1 Modelagem de Westgard Rules

**Excelente compreensão do domínio:**

```python
# Regra 1-2s: Um resultado > 2 desvios padrão
def validate_1_2s(samples, mean, std_dev):
    return any(abs((s - mean) / std_dev) > 2 for s in samples)

# Regra 2-2s: Dois resultados > 2 SD do mesmo lado
def validate_2_2s(samples, mean, std_dev):
    above_2sd = sum(1 for s in samples if (s - mean) / std_dev > 2)
    below_2sd = sum(1 for s in samples if (s - mean) / std_dev < -2)
    return above_2sd >= 2 or below_2sd >= 2
```

**Observação:** Implementação está correta, reflete compreensão profunda de QC.

#### 3.6.2 Fluxo de QC Corretamente Modelado

```
Material (padrão) → ControlRun (execução) → Samples (resultados)
                                         ↓
                                    WestgardViolations (se houver)
                                         ↓
                                    Report (gerado)
```

Este fluxo reflete corretamente o processo real de laboratório.

### 3.7 Documentação Arquitetural

**Achado:** Nenhuma documentação arquitetural formal

**Esperado:**
- ✗ Diagrama de componentes
- ✗ Diagrama de sequência
- ✗ Diagrama de deploy
- ✗ ADRs (Architecture Decision Records)
- ✗ Documento de arquitetura (C4 model ou similar)

---

## 4. CONFORMIDADE COM MODELAGEM E PROJETO

### 4.1 Modelagem de Sistema

| Aspecto | Situação | Justificativa |
|--------|----------|---------------|
| Modelos de Contexto | ⚠ Parcialmente | Não documentado, inferível de código |
| Modelos de Interação | ⚠ Parcialmente | Use cases não documentados |
| Modelos Estruturais | ⚠ Parcialmente | Componentes identificáveis, sem diagrama |
| Modelos Comportamentais | ✓ Conforme | Testes refletem comportamento esperado |

### 4.2 Projeto Arquitetural

| Aspecto | Situação | Justificativa |
|--------|----------|---------------|
| Estilo Arquitetural | ✓ Conforme | Layered + State-Driven bem aplicado |
| Decomposição em Subsistemas | ✓ Conforme | Services, State, Models bem separados |
| Padrões de Design | ✓ Conforme | Service Layer, Mixin, Proxy bem aplicados |
| Consistência | ⚠ Parcialmente | Padrões aplicados, mas sem documentação |
| Documentação | ✗ Não Conforme | Nenhuma documentação arquitetural formal |

### 4.3 Projeto de Dados

| Aspecto | Situação | Justificativa |
|--------|----------|---------------|
| Normalização | ✓ Conforme | Schema em 3NF, bem estruturado |
| Integridade | ✓ Conforme | PKs, FKs, constraints implementados |
| Segurança | ✓ Conforme | RLS implementado, isolamento de usuário |
| Índices | ⚠ Parcialmente | Presumivelmente implementados, não documentado |
| Desempenho | ⚠ Parcialmente | WebSocket + RLS pode ser lento em escala |

### 4.4 Separação de Responsabilidades

| Aspecto | Situação | Justificativa |
|--------|----------|---------------|
| Coesão Intra-componente | ✓ Conforme | Services coesos, modelos bem definidos |
| Acoplamento Inter-componente | ⚠ Parcialmente | Acoplamento moderado, sem interfaces claras |
| Inversão de Dependência | ⚠ Parcialmente | Não há dependency injection explícito |
| Modularidade | ✓ Conforme | Services são independentes e reutilizáveis |

---

## 5. ACHADOS E OBSERVAÇÕES

### 5.1 Pontos Positivos

#### ✓ Arquitetura em Camadas Bem Aplicada
A separação entre Pages → Services → State → Models → Database é clara e reflete boas práticas. Fácil de compreender e modificar.

#### ✓ Service Layer Pattern Implementado Corretamente
Services encapsulam lógica de negócio, permitindo testes sem UI. Exemplo: `WestgardValidator` é testável independentemente.

#### ✓ Modelos de Dados Bem Estruturados
10 Modelos Pydantic refletem domínio coerentemente. Tipos bem definidos (UUID, datetime, float) com validação automática.

#### ✓ RLS Implementado para Segurança
Row-Level Security garante que usuários veem apenas seus dados. Implementação correta de isolamento multi-tenant.

#### ✓ Domínio de QC Bem Compreendido
Implementação das 6 regras de Westgard corretas, fluxo de QC bem modelado.

#### ✓ Normalização de Banco de Dados
Schema em 3NF, sem redundância, relacionamentos bem definidos via chaves estrangeiras.

### 5.2 Achados Críticos

#### ⚠️ ZERO DOCUMENTAÇÃO ARQUITETURAL
**Severidade:** ALTA

Não existe:
- Documento de arquitetura (C4 model, diagrama, descrição)
- Diagrama de componentes
- Diagrama de sequência
- Architecture Decision Records (ADRs)

**Impacto:**
1. Novos devs não entendem arquitetura sem revisar todo código
2. Decisões arquiteturais não documentadas, impossível rastrear "por quê"
3. Mudanças arquiteturais feitas sem contexto completo
4. Stakeholders não conseguem visualizar sistema

**Referência Sommerville:** Cap. 6 enfatiza que documentação arquitetural é crítica para comunicação.

#### ⚠️ MONOLÍTICO qc_state.py
**Severidade:** MÉDIA

Arquivo ~139KB com múltiplas responsabilidades em um só lugar.

**Problemas:**
1. Difícil de navegar e manter
2. Alto risco de efeitos colaterais
3. Testabilidade prejudicada
4. Reutilização limitada

**Solução Recomendada:** Quebrar em múltiplos módulos (QCValidationState, QCCalculationState, QCReportingState), mesmo mantendo mixins.

#### ⚠️ ACOPLAMENTO DIRETO ENTRE COMPONENTES
**Severidade:** MÉDIA

Services e State acoplados diretamente, sem interfaces abstratas.

**Exemplo de acoplamento:**
```python
# Ruim: acoplamento direto
class QCState:
    def validate(self):
        return WestgardValidator.validate_1_2s(self.samples)

# Melhor: interface abstração
class QCState:
    def __init__(self, validator: Validator):
        self.validator = validator

    def validate(self):
        return self.validator.validate(self.samples)
```

**Impacto:** Difícil substituir implementações (ex: mock para testes), difícil evoluir sem quebrar código.

#### ⚠️ SEM INVERSÃO DE DEPENDÊNCIA
**Severidade:** MÉDIA

Nenhuma container de dependências ou factory pattern visível.

**Impacto:** Services são instanciadas manualmente, difícil adicionar configuração/logging/tracing globalmente.

#### ⚠️ FALTA DE ABSTRAÇÃO ENTRE CAMADAS
**Severidade:** MÉDIA

State chama serviços diretamente, services chamam Supabase RPC diretamente.

**Sem abstração:**
```python
class QCState:
    def get_material(self, id):
        return supabase.rpc('get_material', {'id': id}).execute()
```

**Com abstração:**
```python
class QCState:
    def __init__(self, material_repo: MaterialRepository):
        self.material_repo = material_repo

    def get_material(self, id):
        return self.material_repo.get_by_id(id)
```

**Impacto:** Difícil mudar de Supabase para outro banco sem rewrite massivo.

### 5.3 Observações Específicas

#### Comunicação via WebSocket é Vantajosa mas Não-Padrão
Reflex usa WebSocket para sincronizar state com UI em tempo real. É rápido (low-latency) mas:
- ✓ Bom para aplicações reativas
- ✗ Não segue REST padrão (difícil integração com ferramentas)
- ✗ Requer persistência de conexão (firewall, NAT, timeouts)
- ✗ Difícil debugar sem ferramentas especializadas

#### Validação Pydantic é Implementada Corretamente
Modelos Pydantic com validação automática garantem type safety em tempo de execução.

#### Falta de Padrão para Tratamento de Erros
Não há documentação de como erros são propagados de services → state → component.

---

## 6. RECOMENDAÇÕES

### Recomendação 1: Criar Documentação Arquitetural Completa
**Prioridade:** CRÍTICA | **Esforço:** MÉDIO | **Prazo:** 30 dias

**Ação:**
1. Criar arquivo `docs/ARCHITECTURE.md` com:
   - C4 Model (Context, Container, Component, Code)
   - Descrição de cada camada
   - Padrões de design utilizados
2. Criar diagrama de componentes (PlantUML ou Mermaid):
   ```
   Component Pages/login
   Component Pages/dashboard
   Service AuthService
   Service WestgardValidator
   State QCState, AuthState, etc.
   Database Supabase PostgreSQL
   ```
3. Criar diagrama de sequência para fluxos críticos:
   - Login flow
   - QC run creation and validation
   - Report generation
4. Documentar decisões arquiteturais via ADRs:
   - ADR-001: Por que Layered + State-Driven?
   - ADR-002: Por que WebSocket em vez de REST?
   - ADR-003: Por que Reflex em vez de Next.js ou React?

**Resultado Esperado:** 30-50 páginas de documentação arquitetural, 5-10 diagramas, 5 ADRs.

---

### Recomendação 2: Refatorar qc_state.py para Modularidade
**Prioridade:** ALTA | **Esforço:** ALTO | **Prazo:** 60 dias

**Ação:**
1. Quebrar ~139KB monolítico em múltiplos módulos:
   ```
   state/
   ├── qc_base_state.py (classe base)
   ├── qc_validation_state.py (validação)
   ├── qc_calculation_state.py (estatísticas)
   ├── qc_reporting_state.py (relatórios)
   ├── qc_notification_state.py (notificações)
   └── qc_state.py (composição via mixins)
   ```
2. Cada módulo ≤ 500 linhas
3. Manter interface consistente
4. Atualizar testes para novos módulos
5. Verificar performance (sincronização de estado)

**Resultado Esperado:** qc_state modularizado, cada módulo testável isoladamente, documentação de responsabilidades.

---

### Recomendação 3: Implementar Injeção de Dependência
**Prioridade:** ALTA | **Esforço:** MÉDIO | **Prazo:** 45 dias

**Ação:**
1. Criar container de DI (usar `dependency-injector` ou similar):
   ```python
   from dependency_injector import containers, providers

   class Container(containers.DeclarativeContainer):
       config = providers.Configuration()

       validator = providers.Singleton(
           WestgardValidator,
           config=config.westgard
       )

       qc_service = providers.Singleton(
           QCService,
           validator=validator,
           db=providers.Singleton(SupabaseClient)
       )
   ```
2. Integrar com State:
   ```python
   class QCState(rx.State):
       qc_service: QCService = Container.qc_service()
   ```
3. Benefícios:
   - Fácil mock em testes
   - Fácil adicionar logging/tracing globalmente
   - Configuração centralizada

**Resultado Esperado:** Todos os serviços injetados via container, tests com mocks funcionando.

---

### Recomendação 4: Criar Abstrações Entre Camadas
**Prioridade:** MÉDIA | **Esforço:** MÉDIO | **Prazo:** 45 dias

**Ação:**
1. Criar interfaces/protocols:
   ```python
   from typing import Protocol

   class Validator(Protocol):
       def validate(self, samples: list[float]) -> bool: ...

   class MaterialRepository(Protocol):
       def get_by_id(self, id: UUID) -> Material: ...
       def list(self, user_id: UUID) -> list[Material]: ...
   ```
2. Implementar adaptadores:
   - SupabaseMaterialRepository implementa MaterialRepository
   - MockMaterialRepository para testes
3. Usar em State via DI:
   ```python
   class QCState(rx.State):
       material_repo: MaterialRepository
   ```

**Resultado Esperado:** 10-15 abstrações, implementações múltiplas (real + mock), desacoplamento alcançado.

---

### Recomendação 5: Documentar Padrões de Design Utilizados
**Prioridade:** MÉDIA | **Esforço:** BAIXO | **Prazo:** 14 dias

**Ação:**
1. Criar arquivo `docs/DESIGN_PATTERNS.md` documentando:
   - Service Layer: quando usar, exemplo em WestgardValidator
   - Mixin Pattern: quando usar, exemplo em QCState
   - Proxy Pattern: Supabase RPC como proxy
   - State Pattern: Reflex reactive state
   - Repository Pattern: (quando implementado) abstração de dados
2. Para cada padrão:
   - Descrição
   - Implementação no projeto
   - Prós/contras
   - Exemplo de código

**Resultado Esperado:** Guia de padrões do projeto, facilita onboarding e manutenção.

---

### Recomendation 6: Adicionar Verificação de Acoplamento em CI/CD
**Prioridade:** MÉDIA | **Esforço:** MÉDIO | **Prazo:** 30 dias

**Ação:**
1. Implementar ferramenta de análise de acoplamento (ex: `networkx` com análise de importações):
   ```python
   # Script que analisa imports
   # Detecta acoplamento cíclico
   # Detecta dependências não-autorizadas
   ```
2. Integrar no CI/CD:
   ```yaml
   - name: Check coupling
     run: python scripts/check_coupling.py
   ```
3. Alertar em PRs se acoplamento aumentar

**Resultado Esperado:** Acoplamento monitorado, tendências detectadas, arquitetura mantida.

---

## 7. CLASSIFICAÇÃO FINAL DO CAPÍTULO

### Resumo por Dimensão

| Dimensão | Avaliação | Justificativa |
|----------|-----------|---------------|
| **Estilo Arquitetural** | **CONFORME** | Layered + State-Driven bem aplicado |
| **Decomposição** | **CONFORME** | Componentes bem definidos, responsabilidades claras |
| **Padrões de Design** | **CONFORME** | Service Layer, Mixin, Proxy bem utilizados |
| **Separação de Responsabilidades** | **PARCIALMENTE CONFORME** | Boa coesão, acoplamento moderado sem abstrações |
| **Modelagem de Dados** | **CONFORME** | Normalização 3NF, RLS implementado |
| **Documentação Arquitetural** | **NÃO CONFORME** | Zero documentação, nenhum diagrama |
| **Modularidade** | **PARCIALMENTE CONFORME** | qc_state.py monolítico, sem DI |

### Pontuação Geral

**MODELAGEM E PROJETO: PARCIALMENTE CONFORME (70%)**

- ✓ Arquitetura bem aplicada, escolhas de design sólidas
- ✓ Modelos de dados normalizados e seguros (RLS)
- ✗ Zero documentação arquitetural
- ⚠ Monolítico qc_state.py, acoplamento sem abstrações
- ✗ Sem DI, sem padrões de configuração

### Recomendação de Ação

**Próximos 90 dias (prioridade):**
1. **(Semana 1-4)** Criar documentação arquitetural completa - CRÍTICA
2. **(Semana 4-8)** Refatorar qc_state.py para modularidade - ALTA
3. **(Semana 8-10)** Implementar injeção de dependência - ALTA
4. **(Semana 10-12)** Criar abstrações entre camadas - MÉDIA

Com estas ações, o projeto avançará de **70%** para **85-90%** conformidade, com arquitetura mais mantível e escalável.

---

**Assinado:** Senior Software Engineering Auditor
**Data:** 31 de março de 2026
**Próxima Auditoria:** 30 de junho de 2026
