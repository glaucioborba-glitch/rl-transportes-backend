#!/usr/bin/env bash
# =============================================================================
# RL Transportes — instalador da máquina de DEMO (LAN, 30/09/2026)
#
# Um arquivo só. Leve no pendrive. NÃO é o setup da Oracle/AWS.
# Precisa de internet (apt, Docker Hub, GitHub).
#
# Inclui: nomodeset no GRUB, apt, Docker oficial, swap, firewall,
# clone, .env, build e seed do roteiro.
#
# No PC de casa: copie ESTE arquivo para a raiz do pendrive
#   (nome: montar-demo-lab.sh).
#
# No Ubuntu Server (sem tela gráfica o USB NÃO monta sozinho):
#   lsblk
#   sudo mkdir -p /mnt/pendrive
#   sudo mount /dev/sdb1 /mnt/pendrive
#     (se sdb1 falhar, tente sda1 ou o disco que o lsblk mostrou como
#      tamanho do pendrive, não o HD de 1T)
#   cp /mnt/pendrive/montar-demo-lab.sh ~
#   bash ~/montar-demo-lab.sh
#
# O script pede sudo quando precisar. NÃO rode como root (não use sudo bash).
# Primeira vez neste i5/HDD: 40–90 minutos. Deixe ligado. Não é o dia 30.
# =============================================================================

# Converte CRLF do Windows ANTES do set -o pipefail (senão o bash quebra).
if grep -q $'\r' "$0" 2>/dev/null; then
  echo "Arquivo veio do Windows (CRLF). Convertendo e reiniciando..."
  sed -i 's/\r$//' "$0"
  exec bash "$0" "$@"
fi

set -euo pipefail

if [ "$(id -u)" -eq 0 ]; then
  echo "Rode SEM sudo:  bash montar-demo-lab.sh"
  echo "O script pede senha só nos passos de sistema."
  exit 1
fi

ARCH="$(uname -m)"
if [ "$ARCH" != "x86_64" ]; then
  echo "Esta máquina é $ARCH. O pacote da demo é AMD64 (x86_64). Pare e avise."
  exit 1
fi

REPO_URL="${REPO_URL:-https://github.com/glaucioborba-glitch/rl-transportes-backend.git}"
DEMO_BRANCH="${DEMO_BRANCH:-feat/container-dossie-container-first-ui}"
APP_DIR="${APP_DIR:-/opt/rl-transportes}"
REAL_USER="$(id -un)"

echo
echo "=============================================="
echo " RL Transportes — montagem da demo (LAN)"
echo " Usuário: $REAL_USER"
echo " Destino: $APP_DIR"
echo " Branch:  $DEMO_BRANCH"
echo "=============================================="
echo
echo "Isto instala Docker, clona o sistema, gera senhas e COMPILA."
echo "Pode levar 40–90 min. Não use no dia da reunião."
echo
read -r -p "Continuar? [s/N] " ok
case "$ok" in
  s|S|y|Y|sim|Sim) ;;
  *) echo "Cancelado."; exit 0 ;;
esac

echo
echo "Senha do Super Admin (a mesma do .env da raiz do PC de casa,"
echo "SEED_SUPER_ADMIN_PASSWORD — sem #)."
read -r -s -p "SEED_SUPER_ADMIN_PASSWORD: " SA_PASS
echo
if [ -z "$SA_PASS" ]; then
  echo "Senha do Super Admin é obrigatória."
  exit 1
fi
if [[ "$SA_PASS" == *"#"* ]]; then
  echo "A senha não pode ter # (quebra o .env)."
  exit 1
fi

echo
echo "[0/8] GRUB nomodeset (i5 3ª geração — evita tela preta no reboot)..."
if [ -f /etc/default/grub ] && ! grep -q 'nomodeset' /etc/default/grub; then
  sudo sed -i 's/^GRUB_CMDLINE_LINUX_DEFAULT="\(.*\)"/GRUB_CMDLINE_LINUX_DEFAULT="\1 nomodeset"/' /etc/default/grub
  sudo update-grub
fi

echo
echo "[1/8] Pacotes do sistema..."
sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
  ca-certificates curl git openssl ufw python3 gnupg lsb-release

echo
echo "[2/8] Docker..."
if ! command -v docker >/dev/null 2>&1; then
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg
  CODENAME="$(lsb_release -cs)"
  if ! curl -fsI "https://download.docker.com/linux/ubuntu/dists/${CODENAME}/stable/" >/dev/null 2>&1; then
    echo "Docker ainda não tem pacote para $CODENAME — usando noble (24.04)."
    CODENAME="noble"
  fi
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${CODENAME} stable" \
    | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  sudo apt-get update
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
    docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
