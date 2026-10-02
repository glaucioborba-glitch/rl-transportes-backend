ALTER TABLE "cadastros_tabela_aluguel_itens"
  ADD COLUMN IF NOT EXISTS "faixas_diaria" JSONB;
