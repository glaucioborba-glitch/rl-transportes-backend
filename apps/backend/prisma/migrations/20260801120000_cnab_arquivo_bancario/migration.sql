-- Infraestrutura CNAB: rastreabilidade de arquivos bancários e campos de conciliação em faturas.

CREATE TYPE "TipoArquivoBancario" AS ENUM ('REMESSA', 'RETORNO');
CREATE TYPE "StatusArquivoBancario" AS ENUM ('PENDENTE', 'PROCESSANDO', 'CONCLUIDO', 'ERRO');

ALTER TABLE "faturas_armazenagem" ADD COLUMN IF NOT EXISTS "data_pagamento" TIMESTAMP(3);
ALTER TABLE "faturas_armazenagem" ADD COLUMN IF NOT EXISTS "nosso_numero" VARCHAR(32);

CREATE INDEX IF NOT EXISTS "faturas_armazenagem_nosso_numero_idx" ON "faturas_armazenagem"("nosso_numero");

CREATE TABLE "arquivos_bancarios" (
    "id" TEXT NOT NULL,
    "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
    "nome_arquivo" VARCHAR(255) NOT NULL,
    "tipo" "TipoArquivoBancario" NOT NULL,
    "status" "StatusArquivoBancario" NOT NULL DEFAULT 'PENDENTE',
    "data_upload" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processado_em" TIMESTAMP(3),
    "log_processamento" JSONB,

    CONSTRAINT "arquivos_bancarios_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "arquivos_bancarios_tenant_id_status_idx" ON "arquivos_bancarios"("tenant_id", "status");
CREATE INDEX "arquivos_bancarios_data_upload_idx" ON "arquivos_bancarios"("data_upload");

ALTER TABLE "arquivos_bancarios" ADD CONSTRAINT "arquivos_bancarios_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
