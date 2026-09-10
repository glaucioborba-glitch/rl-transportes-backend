-- CreateEnum
CREATE TYPE "TipoNotificacaoPortal" AS ENUM (
  'CADASTRO_EM_ANALISE',
  'CADASTRO_APROVADO',
  'CADASTRO_REJEITADO',
  'CONDICAO_PAGAMENTO_ALTERADA'
);

-- CreateTable
CREATE TABLE "portal_notificacoes" (
    "id" TEXT NOT NULL,
    "tenant_id" VARCHAR(64) NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "tipo" "TipoNotificacaoPortal" NOT NULL,
    "titulo" VARCHAR(160) NOT NULL,
    "corpo" VARCHAR(2000) NOT NULL,
    "link" VARCHAR(255),
    "lida_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portal_notificacoes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "portal_notificacoes_cliente_id_lida_em_created_at_idx"
  ON "portal_notificacoes"("cliente_id", "lida_em", "created_at");

CREATE INDEX "portal_notificacoes_tenant_id_idx"
  ON "portal_notificacoes"("tenant_id");

ALTER TABLE "portal_notificacoes"
  ADD CONSTRAINT "portal_notificacoes_cliente_id_fkey"
  FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
