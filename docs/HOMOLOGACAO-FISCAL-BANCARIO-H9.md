# Homologação H9 — Integração Fiscal (IPM) e Bancária

Guia para staging/produção do **Motor de Receita** (NFS-e + boleto/PIX após Gate-Out).

## Modos de operação

| Modo | Quando | Comportamento |
|------|--------|---------------|
| **Sandbox dev** | Sem `NFSE_IPM_SENHA` | NFS-e e boleto mock; links no portal; outbox processa normalmente |
| **Fiscal real** | `NFSE_IPM_SENHA` + cert A1 | Emissão IPM/Atende.Net; polling CRON se assíncrono |
| **Banco real** | `BANK_PROVIDER` ≠ `sandbox` + credenciais | Boleto + PIX via API do provedor |

## Checklist staging

### 1. Variáveis de ambiente

Copie de `.env.example` e preencha (nunca versionar valores reais):

```env
# Fiscal — Navegantes/SC (ajuste IBGE/TOM ao município)
NFSE_IPM_SENHA=
NFSE_IPM_CERT_PATH=./certs/rl-transportes-a1.pfx
NFSE_IPM_CERT_PASS=
NFSE_IPM_PRESTADOR_CNPJ=27692077000126
NFSE_IPM_PRESTADOR_TOM=8221
NFSE_ARM_CODIGO_ITEM=160201

# Bancário (ex.: itau | inter | cora | sandbox)
BANK_PROVIDER=sandbox
BANK_API_BASE_URL=
BANK_CLIENT_ID=
BANK_CLIENT_SECRET=
BANK_BOLETO_VENCIMENTO_DIAS=7
```

### 2. Certificado digital A1

1. Exporte o PFX da RL Transportes (validade ≥ 30 dias).
2. Monte no servidor ou container:

```yaml
# docker-compose excerpt
volumes:
  - ./certs/rl-transportes-a1.pfx:/run/secrets/nfse-a1.pfx:ro
environment:
  NFSE_IPM_CERT_PATH: /run/secrets/nfse-a1.pfx
  NFSE_IPM_CERT_PASS: ${NFSE_IPM_CERT_PASS}
```

3. Restrinja permissões: somente usuário do processo backend (`chmod 600`).

### 3. Validar config (sem transmitir)

```bash
cd apps/backend
npx ts-node scripts/validate-fiscal-bank-config.ts
```

### 4. Fluxo funcional em homologação

1. Gate check-in → estadia → check-out (gera `Fatura` + outbox `EMITIR_NFSE_BOLETO`).
2. Aguarde worker outbox (10s) ou reinicie API com worker ativo.
3. Confirme no banco:
   - `faturas.status_pagamento` = `AGUARDANDO_PAGAMENTO` (ou `PROCESSANDO` se IPM assíncrono).
   - `link_nfse`, `link_boleto`, `link_pix` preenchidos.
4. Portal cliente: **Financeiro → Armazenagem (Gate-Out)** — links NFS-e, boleto e PIX.
5. Se NFS-e pendente: CRON `NfsePollingCron` (*/5 min) até `linkNfsePdf` / status IPM `ACEITO`.

### 5. Rollback / resiliência

- Falha IPM ou banco: outbox **não trava Gate-Out**; evento retenta com backoff exponencial (1 min → 60 min).
- `faturas.processamento_erro` registra última falha; status volta a `PENDENTE` até sucesso.

## Portal (frontend)

- Endpoint: `GET /cliente/portal/financeiro/faturas-armazenagem`
- UI: `/portal/financeiro` → seção **Armazenagem (Gate-Out)** → detalhe `/portal/financeiro/armazenagem/[id]`
- Permissão RBAC: `podeVisualizarFinanceiro` na pessoa autorizada (ou STAFF com `?clienteId=`)

## Go-live produção

- [ ] Homologação IPM com nota de teste autorizada pela prefeitura
- [ ] Boleto/PIX de teste liquidado ou cancelado no banco
- [ ] Certificado A1 com alerta de vencimento (30/15/7 dias)
- [ ] `REDIS_OPTIONAL=0` (worker outbox + sessão portal)
- [ ] Monitorar fila `outbox_events` (`FAILED` / `retry_count`)

## Referências no código

| Componente | Caminho |
|------------|---------|
| Outbox processor | `apps/backend/src/outbox/nfse-boleto-outbox.processor.ts` |
| Fiscal IPM | `apps/backend/src/fiscal-integracao/fiscal-ipm.service.ts` |
| Banco | `apps/backend/src/fiscal-integracao/banking-boleto.service.ts` |
| Polling NFS-e | `apps/backend/src/fiscal-integracao/nfse-polling.cron.ts` |
| E2E outbox | `apps/backend/test/outbox-nfse-boleto.e2e-spec.ts` |
