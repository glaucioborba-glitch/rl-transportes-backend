-- Extratos financeiros (conciliação bancária — persistência PostgreSQL)
CREATE TABLE "financeiro_extrato_lotes" (
  "batch_id" TEXT PRIMARY KEY,
  "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
  "formato" VARCHAR(8) NOT NULL,
  "nome_origem" TEXT,
  "importado_em" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_fin_extrato_lote_tenant ON "financeiro_extrato_lotes"("tenant_id", "importado_em" DESC);

CREATE TABLE "financeiro_extrato_linhas" (
  "id_linha" TEXT PRIMARY KEY,
  "batch_id" TEXT NOT NULL REFERENCES "financeiro_extrato_lotes"("batch_id") ON DELETE CASCADE,
  "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
  "indice" INTEGER NOT NULL,
  "data_lancamento" VARCHAR(32) NOT NULL,
  "historico" TEXT NOT NULL,
  "valor" DECIMAL(14,2) NOT NULL,
  "tipo" VARCHAR(8) NOT NULL,
  "saldo_parcial" DECIMAL(14,2),
  "documento" TEXT,
  "nosso_numero" TEXT,
  "fit_id" TEXT
);
CREATE INDEX idx_fin_extrato_linha_batch ON "financeiro_extrato_linhas"("batch_id");
CREATE INDEX idx_fin_extrato_linha_tenant ON "financeiro_extrato_linhas"("tenant_id");

CREATE TABLE "financeiro_extrato_conciliacao_manual" (
  "linha_id" TEXT PRIMARY KEY REFERENCES "financeiro_extrato_linhas"("id_linha") ON DELETE CASCADE,
  "boleto_id" TEXT NOT NULL,
  "faturamento_id" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Log de eventos integração (auditoria — retenção via CRON 90d)
CREATE TABLE "integracao_event_log" (
  "id" TEXT PRIMARY KEY,
  "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
  "tipo" VARCHAR(64) NOT NULL,
  "payload" JSONB NOT NULL,
  "cliente_id" TEXT,
  "correlation_id" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_integracao_event_cliente ON "integracao_event_log"("cliente_id", "created_at" DESC);
CREATE INDEX idx_integracao_event_tenant ON "integracao_event_log"("tenant_id");
CREATE INDEX idx_integracao_event_created ON "integracao_event_log"("created_at");

-- Índices tenant mobile (multi-tenant)
CREATE INDEX IF NOT EXISTS idx_mobile_motorista_tenant ON "mobile_motorista_identities"("tenant_id");
CREATE INDEX IF NOT EXISTS idx_mobile_pin_lockout_tenant ON "mobile_pin_lockouts"("tenant_id");
