#!/bin/bash
echo "🛑 Encerrando RL..."

echo "🔹 Matando processos Node..."
pkill -f "node .*backend"
pkill -f "node .*web"

echo "🔹 Finalizando containers docker..."
docker compose stop

echo "✨ Ambiente RL encerrado."

exit 0
