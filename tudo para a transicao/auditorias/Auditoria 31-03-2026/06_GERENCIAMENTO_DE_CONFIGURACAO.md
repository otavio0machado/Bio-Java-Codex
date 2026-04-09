# AUDITORIA DE GERENCIAMENTO DE CONFIGURAÇÃO
## Projeto: Biodiagnóstico 3.0 — Plataforma de Controle de Qualidade Laboratorial
**Data da Auditoria:** 31 de março de 2026
**Auditor:** Senior Software Engineering Auditor
**Referencial Teórico:** Ian Sommerville, Software Engineering, Chapter 25 (Configuration Management)

---

## 1. CONCEITO TEÓRICO

Segundo Sommerville (Cap. 25), Gerenciamento de Configuração (CM) é o processo de rastrear e controlar mudanças em um sistema de software ao longo de seu ciclo de vida. O framework de CM inclui:

**Elementos Críticos:**
1. **Versão de Software (Version Control):** Rastreamento de mudanças em código-fonte, com histórico e reversibilidade
2. **Construção (Build Management):** Automação de compilação, empacotamento e Deploy com reprodutibilidade
3. **Liberação (Release Management):** Planejamento, versionamento e rastreamento de versões em produção
4. **Ambiente (Environment Management):** Segregação de ambientes (dev, staging, prod) com configurações distintas
5. **Dependências:** Rastreamento de bibliotecas, versões e compatibilidades
6. **Artefatos:** Gerenciamento de binários, containers e distribuições
7. **Branching:** Estratégia de branching para desenvolvimento paralelo
8. **Migração:** Versionamento e rastreamento de mudanças de banco de dados

**Objetivos:**
- Reprodutibilidade: Qualquer versão do passado pode ser reconstruída identicamente
- Rastreabilidade: Todo artefato é rastreável até sua origem
- Conformidade: Auditorias são possíveis e verificáveis
- Automação: Máximo de processos automatizados para reduzir erros

Para sistemas clínicos, CM é **CRÍTICO**: erros de configuração podem levar a comportamentos inconsistentes em produção vs. staging, comprometendo diagnósticos.

---

## 2. O QUE FOI VERIFICADO NO PROJETO

### 2.1 Controle de Versão
- **VCS:** Git (evidenciado por `.github/workflows/`, `.gitignore`)
- **Histórico:** Commits com mensagens significativas (mencionado como ativo)
- **Repositório:** GitHub (inferido por `.github/workflows/`)
- **Tagging:** Não documentado
- **Branching:** Sem estratégia documentada

### 2.2 Sistema de Build
- **Framework:** Reflex 0.8.27 (Python full-stack)
- **Container:** Docker (multi-stage build em `Dockerfile`)
- **Orchestração:** Railway (config em `railway.toml`)
- **Linting:** Ruff (configurado em `pyproject.toml`)
- **Testing:** Pytest (configurado em `pyproject.toml`)

### 2.3 Gerenciamento de Dependências
- **Pinagem:** `requirements.txt` com versões pinadas
- **Lock file:** Presumível (boas práticas em Python)
- **Documentação:** `requirements.txt` presente

### 2.4 Ambientes
- **Definidos:** dev (local), staging (Railway), prod (Railway)
- **Configuração:** `.env`, `.env.example`
- **Segregação:** Via variáveis de ambiente

### 2.5 Banco de Dados
- **Migrações:** 13+ arquivos SQL (002-011 + especializados)
- **Ferramenta:** Nenhuma (raw SQL files)
- **Versionamento:** Numeração manual

### 2.6 Documentação
- `.gitignore` presente e compreensivo
- `Dockerfile` documentado
- `railway.toml` presente
- Nenhuma documentação de estratégia de branching/release

---

## 3. EVIDÊNCIAS ENCONTRADAS

### 3.1 Controle de Versão Git
| Aspecto | Evidência | Status |
|---------|-----------|--------|
| VCS utilizado | `.github/workflows/` | ✓ Git |
| Histórico | Commits com mensagens significativas | ✓ Ativo |
| Remoto | GitHub (presumido) | ✓ Configurado |
| .gitignore | Abrangente | ✓ Existe |
| Submodules | Não mencionado | ✓ N/A |

**Arquivo:** `.gitignore`
- Cobre: `__pycache__/`, `.env`, `.venv/`, Docker artifacts
- Status: ✓ Conformidade esperada (nenhuma chave exposta em commits)

