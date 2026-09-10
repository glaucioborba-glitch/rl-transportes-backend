-- Cavalo = tração (Renavam/validade). Capacidade (pinos) só na carreta.

ALTER TABLE "cadastros_terceiros" ADD COLUMN "renavam_cavalo" VARCHAR(11);
ALTER TABLE "cadastros_terceiros" ADD COLUMN "crlv_validade_cavalo" DATE;
ALTER TABLE "cadastros_terceiros" ADD COLUMN "carretas" JSONB NOT NULL DEFAULT '[]';

UPDATE "cadastros_terceiros"
SET "carretas" = COALESCE((
  SELECT jsonb_agg(
    jsonb_build_object(
      'placa', p,
      'capacidade', "capacidade"::text
    )
  )
  FROM unnest("placas_carretas") AS p
), '[]'::jsonb)
WHERE cardinality("placas_carretas") > 0;
