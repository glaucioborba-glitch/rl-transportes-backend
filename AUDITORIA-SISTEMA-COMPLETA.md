# Auditoria Completa do Sistema — RL Transportes Monorepo

**Data:** 2026-06-09  
**Escopo:** Backend (`apps/backend`), Frontend (`apps/web`), Prisma, env, segurança, rotas, lógica financeira (Motor V2), Hold/Release, portais, gate, BI, PWA  
**Metodologia:** Varredura estática de 107 controllers NestJS, 128 páginas Next.js, schema Prisma, migrations, middleware, clientes API (`staff-client`, `portal-client`), testes, `.env.example`, CI e revisão cruzada de módulos alterados recentemente.

---

## Sumário executivo

Após as alterações recentes (Motor Financeiro V2, Hold/Release, transparência de bloqueios no portal, vistoria gate, BI Tremor, PWA), o sistema **compila** (backend `nest build`, frontend `next build`, `tsc --noEmit` web OK), mas acumula **riscos estruturais** que afetam produção multi-tenant, dashboards financeiros e experiência do portal.

| Severidade | Quantidade aprox. | Domínio principal |
|------------|-------------------|-------------------|
| **Crítico** | 8 | Status de boleto inconsistente, auth multi-tenant, BFF pilhas, CSP produção |
| **Alto** | 22 | CRON só tenant `default`, lazy billing, segurança JWT/portal, PWA cache |
| **Médio** | 28 | Rotas duplicadas, DTOs, env incompleto, BI desatualizado, testes quebrados |
| **Baixo** | 15 | Deprecations, docs, UX menor |

**Top 5 ações imediatas (P0):**

1. Unificar vocabulário de status de pagamento (`Boleto` lowercase vs `StatusPagamento` enum uppercase).
2. Corrigir login corporativo/portal para escopo `tenantId + cpfCnpj`.
3. Corrigir BFF `/api/cliente/pilhas` (header portal, não staff).
4. Commitar e deployar **todas** as migrations pendentes (incl. Motor Financeiro V2).
5. Ajustar CSP `connect-src` para o host real da API em produção.

---

## 1. CRÍTICO — Integridade de dados e financeiro

### C-01 — Três modelos de status de pagamento incompatíveis

| Camada | Tipo | Valores persistidos |
|--------|------|---------------------|
| `Fatura.statusPagamento` | Enum `StatusPagamentoFatura` | `AGUARDANDO_PAGAMENTO`, `VENCIDA`, `PAGO`, … |
| `Boleto.statusPagamento` | `String` | `'pendente'`, `'vencido'`, `'pago'` (lowercase) |
| Queries legadas | Enum `StatusPagamento` (órfão no schema) | `'PENDENTE'`, `'VENCIDO'`, `'PAGO'` (uppercase) |

**Arquivos afetados:**
- `apps/backend/src/dashboard-financeiro/dashboard-financeiro.service.ts` (linhas 192–193, 299–314, 555–561)
- `apps/backend/src/grc-compliance/grc-compliance.service.ts`
- `apps/backend/src/tesouraria/tesouraria.service.ts`
- `apps/backend/src/financeiro-conciliacao/financeiro-conciliacao.service.ts`
- `apps/backend/src/armazenagem-faturamento/faturamento-mora.service.ts` (escreve `'vencido'`)
- `apps/backend/src/outbox/nfse-boleto-outbox.processor.ts` (escreve `'pendente'`)

**Impacto:** KPIs de inadimplência, donuts de faturamento, aging e GRC retornam **zero ou valores errados** com dados reais.

**Solução:**
1. Definir constantes canônicas em `apps/backend/src/common/finance/payment-status.constants.ts` (ex.: `BOLETO_PENDENTE = 'pendente'`).
2. Migrar todas as queries Prisma e SQL raw para o vocabulário escolhido **ou** usar `mode: 'insensitive'` temporariamente.
3. Migration SQL: normalizar valores existentes (`UPDATE boletos SET status_pagamento = LOWER(status_pagamento)`).
4. Remover enum órfão `StatusPagamento` do schema após migração de código.
5. Atualizar `apps/web/lib/financeiro/boleto-api.ts` para refletir o contrato único.

