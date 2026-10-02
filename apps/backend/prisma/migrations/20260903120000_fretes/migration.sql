CREATE TYPE "StatusFrete" AS ENUM (
  'PENDENTE',
  'PROGRAMADO',
  'EM_ANDAMENTO',
  'CONCLUIDO',
  'PROBLEMA',
  'CANCELADO'
);

CREATE TYPE "TipoFrete" AS ENUM (
  'EXP',
  'IMP',
  'DEVOLUCAO_VAZIO',
  'RETIRADA_VAZIO'
);

CREATE TABLE "fretes" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(64) NOT NULL DEFAULT 'default',
  "data_ref" DATE NOT NULL,
  "janela" VARCHAR(16),
  "turno" "TurnoAgendamento",
  "numero_iso" VARCHAR(16) NOT NULL,
  "status_carga" "StatusCarga" NOT NULL,
  "tipo" "TipoFrete" NOT NULL,
  "local" VARCHAR(255),
  "cliente_id" TEXT,
  "cliente_nome" VARCHAR(255) NOT NULL,
  "motorista_nome" VARCHAR(255),
  "cpf_motorista" VARCHAR(11),
  "placa_cavalo" VARCHAR(10),
  "placa_carreta" VARCHAR(10),
  "valor" DECIMAL(12, 2),
  "booking" VARCHAR(120),
  "observacao" TEXT,
  "status" "StatusFrete" NOT NULL DEFAULT 'PENDENTE',
  "solicitacao_id" TEXT,
  "agendamento_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "fretes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fretes_agendamento_id_key" ON "fretes"("agendamento_id");
CREATE INDEX "fretes_tenant_id_data_ref_idx" ON "fretes"("tenant_id", "data_ref");
CREATE INDEX "fretes_tenant_id_status_idx" ON "fretes"("tenant_id", "status");
CREATE INDEX "fretes_tenant_id_numero_iso_idx" ON "fretes"("tenant_id", "numero_iso");
CREATE INDEX "fretes_solicitacao_id_idx" ON "fretes"("solicitacao_id");

ALTER TABLE "fretes"
  ADD CONSTRAINT "fretes_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "fretes"
  ADD CONSTRAINT "fretes_cliente_id_fkey"
  FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "fretes"
  ADD CONSTRAINT "fretes_solicitacao_id_fkey"
  FOREIGN KEY ("solicitacao_id") REFERENCES "solicitacoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "fretes"
  ADD CONSTRAINT "fretes_agendamento_id_fkey"
  FOREIGN KEY ("agendamento_id") REFERENCES "agendamentos_terminal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
