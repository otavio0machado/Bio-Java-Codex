# Tutorial de Deploy — Biodiagnóstico

Guia passo a passo para colocar o sistema em produção usando **Supabase** (banco de dados) e **Railway** (backend + frontend).

---

## Arquitetura

```
Usuário (browser)
    │
    ▼
Railway Frontend (React/Nginx)     ← porta 3000
    │  HTTPS
    ▼
Railway Backend (Java/Spring Boot) ← porta 8080
    │  JDBC + SSL
    ▼
Supabase PostgreSQL                ← porta 6543 (pooler)
```

---

## ETAPA 1 — Supabase (Banco de Dados)

### 1.1. Criar conta e projeto

1. Acesse **https://supabase.com** e crie uma conta (ou faça login).
2. Clique em **"New Project"**.
3. Preencha:
   - **Name**: `biodiagnostico`
   - **Database Password**: Gere uma senha forte e **anote-a** (você vai precisar).
   - **Region**: `South America (São Paulo)` — ou a mais próxima de você.
4. Clique em **"Create new project"** e aguarde 1-2 minutos.

### 1.2. Copiar a Connection String

1. No painel do projeto, vá em **Settings** (engrenagem) → **Database**.
2. Na seção **"Connection string"**, selecione a aba **"URI"**.
3. Selecione o modo **"Transaction pooler"** (porta 6543) — recomendado para apps serverless.
4. Copie a URI. Ela terá este formato:

```
postgresql://postgres.[SEU-REF]:[SUA-SENHA]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
```

5. **Substitua `[SUA-SENHA]`** pela senha do banco que você criou.
6. **Guarde essa URI completa.** Será a variável `DATABASE_URL`.

> **IMPORTANTE**: Não é necessário criar tabelas manualmente. O backend Java vai criar todas as tabelas automaticamente no primeiro boot (usando `ddl-auto: update`).

---

## ETAPA 2 — Gerar Segredos

Antes de configurar o Railway, gere os seguintes valores:

### 2.1. JWT_SECRET (chave de criptografia dos tokens)

No terminal, execute:

```bash
openssl rand -base64 64
```

Copie o resultado inteiro (uma string longa). Será o `JWT_SECRET`.

### 2.2. ADMIN_INITIAL_PASSWORD (senha do Evandro)

Escolha uma senha forte para o login do administrador. Requisitos:
- Mínimo 8 caracteres
- Pelo menos 1 letra maiúscula
- Pelo menos 1 letra minúscula
- Pelo menos 1 número

Exemplo: `Evandro2024!` (use algo mais forte em produção).

---

## ETAPA 3 — Railway (Backend)

### 3.1. Criar conta no Railway

1. Acesse **https://railway.app** e crie uma conta (pode usar GitHub).
2. Conecte sua conta GitHub ao Railway.

### 3.2. Criar o projeto

1. No dashboard do Railway, clique em **"New Project"**.
2. Selecione **"Deploy from GitHub repo"**.
3. Escolha o repositório `Bio-Java-Codex` (ou o nome do seu repo).
4. O Railway vai detectar o projeto. **IMPORTANTE**: Ele vai tentar fazer deploy da raiz, mas precisamos configurar subdiretórios separados.

### 3.3. Configurar o serviço Backend

1. Após criar o projeto, clique no serviço que foi criado.
2. Vá em **Settings**:
   - **Root Directory**: Mude para `biodiagnostico-api`
   - **Builder**: `Dockerfile` (deve detectar automaticamente)
3. Vá em **Variables** e adicione cada variável **uma por uma**:

| Variável | Valor |
|----------|-------|
| `SPRING_PROFILES_ACTIVE` | `prod` |
| `PORT` | `8080` |
| `DATABASE_URL` | *(a URI do Supabase que você copiou na Etapa 1.2)* |
| `JWT_SECRET` | *(o valor gerado na Etapa 2.1)* |
| `ADMIN_INITIAL_PASSWORD` | *(a senha que você escolheu na Etapa 2.2)* |
| `CORS_ORIGINS` | *(deixe em branco por agora — vamos preencher depois)* |
| `APP_FRONTEND_URL` | *(deixe em branco por agora — vamos preencher depois)* |
| `JPA_DDL_AUTO` | `update` |