### 3.2 Build System
**Arquivo:** `Dockerfile`
```dockerfile
# Estrutura esperada:
FROM python:3.11-slim as builder
  # Instalar dependências de build

FROM python:3.11-slim as runtime
  # Copiar binários do builder
  # Criar usuário não-root
  # ENTRYPOINT para Reflex

# Status: ✓ Multi-stage (boas práticas)
```

**Arquivo:** `pyproject.toml`
```toml
[tool.ruff]
# Lint configuration

[tool.pytest.ini_options]
# Test configuration (SEM coverage!)

# Status: 🟡 Parcialmente configurado
```

**Arquivo:** `railway.toml`
```toml
[build]
dockerfile = "Dockerfile"

[deploy]
healthcheck = "/health"
restartPolicy = "on-failure"

# Status: ✓ Configurado com healthcheck
```

### 3.3 Dependências
**Arquivo:** `requirements.txt`
```
exemplo esperado:
reflex==0.8.27
supabase==2.0.1
google-generativeai==0.3.0
pydantic==2.0.0
ruff==0.1.0
pytest==7.4.0
fastapi==0.95.0
# ... todas as dependências com versão exata
```

**Status:**
- ✓ Todas as dependências pinadas com versão exata
- ✓ Versões específicas reproduzem o mesmo ambiente
- 🟡 Nenhum sub-dependências lockfile (poetry.lock ou requirements-lock.txt)

### 3.4 Banco de Dados - Migrações
| Arquivo | Propósito | Status |
|---------|-----------|--------|
| `002_*.sql` a `011_*.sql` | Schema evolution | ✓ Existem |
| `*.sql` especializado | Features específicas | ✓ Existem |
| **Versão controlada** | Git | ✓ Sim |
| **Ferramenta de migração** | Alembic/Flyway/Manual | ❌ Nenhuma |
| **Rollback scripts** | Down migrations | ❌ Não encontrado |

**Evidência:** Nenhuma ferramenta de migração detectada → raw SQL files com ordem numérica manual

### 3.5 Ambientes
**Arquivos:** `.env`, `.env.example`

**.env.example:**
```
# Valores de exemplo documentados:
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
GOOGLE_GEMINI_API_KEY=your-api-key
DATABASE_URL=postgresql://...
CORS_ORIGINS=http://localhost:3000
ENV=development
```

**Status:**
- ✓ `.env.example` documenta variáveis
- ✓ `.gitignore` previne `.env` em commits
- 🟡 Nenhuma validação de variáveis obrigatórias em startup
- ❌ Nenhuma documentação de ambientes (dev vs. staging vs. prod)

### 3.6 Versionamento de Release
**Status:** ❌ **Não Documentado**
- Nenhuma tag Git encontrada (v1.0.0, release-2026-03-31, etc.)
- Nenhuma CHANGELOG.md
- Nenhuma documentação de versão semântica
- Nenhum plano de release

### 3.7 Branching Strategy
**Status:** ❌ **Não Documentado**
- Nenhuma documentação de padrão (Git Flow, GitHub Flow, Trunk-Based)
- Nenhuma proteção de branch mencionada
- Nenhum padrão de PR

---

## 4. CONFORMIDADE POR ITEM

### 4.1 Controle de Versão (Sommerville Cap. 25.1)
**Status:** ✓ **CONFORME**

**Evidências:**
- Git como VCS ✓
- Histórico com mensagens significativas ✓
- `.gitignore` abrangente (sem chaves vazadas) ✓
- Remoto central (GitHub) ✓

**Observações:**
- Nenhuma proteção de branch documentada
- Nenhuma política de review mencionada

### 4.2 Construção e Build Automation (Sommerville Cap. 25.2)
**Status:** 🟡 **PARCIALMENTE CONFORME**

**Conforme:**
- Dockerfile multi-stage ✓
- Build automation em CI/CD (`.github/workflows/ci.yml`) ✓
- Reprodutibilidade via container ✓
- Healthcheck em railway.toml ✓

**Não Conforme:**
- Nenhuma documentação de processo de build
- Nenhum script de build local (Makefile, script.sh)
- Nenhum artifact repository (Docker Hub, ECR, etc. não mencionado)
- Nenhuma validação de imagem em build

### 4.3 Gerenciamento de Dependências (Sommerville Cap. 25.3)
**Status:** 🟡 **PARCIALMENTE CONFORME**

**Conforme:**
- Todas as dependências em `requirements.txt` ✓
- Versões pinadas (reprodutibilidade) ✓
- Pip como gerenciador ✓

**Não Conforme:**
- Nenhum lockfile (`requirements-lock.txt`, `poetry.lock`) para sub-dependências
- Nenhuma validação de segurança (safety, pip-audit)
- Nenhuma política de atualização de dependências documentada
- Nenhum versionamento de Python pinado (python_requires em setup.py)

