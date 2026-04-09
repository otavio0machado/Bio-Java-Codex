# 05 — Deploy (Railway + Vercel)

## Arquitetura de Deploy

```
┌─────────────────────┐
│      VERCEL          │  ← Frontend React (grátis)
│  biodiagnostico.app  │
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
3. Conecte o repositório do backend
4. Railway detecta o Dockerfile automaticamente

### Variáveis de ambiente no Railway

```bash
PORT=8080
DB_HOST=db.XXXXX.supabase.co
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=sua-senha-supabase
JWT_SECRET=gere-uma-chave-aleatoria-de-64-caracteres
GEMINI_API_KEY=sua-chave-gemini
CORS_ORIGINS=https://biodiagnostico.vercel.app
```

### Gerar domínio
- Railway fornece: `biodiagnostico-api-production.up.railway.app`
- Ou configure domínio customizado: `api.biodiagnostico.com`

## 3. Vercel (Frontend React)

### Preparar o projeto

O projeto React/Vite já está pronto para Vercel. Basta ter:

**vercel.json** na raiz do projeto React:
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

Isso garante que o React Router funcione (SPA routing).

### Deploy na Vercel

1. Acesse https://vercel.com
2. "Import Project" → conecte o repositório do frontend
3. Framework: Vite
4. Build Command: `npm run build`
5. Output Directory: `dist`

### Variáveis de ambiente na Vercel

```bash
VITE_API_URL=https://biodiagnostico-api-production.up.railway.app/api
```

### Domínio
- Vercel fornece: `biodiagnostico.vercel.app`
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
- [ ] Frontend na Vercel com VITE_API_URL apontando pro Railway
- [ ] Vercel gerando URL pública
- [ ] CORS_ORIGINS no Railway atualizado com URL da Vercel

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

### Vercel
A Vercel já faz deploy automático a cada push no main. Não precisa de CI extra.

## 6. Custos Estimados

| Serviço | Plano | Custo |
|---|---|---|
| Supabase | Free (500MB, 50K requests/mês) | **$0** |
| Railway | Starter ($5 crédito/mês grátis) | **$0–5/mês** |
| Vercel | Hobby (grátis para projetos pessoais) | **$0** |
| Domínio | Opcional (.com.br) | **~R$40/ano** |
| **Total** | | **$0–5/mês** |
