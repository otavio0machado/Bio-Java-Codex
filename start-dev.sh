#!/bin/bash

# ====================================================================
# Biodiagnóstico - Inicializador do Ambiente de Desenvolvimento
# ====================================================================

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "================================================="
echo "   Biodiagnóstico - Ambiente de Desenvolvimento   "
echo "================================================="
echo ""
echo "Escolha uma opção:"
echo "  1) Iniciar Backend (Spring Boot + Supabase)"
echo "  2) Iniciar Frontend (React + Vite)"
echo "  3) Iniciar Ambos em paralelo"
echo ""
read -p "Opção [1, 2 ou 3]: " OPTION

case $OPTION in
  1)
    echo "Iniciando Backend..."
    cd "$ROOT_DIR/biodiagnostico-api"
    ./start-api.sh
    ;;
  2)
    echo "Iniciando Frontend..."
    cd "$ROOT_DIR/biodiagnostico-web"
    npm run dev
    ;;
  3)
    echo "Iniciando Backend e Frontend em paralelo..."
    (cd "$ROOT_DIR/biodiagnostico-api" && ./start-api.sh) &
    API_PID=$!
    (cd "$ROOT_DIR/biodiagnostico-web" && npm run dev) &
    WEB_PID=$!
    trap "kill $API_PID $WEB_PID 2>/dev/null" EXIT
    wait
    ;;
  *)
    echo "Opção inválida."
    exit 1
    ;;
esac
