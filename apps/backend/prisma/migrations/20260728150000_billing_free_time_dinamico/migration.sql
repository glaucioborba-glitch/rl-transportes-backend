-- PR-03: Free time dinâmico por status CHEIO/VAZIO nos itens cadastrais e pátio.

ALTER TABLE "cadastros_tabelas_preco_itens"
ADD COLUMN IF NOT EXISTS "status_container" TEXT NOT NULL DEFAULT 'AMBOS';

ALTER TABLE "cadastros_tabelas_preco_itens"
ADD COLUMN IF NOT EXISTS "free_time_dias" INTEGER,
ADD COLUMN IF NOT EXISTS "tarifa_diaria_armazenagem" DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS "tarifa_energia_reefer_diaria" DECIMAL(10, 2);

CREATE INDEX IF NOT EXISTS "idx_cadastro_tabela_preco_item_billing"
ON "cadastros_tabelas_preco_itens"("tabela_id", "tipo_container_codigo", "container_tamanho", "status_container");

ALTER TABLE "patio_v2_unidades"
ADD COLUMN IF NOT EXISTS "status_container" TEXT DEFAULT 'AMBOS';

UPDATE "regras_tarifarias"
SET "status_container" = 'AMBOS'
WHERE "status_container" IS NULL OR "status_container" = '';

UPDATE "cadastros_tabelas_preco_itens"
SET "status_container" = 'AMBOS'
WHERE "status_container" IS NULL OR "status_container" = '';