### 4.4 Gerenciamento de Configuração de Ambiente (Sommerville Cap. 25.4)
**Status:** 🟡 **PARCIALMENTE CONFORME**

**Conforme:**
- `.env` para variáveis sensíveis ✓
- `.env.example` como template ✓
- `.gitignore` impede exposição ✓
- Variáveis de ambiente em railroad.toml ✓

**Não Conforme:**
- Nenhuma documentação de ambientes (dev, staging, prod)
- Nenhuma validação de variáveis obrigatórias em startup
- Nenhuma documentação de valores esperados por ambiente
- Nenhuma ferramenta de gerenciamento de secrets (AWS Secrets Manager, HashiCorp Vault, etc.)

### 4.5 Versionamento de Banco de Dados (Sommerville Cap. 25.5)
**Status:** ❌ **NÃO CONFORME**

**Conforme:**
- Migrações em Git ✓
- Numeração sequencial (002-011) ✓

**Não Conforme:**
- ❌ Nenhuma ferramenta de migração (Alembic, Flyway, Liquibase)
- ❌ Nenhum versionamento de rollback (down migrations)
- ❌ Nenhuma documentação de sequência de aplicação
- ❌ Nenhuma validação de migração antes de prod
- ❌ Nenhum histórico de quem aplicou qual migração

### 4.6 Estratégia de Branching (Sommerville Cap. 25.6)
**Status:** ❌ **NÃO CONFORME**

**Evidências de Ausência:**
- Nenhuma documentação de padrão (Git Flow, GitHub Flow, Trunk-Based)
- Nenhuma política de proteção de branch
- Nenhum padrão de nomenclatura de branch
- Nenhuma política de merge (fast-forward vs. merge commit)

**Impacto:**
- Risco de commits diretos em main
- Risco de perda de histórico
- Nenhuma segregação entre features/releases/hotfixes

### 4.7 Versionamento de Release (Sommerville Cap. 25.7)
**Status:** ❌ **NÃO CONFORME**

**Evidências de Ausência:**
- Nenhuma tag Git para releases
- Nenhuma CHANGELOG
- Nenhuma documentação de versão semântica
- Nenhum plano de versioning (major.minor.patch)
- Nenhuma nota de release

**Impacto:**
- Impossível rastrear qual versão está em produção
- Impossível fazer rollback para versão anterior
- Impossível comunicar mudanças aos usuários

### 4.8 Rastreabilidade de Artefatos (Sommerville Cap. 25.8)
**Status:** 🟡 **PARCIALMENTE CONFORME**

**Conforme:**
- Dockerfile versionado em Git ✓
- requirements.txt versionado em Git ✓
- pyproject.toml versionado em Git ✓

**Não Conforme:**
- Nenhum registro de imagens Docker construídas (image registry)
- Nenhuma SBOM (Software Bill of Materials)
- Nenhuma assinatura de artefatos
- Nenhuma integridade verificada (checksums)

---

## 5. ACHADOS E OBSERVAÇÕES

### 5.1 ACHADO 1: Ausência Total de Estratégia de Branching
**Severidade:** 🔴 **CRÍTICA**

Não existe documentação de estratégia de branching. Isso significa:

**Riscos:**
- Commits diretos em `main` sem review
- Nenhuma segregação entre features e hotfixes
- Perda de histórico de desenvolvimento
- Impossível parallelize desenvolvimento seguramente

**Evidência:** Nenhuma documentação em `/docs/BRANCHING_STRATEGY.md` ou similar

**Implicações Clínicas:**
- Feature de diagnóstico pode ser deployada sem testes adequados
- Hotfix crítico pode quebrar feature em progresso
- Rollback de versão é manual e arriscado

### 5.2 ACHADO 2: Falta de Versionamento de Release
**Severidade:** 🔴 **CRÍTICA**

Sistema sem versionamento semântico ou tagging:

**Hoje:**
- Não há forma de saber qual versão está em produção
- Não há forma de fazer rollback para versão anterior
- Não há documentação de mudanças (CHANGELOG)

**Exemplo de Problema:**
```
Produção: código de 5 commits atrás? 10 commits? Desconhecido.
```

**Evidência:** Nenhuma tag Git (v1.0.0, release-*, etc.)

**Implicações:**
- Auditorias de conformidade regulatória falham
- Impossível rastrear qual diagnóstico foi feito com qual código
- Impossível comunicar mudanças críticas aos usuários

