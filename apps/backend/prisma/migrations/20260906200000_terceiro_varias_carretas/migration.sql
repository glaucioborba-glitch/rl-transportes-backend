-- Um dono: 1 cavalo + N carretas. Índice liga o CRLV à carreta.

ALTER TABLE "cadastros_terceiros" ADD COLUMN "placas_carretas" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "cadastros_terceiros"
SET "placas_carretas" = ARRAY_REMOVE(ARRAY["placa_carreta", "placa_carreta_02"], NULL)
WHERE "placa_carreta" IS NOT NULL OR "placa_carreta_02" IS NOT NULL;

ALTER TABLE "cadastros_terceiros_documentos" ADD COLUMN "indice" INTEGER;

UPDATE "cadastros_terceiros_documentos" SET "indice" = 0 WHERE "tipo" = 'CRLV_CARRETA';
UPDATE "cadastros_terceiros_documentos" SET "indice" = 1 WHERE "tipo" = 'CRLV_CARRETA_02';
