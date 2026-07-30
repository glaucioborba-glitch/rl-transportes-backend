# Deploy de migrations — RL Transportes

Checklist para staging e produção. CI já executa `prisma migrate deploy` em DB limpo.

## Pré-deploy

1. `cd apps/backend && npx prisma validate`
2. `npm run validate:migrations` (script local)
3. Backup do banco (`pg_dump`)
4. Conferir variáveis: `DATABASE_URL`, `REDIS_*`, `FEATURE_PHASES=operational`

## Ordem recomendada (grupos funcionais)

| Grupo | Migrations | Domínio |
|-------|------------|---------|
| Core | `20260415213744` … `20260522120000` | Base operacional |
| Portal/CX | `20260515120000`, `20260628120000`, `20260629180000`, `20260909120000` | Cadastro financeiro |
| Billing/TOS | `20260630120000`, `20260719120000`, `20260731120000` | Rule engine, hardening, dunning |
| Persistência | `20260720000000`, `20260720120000`, `20260727120000` | Stores, Datahub MVs, hold-release |
| MDM/Cadastros | `20261103120000` … `20261118120000` | Colaboradores, operacional, financeiro |
| Operacao fluxo | `20261106120000`, `20261028120000` | Gate CPO, onboarding |

## Comandos

```bash
npm run prisma:generate
npm run db:migrate
npm run db:seed   # apenas staging/demo
```

## Pós-deploy smoke

- `GET /health`
- `GET /health/diagnostic` (inclui `crons`)
- `GET /health/crons`
- `npm run validate:migrations`
- Login portal + staff
- Gate check-in/out (1 solicitação)
- `GET /observabilidade/dashboard` (ADMIN)
- Verificar CRON logs (BI/Datahub MV refresh)

## Rollback

- **Nunca** `migrate reset` em produção
- Migration falhou: corrigir SQL, `prisma migrate resolve --applied <name>` ou nova migration corretiva
- Restaurar backup se necessário
