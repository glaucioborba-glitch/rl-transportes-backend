#!/bin/bash
# ============================================
# RL Transportes — Restore PostgreSQL
# Uso: ./restore-db.sh /opt/backups/rl_YYYYMMDD_HHMMSS.sql.gz
# ============================================
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Uso: $0 <arquivo.sql.gz>"
  echo "Ex.: $0 /opt/backups/rl_20260725_020000.sql.gz"
  exit 1
fi

BACKUP_FILE="$1"
DB_NAME="${DB_NAME:-rl_transportes}"
DB_USER="${DB_USER:-rl}"
CONTAINER="${POSTGRES_CONTAINER:-rl-postgres}"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ Arquivo não encontrado: $BACKUP_FILE"
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "❌ Container $CONTAINER não está rodando"
  exit 1
fi

echo "⚠️  Isso substituirá o banco $DB_NAME. Continuar? [y/N]"
read -r CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
  echo "Cancelado."
  exit 0
fi

echo "Restaurando $BACKUP_FILE..."
gunzip -c "$BACKUP_FILE" | docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME"
echo "✅ Restore concluído"
