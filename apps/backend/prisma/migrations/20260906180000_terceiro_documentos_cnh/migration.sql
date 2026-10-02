-- Campos extras do cadastro completo + anexos privados (CNH / CRLV).

ALTER TABLE "cadastros_terceiros" ADD COLUMN "placa_carreta_02" VARCHAR(10);
ALTER TABLE "cadastros_terceiros" ADD COLUMN "cnh_categoria" VARCHAR(8);
ALTER TABLE "cadastros_terceiros" ADD COLUMN "cnh_validade" DATE;

CREATE TYPE "TipoDocumentoTerceiro" AS ENUM ('CNH', 'CRLV_CAVALO', 'CRLV_CARRETA', 'CRLV_CARRETA_02');

CREATE TABLE "cadastros_terceiros_documentos" (
    "id" TEXT NOT NULL,
    "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
    "terceiro_id" TEXT,
    "tipo" "TipoDocumentoTerceiro" NOT NULL,
    "storage_key" VARCHAR(512) NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(80) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "extraido" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cadastros_terceiros_documentos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cadastros_terceiros_documentos_tenant_id_terceiro_id_idx" ON "cadastros_terceiros_documentos"("tenant_id", "terceiro_id");

ALTER TABLE "cadastros_terceiros_documentos" ADD CONSTRAINT "cadastros_terceiros_documentos_terceiro_id_fkey" FOREIGN KEY ("terceiro_id") REFERENCES "cadastros_terceiros"("id") ON DELETE SET NULL ON UPDATE CASCADE;