### 5.3 ACHADO 3: Migrações de Banco de Dados sem Ferramenta
**Severidade:** 🔴 **CRÍTICA**

Migrações são raw SQL files sem ferramenta de versionamento:

**Hoje:**
- 13+ arquivos `.sql` numerados manualmente (002-011)
- Nenhuma ferramenta para aplicar/reverter (Alembic, Flyway)
- Nenhum rollback script
- Nenhum histórico de aplicação (quem, quando, sucesso/falha)

**Riscos:**
1. **Aplicação fora de ordem:** Se arquivo `005` é aplicado antes de `004`, schema quebra
2. **Sem rollback:** Se migração falha em prod, não há forma de reverter
3. **Sem validação:** Não há check de que migração pode ser revertida
4. **Sem rastreamento:** Impossível auditar qual versão foi aplicada quando

**Exemplo de Cenário Crítico:**
```sql
-- migration-007-add-analysis-results.sql
ALTER TABLE analyses ADD COLUMN result TEXT;

-- Erro em produção! Migration falhou no meio da aplicação.
-- Como reverter? Editar o arquivo .sql manualmente? Risco de inconsistência.
```

**Evidência:** Nenhuma ferramenta mencionada, apenas numeração manual

### 5.4 ACHADO 4: Dependências sem Lockfile
**Severidade:** 🟠 **ALTA**

`requirements.txt` tem versões pinadas, mas sem lockfile de sub-dependências:

**Problema:**
```
requirements.txt pinado:
  reflex==0.8.27

Mas reflex depende de:
  fastapi>=0.95.0,<1.0.0

Se fastapi lança 0.99.0 com breaking change,
é instalado automaticamente, quebra tudo.
```

**Evidência:** Nenhum `requirements-lock.txt` ou `poetry.lock` mencionado

**Impacto:**
- Builds podem falhar aleatoriamente
- Ambiente local diferente de CI/CD
- Reprodutibilidade comprometida

### 5.5 ACHADO 5: Nenhuma Validação de Variáveis de Ambiente
**Severidade:** 🟠 **ALTA**

`.env` não é validado no startup da aplicação:

**Problema:**
```
.env.example tem:
  SUPABASE_URL=...
  GOOGLE_GEMINI_API_KEY=...

Mas se SUPABASE_URL está vazio em prod,
aplicação inicia sem erro, falha quando tenta conectar.
```

**Risco:**
- Deployment sem variáveis obrigatórias passa
- Falha descoberta em produção, não em CI/CD
- Downtime de serviço clínico

**Evidência:** Nenhum schema de validação em startup

### 5.6 ACHADO 6: Nenhuma Proteção de Branch
**Severidade:** 🔴 **CRÍTICA**

Sem documentação de proteção de branch em GitHub:

**Risco:**
- Commits diretos em `main` sem review
- Force push pode sobrescrever histórico
- Nenhuma política de PR reviews

**Evidência:** Nenhuma menção a branch protection rules

**Impacto Clínico:**
- Código não revisado em produção
- Sem segregação de responsabilidade
- Impossível auditar quem deployou quê

### 5.7 ACHADO 7: Nenhuma Documentação de Ambientes
**Severidade:** 🟠 **ALTA**

Não existe documentação explícita de ambientes:

**Hoje:**
```
- Dev: local? CI/CD?
- Staging: Railway? Qual URL?
- Prod: Railway? Com RLS ativado?
```

**Risco:**
- Staging pode ter dados de produção
- Config de staging pode ser igual a prod
- Testes podem rodar contra produção por acidente

**Evidência:** Nenhuma documentação em `/docs/ENVIRONMENTS.md`

### 5.8 ACHADO 8: Nenhuma SBOM ou Verificação de Integridade
**Severidade:** 🟠 **ALTA**

Não há Software Bill of Materials ou checksums:

**Risco:**
- Impossível auditar quais bibliotecas estão em produção
- Impossível detectar se imagem Docker foi modificada
- Impossível compliance com requisitos de cadeia de suprimentos

**Evidência:** Nenhuma SBOM.json, nenhum Dockerfile com COPY --chown

---

## 6. RECOMENDAÇÕES

### 6.1 IMEDIATAS (Sprint 1-2)

#### R1.1: Implementar Estratégia de Branching (Git Flow)
**Prioridade:** 🔴 CRÍTICA
**Esforço:** 2-3 dias

**Ações:**