4. O deploy vai iniciar automaticamente. Aguarde o build (3-5 minutos).

### 3.4. Verificar o deploy do Backend

1. Após o build terminar com sucesso, vá em **Settings** → **Networking**.
2. Clique em **"Generate Domain"** para gerar uma URL pública.
3. Você vai receber algo como: `biodiagnostico-api-production.up.railway.app`
4. Teste no navegador:

```
https://biodiagnostico-api-production.up.railway.app/actuator/health
```

Deve retornar: `{"status":"UP",...}`

5. **Anote a URL do backend** (sem `/actuator/health`).

### 3.5. Verificar a criação do admin

Nos **logs** do Railway (aba "Deployments" → clique no deploy → "View Logs"), procure:

```
Admin user 'evandro' created successfully.
```

Se aparecer, o admin foi criado com sucesso.

---

## ETAPA 4 — Railway (Frontend)

### 4.1. Criar novo serviço

1. No mesmo projeto Railway, clique em **"+ New"** → **"Service"** → **"GitHub Repo"**.
2. Selecione o mesmo repositório.
3. Nas **Settings**:
   - **Root Directory**: `biodiagnostico-web`
   - **Builder**: `Dockerfile`

### 4.2. Configurar variáveis

Vá em **Variables** e adicione:

| Variável | Valor |
|----------|-------|
| `VITE_API_URL` | `https://[SUA-URL-BACKEND]/api` |
| `PORT` | `3000` |

**Exemplo de VITE_API_URL:**
```
https://biodiagnostico-api-production.up.railway.app/api
```

> **ATENÇÃO**: O `VITE_API_URL` é usado durante o **build** (não em runtime). Por isso ele é passado como build arg no Dockerfile. Se você mudar essa variável, precisa re-deploy para aplicar.

### 4.3. Gerar domínio público

1. Vá em **Settings** → **Networking**.
2. Clique em **"Generate Domain"**.
3. Você vai receber algo como: `biodiagnostico-web-production.up.railway.app`
4. **Anote a URL do frontend.**

### 4.4. Aguardar o build

O frontend leva 1-2 minutos para buildar. Após o deploy, acesse a URL no navegador. Você verá a tela de login.

---

## ETAPA 5 — Conectar Backend ↔ Frontend (CORS)

Agora que você tem as duas URLs, volte ao **serviço Backend** no Railway e atualize:

| Variável | Valor |
|----------|-------|
| `CORS_ORIGINS` | `https://biodiagnostico-web-production.up.railway.app` |
| `APP_FRONTEND_URL` | `https://biodiagnostico-web-production.up.railway.app` |

*(Use a URL real do seu frontend, sem barra no final)*

O Railway vai re-deploy automaticamente ao salvar as variáveis.

---

## ETAPA 6 — Primeiro Login

1. Acesse a URL do frontend no navegador.
2. Na tela de login:
   - **Nome de usuário**: `evandro`
   - **Senha**: *(a senha que você colocou em ADMIN_INITIAL_PASSWORD)*
3. Após o login, você será direcionado ao Dashboard.
4. Na barra de navegação, clique em **"Usuários"** para acessar a gestão de usuários.

### 6.1. Trocar a senha (recomendado)

Após o primeiro login, vá em **Usuários**, encontre o usuário "Evandro Torres Machado", clique no ícone de chave (🔑) e defina uma nova senha.

### 6.2. Criar outros usuários

Na página de Usuários, clique em **"Novo Usuário"** e crie os perfis necessários:

| Perfil | Descrição |
|--------|-----------|
| **Funcionário** | Operadores do laboratório — marque as permissões que cada um precisa |
| **Vigilância Sanitária** | Acesso de leitura e download de tudo |
| **Visualizador** | Apenas visualização, sem download |

Para cada **Funcionário**, marque as permissões desejadas:
- ☑ Registrar CQ
- ☑ Gerenciar Reagentes
- ☑ Registrar Manutenção
- ☑ Baixar Relatórios
- ☑ Importar Dados

---

## ETAPA 7 — Pós-Deploy (Segurança)

