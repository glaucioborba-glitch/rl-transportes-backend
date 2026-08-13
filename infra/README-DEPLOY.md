# Deploy — Oracle Cloud Always Free Tier

Deploy do monorepo RL Transportes em VM **ARM Ampere A1** (4 vCPU, 24 GB RAM).

## Arquitetura

```
Internet → Nginx (80/443)
              ├─ /, /api/*     → Frontend Next.js (:3000) ──BFF──► Backend NestJS (:3001)
              ├─ /health, /docs, /ws, /v2, /mobile → Backend direto
              └─ Let's Encrypt (Certbot)

Backend → PostgreSQL (:5432) + Redis (:6379)
MinIO (:9000) — fallback S3 local (prod Oracle usa Object Storage nativo)
```

> **Importante:** o frontend usa **BFF** em `/api/*` (Route Handlers Next.js). O Nginx **não** envia `/api/` direto ao NestJS.

## Pré-requisitos

1. Conta Oracle Cloud + VM Ubuntu 22.04 ARM
2. DNS `A` apontando para o IP público da VM
3. Repositório Git acessível na VM

## Setup inicial (VM nova)

```bash
ssh -i sua-chave.pem ubuntu@<IP_DA_VM>
sudo git clone <repo-url> /opt/rl-transportes
cd /opt/rl-transportes
sudo bash infra/scripts/setup-oracle-vm.sh
sudo nano /opt/rl-transportes/.env.production
```

Variáveis obrigatórias no `.env.production`:

- `DB_PASSWORD`, `JWT_SECRET`, `JWT_REFRESH_SECRET`
- `CORS_ORIGIN`, `PUBLIC_API_URL`, `NEXT_PUBLIC_API_URL`, `SSL_DOMAIN`
- `SEED_ADMIN_CPF`, `SEED_ADMIN_PASSWORD`, `ALLOW_PROD_SEED=1`

## Subir stack

```bash
cd /opt/rl-transportes
docker compose -f infra/docker-compose.prod.yml --env-file .env.production up -d --build
```

Serviços: `postgres`, `redis`, `minio`, `backend`, `frontend`, `nginx`, `certbot`.

## Migrations + seed mínimo

```bash
docker exec rl-backend npx prisma migrate deploy
docker exec rl-backend npm run seed:prod
```

O seed cria: tenant `default`, admin, `TenantConfig` com parâmetros operacionais/financeiros básicos.

## SSL Let's Encrypt

**Antes do certificado:** ajuste `SSL_DOMAIN` no `.env.production` e edite os caminhos em `infra/nginx/nginx.conf` (ou substitua `rl.seudominio.com.br` pelo seu domínio).

Primeira emissão (com Nginx rodando na porta 80):

```bash
docker compose -f infra/docker-compose.prod.yml run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d rl.seudominio.com.br \
  --email seu@email.com \
  --agree-tos --no-eff-email

docker compose -f infra/docker-compose.prod.yml restart nginx
```

Renovação automática: container `rl-certbot` (a cada 12h).

## Deploy contínuo

```bash
sudo /opt/rl-transportes/infra/scripts/deploy.sh
```

Fluxo: `git pull` → rebuild backend/frontend → restart → healthcheck → `prisma migrate deploy`.

## Backup / restore

**Backup automático** (CRON 02:00):

- Arquivo: `/opt/backups/rl_YYYYMMDD_HHMMSS.sql.gz`
- Retenção: 7 dias
- Log: `/var/log/rl-backup.log`

**Restore manual:**

```bash
/opt/rl-transportes/infra/scripts/restore-db.sh /opt/backups/rl_20260725_020000.sql.gz
```

## Verificação

| Check | Comando / URL |
|-------|----------------|
| Backend | `curl -s http://127.0.0.1:3001/health` |
| Frontend | `curl -s http://127.0.0.1:3000/api/auth/health` |
| Público | `https://<domínio>/health` |
| Logs backend | `docker logs rl-backend --tail 100 -f` |

## Oracle Object Storage (S3)

Em produção, configure no `.env.production`:

```env
STORAGE_ENDPOINT=https://objectstorage.sa-saopaulo-1.oraclecloud.com
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=rl-transportes
```

Desabilite ou remova o serviço `minio` do compose se usar apenas Oracle OS.

## Troubleshooting

- **Nginx não sobe (SSL):** emitir certificado antes ou comentar bloco `listen 443` até ter certs em `/etc/letsencrypt/live/<domínio>/`.
- **Backend unhealthy:** `docker logs rl-backend` — verifique `JWT_SECRET` (mín. 32 chars) e `DATABASE_URL`.
- **Frontend 502 em /api:** confirme `INTERNAL_API_URL=http://backend:3001` no container frontend.
