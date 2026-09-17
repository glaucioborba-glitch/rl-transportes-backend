-- Coordenadas para plotar origens/destinos no mapa de Localização (ETA).
ALTER TABLE "cadastros_locais_transporte"
  ADD COLUMN "lat" DOUBLE PRECISION,
  ADD COLUMN "lng" DOUBLE PRECISION;

UPDATE "cadastros_locais_transporte" SET "lat" = -26.8948, "lng" = -48.6545
WHERE "codigo" = 'FL' AND "lat" IS NULL;
UPDATE "cadastros_locais_transporte" SET "lat" = -26.8915, "lng" = -48.6578
WHERE "codigo" = 'PORTONAVE' AND "lat" IS NULL;
UPDATE "cadastros_locais_transporte" SET "lat" = -26.1175, "lng" = -48.6085
WHERE "codigo" = 'ITAPOA' AND "lat" IS NULL;
UPDATE "cadastros_locais_transporte" SET "lat" = -26.9053, "lng" = -48.6548
WHERE "codigo" = 'TECON' AND "lat" IS NULL;