---

### C-02 — Dashboard financeiro consulta status que não existem no banco

**Arquivo:** `apps/backend/src/dashboard-financeiro/dashboard-financeiro.service.ts`

```typescript
// Consulta StatusPagamento.PENDENTE → 'PENDENTE'
// Banco real: 'pendente'
where: { statusPagamento: StatusPagamento.PENDENTE }
```

**Solução:** Substituir por strings lowercase ou helper `normalizeBoletoStatus()`. Revisar SQL raw (linhas ~414–470) com `UPPER(b."statusPagamento")` ou valores corretos.

---

### C-03 — Login staff e portal sem escopo de tenant

**Arquivos:**
- `apps/backend/src/auth/auth.service.ts:60, 479` — `findFirst({ where: { cpfCnpj } })`
- `apps/backend/src/cx-portais/identity/portal-identity.service.ts:406–443` — mesmo padrão; JWT `tenantId` pode divergir do usuário

**Impacto:** Com `@@unique([tenantId, cpfCnpj])`, o mesmo CPF/CNPJ em dois tenants retorna usuário arbitrário — falha de segurança e integridade SaaS.

**Solução:**
1. Adicionar `tenantId` obrigatório em `LoginDto` e `PortalLoginDto` (header `X-Tenant-Id`, subdomínio ou body).
2. Usar `findUnique({ where: { tenantId_cpfCnpj: { tenantId, cpfCnpj } } })`.
3. JWT `tenantId` **sempre** do registro encontrado, nunca de guess.
4. Testes E2E: atualizar `findUnique({ cpfCnpj })` obsoleto.

---

### C-04 — BFF Patiamento usa cookie staff no endpoint portal

**Arquivos:**
- `apps/web/app/api/cliente/pilhas/route.ts:15` — envia `X-RL-Auth-Cookie: 1`
- Backend: `GET /cliente/portal/pilhas` exige `CxPortalAuthGuard`

**Impacto:** Usuário portal autenticado recebe 401/403 ou lista vazia em `/cliente/portal/patiamento`.

**Solução:**
```typescript
headers: {
  Cookie: cookie,
  Accept: "application/json",
  "X-RL-Portal-Cookie": "1",  // substituir X-RL-Auth-Cookie
}
```
Alternativa: proxy via `/api/portal/proxy/cliente/portal/pilhas`.

---

### C-05 — CSP bloqueia API em produção

**Arquivo:** `apps/web/next.config.mjs:21`

`connect-src` permite apenas `'self'`, `localhost:3001` e Sentry. Chamadas browser diretas a `NEXT_PUBLIC_API_URL` (staging/prod) são **bloqueadas**.

**Afeta:** login portal, cadastro, CEP, health check, modo JWT staff.

**Solução:**
1. Injetar origem da API no CSP: `` `connect-src 'self' ${apiOrigin} ...` ``.
2. **Ou** (recomendado) rotear 100% das chamadas browser via BFF same-origin (`/api/portal/proxy/*`, `/api/auth/*`).

---

### C-06 — Migrations não commitadas no repositório

**Paths:** `apps/backend/prisma/migrations/20260504*` … `20260729120000_motor_financeiro_v2_cliente_perfil/` (dezenas de pastas `??` no git)

**Impacto:** CI, clones frescos e deploys não reproduzem schema com `VENCIDA`, bloqueios, perfil financeiro cliente, vistoria, gate v2, etc.

**Solução:**
1. `git add apps/backend/prisma/migrations/`
2. `npx prisma migrate deploy` em todos os ambientes
3. Adicionar `prisma migrate status` ao pipeline CI e script `doctor`

---

### C-07 — BI materialized views ignoram status `VENCIDA`

