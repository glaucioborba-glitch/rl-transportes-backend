# Relatório de auditoria — RL Transportes (Jun/2026)

Auditoria solicitada sobre falhas em código, rotas, variáveis e testes. Correções simples foram aplicadas diretamente; itens que alteram lógica de negócio ou arquitetura multi-tenant ficam documentados aqui para análise.

---

## 1. Resumo executivo

| Área | Status | Observação |
|------|--------|------------|
| TypeScript `apps/web` | OK | `npx tsc --noEmit` sem erros |
| TypeScript `apps/backend` | OK | `npx tsc --noEmit` sem erros (após correções) |
| Portal cadastro (`/portal/cadastrar`) | Corrigido | Prop `value` duplicada em campo telefone |
| Testes unitários (amostra) | OK | `permissions.guard`, `health.controller`, `datahub-star` passando |
| Testes e2e | Parcial | `findUnique` corrigidos; `deleteMany` ainda sem filtro de tenant |
| Lógica multi-tenant (produção) | Pendente | Várias queries usam `cpfCnpj`/`email` sem `tenantId` |

---

## 2. Correções aplicadas (sem mudança de regra de negócio)

### 2.1 Frontend — `apps/web/app/portal/cadastrar/page.tsx`

- **Erro TS2783**: spread `{...phoneFieldProps(...)}` já inclui `value`; prop explícita `value={telefoneContato}` causava duplicação.
- **Ação**: removida a prop redundante no campo “Telefone de contato” (PF).

### 2.2 Backend — testes unitários

Arquivos ajustados para refletir schema/API atuais:

| Arquivo | Problema | Correção |
|---------|----------|----------|
| `permissions.guard.spec.ts`, `roles.guard.spec.ts` | Mock `AuthUser` sem `cpfCnpj` | Campo adicionado |
| `datahub-star.builder.spec.ts` | Campo `razaoSocial` inexistente no tipo | Alterado para `nome` |
| `faturamento.service.spec.ts` | Constructor com arity antiga | 4º argumento `holdRelease` |
| `health.controller.spec.ts` | Asserções em formato Terminus antigo | Reescrito para `HealthCheckResult` |
| `nfse.service.spec.ts`, `mobile-jwt.service.spec.ts`, `mobile-sync.service.spec.ts` | Payloads JWT/user incompletos | `cpfCnpj` incluído |
| `test/cx-portais.e2e-spec.ts` | Variáveis fora de escopo | `clienteDoc`/`fornecedorDoc` elevados ao módulo |
| `test/cockpit-operacoes.e2e-spec.ts` | `findUnique({ cpfCnpj })` inválido | `userWhereForTestEmail()` |

### 2.3 Backend — testes e2e (`findUnique`)

Após migração multi-tenant, `User` exige chave composta `tenantId_cpfCnpj`. Testes que usavam `{ cpfCnpj }` sozinho falhavam no `tsc`.

**Helper centralizado** (`test/helpers/e2e-user.factory.ts`):

```ts
export function userWhereForTestEmail(email: string, salt = '') {
  return userWhereByDocumento(DEFAULT_TENANT_ID, cpfCnpjForTestUser(email, salt));
}
```

**Arquivos corrigidos para `findUnique` / `findUniqueOrThrow`:**

- `test/ia-preditiva.e2e-spec.ts`
- `test/mobile-hub.e2e-spec.ts`
- `test/observabilidade.e2e-spec.ts`
- `test/cockpit-operacoes.e2e-spec.ts` (sessão anterior)

---

## 3. Itens para análise — mudanças mais profundas

### 3.1 Multi-tenant: queries de produção sem `tenantId`

O modelo `User` possui unicidade composta:

```prisma
@@unique([tenantId, cpfCnpj])
@@unique([tenantId, email])
```

Porém vários serviços ainda consultam por documento ou e-mail **sem escopo de tenant**:

| Arquivo | Linha (aprox.) | Padrão | Risco |
|---------|----------------|--------|-------|
| `cx-portais/identity/portal-identity.service.ts` | 121, 226 | `user.findFirst({ where: { email } })` | Colisão entre tenants; falso positivo de “e-mail já cadastrado” |
| `transportadoras-autorizadas/transportadoras-autorizadas.service.ts` | 66, 82 | `findFirst({ cpfCnpj })`, `findFirst({ email })` | Mesmo CNPJ/e-mail em tenants distintos |
| `mobile-hub/identity/mobile-identity.service.ts` | 103, 133 | `findFirst({ cpfCnpj })` | Login mobile pode autenticar usuário de outro tenant |
| `clientes/*` (via `assertClienteDocumentoDisponivel`) | — | Verificar se filtra `tenantId` | Duplicidade cross-tenant |

