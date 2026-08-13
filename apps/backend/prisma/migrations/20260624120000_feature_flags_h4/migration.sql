-- H4 — Feature flags (toggles) com regras JSON
CREATE TABLE "feature_flags" (
    "id" TEXT NOT NULL,
    "chave" VARCHAR(128) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT false,
    "regras" JSONB NOT NULL DEFAULT '{}',
    "descricao" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "feature_flags_chave_key" ON "feature_flags"("chave");

INSERT INTO "feature_flags" ("id", "chave", "ativo", "regras", "descricao", "updated_at")
VALUES
  (
    gen_random_uuid()::text,
    'FISCAL_INTEGRATION_ENABLED',
    true,
    '{}',
    'Emissão NFS-e/boleto via outbox. Desligue para contingência (apenas enfileira).',
    CURRENT_TIMESTAMP
  ),
  (
    gen_random_uuid()::text,
    'GATE_AUTO_APPROVE_ENABLED',
    true,
    '{}',
    'Rule engine de auto-aprovação de agendamentos gate.',
    CURRENT_TIMESTAMP
  );
