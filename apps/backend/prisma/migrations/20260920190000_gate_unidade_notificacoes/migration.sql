CREATE TABLE "gate_unidade_notificacoes" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
  "unidade_processo_id" TEXT NOT NULL,
  "unidade_iso" VARCHAR(16) NOT NULL,
  "processo_numero" INTEGER NOT NULL,
  "origem" VARCHAR(16) NOT NULL,
  "titulo" VARCHAR(160) NOT NULL,
  "corpo" VARCHAR(2000) NOT NULL,
  "ator_nome" VARCHAR(255) NOT NULL,
  "ator_role" VARCHAR(64) NOT NULL,
  "campos" JSONB NOT NULL,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "gate_unidade_notificacoes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "gate_unidade_notificacoes_tenant_id_criado_em_idx"
  ON "gate_unidade_notificacoes"("tenant_id", "criado_em");

CREATE INDEX "gate_unidade_notificacoes_unidade_processo_id_idx"
  ON "gate_unidade_notificacoes"("unidade_processo_id");

CREATE TABLE "gate_unidade_notificacao_leituras" (
  "notificacao_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "lida_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "gate_unidade_notificacao_leituras_pkey" PRIMARY KEY ("notificacao_id", "user_id")
);

CREATE INDEX "gate_unidade_notificacao_leituras_user_id_idx"
  ON "gate_unidade_notificacao_leituras"("user_id");

ALTER TABLE "gate_unidade_notificacoes"
  ADD CONSTRAINT "gate_unidade_notificacoes_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "gate_unidade_notificacoes"
  ADD CONSTRAINT "gate_unidade_notificacoes_unidade_processo_id_fkey"
  FOREIGN KEY ("unidade_processo_id") REFERENCES "unidade_processos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "gate_unidade_notificacao_leituras"
  ADD CONSTRAINT "gate_unidade_notificacao_leituras_notificacao_id_fkey"
  FOREIGN KEY ("notificacao_id") REFERENCES "gate_unidade_notificacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "gate_unidade_notificacao_leituras"
  ADD CONSTRAINT "gate_unidade_notificacao_leituras_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