**Arquivo:** `apps/backend/prisma/migrations/20260627180000_bi_materialized_views/migration.sql`

Filtros de faturas abertas não incluem `'VENCIDA'::"StatusPagamentoFatura"`. Após CRON de mora, faturas somem dos KPIs BI.

**Solução:** Alterar MV + `REFRESH MATERIALIZED VIEW`; incluir `VENCIDA` em agregações de inadimplência.

---

### C-08 — JWT secrets placeholder aceitos em boot

**Arquivos:** `.env.example:7–8`, `apps/backend/src/config/secrets.config.ts`, `auth.module.ts`

App inicia com `JWT_SECRET=defina_um_segredo_longo` sem validação em produção.

**Solução:** Guard no bootstrap (`main.ts`): comprimento mínimo 32, rejeitar placeholders, exigir `JWT_REFRESH_SECRET` distinto.

---

## 2. ALTO — Operação, CRON e segurança

### A-01 — CRONs financeiros limitados ao tenant `default`

**Arquivos:**
- `apps/backend/src/armazenagem-faturamento/faturamento-cron.service.ts:24–26`
- `apps/backend/src/hold-release/hold-release.service.ts:184` — `syncFinancialHoldsFromInadimplencia(tenantId = 'default')`
- `apps/backend/src/armazenagem-faturamento/faturamento-mora.service.ts:24` — `applyDailyMoraUpdates(tenantId = 'default')`

**Impacto:** Clientes de outros tenants não recebem mora/juros/bloqueio automático.

**Solução:** Iterar tenants ativos (`prisma.tenant.findMany`) e chamar serviços por `tenantId`; carregar `getParametros(tenantId)` por iteração.

---

### A-02 — Lazy billing CRON pode nunca rodar

**Arquivos:**
- `apps/backend/src/modules/billing/billing-domain.module.ts`
- `apps/backend/src/phase-imports.ts` — `FEATURE_BILLING_CRON_LAZY=1` ou fases `operational/lean`

Hold, mora e provisão diária só iniciam após `POST admin/platform/billing-lazy/warmup`.

**Solução:** Documentar ops; em produção forçar CRON eager ou warmup automático no boot.

---

### A-03 — Portal login sem lockout por documento

**Arquivo:** `apps/backend/src/cx-portais/identity/portal-identity.service.ts:396–434`

Staff login usa Redis brute-force (`auth.service.ts`); portal depende só de rate limit IP global (100/15min).

**Solução:** Reutilizar padrão `assertBruteForceNotLocked` com chave `portal:{tenantId}:{cpfCnpj}`.

---

### A-04 — PWA service worker cacheia `/api/*`

**Arquivos:** `apps/web/public/sw.js`, `next.config.mjs` (PWA plugin)

`NetworkFirst` em rotas BFF pode servir `/api/auth/me`, `/api/portal/me`, `/api/portal/bloqueio-financeiro` **stale** após logout.

**Solução:** Excluir `/api/` do SW ou usar `NetworkOnly` para auth; gitignore `public/sw.js` gerado; rebuild limpo.

---

### A-05 — Middleware portal só em cookie mode

**Arquivo:** `apps/web/middleware.ts:76`

Proteção de rotas portal e bloqueio financeiro só quando `NEXT_PUBLIC_PORTAL_COOKIE_AUTH=1`. Modo JWT (E2E, alguns deploys) não tem guard server-side.

**Solução:** Validar JWT no middleware ou exigir cookie mode em produção.

---

### A-06 — Bloqueio financeiro fail-open no middleware

**Arquivo:** `apps/web/middleware.ts:88–102`

Se BFF bloqueio retorna erro ou `false`, agendamento é **permitido**. `PortalAgendamentoGuard` também define `false` em falha de fetch.

**Solução:** Fail-closed para usuários autenticados; distinguir 401 (redirect login) vs 502 (mensagem + retry).

---

### A-07 — Duas superfícies de portal conflitantes