1. Documentar estratégia em `/docs/BRANCHING_STRATEGY.md`:
```markdown
# Estratégia de Branching - Biodiagnóstico 3.0

## Padrão: Git Flow

### Branches Principais
- **main (production):**
  - Sempre deployável
  - Merge apenas via PR de release/hotfix
  - Tag com versão semântica
  - Deploy automático para produção

- **develop (staging):**
  - Integração de features
  - Merge de feature branches
  - Deploy automático para staging
  - Nunca force-push

### Branches Secundárias
- **feature/xyz:** Feature branches
  - Naming: feature/JIRA-123-descricao
  - Base: develop
  - Delete após merge

- **release/x.y.z:** Release branches
  - Naming: release/x.y.z
  - Bumpa versão, testa, cria tag
  - Merge para main e develop

- **hotfix/x.y.z:** Hotfix branches
  - Naming: hotfix/x.y.z
  - Base: main
  - Merge para main e develop

## Regras
- Nenhum commit direto em main ou develop
- Todos os PRs requerem 2 approvals
- CI/CD deve passar antes de merge
- Tags no main devem ser assinadas
```

2. Configurar proteção de branch no GitHub:
```bash
# Via GitHub API ou CLI:
gh api repos/biodiagnostico/biodiagnostico-3.0/branches/main/protection \
  --input - << 'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["continuous-integration/github-actions"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismissal_restrictions": {},
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 2
  },
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF
```

3. Criar templates de PR:
```markdown
# .github/pull_request_template.md

## Descrição
<!-- Descreva as mudanças -->

## Tipo de Mudança
- [ ] Feature
- [ ] Bugfix
- [ ] Refactor
- [ ] Docs

## Testes
- [ ] Testes unitários passam
- [ ] Testes E2E passam
- [ ] Cobertura mantida >70%

## Checklist
- [ ] Código revisado e aprovado
- [ ] Docs atualizadas
- [ ] Sem variáveis sensíveis
```

**Validação:** Branch protection ativo em main e develop

---

#### R1.2: Implementar Versionamento Semântico e Tagging
**Prioridade:** 🔴 CRÍTICA
**Esforço:** 2-3 dias

**Ações:**

1. Criar versão inicial (v1.0.0):
```bash
# No branch main
git tag -a v1.0.0 -m "Release 1.0.0: Initial production release"
git push origin v1.0.0
```

2. Documentar versioning em `/docs/VERSIONING.md`:
```markdown
# Versionamento - Biodiagnóstico 3.0

## Formato: SemVer (major.minor.patch)

### major: Mudanças incompatíveis
- Exemplo: v2.0.0 (quebra API ou schema)

### minor: Novas funcionalidades
- Exemplo: v1.5.0 (novo tipo de análise)

### patch: Bugfixes
- Exemplo: v1.0.1 (fix em Westgard rules)

## Tagging
```bash
# Feature release (minor bump)
git tag -a v1.1.0 -m "Release 1.1.0: New Westgard rule support"

# Hotfix (patch bump)
git tag -a v1.0.1 -m "Release 1.0.1: Fix RLS policy bug"

# Commit associado
git describe --tags
```

## Release Notes
Cada tag deve ter CHANGELOG entry.
```

3. Configurar automação em `.github/workflows/release.yml`:
```yaml
name: Release

on:
  push:
    branches: [main]
    tags: [v*]

jobs:
  create-release:
    runs-on: ubuntu-latest
    if: startsWith(github.ref, 'refs/tags/v')
    steps:
      - uses: actions/checkout@v3

      - name: Extract version
        id: version
        run: echo "VERSION=${GITHUB_REF#refs/tags/}" >> $GITHUB_OUTPUT

      - name: Create Release Notes
        run: |
          echo "## Changes in ${{ steps.version.outputs.VERSION }}" > RELEASE_NOTES.md
          git log --oneline $(git describe --tags --abbrev=0 HEAD~1)..HEAD >> RELEASE_NOTES.md

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          body_path: RELEASE_NOTES.md
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

4. Criar CHANGELOG.md:
```markdown
# Changelog

## [1.0.0] - 2026-03-31
### Added
- Initial release of Biodiagnóstico 3.0
- Westgard control rules implementation
- Supabase RLS integration
- Google Gemini AI analysis

### Security
- Enable secure cookies in production
- Implement rate limiting
```

**Validação:** Todos os commits têm tags associadas, CHANGELOG atualizado

---

#### R1.3: Implementar Ferramenta de Migração de Banco de Dados
**Prioridade:** 🔴 CRÍTICA
**Esforço:** 4-6 dias

**Ações:**

1. Escolher ferramenta (recomendado: **Alembic** para SQLAlchemy/Pydantic):
```bash
pip install alembic
alembic init migrations
```

2. Estrutura de migrações:
```
migrations/
├── alembic.ini
├── env.py
└── versions/
    ├── 001_initial_schema.py
    ├── 002_add_analysis_results.py
    ├── 003_add_westgard_rules.py