sudo usermod -aG docker "$REAL_USER"
sudo systemctl enable --now docker

echo
echo "[3/8] Swap 4 GB..."
if [ ! -f /swapfile ]; then
  sudo fallocate -l 4G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

echo
echo "[4/8] Firewall (SSH + site)..."
sudo ufw allow OpenSSH
sudo ufw allow 3000/tcp comment 'RL web'
sudo ufw allow 3001/tcp comment 'RL api'
echo "y" | sudo ufw enable >/dev/null || sudo ufw --force enable

LAN_IP="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src"){print $(i+1); exit}}')"
if [ -z "$LAN_IP" ]; then
  LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
fi
echo
echo "IP da LAN detectado: ${LAN_IP:-'(não achei)'}"
read -r -p "Confirme o IP (Enter para manter): " IP_IN
LAN_IP="${IP_IN:-$LAN_IP}"
if [ -z "$LAN_IP" ] || [ "$LAN_IP" = "127.0.0.1" ]; then
  echo "IP da LAN inválido. Conecte a rede e rode de novo."
  exit 1
fi
SITE="http://${LAN_IP}:3000"
API="http://${LAN_IP}:3001"
echo "Site da demo: $SITE"
echo "API da demo:  $API"

echo
echo "[5/8] Repositório..."
sudo mkdir -p "$APP_DIR"
sudo chown "$REAL_USER:$REAL_USER" "$APP_DIR"
if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"
git fetch origin "$DEMO_BRANCH" || git fetch --all
git checkout "$DEMO_BRANCH"
git pull --ff-only origin "$DEMO_BRANCH" || true
git log -1 --oneline

echo
echo "[6/8] .env.production (segredos novos)..."
SECRETS="$(python3 - <<'PY'
import secrets
print("DB_PASSWORD=" + secrets.token_urlsafe(24))
print("REDIS_PASSWORD=" + secrets.token_urlsafe(18))
print("JWT_SECRET=" + secrets.token_hex(32))
print("JWT_REFRESH_SECRET=" + secrets.token_hex(32))
print("STORAGE_SIGNING_SECRET=" + secrets.token_hex(32))
print("INTEGRACAO_FINANCE_WEBHOOK_SECRET=" + secrets.token_hex(32))
print("INTEGRACAO_INTERNO_SECRET=" + secrets.token_hex(32))
print("MOTORISTA_SESSION_SECRET=" + secrets.token_hex(32))
print("MINIO_ROOT_PASSWORD=" + secrets.token_urlsafe(24))
PY
)"
eval "$SECRETS"
# shellcheck disable=SC2153
umask 077
cat > "$APP_DIR/.env.production" <<EOF
NODE_ENV=production
DEPLOY_ENV=production
FEATURE_PHASES=operational
CHAOS_ENGINE_ENABLED=0
REDIS_OPTIONAL=0
SENTRY_ENABLED=false
WHATSAPP_ENABLED=false
CSRF_ENABLED=1
NEXT_PUBLIC_CSRF_ENABLED=1
AUTH_COOKIE_SECURE=0
SECURITY_HEADERS_ENFORCE=0
NEXT_PUBLIC_PORTAL_COOKIE_AUTH=1
AUTH_HTTP_ONLY_COOKIES=1
PORTAL_HTTP_ONLY_COOKIES=1
TRUST_PROXY=1
ALLOW_PROD_SEED=0

DB_NAME=rl_transportes
DB_USER=rl
DB_PASSWORD=${DB_PASSWORD}
DATABASE_URL=postgresql://rl:${DB_PASSWORD}@postgres:5432/rl_transportes?schema=public

REDIS_URL=redis://redis:6379
REDIS_PASSWORD=${REDIS_PASSWORD}

JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

PUBLIC_API_URL=${API}
NEXT_PUBLIC_API_URL=${API}
CORS_ORIGIN=${SITE}
PORTAL_PUBLIC_BASE_URL=${SITE}

AWS_S3_BUCKET=rl-transportes
AWS_ACCESS_KEY_ID=rlminio
AWS_SECRET_ACCESS_KEY=${MINIO_ROOT_PASSWORD}
AWS_REGION=us-east-1
STORAGE_ENDPOINT=http://minio:9000
STORAGE_PUBLIC_BASE_URL=http://${LAN_IP}:9000
STORAGE_SIGNING_SECRET=${STORAGE_SIGNING_SECRET}
MINIO_ROOT_USER=rlminio
MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD}