**Arquivos:**
- `apps/backend/src/portal/portal.controller.ts` — JWT corporate `Role.CLIENTE`, prefixo `/portal`
- `apps/backend/src/cx-portais/portal-cliente.controller.ts` — prefixo `/cliente/portal`
- `apps/backend/src/cx-portais/identity/portal-identity.controller.ts` — `/portal/login`, `/portal/register`

**Impacto:** Duplicação de registro (`POST /auth/register` + `POST /portal/register`), sessões (`/auth/sessoes-ativas` vs `/cliente/portal/sessoes-ativas`), confusão de integradores.

**Solução:** Plano de depreciação do `PortalController` legado; documentar API canônica CX.

---

### A-08 — Gate multipart JSON.parse sem try/catch

**Arquivo:** `apps/backend/src/gate-v2/gate.controller.ts:126–128, 192–194`

Campo `data` malformado → HTTP 500 em vez de 400.

**Solução:** `try/catch` + `BadRequestException`; DTO validado para `enviar-patio`.

---

### A-09 — Race condition no CRON de hold financeiro

**Arquivo:** `apps/backend/src/hold-release/hold-release.service.ts:266–276`

`findBloqueioAtivo` fora da transação antes de `aplicarBloqueio` — concorrência CRON/manual.

**Solução:** Idempotência dentro da mesma transação ou unique constraint parcial.

---

### A-10 — `faturamento.service.spec.ts` desatualizado (4º construtor)

**Arquivo:** `apps/backend/src/faturamento/faturamento.service.spec.ts:13`

`FaturamentoService` exige `HoldReleaseService`; teste passa 3 deps — **não compila** em typecheck estrito de specs.

**Solução:** Mock `HoldReleaseService`; testar `releaseFinancialHoldsForCliente` no pagamento de boleto.

---

### A-11 — Rota duplicada patiamento bypassa middleware bloqueio

**Arquivos:**
- `/cliente/portal/patiamento` — em `PORTAL_AGENDAMENTO_BLOCKED_PATHS`
- `/portal/patiamento` — alias em `(cliente)/portal/patiamento` — **fora** da lista middleware

**Solução:** Incluir `/portal/patiamento` na lista ou remover alias.

---

### A-12 — CSRF desabilitado com cookies HttpOnly

**Arquivos:** `security.config.ts` (`CSRF_ENABLED=0`), cookies staff/portal ativos.

**Solução:** Habilitar CSRF em staging/prod; alinhar `NEXT_PUBLIC_CSRF_ENABLED=1` no web.

---

### A-13 — Global rate limit pula prefixos amplos

**Arquivo:** `apps/backend/src/http/http-stack.ts:28–38`

Skip: `/public/`, `/marketplace/`, `/gateway/`, `/mobile/`, `/portal/auth/`.

**Solução:** Reduzir skips; garantir throttling por módulo.

---

### A-14 — `GET tenant-config/turnos/:tenantId` público

**Arquivo:** `apps/backend/src/tenant/tenant-config.controller.ts:13–16`

**Solução:** JWT + autorização tenant ou marcar `@Public()` documentado.

---

### A-15 — Gate QR: bloqueio lança 403 em vez de resposta estruturada

**Arquivo:** `apps/backend/src/gate-v2/gate.service.ts:745`

Outras falhas QR retornam `{ valido: false, motivo }`; bloqueio ativo lança exceção.

**Solução:** Capturar `ForbiddenException` e normalizar resposta QR.

---

### A-16 — Mora CRON não processa faturas `PENDENTE`/`PROCESSANDO`

**Arquivo:** `apps/backend/src/armazenagem-faturamento/faturamento-mora.service.ts:78–83`

Falha outbox deixa fatura sem mora/hold via path fatura.

**Solução:** Incluir status intermediários com `dataVencimento` vencida ou garantir transição para `AGUARDANDO_PAGAMENTO`.

---

### A-17 — Stale PWA artifacts commitados

**Arquivos:** `apps/web/public/sw.js`, `workbox-*.js`