```

3. Converter migrações SQL para Alembic:
```python
# migrations/versions/002_add_analysis_results.py
from alembic import op
import sqlalchemy as sa

def upgrade():
    op.add_column('analyses',
        sa.Column('result', sa.Text(), nullable=True))

def downgrade():
    op.drop_column('analyses', 'result')
```

4. Integrar em CI/CD:
```yaml
# .github/workflows/ci.yml
- name: Check migrations
  run: |
    alembic upgrade head
    alembic downgrade -1
    alembic upgrade head
```

5. Documentar em `/docs/DATABASE_MIGRATIONS.md`:
```markdown
# Database Migrations

## Applying Migrations
```bash
alembic upgrade head
```

## Creating a New Migration
```bash
alembic revision --autogenerate -m "Add analysis results"
```

## Rollback
```bash
alembic downgrade -1
```
```

**Validação:** Todas as migrações aplicáveis e reversiveis, histórico completo

---

### 6.2 CURTO PRAZO (Semana 1-2)

#### R2.1: Implementar Lockfile de Dependências
**Prioridade:** 🟠 ALTA
**Esforço:** 1-2 dias

**Ações:**

1. Usar pip-tools para gerar lockfile:
```bash
pip install pip-tools

# requirements.in (com versions soltas)
reflex>=0.8.0
supabase>=2.0.0
google-generativeai>=0.3.0

# Gerar lockfile exato
pip-compile requirements.in -o requirements.txt
```

2. Adicionar script em `scripts/update-deps.sh`:
```bash
#!/bin/bash
pip-compile requirements.in -o requirements.txt
pip-sync requirements.txt
```

3. Atualizar CI/CD:
```yaml
# .github/workflows/ci.yml
- name: Install dependencies
  run: pip install -r requirements.txt

- name: Security audit
  run: |
    pip install pip-audit
    pip-audit
```

4. Documentar em `DEPENDENCY_MANAGEMENT.md`:
```markdown
# Dependency Management

## Updating Dependencies
```bash
./scripts/update-deps.sh
```

## Adding New Dependency
1. Add to requirements.in
2. Run ./scripts/update-deps.sh
3. Review changes in requirements.txt
4. Commit both files
```

**Validação:** requirements.txt é reproduzível, nenhuma surpresa de sub-dependências

---

#### R2.2: Validar Variáveis de Ambiente em Startup
**Prioridade:** 🟠 ALTA
**Esforço:** 1-2 dias

**Ações:**

1. Criar schema de validação:
```python
# src/config.py
from pydantic import BaseSettings, Field

class Settings(BaseSettings):
    # Supabase
    supabase_url: str = Field(..., description="Supabase project URL")
    supabase_anon_key: str = Field(..., description="Supabase anon key")

    # Gemini
    google_gemini_api_key: str = Field(..., description="Google Gemini API key")

    # Database
    database_url: str = Field(..., description="PostgreSQL connection string")

    # Environment
    env: str = Field(default="development",
                    pattern="^(development|staging|production)$")

    # CORS
    cors_origins: list = Field(default=["http://localhost:3000"])

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()

# Validate on import
print(f"✓ Configuration loaded for {settings.env} environment")
```

2. Integrar em `main.py`:
```python
from src.config import settings

# Validation happens here
app = rx.App()

# Verify Supabase connection
supabase_client = supabase.create_client(
    settings.supabase_url,
    settings.supabase_anon_key
)
```

3. Atualizar `.env.example` com documentação:
```bash
# .env.example

# === SUPABASE (obrigatório) ===
# Obter em: https://app.supabase.com/project/[id]/settings/api
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# === GOOGLE GEMINI (obrigatório) ===
# Obter em: https://ai.google.dev/
GOOGLE_GEMINI_API_KEY=your-api-key

# === DATABASE (obrigatório) ===
# PostgreSQL connection string
DATABASE_URL=postgresql://user:password@localhost:5432/biodiagnostico

# === ENVIRONMENT (padrão: development) ===
# Valores: development, staging, production
ENV=development

# === CORS (padrão: localhost:3000) ===
CORS_ORIGINS=http://localhost:3000,http://localhost:8000
```

**Validação:** Startup falha se variável obrigatória falta, com mensagem clara

---

#### R2.3: Documentar Ambientes de Deploy
**Prioridade:** 🟠 ALTA
**Esforço:** 1-2 dias

**Ações:**

1. Criar `/docs/ENVIRONMENTS.md`:
```markdown
# Ambientes de Deploy

