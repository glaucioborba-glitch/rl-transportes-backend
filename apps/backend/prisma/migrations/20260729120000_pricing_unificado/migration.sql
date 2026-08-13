-- Pricing unificado: capacidades MDM, matriz armazenagem, faixas diária, HANDLING, tabela padrão

-- Enums
ALTER TYPE "EventoGatilhoTarifa" ADD VALUE IF NOT EXISTS 'HANDLING';

CREATE TYPE "CategoriaItemTabelaPreco" AS ENUM ('OPERACAO', 'ARMAZENAGEM');

-- MDM capacidades
CREATE TABLE "cadastros_capacidades_container" (
    "id" TEXT NOT NULL,
    "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
    "codigo" VARCHAR(32) NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "cadastros_capacidades_container_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cadastros_capacidades_container_tenant_id_codigo_key"
  ON "cadastros_capacidades_container"("tenant_id", "codigo");
CREATE INDEX "cadastros_capacidades_container_tenant_id_ativo_idx"
  ON "cadastros_capacidades_container"("tenant_id", "ativo");

ALTER TABLE "cadastros_capacidades_container"
  ADD CONSTRAINT "cadastros_capacidades_container_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Cadastro tabela preco
ALTER TABLE "cadastros_tabelas_preco"
  ADD COLUMN IF NOT EXISTS "padrao" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "billing_tabela_preco_id" TEXT,
  ADD COLUMN IF NOT EXISTS "synced_at" TIMESTAMP(3);

ALTER TABLE "cadastros_tabelas_preco"
  ALTER COLUMN "data_inicio" SET DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS "cadastros_tabelas_preco_billing_tabela_preco_id_key"
  ON "cadastros_tabelas_preco"("billing_tabela_preco_id");
CREATE INDEX IF NOT EXISTS "cadastros_tabelas_preco_tenant_id_padrao_idx"
  ON "cadastros_tabelas_preco"("tenant_id", "padrao");

-- Cadastro itens
ALTER TABLE "cadastros_tabelas_preco_itens"
  ADD COLUMN IF NOT EXISTS "categoria_item" "CategoriaItemTabelaPreco" NOT NULL DEFAULT 'OPERACAO',
  ADD COLUMN IF NOT EXISTS "capacidade_codigo" VARCHAR(32),
  ADD COLUMN IF NOT EXISTS "valor_handling" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "faixas_diaria" JSONB;

ALTER TABLE "cadastros_tabelas_preco_itens"
  ALTER COLUMN "valor" SET DEFAULT 0;

CREATE INDEX IF NOT EXISTS "cadastros_tabelas_preco_itens_tabela_id_categoria_item_idx"
  ON "cadastros_tabelas_preco_itens"("tabela_id", "categoria_item");

-- Billing runtime
ALTER TABLE "tabelas_preco"
  ADD COLUMN IF NOT EXISTS "padrao" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "tabelas_preco_tenant_id_padrao_idx"
  ON "tabelas_preco"("tenant_id", "padrao");

ALTER TABLE "regras_tarifarias"
  ADD COLUMN IF NOT EXISTS "tipo_container_codigo" VARCHAR(32),
  ADD COLUMN IF NOT EXISTS "capacidade_codigo" VARCHAR(32),
  ADD COLUMN IF NOT EXISTS "container_tamanho" VARCHAR(8),
  ADD COLUMN IF NOT EXISTS "faixas_diaria" JSONB;

-- FK cadastro -> billing (after tabelas_preco exists)
ALTER TABLE "cadastros_tabelas_preco"
  ADD CONSTRAINT "cadastros_tabelas_preco_billing_tabela_preco_id_fkey"
  FOREIGN KEY ("billing_tabela_preco_id") REFERENCES "tabelas_preco"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed capacidades default
INSERT INTO "cadastros_capacidades_container" ("id", "tenant_id", "codigo", "nome", "ativo", "updated_at")
VALUES
  (gen_random_uuid()::text, 'default', 'DC', 'Dry Container (altura padrão)', true, NOW()),
  (gen_random_uuid()::text, 'default', 'HC', 'High Cube', true, NOW())
ON CONFLICT DO NOTHING;
