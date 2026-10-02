#!/bin/bash
# ============================================
# RL Transportes — Setup Oracle Cloud VM (one-shot)
# Ubuntu 22.04 ARM — rodar como root
# ============================================
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN} RL Transportes — Setup Oracle VM      ${NC}"
echo -e "${GREEN}========================================${NC}"

if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Erro: execute como root (sudo)${NC}"
  exit 1
fi

APP_DIR="${APP_DIR:-/opt/rl-transportes}"

echo -e "${YELLOW}[1/8] Instalando Docker...${NC}"
apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
apt-get update
apt-get install -y ca-certificates curl gnupg lsb-release software-properties-common git openssl

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
  | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable docker
systemctl start docker
echo -e "${GREEN}✅ Docker instalado${NC}"

echo -e "${YELLOW}[2/8] Configurando swap (4GB)...${NC}"
if [ ! -f /swapfile ]; then
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo 'vm.swappiness=10' >> /etc/sysctl.conf
  sysctl -p
  echo -e "${GREEN}✅ Swap 4GB criado${NC}"
else
  echo -e "${GREEN}✅ Swap já existe${NC}"
fi

echo -e "${YELLOW}[3/8] Criando usuário rl...${NC}"
if ! id -u rl &>/dev/null; then
  useradd -m -s /bin/bash -G docker rl
  echo -e "${GREEN}✅ Usuário rl criado${NC}"
else
  usermod -aG docker rl
  echo -e "${GREEN}✅ Usuário rl já existe${NC}"
fi

echo -e "${YELLOW}[4/8] Repositório...${NC}"
if [ ! -d "$APP_DIR/.git" ]; then
  read -r -p "URL do repositório Git: " REPO_URL
  git clone "$REPO_URL" "$APP_DIR"
  chown -R rl:rl "$APP_DIR"
  echo -e "${GREEN}✅ Repo clonado em $APP_DIR${NC}"
else
  echo -e "${GREEN}✅ Repo já existe em $APP_DIR${NC}"
fi

echo -e "${YELLOW}[5/8] .env.production...${NC}"
ENV_FILE="$APP_DIR/.env.production"
if [ ! -f "$ENV_FILE" ]; then
  cp "$APP_DIR/infra/.env.production.example" "$ENV_FILE"
  JWT_ACCESS=$(openssl rand -hex 32)
  JWT_REFRESH=$(openssl rand -hex 32)
  DB_PASS=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)
  sed -i "s|DB_PASSWORD=TROCAR_POR_SENHA_FORTE_32_CHARS|DB_PASSWORD=$DB_PASS|g" "$ENV_FILE"
  sed -i "s|JWT_SECRET=TROCAR_POR_SECRET_64_CHARS|JWT_SECRET=$JWT_ACCESS|g" "$ENV_FILE"
  sed -i "s|JWT_REFRESH_SECRET=TROCAR_POR_SECRET_64_CHARS_DIFERENTE|JWT_REFRESH_SECRET=$JWT_REFRESH|g" "$ENV_FILE"
  chown rl:rl "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  echo -e "${GREEN}✅ .env.production criado (secrets gerados)${NC}"
  echo -e "${YELLOW}  → Edite: SSL_DOMAIN, CORS_ORIGIN, PUBLIC_API_URL, S3, NFSe, SEED_ADMIN_*${NC}"
else
  echo -e "${GREEN}✅ .env.production já existe${NC}"
fi

echo -e "${YELLOW}[6/8] Firewall (iptables)...${NC}"
iptables -F INPUT
iptables -F FORWARD
iptables -P INPUT DROP
iptables -P FORWARD ACCEPT
iptables -P OUTPUT ACCEPT
iptables -A INPUT -i lo -j ACCEPT
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A INPUT -p tcp --dport 22 -j ACCEPT
iptables -A INPUT -p tcp --dport 80 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -j ACCEPT
DEBIAN_FRONTEND=noninteractive apt-get install -y iptables-persistent
netfilter-persistent save
echo -e "${GREEN}✅ Firewall: 22, 80, 443${NC}"

echo -e "${YELLOW}[7/8] Backup diário (CRON 02:00)...${NC}"
BACKUP_SCRIPT="$APP_DIR/infra/scripts/backup-db.sh"
if [ -f "$BACKUP_SCRIPT" ]; then
  chmod +x "$BACKUP_SCRIPT"
  CRON_LINE="0 2 * * * $BACKUP_SCRIPT >> /var/log/rl-backup.log 2>&1"
  if ! crontab -l 2>/dev/null | grep -q "$BACKUP_SCRIPT"; then
    (crontab -l 2>/dev/null; echo "$CRON_LINE") | crontab -
  fi
  echo -e "${GREEN}✅ CRON de backup configurado${NC}"
fi

echo -e "${YELLOW}[8/8] Permissões scripts deploy...${NC}"
chmod +x "$APP_DIR/infra/scripts/deploy.sh" 2>/dev/null || true
chmod +x "$APP_DIR/infra/scripts/restore-db.sh" 2>/dev/null || true

echo ""
echo -e "${GREEN}Setup concluído.${NC}"
echo "Próximos passos:"
echo "  1. nano $ENV_FILE"
echo "  2. cd $APP_DIR && docker compose -f infra/docker-compose.prod.yml --env-file .env.production up -d --build"
echo "  3. docker exec rl-backend npx prisma migrate deploy"
echo "  4. docker exec rl-backend npm run seed:prod"
echo "  5. Certbot (após DNS apontar): ver infra/README-DEPLOY.md"
