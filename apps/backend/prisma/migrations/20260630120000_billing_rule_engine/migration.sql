-- Billing Rule Engine: regras por evento/tipo contêiner + itens de fatura provisionados

CREATE TYPE "EventoGatilhoTarifa" AS ENUM (
  'GATE_IN',
  'GATE_OUT',
  'DIARIA_ARMAZENAGEM',
  'SHIFTING_EXTRA'
);

CREATE TYPE "TipoContainerTarifa" AS ENUM (
  'TODOS',
  'DRY_20',
  'DRY_40',
  'REEFER',
  'IMO_PERIGOSA'
);

ALTER TABLE "regras_tarifarias"
  ADD COLUMN IF NOT EXISTS "evento_gatilho" "EventoGatilhoTarifa",
  ADD COLUMN IF NOT EXISTS "tipo_container" "TipoContainerTarifa" NOT NULL DEFAULT 'TODOS',
  ADD COLUMN IF NOT EXISTS "valor" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "dias_free_time" INTEGER NOT NULL DEFAULT 0;

UPDATE "regras_tarifarias"
SET
  "evento_gatilho" = 'DIARIA_ARMAZENAGEM',
  "tipo_container" = 'TODOS',
  "valor" = COALESCE("valor_diaria", 0),
  "dias_free_time" = COALESCE("free_time_dias", 7)
WHERE "evento_gatilho" IS NULL;

INSERT INTO "regras_tarifarias" (
  "id", "tabela_preco_id", "nome", "evento_gatilho", "tipo_container",
  "valor", "dias_free_time", "ativa", "created_at", "updated_at"
)
SELECT
  gen_random_uuid()::text,
  r."tabela_preco_id",
  'Gate-In padrão',
  'GATE_IN'::"EventoGatilhoTarifa",
  'TODOS'::"TipoContainerTarifa",
  COALESCE(r."valor_gate_in", 0),
  0,
  r."ativa",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "regras_tarifarias" r
WHERE r."evento_gatilho" = 'DIARIA_ARMAZENAGEM'
  AND COALESCE(r."valor_gate_in", 0) <> 0
  AND NOT EXISTS (
    SELECT 1 FROM "regras_tarifarias" x
    WHERE x."tabela_preco_id" = r."tabela_preco_id"
      AND x."evento_gatilho" = 'GATE_IN'
  );

INSERT INTO "regras_tarifarias" (
  "id", "tabela_preco_id", "nome", "evento_gatilho", "tipo_container",
  "valor", "dias_free_time", "ativa", "created_at", "updated_at"
)
SELECT
  gen_random_uuid()::text,
  r."tabela_preco_id",
  'Gate-Out padrão',
  'GATE_OUT'::"EventoGatilhoTarifa",
  'TODOS'::"TipoContainerTarifa",
  COALESCE(r."valor_gate_out", 0),
  0,
  r."ativa",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "regras_tarifarias" r
WHERE r."evento_gatilho" = 'DIARIA_ARMAZENAGEM'
  AND COALESCE(r."valor_gate_out", 0) <> 0
  AND NOT EXISTS (
    SELECT 1 FROM "regras_tarifarias" x
    WHERE x."tabela_preco_id" = r."tabela_preco_id"
      AND x."evento_gatilho" = 'GATE_OUT'
  );

INSERT INTO "regras_tarifarias" (
  "id", "tabela_preco_id", "nome", "evento_gatilho", "tipo_container",
  "valor", "dias_free_time", "ativa", "created_at", "updated_at"
)
SELECT
  gen_random_uuid()::text,
  r."tabela_preco_id",
  'Diária Reefer',
  'DIARIA_ARMAZENAGEM'::"EventoGatilhoTarifa",
  'REEFER'::"TipoContainerTarifa",
  ROUND(COALESCE(r."valor_diaria", 0) * COALESCE(r."fator_reefer", 2), 2),
  COALESCE(r."free_time_dias", 7),
  r."ativa",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "regras_tarifarias" r
WHERE r."evento_gatilho" = 'DIARIA_ARMAZENAGEM'
  AND r."tipo_container" = 'TODOS'
  AND COALESCE(r."fator_reefer", 1) > 1
  AND NOT EXISTS (
    SELECT 1 FROM "regras_tarifarias" x
    WHERE x."tabela_preco_id" = r."tabela_preco_id"
      AND x."evento_gatilho" = 'DIARIA_ARMAZENAGEM'
      AND x."tipo_container" = 'REEFER'
  );

ALTER TABLE "regras_tarifarias" ALTER COLUMN "evento_gatilho" SET NOT NULL;
ALTER TABLE "regras_tarifarias" ALTER COLUMN "valor" SET NOT NULL;
ALTER TABLE "regras_tarifarias" ALTER COLUMN "valor" SET DEFAULT 0;

ALTER TABLE "regras_tarifarias" DROP COLUMN IF EXISTS "valor_gate_in";
ALTER TABLE "regras_tarifarias" DROP COLUMN IF EXISTS "valor_gate_out";
ALTER TABLE "regras_tarifarias" DROP COLUMN IF EXISTS "valor_diaria";
ALTER TABLE "regras_tarifarias" DROP COLUMN IF EXISTS "free_time_dias";
ALTER TABLE "regras_tarifarias" DROP COLUMN IF EXISTS "fator_reefer";
ALTER TABLE "regras_tarifarias" DROP COLUMN IF EXISTS "fator_imo";

DROP INDEX IF EXISTS "regras_tarifarias_tabela_preco_id_ativa_idx";
CREATE INDEX "regras_tarifarias_tabela_preco_id_ativa_evento_gatilho_idx"
  ON "regras_tarifarias"("tabela_preco_id", "ativa", "evento_gatilho");

CREATE TABLE "itens_fatura_armazenagem" (
  "id" TEXT NOT NULL,
  "pre_fatura_id" TEXT NOT NULL,
  "regra_tarifaria_id" TEXT,
  "evento_gatilho" "EventoGatilhoTarifa" NOT NULL,
  "descricao" VARCHAR(255) NOT NULL,
  "quantidade" INTEGER NOT NULL DEFAULT 1,
  "valor_unitario" DECIMAL(10,2) NOT NULL,
  "valor_total" DECIMAL(10,2) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "itens_fatura_armazenagem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "itens_fatura_armazenagem_pre_fatura_id_evento_gatilho_idx"
  ON "itens_fatura_armazenagem"("pre_fatura_id", "evento_gatilho");

ALTER TABLE "itens_fatura_armazenagem"
  ADD CONSTRAINT "itens_fatura_armazenagem_pre_fatura_id_fkey"
  FOREIGN KEY ("pre_fatura_id") REFERENCES "pre_faturas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "itens_fatura_armazenagem"
  ADD CONSTRAINT "itens_fatura_armazenagem_regra_tarifaria_id_fkey"
  FOREIGN KEY ("regra_tarifaria_id") REFERENCES "regras_tarifarias"("id") ON DELETE SET NULL ON UPDATE CASCADE;
