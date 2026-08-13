-- Trilha de auditoria imutável (append-only) para solicitações

CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "entidade_id" VARCHAR(36) NOT NULL,
    "entidade_tipo" VARCHAR(64) NOT NULL,
    "acao" VARCHAR(32) NOT NULL,
    "usuario_id" VARCHAR(36) NOT NULL,
    "usuario_nome" VARCHAR(255) NOT NULL,
    "usuario_role" VARCHAR(64) NOT NULL,
    "dados_anteriores" JSONB,
    "dados_novos" JSONB,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_logs_entidade_id_entidade_tipo_idx" ON "audit_logs"("entidade_id", "entidade_tipo");
CREATE INDEX "audit_logs_usuario_id_idx" ON "audit_logs"("usuario_id");
CREATE INDEX "audit_logs_criado_em_idx" ON "audit_logs"("criado_em");
