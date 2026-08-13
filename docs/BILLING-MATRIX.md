# Matriz de faturamento — Gate-v2 vs TOS

Documento de decisão arquitetural (ADR resumido) para evitar **double-charge** no mesmo contêiner/período.

## Dono da cobrança por fluxo

| Fluxo operacional | Motor de billing | Evento / artefato | Quando |
|-------------------|------------------|-------------------|--------|
| Solicitação corporativa v2 → Gate-v2 check-in/out | `ArmazenagemBillingService` | `PreFatura` → `Fatura` → outbox `EMITIR_NFSE_BOLETO` | Gate-in abre pré-fatura; gate-out consolida |
| TOS / agendamento depot (legado) | `BillingOutboxProcessor` | outbox `BILLING_TRIGGERED` → `Faturamento` | Dispatch / ciclo TOS sem Gate-v2 |

## Regras anti duplicata (implementadas)

1. **`assertNoConflictingBilling`** — antes de abrir `PreFatura` no gate-in, aborta se já existir pré-fatura **CONSOLIDADA** + fatura para o mesmo ISO/cliente.
2. **`hasConsolidatedPreFaturaForIso`** — no processor TOS (`BILLING_TRIGGERED`), ignora o evento se Gate-v2 já consolidou aquele ISO.

## Critério de aceite

- Gate-in → dias → gate-out → **exatamente 1** fatura armazenagem + 1 evento NFS-e/boleto por ISO.
- Evento TOS legado para o mesmo ISO **não** gera segundo `Faturamento` se Gate-v2 já faturou.

## Código

- `apps/backend/src/armazenagem-faturamento/billing-coexistence.util.ts`
- `apps/backend/src/armazenagem-faturamento/armazenagem-billing.service.ts`
- `apps/backend/src/outbox/billing-outbox.processor.ts`

## Evolução recomendada

Unificar ambos os motores em um único `BillingOrchestratorService` com estratégia por `aggregateType` — reduz divergência de tarifas entre Gate-v2 e TOS.