Precache de build antigo → chunks 404 após rebuild.

**Solução:** Gitignore gerados; build-only em CI prod.

---

### A-18 — AUTH_COOKIE_SAMESITE documentado mas não implementado

**Arquivos:** `.env.example:57–58`, `auth-cookie.util.ts`, `portal-cookie.attach.ts`

`sameSite` hardcoded `'lax'`. Cross-domain API+portal falha.

**Solução:** Ler env e validar combinação com `secure`.

---

### A-19 — E2E tests quebrados

**Arquivos:** `apps/backend/test/cx-portais.e2e-spec.ts` (variáveis indefinidas), e2e com `findUnique({ cpfCnpj })` obsoleto.

**Solução:** Corrigir fixtures; compound unique tenant.

---

### A-20 — Controllers com prefixos colidentes/confusos

| Prefixo | Controllers |
|---------|-------------|
| `@Controller('portal')` | `PortalController` + `PortalIdentityController` |
| `@Controller('planejamento')` | estratégico + pessoal |
| `@Controller('admin/observability')` | core + resilience |
| Gate | `/v2/gate/*` vs `/gate/validar-qr` |

**Solução:** Namespacing explícito; OpenAPI agrupado.

---

### A-21 — `valorAtualizado` null antes do vencimento

**Arquivos:** outbox seta na emissão; mora skip se null e sem atraso.

**Solução:** Audit portal/boleto UI: sempre `valorAtualizado ?? valorTotal`; documentar contrato.

---

### A-22 — NFSe polling statusIpm case sensitivity

**Arquivo:** `apps/backend/src/fiscal-integracao/nfse-polling.cron.ts:27`

Query `PENDENTE`/`PROCESSANDO` vs default schema `'pendente'`.

**Solução:** Normalizar on write ou query case-insensitive.

---

## 3. MÉDIO — Manutenibilidade, UX e configuração

### M-01 — Dashboard portal: CTA "Nova solicitação" aponta para lista

**Arquivo:** `apps/web/app/portal/dashboard/dashboard-client.tsx:~441`  
**Fix:** `href="/portal/solicitacoes/nova"`.

### M-02 — Rota fantasma `/portal/agendar` na lista de bloqueio

**Arquivo:** `apps/web/lib/portal-financeiro-block.ts` — sem página correspondente.

### M-03 — `ClientStaffHydrator` prefixos incompletos vs middleware

**Arquivo:** `apps/web/components/staff/client-staff-hydrator.tsx` — falta `/intranet`, `/super-admin`.

### M-04 — `INTERNAL_API_URL` não documentado

**Arquivo:** `apps/web/lib/server-api-base.ts` — crítico em Docker/K8s.

### M-05 — Exports mortos em `portal-client.ts`

`fetchKpis`, `fetchSlas`, `fetchCxFinanceiroBoletos`, `fetchCxFinanceiroNfse` — nunca importados.

### M-06 — BI legado chama endpoint inexistente

**Arquivo:** `apps/web/app/bi/operacional/page.tsx` — `/ia-operacional/previsoes` (backend: `/ia/gargalos`).

### M-07 — BFF órfão `/api/dashboard/kpis`

Cockpit chama Nest direto via `staffJson`.

### M-08 — Campos financeiros cliente: input inválido silencioso

**Arquivo:** `apps/web/app/admin/clientes/cliente-fiscal-form.tsx` — `financeFieldPayload` retorna `undefined` sem toast.

### M-09 — Portal finance detail baixa listas inteiras

**Arquivo:** `apps/web/lib/api/portal-client.ts` — `fetchBoleto` faz `.find()` em array completo.

### M-10 — Duas chaves tenant para tolerância de bloqueio

**Arquivos:** `finance-profile.util.ts`, `tenant-config.types.ts` — `diasInadimplenciaBloqueio` vs `diasToleranciaBloqueioPadrao`.

**Fix:** Normalizar em `mergeTenantParametros`; UI admin tenant config.

