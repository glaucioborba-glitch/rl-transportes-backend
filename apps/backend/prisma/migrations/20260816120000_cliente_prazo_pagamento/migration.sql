-- AlterTable
ALTER TABLE "clientes" ADD COLUMN "prazo_pagamento" VARCHAR(64);

-- Backfill: valores de prazo que estavam misturados em condicao_pagamento
UPDATE "clientes"
SET "prazo_pagamento" = "condicao_pagamento"
WHERE "prazo_pagamento" IS NULL
  AND "condicao_pagamento" IN ('A_VISTA', '30_DIAS', '30_60', '30_60_90', 'PERSONALIZADO');
