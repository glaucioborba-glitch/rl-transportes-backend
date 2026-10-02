#!/bin/bash
# ============================================
# RL Transportes — Deploy contínuo
# ============================================
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/rl-transportes}"
COMPOSE="docker compose -f $APP_DIR/infra/docker-compose.prod.yml --env-file $APP_DIR/.env.production"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Iniciando deploy...${NC}"
cd "$APP_DIR"

if [ ! -f "$APP_DIR/.env.production" ]; then
  echo "❌ .env.production não encontrado"
  exit 1
fi

echo -e "${YELLOW}[1/5] Git pull...${NC}"
git pull origin main

echo -e "${YELLOW}[2/5] Build backend + frontend...${NC}"
$COMPOSE build --no-cache backend frontend

echo -e "${YELLOW}[3/5] Restart serviços...${NC}"
$COMPOSE up -d backend frontend

echo -e "${YELLOW}[4/5] Healthcheck...${NC}"
sleep 15
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/health || echo "000")
if [ "$HEALTH" = "200" ]; then
  echo -e "${GREEN}✅ Backend /health OK${NC}"
else
  echo "❌ Backend /health retornou HTTP $HEALTH"
  docker logs rl-backend --tail 50
  exit 1
fi

echo -e "${YELLOW}[5/5] Migrations...${NC}"
docker exec rl-backend npx prisma migrate deploy

docker exec rl-nginx nginx -s reload 2>/dev/null || true

echo -e "${GREEN}✅ Deploy concluído${NC}"
