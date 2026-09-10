-- Origens/destinos (operacional) + tarifas de transporte bidirecionais (financeiro)

CREATE TABLE "cadastros_locais_transporte" (
    "id" TEXT NOT NULL,
    "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
    "codigo" VARCHAR(32) NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "tipo" VARCHAR(32) NOT NULL DEFAULT 'OUTRO',
    "cidade" VARCHAR(120),
    "uf" VARCHAR(2),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "cadastros_locais_transporte_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cadastros_tarifas_transporte" (
    "id" TEXT NOT NULL,
    "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
    "local_a_id" TEXT NOT NULL,
    "local_b_id" TEXT NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "observacao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "cadastros_tarifas_transporte_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "cadastros_tarifas_transporte_locais_distintos_check" CHECK ("local_a_id" < "local_b_id")
);

CREATE UNIQUE INDEX "cadastros_locais_transporte_tenant_id_codigo_key" ON "cadastros_locais_transporte"("tenant_id", "codigo");
CREATE INDEX "cadastros_locais_transporte_tenant_id_ativo_idx" ON "cadastros_locais_transporte"("tenant_id", "ativo");

CREATE UNIQUE INDEX "cadastros_tarifas_transporte_tenant_id_local_a_id_local_b_id_key" ON "cadastros_tarifas_transporte"("tenant_id", "local_a_id", "local_b_id");
CREATE INDEX "cadastros_tarifas_transporte_tenant_id_ativo_idx" ON "cadastros_tarifas_transporte"("tenant_id", "ativo");

ALTER TABLE "cadastros_locais_transporte" ADD CONSTRAINT "cadastros_locais_transporte_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cadastros_tarifas_transporte" ADD CONSTRAINT "cadastros_tarifas_transporte_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cadastros_tarifas_transporte" ADD CONSTRAINT "cadastros_tarifas_transporte_local_a_id_fkey" FOREIGN KEY ("local_a_id") REFERENCES "cadastros_locais_transporte"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cadastros_tarifas_transporte" ADD CONSTRAINT "cadastros_tarifas_transporte_local_b_id_fkey" FOREIGN KEY ("local_b_id") REFERENCES "cadastros_locais_transporte"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