### 7.1. Remover a senha inicial do Railway

Após o primeiro login e troca de senha, **remova** a variável `ADMIN_INITIAL_PASSWORD` do serviço Backend no Railway. O admin já foi criado e essa variável não é mais necessária.

### 7.2. Mudar DDL para validate (opcional, recomendado)

Depois de confirmar que tudo funciona, no Backend do Railway, mude:

```
JPA_DDL_AUTO=validate
```

Isso impede que o Hibernate modifique a estrutura do banco automaticamente — mais seguro em produção.

### 7.3. Configurar domínio customizado (opcional)

Se quiser usar um domínio próprio (ex: `app.biodiagnostico.com`):

1. No Railway, vá em **Settings** → **Networking** → **Custom Domain**.
2. Adicione seu domínio.
3. Configure o DNS do seu provedor (CNAME apontando para o domínio Railway).
4. **Atualize** as variáveis `CORS_ORIGINS` e `APP_FRONTEND_URL` no backend para o novo domínio.

---

## Resumo de Variáveis

### Backend (Railway)

| Variável | Obrigatória | Exemplo |
|----------|:-----------:|---------|
| `SPRING_PROFILES_ACTIVE` | Sim | `prod` |
| `PORT` | Sim | `8080` |
| `DATABASE_URL` | Sim | `postgresql://postgres.xxx:senha@...supabase.com:6543/postgres` |
| `JWT_SECRET` | Sim | *(openssl rand -base64 64)* |
| `CORS_ORIGINS` | Sim | `https://meu-frontend.up.railway.app` |
| `APP_FRONTEND_URL` | Sim | `https://meu-frontend.up.railway.app` |
| `ADMIN_INITIAL_PASSWORD` | 1x | *(remover após primeiro login)* |
| `JPA_DDL_AUTO` | Sim | `update` → depois `validate` |
| `GEMINI_API_KEY` | Não | *(para funcionalidade de IA)* |

### Frontend (Railway)

| Variável | Obrigatória | Exemplo |
|----------|:-----------:|---------|
| `VITE_API_URL` | Sim | `https://meu-backend.up.railway.app/api` |
| `PORT` | Sim | `3000` |

---

## Custos Estimados

| Serviço | Plano | Custo |
|---------|-------|-------|
| **Supabase** | Free | $0/mês (500MB, 50K requests) |
| **Railway** | Hobby | $5/mês + uso ($0.000231/min vCPU) |

Para uso moderado de laboratório, o custo total fica em torno de **$5-15/mês**.

---

## Checklist Final

- [ ] Supabase: Projeto criado
- [ ] Railway: Backend online (health = UP)
- [ ] Railway: Frontend acessível
- [ ] CORS configurado (backend aceita frontend)
- [ ] Login do admin "evandro" funciona
- [ ] Dashboard carrega com KPIs
- [ ] Registro de CQ funciona
- [ ] Relatórios PDF gerados com sucesso
- [ ] Novo usuário criado via admin
- [ ] ADMIN_INITIAL_PASSWORD removido
- [ ] JPA_DDL_AUTO alterado para validate

---

## Troubleshooting

### "Credenciais inválidas" no login
- Verifique nos logs do backend se o admin foi criado: `Admin user 'evandro' created successfully.`
- Se não aparecer, verifique se `ADMIN_INITIAL_PASSWORD` está definida.

### CORS error no navegador
- Confirme que `CORS_ORIGINS` no backend tem **exatamente** a mesma URL do frontend (sem barra final).
- Exemplo correto: `https://meu-frontend.up.railway.app`
- Exemplo errado: `https://meu-frontend.up.railway.app/`

### Backend não conecta ao Supabase
- Verifique se `DATABASE_URL` está no formato correto.
- Use a porta **6543** (pooler), não 5432.
- Verifique se a senha do banco está correta na URL.

### Frontend mostra página branca
- Verifique se `VITE_API_URL` está correto e aponta para o backend com `/api` no final.
- Faça re-deploy após mudar a variável (é um build arg, não runtime).

### Tabelas não foram criadas
- Verifique se `JPA_DDL_AUTO=update` está definido.
- Verifique os logs do backend por erros de conexão com o banco.
