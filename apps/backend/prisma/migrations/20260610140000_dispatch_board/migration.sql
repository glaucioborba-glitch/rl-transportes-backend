-- Dispatch Board: Motoristas, Veículos e Ordens de Transporte

CREATE TYPE "StatusMotorista" AS ENUM ('DISPONIVEL', 'EM_VIAGEM', 'OFFLINE');
CREATE TYPE "TipoVeiculo" AS ENUM ('CAVALO', 'CARRETA_BUG', 'CARRETA_EXTENSIVA');
CREATE TYPE "StatusOrdemTransporte" AS ENUM ('PENDENTE', 'DESPACHADA', 'EM_TRANSITO', 'NO_LOCAL', 'CONCLUIDA');

CREATE TABLE "motoristas" (
  "id" TEXT NOT NULL,
  "nome" VARCHAR(255) NOT NULL,
  "cnh" VARCHAR(20) NOT NULL,
  "telefone" VARCHAR(20) NOT NULL,
  "usuario_id" TEXT NOT NULL,
  "status" "StatusMotorista" NOT NULL DEFAULT 'DISPONIVEL',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "motoristas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "veiculos" (
  "id" TEXT NOT NULL,
  "placa" VARCHAR(10) NOT NULL,
  "tipo" "TipoVeiculo" NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "veiculos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ordens_transporte" (
  "id" TEXT NOT NULL,
  "agendamento_id" TEXT NOT NULL,
  "motorista_id" TEXT NOT NULL,
  "veiculo_id" TEXT NOT NULL,
  "status" "StatusOrdemTransporte" NOT NULL DEFAULT 'PENDENTE',
  "data_despacho" TIMESTAMP(3),
  "data_inicio" TIMESTAMP(3),
  "data_chegada" TIMESTAMP(3),
  "data_conclusao" TIMESTAMP(3),
  "pod_foto_url" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ordens_transporte_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "motoristas_cnh_key" ON "motoristas"("cnh");
CREATE UNIQUE INDEX "motoristas_usuario_id_key" ON "motoristas"("usuario_id");
CREATE INDEX "motoristas_status_idx" ON "motoristas"("status");

CREATE UNIQUE INDEX "veiculos_placa_key" ON "veiculos"("placa");

CREATE UNIQUE INDEX "ordens_transporte_agendamento_id_key" ON "ordens_transporte"("agendamento_id");
CREATE INDEX "ordens_transporte_motorista_id_status_idx" ON "ordens_transporte"("motorista_id", "status");
CREATE INDEX "ordens_transporte_status_idx" ON "ordens_transporte"("status");

ALTER TABLE "motoristas" ADD CONSTRAINT "motoristas_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ordens_transporte" ADD CONSTRAINT "ordens_transporte_agendamento_id_fkey"
  FOREIGN KEY ("agendamento_id") REFERENCES "agendamentos_terminal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ordens_transporte" ADD CONSTRAINT "ordens_transporte_motorista_id_fkey"
  FOREIGN KEY ("motorista_id") REFERENCES "motoristas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ordens_transporte" ADD CONSTRAINT "ordens_transporte_veiculo_id_fkey"
  FOREIGN KEY ("veiculo_id") REFERENCES "veiculos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
