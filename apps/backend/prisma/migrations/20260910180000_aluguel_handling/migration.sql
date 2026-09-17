ALTER TABLE "cadastros_tabela_aluguel_itens"
  ADD COLUMN IF NOT EXISTS "valor_handling" DECIMAL(12, 2) NOT NULL DEFAULT 0;

UPDATE "cadastros_tabela_aluguel_itens"
SET "valor_handling" = "valor_entrega"
WHERE "valor_handling" = 0 AND "valor_entrega" > 0;

ALTER TABLE "cadastros_tabela_aluguel_itens"
  DROP COLUMN IF EXISTS "valor_entrega";
ALTER TABLE "cadastros_tabela_aluguel_itens"
  DROP COLUMN IF EXISTS "valor_coleta";
