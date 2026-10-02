-- CreateTable
CREATE TABLE "condicoes_pagamento_personalizadas" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "value" VARCHAR(64) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "condicoes_pagamento_personalizadas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "condicoes_pagamento_personalizadas_tenant_id_idx" ON "condicoes_pagamento_personalizadas"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "condicoes_pagamento_personalizadas_tenant_id_value_key" ON "condicoes_pagamento_personalizadas"("tenant_id", "value");

-- AddForeignKey
ALTER TABLE "condicoes_pagamento_personalizadas" ADD CONSTRAINT "condicoes_pagamento_personalizadas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
