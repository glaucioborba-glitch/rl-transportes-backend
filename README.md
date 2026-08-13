# RL Transportes — Monorepo

Sistema de gestão logística: portal cliente, intranet staff, Gate-v2, pátio, timeline 360º e faturamento de armazenagem.

## Portas (dev)

| Serviço | URL |
|---------|-----|
| Frontend (Next.js) | http://localhost:3000 |
| API (NestJS) | http://localhost:3001 |
| Postgres (Docker) | localhost:**5433** |
| Redis (Docker) | localhost:6379 |

## Subir ambiente

```bash
docker compose up -d postgres redis minio
npm run db:migrate
npm run dev:all          # Linux/macOS
npm run dev:all:win      # Windows PowerShell
npm run doctor:win       # diagnóstico de portas/.env/health
```

**MinIO (S3 local):** console em http://localhost:9001 — credenciais `minioadmin` / `minioadmin`, bucket `rl-transportes`. Para uploads reais em dev:

```bash
AWS_S3_BUCKET=rl-transportes
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=minioadmin
STORAGE_ENDPOINT=http://localhost:9000
```

## Autenticação

- **Staff:** cookies HttpOnly `rl_at`/`rl_rt` — `AUTH_HTTP_ONLY_COOKIES=1` + BFF `/api/auth/*`
- **Portal cliente:** cookies `rl_pat`/`rl_prt` — `PORTAL_HTTP_ONLY_COOKIES=1` + `NEXT_PUBLIC_PORTAL_COOKIE_AUTH=1` + BFF `/api/portal/*`

Credenciais QA: após `npm run db:seed`, use o usuário **ADMIN** e o cliente portal **Cliente QA · Portal Web** documentados no output do seed (`apps/backend/prisma/seed.ts`).

## Scripts úteis

| Comando | Descrição |
|---------|-----------|
| `npm run db:setup` | generate + migrate + seed |
| `npm run ci:test` | validate, build, test, e2e backend, build web |
| `npm run build:all` | build backend + frontend |

## Documentação

- Matriz de faturamento: [docs/BILLING-MATRIX.md](docs/BILLING-MATRIX.md)
- Compliance: [docs/RL_COMPLIANCE_INTERNAL_CONTROLS.md](docs/RL_COMPLIANCE_INTERNAL_CONTROLS.md)
