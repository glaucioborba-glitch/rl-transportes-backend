-- CreateEnum
CREATE TYPE "TipoOpcaoPagamento" AS ENUM ('FORMA', 'PRAZO');

-- AlterTable
ALTER TABLE "condicoes_pagamento_personalizadas"
ADD COLUMN "tipo" "TipoOpcaoPagamento" NOT NULL DEFAULT 'FORMA',
ADD COLUMN "ordem" INTEGER NOT NULL DEFAULT 0;

-- Unique (tenant + tipo + value)
DROP INDEX IF EXISTS "condicoes_pagamento_personalizadas_tenant_id_value_key";
CREATE UNIQUE INDEX "condicoes_pagamento_personalizadas_tenant_id_tipo_value_key"
  ON "condicoes_pagamento_personalizadas"("tenant_id", "tipo", "value");

CREATE INDEX "condicoes_pagamento_personalizadas_tenant_id_tipo_idx"
  ON "condicoes_pagamento_personalizadas"("tenant_id", "tipo");