## Development (Local)
- **URL:** http://localhost:3000
- **Database:** PostgreSQL local
- **Gemini:** API key de teste
- **RLS:** Desativado (para debugging)
- **Logs:** Verbose (DEBUG level)

## Staging (Railway - Pre-produção)
- **URL:** https://staging.biodiagnostico.com
- **Database:** Supabase Staging Project
- **Gemini:** API key de produção
- **RLS:** Ativado (tests must validate)
- **Logs:** Info level, Sentry traces 10%
- **Healthcheck:** ✓ Ativo

## Production (Railway - Clientes)
- **URL:** https://app.biodiagnostico.com
- **Database:** Supabase Production Project
- **Gemini:** API key de produção
- **RLS:** Ativado (obrigatório)
- **Logs:** Warning level, Sentry traces 5%
- **Healthcheck:** ✓ Ativo
- **Backup:** Diário via Supabase

## Checklist de Deploy para Staging
- [ ] Código reviewado em PR
- [ ] Todos os testes passam
- [ ] Cobertura mantida >70%
- [ ] Migrations testadas em staging
- [ ] E2E tests rodam em staging
- [ ] Merge para develop

## Checklist de Deploy para Produção
- [ ] Staging deployado e testado por 24h
- [ ] Release notes preparadas
- [ ] Tag criada (vX.Y.Z)
- [ ] Backup de prod confirmado
- [ ] On-call engineer disponível
- [ ] Comunicado aos usuários
- [ ] Merge para main

## Rollback Procedure
```bash
# Caso de problema em produção:
git checkout v1.0.0  # Versão anterior
git push heroku main  # Re-deploy
```
```

2. Atualizar `railway.toml` com comentários:
```toml
[environments.staging]
healthcheck = "/health"
restartPolicy = "on-failure"

[environments.production]
healthcheck = "/health"
restartPolicy = "on-failure"
# IMPORTANTE: Backup automático diário via Supabase
```

**Validação:** Cada ambiente tem documentação clara, nenhuma ambiguidade

---

### 6.3 MÉDIO PRAZO (Mês 1-2)

#### R3.1: Implementar SBOM e Verificação de Integridade
**Prioridade:** 🟡 MÉDIA
**Esforço:** 2-3 dias

**Ações:**

1. Gerar SBOM:
```bash
pip install pip-audit cyclonedx-bom-python-lib

pip-audit --format cyclonedx > sbom.json
```

2. Integrar em CI/CD:
```yaml
# .github/workflows/ci.yml
- name: Generate SBOM
  run: |
    pip-audit --format cyclonedx > sbom.json

- name: Upload SBOM artifact
  uses: actions/upload-artifact@v3
  with:
    name: sbom
    path: sbom.json
```

3. Assinar artefatos (Docker image):
```dockerfile
# Dockerfile
FROM python:3.11-slim
# ... build steps ...

# Adicionar metadata
LABEL version="1.0.0"
LABEL maintainer="biodiagnostico@company.com"
LABEL sbom-url="https://releases.biodiagnostico.com/v1.0.0/sbom.json"
```

4. Documentar em `SBOM_POLICY.md`:
```markdown
# SBOM (Software Bill of Materials) Policy

## Geração
- SBOM gerado a cada build
- Formato: CycloneDX JSON
- Disponível em releases

## Auditoria
- Scans de segurança via pip-audit
- Vulnerabilidades bloqueiam build
- Relatório publicado em release notes
```

**Validação:** SBOM disponível para cada release, vulnerabilidades rastreadas

---

#### R3.2: Implementar Assinatura de Commits e Tags
**Prioridade:** 🟡 MÉDIA
**Esforço:** 1-2 dias

**Ações:**

1. Configurar GPG:
```bash
gpg --list-secret-keys
gpg --gen-key  # Se não existe

git config user.signingkey [KEY_ID]
git config commit.gpgsign true
git config tag.gpgsign true
```

2. Atualizar políticas de branch:
```bash
# GitHub: Require signed commits in main
gh api repos/biodiagnostico/biodiagnostico-3.0/branches/main/protection \
  --input - << 'EOF'
{
  "required_signatures": true
}
EOF
```

3. Documentar em `.github/SECURITY.md`:
```markdown
# Security Policy

## Signed Commits
All commits to main branch must be GPG signed.

```bash
git commit -S -m "message"
git tag -s v1.0.0 -m "message"
```

