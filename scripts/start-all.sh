#!/bin/bash
echo "🔵 RL - Inicializando Ambiente de Desenvolvimento"

echo "🔹 Subindo Docker (Postgres + Redis)..."
docker compose up -d postgres redis

echo "🔹 Iniciando Backend..."
cd apps/backend
npm install
npx prisma generate
npx prisma migrate dev --name init || true
npm run start:dev &
BACKEND_PID=$!
cd ../..

echo "🔹 Iniciando Frontend..."
cd apps/web
npm install
npm run dev &
FRONTEND_PID=$!
cd ../..

echo "✨ Ambiente RL iniciado com sucesso!"
echo "Backend → http://localhost:3001"
echo "Frontend → http://localhost:3000"
echo "Para encerrar: ./scripts/stop-all.sh"

exit 0
