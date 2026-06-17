#!/usr/bin/env bash

cat <<'EOF'
SPRING_PROFILES_ACTIVE=prod
PORT=8080
# Use uma destas opções:
SUPABASE_JDBC_URL=jdbc:postgresql://db.<project-ref>.supabase.co:5432/postgres?sslmode=require
# ou
DATABASE_URL=postgresql://postgres.<project-ref>:<senha-encoded>@aws-0-<region>.pooler.supabase.com:5432/postgres

# Opcionais quando a URL não carrega credenciais:
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=<senha-supabase>

# Alternativa por campos separados:
SUPABASE_DB_HOST=db.<project-ref>.supabase.co
SUPABASE_DB_PORT=5432
SUPABASE_DB_NAME=postgres
SUPABASE_DB_USER=postgres
SUPABASE_DB_PASSWORD=<senha-supabase>
SUPABASE_DB_SSL_MODE=require

# Transitório até a governança de migrations versionadas (Flyway/Liquibase).
JPA_DDL_AUTO=update
JWT_SECRET=<chave-64-chars-aleatoria>
# IA generativa — OpenAI (substitui o Gemini, removido na migracao)
OPENAI_API_KEY=<chave-openai>
# Modelos por tier (defaults abaixo; troque pelos IDs reais da sua conta OpenAI)
AI_MODEL_ADVANCED=gpt-5.5
AI_MODEL_MEDIUM=gpt-5.4
AI_MODEL_BASIC=gpt-5.4-mini
CORS_ORIGINS=https://seu-frontend.up.railway.app
APP_FRONTEND_URL=https://seu-frontend.up.railway.app
JAVA_OPTS=-Xmx512m
EOF
