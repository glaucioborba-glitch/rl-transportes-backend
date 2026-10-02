-- Caixa comercial por cliente: crédito/débito manuais (não é livro de faturas).

CREATE TYPE "TipoLancamentoContaCorrente" AS ENUM ('CREDITO', 'DEBITO');
CREATE TYPE "MotivoLancamentoContaCorrente" AS ENUM (
  'ACORDO_COMERCIAL',
  'AJUSTE_FATURA',
  'PIX_A_MAIOR',
  'LIBERACAO_PAGAR_DEPOIS',
  'COMPENSACAO',
  'OUTRO'
);

CREATE TABLE "cliente_conta_corrente_lancamentos" (
    "id" TEXT NOT NULL,
    "tenant_id" VARCHAR(64) NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "tipo" "TipoLancamentoContaCorrente" NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "valor_sinal" DECIMAL(12,2) NOT NULL,
    "motivo" "MotivoLancamentoContaCorrente" NOT NULL DEFAULT 'OUTRO',
    "descricao" VARCHAR(500) NOT NULL,
    "referencia" VARCHAR(120),
    "created_by_user_id" TEXT,
    "created_by_nome" VARCHAR(120),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cliente_conta_corrente_lancamentos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cliente_conta_corrente_lancamentos_tenant_id_cliente_id_created_at_idx"
  ON "cliente_conta_corrente_lancamentos"("tenant_id", "cliente_id", "created_at");
CREATE INDEX "cliente_conta_corrente_lancamentos_cliente_id_idx"
  ON "cliente_conta_corrente_lancamentos"("cliente_id");

ALTER TABLE "cliente_conta_corrente_lancamentos"
  ADD CONSTRAINT "cliente_conta_corrente_lancamentos_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cliente_conta_corrente_lancamentos"
  ADD CONSTRAINT "cliente_conta_corrente_lancamentos_cliente_id_fkey"
  FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
