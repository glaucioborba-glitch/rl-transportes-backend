-- AlterTable
ALTER TABLE "condicoes_pagamento_personalizadas"
ADD COLUMN "vencimentos" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];

-- Prazos conhecidos: calendário completo
UPDATE "condicoes_pagamento_personalizadas"
SET "vencimentos" = ARRAY[0], "dias" = 0
WHERE "tipo" = 'PRAZO' AND "value" = 'A_VISTA';

UPDATE "condicoes_pagamento_personalizadas"
SET "vencimentos" = ARRAY[30], "dias" = 30
WHERE "tipo" = 'PRAZO' AND "value" = '30_DIAS';

UPDATE "condicoes_pagamento_personalizadas"
SET "vencimentos" = ARRAY[30, 60], "dias" = 30
WHERE "tipo" = 'PRAZO' AND "value" = '30_60';

UPDATE "condicoes_pagamento_personalizadas"
SET "vencimentos" = ARRAY[30, 60, 90], "dias" = 30
WHERE "tipo" = 'PRAZO' AND "value" IN ('30_60_90');

UPDATE "condicoes_pagamento_personalizadas"
SET "vencimentos" = ARRAY[30], "dias" = 30
WHERE "tipo" = 'PRAZO' AND "value" = 'PERSONALIZADO' AND cardinality("vencimentos") = 0;

-- Demais prazos: um vencimento com o campo dias já cadastrado
UPDATE "condicoes_pagamento_personalizadas"
SET "vencimentos" = ARRAY[COALESCE("dias", 30)],
    "dias" = COALESCE("dias", 30)
WHERE "tipo" = 'PRAZO' AND cardinality("vencimentos") = 0;
