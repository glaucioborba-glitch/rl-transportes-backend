#!/usr/bin/env bash
# Segunda etapa da demo: MinIO Bitnami Legacy + build da stack.
# No servidor:  bash ~/continuar-demo-lab.sh
# NÃO use sudo bash.

if grep -q $'\r' "$0" 2>/dev/null; then
  sed -i 's/\r$//' "$0"
  exec bash "$0" "$@"
fi

set -euo pipefail

if [ "$(id -u)" -eq 0 ]; then
  echo "Rode SEM sudo: bash ~/continuar-demo-lab.sh"
  exit 1
fi

APP_DIR="${APP_DIR:-/opt/rl-transportes}"
cd "$APP_DIR"

if ! sudo docker image inspect bitnamilegacy/minio:2025.7.23-debian-12-r5 >/dev/null 2>&1; then
  echo "Falta a imagem do MinIO. No servidor rode antes:"
  echo "  sudo docker pull bitnamilegacy/minio:2025.7.23-debian-12-r5"
  exit 1
fi

cat > infra/docker-compose.minio-publico.yml << 'EOF'
services:
  minio:
    image: bitnamilegacy/minio:2025.7.23-debian-12-r5
    command: /opt/bitnami/scripts/minio/run.sh
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
      MINIO_SERVER_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_SERVER_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
      MINIO_DEFAULT_BUCKETS: rl-transportes
    volumes:
      - minio_data:/bitnami/minio/data
    healthcheck:
      disable: true
EOF

echo "Subindo postgres, redis, minio, backend e frontend. Pode demorar 40-90 min."
sudo docker compose \
  -f infra/docker-compose.prod.yml \
  -f infra/docker-compose.lab.yml \
  -f infra/docker-compose.minio-publico.yml \
  --env-file .env.production \
  up -d --build postgres redis minio backend frontend

echo
echo "Pronto o build. Depois rode no servidor:"
echo "  curl -s -o /dev/null -w '%{http_code}\\n' http://127.0.0.1:3001/health"
