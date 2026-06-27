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
docker compose up -d postgres redis
npm run db:migrate
npm run dev:all          # Linux/macOS
npm run dev:all:win      # Windows PowerShell
npm run doctor:win       # diagnóstico de portas/.env/health
```

## Autenticação

- **Staff:** cookies HttpOnly `rl_at`/`rl_rt` — `AUTH_HTTP_ONLY_COOKIES=1` + BFF `/api/auth/*`
- **Portal cliente:** cookies `rl_pat`/`rl_prt` — `PORTAL_HTTP_ONLY_COOKIES=1` + `NEXT_PUBLIC_PORTAL_COOKIE_AUTH=1` + BFF `/api/portal/*`

Credenciais QA: `credenciais-teste-portais.txt`

## Faturamento (Gate-v2 vs TOS)

Ver matriz de decisão: [docs/BILLING-MATRIX.md](docs/BILLING-MATRIX.md)

## Scripts úteis

| Comando | Descrição |
|---------|-----------|
| `npm run db:setup` | generate + migrate + seed |
| `npm run ci:test` | validate, build, test, e2e backend, build web |
| `npm run build:all` | build backend + frontend |

## Documentação de correções

Implementações de segurança/confiabilidade: `CORRECOES-APLICADAS.txt`
