-- AlterTable
ALTER TABLE "cadastros_locais_transporte" ADD COLUMN "padrao" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "cadastros_locais_transporte_tenant_id_padrao_idx" ON "cadastros_locais_transporte"("tenant_id", "padrao");
