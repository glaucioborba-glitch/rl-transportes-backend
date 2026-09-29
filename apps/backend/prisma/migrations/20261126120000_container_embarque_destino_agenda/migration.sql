-- AlterTable
ALTER TABLE "containers_solicitacao" ADD COLUMN "local_destino" VARCHAR(255);
ALTER TABLE "containers_solicitacao" ADD COLUMN "data_agendamento" DATE;
ALTER TABLE "containers_solicitacao" ADD COLUMN "hora_inicio" VARCHAR(5);
ALTER TABLE "containers_solicitacao" ADD COLUMN "hora_fim" VARCHAR(5);
