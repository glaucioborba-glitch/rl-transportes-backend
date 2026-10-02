#!/bin/bash
# ============================================
# RL Transportes — Backup PostgreSQL diário
# Retenção: 7 dias — /opt/backups
# ============================================
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
DB_NAME="${DB_NAME:-rl_transportes}"
DB_USER="${DB_USER:-rl}"
CONTAINER="${POSTGRES_CONTAINER:-rl-postgres}"

mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/rl_${TIMESTAMP}.sql.gz"

echo "[$(date -Iseconds)] Iniciando backup..."

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "[$(date -Iseconds)] ❌ Container $CONTAINER não está rodando"
  exit 1
fi

docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" | gzip > "$BACKUP_FILE"

if [ -f "$BACKUP_FILE" ]; then
  SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "[$(date -Iseconds)] Backup: $BACKUP_FILE ($SIZE)"
else
  echo "[$(date -Iseconds)] ❌ Falha ao criar backup"
  exit 1
fi

find "$BACKUP_DIR" -name "rl_*.sql.gz" -mtime +"$RETENTION_DAYS" -delete
echo "[$(date -Iseconds)] Backups > ${RETENTION_DAYS}d removidos"
echo "[$(date -Iseconds)] Backup finalizado"
