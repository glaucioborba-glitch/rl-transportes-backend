-- Unique só entre trechos ativos (permite recriar após exclusão)

DROP INDEX IF EXISTS "cadastros_tarifas_transporte_trecho_params_key";

CREATE UNIQUE INDEX "cadastros_tarifas_transporte_trecho_params_key"
  ON "cadastros_tarifas_transporte"("tenant_id", "local_a_id", "local_b_id", "status_carga", "tipo_container_codigo", "retorno")
  WHERE "deleted_at" IS NULL;
