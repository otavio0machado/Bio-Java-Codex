#!/bin/bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

if [ -f .env ]; then
  echo "Carregando variáveis do .env..."
  set -a
  source .env
  set +a
fi

echo "Iniciando biodiagnostico-api conectado ao Supabase..."
./mvnw spring-boot:run
