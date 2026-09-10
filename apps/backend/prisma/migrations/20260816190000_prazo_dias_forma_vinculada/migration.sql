-- AlterTable
ALTER TABLE "condicoes_pagamento_personalizadas"
ADD COLUMN "dias" INTEGER,
ADD COLUMN "forma_vinculada" VARCHAR(64);

-- Backfill prazos já cadastrados
UPDATE "condicoes_pagamento_personalizadas"
SET "dias" = 0, "forma_vinculada" = 'AVISTA_PIX'
WHERE "tipo" = 'PRAZO' AND "value" = 'A_VISTA';

UPDATE "condicoes_pagamento_personalizadas"
SET "dias" = 30, "forma_vinculada" = 'FATURAMENTO'
WHERE "tipo" = 'PRAZO' AND "value" IN ('30_DIAS', '30_60', '30_60_90', 'PERSONALIZADO');

UPDATE "condicoes_pagamento_personalizadas"
SET "dias" = 30, "forma_vinculada" = 'FATURAMENTO'
WHERE "tipo" = 'PRAZO' AND "dias" IS NULL;
