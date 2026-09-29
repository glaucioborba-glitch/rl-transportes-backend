CREATE TYPE "ModoFaturamentoCliente" AS ENUM ('MANUAL', 'AUTOMATICO');
CREATE TYPE "StatusFaturaPacote" AS ENUM ('RASCUNHO', 'EMITINDO', 'ENVIADA', 'CANCELADA');

ALTER TABLE "clientes"
  ADD COLUMN "faturamento_modo" "ModoFaturamentoCliente" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "faturamento_hora" VARCHAR(5),
  ADD COLUMN "faturamento_auto_rodou_em" TIMESTAMP(3);

CREATE TABLE "faturas_pacote" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
  "cliente_id" TEXT NOT NULL,
  "numero" VARCHAR(32) NOT NULL,
  "modo" "ModoFaturamentoCliente" NOT NULL,
  "status" "StatusFaturaPacote" NOT NULL DEFAULT 'RASCUNHO',
  "valor_total" DECIMAL(12, 2) NOT NULL,
  "data_emissao" TIMESTAMP(3),
  "data_vencimento" TIMESTAMP(3),
  "link_nfse" VARCHAR(500),
  "link_boleto" VARCHAR(500),
  "link_pix" VARCHAR(500),
  "processamento_erro" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "faturas_pacote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "faturas_pacote_tenant_id_numero_key" ON "faturas_pacote"("tenant_id", "numero");
CREATE INDEX "faturas_pacote_cliente_id_status_idx" ON "faturas_pacote"("cliente_id", "status");
CREATE INDEX "faturas_pacote_tenant_id_created_at_idx" ON "faturas_pacote"("tenant_id", "created_at");

ALTER TABLE "faturas_pacote"
  ADD CONSTRAINT "faturas_pacote_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "faturas_pacote"
  ADD CONSTRAINT "faturas_pacote_cliente_id_fkey"
  FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "faturas_armazenagem"
  ADD COLUMN "fatura_pacote_id" TEXT;

CREATE INDEX "faturas_armazenagem_fatura_pacote_id_idx" ON "faturas_armazenagem"("fatura_pacote_id");

ALTER TABLE "faturas_armazenagem"
  ADD CONSTRAINT "faturas_armazenagem_fatura_pacote_id_fkey"
  FOREIGN KEY ("fatura_pacote_id") REFERENCES "faturas_pacote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
