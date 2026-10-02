CREATE TYPE "StatusSolicitacaoAluguel" AS ENUM ('PENDENTE', 'APROVADO', 'REJEITADO');
CREATE TYPE "FinalidadeAluguelSolicitacao" AS ENUM ('RETIRADA_USO_EXTERNO', 'UTILIZACAO_PATIO_FL');

CREATE SEQUENCE IF NOT EXISTS solicitacoes_aluguel_protocolo_seq;

CREATE TABLE "solicitacoes_aluguel" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
  "protocolo" VARCHAR(32) NOT NULL,
  "cliente_id" TEXT NOT NULL,
  "quantidade" INTEGER NOT NULL,
  "finalidade" "FinalidadeAluguelSolicitacao" NOT NULL,
  "data_coleta" TIMESTAMP(3) NOT NULL,
  "data_prevista_devolucao" TIMESTAMP(3) NOT NULL,
  "status" "StatusSolicitacaoAluguel" NOT NULL DEFAULT 'PENDENTE',
  "motivo_rejeicao" VARCHAR(500),
  "created_by_sub" VARCHAR(120),
  "autorizado_por_user_id" TEXT,
  "autorizado_em" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "solicitacoes_aluguel_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "solicitacoes_aluguel_protocolo_key" ON "solicitacoes_aluguel"("protocolo");
CREATE INDEX "solicitacoes_aluguel_tenant_id_status_created_at_idx" ON "solicitacoes_aluguel"("tenant_id", "status", "created_at");
CREATE INDEX "solicitacoes_aluguel_cliente_id_status_idx" ON "solicitacoes_aluguel"("cliente_id", "status");

ALTER TABLE "solicitacoes_aluguel"
  ADD CONSTRAINT "solicitacoes_aluguel_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "solicitacoes_aluguel"
  ADD CONSTRAINT "solicitacoes_aluguel_cliente_id_fkey"
  FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
