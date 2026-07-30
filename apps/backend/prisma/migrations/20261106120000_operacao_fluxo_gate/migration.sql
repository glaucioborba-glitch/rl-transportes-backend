-- Fluxo operacional sequencial (portaria, vistoria, RIC, operação)
ALTER TABLE "solicitacoes" ADD COLUMN IF NOT EXISTS "operacao_fluxo_estado" VARCHAR(48);
ALTER TABLE "solicitacoes" ADD COLUMN IF NOT EXISTS "operacao_fluxo_json" JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS "solicitacoes_operacao_fluxo_estado_idx" ON "solicitacoes"("operacao_fluxo_estado");
