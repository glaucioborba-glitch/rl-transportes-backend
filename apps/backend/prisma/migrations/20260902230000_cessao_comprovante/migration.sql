ALTER TABLE "cessoes_titularidade" ADD COLUMN IF NOT EXISTS "comprovante_nome" VARCHAR(255);
ALTER TABLE "cessoes_titularidade" ADD COLUMN IF NOT EXISTS "comprovante_mime" VARCHAR(80);
ALTER TABLE "cessoes_titularidade" ADD COLUMN IF NOT EXISTS "comprovante_storage_key" VARCHAR(500);
ALTER TABLE "cessoes_titularidade" ADD COLUMN IF NOT EXISTS "comprovante_tamanho" INTEGER;
