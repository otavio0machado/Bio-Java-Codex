# Prompt 17 — Deploy Railway

Cole este prompt inteiro no Claude:

---

Configure o deploy completo do Biodiagnóstico 4.0 com Railway-only: backend Java no Railway, frontend React no Railway e banco PostgreSQL no Supabase.

## Backend (Railway):

### 1. Dockerfile (raiz do projeto Spring Boot)
```dockerfile
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app
COPY . .
RUN chmod +x mvnw && ./mvnw clean package -DskipTests

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

### 2. .dockerignore
```
.git
.gitignore
target
*.md
.idea
.vscode
```

### 3. railway.toml (opcional, Railway detecta Dockerfile)
```toml
[build]
builder = "dockerfile"
dockerfilePath = "Dockerfile"

[deploy]
healthcheckPath = "/actuator/health"
restartPolicyType = "on_failure"
```

### 4. Variáveis de ambiente para Railway:
Gere um script que liste todas as variáveis necessárias com valores de exemplo:
```bash
SPRING_PROFILES_ACTIVE=prod
PORT=8080
DATABASE_URL=postgresql://postgres.<project-ref>:<senha-encoded>@aws-0-<region>.pooler.supabase.com:5432/postgres
# ou SUPABASE_JDBC_URL=jdbc:postgresql://db.<project-ref>.supabase.co:5432/postgres?sslmode=require
JWT_SECRET=<chave-64-chars-aleatoria>
GEMINI_API_KEY=<chave-gemini>
CORS_ORIGINS=https://biodiagnostico-web-production.up.railway.app
APP_FRONTEND_URL=https://biodiagnostico-web-production.up.railway.app
JPA_DDL_AUTO=update
JAVA_OPTS=-Xmx512m
```

## Frontend (Railway):

### 1. Dockerfile / Nginx
O frontend deve ser servido por container Nginx, com:

- `Dockerfile`
- `railway.toml`
- `nginx.conf.template`
- `docker-entrypoint.d/40-generate-seo.sh`

### 2. railway.toml
```toml
[build]
builder = "dockerfile"
dockerfilePath = "Dockerfile"

[deploy]
healthcheckPath = "/health"
restartPolicyType = "on_failure"
```

### 3. Variáveis de ambiente do frontend
```bash
PORT=3000
VITE_API_URL=https://biodiagnostico-api-production.up.railway.app/api
PUBLIC_SITE_URL=https://biodiagnostico-web-production.up.railway.app
```

## GitHub Actions CI/CD:

### .github/workflows/backend-ci.yml
```yaml
name: Backend CI

on:
  push:
    branches: [main]
    paths:
      - 'biodiagnostico-api/**'
  pull_request:
    branches: [main]
    paths:
      - 'biodiagnostico-api/**'

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: biodiagnostico_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: 21
          cache: maven

      - name: Run tests
        working-directory: biodiagnostico-api
        run: ./mvnw test
        env:
          DB_HOST: localhost
          DB_PORT: 5432
          DB_NAME: biodiagnostico_test
          DB_USER: test
          DB_PASSWORD: test
          JWT_SECRET: test-secret-key-that-is-at-least-256-bits-long-for-testing
```

### .github/workflows/frontend-ci.yml
```yaml
name: Frontend CI

on:
  push:
    branches: [main]
    paths:
      - 'biodiagnostico-web/**'
  pull_request:
    branches: [main]
    paths:
      - 'biodiagnostico-web/**'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: biodiagnostico-web/package-lock.json

      - name: Install & Build
        working-directory: biodiagnostico-web
        run: |
          npm ci
          npm run build
        env:
          VITE_API_URL: https://api.example.com
```

## Checklist pós-deploy:
Gere um script de verificação que testa:
1. Health check do backend: `curl https://<railway-url>/actuator/health`
2. Login funciona: `curl -X POST https://<railway-url>/api/auth/login -d '{"email":"admin@bio.com","password":"xxx"}'`
3. Frontend carrega: `curl -I https://<frontend-railway-url>/`
4. CORS funciona: `curl -H "Origin: https://<frontend-railway-url>" https://<railway-url>/api/dashboard/kpis`

## Regras:
- Gere TODOS os arquivos de configuração completos
- Gere o script de health check
- Não deixe nenhuma credencial real nos arquivos (use placeholders)