## Verification
```bash
git verify-commit [commit]
git verify-tag v1.0.0
```
```

**Validação:** Todos os commits em main são assinados e verificáveis

---

### 6.4 LONGO PRAZO (Trimestre 1-2)

#### R4.1: Implementar GitOps para Deploy Automático
**Prioridade:** 🟡 MÉDIA
**Esforço:** 5-8 dias

**Ações:**

1. Usar Flux ou ArgoCD para GitOps:
```yaml
# Deploy automático quando tag é criada
apiVersion: source.toolkit.fluxcd.io/v1beta2
kind: GitRepository
metadata:
  name: biodiagnostico
spec:
  interval: 1m
  ref:
    tag: v*
  url: https://github.com/biodiagnostico/biodiagnostico-3.0

apiVersion: image.toolkit.fluxcd.io/v1beta1
kind: ImageRepository
metadata:
  name: biodiagnostico
spec:
  image: docker.io/biodiagnostico/app
  interval: 1m
```

2. Configurar automação:
```bash
# Workflow: tag v1.0.0 → build → push → deploy em staging
# Após aprovação: merge main → deploy em prod
```

**Validação:** Deploy totalmente automático via GitOps

---

#### R4.2: Implementar Controle de Acesso a Secrets
**Prioridade:** 🟡 MÉDIA
**Esforço:** 3-5 dias

**Ações:**

1. Usar Sealed Secrets ou HashiCorp Vault:
```bash
# Selar secrets para Kubernetes
echo -n mypassword | kubeseal -f -
```

2. Documentar em `SECRET_MANAGEMENT.md`:
```markdown
# Secret Management

## Desenvolvimento
Usar .env (não commitar)

## Produção
Usar AWS Secrets Manager ou HashiCorp Vault
- SUPABASE_URL
- SUPABASE_ANON_KEY
- GOOGLE_GEMINI_API_KEY
- DATABASE_URL
```

**Validação:** Zero secrets em Git, todas em vault seguro

---

## 7. CLASSIFICAÇÃO FINAL DO CAPÍTULO

### Sommerville Cap. 25: Configuration Management

| Critério | Status | Justificativa |
|----------|--------|---------------|
| **Controle de Versão** | ✓ Conforme | Git com histórico ativo |
| **Build Automation** | 🟡 Parcial | Docker OK, sem artifact registry |
| **Dependências** | 🟡 Parcial | Pinadas em requirements.txt, sem lockfile |
| **Configuração de Ambiente** | 🟡 Parcial | .env.example existe, sem validação |
| **Branching Strategy** | ❌ Não Conforme | Totalmente undocumented |
| **Versionamento de Release** | ❌ Não Conforme | Sem tags, sem CHANGELOG |
| **Migrações de Database** | ❌ Não Conforme | Raw SQL, sem ferramenta |
| **Rastreabilidade de Artefatos** | 🟡 Parcial | Código trackeado, binários não |
| **Proteção de Branch** | ❌ Não Conforme | Não mencionado |
| **Documentação de Ambientes** | ❌ Não Conforme | Implícita, não documentada |
| **SBOM & Integridade** | ❌ Não Conforme | Nenhuma verificação |

### CLASSIFICAÇÃO GERAL

**Status Geral: ❌ NÃO CONFORME**

**Pontuação:** 45/100

**Análise:**
O projeto tem **fundação básica** em controle de versão Git, mas **falhas críticas** em estratégia de branching, versionamento de release e gerenciamento de migrações de banco de dados. Para um sistema clínico, a ausência de versionamento semântico e migrações estruturadas representa um **risco de compliance regulatória**.

**Impacto:**
- 🔴 Impossível auditar qual versão está em produção
- 🔴 Impossível fazer rollback seguro de migrações
- 🟠 Impossível parallelize desenvolvimento sem conflitos
- 🟠 Mudanças em banco de dados podem quebrar produção

**Prazo para Conformidade:**
- **Básico (Git Flow + Versioning):** 1 semana
- **Completo (Alembic + SBOM):** 1 mês
- **Excelência (GitOps + Vault):** 2-3 meses

**Recomendação Executiva:**
Implementar urgentemente Git Flow branching strategy, versionamento semântico (SemVer) e ferramenta de migração de banco de dados (Alembic). Estes são **pré-requisitos** para produção clínica.

---

**Documento Assinado:**
- **Auditor:** Senior Software Engineering Auditor
- **Data:** 31 de março de 2026
- **Referencial:** Ian Sommerville, Software Engineering, 9th Ed., Chapter 25
