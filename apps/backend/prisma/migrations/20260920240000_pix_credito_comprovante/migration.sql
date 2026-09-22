CREATE TYPE "StatusPixCreditoComprovante" AS ENUM ('PENDENTE', 'CONFERIDO');

CREATE TABLE "cliente_pix_credito_comprovantes" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL,
  "cliente_id" TEXT NOT NULL,
  "valor" DECIMAL(12, 2) NOT NULL,
  "referencia_externa" VARCHAR(120),
  "arquivo_nome" VARCHAR(180) NOT NULL,
  "mime_type" VARCHAR(80) NOT NULL,
  "storage_key" VARCHAR(500) NOT NULL,
  "tamanho_bytes" INTEGER NOT NULL,
  "status" "StatusPixCreditoComprovante" NOT NULL DEFAULT 'PENDENTE',
  "created_by_sub" VARCHAR(120),
  "conferido_por_user_id" TEXT,
  "conferido_por_nome" VARCHAR(120),
  "conferido_em" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "cliente_pix_credito_comprovantes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cliente_pix_credito_comprovantes_tenant_id_status_created_at_idx"
  ON "cliente_pix_credito_comprovantes"("tenant_id", "status", "created_at");

CREATE INDEX "cliente_pix_credito_comprovantes_cliente_id_status_idx"
  ON "cliente_pix_credito_comprovantes"("cliente_id", "status");

ALTER TABLE "cliente_pix_credito_comprovantes"
  ADD CONSTRAINT "cliente_pix_credito_comprovantes_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cliente_pix_credito_comprovantes"
  ADD CONSTRAINT "cliente_pix_credito_comprovantes_cliente_id_fkey"
  FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
