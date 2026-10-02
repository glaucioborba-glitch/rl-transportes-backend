CREATE TYPE "PatioFilaUrgencia" AS ENUM ('PRIORITARIO', 'PREFERENCIAL', 'NORMAL');
CREATE TYPE "PatioFilaTipo" AS ENUM ('BAIXA', 'COLETA');
CREATE TYPE "PatioFilaStatus" AS ENUM ('PENDENTE', 'CONCLUIDA', 'CANCELADA');

CREATE TABLE "patio_fila_tarefas" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
  "urgencia" "PatioFilaUrgencia" NOT NULL,
  "tipo" "PatioFilaTipo" NOT NULL,
  "status" "PatioFilaStatus" NOT NULL DEFAULT 'PENDENTE',
  "protocolo" VARCHAR(32) NOT NULL,
  "solicitacao_id" TEXT NOT NULL,
  "unidade_iso" VARCHAR(16) NOT NULL,
  "processo_numero" INTEGER,
  "cliente_nome" VARCHAR(255),
  "patio_unidade_id" TEXT,
  "unidade_processo_id" TEXT,
  "posicao_conhecida_codigo" VARCHAR(64),
  "posicao_confirmada_codigo" VARCHAR(64),
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "concluido_em" TIMESTAMP(3),
  "operador_id" TEXT,

  CONSTRAINT "patio_fila_tarefas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "patio_fila_tarefas_tenant_id_status_urgencia_criado_em_idx"
  ON "patio_fila_tarefas"("tenant_id", "status", "urgencia", "criado_em");
CREATE INDEX "patio_fila_tarefas_solicitacao_id_unidade_iso_status_idx"
  ON "patio_fila_tarefas"("solicitacao_id", "unidade_iso", "status");

ALTER TABLE "patio_fila_tarefas"
  ADD CONSTRAINT "patio_fila_tarefas_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