**Recomendação:** padronizar uso de `userWhereByDocumento(tenantId, doc)` e `userWhereByEmail(tenantId, email)` (`src/tenant/tenant-prisma.util.ts`) em todo fluxo de auth/cadastro. Definir de onde vem o `tenantId` no portal público (header, subdomínio, constante `DEFAULT_TENANT_ID`).

**Impacto:** alteração de comportamento em ambientes multi-tenant reais; exige testes de regressão em cadastro portal, login intranet, mobile e transportadoras autorizadas.

---

### 3.2 Testes e2e — `deleteMany` / cleanup sem tenant

Estes arquivos ainda usam `where: { cpfCnpj: { in: [...] } }` no cleanup (compila, mas pode apagar usuários de outros tenants se existirem):

- `test/portal.e2e-spec.ts`
- `test/tesouraria.e2e-spec.ts`
- `test/rh-performance.e2e-spec.ts`
- `test/folha-rh.e2e-spec.ts`
- `test/integracao-mobilidade.e2e-spec.ts`
- `test/simulador-terminal.e2e-spec.ts`
- `test/planejamento-pessoal.e2e-spec.ts`
- `test/planejamento-estrategico.e2e-spec.ts`
- `test/observabilidade.e2e-spec.ts`
- `test/ia-operacional.e2e-spec.ts`
- `test/ia-preditiva.e2e-spec.ts`
- `test/fiscal-governanca.e2e-spec.ts`
- `test/financeiro-conciliacao.e2e-spec.ts`
- `test/dashboard-performance.e2e-spec.ts`
- `test/comercial-pricing.e2e-spec.ts`
- `test/cockpit-operacoes.e2e-spec.ts`
- `test/mobile-hub.e2e-spec.ts`

**Recomendação:** adicionar helper, por exemplo:

```ts
export function usersDeleteWhereForTestEmails(...emails: string[]) {
  return {
    tenantId: DEFAULT_TENANT_ID,
    cpfCnpj: { in: emails.map((e) => cpfCnpjForTestUser(e)) },
  };
}
```

---

### 3.3 Cadastro portal — role do usuário criado

Em `portal-identity.service.ts`, o cadastro self-service cria:

```ts
role: Role.ADMIN_CLIENTE
```

Verificar se isso é intencional (administrador da conta PJ/PF no portal) ou se deveria ser `CLIENTE` / outro perfil. Impacta permissões pós-login e guards do portal.

---

### 3.4 Validação de documento vs tipo PF/PJ

O fluxo valida coerência tipo/documento e chama `assertClienteDocumentoDisponivel`. Revisar se clientes soft-deleted (`deletedAt`) permitem re-cadastro com mesmo CPF/CNPJ — regra de negócio não alterada nesta auditoria.

---

### 3.5 Layout portal cadastro (1100px)

Alterações visuais já aplicadas (grid por linhas `fr`, ordem PJ, `PAGE_MAX_W`). O fundo da página permanece full-width; apenas o card respeita `max-w-[1100px]`. Comportamento esperado, não bug.

---

### 3.6 ESLint web (não bloqueante)

Warnings em `components/ssma/*` sobre uso de `<img>` em vez de `next/image`. Não afeta cadastro portal; correção opcional de performance/SEO.

---

## 4. Rotas verificadas (portal)

| Rota web | API backend | Status |
|----------|-------------|--------|
| `/portal/cadastrar` | `POST /portal/register` | Contrato alinhado via `tryPortalClienteRegister` |
| `/portal/login` | Login portal (JWT) | Sem erro TS |
| `/portal/redefinir/[token]` | Reset senha | Card 1100px + form interno `max-w-md` |

---

## 5. Próximos passos sugeridos

1. **Decisão de produto:** confirmar estratégia de tenant no portal público (single-tenant vs multi-tenant).
2. **Refatoração tenant-scoped:** aplicar helpers em serviços listados na seção 3.1.
3. **E2e cleanup:** migrar `deleteMany` para helper com `tenantId`.
4. **Suite completa:** rodar `npm test` e e2e em CI após refatoração tenant.
5. **Role pós-cadastro:** validar `ADMIN_CLIENTE` com equipe de negócio.

---

## 6. Comandos de validação

```powershell
cd apps/web; npx tsc --noEmit
cd apps/backend; npx tsc --noEmit
cd apps/backend; npm test
```

---

*Gerado em auditoria de código — correções pontuais aplicadas; itens da seção 3 requerem revisão antes de implementação.*