### M-11 — `releaseFinancialHoldsForCliente` transação parcial

**Arquivo:** `hold-release.service.ts:289–314` — `updateMany` + sync unidade separados.

### M-12 — Gate enviar para pátio sem transação

**Arquivo:** `gate.service.ts:520–535` — posicionamento parcial em falha.

### M-13 — `.env.example` documenta `diasInadimplenciaBloqueio` como env var

Valor real está em `TenantConfig.parametros` JSON — env não surte efeito.

### M-14 — Variáveis backend usadas mas não documentadas

`BANK_API_TOKEN`, `FRONTEND_ORIGIN`, `NFSE_ARM_*`, `PORTAL_*_COOKIE_*`, `RL_TERMINAL_CNPJ`, Sentry web vars.

### M-15 — CI diverge de `npm run ci:test` root

**Arquivos:** `.github/workflows/ci.yml`, `package.json` — scripts não alinhados.

### M-16 — CI frontend build sem `NEXT_PUBLIC_API_URL` explícito

### M-17 — Chaos engine habilitado por default em non-prod

**Arquivo:** `chaos-gate.service.ts` — risco se JWT ADMIN vazado.

### M-18 — BI nav RBAC inconsistente (financeiro ADMIN vs página GERENTE)

**Arquivos:** `bi-header.tsx`, `bi/financeiro/page.tsx`.

### M-19 — PWA manifest global "RL Gate" com `scope: /`

**Arquivo:** `public/manifest.json` — portal users instalam app gate.

### M-20 — E2E env split (`E2E_MOCK_AUTH` vs `NEXT_PUBLIC_E2E_MOCK_AUTH`)

### M-21 — Sem testes: mora CRON, hold CRON, finance-profile, session

### M-22 — Hold manual permite tipo FINANCEIRO via DTO

**Arquivo:** `hold-release/dto/create-bloqueio.dto.ts` — sem restrição staff vs sistema.

### M-23 — CORS HTTP vs WebSocket origens divergentes

Gateways usam `FRONTEND_ORIGIN`; HTTP usa `getCorsOrigins()`.

### M-24 — `prisma.config.ts` fallback DB `rl_transportes` vs `.env` `rl`

### M-25 — Portal onboarding bypassa BFF (CORS+CSP dependent)

`portalClienteRegister`, CEP lookup direto ao Nest.

### M-26 — Staff login revoga sessão anterior (single-session)

**Arquivo:** `auth.service.ts:113–119` — pode surpreender multi-dispositivo.

### M-27 — `GET portal/email-preview` exposto fora de production strict

Staging pode vazar HTML de reset.

### M-28 — Backend `lint` = apenas `tsc --noEmit`

Sem ESLint no backend — renomear ou adicionar lint real.

---

## 4. BAIXO — Débito técnico e UX menor

| ID | Item | Solução |
|----|------|---------|
| L-01 | Enum `StatusPagamento` órfão no schema | Remover após C-01 |
| L-02 | `PortalController` legado sobreposto | Depreciar |
| L-03 | `portal-auth-pessoa.controller.ts` rotas 403 | Remover ou redirecionar |
| L-04 | `@deprecated` colunas cliente (regimeTributario, cnae) | Plano remoção |
| L-05 | `billing-engine.service.ts` deprecated | Migrar rotas |
| L-06 | Metadata viewport em `layout.tsx` | Migrar para `export const viewport` |
| L-07 | Warnings `<img>` SSMA | Usar `next/image` |
| L-08 | `start-all.ps1` não roda migrate | Encadear `db:setup` |
| L-09 | Playwright CI build duplicado | Reusar artifact |
| L-10 | `unidade.bloqueioTipo` String vs enum | CHECK constraint opcional |
| L-11 | `GET auth/health` sem guard | OK se sem dados sensíveis |
| L-12 | `GET mobile/v2/status` público | Documentar |
| L-13 | `GET api-contracts/v1/*` público | API key se necessário |
| L-14 | Redundant role check solicitacoes-v2 service | Limpar duplicação |
| L-15 | DTOs inline no portal-identity controller | Mover para `dto/` |

