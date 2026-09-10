# Matriz de faturamento

Documento de decisão arquitetural (ADR resumido) para evitar **double-charge** no mesmo contêiner/período.

## Dono da cobrança

| Fluxo operacional | Motor de billing | Evento / artefato | Quando |
|-------------------|------------------|-------------------|--------|
| Solicitação corporativa → ID (`UnidadeProcesso`) | `ArmazenagemBillingService` | `PreFatura` → `Fatura` → outbox `EMITIR_NFSE_BOLETO` | Abertura do ID abre pré-fatura; encerramento consolida |

O ciclo TOS (depot FSM + `BILLING_TRIGGERED` com tarifas hardcoded) foi **removido**. Tabelas de preço do cadastro (`CadastroTabelaPreco` → sync → `TabelaPreco` / `RegraTarifaria`) são a única fonte de pátio. Sem tabela padrão do terminal, o motor **não fatura** (não há número hardcoded).

Uma fatura por ciclo de ID inclui: handling, armazenagem, energia, **frete** e **serviços adicionais** lançados no ID (`CadastroTabelaServico` → `UnidadeProcessoServico`).

## Regras anti duplicata

1. **`assertNoConflictingBilling`** — antes de abrir `PreFatura`, aborta se já existir pré-fatura **ABERTA** para o mesmo ISO/cliente (outro ID ou gate-in).
2. Histórico **CONSOLIDADA** não bloqueia um novo ciclo no mesmo ISO.

## Critério de aceite

- Abertura do ID → dias no pátio → encerramento → **exatamente 1** fatura de armazenagem + 1 evento NFS-e/boleto por ciclo.

## Código

- `apps/backend/src/armazenagem-faturamento/billing-coexistence.util.ts`
- `apps/backend/src/armazenagem-faturamento/armazenagem-billing.service.ts`
- `apps/backend/src/billing-engine/billing-rule-engine.service.ts`