SEED_ADMIN_EMAIL=admin@rltransportes.com
SEED_ADMIN_CPF=39053344705
SEED_ADMIN_PASSWORD=Admin@123
SEED_TENANT_ID=default
SEED_TENANT_NOME=RL Transportes — Itajaí
SEED_SUPER_ADMIN_EMAIL=superadmin@rltransportes.com
SEED_SUPER_ADMIN_CPF=03650163900
SEED_SUPER_ADMIN_PASSWORD=${SA_PASS}

INTEGRACAO_FINANCE_WEBHOOK_SECRET=${INTEGRACAO_FINANCE_WEBHOOK_SECRET}
INTEGRACAO_INTERNO_SECRET=${INTEGRACAO_INTERNO_SECRET}
MOTORISTA_SESSION_SECRET=${MOTORISTA_SESSION_SECRET}
EOF
chmod 600 "$APP_DIR/.env.production"
echo "Arquivo gravado (600). Sem placeholders TROCAR_*."

COMPOSE=(docker compose
  -f "$APP_DIR/infra/docker-compose.prod.yml"
  -f "$APP_DIR/infra/docker-compose.lab.yml"
  --env-file "$APP_DIR/.env.production")

run_compose() {
  if docker info >/dev/null 2>&1; then
    (cd "$APP_DIR" && "${COMPOSE[@]}" "$@")
  else
    echo "Grupo docker ainda não vale nesta sessão — usando sudo."
    (cd "$APP_DIR" && sudo -E "${COMPOSE[@]}" "$@")
  fi
}

run_docker() {
  if docker info >/dev/null 2>&1; then
    docker "$@"
  else
    sudo docker "$@"
  fi
}

echo
echo "[7/8] Build e subida (sem Nginx). Pode demorar bastante..."
run_compose up -d --build postgres redis minio minio-init backend frontend
run_compose ps

echo
echo "Esperando o backend responder /health..."
for i in $(seq 1 90); do
  code="$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/health || true)"
  if [ "$code" = "200" ]; then
    echo "Backend ok."
    break
  fi
  if [ "$i" -eq 90 ]; then
    echo "Backend não ficou healthy. Veja: docker logs rl-backend --tail 80"
    exit 1
  fi
  sleep 5
done

echo
echo "[8/8] Banco — migrate + seeds do roteiro..."
run_docker exec rl-backend npx prisma migrate deploy
run_docker cp "$APP_DIR/apps/backend/prisma/seed.ts" rl-backend:/app/prisma/seed.ts
run_docker cp "$APP_DIR/apps/backend/scripts" rl-backend:/app/scripts
run_docker exec \
  -e ALLOW_PROD_SEED=1 \
  -e "SEED_SUPER_ADMIN_PASSWORD=${SA_PASS}" \
  rl-backend npx prisma db seed
run_docker exec -e ALLOW_PROD_SEED=1 rl-backend \
  npx ts-node --compiler-options '{"module":"CommonJS"}' \
  scripts/seed-all.ts --cadastros
run_docker exec -e ALLOW_PROD_SEED=1 rl-backend \
  npx ts-node --compiler-options '{"module":"CommonJS"}' \
  scripts/seed-demo-operacional.ts
run_docker exec -e ALLOW_PROD_SEED=1 rl-backend \
  npx ts-node --compiler-options '{"module":"CommonJS"}' \
  scripts/seed-historico-container-demo.ts

sudo rm -f "$APP_DIR"/dados-teste-*.txt
run_docker exec rl-backend rm -f /app/dados-teste-demo-operacional.txt \
  /dados-teste-demo-operacional.txt 2>/dev/null || true

echo
echo "=============================================="
echo " Pronto. Teste de OUTRO notebook na LAN:"
echo "   $SITE/login/staff"
echo "   $SITE/portal/login"
echo "   $SITE/super-admin/login"
echo
echo " Intranet  CPF 390.533.447-05   senha Admin@123"
echo " Gate      CPF 153.509.460-56   senha OpsGate@QA2026"
echo " Portal    CNPJ 27.000.145/0001-49  CPF 390.533.401-14  Demo@PJ2026!"
echo " Super Admin  CPF 036.501.639-00  (a senha que você digitou)"
echo
echo " No dia 30: NÃO rode este script de novo. Só:"
echo "   docker compose -f infra/docker-compose.prod.yml -f infra/docker-compose.lab.yml --env-file .env.production ps"
echo "=============================================="