---

## 5. Itens verificados como OK ou corrigidos recentemente

| Item | Status |
|------|--------|
| `params.operacao` vs `parametros.operacao` | Código usa `parametros` corretamente |
| `/portal/redefinir` no middleware público | **Presente** em `middleware.ts:28` |
| Motor Financeiro V2 schema ↔ migration | Alinhados quando migration aplicada |
| `bi-header.tsx` type error GERENTE | **Corrigido** — build passa |
| Gate checkout `Label` unused | **Corrigido** |
| Hold-release `parametros` bug | **Corrigido** — build + testes passam |
| Frontend `tsc --noEmit` | Zero erros |
| Backend `nest build` | OK |
| Staff ↔ backend paths v2 (gate, patio, solicitacoes) | Alinhados |
| Gate vistoria `foto_{ANGULO}` | Alinhado backend/frontend |
| Cliente finance DTOs ↔ admin form PATCH | Campos wired; validação UX pendente (M-08) |
| Finance profile fallback chain | Coerente entre mora e hold |

---

## 6. Mapa de rotas — resumo de alinhamento

### Backend — prefixos principais (107 controllers)

| Prefixo | Módulo | Guard típico |
|---------|--------|--------------|
| `/auth/*` | Staff auth | Público login; JWT demais |
| `/portal/*` | CX identity + legado | Misto — **atenção duplicação** |
| `/cliente/portal/*` | Portal cliente CX | `CxPortalAuthGuard` |
| `/v2/gate/*`, `/gate/validar-qr` | Gate v2 | JWT staff |
| `/v2/patio/*` | Pátio v2 | JWT staff |
| `/v2/solicitacoes/*` | Solicitações v2 | JWT staff |
| `/clientes/*` | CRM | JWT ADMIN/GERENTE |
| `/faturamento/*` | Faturamento período | JWT staff |
| `/bi-analytics/*` | BI MV | JWT ADMIN/GERENTE |
| `/admin/platform/*` | Lazy billing/analytics | JWT ADMIN |
| `/health` | Health | Público |

### Frontend — BFF críticos

| Rota BFF | Backend upstream | Status |
|----------|------------------|--------|
| `/api/auth/me` | `/auth/me` | OK |
| `/api/portal/me` | portal identity | OK |
| `/api/portal/bloqueio-financeiro` | dashboard portal | OK (fail-open — A-06) |
| `/api/cliente/pilhas` | `/cliente/portal/pilhas` | **C-04 — header errado** |
| `/api/portal/proxy/*` | variável | OK padrão cookie mode |
| `/api/dashboard/kpis` | — | Órfão (M-07) |

### Frontend — páginas portal (amostra)

| Path | Proteção middleware (cookie) | Observação |
|------|------------------------------|------------|
| `/portal/dashboard` | Sim | OK |
| `/portal/solicitacoes/nova` | Sim + bloqueio | OK |
| `/cliente/portal/patiamento` | Sim + bloqueio | BFF quebrado C-04 |
| `/portal/patiamento` | Bloqueio parcial | A-11 |
| `/portal/redefinir/[token]` | Público | OK |

---

## 7. Variáveis de ambiente — gaps documentação

### Root `.env.example` — problemas

- Documenta `diasInadimplenciaBloqueio` como env (é TenantConfig JSON)
- `AUTH_COOKIE_SAMESITE=none` não implementado
- JWT placeholders sem enforcement

### `apps/web/.env.example` — faltando

| Variável | Uso |
|----------|-----|
| `INTERNAL_API_URL` | BFF server-side |
| `NEXT_PUBLIC_SENTRY_*` | Sentry |
| `NEXT_PUBLIC_E2E_MOCK_AUTH` | E2E |
| `NEXT_PUBLIC_CSRF_ENABLED` | Par com backend CSRF |
| `SENTRY_ORG`, `SENTRY_PROJECT` | Build Sentry |

