# 05 — Deploy (Railway + Railway)

## Arquitetura de Deploy

```
┌─────────────────────┐
│     RAILWAY          │  ← Frontend React (container)
│  biodiagnostico-web  │
│  .up.railway.app     │
└────────┬────────────┘
         │ HTTPS
         ▼
┌─────────────────────┐
│     RAILWAY          │  ← Backend Java Spring Boot
│  biodiagnostico-api  │
│  .up.railway.app     │
└────────┬────────────┘
         │ JDBC
         ▼
┌─────────────────────┐
│     SUPABASE         │  ← PostgreSQL (banco novo)
│  db.xxxx.supabase.co │
└─────────────────────┘
```

## 1. Supabase (Banco de Dados)

### Criar novo projeto
1. Acesse https://supabase.com/dashboard
2. "New Project" → nome: `biodiagnostico-v4`
3. Escolha região: South America (São Paulo) se disponível
4. Anote: **URL**, **anon key**, **service role key**, **password**
5. Vá em SQL Editor → cole e execute o schema de `01-SCHEMA-SQL.md`

### Credenciais de conexão (para o Railway)
```
Host: db.XXXXX.supabase.co
Port: 5432
Database: postgres
User: postgres
Password: (a que você definiu ao criar o projeto)
```

## 2. Railway (Backend Java)

### Preparar o projeto

**Dockerfile** na raiz do projeto Spring Boot:
```dockerfile
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app
COPY . .
RUN ./mvnw clean package -DskipTests

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

**system.properties** (opcional, Railway detecta):
```
java.runtime.version=21
```

### Deploy no Railway

1. Acesse https://railway.app
2. "New Project" → "Deploy from GitHub repo"
3. Conecte o repositório
4. Configure o serviço com root em `biodiagnostico-api`
5. Railway detecta o Dockerfile automaticamente

### Variáveis de ambiente no Railway

```bash
SPRING_PROFILES_ACTIVE=prod
PORT=8080
DATABASE_URL=postgresql://postgres.<project-ref>:<senha-encoded>@aws-0-<region>.pooler.supabase.com:5432/postgres
# ou SUPABASE_JDBC_URL=jdbc:postgresql://db.<project-ref>.supabase.co:5432/postgres?sslmode=require
JWT_SECRET=gere-uma-chave-aleatoria-de-64-caracteres
GEMINI_API_KEY=sua-chave-gemini
CORS_ORIGINS=https://biodiagnostico-web-production.up.railway.app
APP_FRONTEND_URL=https://biodiagnostico-web-production.up.railway.app
JPA_DDL_AUTO=update
JAVA_OPTS=-Xmx512m
```

Observação:

- `JPA_DDL_AUTO=update` continua sendo um mecanismo transitório de bootstrap até a decisão formal sobre Flyway/Liquibase.

### Gerar domínio
- Railway fornece: `biodiagnostico-api-production.up.railway.app`
- Ou configure domínio customizado: `api.biodiagnostico.com`

## 3. Railway (Frontend React)

### Preparar o projeto

O projeto React/Vite já está pronto para Railway com container Nginx. Os artefatos principais são:

- `Dockerfile`
- `railway.toml`
- `nginx.conf.template`
- `docker-entrypoint.d/40-generate-seo.sh`

### Deploy no Railway

1. No mesmo projeto Railway, crie um novo serviço a partir do mesmo repositório
2. Configure o serviço com root em `biodiagnostico-web`
3. Railway usa o `Dockerfile` para build e o Nginx para servir a SPA
4. O healthcheck do frontend fica em `/health`

### Variáveis de ambiente no Railway

```bash
VITE_API_URL=https://biodiagnostico-api-production.up.railway.app/api
PUBLIC_SITE_URL=https://biodiagnostico-web-production.up.railway.app
```

### Domínio
- Railway fornece: `biodiagnostico-web-production.up.railway.app`
- Ou configure: `biodiagnostico.com` (comprar domínio)

## 4. Checklist de Deploy

### Antes de deployar

- [ ] Schema SQL executado no Supabase novo
- [ ] Usuário admin criado via endpoint /api/auth/register
- [ ] Backend rodando local com `mvn spring-boot:run`
- [ ] Frontend rodando local com `npm run dev`
- [ ] Login funcionando (JWT)
- [ ] CRUD de CQ funcionando
- [ ] Gráfico Levey-Jennings renderizando

### Deploy

- [ ] Backend no Railway com variáveis configuradas
- [ ] Railway gerando URL pública
- [ ] Frontend no Railway com VITE_API_URL apontando pro backend
- [ ] Railway gerando URL pública do frontend
- [ ] CORS_ORIGINS e APP_FRONTEND_URL no backend atualizados com URL final do frontend

### Pós-deploy

- [ ] Login funciona em produção
- [ ] Dashboard carrega KPIs
- [ ] Registro de CQ funciona
- [ ] Gráficos renderizam
- [ ] PDF de relatório gera e baixa
- [ ] Gemini responde análises

## 5. CI/CD (opcional, recomendado)

### GitHub Actions para o Backend

```yaml
# .github/workflows/deploy.yml
name: Deploy Backend
on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: 21
      - run: ./mvnw test

  # Railway deploya automaticamente via GitHub integration
```

### Frontend
Se o frontend também estiver conectado ao GitHub no Railway, o deploy automático passa a seguir o mesmo fluxo de atualização do backend.

## 6. Custos Estimados

| Serviço | Plano | Custo |
|---|---|---|
| Supabase | Free (500MB, 50K requests/mês) | **$0** |
| Railway | Backend + Frontend | varia conforme uso |
| Domínio | Opcional (.com.br) | **~R$40/ano** |
| **Total** | | **infra principal no Railway + Supabase** |
