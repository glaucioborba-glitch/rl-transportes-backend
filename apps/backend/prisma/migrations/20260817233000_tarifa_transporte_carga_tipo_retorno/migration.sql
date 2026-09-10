-- Parâmetros de tarifa de transporte: carga, tipo de contêiner, retorno (50%) e valor ao terceiro

ALTER TABLE "cadastros_tarifas_transporte"
  ADD COLUMN IF NOT EXISTS "status_carga" VARCHAR(16) NOT NULL DEFAULT 'CHEIO',
  ADD COLUMN IF NOT EXISTS "tipo_container_codigo" VARCHAR(32) NOT NULL DEFAULT 'DRYDC',
  ADD COLUMN IF NOT EXISTS "retorno" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "valor_pago_terceiro" DECIMAL(12,2);

DROP INDEX IF EXISTS "cadastros_tarifas_transporte_tenant_id_local_a_id_local_b_id_key";

CREATE UNIQUE INDEX IF NOT EXISTS "cadastros_tarifas_transporte_trecho_params_key"
  ON "cadastros_tarifas_transporte"("tenant_id", "local_a_id", "local_b_id", "status_carga", "tipo_container_codigo", "retorno");