### Produção — checklist env

```
JWT_SECRET=<32+ chars, not placeholder>
JWT_REFRESH_SECRET=<distinct>
REDIS_OPTIONAL=0
DATABASE_URL=...
NEXT_PUBLIC_API_URL=https://api.<domínio>
INTERNAL_API_URL=http://backend:3001  # Docker
NEXT_PUBLIC_PORTAL_COOKIE_AUTH=1
CSRF_ENABLED=1
NEXT_PUBLIC_CSRF_ENABLED=1
```

---

## 8. Motor Financeiro V2 — checklist pós-implementação

| Requisito | Implementado | Gap |
|-----------|--------------|-----|
| Campos cliente (multa, juros, tolerância) | Sim | UI validação M-08 |
| Fallback TenantConfig | Sim | Env doc errado M-13 |
| CRON mora diária | Sim | Só tenant default A-01 |
| `valorAtualizado` Fatura/Boleto | Sim | Null coalescing A-21 |
| Status `VENCIDA` | Sim | BI não inclui C-07 |
| Hold por tolerância cliente | Sim | CRON tenant default A-01 |
| Admin aba Financeiro | Sim | OK |

---

## 9. Plano de remediação por fases

### Fase 0 — Bloqueadores produção (1–3 dias)

1. C-01 + C-02: Unificar status boleto + corrigir dashboard-financeiro
2. C-03: Tenant-scoped login
3. C-04: Fix BFF pilhas
4. C-05: CSP ou BFF-only
5. C-06: Commit migrations
6. C-08: JWT validation boot

### Fase 1 — Operação financeira confiável (3–5 dias)

1. A-01: Multi-tenant CRONs
2. A-02: Lazy billing documentação/warmup
3. C-07: BI views + VENCIDA
4. A-10 + A-19: Reparar testes
5. A-16: Mora status intermediários

### Fase 2 — Segurança portal/staff (1 semana)

1. A-03, A-12, A-18: Portal lockout + CSRF + SameSite
2. A-05, A-06: Middleware fail-closed
3. A-04, A-17: PWA cache
4. A-07: Depreciação portal legado

### Fase 3 — Qualidade e DX (contínuo)

1. M-03–M-09: UX e BFF cleanup
2. M-14–M-16: Env + CI
3. M-21: Cobertura testes CRON/hold/mora
4. L-*: Débito técnico

---

## 10. Comandos de verificação recomendados

```powershell
# Backend
cd apps/backend
npx prisma migrate status
npx prisma validate
npm run build
npm test

# Frontend
cd apps/web
npx tsc --noEmit
npm run build

# Doctor (se existir)
cd ../..
npm run doctor
```

---

## 11. Referência rápida de arquivos críticos

| Domínio | Arquivos |
|---------|----------|
| Status pagamento | `dashboard-financeiro.service.ts`, `faturamento-mora.service.ts`, `update-boleto.dto.ts` |
| Auth multi-tenant | `auth.service.ts`, `portal-identity.service.ts`, `login.dto.ts` |
| Hold/Release | `hold-release.service.ts`, `finance-profile.util.ts` |
| Mora CRON | `faturamento-mora.service.ts`, `faturamento-cron.service.ts` |
| Portal middleware | `middleware.ts`, `portal-financeiro-block.ts` |
| BFF | `app/api/cliente/pilhas/route.ts`, `app/api/portal/*` |
| CSP/PWA | `next.config.mjs`, `public/sw.js` |
| Schema | `prisma/schema.prisma`, `migrations/20260729120000_*` |
| Env | `.env.example`, `apps/web/.env.example`, `security.config.ts` |

---

*Documento gerado por auditoria estática automatizada + revisão manual de achados críticos. Nenhuma alteração de código foi aplicada durante esta auditoria. Para implementar correções, priorize Fase 0 e abra PRs pequenos por domínio.*
