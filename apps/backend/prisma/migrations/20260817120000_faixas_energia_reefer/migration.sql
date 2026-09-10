ALTER TABLE "cadastros_tabelas_preco_itens"
  ADD COLUMN IF NOT EXISTS "faixas_energia_reefer" JSONB;

UPDATE "cadastros_tabelas_preco_itens"
SET "faixas_energia_reefer" = jsonb_build_array(
  jsonb_build_object(
    'diaInicio', 1,
    'diaFim', NULL,
    'valorDiaria', "tarifa_energia_reefer_diaria"
  )
)
WHERE "tarifa_energia_reefer_diaria" IS NOT NULL
  AND "tarifa_energia_reefer_diaria" > 0
  AND ("faixas_energia_reefer" IS NULL OR "faixas_energia_reefer" = 'null'::jsonb);
