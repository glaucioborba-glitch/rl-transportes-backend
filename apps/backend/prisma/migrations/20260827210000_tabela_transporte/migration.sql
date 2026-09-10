-- Tabelas de transporte (catálogo por cliente) + vínculo nos clientes.
-- Trechos existentes vão para "Tabela de transportes padrão".

CREATE TABLE "cadastros_tabelas_transporte" (
    "id" TEXT NOT NULL,
    "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
    "nome" VARCHAR(255) NOT NULL,
    "descricao" TEXT,
    "data_inicio" DATE NOT NULL DEFAULT CURRENT_DATE,
    "data_fim" DATE,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "padrao" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "cadastros_tabelas_transporte_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cadastros_tabelas_transporte_tenant_id_ativo_idx"
  ON "cadastros_tabelas_transporte"("tenant_id", "ativo");
CREATE INDEX "cadastros_tabelas_transporte_tenant_id_padrao_idx"
  ON "cadastros_tabelas_transporte"("tenant_id", "padrao");
CREATE INDEX "cadastros_tabelas_transporte_tenant_id_data_inicio_data_fim_idx"
  ON "cadastros_tabelas_transporte"("tenant_id", "data_inicio", "data_fim");

ALTER TABLE "cadastros_tabelas_transporte"
  ADD CONSTRAINT "cadastros_tabelas_transporte_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "cadastros_tabelas_transporte" (
  "id", "tenant_id", "nome", "descricao", "data_inicio", "ativo", "padrao", "created_at", "updated_at"
)
SELECT
  gen_random_uuid()::text,
  t."id",
  'Tabela de transportes padrão',
  'Tabela inicial aplicada a novos cadastros',
  CURRENT_DATE,
  true,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "tenants" t
WHERE NOT EXISTS (
  SELECT 1 FROM "cadastros_tabelas_transporte" x
  WHERE x."tenant_id" = t."id" AND x."padrao" = true AND x."deleted_at" IS NULL
);

ALTER TABLE "cadastros_tarifas_transporte" ADD COLUMN "tabela_id" TEXT;

UPDATE "cadastros_tarifas_transporte" tarifa
SET "tabela_id" = padrao."id"
FROM "cadastros_tabelas_transporte" padrao
WHERE padrao."tenant_id" = tarifa."tenant_id"
  AND padrao."padrao" = true
  AND padrao."deleted_at" IS NULL
  AND tarifa."tabela_id" IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "cadastros_tarifas_transporte" WHERE "tabela_id" IS NULL) THEN
    RAISE EXCEPTION 'Há tarifas de transporte sem tabela padrão para o tenant.';
  END IF;
END $$;

ALTER TABLE "cadastros_tarifas_transporte" ALTER COLUMN "tabela_id" SET NOT NULL;

CREATE INDEX "cadastros_tarifas_transporte_tabela_id_idx"
  ON "cadastros_tarifas_transporte"("tabela_id");

DROP INDEX IF EXISTS "cadastros_tarifas_transporte_trecho_params_key";

CREATE UNIQUE INDEX "cadastros_tarifas_transporte_trecho_params_key"
  ON "cadastros_tarifas_transporte"(
    "tenant_id", "tabela_id", "local_a_id", "local_b_id", "status_carga", "tipo_container_codigo", "retorno"
  )
  WHERE "deleted_at" IS NULL;

ALTER TABLE "cadastros_tarifas_transporte"
  ADD CONSTRAINT "cadastros_tarifas_transporte_tabela_id_fkey"
  FOREIGN KEY ("tabela_id") REFERENCES "cadastros_tabelas_transporte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "clientes" ADD COLUMN "cadastro_tabela_transporte_id" TEXT;

UPDATE "clientes" c
SET "cadastro_tabela_transporte_id" = padrao."id"
FROM "cadastros_tabelas_transporte" padrao
WHERE padrao."tenant_id" = c."tenant_id"
  AND padrao."padrao" = true
  AND padrao."deleted_at" IS NULL
  AND c."cadastro_tabela_transporte_id" IS NULL
  AND c."deletedAt" IS NULL;

CREATE INDEX "clientes_cadastro_tabela_transporte_id_idx"
  ON "clientes"("cadastro_tabela_transporte_id");

ALTER TABLE "clientes"
  ADD CONSTRAINT "clientes_cadastro_tabela_transporte_id_fkey"
  FOREIGN KEY ("cadastro_tabela_transporte_id") REFERENCES "cadastros_tabelas_transporte"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
